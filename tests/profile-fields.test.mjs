import test from 'node:test';
import assert from 'node:assert/strict';
import { fixture } from './helpers.mjs';
import { loadProfile, saveProfile } from '../lib/project.mjs';
import { DEFAULT_CONFIG, normalizeConfig, validateConfig, validTimezone } from '../lib/config.mjs';

test('new profile fields are optional: a 2.1.0 profile validates and gets empty defaults', () => {
  const legacy = { schemaVersion: 2, name: 'Ancien', bio: 'Bio', interests: ['musique'] };
  assert.deepEqual(validateConfig(legacy), []);
  const config = normalizeConfig(legacy);
  assert.deepEqual([config.favoriteGames, config.consoles, config.status, config.timezone, config.mascot, config.personalColor], [[], [], '', '', { name: '', image: '', credit: '' }, '']);
  assert.deepEqual(config.interests, ['musique']);
  assert.deepEqual(Object.keys(DEFAULT_CONFIG).filter(key => ['favoriteGames', 'consoles', 'status', 'timezone', 'mascot', 'personalColor'].includes(key)).length, 6);
});

test('profile fields are normalised and validated', () => {
  const config = normalizeConfig({ favoriteGames: [' Zelda ', '', 7, 'x'.repeat(200)], consoles: 'not an array', status: 's'.repeat(500), personalColor: '#ABCDEF', mascot: { name: 'Mochi', image: 5, credit: 'Artiste' } });
  assert.equal(config.favoriteGames[0], 'Zelda'); assert.equal(config.favoriteGames.length, 2); assert.equal(config.favoriteGames[1].length, 80);
  assert.deepEqual(config.consoles, []); assert.equal(config.status.length, 120); assert.equal(config.personalColor, '#abcdef');
  assert.deepEqual(config.mascot, { name: 'Mochi', image: '', credit: 'Artiste' });
  assert.equal(validTimezone('Europe/Paris'), true); assert.equal(validTimezone('Mars/Olympus'), false); assert.equal(validTimezone('../etc/passwd'), false);
  assert.deepEqual(validateConfig({ timezone: 'Europe/Paris', personalColor: '#112233', mascot: { name: 'M', image: 'assets/avatar.svg' } }), []);
  for (const bad of [{ timezone: 'Not/AZone' }, { personalColor: 'red' }, { personalColor: 'url(javascript:1)' }, { mascot: { image: 'javascript:alert(1)' } }]) assert.ok(validateConfig(bad).length > 0, JSON.stringify(bad));
});

test('profile fields round-trip through saving and keep earlier data intact', async t => {
  const root = await fixture(t); const before = await loadProfile(root);
  await saveProfile(root, { ...before, status: 'En pause', favoriteGames: ['Zelda', 'Animal Crossing'], consoles: ['3DS XL'], timezone: 'Europe/Paris', personalColor: '#2288aa', mascot: { name: 'Mochi', image: 'assets/avatar.svg', credit: 'Template' } });
  const after = await loadProfile(root);
  assert.deepEqual([after.status, after.favoriteGames, after.consoles, after.timezone, after.personalColor, after.mascot.name], ['En pause', ['Zelda', 'Animal Crossing'], ['3DS XL'], 'Europe/Paris', '#2288aa', 'Mochi']);
  for (const key of ['name', 'about', 'bio', 'links', 'pages', 'interests', 'appearance', 'music']) assert.deepEqual(after[key], before[key], key);
});
