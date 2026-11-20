import { THEMES, OPTIONS, DEFAULT_CUSTOM, normalizeCustom, customProblems, choose, isHexColor } from './theme.mjs';

export const SCHEMA_VERSION = 2;
export const DEFAULT_ICONS = { settings: 'assets/settings-3ds.png', profile: 'assets/profile.svg', network: 'assets/network.svg', audio: 'assets/audio.svg' };
export const DEFAULT_CONFIG = {
  schemaVersion: 2, name: '', pronouns: '', title: '', domain: '', avatar: 'assets/avatar.svg', cover: '',
  about: '', bio: '', interests: [], projects: [], gallery: [], website: '', links: [], pages: [], credits: [],
  // Optional profile details (2.2): nothing is required and empty values are never displayed.
  favoriteGames: [], consoles: [], status: '', timezone: '', mascot: { name: '', image: '', credit: '' }, personalColor: '',
  icons: DEFAULT_ICONS, music: '', musicTitle: '', musicCredit: { owner: 'unknown', artist: '', source: '', rightsConfirmed: false },
  language: 'auto', homePage: 'accueil', menuOrder: ['profil', 'reseaux', 'audio'],
  sections: { profil: true, reseaux: true, audio: true }, sectionTitles: {},
  translations: { enabled: false, values: {} }, updates: { enabled: true, intervalHours: 24 },
  appearance: { theme: 'classic', accent: 'orange', animations: true, readable: false, textSize: 'normal', motion: 'full', shape: 'soft', spacing: 'normal', layout: 'grid', panel: 'raised', decorations: true, custom: DEFAULT_CUSTOM },
  audioDefaults: { enabled: true, volume: 0.25, sounds: false },
};

export function safeUrl(value, base = 'https://local.invalid/') {
  if (typeof value !== 'string' || !value.trim()) return '';
  try { const url = new URL(value, base); return ['https:', 'http:'].includes(url.protocol) ? url.href : ''; }
  catch { return ''; }
}

export function validTimezone(value) {
  try { new Intl.DateTimeFormat('en', { timeZone: value }); return typeof value === 'string' && /^[A-Za-z_]+(?:[/+-][A-Za-z0-9_+-]+)*$/.test(value); } catch { return false; }
}

export function assertData(value, depth = 0) {
  if (depth > 16) throw new Error('Configuration nesting exceeds 16 levels.');
  if (!value || typeof value !== 'object') return;
  for (const [key, item] of Object.entries(value)) {
    if (['__proto__', 'prototype', 'constructor'].includes(key)) throw new Error('Unsafe configuration key.');
    assertData(item, depth + 1);
  }
}

