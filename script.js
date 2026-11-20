// Copyright (C) 2026 Trim. GPLv3 and attribution: see LICENSE and NOTICE.
import { normalizeConfig, validateConfig, DEFAULT_ICONS } from './lib/config.mjs';
import { chooseLanguage, loadDictionary, format } from './lib/translations.mjs';
import { renderProfile, renderPages, renderCredits } from './lib/content.mjs';
import { loadPreferences, savePreferences as saveDisplayPreferences, applyPreferences } from './lib/preferences.mjs';
const $ = (id) => document.getElementById(id);
const music = $('music');
let preferences;
let configurationError = '';
let config;
try {
  const errors = validateConfig(window.PROFILE_CONFIG || {});
  if (errors.length) throw new Error(errors.join(' '));
  config = normalizeConfig(window.PROFILE_CONFIG || {});
} catch (error) { config = normalizeConfig(); configurationError = error.message; }
preferences = loadPreferences({ ...config.appearance, sounds:config.audioDefaults.sounds });
applyPreferences(preferences);
let savedLanguage;
try { savedLanguage = preferences.language || localStorage.getItem('trimLanguage'); } catch {}
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
let clipboardState = null;
let currentPage = 'accueil';
let enabled = Boolean(musicUrl) && config.audioDefaults.enabled;
let volume = config.audioDefaults.volume;
let interacted = false;
let state = 'idle';
let requestNumber = 0;
let storageAvailable = true;
let installedVersion = '';

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
  document.removeEventListener('click', firstInteraction);
  document.removeEventListener('keydown', firstInteraction);
  if (!event.target.closest('[data-audio-control]')) void playMusic();
}
document.addEventListener('click', firstInteraction);
document.addEventListener('keydown', firstInteraction);

function navigate(focus = true) {
  const hash = location.hash.slice(1);
  const requested = hash === 'parametres' ? 'audio' : hash || config.homePage || 'accueil';
  if (requested === 'contenu') { $('contenu').focus(); return; }
  const page = hash === 'parametres' ? 'audio' : pages.includes(requested) ? requested : 'accueil';
  if (hash !== 'parametres' && !pages.includes(requested)) history.replaceState(null, '', '#accueil');
  const previous = currentPage;
  currentPage = page;
  for (const id of new Set([...pages, 'audio'])) $(id).hidden = id !== page;
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

function updateVisitCount() {
visitCount = null;
if (window.SitePrivacy?.has('audience')) try {
  const previous = Number.parseInt(localStorage.getItem('trimViewCount') || '0', 10);
  let count = Number.isSafeInteger(previous) && previous >= 0 ? previous : 0;
  if (!localStorage.getItem('trimHasVisited')) {
    count++;
    localStorage.setItem('trimViewCount', String(count));
    localStorage.setItem('trimHasVisited', 'true');
  }
  visitCount = count;
} catch { visitCount = null; }
$('visitor-count').hidden = !window.SitePrivacy?.has('audience');
$('visitor-count').textContent = visitCount === null ? t('counterUnavailable') : t('visits', { count: visitCount.toLocaleString(language) });
}
updateVisitCount();
window.addEventListener('privacychange', updateVisitCount);

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
  titles = { accueil: t('home'), profil: config.sectionTitles.profil || t('profile'), reseaux: config.sectionTitles.reseaux || t('networks'), audio: config.sectionTitles.audio || t('settings') };
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
  $('settings-language').value = language;
  $('installed-version').textContent = installedVersion ? t('version', { version: installedVersion }) : t('versionLoading');
  if (clipboardState) $('clipboard-status').textContent = t(clipboardState.key, clipboardState.values);
  updateAudio(); navigate(false);
}
async function changeLanguage(event) {
  const requested = event.target.value;
  try {
    const loaded = await loadDictionary(requested); language = loaded.language; strings = loaded.strings;
    try { localStorage.setItem('trimLanguage', language); } catch {}
    preferences.language = language; saveDisplayPreferences(preferences);
    $('language-status').hidden = !loaded.fallback; applyLanguage();
    $('language-status').textContent = loaded.fallback ? t('translationUnavailable') : '';
  } catch { $('language-status').hidden = false; $('language-status').textContent = t('translationUnavailable'); }
}
$('language-select').addEventListener('change', changeLanguage);
$('settings-language').addEventListener('change', changeLanguage);

// The owner's custom palette is only offered when the owner chose it (and it is readable); otherwise the option stays hidden.
const customOption = document.querySelector('#theme-select option[value="custom"]');
if (preferences.theme === 'custom' || config.appearance.theme === 'custom') { customOption.hidden = false; customOption.disabled = false; }
for (const [id, field] of [['theme-select','theme'],['accent-select','accent'],['text-size-select','textSize'],['animations-enabled','animations'],['readable-enabled','readable'],['interface-sounds','sounds']]) {
  const control = $(id);
  if (control.type === 'checkbox') control.checked = preferences[field]; else control.value = preferences[field];
  control.addEventListener('change', () => {
    preferences[field] = control.type === 'checkbox' ? control.checked : control.value;
    storageAvailable = saveDisplayPreferences(preferences);
    applyPreferences(preferences);
    $('storage-note').textContent = t(storageAvailable ? 'stored' : 'notStored');
  });
}
let interfaceAudio;
document.addEventListener('click', event => {
  if (!preferences.sounds || !event.target.closest('.menu-button,.back-button,.small-button')) return;
  try {
    interfaceAudio ||= new AudioContext();
    void interfaceAudio.resume().catch(() => {});
    const tone = interfaceAudio.createOscillator(), gain = interfaceAudio.createGain();
    tone.frequency.value = 920; gain.gain.setValueAtTime(.018, interfaceAudio.currentTime);
    gain.gain.exponentialRampToValueAtTime(.001, interfaceAudio.currentTime + .055);
    tone.connect(gain); gain.connect(interfaceAudio.destination);
    tone.onended = () => { tone.disconnect(); gain.disconnect(); };
    tone.start(); tone.stop(interfaceAudio.currentTime + .06);
  } catch {}
});
window.addEventListener('pagehide', () => { music.pause(); });
window.addEventListener('pageshow', event => { if (event.persisted && enabled && interacted) void playMusic(); });
void fetch(new URL('./version.json', import.meta.url)).then(response => {
  if (!response.ok) throw new Error('Version unavailable'); return response.json();
}).then(metadata => { installedVersion = metadata.version; $('installed-version').textContent = t('version', { version: installedVersion }); })
  .catch(() => { $('installed-version').textContent = t('versionUnavailable'); });

savePreferences();
applyLanguage();
if (configurationError) { $('asset-status').hidden = false; $('asset-status').textContent = t('configError'); }
if (locale.fallback) { $('language-status').hidden = false; $('language-status').textContent = t('translationUnavailable'); }
