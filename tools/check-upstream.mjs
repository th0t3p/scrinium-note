import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = dirname(dirname(fileURLToPath(import.meta.url)));
const upstream = process.argv[2];
if (!upstream) { console.error('Usage: npm run upstream:check -- /absolute/path/to/private/scrinium'); process.exit(1); }
const manifest = JSON.parse(await readFile(join(root, 'UPSTREAM.json'), 'utf8'));
const result = [];
for (const file of manifest.files) {
  let current = null;
  try { current = createHash('sha256').update(await readFile(resolve(upstream, file.upstream))).digest('hex'); } catch {}
  result.push({ file: file.upstream, target: file.target, state: current === file.upstreamSha256 ? 'unchanged' : current ? 'review upstream changes' : 'missing upstream file' });
}
console.log(JSON.stringify({ snapshotCommit: manifest.sourceCommit, policy: 'Report only; no files imported or overwritten.', files: result }, null, 2));
if (result.some(file => file.state !== 'unchanged')) process.exitCode = 2;
