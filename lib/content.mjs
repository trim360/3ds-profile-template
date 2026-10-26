import { safeUrl, localizedContent, DEFAULT_ICONS } from './config.mjs';

function node(tag, text = '', className = '') {
  const element = document.createElement(tag); element.textContent = String(text || '');
  if (className) element.className = className; return element;
}
function anchor(text, url) {
  const element = node('a', text); element.href = safeUrl(url, location.href); element.target = '_blank'; element.rel = 'noopener noreferrer'; return element;
}
function section(parent, title, text) {
  if (!text) return;
  const block = node('section', '', 'content-section'); block.append(node('h3', title), node('p', text)); parent.append(block);
}
function gallery(parent, items, t) {
  if (!items?.length) return;
  const grid = node('div', '', 'content-gallery');
  for (const item of items) {
    const url = safeUrl(item?.src, location.href); if (!url) continue;
    const figure = node('figure'); const image = node('img'); image.src = url; image.alt = String(item.caption || ''); image.loading = 'lazy';
    image.addEventListener('error', () => { image.hidden = true; figure.append(node('p', t('imageError'))); }, { once: true });
    figure.append(image);
    if (item.caption) figure.append(node('figcaption', item.caption));
    if (item.credit) figure.append(node('p', t('artistCredit', { name: item.credit }), 'field-label'));
    grid.append(figure);
  }
  parent.append(grid);
}
function projectList(parent, projects, t) {
  if (!projects?.length) return;
  const block = node('section', '', 'content-section'); block.append(node('h3', t('projects')));
  const list = node('ul', '', 'content-list');
  for (const project of projects) {
    if (!project?.title) continue;
    const item = node('li');
    item.append(safeUrl(project.url, location.href) ? anchor(project.title, project.url) : node('h4', project.title));
    if (project.description) item.append(node('p', project.description));
    if (project.image) gallery(item, [{ src: project.image, credit: project.credit }], t);
    list.append(item);
  }
  block.append(list); parent.append(block);
}
export function renderProfile(config, t, language) {
  const extra = document.getElementById('profile-extra'); extra.replaceChildren();
  const pronouns = document.getElementById('profile-pronouns'); pronouns.textContent = config.pronouns; pronouns.hidden = !config.pronouns;
  const cover = document.getElementById('profile-cover'); cover.hidden = !safeUrl(config.cover, location.href);
  if (!cover.hidden) { cover.src = safeUrl(config.cover, location.href); cover.onerror = () => { cover.hidden = true; }; }
  section(extra, t('about'), localizedContent(config, 'about', language, config.about));
  section(extra, t('biography'), localizedContent(config, 'bio', language, config.bio));
  if (config.interests.length) section(extra, t('interests'), config.interests.join(' · '));
  projectList(extra, config.projects, t); gallery(extra, config.gallery, t);
  if (safeUrl(config.website, location.href)) { const p = node('p'); const link = anchor(t('website'), config.website); link.className = 'small-button'; p.append(link); extra.append(p); }
  const pages = config.pages.filter(page => page.visible !== false);
  if (pages.length) {
    const navigation = node('nav', '', 'page-links');
    for (const page of pages) { const link = node('a', page.title || t(page.type)); link.href = `#${page.id}`; link.className = 'small-button'; navigation.append(link); }
    extra.append(navigation);
  }
  extra.hidden = !extra.children.length;
  document.getElementById('view-networks').hidden = config.sections.reseaux === false;
}
export function renderPages(config, t, language, setIconImage) {
  document.querySelectorAll('[data-custom-page], [data-custom-menu]').forEach(element => element.remove());
  const result = new Map(); const main = document.getElementById('contenu'); const menu = document.querySelector('.menu-grid');
  for (const page of config.pages.filter(item => item.visible !== false)) {
    const title = page.title || t(page.type); const element = node('section', '', 'page');
    element.id = page.id; element.hidden = true; element.dataset.customPage = 'true'; element.setAttribute('aria-labelledby', `title-${page.id}`);
    const heading = node('div', '', 'page-heading'); const h2 = node('h2', title); h2.id = `title-${page.id}`; h2.tabIndex = -1; heading.append(h2); element.append(heading);
    const content = node('div', '', 'custom-content');
    const text = localizedContent(config, `page.${page.id}`, language, page.content);
    if (text) content.append(node('p', text));
    if (page.traits?.length) {
      const traits = node('dl', '', 'character-traits');
      for (const item of page.traits) if (item.label && item.value) traits.append(node('dt', item.label), node('dd', item.value));
      content.append(traits);
    }
    gallery(content, page.images, t);
    if (page.type === 'projects') projectList(content, page.projects || config.projects, t);
    for (const item of page.links || []) if (safeUrl(item.url, location.href)) { const p = node('p'); p.append(anchor(item.name || item.url, item.url)); content.append(p); }
    element.append(content); main.append(element);
    const button = node('a', '', 'menu-button'); button.href = `#${page.id}`; button.dataset.customMenu = 'true';
    const plate = node('span', '', 'menu-icon-plate'); plate.setAttribute('aria-hidden', 'true');
    const image = node('img', '', 'menu-icon'); image.alt = ''; image.width = 48; image.height = 48; setIconImage(image, page.icon, 'assets/network.svg');
    plate.append(image); button.append(plate, node('span', title)); menu.append(button); result.set(page.id, { title, element, button });
  }
  return result;
}
export function renderCredits(config, t) {
  const target = document.getElementById('custom-credits'); target.replaceChildren();
  const nintendoIcons = config.icons.settings === DEFAULT_ICONS.settings || config.icons.profile === DEFAULT_ICONS.profile;
  if (nintendoIcons) target.append(node('p', t('nintendoAssets')));
  if (config.music) {
    const credit = config.musicCredit;
    if (credit.owner === 'nintendo') { target.append(node('p', t('nintendoCredit', { title: config.musicTitle })), node('p', t('unofficial'))); }
    else if (credit.owner === 'other') target.append(node('p', t('otherMusicCredit', { title: config.musicTitle, artist: credit.artist })));
    else target.append(node('p', t('unknownMusic')));
    if (safeUrl(credit.source, location.href)) { const p = node('p'); p.append(anchor(credit.source, credit.source)); target.append(p); }
  }
  if (nintendoIcons && config.musicCredit.owner !== 'nintendo') target.append(node('p', t('unofficial')));
  for (const credit of config.credits) {
    if (!credit?.name) continue;
    const p = node('p'); p.append(safeUrl(credit.url, location.href) ? anchor(credit.name, credit.url) : node('span', credit.name));
    if (credit.role) p.append(document.createTextNode(` · ${credit.role}`)); target.append(p);
  }
}
