import Dexie, { type Table } from 'dexie';
import {
  createVault, unlockVault, unlockWithRecovery, resetPassword, changePassword,
  regenerateRecoveryKey,
  newNoteKey, encryptNoteKey, decryptNoteKey, encryptNoteContent,
  encryptNoteMetadata, decryptNoteBody, decryptNoteMeta,
} from './crypto';
import { passwordStrength, MIN_PASSWORD_BITS } from './password';
import { rebuildSearchIndex, clearSearchIndex } from './search';
import type { PlaintextEntry } from './transfer';
import type { LocalNote, NoteMeta, NoteRow, UnlockedKeys, VaultRecord } from './types';

export const DATABASE_NAME = 'scrinium-community-v1';
export const BACKUP_FORMAT = 'scrinium-community-v1';
export class CommunityDB extends Dexie {
  vault!: Table<VaultRecord, string>;
  notes!: Table<NoteRow, string>;
  constructor(name = DATABASE_NAME) {
    super(name);
    this.version(1).stores({ vault: 'id', notes: 'id, updatedAt, deleted' });
  }
}
export type Snapshot = {
  ready: boolean; status: 'create' | 'locked' | 'unlocked' | 'reset-password';
  notes: LocalNote[]; saving: boolean; error: string | null; recoveryKey: string | null;
};
export interface Backup { format: typeof BACKUP_FORMAT; version: 1; vault: VaultRecord; notes: NoteRow[] }

export function assertPassword(password: string): void {
  if (password.length < 10 || passwordStrength(password).bits < MIN_PASSWORD_BITS) {
    throw new Error('Use a longer password or passphrase (at least 10 characters).');
  }
}

function validatedBackup(value: unknown): Backup {
  if (!value || typeof value !== 'object') throw new Error('Invalid community backup.');
  const b = value as Backup;
  if (b.format !== BACKUP_FORMAT || b.version !== 1 || !b.vault || !Array.isArray(b.notes)) {
    throw new Error('Use an encrypted Scrinium Community backup. Import text or JSON notes from other editions.');
  }
  const v = b.vault;
  if (v.kdfOps !== 3 || v.kdfMem !== 67_108_864) throw new Error('Unsupported backup encryption parameters.');
  const fields = ['salt', 'encryptedAK', 'akNonce', 'encryptedVK', 'vkNonce', 'encryptedAKRecovery', 'akRecoveryNonce'] as const;
  if (fields.some(key => typeof v[key] !== 'string' || !v[key])) throw new Error('Invalid encrypted vault header.');
  const ids = new Set<string>();
  for (const row of b.notes) {
    if (!row || typeof row.id !== 'string' || ids.has(row.id)) throw new Error('Invalid or duplicate note ID.');
    ids.add(row.id);
    for (const field of ['encryptedContent', 'contentNonce', 'encryptedMetadata', 'metadataNonce', 'encryptedKey', 'keyNonce'] as const) {
      if (typeof row[field] !== 'string' || !row[field]) throw new Error('Invalid encrypted note.');
    }
    if (typeof row.deleted !== 'boolean' || !Number.isFinite(row.createdAt) || !Number.isFinite(row.updatedAt)) {
      throw new Error('Invalid note metadata.');
    }
  }
  return b;
}

