/**
 * Crypto layer round-trip test (key hierarchy, note encryption, recovery, rotation).
 * Run with: npx tsx scripts/test-crypto.ts
 */
import {
  createVault,
  unlockVault,
  unlockWithRecovery,
  changePassword,
  resetPassword,
  regenerateRecoveryKey,
  newNoteKey,
  encryptNoteKey,
  decryptNoteKey,
  encryptNoteContent,
  decryptNoteContent,
  encryptNoteMetadata,
  decryptNoteMetadata,
} from '../src/lib/crypto';
import { bytesToHex } from '../src/lib/utils';
import type { NoteMeta } from '../src/lib/types';

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error('ASSERT FAILED: ' + msg);
  console.log('  ✓', msg);
}

async function main() {
  const password = 'correct horse battery staple';

  console.log('createVault…');
  const { vault, recoveryKey, keys } = await createVault(password);
  assert(vault.encryptedAK.length > 0, 'vault has encrypted AK');
  assert(/^[0-9A-F]{4}(-[0-9A-F]{4}){7}$/.test(recoveryKey), 'recovery key format');

  console.log('unlockVault (correct password)…');
  const unlocked = await unlockVault(vault, password);
  assert(bytesToHex(unlocked.ak) === bytesToHex(keys.ak), 'AK round-trips via password');
  assert(bytesToHex(unlocked.vk) === bytesToHex(keys.vk), 'VK round-trips via password');

  console.log('unlockVault (wrong password)…');
  let threw = false;
  try {
    await unlockVault(vault, 'wrong password');
  } catch {
    threw = true;
  }
  assert(threw, 'wrong password is rejected');

  console.log('unlockWithRecovery…');
  const recovered = await unlockWithRecovery(vault, recoveryKey);
  assert(bytesToHex(recovered.ak) === bytesToHex(keys.ak), 'AK round-trips via recovery key');

  console.log('note encryption round-trip…');
  const nk = await newNoteKey();
  const encKey = await encryptNoteKey(keys.vk, nk);
  const nk2 = await decryptNoteKey(keys.vk, encKey.ciphertext, encKey.nonce);
  assert(bytesToHex(nk2) === bytesToHex(nk), 'note key round-trips via VK');

  const md = '# Hello\n\nThis is **encrypted** content.';
  const enc = await encryptNoteContent(nk, md);
  const md2 = await decryptNoteContent(nk, enc.ciphertext, enc.nonce);
  assert(md2 === md, 'note content round-trips');

  const meta: NoteMeta = { title: 'Secret', folder: 'Work', tags: ['a', 'b'], createdAt: 1, updatedAt: 2 };
  const encMeta = await encryptNoteMetadata(nk, meta);
  const meta2 = await decryptNoteMetadata(nk, encMeta.ciphertext, encMeta.nonce);
  assert(meta2.title === 'Secret' && meta2.folder === 'Work' && meta2.tags.length === 2, 'note metadata round-trips');

  // Tampered ciphertext must fail (AEAD).
  const tampered = enc.ciphertext.slice(0, -1) + (enc.ciphertext.endsWith('A') ? 'B' : 'A');
  threw = false;
  try {
    await decryptNoteContent(nk, tampered, enc.nonce);
  } catch {
    threw = true;
  }
  assert(threw, 'tampered ciphertext is rejected (AEAD integrity)');

  console.log('changePassword…');
  const rotated = await changePassword(vault, password, 'a new longer password');
  const afterRotate = await unlockVault(rotated, 'a new longer password');
  assert(bytesToHex(afterRotate.ak) === bytesToHex(keys.ak), 'AK survives password change');
  threw = false;
  try {
    await unlockVault(rotated, password);
  } catch {
    threw = true;
  }
  assert(threw, 'old password no longer works after rotation');

  console.log('resetPassword (recovery path)…');
  const reset = await resetPassword(rotated, keys, 'yet another password');
  const afterReset = await unlockVault(reset, 'yet another password');
  assert(bytesToHex(afterReset.ak) === bytesToHex(keys.ak), 'AK survives reset password');

  console.log('regenerateRecoveryKey…');
  const regen = await regenerateRecoveryKey(reset, keys);
  const viaNewRecovery = await unlockWithRecovery(regen.vault, regen.recoveryKey);
  assert(bytesToHex(viaNewRecovery.ak) === bytesToHex(keys.ak), 'AK round-trips via regenerated recovery key');

  console.log('ALL CRYPTO TESTS PASSED ✅');
}

main().catch((e) => {
  console.error('TEST FAILED:', e);
  process.exit(1);
});