export function normalizeConfig(input = {}) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('Configuration must be an object.');
  assertData(input);
  if (input.schemaVersion > SCHEMA_VERSION) throw new Error('This configuration requires a newer application.');
  const config = { ...structuredClone(DEFAULT_CONFIG), ...structuredClone(input), schemaVersion: SCHEMA_VERSION };
  for (const key of ['icons', 'sections', 'sectionTitles', 'musicCredit', 'translations', 'updates', 'appearance', 'audioDefaults']) {
    config[key] = { ...DEFAULT_CONFIG[key], ...(input[key] && typeof input[key] === 'object' && !Array.isArray(input[key]) ? input[key] : {}) };
  }
  for (const key of ['links', 'pages', 'credits', 'interests', 'projects', 'gallery', 'menuOrder', 'favoriteGames', 'consoles']) if (!Array.isArray(config[key])) config[key] = structuredClone(DEFAULT_CONFIG[key]);
  for (const key of ['favoriteGames', 'consoles']) config[key] = config[key].filter(item => typeof item === 'string' && item.trim()).map(item => item.trim().slice(0, 80)).slice(0, 40);
  for (const key of ['status', 'timezone']) if (typeof config[key] !== 'string') config[key] = '';
  config.status = config.status.slice(0, 120);
  config.mascot = { ...DEFAULT_CONFIG.mascot, ...(input.mascot && typeof input.mascot === 'object' && !Array.isArray(input.mascot) ? input.mascot : {}) };
  for (const key of ['name', 'image', 'credit']) if (typeof config.mascot[key] !== 'string') config.mascot[key] = '';
  if (!isHexColor(config.personalColor)) config.personalColor = ''; else config.personalColor = config.personalColor.toLowerCase();
  for (const key of ['name', 'pronouns', 'title', 'domain', 'avatar', 'cover', 'about', 'bio', 'website', 'music', 'musicTitle']) {
    if (typeof config[key] !== 'string') config[key] = DEFAULT_CONFIG[key];
  }
  if (!['auto', 'en', 'fr'].includes(config.language)) config.language = 'auto';
  config.updates.intervalHours = Number.isFinite(config.updates.intervalHours) ? Math.min(720, Math.max(24, config.updates.intervalHours)) : 24;
  // Appearance additions are optional: configurations written by 2.1.0 and earlier simply receive the defaults.
  config.appearance.theme = choose(config.appearance.theme, THEMES, 'classic'); config.appearance.accent = choose(config.appearance.accent, OPTIONS.accent, 'orange');
  for (const key of ['textSize', 'motion', 'shape', 'spacing', 'layout', 'panel']) config.appearance[key] = choose(config.appearance[key], OPTIONS[key], DEFAULT_CONFIG.appearance[key]);
  if (typeof config.appearance.decorations !== 'boolean') config.appearance.decorations = true;
  config.appearance.custom = normalizeCustom(config.appearance.custom);
  // A custom palette that is not readable is never rendered: visitors get the classic theme instead (publishing it is refused by validateConfig).
  if (config.appearance.theme === 'custom' && customProblems(config.appearance.custom).length) config.appearance.theme = 'classic';
  for (const key of ['animations','readable']) if(typeof config.appearance[key]!=='boolean')config.appearance[key]=DEFAULT_CONFIG.appearance[key];
  for (const key of ['enabled','sounds']) if(typeof config.audioDefaults[key]!=='boolean')config.audioDefaults[key]=DEFAULT_CONFIG.audioDefaults[key];
  if(!Number.isFinite(config.audioDefaults.volume)||config.audioDefaults.volume<0||config.audioDefaults.volume>1)config.audioDefaults.volume=.25;
  if (!config.translations.values || typeof config.translations.values !== 'object' || Array.isArray(config.translations.values)) config.translations.values = {};
  if (config.music && !input.musicCredit) config.musicCredit = { owner: 'legacy', artist: '', source: '', rightsConfirmed: false };
  return config;
}

export function validateConfig(input) {
  const config = normalizeConfig(input);
  const errors = [];
  for (const key of ['avatar', 'cover', 'website', 'music']) if (config[key] && !safeUrl(config[key])) errors.push(`Invalid URL: ${key}`);
  if (config.mascot.image && !safeUrl(config.mascot.image)) errors.push('Invalid mascot image URL.');
  if (input.personalColor && !isHexColor(input.personalColor)) errors.push('Invalid personal colour (use #rrggbb).');
  if (config.timezone && !validTimezone(config.timezone)) errors.push('Invalid time zone (use an IANA name such as Europe/Paris).');
  for (const [key, value] of Object.entries(config.icons)) if (value && !safeUrl(value)) errors.push(`Invalid icon URL: ${key}`);
  for (const link of config.links) if (!link || !safeUrl(link.url)) errors.push('Invalid social link URL.');
  const ids = new Set(['accueil', 'profil', 'reseaux', 'audio']);
  for (const page of config.pages) {
    if (!page || !/^[a-z][a-z0-9-]{0,63}$/.test(page.id) || ids.has(page.id)) errors.push('Invalid or duplicate page ID.');
    else ids.add(page.id);
    if (page && !['about', 'projects', 'sona', 'gallery', 'links', 'custom'].includes(page.type)) errors.push('Invalid page type.');
    for (const field of ['images', 'links', 'traits', 'projects']) if (page?.[field] !== undefined && !Array.isArray(page[field])) errors.push(`Invalid page collection: ${field}`);
    for (const image of Array.isArray(page?.images) ? page.images : []) if (!image || !safeUrl(image.src)) errors.push('Invalid page image.');
    for (const link of Array.isArray(page?.links) ? page.links : []) if (!link || !safeUrl(link.url)) errors.push('Invalid page link.');
  }
  if (!ids.has(config.homePage)) errors.push('Unknown home page.');
  if (config.sections[config.homePage] === false || config.pages.some(page => page.id === config.homePage && page.visible === false)) errors.push('Home page cannot be hidden.');
  if (config.pages.length > 100 || config.links.length > 100 || config.credits.length > 100) errors.push('Maximum 100 entries per collection.');
  if (config.musicCredit.source && !safeUrl(config.musicCredit.source)) errors.push('Invalid music source URL.');
  if (input.appearance?.theme === 'custom') for (const problem of customProblems(input.appearance.custom)) errors.push(`Custom theme readability: ${problem.label} (${problem.ratio}:1, minimum ${problem.minimum}:1).`);
  if (JSON.stringify(config).length > 2_000_000) errors.push('Configuration exceeds 2 MB.');
  return errors;
}

