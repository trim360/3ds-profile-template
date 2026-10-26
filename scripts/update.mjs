import { readFile, writeFile, mkdir, copyFile, lstat, readdir, unlink } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createInterface } from 'node:readline';
import { randomUUID } from 'node:crypto';
import { ROOT, CORE_FILES, CORE_DIRS, exists, sha256, atomicWrite, localPath, checkParents, withLock, loadProfile, profileWrites, mediaReferences } from '../lib/project.mjs';
import { DEFAULT_ICONS, SCHEMA_VERSION } from '../lib/config.mjs';
import { latestRelease, compareVersions, OFFICIAL_REPOSITORY, releaseUrl } from '../lib/releases.mjs';

const MAX_PACKAGE = 20 * 1024 * 1024;
const journalName = '.update-journal.json';
export async function installedVersion(root) {
  return await exists(path.join(root, 'version.json')) ? JSON.parse(await readFile(path.join(root, 'version.json'), 'utf8')).version : '0.0.0';
}
export function managedPath(file) {
  localPath('/installation', file);
  if (file === 'config.js' || /(^|\/)(\.env[^/]*|\.git|user-content|backups|dist)(\/|$)/i.test(file)) return false;
  return CORE_FILES.includes(file) || CORE_DIRS.some(dir => file.startsWith(dir + '/')) && /\.(m?js|json|css|html|svg|png|jpe?g|webp|gif|ico|md|txt|sh|bat)$/i.test(file);
}
export function decodePackage(data, releaseVersion) {
  if (data.length > MAX_PACKAGE) throw new Error('Update package exceeds 20 MB.');
  const payload = JSON.parse(data.toString('utf8'));
  if (payload.format !== 1 || payload.version !== releaseVersion || !/^\d+\.\d+\.\d+$/.test(payload.version)) throw new Error('Release/package version mismatch.');
  if (payload.schemaVersion !== SCHEMA_VERSION || !Number.isInteger(payload.minimumNode) || payload.minimumNode > Number(process.versions.node.split('.')[0])) throw new Error('Incompatible configuration schema or Node.js version.');
  if (!Array.isArray(payload.files) || payload.files.length < 1 || payload.files.length > 500) throw new Error('Invalid update file count.');
  const entries = new Map(); const caseNames = new Set(); let total = 0;
  for (const item of payload.files) {
    if (typeof item.path !== 'string' || item.path.length > 200 || !managedPath(item.path)) throw new Error(`Protected or unsafe update path: ${item.path}`);
    const lower = item.path.toLowerCase(); if (caseNames.has(lower)) throw new Error('Duplicate update path.'); caseNames.add(lower);
    if (typeof item.dataBase64 !== 'string' || item.dataBase64.length > 8 * 1024 * 1024 || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(item.dataBase64)) throw new Error('Invalid file encoding.');
    const bytes = Buffer.from(item.dataBase64, 'base64'); total += bytes.length;
    if (bytes.length > 5 * 1024 * 1024 || total > MAX_PACKAGE || !/^[a-f0-9]{64}$/.test(item.sha256) || sha256(bytes) !== item.sha256) throw new Error(`File checksum mismatch: ${item.path}`);
    entries.set(item.path, { bytes, sha256: item.sha256 });
  }
  for (const essential of ['index.html', 'style.css', 'script.js', 'version.json', 'lib/config.mjs', 'lib/project.mjs', 'scripts/setup.mjs', 'scripts/update.mjs', 'locales/en.json', 'locales/fr.json', 'assets/avatar.svg', 'assets/profile.svg', 'assets/network.svg', 'assets/audio.svg', 'assets/settings-3ds.png']) {
    if (!entries.has(essential)) throw new Error(`Essential update file missing: ${essential}`);
  }
  const version = JSON.parse(entries.get('version.json').bytes);
  if (version.version !== payload.version || version.schemaVersion !== payload.schemaVersion) throw new Error('Invalid version metadata.');
  return { payload, entries };
}
async function downloadAsset(url, fetchImpl) {
  const allowed = new Set(['github.com', 'release-assets.githubusercontent.com', 'objects.githubusercontent.com', 'github-releases.githubusercontent.com']);
  for (let redirects = 0; redirects <= 5; redirects++) {
    const target = new URL(url);
    if (target.protocol !== 'https:' || !allowed.has(target.hostname) || target.username || target.password) throw new Error('Unexpected download destination.');
    const response = await fetchImpl(url, { redirect: 'manual', signal: AbortSignal.timeout(30000) });
    if ([301, 302, 303, 307, 308].includes(response.status)) { url = new URL(response.headers.get('location'), url).href; continue; }
    if (!response.ok || Number(response.headers.get('content-length')) > MAX_PACKAGE) throw new Error(`Download failed: HTTP ${response.status}`);
    const parts = []; let size = 0;
    for await (const chunk of response.body) { size += chunk.length; if (size > MAX_PACKAGE) throw new Error('Download exceeds 20 MB.'); parts.push(Buffer.from(chunk)); }
    return Buffer.concat(parts);
  }
  throw new Error('Too many download redirects.');
}
async function baseline(root) {
  const file = path.join(root, 'template-manifest.json');
  if (await exists(file)) {
    await checkParents(root, 'template-manifest.json');
    const value = JSON.parse(await readFile(file, 'utf8'));
    if (!value.files || typeof value.files !== 'object') throw new Error('Invalid installed baseline.');
    for (const [name, hash] of Object.entries(value.files)) if (!managedPath(name) || !/^[a-f0-9]{64}$/.test(hash)) throw new Error('Invalid baseline entry.');
    return value;
  }
  const legacyPath = new URL('../lib/legacy-manifest.json', import.meta.url);
  const legacy = JSON.parse(await readFile(legacyPath, 'utf8'));
  for (const [name, hash] of Object.entries(legacy.files)) {
    const target = await checkParents(root, name);
    if (!await exists(target) || sha256(await readFile(target)) !== hash) throw new Error(`No trustworthy baseline, or modified legacy file: ${name}. Use a manual merge.`);
  }
  return legacy;
}
function personalPaths(config) {
  const defaults = new Set([...Object.values(DEFAULT_ICONS), 'assets/avatar.svg']);
  const result = new Set(mediaReferences(config).filter(file => !defaults.has(file)));
  for (const key of ['avatar', 'cover', 'music']) if (config[key] && config[key] !== 'assets/avatar.svg' && !/^[a-z]+:/i.test(config[key])) result.add(config[key].split(/[?#]/)[0]);
  for (const [key, value] of Object.entries(config.icons)) if (value && value !== DEFAULT_ICONS[key] && !/^[a-z]+:/i.test(value)) result.add(value.split(/[?#]/)[0]);
  for (const page of config.pages) if (page.icon && !/^[a-z]+:/i.test(page.icon)) result.add(page.icon.split(/[?#]/)[0]);
  for (const collection of [config.gallery, config.projects, ...config.pages.flatMap(page => [page.images || [], page.projects || []])]) for (const item of collection || []) for (const key of ['src', 'image']) if (item[key] && !/^[a-z]+:/i.test(item[key])) result.add(item[key].split(/[?#]/)[0]);
  return result;
}
async function ownedFiles(root, config) {
  const result = new Set(['config.js', ...personalPaths(config)]);
  async function walk(relative) {
    const target = await checkParents(root, relative); if (!await exists(target)) return;
    const info = await lstat(target); if (info.isFile()) result.add(relative);
    else if (info.isDirectory()) for (const child of await readdir(target)) await walk(`${relative}/${child}`);
  }
  await walk('user-content'); return result;
}
export async function rollbackUpdate(root) {
  const journalPath = await checkParents(root, journalName);
  if (!await exists(journalPath)) return false;
  const journal = JSON.parse(await readFile(journalPath, 'utf8'));
  if (!/^backups\/update-[a-zA-Z0-9.-]+$/.test(journal.backup) || !Array.isArray(journal.changes)) throw new Error('Invalid recovery journal.');
  for (const entry of [...journal.changes].reverse()) {
    if (!managedPath(entry.path) && !['config.js', 'template-manifest.json', 'user-content/profile.json'].includes(entry.path) && !/^user-content\/pages\/[a-z][a-z0-9-]{0,63}\.json$/.test(entry.path)) throw new Error('Invalid recovery target.');
    const target = await checkParents(root, entry.path);
    if (await exists(target)) {
      const hash = sha256(await readFile(target));
      if (entry.existed && hash === entry.sha256) continue;
      if (hash !== entry.newSha256) throw new Error(`Recovery conflict; keep backup ${journal.backup} and merge manually: ${entry.path}`);
    }
    if (entry.existed) {
      const backupPath = await checkParents(root, `${journal.backup}/${entry.path}`); const bytes = await readFile(backupPath);
      if (sha256(bytes) !== entry.sha256) throw new Error('Backup checksum mismatch; automatic restore stopped.');
      await atomicWrite(target, bytes, entry.mode || 0o600);
    } else if (await exists(target)) await unlink(target);
  }
  await unlink(journalPath); return true;
}
export async function installRelease({ root = ROOT, release, fetchImpl = globalThis.fetch, failAfter = Infinity } = {}) {
  return withLock(root, async () => {
    if (await exists(path.join(root, journalName))) throw new Error('Interrupted update found. Restore it before installing another update.');
    const current = await installedVersion(root);
    if (compareVersions(release.version, current) <= 0) throw new Error('Only newer stable releases can be installed.');
    const name = `3ds-update-v${release.version}.json`;
    const asset = release.assets.find(item => item.name === name);
    if (!asset || !/^sha256:[a-f0-9]{64}$/.test(asset.digest || '') || asset.size > MAX_PACKAGE) throw new Error('Verified update asset unavailable. Use the documented manual update procedure.');
    const url = `https://github.com/${OFFICIAL_REPOSITORY}/releases/download/v${release.version}/${name}`;
    const data = await downloadAsset(url, fetchImpl);
    if ('sha256:' + sha256(data) !== asset.digest) throw new Error('Release asset checksum mismatch.');
    const { payload, entries } = decodePackage(data, release.version);
    const old = await baseline(root); const config = await loadProfile(root); const personal = personalPaths(config);
    for (const [file, entry] of entries) {
      const target = await checkParents(root, file);
      if (await exists(target)) {
        if (!(await lstat(target)).isFile()) throw new Error(`Destination is not a regular file: ${file}`);
        const hash = sha256(await readFile(target));
        if (personal.has(file) && hash !== entry.sha256) throw new Error(`Personal media conflict: ${file}`);
        if (!old.files[file] || hash !== old.files[file]) throw new Error(`Local modification conflict: ${file}`);
      } else if (old.files[file]) throw new Error(`Locally removed managed file: ${file}`);
    }
    const backup = `backups/update-${release.version}-${Date.now()}-${randomUUID().slice(0, 8)}`;
    const owned = await ownedFiles(root, config);
    const writes = new Map([...entries].map(([file, entry]) => [file, entry.bytes]));
    const profilePath = path.join(root, 'user-content/profile.json');
    const needsMigration = !await exists(profilePath) || JSON.parse(await readFile(profilePath, 'utf8')).schemaVersion !== SCHEMA_VERSION;
    if (needsMigration) for (const [file, content] of profileWrites(config)) writes.set(file, Buffer.from(content));
    const newFiles = Object.fromEntries([...entries].map(([file, entry]) => [file, entry.sha256]));
    writes.set('template-manifest.json', Buffer.from(JSON.stringify({ version: payload.version, schemaVersion: payload.schemaVersion, files: newFiles }, null, 2)));
    const changing = new Set(writes.keys());
    const snapshots = new Map();
    for (const file of new Set([...changing, ...owned])) {
      const target = await checkParents(root, file); const existed = await exists(target);
      const record = { path: file, existed };
      if (existed) {
        const info = await lstat(target); if (!info.isFile()) throw new Error(`Not a regular file: ${file}`);
        const bytes = await readFile(target); record.sha256 = sha256(bytes); record.mode = info.mode & 0o777;
        const copy = await checkParents(root, `${backup}/${file}`); await mkdir(path.dirname(copy), { recursive: true }); await copyFile(target, copy); await writeFile(copy, bytes, { mode: 0o600 });
        if (sha256(await readFile(copy)) !== record.sha256) throw new Error('Backup verification failed.');
      }
      snapshots.set(file, record);
    }
    for (const [file, entry] of entries) if (snapshots.get(file).existed && snapshots.get(file).sha256 !== old.files[file]) throw new Error(`File changed during backup: ${file}`);
    await atomicWrite(path.join(root, journalName), JSON.stringify({ backup, changes: [...changing].map(file => ({ ...snapshots.get(file), newSha256: sha256(writes.get(file)) })) }, null, 2));
    try {
      let applied = 0;
      for (const [file, bytes] of writes) {
        if (['version.json', 'template-manifest.json'].includes(file)) continue;
        if (applied++ >= failAfter) throw new Error('Simulated interrupted installation.');
        const snapshot = snapshots.get(file); const target = localPath(root, file);
        if (snapshot.existed && sha256(await readFile(target)) !== snapshot.sha256 || !snapshot.existed && await exists(target)) throw new Error(`File changed during installation: ${file}`);
        await atomicWrite(target, bytes, file.startsWith('user-content/') || file === 'config.js' ? 0o600 : file.endsWith('.sh') ? 0o755 : 0o644);
      }
      for (const file of owned) {
        const snapshot = snapshots.get(file);
        if (!writes.has(file) && snapshot.existed && sha256(await readFile(localPath(root, file))) !== snapshot.sha256) throw new Error(`Personalization changed during update: ${file}`);
      }
      for (const [file, bytes] of writes) if (!['version.json', 'template-manifest.json'].includes(file) && sha256(await readFile(localPath(root, file))) !== sha256(bytes)) throw new Error(`Post-install verification failed: ${file}`);
      await loadProfile(root);
      await atomicWrite(path.join(root, 'template-manifest.json'), writes.get('template-manifest.json'), 0o644);
      await atomicWrite(path.join(root, 'version.json'), writes.get('version.json'), 0o644);
      await unlink(path.join(root, journalName));
      return { version: release.version, backup };
    } catch (error) { await rollbackUpdate(root); throw error; }
  });
}
export async function checkForUpdate({ root = ROOT, fetchImpl = globalThis.fetch, force = false } = {}) {
  const cacheFile = path.join(root, '.update-cache.json'); let cache;
  if (await exists(cacheFile)) { try { cache = JSON.parse(await readFile(cacheFile, 'utf8')); } catch {} }
  if (cache?.retryAt > Date.now()) throw new Error('GitHub rate limit: try again later.');
  if (!force && cache?.nextCheck > Date.now()) return cache.release;
  try {
    const release = await latestRelease(fetchImpl);
    await atomicWrite(cacheFile, JSON.stringify({ nextCheck: Date.now() + 86400000, release })); return release;
  } catch (error) { await atomicWrite(cacheFile, JSON.stringify({ retryAt: error.retryAt || Date.now() + 3600000 })); throw error; }
}
export async function runUpdater({ root = ROOT, language = 'en', ask, print = console.log } = {}) {
  const fr = language === 'fr';
  if (await exists(path.join(root, journalName))) {
    if (!/^(y|yes|o|oui)$/i.test(await ask(fr ? 'Installation interrompue. Restaurer la sauvegarde ? [o/n]' : 'Interrupted installation. Restore the backup? [y/n]'))) return;
    await withLock(root, () => rollbackUpdate(root)); print(fr ? 'Version précédente restaurée.' : 'Previous version restored.');
  }
  const release = await checkForUpdate({ root, force: true });
  if (!release) { print(fr ? 'Aucune version stable publiée.' : 'No stable release published.'); return; }
  const current = await installedVersion(root);
  if (compareVersions(release.version, current) <= 0) { print(fr ? 'La version installée est à jour.' : 'The installed version is up to date.'); return; }
  print(`${current} → ${release.version}\n${releaseUrl(release)}\n${release.body.replace(/[\x00-\x08\x0b-\x1f\x7f]/g, '')}`);
  const question = fr ? 'Sauvegarder puis installer cette mise à jour ? [o/n]' : 'Back up and install this update? [y/n]';
  if (!/^(y|yes|o|oui)$/i.test(await ask(question))) return;
  const result = await installRelease({ root, release });
  print((fr ? 'Mise à jour installée. Sauvegarde : ' : 'Update installed. Backup: ') + result.backup);
  print(fr ? 'GitHub Pages : redéploie dist. Docker : reconstruis l’image. Rien n’a été publié automatiquement.' : 'GitHub Pages: redeploy dist. Docker: rebuild the image. Nothing was published automatically.');
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const rl = createInterface({ input: process.stdin, terminal: false }); const lines = rl[Symbol.asyncIterator]();
  const ask = async question => { console.log(question); const line = await lines.next(); if (line.done) return 'n'; return line.value.trim(); };
  runUpdater({ ask, language: process.argv.includes('--fr') ? 'fr' : 'en' }).catch(error => { console.error(error.message); process.exitCode = 1; }).finally(() => rl.close());
}