/** All persistent writes pass through here; no account/API/network dependency. */
export class CommunityVault {
  private state: Snapshot = { ready: false, status: 'create', notes: [], saving: false, error: null, recoveryKey: null };
  private listeners = new Set<() => void>();
  private keys: UnlockedKeys | null = null;
  private header: VaultRecord | null = null;
  private pending: Promise<unknown> = Promise.resolve();
  private unsaved = new Map<string, LocalNote>();
  private initPromise: Promise<void> | null = null;
  private closing = false;
  constructor(public readonly db = new CommunityDB()) {}
  getSnapshot = (): Snapshot => this.state;
  subscribe = (listener: () => void): (() => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  private emit(patch: Partial<Snapshot>): void {
    this.state = { ...this.state, ...patch };
    for (const listener of this.listeners) listener();
  }
  dismissError(): void { this.emit({ error: null }); }
  dismissRecovery(): void { this.emit({ recoveryKey: null }); }
  init(): Promise<void> {
    return this.initPromise ??= this.loadHeader();
  }
  private async loadHeader(): Promise<void> {
    this.header = await this.db.vault.get('default') ?? null;
    this.emit({ ready: true, status: this.header ? 'locked' : 'create' });
  }
  private enqueue<T>(operation: () => Promise<T>): Promise<T> {
    const result = this.pending.then(operation);
    this.pending = result.catch(() => {});
    return result;
  }
  private requireKeys(): UnlockedKeys {
    if (!this.keys || this.closing) throw new Error('Unlock the vault first.');
    return this.keys;
  }
  private refreshIndex(notes = this.state.notes): void {
    rebuildSearchIndex(notes.filter(n => !n.deleted).map(n => ({ ...n, tags: n.tags.join(' ') })));
  }
  private async currentHeader(): Promise<VaultRecord> {
    const current = await this.db.vault.get('default');
    if (!current || current.encryptedVK !== this.header?.encryptedVK) throw new Error('This vault changed in another tab. Reload before editing.');
    return current;
  }
  private async persist(rows: NoteRow[]): Promise<void> {
    await this.db.transaction('rw', this.db.vault, this.db.notes, async () => {
      await this.currentHeader();
      await this.db.notes.bulkPut(rows);
    });
  }
  async create(password: string): Promise<void> {
    assertPassword(password);
    if (await this.db.vault.get('default')) throw new Error('A vault already exists in this browser.');
    const created = await createVault(password);
    const header = { ...created.vault, id: 'default' };
    await this.db.transaction('rw', this.db.vault, this.db.notes, async () => {
      if (await this.db.vault.get('default')) throw new Error('A vault already exists in this browser.');
      await this.db.vault.add(header);
    });
    this.header = header; this.keys = created.keys;
    this.refreshIndex([]);
    this.emit({ ready: true, status: 'unlocked', notes: [], recoveryKey: created.recoveryKey, error: null });
  }
  private async readNotes(keys: UnlockedKeys, rows: NoteRow[]): Promise<LocalNote[]> {
    const notes: LocalNote[] = [];
    for (const row of rows) {
      const meta = await decryptNoteMeta(keys.vk, row);
      const content = await decryptNoteBody(keys.vk, row);
      if (!meta || typeof meta.title !== 'string' || typeof meta.folder !== 'string' || !Array.isArray(meta.tags)) {
        throw new Error('Invalid encrypted note metadata.');
      }
      notes.push({ ...meta, id: row.id, deleted: row.deleted, content });
    }
    return notes;
  }
  async unlock(credential: string, recovery = false): Promise<void> {
    if (this.keys) throw new Error('Vault already unlocked.');
    const header = await this.db.vault.get('default');
    if (!header) throw new Error('No local vault found.');
    const keys = recovery ? await unlockWithRecovery(header, credential) : await unlockVault(header, credential);
    const notes = await this.readNotes(keys, await this.db.notes.toArray());
    this.header = header; this.keys = keys; this.refreshIndex(notes);
    this.emit({ status: recovery ? 'reset-password' : 'unlocked', notes, error: null });
  }
  async flush(): Promise<void> {
    await this.pending;
    if (this.unsaved.size) throw new Error('Some edits could not be saved. Retry saving before locking or exporting.');
  }
  async lock(): Promise<void> {
    this.closing = true;
    try {
      await this.flush();
      if (this.keys) { this.keys.ak.fill(0); this.keys.vk.fill(0); }
      this.keys = null;
      clearSearchIndex();
      this.emit({ status: 'locked', notes: [], recoveryKey: null, error: null });
    } finally { this.closing = false; }
  }
  private async rowFor(note: LocalNote, keys: UnlockedKeys): Promise<NoteRow> {
    const existing = await this.db.notes.get(note.id);
    const nk = existing ? await decryptNoteKey(keys.vk, existing.encryptedKey, existing.keyNonce) : await newNoteKey();
    const wrapped = existing ? { ciphertext: existing.encryptedKey, nonce: existing.keyNonce } : await encryptNoteKey(keys.vk, nk);
    const { id, content, deleted, ...meta } = note;
    const body = await encryptNoteContent(nk, content);
    const metadata = await encryptNoteMetadata(nk, meta);
    return { id, encryptedContent: body.ciphertext, contentNonce: body.nonce,
      encryptedMetadata: metadata.ciphertext, metadataNonce: metadata.nonce,
      encryptedKey: wrapped.ciphertext, keyNonce: wrapped.nonce, deleted,
      createdAt: note.createdAt, updatedAt: note.updatedAt, contentSize: new TextEncoder().encode(content).length,
      version: (existing?.version ?? 0) + 1 };
  }
  async createNote(): Promise<string> {
    const keys = this.requireKeys();
    return this.enqueue(async () => {
      const now = Date.now();
      const note: LocalNote = { id: crypto.randomUUID(), title: 'Untitled', folder: '', tags: [], content: '', createdAt: now, updatedAt: now, deleted: false };
      await this.persist([await this.rowFor(note, keys)]);
      const notes = [note, ...this.state.notes]; this.refreshIndex(notes); this.emit({ notes });
      return note.id;
    });
  }
  updateNote(id: string, changes: Partial<Pick<LocalNote, 'title' | 'folder' | 'content' | 'deleted'>>): Promise<void> {
    const keys = this.requireKeys();
    const previous = this.state.notes.find(note => note.id === id);
    if (!previous) throw new Error('Note not found.');
    const note = { ...previous, ...changes, updatedAt: Date.now() };
    const notes = this.state.notes.map(item => item.id === id ? note : item);
    this.unsaved.set(id, note); this.refreshIndex(notes);
    this.emit({ notes, saving: true, error: null });
    return this.enqueue(async () => {
      try {
        await this.persist([await this.rowFor(note, keys)]);
        if (this.unsaved.get(id) === note) this.unsaved.delete(id);
        this.emit({ saving: this.unsaved.size > 0 });
      } catch (error) {
        this.emit({ saving: false, error: 'Could not save this edit. Your unsaved text is still open; retry saving.' });
        throw error;
      }
    });
  }
  async retrySaving(): Promise<void> {
    for (const note of [...this.unsaved.values()]) await this.updateNote(note.id, { content: note.content });
  }
  async exportEncrypted(): Promise<Backup> {
    this.requireKeys(); await this.flush();
    const header = await this.db.vault.get('default');
    if (!header) throw new Error('No vault found.');
    return { format: BACKUP_FORMAT, version: 1, vault: header, notes: await this.db.notes.toArray() };
  }
  async exportPlaintext(): Promise<{ notes: PlaintextEntry[] }> {
    this.requireKeys(); await this.flush();
    return { notes: this.state.notes.filter(note => !note.deleted).map(({ title, folder, tags, content, createdAt, updatedAt }) => ({ title, folder, tags, content, createdAt, updatedAt })) };
  }
  async importPlaintext(entries: PlaintextEntry[]): Promise<number> {
    const keys = this.requireKeys();
    return this.enqueue(async () => {
      const notes: LocalNote[] = [];
      const rows: NoteRow[] = [];
      for (const entry of entries) {
        const now = Date.now();
        const note: LocalNote = { ...entry, id: crypto.randomUUID(), deleted: false, createdAt: entry.createdAt ?? now, updatedAt: entry.updatedAt ?? now };
        notes.push(note); rows.push(await this.rowFor(note, keys));
      }
      await this.persist(rows);
      const all = [...notes, ...this.state.notes]; this.refreshIndex(all); this.emit({ notes: all });
      return notes.length;
    });
  }
  async restoreEmpty(value: unknown, credential: string, recovery = false): Promise<void> {
    if (await this.db.vault.get('default')) throw new Error('Restore into an empty community vault. Your current vault will not be overwritten.');
    const backup = validatedBackup(value);
    const keys = recovery ? await unlockWithRecovery(backup.vault, credential) : await unlockVault(backup.vault, credential);
    const notes = await this.readNotes(keys, backup.notes);
    const header = { ...backup.vault, id: 'default' };
    // Select fields explicitly: never persist unknown plaintext or Pro fields.
    const rows: NoteRow[] = backup.notes.map(row => ({ id: row.id, encryptedContent: row.encryptedContent,
      contentNonce: row.contentNonce, encryptedMetadata: row.encryptedMetadata, metadataNonce: row.metadataNonce,
      encryptedKey: row.encryptedKey, keyNonce: row.keyNonce, contentSize: row.contentSize,
      version: row.version, deleted: row.deleted, createdAt: row.createdAt, updatedAt: row.updatedAt }));
    await this.db.transaction('rw', this.db.vault, this.db.notes, async () => {
      if (await this.db.vault.get('default')) throw new Error('A vault already exists.');
      await this.db.vault.add(header); await this.db.notes.bulkAdd(rows);
    });
    this.header = header; this.keys = keys; this.refreshIndex(notes);
    this.emit({ ready: true, status: recovery ? 'reset-password' : 'unlocked', notes, error: null });
  }
  async setPassword(newPassword: string, oldPassword?: string): Promise<void> {
    assertPassword(newPassword); const keys = this.requireKeys();
    const current = await this.currentHeader();
    if (this.state.status !== 'reset-password' && oldPassword === undefined) throw new Error('Enter your current password.');
    const header = oldPassword === undefined ? await resetPassword(current, keys, newPassword) : await changePassword(current, oldPassword, newPassword);
    await this.db.vault.put(header); this.header = header;
    this.emit({ status: 'unlocked', error: null });
  }
  async regenerateRecovery(): Promise<void> {
    const keys = this.requireKeys(); await this.flush();
    const result = await regenerateRecoveryKey(await this.currentHeader(), keys);
    await this.db.vault.put(result.vault); this.header = result.vault;
    this.emit({ recoveryKey: result.recoveryKey });
  }
  async updateFolder(folder: string, changes: { name?: string; trash?: boolean }): Promise<void> {
    const keys = this.requireKeys();
    await this.flush();
    return this.enqueue(async () => {
      const changed = this.state.notes.map(note => {
        if (note.deleted || !(note.folder === folder || note.folder.startsWith(folder + '/'))) return note;
        return { ...note, folder: changes.name === undefined ? note.folder : changes.name.trim() + note.folder.slice(folder.length), deleted: changes.trash ?? note.deleted, updatedAt: Date.now() };
      });
      const rows = [];
      for (let i = 0; i < changed.length; i++) if (changed[i] !== this.state.notes[i]) rows.push(await this.rowFor(changed[i], keys));
      await this.persist(rows); this.refreshIndex(changed); this.emit({ notes: changed });
    });
  }
  async destroy(password: string, confirmation: string): Promise<void> {
    this.requireKeys();
    if (confirmation !== 'DELETE') throw new Error('Type DELETE to confirm.');
    await unlockVault(await this.currentHeader(), password);
    this.closing = true;
    try {
      await this.flush();
      await this.db.transaction('rw', this.db.vault, this.db.notes, async () => {
        await this.currentHeader(); await this.db.notes.clear(); await this.db.vault.clear();
      });
      this.keys?.ak.fill(0); this.keys?.vk.fill(0); this.keys = null; this.header = null;
      clearSearchIndex(); this.emit({ status: 'create', notes: [], recoveryKey: null, error: null });
    } finally { this.closing = false; }
  }
}
