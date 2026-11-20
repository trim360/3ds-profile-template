// Browser test: optional profile fields render only when filled, and never leave an empty section.
import { mkdtemp, mkdir, copyFile, rm, realpath } from 'node:fs/promises';
import os from 'node:os'; import path from 'node:path';
import { chromium } from 'playwright';
import { ROOT, managedFiles, loadProfile } from '../lib/project.mjs';
import { configureOwner } from '../lib/owner-auth.mjs';
import { startOwnerServer } from '../lib/owner-server.mjs';

const results = []; const check = (name, condition, detail = '') => { const line = `${condition ? 'OK  ' : 'FAIL'} ${name}${detail ? ' — ' + detail : ''}`; results.push(line); console.log(line); };
const root = await mkdtemp(path.join(await realpath(os.tmpdir()), '3ds-browser-'));
for (const file of [...await managedFiles(ROOT), 'config.js']) { const to = path.join(root, file); await mkdir(path.dirname(to), { recursive: true }); await copyFile(path.join(ROOT, file), to); }
await configureOwner(root, 'owner-browser', 'Browser-test-only-2026-password');
const app = await startOwnerServer({ root, port: 0 }); const browser = await chromium.launch();
const base = await loadProfile(root); const shots = path.join(ROOT, '.browser-shots'); await mkdir(shots, { recursive: true });
async function show(config, width = 1280) {
  const context = await browser.newContext({ viewport: { width, height: 900 }, locale: 'fr-FR' }); const page = await context.newPage(); const errors = [];
  page.on('pageerror', error => errors.push(String(error))); page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  await page.route('**/config.js', route => route.fulfill({ contentType: 'text/javascript', body: 'window.PROFILE_CONFIG = ' + JSON.stringify(config) + ';' }));
  await page.goto(app.url + '/#profil'); await page.waitForSelector('#profile-extra, #site-title', { state: 'attached' }); await page.waitForTimeout(300); page.errors = errors; page.context_ = context; return page;
}
const headings = page => page.evaluate(() => [...document.querySelectorAll('#profile-extra .content-section h3')].map(node => node.textContent));
try {
  const empty = await show({ ...base, name: 'Vide', about: '', bio: '', interests: [] });
  check('empty profile: no section at all', (await headings(empty)).length === 0 && await empty.evaluate(() => document.getElementById('profile-extra').hidden), (await headings(empty)).join());
  check('empty profile: no personal colour marker', await empty.evaluate(() => document.documentElement.dataset.personal) === 'false'); await empty.context_.close();
  const partial = await show({ ...base, name: 'Partiel', status: 'En pause', consoles: ['3DS XL'] });
  const shown = await headings(partial); check('only filled fields are shown', shown.join() === 'Statut,Consoles', shown.join()); await partial.context_.close();
  const full = await show({ ...base, name: 'Complet', about: 'Salut', status: 'Disponible', favoriteGames: ['Zelda'], consoles: ['3DS XL', 'Switch'], timezone: 'Asia/Tokyo', personalColor: '#2288aa', mascot: { name: 'Mochi', image: 'assets/avatar.svg', credit: 'Template' } });
  const all = await headings(full); check('all filled sections are shown', ['À propos', 'Statut', 'Jeux favoris', 'Consoles', 'Fuseau horaire', 'Personnage ou mascotte'].every(title => all.includes(title)), all.join());
  check('time zone shows a local time', /Asia\/Tokyo · il y est \d{2}:\d{2}/.test(await full.evaluate(() => document.getElementById('profile-extra').textContent)));
  check('personal colour is applied', await full.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--personal-color').trim()) === '#2288aa');
  check('no empty section heading in the page', await full.evaluate(() => [...document.querySelectorAll('#profile-extra .content-section')].every(section => section.textContent.replace(section.querySelector('h3').textContent, '').trim().length > 0 || section.querySelector('img'))));
  await full.screenshot({ path: path.join(shots, 'profile-fields.png') });
  check('no horizontal overflow, no errors', await full.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth) && full.errors.length === 0, full.errors.join('|')); await full.context_.close();
  const phone = await show({ ...base, name: 'Mobile', status: 'x'.repeat(120), favoriteGames: ['Un jeu au nom vraiment très long pour vérifier le retour à la ligne'], personalColor: '#a82037' }, 320);
  check('phone 320px: long values wrap without overflow', await phone.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)); await phone.context_.close();
} finally { await browser.close(); await app.close(); const resolved = await realpath(root); if (path.basename(resolved).startsWith('3ds-browser-')) await rm(resolved, { recursive: true, force: true }); }
process.exitCode = results.some(line => line.startsWith('FAIL')) ? 1 : 0;
