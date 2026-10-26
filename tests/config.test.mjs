import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { Readable, Writable } from 'node:stream';
import { spawnSync } from 'node:child_process';
import { normalizeConfig, parseLegacyConfig, validateConfig, localizedContent } from '../lib/config.mjs';
import { loadProfile, saveProfile, importMedia, buildSite, previewSite, sha256, ROOT } from '../lib/project.mjs';
import { chooseLanguage, loadDictionary } from '../lib/translations.mjs';
import { runSetup } from '../scripts/setup.mjs';
import { createZip } from '../scripts/release.mjs';
import { fixture } from './helpers.mjs';

test('legacy literal migration preserves data without evaluating code', () => {
  const data = parseLegacyConfig("// old file\nwindow.PROFILE_CONFIG={name:'A name',pronouns:'iel',bio:'line\\nsecond',links:[], icons:{profile:'assets/custom.png'},};");
  const config = normalizeConfig(data); assert.equal(config.name, 'A name'); assert.equal(config.pronouns, 'iel'); assert.equal(config.bio, 'line\nsecond'); assert.equal(config.schemaVersion, 2);
  for (const text of ["window.PROFILE_CONFIG={name:process.exit()}", "window.PROFILE_CONFIG={};globalThis.bad=true", "window.PROFILE_CONFIG={__proto__:{bad:true}}", "window.PROFILE_CONFIG={name:`expression`}"]) assert.throws(() => parseLegacyConfig(text));
  assert.throws(() => normalizeConfig({ schemaVersion: 3 }));
});
test('URL, page and visibility validation', () => {
  assert.ok(validateConfig({ links: [{ url: 'javascript:alert(1)' }] }).length);
  assert.ok(validateConfig({ pages: [{ id: 'bad/id', type: 'custom' }] }).length);
  assert.ok(validateConfig({ sections: { profil: false }, homePage: 'profil' }).length);
  assert.ok(validateConfig({ pages: [{ id: 'sona', type: 'sona', images: {} }] }).length);
  assert.equal(validateConfig({ pronouns: '<b>they/them</b>', bio: '<script>never html</script>' }).length, 0);
});
test('browser language selection, missing dictionary and manual content fallback', async () => {
  assert.equal(chooseLanguage('auto', ['de-DE']), 'en'); assert.equal(chooseLanguage('auto', ['fr-CA']), 'fr'); assert.equal(chooseLanguage('fr', ['fr'], 'en'), 'en');
  const result = await loadDictionary('fr', async url => String(url).endsWith('/fr.json') ? new Response('', { status: 503 }) : new Response(JSON.stringify({ ui: { profile: 'Profile' } })));
  assert.equal(result.language, 'en'); assert.equal(result.fallback, true);
  const config = normalizeConfig({ about: 'Original', translations: { enabled: true, values: { fr: { about: 'Traduit' } } } });
  assert.equal(localizedContent(config, 'about', 'fr', config.about), 'Traduit'); assert.equal(localizedContent(config, 'about', 'en', config.about), 'Original');
  config.translations.enabled = false; assert.equal(localizedContent(config, 'about', 'fr', config.about), 'Original');
});
test('file imports with spaces preserve originals, reject wrong format and oversize files', async t => {
  const root = await fixture(t); const directory = path.join(root, 'source with spaces'); await mkdir(directory);
  const source = path.join(directory, 'a picture.png'); const original = await readFile(path.join(root, 'assets/settings-3ds.png')); await writeFile(source, original);
  const imported = await importMedia(root, `"${source}"`, 'image'); assert.equal(sha256(await readFile(path.join(root, imported))), sha256(original)); assert.equal(sha256(await readFile(source)), sha256(original));
  const bad = path.join(directory, 'wrong.png'); await writeFile(bad, 'not an image'); await assert.rejects(importMedia(root, bad, 'image'));
  const huge = path.join(directory, 'huge.mp3'); await writeFile(huge, Buffer.alloc(31 * 1024 * 1024)); await assert.rejects(importMedia(root, huge, 'music'));
  const audio = path.join(directory, 'sound with spaces.wav'); const wav = Buffer.alloc(48); wav.write('RIFF'); wav.writeUInt32LE(40, 4); wav.write('WAVEfmt ', 8); wav.writeUInt32LE(16, 16); wav.writeUInt16LE(1, 20); wav.writeUInt16LE(1, 22); wav.writeUInt32LE(8000, 24); wav.writeUInt32LE(16000, 28); wav.writeUInt16LE(2, 32); wav.writeUInt16LE(16, 34); wav.write('data', 36); wav.writeUInt32LE(4, 40); await writeFile(audio, wav);
  const music = await importMedia(root, audio, 'music'); assert.equal(sha256(await readFile(path.join(root, music))), sha256(wav));
});
test('separate pages, backups, reload and clean static export', async t => {
  const root = await fixture(t); const config = await loadProfile(root);
  config.name = 'Example name'; config.pronouns = 'they/them'; config.bio = 'Personal text'; config.pages = [{ id: 'sona', type: 'sona', title: 'Character', content: 'Plain text', images: [], visible: true }];
  config.credits = [{ name: 'Artist', role: 'Illustration', url: 'https://example.org/' }];
  const first = await saveProfile(root, config); assert.ok(first.backup);
  assert.ok((await stat(path.join(root, 'user-content/pages/sona.json'))).isFile());
  const loaded = await loadProfile(root); assert.equal(loaded.pronouns, 'they/them'); assert.equal(loaded.pages[0].content, 'Plain text');
  await writeFile(path.join(root, '.env'), 'SECRET=do-not-export'); const dist = await buildSite(root);
  await assert.rejects(readFile(path.join(dist, '.env'))); assert.match(await readFile(path.join(dist, 'config.js'), 'utf8'), /Example name/);
  await writeFile(path.join(dist, 'old-generated-file.txt'), 'old'); await buildSite(root); await assert.rejects(readFile(path.join(dist, 'old-generated-file.txt')));
});
test('preview prints a real dynamic address and blocks private/traversal paths', async t => {
  const root = await fixture(t); const { server, url } = await previewSite(root); t.after(() => new Promise(resolve => server.close(resolve)));
  assert.equal((await fetch(url)).status, 200); assert.equal((await fetch(url + 'lib/config.mjs')).headers.get('content-type'), 'text/javascript');
  assert.equal((await fetch(url + '.env')).status, 404); assert.equal((await fetch(url + 'user-content/profile.json')).status, 404);
  assert.equal((await fetch(url + '%2e%2e%2fconfig.js')).status, 404);
});
test('guided setup creates and edits a profile without replacing unrelated settings', async t => {
  const root = await fixture(t); const original = await loadProfile(root); original.pronouns = 'iel'; original.credits = [{ name: 'Artist', role: 'Cover' }]; await saveProfile(root, original);
  const lines = ['2', '1', 'Changed name', '', '', 'Short bio', '', '', '', 'n', 'n', 'n', '0', '0', 'n', 'n', '0'];
  let text = ''; const output = new Writable({ write(chunk, _, done) { text += chunk; done(); } });
  await runSetup({ root, input: Readable.from([lines.join('\n') + '\n']), output });
  const config = await loadProfile(root); assert.equal(config.name, 'Changed name'); assert.equal(config.pronouns, 'iel'); assert.equal(config.credits[0].name, 'Artist'); assert.match(text, /Configuration enregistrée/);
});
test('launchers run from a directory with spaces and check missing Node', async t => {
  const root = await fixture(t); const directory = path.join(root, 'site with spaces'); await mkdir(directory);
  const launcher = process.platform === 'win32' ? path.join(root, 'setup.bat') : path.join(root, 'setup.sh');
  const command = process.platform === 'win32' ? process.env.ComSpec : 'sh';
  const args = process.platform === 'win32' ? ['/d', '/s', '/c', `""${launcher}""`] : [launcher];
  const result = spawnSync(command, args, { cwd: directory, input: '1\n0\n', encoding: 'utf8', timeout: 15000, windowsVerbatimArguments: process.platform === 'win32' }); assert.equal(result.status, 0, result.stdout + result.stderr); assert.match(result.stdout, /3DS PERSONAL WEBSITE SETUP/);
  const env = { ...process.env, PATH: process.platform === 'win32' ? path.join(process.env.SystemRoot, 'System32') : '/nonexistent' };
  const missing = spawnSync(process.platform === 'win32' ? process.env.ComSpec : '/bin/sh', args, { cwd: directory, input: '\n', env, encoding: 'utf8', timeout: 10000, windowsVerbatimArguments: process.platform === 'win32' });
  assert.notEqual(missing.status, 0); assert.match(missing.stdout + missing.stderr, /Node.js 22/);
});

