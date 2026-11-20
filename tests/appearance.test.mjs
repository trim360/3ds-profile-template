import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fixture } from './helpers.mjs';
import { ROOT, loadProfile, saveProfile, buildSite } from '../lib/project.mjs';
import { DEFAULT_CONFIG, normalizeConfig, validateConfig } from '../lib/config.mjs';
import { THEMES, SKINNED_THEMES, DEFAULT_CUSTOM, contrastRatio, customProblems, normalizeCustom } from '../lib/theme.mjs';

test('contrast ratios follow WCAG and the default custom palette is readable', () => {
  assert.equal(Math.round(contrastRatio('#000000', '#ffffff')), 21); assert.equal(contrastRatio('#336699', '#336699'), 1);
  assert.ok(Math.abs(contrastRatio('#767676', '#ffffff') - 4.54) < 0.05);
  assert.deepEqual(customProblems(DEFAULT_CUSTOM), []);
  assert.ok(customProblems({ ...DEFAULT_CUSTOM, text: '#e0e0d0' }).length >= 3);
});

test('configurations written by 2.1.0 load unchanged and receive appearance defaults', async t => {
  const legacy = { schemaVersion: 2, name: 'Ancien profil', about: 'Texte', appearance: { theme: 'night', accent: 'red', animations: false, readable: true }, links: [{ name: 'GitHub', url: 'https://github.com/example', icon: 'github' }] };
  const config = normalizeConfig(legacy);
  assert.deepEqual({ theme: config.appearance.theme, accent: config.appearance.accent, animations: config.appearance.animations, readable: config.appearance.readable }, legacy.appearance);
  assert.deepEqual([config.appearance.textSize, config.appearance.motion, config.appearance.shape, config.appearance.spacing, config.appearance.layout, config.appearance.panel, config.appearance.decorations], ['normal', 'full', 'soft', 'normal', 'grid', 'raised', true]);
  assert.deepEqual(validateConfig(legacy), []);
  const root = await fixture(t);   // the shipped legacy config.js, never edited by the appearance system
  const before = await readFile(path.join(root, 'config.js'), 'utf8');
  const loaded = await loadProfile(root); assert.equal(loaded.appearance.theme, 'classic'); assert.equal(loaded.appearance.shape, 'soft');
  await saveProfile(root, { ...loaded, name: 'Migré' });
  const reloaded = await loadProfile(root); assert.equal(reloaded.name, 'Migré'); assert.deepEqual(reloaded.links, loaded.links); assert.deepEqual(reloaded.appearance, loaded.appearance);
  assert.notEqual(before, await readFile(path.join(root, 'config.js'), 'utf8'));
});

test('appearance values from untrusted data are constrained to the allowed lists', () => {
  const config = normalizeConfig({ appearance: { theme: '<script>', accent: 'pink', textSize: 'huge', shape: 'x', spacing: 3, layout: null, panel: {}, motion: 'wild', decorations: 'yes', custom: { primary: 'red', text: '#12345', border: '#ABCDEF', secondary: 'javascript:1' } } });
  assert.deepEqual([config.appearance.theme, config.appearance.accent, config.appearance.textSize, config.appearance.shape, config.appearance.spacing, config.appearance.layout, config.appearance.panel, config.appearance.motion, config.appearance.decorations], ['classic', 'orange', 'normal', 'soft', 'normal', 'grid', 'raised', 'full', true]);
  assert.equal(config.appearance.custom.primary, DEFAULT_CUSTOM.primary); assert.equal(config.appearance.custom.text, DEFAULT_CUSTOM.text);
  assert.equal(config.appearance.custom.border, '#abcdef'); assert.equal(config.appearance.custom.secondary, DEFAULT_CUSTOM.secondary);
  assert.throws(() => normalizeConfig({ appearance: { custom: { constructor: '#000000' } } }), /Unsafe configuration key/);
  assert.throws(() => normalizeConfig({ appearance: { __proto__: null, custom: JSON.parse('{"__proto__":{"x":1}}') } }));
  for (const theme of THEMES) assert.equal(normalizeConfig({ appearance: { theme } }).appearance.theme, theme === 'custom' ? 'custom' : theme);
});

test('an unreadable custom theme cannot be published and is never rendered', () => {
  const unreadable = { theme: 'custom', custom: { ...DEFAULT_CUSTOM, text: '#d8d8c8' } };
  const errors = validateConfig({ appearance: unreadable }); assert.ok(errors.some(line => /readability/i.test(line)), errors.join('|'));
  assert.equal(normalizeConfig({ appearance: unreadable }).appearance.theme, 'classic');
  assert.deepEqual(validateConfig({ appearance: { theme: 'custom', custom: { ...DEFAULT_CUSTOM, text: '#10130c' } } }), []);
  assert.deepEqual(validateConfig({ appearance: { theme: 'dsi' } }), []);
});

