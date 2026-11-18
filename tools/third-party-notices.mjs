import { execFileSync } from 'node:child_process';
import { readdir, readFile, writeFile, mkdir, rm, copyFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = dirname(dirname(fileURLToPath(import.meta.url)));
const directories = execFileSync('npm', ['ls', '--omit=dev', '--all', '--parseable'], { cwd: root, encoding: 'utf8' }).trim().split('\n').filter(path => path !== root);
const destination = join(root, 'third-party-licenses');
await mkdir(destination, { recursive: true });
await mkdir(join(root, 'docs'), { recursive: true });
const records = []; const seen = new Set();
for (const path of directories) {
  const pkg = JSON.parse(await readFile(join(path, 'package.json'), 'utf8'));
  const id = `${pkg.name}@${pkg.version}`;
  if (seen.has(id)) continue; seen.add(id);
  const license = typeof pkg.license === 'string' ? pkg.license : pkg.license?.type ?? pkg.licenses?.map(l => l.type).join(' OR ') ?? 'UNDECLARED';
  const folder = id.replaceAll('/', '__');
  const names = (await readdir(path)).filter(name => /^(licen[cs]e|copying|notice)([._-]|$)/i.test(name));
  const texts = [];
  for (const name of names) {
    try {
      const data = await readFile(join(path, name), 'utf8');
      await mkdir(join(destination, folder), { recursive: true });
      await writeFile(join(destination, folder, name), data); texts.push(`third-party-licenses/${folder}/${name}`);
    } catch {}
  }
  records.push({ package: pkg.name, version: pkg.version, license, repository: typeof pkg.repository === 'string' ? pkg.repository : pkg.repository?.url ?? null, texts });
}
records.sort((a,b) => a.package.localeCompare(b.package));
await writeFile(join(root, 'docs/dependencies.json'), JSON.stringify(records, null, 2) + '\n');
await writeFile(join(root, 'THIRD_PARTY_NOTICES.md'), `# Third-party notices\n\nThese separate libraries retain their own licenses. The application's\nnoncommercial terms do not replace the grants below. Versions come from the\ninstalled production dependency tree. License texts are included where the\npackage distributes them; missing texts must be resolved before public release.\n\n| Package | Version | License | Included text |\n|---|---|---|---|\n${records.map(p => `| ${p.package} | ${p.version} | ${p.license} | ${p.texts.map(t=>`[${t.split('/').at(-1)}](${t})`).join(', ') || 'Needs review'} |`).join('\n')}\n`);
console.log(JSON.stringify({ packages: records.length, missingTexts: records.filter(p=>!p.texts.length).map(p=>({ package:p.package,repository:p.repository,license:p.license })) }, null, 2));
