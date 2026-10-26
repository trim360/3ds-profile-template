import { readFile, writeFile, mkdir, lstat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { ROOT, sha256, atomicWrite, checkParents } from '../lib/project.mjs';
import { DEFAULT_CONFIG } from '../lib/config.mjs';
import { managedPath } from './update.mjs';

const crcTable = Array.from({ length: 256 }, (_, number) => { let value = number; for (let bit = 0; bit < 8; bit++) value = value & 1 ? 0xedb88320 ^ value >>> 1 : value >>> 1; return value >>> 0; });
function crc32(bytes) { let value = 0xffffffff; for (const byte of bytes) value = crcTable[(value ^ byte) & 255] ^ value >>> 8; return (value ^ 0xffffffff) >>> 0; }
export function createZip(files) {
  const chunks = []; const central = []; let offset = 0;
  for (const [filename, bytes] of files) {
    const name = Buffer.from(filename); const crc = crc32(bytes);
    const local = Buffer.alloc(30); local.writeUInt32LE(0x04034b50); local.writeUInt16LE(20, 4); local.writeUInt16LE(0x800, 6); local.writeUInt16LE(33, 12);
    local.writeUInt32LE(crc, 14); local.writeUInt32LE(bytes.length, 18); local.writeUInt32LE(bytes.length, 22); local.writeUInt16LE(name.length, 26);
    chunks.push(local, name, bytes);
    const record = Buffer.alloc(46); record.writeUInt32LE(0x02014b50); record.writeUInt16LE(3 << 8 | 20, 4); record.writeUInt16LE(20, 6); record.writeUInt16LE(0x800, 8); record.writeUInt16LE(33, 14);
    record.writeUInt32LE(crc, 16); record.writeUInt32LE(bytes.length, 20); record.writeUInt32LE(bytes.length, 24); record.writeUInt16LE(name.length, 28);
    record.writeUInt32LE(((filename.endsWith('.sh') ? 0o100755 : 0o100644) << 16) >>> 0, 38); record.writeUInt32LE(offset, 42); central.push(record, name); offset += local.length + name.length + bytes.length;
  }
  const directory = Buffer.concat(central); const end = Buffer.alloc(22); end.writeUInt32LE(0x06054b50); end.writeUInt16LE(files.size, 8); end.writeUInt16LE(files.size, 10); end.writeUInt32LE(directory.length, 12); end.writeUInt32LE(offset, 16);
  return Buffer.concat([...chunks, directory, end]);
}
export async function prepareRelease(root = ROOT) {
  const version = JSON.parse(await readFile(path.join(root, 'version.json'), 'utf8'));
  if (!/^\d+\.\d+\.\d+$/.test(version.version)) throw new Error('Stable semantic version required.');
  const tracked = execFileSync('git', ['-C', root, 'ls-files', '-z'], { encoding: 'utf8' }).split('\0').filter(Boolean);
  if (tracked.some(file => /\.(mp3|ogg|wav|m4a)$/i.test(file) || file.startsWith('user-content/'))) throw new Error('Personal audio/user files are tracked by Git. .gitignore does not remove tracked history; review before release.');
  const files = [];
  for (const file of tracked.filter(managedPath).sort()) {
    const source = await checkParents(root, file); if (!(await lstat(source)).isFile()) throw new Error('Release contains a non-regular file.');
    const data = await readFile(source); files.push({ path: file, sha256: sha256(data), dataBase64: data.toString('base64') });
  }
  const manifest = { version: version.version, schemaVersion: version.schemaVersion, files: Object.fromEntries(files.map(file => [file.path, file.sha256])) };
  await atomicWrite(path.join(root, 'template-manifest.json'), JSON.stringify(manifest, null, 2) + '\n', 0o644);
  const payload = Buffer.from(JSON.stringify({ format: 1, ...version, files }));
  const prefix = `3ds-personal-website-v${version.version}/`;
  const archiveFiles = new Map(files.map(file => [prefix + file.path, Buffer.from(file.dataBase64, 'base64')]));
  archiveFiles.set(prefix + 'template-manifest.json', Buffer.from(JSON.stringify(manifest, null, 2) + '\n'));
  archiveFiles.set(prefix + 'config.js', Buffer.from('// Personalize with setup.bat or setup.sh.\nwindow.PROFILE_CONFIG = ' + JSON.stringify(DEFAULT_CONFIG, null, 2) + ';\n'));
  const zip = createZip(archiveFiles); const out = path.join(root, '.release'); await mkdir(out, { recursive: true });
  const payloadName = `3ds-update-v${version.version}.json`; const zipName = `3ds-personal-website-v${version.version}.zip`;
  await writeFile(path.join(out, payloadName), payload); await writeFile(path.join(out, zipName), zip);
  await writeFile(path.join(out, 'SHA256SUMS'), `${sha256(payload)}  ${payloadName}\n${sha256(zip)}  ${zipName}\n`);
  return { out, manifest, payload, zip };
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) prepareRelease().then(result => console.log(result.out)).catch(error => { console.error(error.message); process.exitCode = 1; });
