import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir, rename, symlink, unlink } from 'node:fs/promises';
import path from 'node:path';
import { loadProfile, saveProfile, sha256, exists, withLock } from '../lib/project.mjs';
import { decodePackage, installRelease, installedVersion, checkForUpdate, rollbackUpdate } from '../scripts/update.mjs';
import { latestRelease } from '../lib/releases.mjs';
import { fixture, updateFixture, packageFixture } from './helpers.mjs';

test('release checks use stable tags, cache results, and handle 404/rate limits', async t => {
  const root = await fixture(t); let count = 0;
  const fetchImpl = async () => { count++; return new Response('', { status: 404 }); };
  assert.equal(await checkForUpdate({ root, fetchImpl }), null); assert.equal(await checkForUpdate({ root, fetchImpl }), null); assert.equal(count, 1);
  assert.equal(await latestRelease(async () => new Response(JSON.stringify({ tag_name: 'v1.3.0-beta', prerelease: true }))), null);
  assert.equal((await latestRelease(async () => new Response(JSON.stringify({ tag_name: 'v1.3.0', assets: [] })))).version, '1.3.0');
  await assert.rejects(checkForUpdate({ root, force: true, fetchImpl: async () => new Response('', { status: 429, headers: { 'retry-after': '60' } }) }), /GitHub HTTP 429/);
  await assert.rejects(checkForUpdate({ root, force: true, fetchImpl }), /rate limit/);
});
test('successful update preserves personal data byte-for-byte and makes a verified backup', async t => {
  const root = await fixture(t); const config = await loadProfile(root);
  config.name = 'Example'; config.pronouns = 'he/they'; config.about = 'Personal description'; config.pages = [{ id: 'sona', type: 'sona', title: 'My sona', content: 'Do not replace', images: [], visible: true }];
  await saveProfile(root, config); await writeFile(path.join(root, '.env'), 'SECRET=keep');
  const oldUser = await readFile(path.join(root, 'user-content/profile.json')); const oldRuntime = await readFile(path.join(root, 'config.js'));
  const update = await updateFixture(root); const result = await installRelease({ root, ...update });
  assert.equal(await installedVersion(root), '1.3.0'); assert.deepEqual(await readFile(path.join(root, 'user-content/profile.json')), oldUser); assert.deepEqual(await readFile(path.join(root, 'config.js')), oldRuntime);
  assert.equal((await loadProfile(root)).pages[0].content, 'Do not replace'); assert.equal(await readFile(path.join(root, '.env'), 'utf8'), 'SECRET=keep');
  assert.ok(await exists(path.join(root, result.backup, 'user-content/pages/sona.json'))); assert.equal(await exists(path.join(root, '.update-journal.json')), false);
});
test('legacy profile migration keeps names/pronouns/content and produces separate user data', async t => {
  const root = await fixture(t); await writeFile(path.join(root, 'config.js'), "window.PROFILE_CONFIG = {name:'Legacy',pronouns:'iel',bio:'Keep biography',links:[]};");
  await installRelease({ root, ...await updateFixture(root) });
  const config = await loadProfile(root); assert.equal(config.name, 'Legacy'); assert.equal(config.pronouns, 'iel'); assert.equal(config.bio, 'Keep biography'); assert.ok(await exists(path.join(root, 'user-content/profile.json')));
});
test('a modified core or a personalized core asset stops before overwriting', async t => {
  const root = await fixture(t); const update = await updateFixture(root);
  await writeFile(path.join(root, 'index.html'), 'custom code');
  await assert.rejects(installRelease({ root, ...update }), /modification conflict/); assert.equal(await readFile(path.join(root, 'index.html'), 'utf8'), 'custom code'); assert.equal(await installedVersion(root), '1.2.0');
  const other = await fixture(t); const config = await loadProfile(other); config.avatar = 'assets/profile.svg'; await saveProfile(other, config);
  const next = await updateFixture(other); const item = next.payload.files.find(file => file.path === 'assets/profile.svg'); const bytes = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>'); item.dataBase64 = bytes.toString('base64'); item.sha256 = sha256(bytes);
  await assert.rejects(installRelease({ root: other, ...packageFixture(next.payload) }), /Personal media conflict/);
  const nested = await fixture(t); const pages = await loadProfile(nested);
  pages.pages = [{ id: 'projects', type: 'projects', title: 'Projects', projects: [{ title: 'Personal project', image: 'assets/profile.svg' }] }];
  await saveProfile(nested, pages);
  await assert.rejects(installRelease({ root: nested, ...packageFixture(next.payload) }), /Personal media conflict/);
});
test('asset digest, file checksum, schema and unsafe paths are rejected', async t => {
  const root = await fixture(t); const update = await updateFixture(root);
  await assert.rejects(installRelease({ root, ...update, fetchImpl: async () => new Response('corrupt') }), /asset checksum/);
  const broken = structuredClone(update.payload); broken.files[0].sha256 = '0'.repeat(64); assert.throws(() => decodePackage(packageFixture(broken).bytes, '1.3.0'), /checksum/);
  const schema = structuredClone(update.payload); schema.schemaVersion = 3; assert.throws(() => decodePackage(packageFixture(schema).bytes, '1.3.0'), /Incompatible/);
  for (const name of ['../outside', '/absolute', 'C:/outside', 'assets\\bad.svg', 'assets/CON.svg', 'assets/bad.', 'assets//bad.svg', 'config.js', '.env', 'user-content/private.json']) {
    const payload = structuredClone(update.payload); payload.files.push({ ...payload.files[0], path: name }); assert.throws(() => decodePackage(packageFixture(payload).bytes, '1.3.0'), name);
  }
  const duplicate = structuredClone(update.payload); duplicate.files.push({ ...duplicate.files[0], path: duplicate.files[0].path.toUpperCase() }); assert.throws(() => decodePackage(packageFixture(duplicate).bytes, '1.3.0'));
});
test('failed installation restores the previous version and removes only newly created files', async t => {
  const root = await fixture(t); const before = await readFile(path.join(root, 'index.html')); const update = await updateFixture(root);
  const bytes = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>'); update.payload.files.splice(1, 0, { path: 'assets/new-icon.svg', dataBase64: bytes.toString('base64'), sha256: sha256(bytes) });
  await assert.rejects(installRelease({ root, ...packageFixture(update.payload), failAfter: 2 }), /Simulated/);
  assert.deepEqual(await readFile(path.join(root, 'index.html')), before); assert.equal(await installedVersion(root), '1.2.0'); assert.equal(await exists(path.join(root, 'assets/new-icon.svg')), false); assert.equal(await exists(path.join(root, '.update-journal.json')), false);
});
test('interrupted journal recovery and stale lock recovery', async t => {
  const root = await fixture(t); const old = await readFile(path.join(root, 'index.html')); const next = Buffer.from('interrupted bytes');
  const backup = 'backups/update-test'; await mkdir(path.join(root, backup), { recursive: true }); await writeFile(path.join(root, backup, 'index.html'), old); await writeFile(path.join(root, 'index.html'), next);
  await writeFile(path.join(root, '.update-journal.json'), JSON.stringify({ backup, changes: [{ path: 'index.html', existed: true, sha256: sha256(old), newSha256: sha256(next), mode: 0o644 }] }));
  await writeFile(path.join(root, '.setup.lock'), '2147483647'); await withLock(root, () => rollbackUpdate(root)); assert.deepEqual(await readFile(path.join(root, 'index.html')), old);
});
test('recovery stops rather than overwriting a new manual edit', async t => {
  const root = await fixture(t); const old = await readFile(path.join(root, 'index.html')); const backup = 'backups/update-test';
  await mkdir(path.join(root, backup), { recursive: true }); await writeFile(path.join(root, backup, 'index.html'), old); await writeFile(path.join(root, 'index.html'), 'new manual work');
  await writeFile(path.join(root, '.update-journal.json'), JSON.stringify({ backup, changes: [{ path: 'index.html', existed: true, sha256: sha256(old), newSha256: sha256(Buffer.from('updater bytes')) }] }));
  await assert.rejects(rollbackUpdate(root), /Recovery conflict/); assert.equal(await readFile(path.join(root, 'index.html'), 'utf8'), 'new manual work'); assert.equal(await exists(path.join(root, '.update-journal.json')), true);
});
test('symlinked target parents are rejected', async t => {
  const root = await fixture(t); const update = await updateFixture(root); await rename(path.join(root, 'assets'), path.join(root, 'original-assets')); await mkdir(path.join(root, 'outside'));
  try { await symlink(path.join(root, 'outside'), path.join(root, 'assets'), process.platform === 'win32' ? 'junction' : 'dir'); }
  catch (error) { if (['EPERM', 'EACCES'].includes(error.code)) return t.skip('Symbolic links unavailable for this account.'); throw error; }
  await assert.rejects(installRelease({ root, ...update }), /Symbolic link/); await unlink(path.join(root, 'assets'));
});
