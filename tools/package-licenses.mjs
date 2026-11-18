import { cp, mkdir } from 'node:fs/promises';
await mkdir('dist/licenses', { recursive: true });
for (const name of ['LICENSE.md', 'NOTICE.md', 'THIRD_PARTY_NOTICES.md', 'third-party-licenses']) {
  await cp(name, 'dist/licenses/' + name, { recursive: true });
}
