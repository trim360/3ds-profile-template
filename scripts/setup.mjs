import { createInterface } from 'node:readline';
import { readFile, writeFile, unlink, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { homedir } from 'node:os';
import { ROOT, exists, loadProfile, saveProfile, importMedia, previewSite, buildSite, withLock } from '../lib/project.mjs';
import { safeUrl, validateConfig } from '../lib/config.mjs';

export async function runSetup({ root = ROOT, input = process.stdin, output = process.stdout } = {}) {
  if (Number(process.versions.node.split('.')[0]) < 22) throw new Error('Node.js 22+ LTS required: https://nodejs.org/');
  const rl = createInterface({ input, terminal: false }); const lines = rl[Symbol.asyncIterator]();
  const print = text => output.write(String(text) + '\n');
  let language = 'en'; let strings;
  async function ask(label) {
    output.write(String(label) + '\n> ');
    const line = await lines.next(); if (line.done) throw new Error('SETUP_EXIT'); return line.value.trim();
  }
  function t(key, values = {}) { return (strings[key] || key).replace(/\{(\w+)\}/g, (_, name) => String(values[name] ?? '')); }
  async function entry(key, current = '', values) {
    const clean = String(current).replace(/[\x00-\x1f\x7f]/g, ' ');
    const answer = await ask(t(key, values) + (clean ? ` [${clean}]` : ''));
    return answer === '-' ? '' : answer || current;
  }
  async function yes(key, current = false, values) {
    for (;;) {
      const answer = (await ask(t(key, values) + ' ' + t('yesNo') + ` [${current ? language === 'fr' ? 'o' : 'y' : 'n'}]`)).toLowerCase();
      if (!answer) return current;
      if (['y', 'yes', 'o', 'oui', '1'].includes(answer)) return true;
      if (['n', 'no', 'non', '2'].includes(answer)) return false;
      print(t('invalid'));
    }
  }
  async function url(key, current = '') {
    for (;;) { const value = await entry(key, current); if (!value || /^https?:\/\//i.test(value) && safeUrl(value)) return value; print(t('invalid')); }
  }
  async function media(kind, current = '') {
    for (;;) {
      const source = await ask(t(kind === 'music' ? 'musicPath' : 'imagePath'));
      if (!source) return current;
      try { const relative = await withLock(root, () => importMedia(root, source, kind)); print(t('imageImported', { path: relative })); return relative; }
      catch (error) { print(t('error', { error: error.message })); if (!await yes('retry', true)) return current; }
    }
  }
  async function iconFile(value, current = '') {
    if (!value || value === current) return value;
    if (/^https?:\/\//i.test(value) && safeUrl(value)) return value;
    let source = value.replace(/^(["'])(.*)\1$/, '$2');
    source = source.startsWith('~/') ? path.join(homedir(), source.slice(2)) : path.resolve(root, source);
    if (!await exists(source)) throw new Error(t('iconMissing'));
    const relative = path.relative(root, source).split(path.sep).join('/');
    if (source.toLowerCase().endsWith('.svg') && relative && !relative.startsWith('..') && !path.isAbsolute(relative)) return relative;
    return withLock(root, () => importMedia(root, source, 'image'));
  }
  function list(items) { items.forEach((item, index) => print(`${index + 1}. ${item.title || item.name || item.src || item.url}`)); }
  async function remove(items) {
    list(items); const number = Number(await ask(t('removeNumber')));
    if (Number.isInteger(number) && number > 0 && number <= items.length && await yes('removeConfirm')) items.splice(number - 1, 1);
  }
  async function links(items) {
    for (;;) {
      list(items); const choice = await ask(t('linksMenu')); if (choice === '0' || !choice) return;
      if (choice === '2') await remove(items);
      if (choice === '1') {
        const platform = (await entry('platform', 'custom')).toLowerCase();
        const name = await entry('linkName', platform === 'custom' ? '' : platform); const address = await url('url'); if (!address) continue;
        const label = await entry('linkLabel'); const rawIcon = await entry('linkIcon', platform === 'custom' ? '' : platform);
        const icon = /^(github|tiktok|x|twitter|youtube|discord|network)$/i.test(rawIcon) ? rawIcon.toLowerCase() : await iconFile(rawIcon);
        items.push({ name, label, url: address, icon });
      }
    }
  }
  async function images(items) {
    for (;;) {
      list(items); const choice = await ask(t('imagesMenu'));
      if (!choice || choice === '0') return;
      if (choice === '2') { await remove(items); continue; }
      if (choice !== '1') continue;
      const src = await media('image'); if (!src) continue;
      items.push({ src, caption: await entry('caption'), credit: await entry('artist') });
    }
  }
  async function projects(items) {
    for (;;) {
      list(items); const choice = await ask(t('projectsMenu')); if (!choice || choice === '0') return;
      if (choice === '2') { await remove(items); continue; }
      if (choice === '1') { const title = await entry('projectTitle'); if (title) items.push({ title, description: await entry('projectDescription'), url: await url('url') }); }
    }
  }
  async function pages(config) {
    for (;;) {
      list(config.pages); const choice = await ask(t('pagesMenu')); if (!choice || choice === '0') return;
      if (choice === '3') { await remove(config.pages); continue; }
      if (!['1', '2'].includes(choice)) continue;
      let page;
      if (choice === '2') { const number = Number(await ask(t('pageNumber'))); page = config.pages[number - 1]; if (!page) continue; }
      else {
        let id;
        for (;;) { id = await entry('pageId'); if (!id) break; if (/^[a-z][a-z0-9-]{0,63}$/.test(id) && !['accueil', 'profil', 'reseaux', 'audio', ...config.pages.map(p => p.id)].includes(id)) break; print(t('invalid')); }
        if (!id) continue;
        const type = await entry('pageType', 'custom'); if (!['about', 'projects', 'sona', 'gallery', 'links', 'custom'].includes(type)) { print(t('invalid')); continue; }
        page = { id, type, title: '', content: '', images: [], links: [], traits: [], visible: true }; config.pages.push(page);
      }
      page.title = await entry('pageTitle', page.title); page.content = await entry('pageContent', page.content);
      page.visible = await yes('visible', page.visible !== false);
      if (page.type === 'sona') {
        const traits = await entry('traits', (page.traits || []).map(item => `${item.label}=${item.value}`).join(';'));
        page.traits = traits.split(';').filter(Boolean).map(item => { const [label, ...value] = item.split('='); return { label: label.trim(), value: value.join('=').trim() }; });
      }
      page.images ||= []; page.links ||= [];
      await images(page.images); if (page.type === 'links') await links(page.links);
      if (page.type === 'projects') { page.projects ||= []; await projects(page.projects); }
    }
  }
  async function music(config) {
    print(t('musicRights'));
    if (!await yes('musicQuestion', Boolean(config.music))) { config.music = ''; print(t('musicRemoved')); return; }
    let owner;
    do { owner = await ask(t('musicOwner')); } while (!['1', '2', '3'].includes(owner));
    if (owner === '3') { if (await yes('musicUnknown', true)) config.music = ''; return; }
    const title = await entry('musicTitle', config.musicTitle);
    const artist = owner === '1' ? 'Nintendo' : await entry('musicArtist', config.musicCredit.artist);
    const source = owner === '1' ? '' : await url('musicSource', config.musicCredit.source);
    if (!await yes('musicAllowed')) return;
    const file = await media('music', config.music);
    if (file) { config.music = file; config.musicTitle = title; config.musicCredit = { owner: owner === '1' ? 'nintendo' : 'other', artist, source, rightsConfirmed: true }; }
  }
  async function credits(config) {
    print(t('creatorProtected'));
    for (;;) {
      list(config.credits); const choice = await ask(t('creditsMenu')); if (!choice || choice === '0') return;
      if (choice === '2') await remove(config.credits);
      if (choice === '1') { const name = await entry('creditName'); if (name) config.credits.push({ name, role: await entry('creditRole'), url: await url('creditUrl') }); }
    }
  }
  async function translations(config) {
    let selected;
    do { selected = await entry('language', config.language); } while (!['auto', 'en', 'fr'].includes(selected));
    config.language = selected; print(t('translationNote'));
    config.translations.enabled = await yes('translateQuestion', config.translations.enabled);
    if (config.translations.enabled) {
      let target; do { target = await entry('translationLanguage', language); } while (!['en', 'fr'].includes(target));
      const values = config.translations.values[target] ||= {};
      values.about = await entry('translationAbout', values.about); values.bio = await entry('translationBio', values.bio);
      for (const page of config.pages) values[`page.${page.id}`] = await entry('translationPage', values[`page.${page.id}`], { title: page.title || page.id });
    }
  }
  async function advanced(config) {
    for (const id of ['profil', 'reseaux', 'audio']) {
      config.sections[id] = await yes('advancedSection', config.sections[id] !== false, { name: id });
      config.sectionTitles[id] = await entry('advancedTitle', config.sectionTitles[id], { name: id });
    }
    config.menuOrder = (await entry('advancedOrder', config.menuOrder.join(','))).split(',').map(value => value.trim()).filter(Boolean);
    config.homePage = await entry('advancedHome', config.homePage);
    for (const name of Object.keys(config.icons)) {
      const value = await entry('advancedIcon', config.icons[name], { name });
      config.icons[name] = await iconFile(value, config.icons[name]);
    }
    config.updates.enabled = await yes('updatesQuestion', config.updates.enabled);
  }
  async function preview() {
    const { server, url: address } = await previewSite(root);
    try { await ask(t('preview', { url: address })); } finally { await new Promise(resolve => server.close(resolve)); }
  }
  async function build() { if (await yes('buildConfirm')) print(t('build', { path: await buildSite(root) })); }
  try {
    let selected;
    do { selected = await ask('Language / Langue: [1] English  [2] Français'); } while (!['1', '2'].includes(selected));
    language = selected === '2' ? 'fr' : 'en';
    strings = JSON.parse(await readFile(path.join(root, `locales/${language}.json`), 'utf8')).setup;
    print(t('welcome')); print(t('environment', { os: process.platform, version: process.versions.node })); print(t('keep'));
    for (const file of ['index.html', 'script.js', 'style.css', 'config.js', 'version.json', 'assets/avatar.svg']) if (!await exists(path.join(root, file))) throw new Error(`Missing essential file: ${file}`);
    const probe = path.join(root, `.write-test-${randomUUID()}`); await writeFile(probe, '', { flag: 'wx' }); await unlink(probe); print(t('writeCheck'));
    if (await exists(path.join(root, 'user-content/profile.json'))) print(t('existing'));
    for (;;) {
      const config = await loadProfile(root); const before = JSON.stringify(config);
      const choice = await ask(t('menu'));
      if (choice === '0' || !choice) break;
      try {
        if (choice === '9') { await preview(); continue; }
        if (choice === 'b') { await build(); continue; }
        if (choice === '8') { const { runUpdater } = await import('./update.mjs'); await runUpdater({ root, language, ask, print }); continue; }
        if (!['1', '2', '3', '4', '5', '6', '7', 'a'].includes(choice)) continue;
        if (choice === '1') {
          for (const [key, field] of [['name','name'], ['pronouns','pronouns'], ['title','title'], ['about','about'], ['bio','bio']]) config[field] = await entry(key, config[field]);
          config.interests = (await entry('interests', config.interests.join(', '))).split(',').map(item => item.trim()).filter(Boolean);
          config.website = await url('website', config.website);
          if (await yes('pictureQuestion')) config.avatar = await media('image', config.avatar);
          if (await yes('coverQuestion')) config.cover = await media('image', config.cover);
          if (await yes('projectsQuestion')) await projects(config.projects);
          await images(config.gallery); await links(config.links);
          if (await yes('pagesQuestion')) await pages(config);
          await music(config);
        }
        if (choice === '2' && await yes('pictureQuestion')) config.avatar = await media('image', config.avatar);
        if (choice === '3') await links(config.links);
        if (choice === '4') await pages(config);
        if (choice === '5') await music(config);
        if (choice === '6') await credits(config);
        if (choice === '7') await translations(config);
        if (choice === 'a') await advanced(config);
        const errors = validateConfig(config); if (errors.length) throw new Error(errors.join('\n'));
        const result = await withLock(root, async () => {
          if (JSON.stringify(await loadProfile(root)) !== before) throw new Error('Configuration changed in another process; reload before saving.');
          return saveProfile(root, config);
        });
        print(t('saved', { backup: result.backup || t('none') }));
        if (choice === '1') {
          const finish = await ask(t('finish'));
          if (finish === '1') await preview(); if (finish === '2') await build(); if (finish === '0') break;
        }
      } catch (error) { if (error.message === 'SETUP_EXIT') break; print(t('error', { error: error.message })); }
    }
  } finally { rl.close(); }
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  runSetup().catch(error => { if (error.message !== 'SETUP_EXIT') { console.error(error.message); process.exitCode = 1; } });
}
