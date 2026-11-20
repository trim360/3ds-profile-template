// Browser test for the owner dashboard. Run with Playwright available (see tests/OWNER-VERIFICATION.md):
//   node browser-tests/owner-dashboard.mjs   (from the project root; writes screenshots to ./.browser-shots)
import { mkdtemp, mkdir, copyFile, rm, realpath } from 'node:fs/promises';
import os from 'node:os'; import path from 'node:path';
import { chromium } from 'playwright';
import { ROOT, managedFiles } from '../lib/project.mjs';
import { configureOwner } from '../lib/owner-auth.mjs';
import { startOwnerServer } from '../lib/owner-server.mjs';

const results = []; const check = (name, condition, detail = '') => { const line = `${condition ? 'OK  ' : 'FAIL'} ${name}${detail ? ' — ' + detail : ''}`; results.push(line); console.log(line); };
const root = await mkdtemp(path.join(await realpath(os.tmpdir()), '3ds-browser-'));
for (const file of [...await managedFiles(ROOT), 'config.js']) { const to = path.join(root, file); await mkdir(path.dirname(to), { recursive: true }); await copyFile(path.join(ROOT, file), to); }
await configureOwner(root, 'owner-browser', 'Browser-test-only-2026-password');
const app = await startOwnerServer({ root, port: 0 });
const shots = path.join(ROOT, '.browser-shots'); await mkdir(shots, { recursive: true });
const browser = await chromium.launch();
try {
  for (const [name, width, height, mobile] of [['phone', 375, 740, true], ['laptop', 1280, 800, false], ['wide', 1920, 1080, false]]) {
    const context = await browser.newContext({ viewport: { width, height }, isMobile: mobile, hasTouch: mobile, locale: 'fr-FR' }); const page = await context.newPage(); const errors = [];
    page.on('pageerror', error => errors.push(String(error))); page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
    await page.goto(app.url + '/assets/owner/index.html');
    await page.fill('[name=username]', 'owner-browser'); await page.fill('[name=password]', 'Browser-test-only-2026-password');
    await page.screenshot({ path: path.join(shots, `${name}-login.png`) });
    await page.click('#login-form button[type=submit]');
    await page.waitForSelector('#editor:not([hidden])'); await page.waitForSelector('#preview-screen:not([hidden])');
    const frame = page.frameLocator('#preview');
    await frame.locator('#site-title').waitFor({ timeout: 15000 });
    check(`${name}: logged in, preview frame shows the real site`, await frame.locator('#site-title').count() === 1);
    check(`${name}: nothing unsaved at start`, await page.locator('#dirty').isHidden() && await page.locator('#discard').isDisabled());
    await page.fill('#editor-panel input[type=text] >> nth=0', 'Nom de brouillon');
    await page.waitForSelector('#dirty:not([hidden])'); check(`${name}: unsaved indicator appears`, (await page.textContent('#dirty')).includes('non enregistrées'));
    await page.waitForFunction(() => document.getElementById('preview').contentDocument?.querySelector('[data-profile-name]')?.textContent === 'Nom de brouillon', null, { timeout: 15000 });
    check(`${name}: preview reflects the draft`, true);
    const published = await (await fetch(app.url + '/config.js')).text(); check(`${name}: the draft is not published`, !published.includes('Nom de brouillon'));
    await page.screenshot({ path: path.join(shots, `${name}-dashboard.png`) });
    check(`${name}: no horizontal overflow`, await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth));
    if (name === 'laptop') {
      page.once('dialog', d => d.dismiss());
      await page.click('#discard'); await page.click('#confirm-yes');
      await page.waitForSelector('#dirty', { state: 'hidden' }); check('laptop: discard restores the published values', (await page.inputValue('#editor-panel input[type=text] >> nth=0')) !== 'Nom de brouillon');
      await page.click('#editor-tabs [data-tab=pages]');
      const pages = '#editor-panel > .collection:has(> h3:text-is("Pages"))', entries = `${pages} > div > .entry`;
      for (const title of ['Alpha', 'Beta', 'Gamma']) { await page.click(`${pages} > button:text-is("Ajouter")`); await page.locator(`${entries} >> nth=-1`).locator('label:has-text("Titre") input').first().fill(title); }
      const order = async () => page.locator(`${entries} > .entry-header strong`).allTextContents();
      check('laptop: three pages added', (await order()).join() === 'Alpha,Beta,Gamma', (await order()).join());
      await page.click('[aria-label="Monter Gamma"]'); check('laptop: move up button reorders', (await order()).join() === 'Alpha,Gamma,Beta', (await order()).join());
      await page.locator(entries).nth(2).locator('> .entry-header strong').dragTo(page.locator(entries).nth(0).locator('> .entry-header strong'));
      let native = (await order()).join() === 'Beta,Alpha,Gamma';
      if (!native) { // fall back to dispatching the same drag events a browser fires, to test the handlers themselves
        await page.evaluate(() => { const section = [...document.querySelectorAll('#editor-panel > .collection')].find(item => item.querySelector(':scope > h3')?.textContent === 'Pages'), rows = section.querySelectorAll(':scope > div > .entry'), data = new DataTransfer(); const fire = (node, type) => node.dispatchEvent(new DragEvent(type, { bubbles: true, cancelable: true, dataTransfer: data })); fire(rows[2], 'dragstart'); fire(rows[0], 'dragover'); fire(rows[0], 'drop'); fire(rows[2], 'dragend'); });
      }
      check('laptop: drag and drop reorders' + (native ? ' (native drag)' : ' (simulated drag events; native drag did not fire in headless Chromium)'), (await order()).join() === 'Beta,Alpha,Gamma', (await order()).join());
      await page.click('[aria-label="Dupliquer Alpha"]'); check('laptop: duplicate adds a copy', (await order()).includes('Alpha (copie)'), (await order()).join());
      await page.click('[aria-label="Retirer Alpha (copie)"]'); await page.click('#confirm-no'); check('laptop: cancelling the removal keeps the page', (await order()).includes('Alpha (copie)'));
      await page.click('[aria-label="Retirer Alpha (copie)"]'); await page.click('#confirm-yes'); check('laptop: confirmed removal deletes it', !(await order()).includes('Alpha (copie)'));
      await page.click('#save'); await page.waitForSelector('#dirty', { state: 'hidden' }); await page.waitForTimeout(500);
      check('laptop: publish writes the pages', (await (await fetch(app.url + '/config.js')).text()).includes('Gamma'));
      await page.click('[aria-label="Retirer Gamma"]'); await page.click('#confirm-yes'); await page.click('#save'); await page.waitForSelector('#dirty', { state: 'hidden' });
      await page.click('text=Afficher les pages supprimées'); await page.waitForSelector('#editor-panel >> text=Gamma >> nth=-1');
      await page.click('[aria-label="Restaurer Gamma"]'); check('laptop: a deleted page can be restored into the draft', (await order()).includes('Gamma') && await page.locator('#dirty').isVisible());
      await page.click('#editor-tabs [data-tab=backups]'); await page.waitForSelector('#editor-panel .entry');
      check('laptop: backups are listed', await page.locator('#editor-panel .entry').count() >= 1);
      await page.screenshot({ path: path.join(shots, 'laptop-backups.png') });
      await page.focus('#editor-tabs [data-tab=backups]'); await page.keyboard.press('ArrowRight'); check('laptop: arrow keys move between tabs', await page.evaluate(() => document.activeElement.dataset.tab) === 'updates');
    }
    check(`${name}: no console errors`, errors.length === 0, errors.join(' | '));
    await context.close();
  }
} finally { await browser.close(); await app.close(); const resolved = await realpath(root); if (path.basename(resolved).startsWith('3ds-browser-')) await rm(resolved, { recursive: true, force: true }); }
console.log(results.join('\n')); process.exitCode = results.some(line => line.startsWith('FAIL')) ? 1 : 0;
