// Copyright (C) 2026 Trim. GPLv3 and attribution: see LICENSE and NOTICE.
const $ = (id) => document.getElementById(id);
const music = $('music');
const config = window.PROFILE_CONFIG || {};
const profileName = String(config.name || 'Votre pseudo');
function safeUrl(value) {
  if (typeof value !== 'string' || !value.trim()) return '';
  try {
    const url = new URL(value, location.href);
    return ['http:', 'https:'].includes(url.protocol) ? url.href : '';
  } catch { return ''; }
}
document.querySelectorAll('[data-profile-name]').forEach((element) => { element.textContent = profileName; });
const defaultIcons = { settings: 'assets/settings.svg', profile: 'assets/profile.svg', network: 'assets/network.svg', audio: 'assets/audio.svg' };
const icons = config.icons && typeof config.icons === 'object' ? config.icons : {};
const favicon = document.querySelector('link[rel="icon"]');
function setIconImage(image, source, fallback) {
  const fallbackUrl = safeUrl(fallback);
  image.addEventListener('error', () => {
    $('asset-status').hidden = false;
    $('asset-status').textContent = 'Une icône n’a pas pu être chargée. L’icône par défaut est utilisée si elle est disponible.';
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
$('site-domain').textContent = String(config.domain || 'Site personnel');
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
  if (presetId !== 'network' || !safeUrl(link.icon)) {
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
const pages = ['accueil', 'profil', 'reseaux', 'audio'];
const titles = { accueil: 'Menu principal', profil: 'Profil', reseaux: 'Réseaux', audio: 'Réglages audio' };
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
    ? 'Tes réglages sont enregistrés sur cet appareil.'
    : 'Le stockage du navigateur est indisponible. Les réglages restent actifs pour cette visite.';
}

function updateAudio() {
  for (const id of ['music-enabled', 'volume-slider', 'audio-toggle']) $(id).disabled = !musicUrl;
  $('music-enabled').checked = enabled;
  $('enabled-description').textContent = enabled ? 'Activée' : 'Désactivée';
  $('volume-slider').value = String(Math.round(volume * 100));
  $('volume-slider').setAttribute('aria-valuetext', `${Math.round(volume * 100)} %`);
  $('volume-value').textContent = `${Math.round(volume * 100)} %`;
  $('audio-toggle').setAttribute('aria-pressed', String(enabled));
  $('audio-toggle').setAttribute('aria-label', enabled ? 'Désactiver la musique' : 'Activer la musique');
  $('audio-toggle-label').textContent = enabled ? 'Son activé' : 'Son désactivé';
  let status = !enabled ? 'Musique désactivée' : volume === 0 ? 'Volume à zéro' : 'Musique au premier clic';
  if (enabled && volume > 0 && interacted) {
    status = state === 'playing' ? 'Musique en lecture' : state === 'loading' ? 'Chargement de la musique…'
      : state === 'blocked' ? 'Appuie sur le bouton Son pour démarrer.' : state === 'error' ? 'Musique indisponible' : 'Musique en pause';
  }
  $('music-status').textContent = musicUrl ? status : 'Aucune musique configurée';
  $('audio-error').hidden = !enabled || !['error', 'blocked'].includes(state);
  $('audio-error-message').textContent = state === 'blocked'
    ? 'Le navigateur attend une interaction pour lire la musique. Appuie sur Réessayer.'
    : 'La musique n’a pas pu être chargée. Vérifie ta connexion, puis réessaie.';
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
  const requested = location.hash.slice(1) || 'accueil';
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
    target.focus({ preventScroll: true });
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
    $('clipboard-status').textContent = 'Lien du serveur Discord copié.';
  } catch { $('clipboard-status').textContent = `Lien à copier : ${link}`; }
});

try {
  const previous = Number.parseInt(localStorage.getItem('trimViewCount') || '0', 10);
  let count = Number.isSafeInteger(previous) && previous >= 0 ? previous : 0;
  if (!localStorage.getItem('trimHasVisited')) {
    count++;
    localStorage.setItem('trimViewCount', String(count));
    localStorage.setItem('trimHasVisited', 'true');
  }
  $('visitor-count').textContent = `${count.toLocaleString('fr-FR')} visite${count > 1 ? 's' : ''} enregistrée${count > 1 ? 's' : ''} sur ce navigateur.`;
} catch { $('visitor-count').textContent = 'Compteur local indisponible.'; }

savePreferences();
updateAudio();
navigate(false);
