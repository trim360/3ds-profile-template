import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, stat, readdir } from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
import { ROOT, build, demoSound } from '../build.mjs';
import { site, links, screenshots, chooseLanguage } from '../config.mjs';
import { parseLegacyConfig } from '../../lib/config.mjs';

const projectRoot = path.dirname(ROOT);
const protectedFiles = [...Object.keys(JSON.parse(await readFile(path.join(projectRoot, 'template-manifest.json'))).files), 'config.js'];
const before = new Map(await Promise.all(protectedFiles.map(async file => [file, createHash('sha256').update(await readFile(path.join(projectRoot, file))).digest('hex')])));

test('language dictionaries cover the UI and preserve the same keys', async () => {
  const en = JSON.parse(await readFile(path.join(ROOT, 'locales/en.json'))), fr = JSON.parse(await readFile(path.join(ROOT, 'locales/fr.json')));
  assert.deepEqual(Object.keys(en).sort(), Object.keys(fr).sort());
  const html = await readFile(path.join(ROOT, 'index.html'), 'utf8');
  for (const match of html.matchAll(/data-(?:i18n|alt)="([^"]+)"/g)) assert.equal(typeof en[match[1]], 'string', match[1]);
  for (const dictionary of [en, fr]) for (const text of Object.values(dictionary)) assert.equal(typeof text, 'string');
  assert.equal(chooseLanguage(['de-DE']), 'en'); assert.equal(chooseLanguage(['fr-CA']), 'fr'); assert.equal(chooseLanguage(['de-DE','fr']), 'fr'); assert.equal(chooseLanguage(['fr'], 'en'), 'en');
});

test('real screenshots match their manifest and stay within the image budget', async () => {
  const manifest = JSON.parse(await readFile(path.join(ROOT, 'assets/screenshots/manifest.json'))); let total = 0;
  for (const shot of screenshots) {
    const bytes = await readFile(path.join(ROOT, shot.src)); total += bytes.length;
    assert.equal(bytes.toString('ascii', 0, 4), 'RIFF'); assert.equal(bytes.toString('ascii', 8, 12), 'WEBP');
    assert.equal(createHash('sha256').update(bytes).digest('hex'), manifest[shot.id].sha256);
    assert.ok(manifest[shot.id].width >= 1000 && manifest[shot.id].height >= 600);
  }
  assert.ok(total < 300000, `Screenshots: ${total} bytes`);
});

test('build works in a subdirectory, generates honest metadata, and keeps private data out', async () => {
  const dist = await build({ canonicalUrl: 'https://example.test/project/' });
  let html = await readFile(path.join(dist, 'index.html'), 'utf8');
  assert.match(html, /rel="canonical" href="https:\/\/example.test\/project\/"/);
  assert.match(html, /content="https:\/\/example.test\/project\/assets\/screenshots\/home.webp"/);
  assert.match(await readFile(path.join(dist, 'sitemap.xml'), 'utf8'), /https:\/\/example.test\/project\//);
  assert.doesNotMatch(html, /\{\{[\w.]+\}\}/);
  for (const match of html.matchAll(/(?:href|src)="([^"]+)"/g)) {
    const target = match[1];
    if (target.startsWith('#')) assert.ok(html.includes(`id="${target.slice(1)}"`), target);
    else if (!/^https?:/.test(target)) assert.ok((await stat(path.join(dist, target.endsWith('/') ? target + 'index.html' : target))).isFile(), target);
  }
  const profile = parseLegacyConfig(await readFile(path.join(dist, 'demo/config.js'), 'utf8'));
  assert.equal(profile.name, 'Demo profile'); assert.equal(profile.updates.enabled, false);
  assert.equal(profile.musicCredit.owner, 'other'); assert.equal(profile.links.length, 1); assert.equal(profile.links[0].url, site.repository);
  assert.equal(profile.music, 'user-content/media/demo-loop.wav');
  const script = await readFile(path.join(dist, 'demo/script.js'), 'utf8');
  assert.doesNotMatch(script, /trimAudioPreferences/); assert.match(script, /showcaseDemoAudioPreferences/);
  await assert.rejects(stat(path.join(dist, 'demo/user-content/profile.json')));
  const audio = await readFile(path.join(dist, 'demo', profile.music)); assert.deepEqual(audio, demoSound());
  await build(); html = await readFile(path.join(dist, 'index.html'), 'utf8');
  assert.doesNotMatch(html, /rel="canonical"/); await assert.rejects(stat(path.join(dist, 'sitemap.xml')));
});

test('export is small, static and has no personal or credential files', async () => {
  const dist = path.join(ROOT, 'dist'); let websiteBytes = 0;
  async function walk(folder) {
    for (const file of await readdir(folder, { withFileTypes: true })) {
      const full = path.join(folder, file.name), relative = path.relative(dist, full);
      assert.ok(!/^\.env/.test(file.name) && !['profile.json','migration-profile.json'].includes(file.name), relative);
      if (file.isDirectory()) await walk(full);
      else if (!relative.startsWith('demo' + path.sep)) websiteBytes += (await stat(full)).size;
      if (/\.(mp3|ogg|m4a)$/i.test(file.name)) assert.fail('Unexpected audio: ' + relative);
    }
  }
  await walk(dist); assert.ok(websiteBytes < 450000, `Showcase payload: ${websiteBytes} bytes`);
  assert.equal(JSON.parse(await readFile(path.join(ROOT, '..', 'version.json'))).version, site.version);
  assert.equal(links.demo, './demo/');
});

test('preview serves the demo, dictionaries and modules on a real free port', async t => {
  const child = spawn(process.execPath, [path.join(ROOT, 'serve.mjs')], { stdio: ['ignore','pipe','pipe'] });
  t.after(() => child.kill());
  let output = ''; const address = await new Promise((resolve, reject) => {
    child.once('error', reject); child.once('exit', code => reject(new Error(`Preview exited ${code}`)));
    child.stdout.on('data', chunk => { output += chunk; const match = output.match(/http:\/\/127\.0\.0\.1:\d+\//); if (match) resolve(match[0]); });
  });
  assert.equal((await fetch(address)).status, 200); assert.equal((await fetch(address + 'demo/')).status, 200);
  assert.equal((await fetch(address + 'app.mjs')).headers.get('content-type'), 'text/javascript');
  assert.equal((await fetch(address + 'locales/fr.json')).status, 200);
  assert.equal((await fetch(address + '.env')).status, 404);
  assert.equal((await fetch(address + '%2e%2e%2fconfig.mjs')).status, 404);
  assert.equal((await fetch(address, { method:'POST' })).status, 405);
  const head = await fetch(address, { method:'HEAD' }); assert.equal(head.status, 200); assert.equal(await head.text(), '');
});

test('the personal template source remains unchanged', async () => {
  for (const [file, hash] of before) assert.equal(createHash('sha256').update(await readFile(path.join(projectRoot, file))).digest('hex'), hash, file);
});
