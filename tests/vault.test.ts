import 'fake-indexeddb/auto';
import assert from 'node:assert/strict';
import { CommunityDB, CommunityVault } from '../src/lib/vault';
import { searchNotes } from '../src/lib/search';
import { parsePlaintextFile } from '../src/lib/transfer';
import type { NoteRow } from '../src/lib/types';

if (typeof globalThis.CustomEvent === 'undefined') {
  globalThis.CustomEvent = class<T> extends Event { detail: T; constructor(type: string, init?: CustomEventInit<T>) { super(type, init); this.detail = init?.detail as T; } } as unknown as typeof CustomEvent;
}
const password = 'Community-Example-Passphrase-92';
const nextPassword = 'Changed-Example-Passphrase-73';
const databases: CommunityDB[] = [];
function fresh() { const db = new CommunityDB('community-test-' + crypto.randomUUID()); databases.push(db); return new CommunityVault(db); }
const checks: string[] = [];
function pass(label: string) { checks.push(label); console.log('PASS:', label); }

try {
  const vault = fresh(); await vault.init(); assert.equal(vault.getSnapshot().status, 'create');
  await assert.rejects(vault.create('password'));
  await vault.create(password); const recovery = vault.getSnapshot().recoveryKey!; vault.dismissRecovery();
  await assert.rejects(vault.create(password)); pass('weak-password rejection and no accidental vault replacement');
  const id = await vault.createNote();
  await vault.updateNote(id, { title: 'Private title sentinel', folder: 'Private folder sentinel', content: '# Private body sentinel\n\nSome **Markdown**.' });
  const raw = JSON.stringify({ vault: await vault.db.vault.toArray(), notes: await vault.db.notes.toArray() });
  for (const secret of [password, recovery, 'Private title sentinel', 'Private folder sentinel', 'Private body sentinel']) assert.equal(raw.includes(secret), false);
  pass('persisted vault and notes contain no password, recovery key, plaintext title/folder/content');
  assert.deepEqual(searchNotes('sentinel'), [id]);
  const updates = [vault.updateNote(id, { content: 'First edit' }), vault.updateNote(id, { content: 'Second edit' }), vault.updateNote(id, { content: 'Final queued edit' })];
  const locking = vault.lock(); await Promise.all([...updates, locking]);
  assert.equal(vault.getSnapshot().status, 'locked'); assert.equal(vault.getSnapshot().notes.length, 0); assert.deepEqual(searchNotes('sentinel'), []);
  await assert.rejects(vault.unlock('wrong password')); assert.equal(vault.getSnapshot().status, 'locked');
  await vault.unlock(password); assert.equal(vault.getSnapshot().notes[0].content, 'Final queued edit');
  pass('queued edits finish before locking; wrong password rejected; plaintext search cleared');
  const reloaded = new CommunityVault(vault.db); await reloaded.init(); assert.equal(reloaded.getSnapshot().status, 'locked'); await reloaded.unlock(password);
  assert.equal(reloaded.getSnapshot().notes[0].title, 'Private title sentinel'); pass('new application instance requires unlock and restores persisted notes');
  const originalPut = vault.db.notes.bulkPut.bind(vault.db.notes);
  vault.db.notes.bulkPut = (async () => { throw new Error('Synthetic quota failure'); }) as unknown as typeof vault.db.notes.bulkPut;
  await assert.rejects(vault.updateNote(id, { content: 'Unsaved text must survive' })); await assert.rejects(vault.lock());
  assert.equal(vault.getSnapshot().status, 'unlocked'); assert.equal(vault.getSnapshot().notes[0].content, 'Unsaved text must survive');
  vault.db.notes.bulkPut = originalPut; await vault.retrySaving(); await vault.flush(); assert.equal(vault.getSnapshot().error, null);
  pass('storage failure keeps edits open, prevents lock, and can be retried');
  await vault.updateNote(id, { deleted: true }); assert.deepEqual(searchNotes('survive'), []);
  assert.equal((await vault.db.notes.get(id))?.deleted, true); await vault.updateNote(id, { deleted: false });
  pass('trash is recoverable and removed from active search');
  const entries = await parsePlaintextFile(new File(['# Imported\n\nBody'], 'Imported.md'));
  assert.equal(await vault.importPlaintext(entries), 1);
  const plain = await vault.exportPlaintext(); assert.equal(plain.notes.length, 2); assert.ok(plain.notes.some(n => n.content.includes('# Imported')));
  const backup = await vault.exportEncrypted();
  assert.equal(JSON.stringify(backup).includes('Unsaved text must survive'), false); pass('Markdown import and explicit plaintext/encrypted exports');
  const restored = fresh(); await restored.init();
  await assert.rejects(restored.restoreEmpty(backup, 'wrong password')); assert.equal(await restored.db.vault.count(), 0);
  const damaged = structuredClone(backup); damaged.notes[0].encryptedContent = 'invalid';
  await assert.rejects(restored.restoreEmpty(damaged, password)); assert.equal(await restored.db.vault.count(), 0);
  const duplicates = structuredClone(backup); duplicates.notes.push(duplicates.notes[0]);
  await assert.rejects(restored.restoreEmpty(duplicates, password));
  await assert.rejects(restored.restoreEmpty({ vault: backup.vault, notes: backup.notes }, password));
  pass('wrong-password, tampered, duplicate and non-community backups fail before persistence');
  const withExtra = structuredClone(backup) as typeof backup & { extra?: string };
  (withExtra.notes[0] as NoteRow & { plaintext?: string }).plaintext = 'Do not persist unknown plaintext';
  await restored.restoreEmpty(withExtra, password); assert.equal(restored.getSnapshot().notes.length, 2);
  assert.equal(JSON.stringify(await restored.db.notes.toArray()).includes('Do not persist unknown plaintext'), false);
  await assert.rejects(restored.restoreEmpty(backup, password)); assert.equal(restored.getSnapshot().notes.length, 2);
  pass('restore selects only encrypted fields and never overwrites an existing vault');
  await restored.lock(); await restored.unlock(recovery, true); assert.equal(restored.getSnapshot().status, 'reset-password');
  await restored.setPassword(nextPassword); await restored.lock(); await assert.rejects(restored.unlock(password)); await restored.unlock(nextPassword);
  assert.equal(restored.getSnapshot().notes.length, 2); pass('recovery unlock and password reset preserve notes and reject the old password');
  await assert.rejects(restored.setPassword(password, 'wrong old password'));
  await restored.setPassword(password, nextPassword); await restored.lock(); await restored.unlock(password);
  assert.equal(restored.getSnapshot().notes.length, 2); pass('ordinary password changes require the current password');
  await restored.regenerateRecovery(); const newRecovery = restored.getSnapshot().recoveryKey!;
  await restored.lock(); await assert.rejects(restored.unlock(recovery, true)); await restored.unlock(newRecovery, true); await restored.setPassword(password);
  pass('regenerating a recovery key revokes the previous recovery key');
  await restored.updateFolder('Private folder sentinel', { name: 'Renamed' });
  assert.equal(restored.getSnapshot().notes.find(n => n.id === id)?.folder, 'Renamed');
  await restored.updateFolder('Renamed', { trash: true }); assert.equal(restored.getSnapshot().notes.find(n => n.id === id)?.deleted, true);
  pass('folder rename and recoverable folder-to-trash preserve encrypted notes');
  await assert.rejects(restored.destroy(password, ''));
  await assert.rejects(restored.destroy('wrong password', 'DELETE'));
  assert.equal(await restored.db.vault.count(), 1);
  await restored.destroy(password, 'DELETE'); assert.equal(await restored.db.vault.count(), 0); assert.equal(await restored.db.notes.count(), 0); assert.equal(restored.getSnapshot().status, 'create');
  pass('destruction requires the password and explicit confirmation and clears only this community database');
  console.log(`ALL ${checks.length} VAULT BEHAVIOR CHECKS PASSED`);
} finally {
  for (const db of databases) await db.delete();
}
