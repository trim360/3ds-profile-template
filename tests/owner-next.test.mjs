import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, stat, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fixture } from './helpers.mjs';
import { loadProfile } from '../lib/project.mjs';
import { configureOwner } from '../lib/owner-auth.mjs';
import { startOwnerServer } from '../lib/owner-server.mjs';
import { DEFAULT_CONFIG } from '../lib/config.mjs';

const username = 'owner-test', password = 'Local-test-only-2026-password';
const png = Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), Buffer.alloc(32, 1)]);
async function application(t) {
  const root = await fixture(t); await configureOwner(root, username, password);
  const instance = await startOwnerServer({ root, port: 0 }); t.after(() => instance.close());
  let cookie = '', csrf = '';
  const request = (route, { json, method = 'GET', body, token = csrf, session = cookie, headers = {} } = {}) => fetch(instance.url + route, {
    method, headers: { Origin: instance.url, ...(session ? { Cookie: session } : {}), ...(token ? { 'X-CSRF-Token': token } : {}), ...(json !== undefined ? { 'Content-Type': 'application/json' } : {}), ...headers },
    body: json !== undefined ? JSON.stringify(json) : body,
  });
  async function login() { const response = await request('/owner-api/login', { method: 'POST', json: { username, password } }); assert.equal(response.status, 200); cookie = response.headers.get('set-cookie').split(';')[0]; csrf = (await response.json()).csrf; }
  async function current() { return (await request('/owner-api/profile')).json(); }
  async function publish(changes) {
    const { profile, revision } = await current();
    const response = await request('/owner-api/profile', { method: 'PUT', json: { profile: Object.fromEntries(Object.keys(DEFAULT_CONFIG).map(key => [key, key in changes ? changes[key] : profile[key]])), revision } });
    assert.equal(response.status, 200, await response.clone().text()); return response.json();
  }
  return { root, ...instance, request, login, current, publish };
}
const page = (id, title) => ({ id, title, type: 'custom', content: `Contenu ${title}`, visible: true });

test('draft preview needs an owner session, shows the unsaved draft and never publishes it', async t => {
  const app = await application(t);
  for (const route of ['/owner-api/preview/index.html', '/owner-api/preview/config.js']) assert.equal((await app.request(route)).status, 401, route);
  assert.equal((await app.request('/owner-api/preview', { method: 'POST', json: { profile: { name: 'x' } } })).status, 401);
  await app.login();
  const before = await readFile(path.join(app.root, 'dist/config.js'), 'utf8'), stored = await readFile(path.join(app.root, 'user-content/profile.json'), 'utf8').catch(() => '');
  assert.equal((await app.request('/owner-api/preview', { method: 'POST', json: { profile: { name: 'Brouillon visible' } } })).status, 200);
  const config = await (await app.request('/owner-api/preview/config.js')).text();
  assert.match(config, /^window\.PROFILE_CONFIG = /); assert.match(config, /Brouillon visible/);
  assert.equal(await readFile(path.join(app.root, 'dist/config.js'), 'utf8'), before);
  assert.equal(await readFile(path.join(app.root, 'user-content/profile.json'), 'utf8').catch(() => ''), stored);
  assert.equal((await app.current()).profile.name, (await loadProfile(app.root)).name);
  const html = await app.request('/owner-api/preview/index.html');
  assert.equal(html.status, 200); assert.match(await html.text(), /\.privacy-banner\{display:none!important\}/); assert.equal(html.headers.get('x-frame-options'), 'SAMEORIGIN'); assert.match(html.headers.get('content-security-policy'), /frame-ancestors 'self'/);
  assert.equal((await app.request('/owner-api/preview/style.css')).status, 200);
  assert.equal((await app.request('/owner-api/profile')).headers.get('x-frame-options'), 'DENY');
});

