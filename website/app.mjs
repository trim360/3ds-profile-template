import { site, links, screenshots, chooseLanguage } from './config.mjs';

const $ = id => document.getElementById(id);
const english = JSON.parse($('messages').textContent);
const dictionaries = new Map([['en', english]]);
let language = 'en', messages = english, tour = 'profile', operatingSystem = 'windows', viewerIndex = 0, opener, copyState = '';
const commands = { windows: '.\\setup.bat', linux: 'bash setup.sh' };
const t = (key, values = {}) => String(messages[key] ?? english[key] ?? key).replace(/\{(\w+)\}/g, (_, name) => String(values[name] ?? ''));
for (const anchor of document.querySelectorAll('[data-link]')) anchor.href = links[anchor.dataset.link];
$('creator-link').textContent = site.creator.name; $('creator-link').href = site.creator.url;
const community = $('community-list'); community.replaceChildren();
for (const member of site.community) {
  const article = document.createElement('article'), heading = document.createElement('h3'), anchor = document.createElement('a'), paragraph = document.createElement('p');
  anchor.textContent = member.name; anchor.href = member.url; heading.append(anchor); paragraph.dataset.i18n = member.credit;
  article.append(heading, paragraph); community.append(article);
}
function selectTab(group, attribute, value) {
  for (const button of group.querySelectorAll('[role=tab]')) {
    const selected = button.dataset[attribute] === value;
    button.setAttribute('aria-selected', String(selected)); button.tabIndex = selected ? 0 : -1;
  }
}
function renderTour() {
  selectTab($('tour-tabs'), 'tour', tour);
  $('tour-panel').setAttribute('aria-labelledby', 'tour-' + tour);
  $('tour-title').textContent = t(`tour.${tour}.title`); $('tour-description').textContent = t(`tour.${tour}.description`);
  $('tour-image').src = screenshots.find(shot => shot.id === tour).src;
  $('tour-image').alt = t(`shot.${tour}.alt`);
  $('tour-image-button').dataset.shot = tour;
  $('tour-image-button').setAttribute('aria-label', t('openShot', { title: t(`shot.${tour}.title`) }));
  $('tour-points').replaceChildren(...[1, 2, 3].map(index => { const li = document.createElement('li'); li.textContent = t(`tour.${tour}.point${index}`); return li; }));
}
function renderInstallation() {
  selectTab($('os-tabs'), 'os', operatingSystem);
  $('install-panel').setAttribute('aria-labelledby', 'os-' + operatingSystem);
  for (const li of document.querySelectorAll('[data-install-step]')) li.textContent = t(operatingSystem + 'Step' + li.dataset.installStep);
  $('install-command').textContent = commands[operatingSystem];
  $('copy-status').textContent = copyState ? t(copyState, { command: commands[operatingSystem] }) : '';
}
function renderViewer(load = true) {
  const shot = screenshots[viewerIndex];
  $('viewer-caption').textContent = `${viewerIndex + 1} / ${screenshots.length} · ${t(`shot.${shot.id}.title`)}`;
  $('viewer-image').alt = t(`shot.${shot.id}.alt`);
  if (load) {
    $('viewer-image').hidden = false; $('viewer-status').textContent = t('imageLoading');
    $('viewer-image').src = shot.src;
  }
}
function applyLanguage() {
  document.documentElement.lang = language; document.title = t('pageTitle'); $('language').value = language;
  for (const node of document.querySelectorAll('[data-i18n]')) node.textContent = t(node.dataset.i18n);
  for (const image of document.querySelectorAll('[data-alt]')) image.alt = t(image.dataset.alt);
  for (const button of document.querySelectorAll('[data-shot]')) button.setAttribute('aria-label', t('openShot', { title: t(`shot.${button.dataset.shot}.title`) }));
  for (const selector of ['meta[name=description]', 'meta[property="og:description"]', 'meta[name="twitter:description"]']) document.querySelector(selector).content = t('metaDescription');
  for (const selector of ['meta[property="og:title"]', 'meta[name="twitter:title"]']) document.querySelector(selector).content = t('pageTitle');
  document.querySelector('meta[property="og:image:alt"]').content = t('shot.home.alt');
  document.querySelector('meta[name="twitter:image:alt"]').content = t('shot.home.alt');
  $('navigation').setAttribute('aria-label', t('navLabel')); $('tour-tabs').setAttribute('aria-label', t('tourLabel')); $('os-tabs').setAttribute('aria-label', t('osLabel'));
  $('footer-nav').setAttribute('aria-label', site.name);
  document.querySelector('.source-links').setAttribute('aria-label', t('sourceLinksLabel'));
  document.querySelector('.download').textContent = t('download', { version: site.version });
  renderTour(); renderInstallation(); if ($('viewer').open) renderViewer(false);
}
async function setLanguage(value) {
  $('language-status').hidden = true;
  try {
    if (!dictionaries.has(value)) {
      const response = await fetch(new URL(`./locales/${value}.json`, import.meta.url)); if (!response.ok) throw new Error('Dictionary unavailable');
      const dictionary = await response.json();
      if (Object.keys(english).some(key => typeof dictionary[key] !== 'string')) throw new Error('Incomplete dictionary');
      dictionaries.set(value, dictionary);
    }
    language = value; messages = dictionaries.get(value);
    try { localStorage.setItem('showcaseLanguage', value); } catch {}
  } catch {
    language = 'en'; messages = english; $('language-status').textContent = english.translationError; $('language-status').hidden = false;
  }
  applyLanguage();
}
$('language').addEventListener('change', event => void setLanguage(event.target.value));
function menu(open, focus = false) {
  $('navigation').classList.toggle('is-open', open); $('menu-toggle').setAttribute('aria-expanded', String(open));
  if (focus) $('menu-toggle').focus();
}
$('menu-toggle').addEventListener('click', () => menu($('menu-toggle').getAttribute('aria-expanded') !== 'true'));
$('navigation').addEventListener('click', event => { if (event.target.closest('a')) menu(false); });
function tabs(group, attribute, select) {
  const buttons = [...group.querySelectorAll('[role=tab]')];
  group.addEventListener('click', event => { const button = event.target.closest('[role=tab]'); if (button) select(button.dataset[attribute]); });
  group.addEventListener('keydown', event => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    const index = buttons.indexOf(document.activeElement); if (index < 0) return;
    event.preventDefault();
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length - 1 : (index + (event.key === 'ArrowRight' ? 1 : -1) + buttons.length) % buttons.length;
    select(buttons[next].dataset[attribute]); buttons[next].focus();
  });
}
tabs($('tour-tabs'), 'tour', value => { tour = value; renderTour(); });
tabs($('os-tabs'), 'os', value => { operatingSystem = value; copyState = ''; renderInstallation(); });
$('copy-command').addEventListener('click', async () => {
  try { await navigator.clipboard.writeText(commands[operatingSystem]); copyState = 'copied'; }
  catch { copyState = 'copyManual'; }
  renderInstallation();
});
document.addEventListener('click', event => {
  const button = event.target.closest('[data-shot]'); if (!button) return;
  viewerIndex = screenshots.findIndex(shot => shot.id === button.dataset.shot); if (viewerIndex < 0) return;
  opener = button; renderViewer(); $('viewer').showModal();
});
$('close-viewer').addEventListener('click', () => $('viewer').close());
$('viewer').addEventListener('click', event => { if (event.target === $('viewer')) $('viewer').close(); });
$('viewer').addEventListener('close', () => opener?.focus({ preventScroll: true }));
$('viewer-image').addEventListener('load', () => { $('viewer-status').textContent = ''; });
$('viewer-image').addEventListener('error', () => { $('viewer-image').hidden = true; $('viewer-status').textContent = t('imageError'); });
function moveScreenshot(direction) { viewerIndex = (viewerIndex + direction + screenshots.length) % screenshots.length; renderViewer(); }
$('previous-shot').addEventListener('click', () => moveScreenshot(-1)); $('next-shot').addEventListener('click', () => moveScreenshot(1));
document.addEventListener('keydown', event => {
  if ($('viewer').open && ['ArrowLeft', 'ArrowRight'].includes(event.key)) { event.preventDefault(); moveScreenshot(event.key === 'ArrowRight' ? 1 : -1); }
  else if (event.key === 'Escape' && $('menu-toggle').getAttribute('aria-expanded') === 'true') menu(false, true);
});
for (const image of document.querySelectorAll('img:not(#viewer-image)')) image.addEventListener('error', () => {
  if (image.nextElementSibling?.classList.contains('image-failed')) return;
  const notice = document.createElement('p'); notice.className = 'image-failed'; notice.dataset.i18n = 'imageError'; notice.textContent = t('imageError'); image.after(notice);
});
if ('IntersectionObserver' in window && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
  document.documentElement.classList.add('motion-ready');
  const observer = new IntersectionObserver(entries => { for (const entry of entries) if (entry.isIntersecting) { entry.target.classList.add('is-visible'); observer.unobserve(entry.target); } }, { threshold: .1 });
  document.querySelectorAll('[data-reveal]').forEach(node => observer.observe(node));
}
let saved; try { saved = localStorage.getItem('showcaseLanguage'); } catch {}
await setLanguage(chooseLanguage(navigator.languages || [navigator.language], saved));
