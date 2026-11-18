/**
 * Pure helpers for importing/exporting notes and previewing what an import
 * will change. Kept dependency-light (no browser storage) so they are easily
 * unit-tested.
 */
import type { NoteRow, VaultRecord } from './types';

export interface PlaintextEntry {
  title: string;
  folder: string;
  tags: string[];
  content: string;
  createdAt?: number;
  updatedAt?: number;
}

/**
 * Parse one imported file into plaintext note entries.
 * - `.json` → a Scrinium plaintext export (`{ notes: [...] }` or a bare array).
 * - `.md` / `.txt` / etc. → a single note (title = filename).
 * Rejects encrypted backups with a clear error so they are never mis-imported.
 */
export async function parsePlaintextFile(file: File): Promise<PlaintextEntry[]> {
  const text = await file.text();
  const isJson = /\.json$/i.test(file.name);

  if (isJson) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      throw new Error(`${file.name} is not valid JSON.`);
    }
    // An encrypted backup has a top-level `vault` key and its notes carry
    // `encryptedContent`. Importing it here would create empty "Untitled" notes.
    if (parsed && typeof parsed === 'object' && 'vault' in (parsed as object)) {
      throw new Error(`${file.name} is an encrypted backup. Use "Restore vault — encrypted backup" instead.`);
    }
    const p = parsed as { notes?: unknown };
    const arr = Array.isArray(p?.notes) ? p.notes : Array.isArray(parsed) ? parsed : null;
    if (!arr) throw new Error(`${file.name} does not look like a Scrinium plaintext export.`);
    return (arr as Array<Record<string, unknown>>).map((n) => ({
      title: typeof n?.title === 'string' && n.title ? n.title : 'Untitled',
      folder: typeof n?.folder === 'string' ? n.folder : '',
      tags: Array.isArray(n?.tags) ? n.tags.map(String) : [],
      content: typeof n?.content === 'string' ? n.content : '',
      createdAt: typeof n?.createdAt === 'number' ? n.createdAt : undefined,
      updatedAt: typeof n?.updatedAt === 'number' ? n.updatedAt : undefined,
    }));
  }

  const title = file.name.replace(/\.(md|markdown|mdown|txt|text)$/i, '').trim() || 'Untitled';
  return [{ title, folder: '', tags: [], content: text }];
}

export async function parsePlaintextFiles(files: File[]): Promise<PlaintextEntry[]> {
  const entries: PlaintextEntry[] = [];
  for (const file of files) entries.push(...(await parsePlaintextFile(file)));
  return entries;
}

export interface EncryptedBackup {
  vault: VaultRecord;
  notes: NoteRow[];
}

/** Parse and validate a full encrypted backup JSON (produced by "Export encrypted backup"). */
export function parseEncryptedBackup(text: string): EncryptedBackup {
  let data: { vault?: VaultRecord; notes?: NoteRow[] };
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error('That file is not valid JSON.');
  }
  const vault = data.vault as VaultRecord | undefined;
  if (!vault || !vault.salt || !vault.encryptedAK || !vault.encryptedVK || !Array.isArray(data.notes)) {
    throw new Error('That file is not a valid encrypted backup.');
  }
  return { vault, notes: data.notes };
}

export interface DiffEntry {
  id: string;
  kind: 'add' | 'remove' | 'update';
  updatedAt: number;
  deleted: boolean;
}

export interface RestoreDiff {
  added: DiffEntry[];
  removed: DiffEntry[];
  updated: DiffEntry[];
  unchanged: number;
  backupTotal: number;
  currentTotal: number;
}

/**
 * Compare a backup's notes against the current vault's notes (by id, updatedAt,
 * and deleted flag) so a restore can be previewed before it replaces everything.
 */
export function computeRestoreDiff(backup: NoteRow[], current: NoteRow[]): RestoreDiff {
  const backupMap = new Map(backup.map((n) => [n.id, n]));
  const currentMap = new Map(current.map((n) => [n.id, n]));

  const added: DiffEntry[] = [];
  const updated: DiffEntry[] = [];
  let unchanged = 0;

  for (const [id, b] of backupMap) {
    const c = currentMap.get(id);
    if (!c) {
      added.push({ id, kind: 'add', updatedAt: b.updatedAt, deleted: b.deleted });
    } else if (c.updatedAt !== b.updatedAt || c.deleted !== b.deleted) {
      updated.push({ id, kind: 'update', updatedAt: b.updatedAt, deleted: b.deleted });
    } else {
      unchanged++;
    }
  }

  const removed: DiffEntry[] = [];
  for (const [id, c] of currentMap) {
    if (!backupMap.has(id)) removed.push({ id, kind: 'remove', updatedAt: c.updatedAt, deleted: c.deleted });
  }

  return {
    added,
    removed,
    updated,
    unchanged,
    backupTotal: backup.length,
    currentTotal: current.length,
  };
}