function browserStub(saved) {
  const store = new Map(saved ? [['threeDsPreferences', JSON.stringify(saved)]] : []), properties = new Map();
  globalThis.localStorage = { getItem: key => store.get(key) ?? null, setItem: (key, value) => store.set(key, String(value)) };
  const root = { dataset: {}, style: { setProperty: (name, value) => properties.set(name, value), removeProperty: name => properties.delete(name) } };
  globalThis.document = { documentElement: root };
  return { store, properties, root };
}
test('visitor preferences from 2.1.0 survive; only visitor-owned fields are stored; custom needs the owner theme', async () => {
  const { loadPreferences, savePreferences, applyPreferences } = await import('../lib/preferences.mjs');
  const old = { theme: 'night', accent: 'red', animations: false, readable: true, sounds: true, language: 'fr' };
  browserStub(old);
  const value = loadPreferences({ ...DEFAULT_CONFIG.appearance, sounds: false });
  assert.deepEqual({ theme: value.theme, accent: value.accent, animations: value.animations, readable: value.readable, sounds: value.sounds, language: value.language }, old);
  assert.equal(value.textSize, 'normal');
  const stub = browserStub({ theme: 'custom' });
  assert.equal(loadPreferences({ ...DEFAULT_CONFIG.appearance }).theme, 'classic', 'a visitor cannot select an owner palette that does not exist');
  assert.equal(loadPreferences({ ...DEFAULT_CONFIG.appearance, theme: 'custom' }).theme, 'custom');
  savePreferences({ ...value, shape: 'round', custom: DEFAULT_CUSTOM, panel: 'flat' });
  assert.deepEqual(Object.keys(JSON.parse(stub.store.get('threeDsPreferences'))).sort(), ['accent', 'animations', 'language', 'readable', 'sounds', 'textSize', 'theme']);
  const state = browserStub();
  applyPreferences({ ...DEFAULT_CONFIG.appearance, theme: 'dsi', shape: 'round', textSize: 'large', decorations: false, readable: false, animations: true });
  assert.deepEqual([state.root.dataset.theme, state.root.dataset.skin, state.root.dataset.shape, state.root.dataset.text, state.root.dataset.decorations], ['dsi', 'themed', 'round', 'large', 'false']);
  assert.equal(state.properties.size, 0);
  applyPreferences({ ...DEFAULT_CONFIG.appearance, theme: 'custom', custom: { ...DEFAULT_CUSTOM, primary: '#112233' } });
  assert.equal(state.properties.get('--t-accent'), '#112233'); assert.equal(state.root.dataset.skin, 'themed');
  applyPreferences({ ...DEFAULT_CONFIG.appearance, theme: 'night' }); assert.equal(state.properties.size, 0); assert.equal(state.root.dataset.skin, 'native');
  applyPreferences({ ...DEFAULT_CONFIG.appearance, theme: 'custom', custom: { ...DEFAULT_CUSTOM, text: '#e0e0d0' } }); assert.equal(state.root.dataset.theme, 'classic');
  applyPreferences({ theme: 'classic', accent: 'orange', animations: true, readable: false }); assert.equal(state.root.dataset.shape, 'soft'); assert.equal(state.root.dataset.spacing, 'normal');
  delete globalThis.localStorage; delete globalThis.document;
});

test('static export ships the theme module, every selectable theme has styling and translations', async t => {
  const root = await fixture(t); await buildSite(root);
  await stat(path.join(root, 'dist/lib/theme.mjs'));
  const css = await readFile(path.join(ROOT, 'style.css'), 'utf8'), html = await readFile(path.join(ROOT, 'index.html'), 'utf8');
  for (const theme of SKINNED_THEMES.filter(name => name !== 'custom')) assert.match(css, new RegExp(`html\\[data-theme=${theme}\\]`), theme);
  assert.match(css, /html\[data-skin=themed\]/);
  const options = [...html.matchAll(/<option value="([a-z]+)" data-i18n="theme[A-Za-z]+"/g)].map(match => match[1]);
  assert.deepEqual(options.sort(), [...THEMES].sort());
  for (const language of ['en', 'fr']) { const { ui } = JSON.parse(await readFile(path.join(ROOT, `locales/${language}.json`), 'utf8')); for (const key of ['themeDsi', 'themeEshop', 'themeNetwork', 'themeCustom', 'textSize', 'textSizeSmall', 'textSizeNormal', 'textSizeLarge', 'textSizeXLarge']) assert.equal(typeof ui[key], 'string', `${language}:${key}`); }
  assert.deepEqual(normalizeCustom(null), DEFAULT_CUSTOM);
});

test('built-in themes keep text readable on every surface they paint', async () => {
  const css = await readFile(path.join(ROOT, 'style.css'), 'utf8');
  for (const theme of ['dsi', 'eshop', 'network']) {
    const block = css.match(new RegExp(`html\\[data-theme=${theme}\\] \\{([^}]*)\\}`))?.[1]; assert.ok(block, theme);
    const v = Object.fromEntries([...block.matchAll(/--t-([a-z-]+):\s*(#[0-9a-f]{6})/gi)].map(match => [match[1], match[2]]));
    for (const surface of ['window', 'top', 'bottom', 'hover', 'bar-top', 'bar-bottom']) for (const ink of ['ink', 'muted']) assert.ok(contrastRatio(v[ink], v[surface]) >= 4.5, `${theme}: ${ink} on ${surface} = ${contrastRatio(v[ink], v[surface]).toFixed(2)}`);
    assert.ok(contrastRatio(v.link, v.window) >= 4.5, `${theme}: link on window = ${contrastRatio(v.link, v.window).toFixed(2)}`);
    assert.ok(contrastRatio(v.ink, v.bg) >= 4.5, `${theme}: ink on page background`);
  }
});
