// Browser test for the appearance system: themes, owner design options, visitor preferences, custom palette in the dashboard.
//   node browser-tests/appearance.mjs   (from the project root; writes screenshots to ./.browser-shots)
import { mkdtemp, mkdir, copyFile, rm, realpath } from 'node:fs/promises';
import os from 'node:os'; import path from 'node:path';
import { chromium } from 'playwright';
import { ROOT, managedFiles, loadProfile } from '../lib/project.mjs';
import { configureOwner } from '../lib/owner-auth.mjs';
import { startOwnerServer } from '../lib/owner-server.mjs';
import { DEFAULT_CONFIG } from '../lib/config.mjs';

const results = []; const check = (name, condition, detail = '') => { const line = `${condition ? 'OK  ' : 'FAIL'} ${name}${detail ? ' — ' + detail : ''}`; results.push(line); console.log(line); };
const root = await mkdtemp(path.join(await realpath(os.tmpdir()), '3ds-browser-'));
for (const file of [...await managedFiles(ROOT), 'config.js']) { const to = path.join(root, file); await mkdir(path.dirname(to), { recursive: true }); await copyFile(path.join(ROOT, file), to); }
await configureOwner(root, 'owner-browser', 'Browser-test-only-2026-password');
const app = await startOwnerServer({ root, port: 0 });
const shots = path.join(ROOT, '.browser-shots'); await mkdir(shots, { recursive: true });
const base = await loadProfile(root);
const profile = { ...base, name: 'Camille', pronouns: 'iel', about: 'Un profil de test.', interests: ['jeux', 'musique'], links: [{ name: 'GitHub', url: 'https://github.com/example', icon: 'github' }], pages: [{ id: 'sona', title: 'Sona', type: 'sona', content: 'Un personnage.', traits: [{ label: 'Nom', value: 'Mochi' }], images: [], visible: true }] };
const withAppearance = appearance => ({ ...profile, appearance: { ...DEFAULT_CONFIG.appearance, ...appearance } });
const browser = await chromium.launch();
async function open(context, config, hash = '') {
  const page = await context.newPage(); const errors = []; page.on('pageerror', error => errors.push(String(error))); page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  await page.route('**/config.js', route => route.fulfill({ contentType: 'text/javascript', body: 'window.PROFILE_CONFIG = ' + JSON.stringify(config) + ';' }));
  await page.goto(app.url + '/' + hash); await page.waitForSelector('#site-title'); await page.waitForTimeout(250); page.errors = errors; return page;
}
const overflow = page => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
try {
  for (const [label, width, height] of [['phone320', 320, 640], ['laptop', 1280, 800]]) {
    const context = await browser.newContext({ viewport: { width, height }, locale: 'fr-FR' });
    for (const theme of ['classic', 'light', 'night', 'dsi', 'eshop', 'network']) {
      const page = await open(context, withAppearance({ theme }));
      check(`${label}/${theme}: theme applied, no overflow, no errors`, await page.evaluate(() => document.documentElement.dataset.theme) === theme && await overflow(page) <= 0 && page.errors.length === 0, page.errors.join('|'));
      if (label === 'laptop') await page.screenshot({ path: path.join(shots, `theme-${theme}.png`) });
      await page.close();
    }
    const options = { 'xlarge text': { textSize: 'xlarge' }, 'list layout': { layout: 'list' }, 'compact layout': { layout: 'compact' }, 'round shape': { shape: 'round' }, 'square shape': { shape: 'square' }, 'roomy spacing': { spacing: 'roomy' }, 'compact spacing': { spacing: 'compact' }, 'flat panels': { panel: 'flat' }, 'outlined panels': { panel: 'outlined' }, 'no decorations': { decorations: false }, 'soft motion': { motion: 'soft' } };
    for (const [name, appearance] of Object.entries(options)) for (const hash of ['', '#profil', '#sona']) {
      const page = await open(context, withAppearance({ theme: 'eshop', ...appearance }), hash);
      check(`${label}/${name}${hash}: no horizontal overflow`, await overflow(page) <= 0 && page.errors.length === 0, `${await overflow(page)} ${page.errors.join('|')}`);
      if (label === 'laptop' && !hash && ['list layout', 'round shape', 'flat panels', 'xlarge text'].includes(name)) await page.screenshot({ path: path.join(shots, `option-${name.replace(/ /g, '-')}.png`) });
      await page.close();
    }
    const small = await context.newPage(); await small.route('**/config.js', route => route.fulfill({ contentType: 'text/javascript', body: 'window.PROFILE_CONFIG = ' + JSON.stringify(withAppearance({ theme: 'classic' })) + ';' }));
    await small.goto(app.url + '/'); await small.waitForSelector('#site-title');
    const tooSmall = await small.evaluate(() => [...document.querySelectorAll('.menu-button,.back-button,.small-button')].filter(element => element.offsetParent && (element.getBoundingClientRect().height < 44 || element.getBoundingClientRect().width < 44)).length);
    check(`${label}: menu and action buttons are at least 44px`, tooSmall === 0, String(tooSmall)); await context.close();
  }
  {
    const context = await browser.newContext({ viewport: { width: 1280, height: 800 }, locale: 'fr-FR' }); const config = withAppearance({ theme: 'classic' });
    const page = await open(context, config, '#parametres');
    await page.selectOption('#theme-select', 'dsi'); await page.selectOption('#text-size-select', 'large');
    check('visitor: chooses a theme and text size', await page.evaluate(() => [document.documentElement.dataset.theme, document.documentElement.dataset.text].join()) === 'dsi,large');
    await page.reload(); await page.waitForSelector('#site-title');
    check('visitor: choices persist after reload', await page.evaluate(() => [document.documentElement.dataset.theme, document.documentElement.dataset.text].join()) === 'dsi,large');
    check('visitor: owner-only custom theme is not offered', await page.evaluate(() => document.querySelector('#theme-select option[value=custom]').hidden));
    await page.close();
    const fresh = await browser.newContext({ viewport: { width: 1280, height: 800 }, locale: 'fr-FR' }); // a new browser profile: no saved visitor choices
    const owner = await open(fresh, withAppearance({ theme: 'custom' }));
    check('owner theme "custom" is offered to visitors', await owner.evaluate(() => !document.querySelector('#theme-select option[value=custom]').hidden && document.documentElement.dataset.theme === 'custom'));
    await owner.screenshot({ path: path.join(shots, 'theme-custom.png') }); await owner.close();
    const unreadable = await open(fresh, { ...profile, appearance: { ...DEFAULT_CONFIG.appearance, theme: 'custom', custom: { ...DEFAULT_CONFIG.appearance.custom, text: '#e0e0d0' } } });
    check('an unreadable custom palette falls back to the classic theme', await unreadable.evaluate(() => document.documentElement.dataset.theme) === 'classic'); await unreadable.close(); await fresh.close();
    const reduced = await browser.newContext({ viewport: { width: 1280, height: 800 }, reducedMotion: 'reduce' }); const calm = await open(reduced, withAppearance({}));
    check('reduced motion: no animation or transition on the menu', await calm.evaluate(() => { const style = getComputedStyle(document.querySelector('.menu-button')); return style.transitionDuration.split(',').every(value => parseFloat(value) === 0) && style.animationName === 'none'; })); await reduced.close();
    // Owner dashboard: custom palette with live readability check.
    const dash = await context.newPage(); await dash.goto(app.url + '/assets/owner/index.html');
    await dash.fill('[name=username]', 'owner-browser'); await dash.fill('[name=password]', 'Browser-test-only-2026-password'); await dash.click('#login-form button[type=submit]'); await dash.waitForSelector('#editor:not([hidden])');
    await dash.click('#editor-tabs [data-tab=appearance]'); await dash.selectOption('#editor-panel select >> nth=1', 'custom');
    await dash.waitForSelector('.contrast-report');
    check('dashboard: custom palette shows a passing readability report', (await dash.textContent('.contrast-report')).includes('Lisibilité vérifiée') && await dash.locator('#save').isEnabled());
    await dash.fill('input[aria-label="Texte"]', '#e0e0d0').catch(async () => { await dash.locator('input[type=color]').nth(6).evaluate(input => { input.value = '#e0e0d0'; input.dispatchEvent(new Event('input', { bubbles: true })); }); });
    await dash.waitForFunction(() => document.querySelector('.contrast-report')?.textContent.includes('insuffisante'));
    check('dashboard: unreadable colours block publishing and are explained', await dash.locator('#save').isDisabled() && (await dash.textContent('.contrast-report')).includes(':1 (minimum'));
    await dash.screenshot({ path: path.join(shots, 'dashboard-appearance.png') });
    await dash.locator('input[type=color]').nth(6).evaluate(input => { input.value = '#2f3029'; input.dispatchEvent(new Event('input', { bubbles: true })); });
    await dash.waitForFunction(() => document.querySelector('.contrast-report')?.textContent.includes('Lisibilité vérifiée'));
    await dash.selectOption('#editor-panel select >> nth=4', 'round'); await dash.click('#save'); await dash.waitForSelector('#dirty', { state: 'hidden' });
    const published = await (await fetch(app.url + '/config.js')).text(); check('dashboard: publishing stores the custom theme and design options', published.includes('"theme":"custom"') && published.includes('"shape":"round"'));
    await context.close();
  }
} finally { await browser.close(); await app.close(); const resolved = await realpath(root); if (path.basename(resolved).startsWith('3ds-browser-')) await rm(resolved, { recursive: true, force: true }); }
process.exitCode = results.some(line => line.startsWith('FAIL')) ? 1 : 0;
