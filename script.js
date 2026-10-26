// Copyright (C) 2026 Trim. GPLv3 and attribution: see LICENSE and NOTICE.
import { normalizeConfig, validateConfig, DEFAULT_ICONS } from './lib/config.mjs';
import { chooseLanguage, loadDictionary, format } from './lib/translations.mjs';
import { renderProfile, renderPages, renderCredits } from './lib/content.mjs';
import { latestRelease, compareVersions, releaseUrl } from './lib/releases.mjs';
const $ = (id) => document.getElementById(id);
const music = $('music');
let configurationError = '';
let config;
try {
  const errors = validateConfig(window.PROFILE_CONFIG || {});
  if (errors.length) throw new Error(errors.join(' '));
  config = normalizeConfig(window.PROFILE_CONFIG || {});
} catch (error) { config = normalizeConfig(); configurationError = error.message; }
let savedLanguage;
try { savedLanguage = localStorage.getItem('trimLanguage'); } catch {}
let locale;
try { locale = await loadDictionary(chooseLanguage(config.language, navigator.languages || [navigator.language], savedLanguage)); }
catch { locale = { language: 'en', strings: {}, fallback: true }; }
let language = locale.language;
let strings = locale.strings;
const t = (key, values) => format(strings[key] || document.querySelector(`[data-i18n="${key}"]`)?.textContent || key, values);
let profileName = config.name || t('defaultName');
function safeUrl(value) {
  if (typeof value !== 'string' || !value.trim()) return '';
  try {
    const url = new URL(value, location.href);
    return ['http:', 'https:'].includes(url.protocol) ? url.href : '';
  } catch { return ''; }
}
document.querySelectorAll('[data-profile-name]').forEach((element) => { element.textContent = profileName; });
const defaultIcons = DEFAULT_ICONS;
const icons = config.icons && typeof config.icons === 'object' ? config.icons : {};
const favicon = document.querySelector('link[rel="icon"]');
function setIconImage(image, source, fallback) {
  const fallbackUrl = safeUrl(fallback);
  image.addEventListener('error', () => {
    $('asset-status').hidden = false;
    $('asset-status').textContent = t('assetError');
    if (image.src !== fallbackUrl) image.src = fallbackUrl;
    else image.hidden = true;
    if (image.dataset.menuIcon === 'settings') favicon.href = fallbackUrl;
  });
  image.src = safeUrl(source) || fallbackUrl;
}
for (const image of document.querySelectorAll('[data-menu-icon]')) {
  const key = image.dataset.menuIcon;
  setIconImage(image, icons[key], defaultIcons[key]);
  if (key === 'settings') {
    favicon.removeAttribute('type');
    favicon.href = image.src;
  }
}
$('site-domain').textContent = config.domain || t('personalSite');
$('profile-image').src = safeUrl(config.avatar) || 'assets/avatar.svg';
$('profile-image').alt = `Avatar de ${profileName}`;
const musicUrl = safeUrl(config.music);
if (musicUrl) music.src = musicUrl;
$('music-title').textContent = musicUrl ? String(config.musicTitle || 'Musique personnelle') : 'Aucune musique configurée';
if (musicUrl) $('audio-note').textContent = 'La musique démarre après ta première interaction et continue pendant la navigation.';
let discordUrl = '';
for (const link of Array.isArray(config.links) ? config.links : []) {
  if (!link || typeof link !== 'object') continue;
  const url = safeUrl(link.url);
  if (!url) continue;
  const item = document.createElement('li');
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.target = '_blank';
  anchor.rel = 'noopener noreferrer';
  const iconName = String(link.icon || link.name || '').toLowerCase();
  const preset = iconName === 'twitter' ? 'x' : iconName;
  const presetId = ['tiktok', 'x', 'github', 'youtube', 'discord'].includes(preset) ? preset : 'network';
  let icon;
  if (presetId !== 'network' || preset === 'network' || !safeUrl(link.icon)) {
    icon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    const use = document.createElementNS('http://www.w3.org/2000/svg', 'use');
    use.setAttribute('href', `#icon-${presetId}`);
    icon.append(use);
  } else {
    icon = document.createElement('img');
    icon.alt = '';
    setIconImage(icon, link.icon, defaultIcons.network);
  }
  icon.setAttribute('class', 'social-icon');
  icon.setAttribute('aria-hidden', 'true');
  anchor.append(icon);
  const text = document.createElement('span');
  const title = document.createElement('strong');
  title.textContent = String(link.name || new URL(url).hostname);
  const label = document.createElement('span');
  label.textContent = String(link.label || new URL(url).hostname);
  text.append(title, label);
  anchor.append(text);
  item.append(anchor);
  $('social-links').append(item);
  if (new URL(url).hostname === 'discord.gg') discordUrl = url;
}
if ($('social-links').children.length) $('links-note').textContent = 'Les liens s’ouvrent dans un nouvel onglet.';
$('copy-discord').hidden = !discordUrl;
const preferenceKey = 'trimAudioPreferences';
let pages = ['accueil', 'profil', 'reseaux', 'audio'];
let titles = {};
let visitCount = null;
let currentRelease = null;
let updateStatusKey = '';
let clipboardState = null;
let currentPage = 'accueil';
let enabled = Boolean(musicUrl);
let volume = 0.25;
let interacted = false;
let state = 'idle';
let requestNumber = 0;
let storageAvailable = true;

