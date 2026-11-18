/**
 * Zero-knowledge encryption layer (libsodium).
 *
 * Key hierarchy (1Password model, per plan.md §5):
 *
 *   password ──Argon2id──▶ Master Unlock Key (MUK)
 *        MUK ──XChaCha20──▶ Account Key (AK)
 *         AK ──XChaCha20──▶ Vault Key (VK)
 *         VK ──XChaCha20──▶ Note Key (NK, one per note)
 *         NK ──XChaCha20──▶ note content + metadata
 *
 * Every byte persisted is ciphertext. Plaintext and keys exist only in memory.
 */
import { ensureSodium } from './sodium';
import { b64, unb64, bytesToHex, hexToBytes, utf8, utf8Decode } from './utils';
import type { NoteMeta, UnlockedKeys, VaultRecord } from './types';

const KEY_BYTES = 32; // XChaCha20-Poly1305 key
const SALT_BYTES = 16; // Argon2id salt
const NONCE_BYTES = 24; // XChaCha20-Poly1305 nonce (192-bit)

// Argon2id parameters: 64 MiB memory, 3 iterations (plan.md §5).
const KDF_OPS = 3;
const KDF_MEM = 67_108_864; // 64 MiB

// ------------------------------------------------------------------- helpers

async function deriveMUK(password: string, salt: Uint8Array): Promise<Uint8Array> {
  const sodium = await ensureSodium();
  return sodium.crypto_pwhash(
    KEY_BYTES,
    password,
    salt,
    KDF_OPS,
    KDF_MEM,
    sodium.crypto_pwhash_ALG_ARGON2ID13,
  );
}

async function aeadEncrypt(
  key: Uint8Array,
  plaintext: Uint8Array,
): Promise<{ ciphertext: Uint8Array; nonce: Uint8Array }> {
  const sodium = await ensureSodium();
  const nonce = sodium.randombytes_buf(NONCE_BYTES);
  const ciphertext = sodium.crypto_aead_xchacha20poly1305_ietf_encrypt(
    plaintext,
    null,
    null,
    nonce,
    key,
  );
  return { ciphertext, nonce };
}

async function aeadDecrypt(
  key: Uint8Array,
  nonce: Uint8Array,
  ciphertext: Uint8Array,
): Promise<Uint8Array | null> {
  const sodium = await ensureSodium();
  try {
    return sodium.crypto_aead_xchacha20poly1305_ietf_decrypt(null, ciphertext, null, nonce, key);
  } catch {
    return null;
  }
}

async function newKey(): Promise<Uint8Array> {
  const sodium = await ensureSodium();
  return sodium.crypto_aead_xchacha20poly1305_ietf_keygen();
}

// --------------------------------------------------------------- recovery key

/** 128-bit recovery key, human-readable: XXXX-XXXX-XXXX-XXXX-XXXX-XXXX-XXXX-XXXX */
export function generateRecoveryKey(): string {
  const buf = new Uint8Array(16);
  crypto.getRandomValues(buf);
  return bytesToHex(buf).toUpperCase().match(/.{1,4}/g)!.join('-');
}

export function recoveryKeyToBytes(key: string): Uint8Array {
  return hexToBytes(key.replace(/[^0-9a-fA-F]/g, ''));
}

/** Derive a 32-byte key from the recovery key (BLAKE2b-256). */
async function deriveRecoveryKey(key: string): Promise<Uint8Array> {
  const sodium = await ensureSodium();
  return sodium.crypto_generichash(KEY_BYTES, recoveryKeyToBytes(key), null);
}

// ------------------------------------------------------------------ vault

export async function createVault(
  password: string,
): Promise<{ vault: VaultRecord; recoveryKey: string; keys: UnlockedKeys }> {
  const sodium = await ensureSodium();
  const salt = sodium.randombytes_buf(SALT_BYTES);
  const muk = await deriveMUK(password, salt);

  const ak = await newKey();
  const vk = await newKey();
  const recoveryKey = generateRecoveryKey();
  const recoveryDerived = await deriveRecoveryKey(recoveryKey);

  const encAK = await aeadEncrypt(muk, ak);
  const encVK = await aeadEncrypt(ak, vk);
  const encAKRecovery = await aeadEncrypt(recoveryDerived, ak);

  const now = Date.now();
  const vault: VaultRecord = {
    id: crypto.randomUUID(),
    salt: b64(salt),
    kdfOps: KDF_OPS,
    kdfMem: KDF_MEM,
    encryptedAK: b64(encAK.ciphertext),
    akNonce: b64(encAK.nonce),
    encryptedVK: b64(encVK.ciphertext),
    vkNonce: b64(encVK.nonce),
    encryptedAKRecovery: b64(encAKRecovery.ciphertext),
    akRecoveryNonce: b64(encAKRecovery.nonce),
    createdAt: now,
    updatedAt: now,
  };

  return { vault, recoveryKey, keys: { ak, vk } };
}

/** Derive MUK from the password and decrypt AK then VK. Throws on wrong password. */
export async function unlockVault(vault: VaultRecord, password: string): Promise<UnlockedKeys> {
  const salt = unb64(vault.salt);
  const muk = await deriveMUK(password, salt);
  const ak = await aeadDecrypt(muk, unb64(vault.akNonce), unb64(vault.encryptedAK));
  if (!ak) throw new Error('Invalid password');
  const vk = await aeadDecrypt(ak, unb64(vault.vkNonce), unb64(vault.encryptedVK));
  if (!vk) throw new Error('Invalid vault');
  return { ak, vk };
}

