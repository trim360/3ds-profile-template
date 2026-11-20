import { THEMES, OPTIONS, SKINNED_THEMES, customVariables, normalizeCustom, customProblems, choose } from './theme.mjs';
const key = new URL(import.meta.url).pathname.includes('/demo/') ? 'showcase3dsPreferences' : 'threeDsPreferences';
export const defaults = { theme: 'classic', accent: 'orange', animations: true, readable: false, sounds: false, language: '', textSize: 'normal' };
// What visitors may change and keep in their own browser. Everything else (shape, spacing, layout, panel style, decorations,
// custom palette, motion intensity) is chosen by the site owner and always comes from the site configuration.
const STORED = ['theme', 'accent', 'animations', 'readable', 'sounds', 'language', 'textSize'];
const customAvailable = initial => initial.theme === 'custom' && customProblems(initial.custom).length === 0;
export function loadPreferences(initial = {}) {
  let saved;
  try { saved = JSON.parse(localStorage.getItem(key) || 'null'); } catch {}
  const value = { ...defaults, ...initial };
  for (const field of ['animations', 'readable', 'sounds']) if (typeof saved?.[field] === 'boolean') value[field] = saved[field];
  if (THEMES.includes(saved?.theme) && (saved.theme !== 'custom' || customAvailable(initial))) value.theme = saved.theme;
  if (OPTIONS.accent.includes(saved?.accent)) value.accent = saved.accent;
  if (OPTIONS.textSize.includes(saved?.textSize)) value.textSize = saved.textSize;
  if (['fr', 'en'].includes(saved?.language)) value.language = saved.language;
  return value;
}
export function savePreferences(value) {
  const stored = Object.fromEntries(STORED.filter(field => field in value).map(field => [field, value[field]]));
  try { localStorage.setItem(key, JSON.stringify(stored)); return true; } catch { return false; }
}
export function applyPreferences(value) {
  const root = document.documentElement;
  const custom = normalizeCustom(value.custom), usable = value.theme !== 'custom' || customProblems(custom).length === 0;
  const theme = usable ? choose(value.theme, THEMES, 'classic') : 'classic';
  root.dataset.theme = theme;
  root.dataset.skin = SKINNED_THEMES.includes(theme) ? 'themed' : 'native';
  root.dataset.accent = value.accent;
  root.dataset.readable = String(value.readable);
  root.dataset.animations = String(value.animations);
  root.dataset.text = choose(value.textSize, OPTIONS.textSize, 'normal');
  root.dataset.motion = choose(value.motion, OPTIONS.motion, 'full');
  for (const name of ['shape', 'spacing', 'layout', 'panel']) root.dataset[name] = choose(value[name], OPTIONS[name], OPTIONS[name][name === 'spacing' ? 1 : 0]);
  root.dataset.decorations = String(value.decorations !== false);
  const variables = theme === 'custom' ? customVariables(custom) : {};
  for (const name of Object.keys(customVariables(custom))) { if (name in variables) root.style.setProperty(name, variables[name]); else root.style.removeProperty(name); }
}