try {
  const saved = JSON.parse(localStorage.getItem(preferenceKey) || 'null');
  if (saved && typeof saved.enabled === 'boolean') enabled = saved.enabled;
  if (saved && Number.isFinite(saved.volume) && saved.volume >= 0 && saved.volume <= 1) volume = saved.volume;
} catch { storageAvailable = false; }
music.volume = volume;
if (!musicUrl) enabled = false;

function savePreferences() {
  try { localStorage.setItem(preferenceKey, JSON.stringify({ enabled, volume })); storageAvailable = true; }
  catch { storageAvailable = false; }
  $('storage-note').textContent = storageAvailable
    ? t('stored') : t('notStored');
}

function updateAudio() {
  for (const id of ['music-enabled', 'volume-slider', 'audio-toggle']) $(id).disabled = !musicUrl;
  $('music-enabled').checked = enabled;
  $('enabled-description').textContent = t(enabled ? 'enabled' : 'disabled');
  $('music-enabled').setAttribute('aria-label', t('enableMusic'));
  $('volume-slider').value = String(Math.round(volume * 100));
  $('volume-slider').setAttribute('aria-valuetext', `${Math.round(volume * 100)} %`);
  $('volume-value').textContent = `${Math.round(volume * 100)} %`;
  $('audio-toggle').setAttribute('aria-pressed', String(enabled));
  $('audio-toggle').setAttribute('aria-label', t(enabled ? 'mute' : 'unmute'));
  $('audio-toggle-label').textContent = t(enabled ? 'soundOn' : 'soundOff');
  let status = !enabled ? t('soundOff') : volume === 0 ? t('zeroVolume') : t('firstClick');
  if (enabled && volume > 0 && interacted) {
    status = t({ playing: 'playing', loading: 'loading', blocked: 'blocked', error: 'musicError', idle: 'paused' }[state] || 'paused');
  }
  $('music-status').textContent = musicUrl ? status : t('noMusic');
  $('audio-error').hidden = !enabled || !['error', 'blocked'].includes(state);
  $('audio-error-message').textContent = state === 'blocked'
    ? t('waitInteraction') : t('loadFailed');
}

function stopMusic() {
  requestNumber++;
  music.pause();
  state = 'idle';
  updateAudio();
}

async function playMusic(reload = false) {
  if (!musicUrl || !enabled || !interacted || volume === 0) return updateAudio();
  const number = ++requestNumber;
  state = 'loading';
  updateAudio();
  try {
    if (reload) music.load();
    await music.play();
    if (number !== requestNumber) return;
    state = 'playing';
  } catch (error) {
    if (number !== requestNumber) return;
    state = error.name === 'NotAllowedError' ? 'blocked' : 'error';
  }
  updateAudio();
}

function setEnabled(value) {
  interacted = true;
  enabled = value;
  savePreferences();
  if (enabled) void playMusic(state === 'error');
  else stopMusic();
}

$('audio-toggle').addEventListener('click', () => setEnabled(!enabled));
$('music-enabled').addEventListener('change', (event) => setEnabled(event.target.checked));
$('volume-slider').addEventListener('input', (event) => {
  interacted = true;
  volume = Number(event.target.value) / 100;
  music.volume = volume;
  savePreferences();
  if (volume > 0 && enabled && music.paused) void playMusic();
  updateAudio();
});
$('retry-audio').addEventListener('click', () => {
  interacted = true;
  enabled = true;
  if (!volume) volume = 0.25;
  music.volume = volume;
  savePreferences();
  void playMusic(true);
});
music.addEventListener('playing', () => { state = 'playing'; updateAudio(); });
music.addEventListener('pause', () => { if (state === 'playing') state = 'idle'; updateAudio(); });
music.addEventListener('error', () => { state = 'error'; updateAudio(); });

