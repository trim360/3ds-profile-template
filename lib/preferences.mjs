const key = new URL(import.meta.url).pathname.includes('/demo/') ? 'showcase3dsPreferences' : 'threeDsPreferences';
export const defaults = { theme: 'classic', accent: 'orange', animations: true, readable: false, sounds: false, language: '' };
export function loadPreferences(initial = {}) {
  let saved;
  try { saved = JSON.parse(localStorage.getItem(key) || 'null'); } catch {}
  const value = { ...defaults, ...initial };
  for (const field of ['animations', 'readable', 'sounds']) if (typeof saved?.[field] === 'boolean') value[field] = saved[field];
  if (['classic', 'light', 'night'].includes(saved?.theme)) value.theme = saved.theme;
  if (['orange', 'red', 'blue'].includes(saved?.accent)) value.accent = saved.accent;
  if (['fr', 'en'].includes(saved?.language)) value.language = saved.language;
  return value;
}
export function savePreferences(value) {
  try { localStorage.setItem(key, JSON.stringify(value)); return true; } catch { return false; }
}
export function applyPreferences(value) {
  const root = document.documentElement;
  root.dataset.theme = value.theme;
  root.dataset.accent = value.accent;
  root.dataset.readable = String(value.readable);
  root.dataset.animations = String(value.animations);
}
