import { build } from 'esbuild';
import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';

execFileSync(process.execPath, ['tools/third-party-notices.mjs'], { stdio: 'inherit' });
await rm('dist', { recursive: true, force: true });
await mkdir('dist', { recursive: true });
const result = await build({
  entryPoints: ['src/main.tsx'], outdir: 'dist/assets', bundle: true, minify: true,
  metafile: true, format: 'esm', platform: 'browser', target: ['es2022'], jsx: 'automatic',
  define: { 'process.env.NODE_ENV': '"production"' },
  entryNames: 'community-[hash]', assetNames: '[name]-[hash]', legalComments: 'linked', logLevel: 'info',
});
const [script, metadata] = Object.entries(result.metafile.outputs).find(([name, data]) => name.endsWith('.js') && data.entryPoint === 'src/main.tsx');
let html = await readFile('index.html', 'utf8');
html = html.replace('src="/src/main.tsx"', 'src="/' + script.replace(/^dist\//, '') + '"');
if (metadata.cssBundle) html = html.replace('</head>', `<link rel="stylesheet" href="/${metadata.cssBundle.replace(/^dist\//, '')}" /></head>`);
await writeFile('dist/index.html', html);
await cp('public', 'dist', { recursive: true });
await import('./package-licenses.mjs');
console.log('Built static community app; no application server or online credentials required.');
