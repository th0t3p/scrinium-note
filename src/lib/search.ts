import MiniSearch from 'minisearch';

export interface SearchDoc {
  id: string;
  title: string;
  folder: string;
  tags: string;
  content: string;
}

/**
 * Full-text search runs entirely client-side over decrypted content held in
 * memory (the server can never search what it cannot read). The index is rebuilt
 * on unlock and incrementally updated as notes are edited.
 */
let index: MiniSearch<SearchDoc> | null = null;

export function rebuildSearchIndex(docs: SearchDoc[]): void {
  index = new MiniSearch<SearchDoc>({
    fields: ['title', 'folder', 'tags', 'content'],
    storeFields: ['id'],
    searchOptions: {
      boost: { title: 2, tags: 1.5 },
      prefix: true,
      fuzzy: 0.2,
    },
  });
  index.addAll(docs);
}

export function upsertSearchDoc(doc: SearchDoc): void {
  if (!index) return;
  // MiniSearch.remove() throws if the id is not already indexed (e.g. a brand-new
  // note), so only discard when present before adding the fresh version.
  if (index.has(doc.id)) index.discard(doc.id);
  index.add(doc);
}

export function removeSearchDoc(id: string): void {
  if (!index) return;
  // MiniSearch.discard() throws for unknown ids — guard it so deletion can't abort.
  if (index.has(id)) index.discard(id);
}

export function clearSearchIndex(): void {
  index = null;
}

export function searchNotes(query: string): string[] {
  if (!index) return [];
  const results = index.search(query);
  return results.map((r) => r.id);
}
