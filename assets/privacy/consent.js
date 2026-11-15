(() => {
  'use strict';
  const config = window.PrivacyConfig;
  if (!config || window.SitePrivacy) return;
  const base = new URL('.', document.currentScript.src);
  const purposes = config.purposes || [];
  const key = 'site-consent.v1';
  const version = config.version;
  let choice, banner, dialog, footer, previousFocus, storageAvailable = true;
  const media = new Set();
  const images = new Set();

  function load() {
    try {
      const saved = JSON.parse(localStorage.getItem(key) || 'null');
      if (saved?.version === version && Number.isFinite(saved.expires) && saved.expires > Date.now() && saved.expires <= Date.now() + 185 * 86400000 && purposes.every(p => typeof saved.allowed?.[p.id] === 'boolean')) return saved;
      if (saved) localStorage.removeItem(key);
    } catch { storageAvailable = false; }
    return null;
  }
  function has(id) { return Boolean(choice && choice.expires > Date.now() && choice.allowed[id] === true); }
  function cleanup() {
    for (const purpose of purposes) if (!has(purpose.id)) {
      for (const name of purpose.keys || []) try { localStorage.removeItem(name); } catch {}
    }
  }
  function node(tag, text, className) {
    const element = document.createElement(tag);
    if (text) element.textContent = text;
    if (className) element.className = className;
    return element;
  }
  function button(text, action) {
    const element = node('button', text, 'privacy-button');
    element.type = 'button'; element.addEventListener('click', action); return element;
  }
  function all(allowed) { save(Object.fromEntries(purposes.map(p => [p.id, allowed]))); }
  function update() {
    cleanup();
    for (const record of media) updateMedia(record);
    for (const record of images) updateImage(record);
    if (banner) banner.hidden = Boolean(choice) || !shouldPrompt();
    if (footer) footer.querySelector('[data-withdraw]').hidden = !purposes.some(p => has(p.id));
    window.dispatchEvent(new CustomEvent('privacychange'));
  }
  function save(allowed) {
    const now = new Date(), expires = new Date(now); expires.setUTCMonth(expires.getUTCMonth() + 6);
    choice = { version, decided: now.getTime(), expires: expires.getTime(), allowed: Object.fromEntries(purposes.map(p => [p.id, allowed[p.id] === true])) };
    try { localStorage.setItem(key, JSON.stringify(choice)); } catch { storageAvailable = false; }
    if (dialog?.open) dialog.close();
    update();
    if (!storageAvailable) {
      const status = document.getElementById('privacy-status');
      if (status) status.textContent = 'Choix valable pour cette visite ; le stockage du navigateur est indisponible.';
    }
  }
  function shouldPrompt() { return purposes.length > 0 && (!config.promptPath || location.pathname.startsWith(config.promptPath)); }
  function open() {
    if (!dialog) return;
    previousFocus = document.activeElement;
    for (const input of dialog.querySelectorAll('input[data-purpose]')) input.checked = has(input.dataset.purpose);
    if (!dialog.open) dialog.showModal();
  }
  function actions() {
    const row = node('div', '', 'privacy-actions');
    row.append(button('Tout accepter', () => all(true)), button('Tout refuser', () => all(false)), button('Personnaliser', open));
    return row;
  }
  function setup() {
    const policy = node('a', 'Cookies et stockages'); policy.href = new URL('cookies.html', base).href;
    footer = node('footer', '', 'privacy-footer');
    footer.append(policy, button('Gérer mes choix', open));
    const withdraw = button('Retirer mon consentement', () => all(false)); withdraw.dataset.withdraw = '';
    footer.append(withdraw);
    const target = document.querySelector(config.footerTarget || '.site-shell') || document.body;
    target.append(footer);
    const status = node('p', '', 'privacy-status'); status.id = 'privacy-status'; status.setAttribute('role', 'status'); footer.append(status);
    if (!purposes.length) { footer.querySelectorAll('button').forEach(e => e.remove()); return; }

    banner = node('section', '', 'privacy-banner privacy-surface'); banner.setAttribute('aria-label', 'Vos choix de confidentialité');
    banner.append(node('h2', 'Vos choix, sans obligation'), node('p', config.summary), actions());
    const information = policy.cloneNode(true); banner.append(information); document.body.append(banner);

    dialog = node('dialog', '', 'privacy-dialog privacy-surface'); dialog.setAttribute('aria-labelledby', 'privacy-title');
    const heading = node('h2', 'Personnaliser mes choix'); heading.id = 'privacy-title'; dialog.append(heading);
    dialog.append(node('p', 'Les stockages techniques nécessaires restent actifs. Chaque option ci-dessous est facultative. Le refus et l’acceptation sont conservés pendant six mois.'));
    const form = node('form');
    for (const purpose of purposes) {
      const label = node('label', '', 'privacy-option'), input = node('input'); input.type = 'checkbox'; input.dataset.purpose = purpose.id;
      const text = node('span'); text.append(node('strong', purpose.title), node('span', purpose.description)); label.append(input, text); form.append(label);
    }
    form.append(button('Enregistrer mes choix', () => save(Object.fromEntries([...form.querySelectorAll('input')].map(input => [input.dataset.purpose, input.checked])))));
    dialog.append(form, actions(), button('Fermer sans changer', () => dialog.close()));
    dialog.addEventListener('close', () => { if (previousFocus?.isConnected) previousFocus.focus(); });
    document.body.append(dialog); update();
  }
  function updateMedia(record) {
    const { element, url, placeholder } = record;
    if (!element.isConnected) { media.delete(record); return; }
    const allowed = has('videos');
    if (allowed && element.getAttribute('src') !== url) element.setAttribute('src', url);
    else if (!allowed && element.hasAttribute('src')) {
      if (typeof element.pause === 'function') element.pause();
      element.removeAttribute('src');
      if (typeof element.load === 'function') element.load();
    }
    element.hidden = !allowed; placeholder.hidden = allowed;
  }
  function mountMedia(element, source) {
    const url = new URL(source, location.href);
    if (!['https:', 'http:'].includes(url.protocol)) return;
    if (url.origin === location.origin) { element.src = url.href; element.hidden = false; return; }
    const placeholder = node('section', '', 'privacy-media privacy-surface');
    placeholder.append(node('p', `Le lecteur ${url.hostname} reste bloqué sans votre accord pour les vidéos tierces.`), button('Choisir pour les vidéos', open));
    element.before(placeholder);
    const record = { element, url: url.href, placeholder }; media.add(record); updateMedia(record);
  }
  function updateImage(record) {
    if (!record.element.isConnected) { images.delete(record); return; }
    const allowed = record.url.origin === location.origin || has('videos');
    if (allowed) record.element.src = record.url.href;
    else record.element.removeAttribute('src');
    record.element.hidden = !allowed;
  }
  function mountImages(parent) {
    for (const element of parent.querySelectorAll('img[data-privacy-src]')) {
      try {
        const url = new URL(element.dataset.privacySrc, location.href);
        if (!['https:','http:'].includes(url.protocol)) continue;
        const record = { element, url }; images.add(record); updateImage(record);
      } catch {}
    }
  }
  choice = purposes.length ? load() : null;
  cleanup();
  window.SitePrivacy = Object.freeze({ has, open, mountMedia, mountImages });
  window.addEventListener('storage', event => { if (event.key === key || event.key === null) { choice = load(); update(); } });
  function expire() { if (choice && choice.expires <= Date.now()) { choice = null; try { localStorage.removeItem(key); } catch {} update(); } }
  window.addEventListener('focus', expire);
  window.setInterval(expire, 60000);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', setup, { once: true }); else setup();
})();