function firstInteraction(event) {
  if (event.type === 'keydown' && !['Enter', ' '].includes(event.key)) return;
  if (event.ctrlKey || event.altKey || event.metaKey) return;
  interacted = true;
  document.removeEventListener('pointerdown', firstInteraction);
  document.removeEventListener('keydown', firstInteraction);
  if (!event.target.closest('[data-audio-control]')) void playMusic();
}
document.addEventListener('pointerdown', firstInteraction);
document.addEventListener('keydown', firstInteraction);

function navigate(focus = true) {
  const requested = location.hash.slice(1) || config.homePage || 'accueil';
  if (requested === 'contenu') { $('contenu').focus(); return; }
  const page = pages.includes(requested) ? requested : 'accueil';
  if (!pages.includes(requested)) history.replaceState(null, '', '#accueil');
  const previous = currentPage;
  currentPage = page;
  for (const id of pages) $(id).hidden = id !== page;
  $('back-button').hidden = page === 'accueil';
  $('home-indicator').hidden = page !== 'accueil';
  document.title = `${profileName} · ${titles[page]}`;
  if (focus) {
    const heading = $(page).querySelector('h2');
    const target = page === 'accueil' && previous !== 'accueil'
      ? document.querySelector(`.menu-button[href="#${previous}"]`) : heading;
    (target || heading).focus({ preventScroll: true });
    window.scrollTo({ top: 0, behavior: 'instant' });
  }
}
window.addEventListener('hashchange', () => navigate());
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && currentPage !== 'accueil') location.hash = 'accueil';
});

const profileImage = $('profile-image');
function imageError() {
  profileImage.hidden = true;
  document.querySelector('.image-error').hidden = false;
}
profileImage.addEventListener('error', imageError);
if (profileImage.complete && !profileImage.naturalWidth) imageError();

$('copy-discord').addEventListener('click', async () => {
  const link = discordUrl;
  if (!link) return;
  try {
    if (!navigator.clipboard) throw new Error('Clipboard unavailable');
    await navigator.clipboard.writeText(link);
    clipboardState = { key: 'copied' };
    $('clipboard-status').textContent = t('copied');
  } catch { clipboardState = { key: 'copyManually', values: { url: link } }; $('clipboard-status').textContent = t('copyManually', { url: link }); }
});

try {
  const previous = Number.parseInt(localStorage.getItem('trimViewCount') || '0', 10);
  let count = Number.isSafeInteger(previous) && previous >= 0 ? previous : 0;
  if (!localStorage.getItem('trimHasVisited')) {
    count++;
    localStorage.setItem('trimViewCount', String(count));
    localStorage.setItem('trimHasVisited', 'true');
  }
  visitCount = count;
} catch { visitCount = null; }

