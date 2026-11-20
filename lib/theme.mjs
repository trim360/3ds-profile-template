// Appearance options shared by the public page, the owner dashboard and configuration validation.
// Pure functions only: no DOM, no storage. Themes are original CSS palettes; no Nintendo artwork is used.
export const THEMES = ['classic', 'light', 'night', 'dsi', 'eshop', 'network', 'custom'];
export const BUILTIN_THEMES = THEMES.filter(theme => theme !== 'custom');
export const SKINNED_THEMES = ['dsi', 'eshop', 'network', 'custom'];
export const OPTIONS = {
  accent: ['orange', 'red', 'blue'],
  textSize: ['small', 'normal', 'large', 'xlarge'],
  motion: ['full', 'soft'],
  shape: ['soft', 'square', 'round'],
  spacing: ['compact', 'normal', 'roomy'],
  layout: ['grid', 'list', 'compact'],
  panel: ['raised', 'flat', 'outlined'],
};
export const DEFAULT_CUSTOM = { primary: '#a76923', secondary: '#357f94', button: '#f4f1de', background: '#e4e1c8', border: '#8c907b', selection: '#d6e9ee', text: '#2f3029', window: '#f6f3dd' };
export const CUSTOM_KEYS = Object.keys(DEFAULT_CUSTOM);
const HEX = /^#[0-9a-f]{6}$/i;
export const isHexColor = value => typeof value === 'string' && HEX.test(value);

function channel(value) { const unit = value / 255; return unit <= 0.04045 ? unit / 12.92 : ((unit + 0.055) / 1.055) ** 2.4; }
export function luminance(hex) {
  const number = parseInt(hex.slice(1), 16);
  return 0.2126 * channel(number >> 16 & 255) + 0.7152 * channel(number >> 8 & 255) + 0.0722 * channel(number & 255);
}
// WCAG 2.x contrast ratio between two #rrggbb colours (1 to 21).
export function contrastRatio(first, second) {
  const [light, dark] = [luminance(first), luminance(second)].sort((a, b) => b - a);
  return (light + 0.05) / (dark + 0.05);
}
// Pairs that must stay readable in a custom theme: [foreground key, background key, label, minimum ratio].
export const CONTRAST_RULES = [
  ['text', 'window', 'Texte sur le fond des panneaux', 4.5],
  ['text', 'button', 'Texte sur les boutons', 4.5],
  ['text', 'selection', 'Texte sur la sélection', 4.5],
  ['text', 'background', 'Texte sur le fond de page', 4.5],
  ['primary', 'window', 'Couleur principale sur le fond des panneaux', 3],
  ['border', 'window', 'Bordures sur le fond des panneaux', 1.6],
];
export function normalizeCustom(input) {
  const value = { ...DEFAULT_CUSTOM };
  if (input && typeof input === 'object' && !Array.isArray(input)) for (const key of CUSTOM_KEYS) if (isHexColor(input[key])) value[key] = input[key].toLowerCase();
  return value;
}
// Returns the list of readability problems of a custom palette (empty when it is acceptable).
export function customProblems(custom) {
  const colors = normalizeCustom(custom);
  return CONTRAST_RULES.filter(([foreground, background,, minimum]) => contrastRatio(colors[foreground], colors[background]) < minimum)
    .map(([foreground, background, label, minimum]) => ({ foreground, background, label, minimum, ratio: Math.round(contrastRatio(colors[foreground], colors[background]) * 100) / 100 }));
}
export function customVariables(custom) {
  const c = normalizeCustom(custom);
  return {
    '--t-bg': c.background, '--t-window': c.window, '--t-ink': c.text, '--t-muted': c.text, '--t-line': c.border, '--t-edge': c.border,
    '--t-top': mix(c.button, '#ffffff', 0.55), '--t-bottom': c.button, '--t-hover': c.selection, '--t-accent': c.primary, '--t-link': c.secondary,
    '--t-bar-top': mix(c.window, '#ffffff', 0.4), '--t-bar-bottom': mix(c.window, c.border, 0.18),
  };
}
export function mix(first, second, amount) {
  const a = parseInt(first.slice(1), 16), b = parseInt(second.slice(1), 16), part = shift => Math.round((a >> shift & 255) * (1 - amount) + (b >> shift & 255) * amount);
  return '#' + [16, 8, 0].map(shift => part(shift).toString(16).padStart(2, '0')).join('');
}
// A theme/option value from untrusted data: returns the fallback when it is not in the allowed list.
export const choose = (value, allowed, fallback) => allowed.includes(value) ? value : fallback;