test('setup imports quoted local menu and social icons and exports both copies', async t => {
  const root = await fixture(t); const source = path.join(root, 'icon with spaces.png');
  const original = await readFile(path.join(root, 'assets/settings-3ds.png')); await writeFile(source, original);
  async function setup(lines) { let text = ''; await runSetup({ root, input: Readable.from([lines.join('\n') + '\n']), output: new Writable({ write(chunk, _, done) { text += chunk; done(); } }) }); return text; }
  await setup(['1', '3', '1', 'custom', 'Source code', 'https://github.com/trim360/3ds-profile-template', '', `"${source}"`, '0', '0']);
  await setup(['1', 'a', 'y', '', 'n', '', 'y', '', 'audio,profil', 'profil', '', `"${source}"`, '', '', 'n', '0']);
  const config = await loadProfile(root);
  assert.match(config.links[0].icon, /^user-content\/media\//); assert.match(config.icons.profile, /^user-content\/media\//);
  assert.equal(config.icons.settings, 'assets/settings-3ds.png'); assert.equal(config.sections.reseaux, false); assert.equal(config.homePage, 'profil'); assert.equal(config.menuOrder[0], 'audio'); assert.equal(config.updates.enabled, false);
  const dist = await buildSite(root);
  for (const file of [config.links[0].icon, config.icons.profile]) assert.equal(sha256(await readFile(path.join(dist, file))), sha256(original));
  assert.equal(sha256(await readFile(source)), sha256(original));
  const text = await setup(['1', '3', '1', 'custom', 'Invalid', 'https://github.com/trim360', '', 'missing-icon.png', '0']);
  assert.match(text, /Icon file not found/); assert.equal((await loadProfile(root)).links.length, 1);
});
test('release ZIP stores Unix executable mode for setup.sh', () => {
  const zip = createZip(new Map([['site/setup.sh', Buffer.from('#!/bin/sh\n')]])); const index = zip.indexOf(Buffer.from([0x50,0x4b,0x01,0x02]));
  assert.ok(index > 0); assert.equal(zip.readUInt32LE(index + 38) >>> 16 & 0o777, 0o755);
});
test('English/French dictionaries contain the same UI and setup keys', async () => {
  const en = JSON.parse(await readFile(path.join(ROOT, 'locales/en.json'), 'utf8')); const fr = JSON.parse(await readFile(path.join(ROOT, 'locales/fr.json'), 'utf8'));
  for (const section of ['ui', 'setup']) assert.deepEqual(Object.keys(en[section]).sort(), Object.keys(fr[section]).sort());
});
test('music setup asks for ownership, creates declared credits and supports unknown rights without music', async t => {
  const root = await fixture(t); const audio = path.join(root, 'test music.wav');
  await writeFile(audio, Buffer.from('524946462800000057415645666d74201000000001000100401f0000803e000002001000646174610400000000000000', 'hex'));
  async function setup(lines) { let output = ''; await runSetup({ root, input: Readable.from([lines.join('\n') + '\n']), output: new Writable({ write(chunk, _, done) { output += chunk; done(); } }) }); return output; }
  const text = await setup(['1', '5', 'y', '1', 'Example Nintendo declaration', 'y', audio, '0']);
  assert.match(text, /Is this music owned by Nintendo/); assert.match(text, /attribution, not permission/);
  let config = await loadProfile(root); assert.equal(config.musicCredit.owner, 'nintendo'); assert.equal(config.musicCredit.rightsConfirmed, true); assert.equal(config.musicTitle, 'Example Nintendo declaration');
  await setup(['1', '5', 'y', '2', 'Other track', 'Example artist', 'https://example.org/license', 'y', audio, '0']);
  config = await loadProfile(root); assert.equal(config.musicCredit.owner, 'other'); assert.equal(config.musicCredit.artist, 'Example artist');
  await setup(['1', '5', 'y', '3', 'y', '0']); config = await loadProfile(root); assert.equal(config.music, '');
});
