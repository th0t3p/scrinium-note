/**
 * Regression test for the search index helpers (MiniSearch).
 * Guards against the "delete does nothing" bug: MiniSearch.remove()/discard()
 * throw for unknown ids, which used to abort deleteNote before its UI update.
 * Run with: npx tsx scripts/test-search.ts
 */
import {
  rebuildSearchIndex,
  upsertSearchDoc,
  removeSearchDoc,
  searchNotes,
  clearSearchIndex,
} from '../src/lib/search';

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error('ASSERT FAILED: ' + msg);
  console.log('  ✓', msg);
}

async function main() {
  rebuildSearchIndex([]);

  // Upserting a brand-new id must not throw.
  let threw = false;
  try {
    upsertSearchDoc({ id: 'new-note', title: 'Hello', folder: '', tags: '', content: 'world' });
  } catch {
    threw = true;
  }
  assert(!threw, 'upsertSearchDoc does not throw for a new id');
  assert(searchNotes('world').includes('new-note'), 'new note is searchable');

  // Updating an existing id must not throw and stays searchable.
  threw = false;
  try {
    upsertSearchDoc({ id: 'new-note', title: 'Hello 2', folder: '', tags: '', content: 'galaxy' });
  } catch {
    threw = true;
  }
  assert(!threw, 'upsertSearchDoc does not throw for an existing id');
  assert(searchNotes('gal').includes('new-note'), 'partial-word search finds the updated note');
  upsertSearchDoc({ id: 'folder-note', title: 'Draft', folder: 'Work/Projects', tags: '', content: 'body' });
  assert(searchNotes('Projects').includes('folder-note'), 'folder metadata is searchable');

  // Removing an existing id must not throw and removes it from results.
  threw = false;
  try {
    removeSearchDoc('new-note');
  } catch {
    threw = true;
  }
  assert(!threw, 'removeSearchDoc does not throw for an existing id');
  assert(!searchNotes('galaxy').includes('new-note'), 'removed note is no longer searchable');

  // Removing an unknown id must not throw.
  threw = false;
  try {
    removeSearchDoc('does-not-exist');
  } catch {
    threw = true;
  }
  assert(!threw, 'removeSearchDoc does not throw for an unknown id');

  clearSearchIndex();
  assert(searchNotes('Projects').length === 0, 'clearing the in-memory index removes unlocked search results');

  console.log('ALL SEARCH TESTS PASSED ✅');
}

main().catch((e) => {
  console.error('TEST FAILED:', e);
  process.exit(1);
});
