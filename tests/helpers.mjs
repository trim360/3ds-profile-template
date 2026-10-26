import { mkdtemp, mkdir, copyFile, writeFile, readFile, rm, realpath, chmod } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { ROOT, managedFiles, sha256 } from '../lib/project.mjs';

export async function fixture(t) {
  const parent = await realpath(os.tmpdir()); const root = await mkdtemp(path.join(parent, '3ds-v12-site with spaces-'));
  t.after(async () => { const resolved = await realpath(root); if (path.dirname(resolved) !== parent || !path.basename(resolved).startsWith('3ds-v12-')) throw new Error('Unsafe test cleanup.'); await rm(resolved, { recursive: true }); });
  for (const file of [...await managedFiles(ROOT), 'config.js']) { const to = path.join(root, file); await mkdir(path.dirname(to), { recursive: true }); await copyFile(path.join(ROOT, file), to); }
  await chmod(path.join(root, 'setup.sh'), 0o755);
  const files = {};
  for (const file of await managedFiles(root)) files[file] = sha256(await readFile(path.join(root, file)));
  await writeFile(path.join(root, 'template-manifest.json'), JSON.stringify({ version: '1.2.0', schemaVersion: 2, files }));
  return root;
}
export async function updateFixture(root) {
  const names = await managedFiles(root); names.sort((a, b) => a === 'index.html' ? -1 : b === 'index.html' ? 1 : a.localeCompare(b));
  const files = [];
  for (const file of names) {
    let bytes = await readFile(path.join(root, file));
    if (file === 'index.html') bytes = Buffer.concat([bytes, Buffer.from('\n<!-- update fixture -->\n')]);
    if (file === 'version.json') bytes = Buffer.from(JSON.stringify({ version: '1.3.0', schemaVersion: 2, minimumNode: 22 }));
    files.push({ path: file, sha256: sha256(bytes), dataBase64: bytes.toString('base64') });
  }
  const payload = { format: 1, version: '1.3.0', schemaVersion: 2, minimumNode: 22, files };
  return packageFixture(payload);
}
export function packageFixture(payload) {
  const bytes = Buffer.from(JSON.stringify(payload));
  const release = { version: payload.version, tag: `v${payload.version}`, assets: [{ name: `3ds-update-v${payload.version}.json`, size: bytes.length, digest: 'sha256:' + sha256(bytes) }] };
  const fetchImpl = async () => new Response(bytes, { status: 200 });
  return { payload, bytes, release, fetchImpl };
}