export function localizedContent(config, key, language, original) {
  if (!config.translations.enabled) return original;
  const values = config.translations.values?.[language];
  return typeof values?.[key] === 'string' && values[key].trim() ? values[key] : original;
}

export function parseLegacyConfig(source) {
  const prefix = source.match(/^\s*(?:(?:\/\/[^\n]*\n)|(?:\/\*[\s\S]*?\*\/\s*))*\s*window\.PROFILE_CONFIG\s*=\s*/);
  if (!prefix) throw new Error('Unsupported legacy configuration. Use a literal window.PROFILE_CONFIG object.');
  const text = source.slice(prefix[0].length);
  let index = 0;
  function skip() {
    while (index < text.length) {
      if (/\s/.test(text[index])) index++;
      else if (text.startsWith('//', index)) { const end = text.indexOf('\n', index); index = end < 0 ? text.length : end + 1; }
      else if (text.startsWith('/*', index)) { const end = text.indexOf('*/', index + 2); if (end < 0) throw new Error('Unclosed comment.'); index = end + 2; }
      else break;
    }
  }
  function string() {
    const quote = text[index++]; let result = '';
    while (index < text.length) {
      let char = text[index++];
      if (char === quote) return result;
      if (char === '\\') {
        char = text[index++];
        if (char === 'u') { const hex = text.slice(index, index + 4); if (!/^[\da-f]{4}$/i.test(hex)) throw new Error('Invalid Unicode escape.'); result += String.fromCharCode(parseInt(hex, 16)); index += 4; }
        else if ('nrtbf'.includes(char)) result += { n: '\n', r: '\r', t: '\t', b: '\b', f: '\f' }[char];
        else if (['\\', "'", '"', '/'].includes(char)) result += char;
        else throw new Error('Unsupported string escape.');
      } else { if (char === '\n' || char === '\r') throw new Error('Unclosed string.'); result += char; }
    }
    throw new Error('Unclosed string.');
  }
  function value(depth = 0) {
    if (depth > 16) throw new Error('Configuration is too deeply nested.');
    skip(); const char = text[index];
    if (char === '"' || char === "'") return string();
    if (char === '{' || char === '[') {
      const array = char === '['; const result = array ? [] : {}; const end = array ? ']' : '}'; index++; skip();
      while (text[index] !== end) {
        if (index >= text.length) throw new Error('Unclosed configuration.');
        if (array) result.push(value(depth + 1));
        else {
          skip(); const key = ['"', "'"].includes(text[index]) ? string() : text.slice(index).match(/^[A-Za-z_$][\w$]*/)?.[0];
          if (!key) throw new Error('Invalid configuration key.');
          if (!['"', "'"].includes(text[index - 1])) index += key.length;
          if (['__proto__', 'prototype', 'constructor'].includes(key)) throw new Error('Unsafe configuration key.');
          skip(); if (text[index++] !== ':') throw new Error('Expected colon.'); result[key] = value(depth + 1);
        }
        skip(); if (text[index] === end) break;
        if (text[index++] !== ',') throw new Error('Expected comma.'); skip();
      }
      index++; return result;
    }
    const token = text.slice(index).match(/^(true|false|null|-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?)(?=\s|,|\]|\}|$)/)?.[0];
    if (!token) throw new Error('Only literal configuration data is supported; JavaScript expressions are not executed.');
    index += token.length; return JSON.parse(token);
  }
  const result = value(); skip(); if (text[index] === ';') { index++; skip(); }
  if (index !== text.length) throw new Error('Unexpected code after configuration.');
  assertData(result); return result;
}