test('draft preview rejects unsafe drafts, private paths and traversal', async t => {
  const app = await application(t); await app.login();
  for (const draft of [{ unknownField: 1 }, { avatar: 'javascript:alert(1)' }, { pages: [{ id: 'accueil', title: 'x', type: 'custom' }] }, { avatar: '.owner/account.json' }]) assert.equal((await app.request('/owner-api/preview', { method: 'POST', json: { profile: draft } })).status, 400, JSON.stringify(draft));
  for (const route of ['/owner-api/preview/.owner/account.json', '/owner-api/preview/%2e%2e/.owner/account.json', '/owner-api/preview/backups/x', '/owner-api/preview/user-content/pages/a.json', '/owner-api/preview/user-content/profile.json', '/owner-api/preview/..%2f..%2fpackage.json']) assert.ok([400, 404].includes((await app.request(route)).status), route);
  assert.equal((await app.request('/owner-api/preview', { method: 'POST', headers: { Origin: 'https://attacker.invalid' }, json: { profile: {} } })).status, 403);
  assert.equal((await app.request('/owner-api/preview', { method: 'POST', token: '', json: { profile: {} } })).status, 403);
});

test('media imported in this session is previewable before publishing, and only through the preview', async t => {
  const app = await application(t); await app.login();
  const upload = await app.request('/owner-api/media?kind=image&name=draft.png', { method: 'POST', headers: { 'Content-Type': 'application/octet-stream' }, body: png });
  assert.equal(upload.status, 201); const { path: relative } = await upload.json();
  await assert.rejects(stat(path.join(app.root, 'dist', relative)));
  assert.equal((await app.request('/owner-api/preview', { method: 'POST', json: { profile: { avatar: relative } } })).status, 200);
  const shown = await app.request('/owner-api/preview/' + relative); assert.equal(shown.status, 200); assert.deepEqual(Buffer.from(await shown.arrayBuffer()), png);
  assert.equal((await fetch(app.url + '/owner-api/preview/' + relative)).status, 401);
  assert.equal((await fetch(app.url + '/' + relative)).status, 404);
});

test('backups list and restore through the normal publish path, keeping a backup of the replaced state', async t => {
  const app = await application(t); await app.login();
  await app.publish({ name: 'Version A' }); await app.publish({ name: 'Version B' });
  const listed = await (await app.request('/owner-api/backups')).json();
  assert.ok(listed.backups.length >= 1); assert.ok(listed.backups.every(item => /^profile-\d+-[a-f0-9]{8}$/.test(item.id)));
  const target = listed.backups.find(item => item.name === 'Version A'); assert.ok(target, 'Version A backup exists');
  const { revision } = await app.current(); const count = (await readdir(path.join(app.root, 'backups'))).filter(name => name.startsWith('profile-')).length;
  const restored = await app.request('/owner-api/backups/restore', { method: 'POST', json: { id: target.id, revision } });
  assert.equal(restored.status, 200); assert.equal((await restored.json()).profile.name, 'Version A');
  assert.equal((await loadProfile(app.root)).name, 'Version A');
  assert.ok((await readdir(path.join(app.root, 'backups'))).filter(name => name.startsWith('profile-')).length > count, 'restoring backs up Version B first');
  assert.equal((await app.request('/owner-api/backups/restore', { method: 'POST', json: { id: '../../.owner', revision } })).status, 400);
  assert.equal((await app.request('/owner-api/backups/restore', { method: 'POST', json: { id: 'profile-1234567890-aaaaaaaa', revision: (await app.current()).revision } })).status, 404);
  assert.equal((await app.request('/owner-api/backups/restore', { method: 'POST', json: { id: target.id, revision: 'stale' } })).status, 409);
  assert.equal((await app.request('/owner-api/backups', { session: '' })).status, 401);
});

test('pages deleted from the dashboard can be listed for restoration; live pages are not listed', async t => {
  const app = await application(t); await app.login();
  await app.publish({ pages: [page('alpha', 'Alpha'), page('beta', 'Beta')] });
  assert.deepEqual((await (await app.request('/owner-api/pages/deleted')).json()).pages, []);
  await app.publish({ pages: [page('beta', 'Beta')] });
  const { pages } = await (await app.request('/owner-api/pages/deleted')).json();
  assert.deepEqual(pages.map(item => item.page.id), ['alpha']); assert.equal(pages[0].page.content, 'Contenu Alpha');
  await app.publish({ pages: [page('beta', 'Beta'), pages[0].page] });
  assert.deepEqual((await (await app.request('/owner-api/pages/deleted')).json()).pages, []);
  assert.equal((await app.request('/owner-api/pages/deleted', { session: '' })).status, 401);
});