/** Decrypt AK via the recovery key, then VK. Throws on a wrong recovery key. */
export async function unlockWithRecovery(vault: VaultRecord, recoveryKey: string): Promise<UnlockedKeys> {
  const recoveryDerived = await deriveRecoveryKey(recoveryKey);
  const ak = await aeadDecrypt(
    recoveryDerived,
    unb64(vault.akRecoveryNonce),
    unb64(vault.encryptedAKRecovery),
  );
  if (!ak) throw new Error('Invalid recovery key');
  const vk = await aeadDecrypt(ak, unb64(vault.vkNonce), unb64(vault.encryptedVK));
  if (!vk) throw new Error('Invalid vault');
  return { ak, vk };
}

/** Re-encrypt the Account Key under a new password (used after recovery or password change). */
export async function resetPassword(
  vault: VaultRecord,
  keys: UnlockedKeys,
  newPassword: string,
): Promise<VaultRecord> {
  const sodium = await ensureSodium();
  const salt = sodium.randombytes_buf(SALT_BYTES);
  const muk = await deriveMUK(newPassword, salt);
  const encAK = await aeadEncrypt(muk, keys.ak);
  return {
    ...vault,
    salt: b64(salt),
    encryptedAK: b64(encAK.ciphertext),
    akNonce: b64(encAK.nonce),
    updatedAt: Date.now(),
  };
}

/** Verify the old password and rotate to the new one. */
export async function changePassword(
  vault: VaultRecord,
  oldPassword: string,
  newPassword: string,
): Promise<VaultRecord> {
  const keys = await unlockVault(vault, oldPassword);
  return resetPassword(vault, keys, newPassword);
}

/** Generate a fresh recovery key and re-encrypt the Account Key with it. */
export async function regenerateRecoveryKey(
  vault: VaultRecord,
  keys: UnlockedKeys,
): Promise<{ vault: VaultRecord; recoveryKey: string }> {
  const recoveryKey = generateRecoveryKey();
  const recoveryDerived = await deriveRecoveryKey(recoveryKey);
  const encAKRecovery = await aeadEncrypt(recoveryDerived, keys.ak);
  return {
    recoveryKey,
    vault: {
      ...vault,
      encryptedAKRecovery: b64(encAKRecovery.ciphertext),
      akRecoveryNonce: b64(encAKRecovery.nonce),
      updatedAt: Date.now(),
    },
  };
}

// ------------------------------------------------------------- per-note keys

export async function newNoteKey(): Promise<Uint8Array> {
  return newKey();
}

export async function encryptNoteKey(
  vk: Uint8Array,
  nk: Uint8Array,
): Promise<{ ciphertext: string; nonce: string }> {
  const out = await aeadEncrypt(vk, nk);
  return { ciphertext: b64(out.ciphertext), nonce: b64(out.nonce) };
}

export async function decryptNoteKey(
  vk: Uint8Array,
  encryptedKey: string,
  keyNonce: string,
): Promise<Uint8Array> {
  const nk = await aeadDecrypt(vk, unb64(keyNonce), unb64(encryptedKey));
  if (!nk) throw new Error('Failed to decrypt note key');
  return nk;
}

// ------------------------------------------------------------------- content

export async function encryptNoteContent(
  nk: Uint8Array,
  markdown: string,
): Promise<{ ciphertext: string; nonce: string }> {
  const out = await aeadEncrypt(nk, utf8(markdown));
  return { ciphertext: b64(out.ciphertext), nonce: b64(out.nonce) };
}

export async function decryptNoteContent(
  nk: Uint8Array,
  ciphertext: string,
  nonce: string,
): Promise<string> {
  const out = await aeadDecrypt(nk, unb64(nonce), unb64(ciphertext));
  if (!out) throw new Error('Failed to decrypt note content');
  return utf8Decode(out);
}

export async function encryptNoteMetadata(
  nk: Uint8Array,
  meta: NoteMeta,
): Promise<{ ciphertext: string; nonce: string }> {
  const out = await aeadEncrypt(nk, utf8(JSON.stringify(meta)));
  return { ciphertext: b64(out.ciphertext), nonce: b64(out.nonce) };
}

export async function decryptNoteMetadata(
  nk: Uint8Array,
  ciphertext: string,
  nonce: string,
): Promise<NoteMeta> {
  const out = await aeadDecrypt(nk, unb64(nonce), unb64(ciphertext));
  if (!out) throw new Error('Failed to decrypt note metadata');
  return JSON.parse(utf8Decode(out)) as NoteMeta;
}

// --------------------------------------------------- convenience: full note

export async function decryptNoteMeta(vk: Uint8Array, row: {
  encryptedKey: string;
  keyNonce: string;
  encryptedMetadata: string;
  metadataNonce: string;
}): Promise<NoteMeta> {
  const nk = await decryptNoteKey(vk, row.encryptedKey, row.keyNonce);
  return decryptNoteMetadata(nk, row.encryptedMetadata, row.metadataNonce);
}

export async function decryptNoteBody(vk: Uint8Array, row: {
  encryptedKey: string;
  keyNonce: string;
  encryptedContent: string;
  contentNonce: string;
}): Promise<string> {
  const nk = await decryptNoteKey(vk, row.encryptedKey, row.keyNonce);
  return decryptNoteContent(nk, row.encryptedContent, row.contentNonce);
}