function applyLanguage() {
  document.documentElement.lang = language;
  profileName = config.name || t('defaultName');
  document.querySelectorAll('[data-i18n]').forEach(element => { element.textContent = t(element.dataset.i18n); });
  document.querySelectorAll('[data-profile-name]').forEach(element => { element.textContent = profileName; });
  const heading = $('site-title');
  if (config.title) heading.textContent = config.title;
  else {
    const [before, after] = (strings.settingsOf || "{name}'s Settings").split('{name}');
    const name = document.createElement('span'); name.dataset.profileName = 'true'; name.textContent = profileName;
    heading.replaceChildren(document.createTextNode(before), name, document.createTextNode(after || ''));
  }
  $('site-domain').textContent = config.domain || t('personalSite');
  $('language-select').value = language;
  titles = { accueil: t('home'), profil: config.sectionTitles.profil || t('profile'), reseaux: config.sectionTitles.reseaux || t('networks'), audio: config.sectionTitles.audio || t('audio') };
  for (const [id, key] of [['profil', 'profile-title'], ['reseaux', 'networks-title'], ['audio', 'audio-title']]) $(key).textContent = titles[id];
  const custom = renderPages(config, t, language, setIconImage);
  for (const [id, page] of custom) titles[id] = page.title;
  pages = ['accueil', ...['profil', 'reseaux', 'audio'].filter(id => config.sections[id] !== false), ...custom.keys()];
  const menu = document.querySelector('.menu-grid');
  menu.setAttribute('aria-label', t('categories'));
  const buttons = new Map([...menu.querySelectorAll('a')].map(button => [button.getAttribute('href').slice(1), button]));
  for (const [id, button] of buttons) {
    button.hidden = !pages.includes(id);
    const label = button.lastElementChild; label.textContent = titles[id];
    if (id === 'audio' && !config.sectionTitles.audio) {
      const [word, ...rest] = t('audio').split(' '); label.replaceChildren(document.createTextNode(word), document.createElement('br'), document.createTextNode(' ' + rest.join(' ')));
    }
  }
  for (const id of new Set([...config.menuOrder, ...buttons.keys()])) if (buttons.has(id)) menu.append(buttons.get(id));
  renderProfile(config, t, language); renderCredits(config, t);
  $('music-title').textContent = musicUrl ? config.musicTitle || t('personalMusic') : t('noMusic');
  $('audio-note').textContent = t(musicUrl ? 'startNote' : 'noMusicNote');
  $('links-note').textContent = t($('social-links').children.length ? 'externalLinks' : 'emptyLinks');
  $('visitor-count').textContent = visitCount === null ? t('counterUnavailable') : t('visits', { count: visitCount.toLocaleString(language) });
  $('profile-image').alt = `Avatar · ${profileName}`;
  if (!$('asset-status').hidden && !configurationError) $('asset-status').textContent = t('assetError');
  $('storage-note').textContent = t(storageAvailable ? 'stored' : 'notStored');
  if (currentRelease) $('update-version').textContent = t('version', { version: currentRelease.version });
  if (updateStatusKey) $('update-status').textContent = t(updateStatusKey);
  if (clipboardState) $('clipboard-status').textContent = t(clipboardState.key, clipboardState.values);
  updateAudio(); navigate(false);
}
$('language-select').addEventListener('change', async event => {
  const requested = event.target.value;
  try {
    const loaded = await loadDictionary(requested); language = loaded.language; strings = loaded.strings;
    try { localStorage.setItem('trimLanguage', language); } catch {}
    $('language-status').hidden = !loaded.fallback; applyLanguage();
    $('language-status').textContent = loaded.fallback ? t('translationUnavailable') : '';
  } catch { $('language-status').hidden = false; $('language-status').textContent = t('translationUnavailable'); }
});

async function checkUpdates(manual = false) {
  if (!config.updates.enabled) { $('check-updates').hidden = true; return; }
  const now = Date.now(); let cache;
  try { cache = JSON.parse(localStorage.getItem('trimUpdateCache') || 'null'); } catch {}
  const status = key => { updateStatusKey = key; $('update-status').textContent = t(key); };
  if (manual) { $('update-status').hidden = false; status('checkingUpdates'); }
  try {
    let release;
    if (cache?.nextCheck > now) { if (cache.error) { const error = new Error('Cached update failure.'); error.retryAt = cache.nextCheck; throw error; } release = cache.release; }
    else {
      release = await latestRelease();
      try { localStorage.setItem('trimUpdateCache', JSON.stringify({ nextCheck: now + Math.max(24, Number(config.updates.intervalHours) || 24) * 3600000, release })); } catch {}
    }
    const metadata = await fetch(new URL('./version.json', import.meta.url)).then(response => { if (!response.ok) throw new Error('Version unavailable.'); return response.json(); });
    if (release && compareVersions(release.version, metadata.version) > 0) {
      currentRelease = release; $('view-update').href = releaseUrl(release); $('update-version').textContent = t('version', { version: release.version });
      let dismissed; try { dismissed = localStorage.getItem('trimDismissedUpdate'); } catch {}
      $('update-notice').hidden = !manual && dismissed === release.version;
      if (manual) status('updateAvailable');
    } else if (manual) status(release ? 'upToDate' : 'noRelease');
  } catch (error) {
    try { localStorage.setItem('trimUpdateCache', JSON.stringify({ nextCheck: error.retryAt || now + 3600000, release: null, error: true })); } catch {}
    if (manual) status('updateError');
  }
}
$('check-updates').addEventListener('click', () => void checkUpdates(true));
$('dismiss-update').addEventListener('click', () => {
  $('update-notice').hidden = true;
  try { if (currentRelease) localStorage.setItem('trimDismissedUpdate', currentRelease.version); } catch {}
});

savePreferences();
applyLanguage();
if (configurationError) { $('asset-status').hidden = false; $('asset-status').textContent = t('configError'); }
if (locale.fallback) { $('language-status').hidden = false; $('language-status').textContent = t('translationUnavailable'); }
void checkUpdates();
if (config.updates.enabled) window.setInterval(() => void checkUpdates(), 3600000);
