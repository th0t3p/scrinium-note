export interface UnlockedKeys { ak: Uint8Array; vk: Uint8Array }
export interface NoteMeta { title: string; folder: string; tags: string[]; createdAt: number; updatedAt: number }
export interface VaultRecord {
  id: string; salt: string; kdfOps: number; kdfMem: number;
  encryptedAK: string; akNonce: string; encryptedVK: string; vkNonce: string;
  encryptedAKRecovery: string; akRecoveryNonce: string; createdAt: number; updatedAt: number;
}
export interface NoteRow {
  id: string; encryptedContent: string; contentNonce: string;
  encryptedMetadata: string; metadataNonce: string; encryptedKey: string; keyNonce: string;
  contentSize: number; version: number; deleted: boolean; createdAt: number; updatedAt: number;
}
export interface LocalNote extends NoteMeta { id: string; content: string; deleted: boolean }
