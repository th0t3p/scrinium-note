import { readdir, readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = dirname(dirname(fileURLToPath(import.meta.url)));
const forbidden = [/\bfetch\s*\(/, /\bXMLHttpRequest\b/, /\bWebSocket\b/, /\bsendBeacon\b/, /\b(?:createBurnerCiphertext|createLegacyBundle|encryptAttachment|canUseFeature|isProAccount|srpClientProof|registerAccount|syncSubscription)\b/, /(?:stripe|resend|api\/v1|NEXT_PUBLIC_)/i];
async function visit(path) {
  for (const entry of await readdir(path, { withFileTypes: true })) {
    const next = join(path, entry.name);
    if (entry.isDirectory()) await visit(next);
    else if (/\.(ts|tsx)$/.test(next)) {
      const source = await readFile(next, 'utf8');
      if (forbidden.some(pattern => pattern.test(source))) throw new Error('Unexpected account/network/Pro dependency: ' + next);
    }
  }
}
await visit(join(root, 'src'));
const index = await readFile(join(root, 'index.html'), 'utf8');
if (!index.includes("connect-src 'none'")) throw new Error('Missing production no-network CSP.');
const vault = await readFile(join(root, 'src/lib/vault.ts'), 'utf8');
if (!vault.includes("'scrinium-community-v1'")) throw new Error('Community database must remain isolated.');
console.log('PASS: owned source has no account/API/network/Pro dependencies; isolated browser database and production CSP present.');
