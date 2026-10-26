const cache = new Map();
export function chooseLanguage(configured, languages = [], stored) {
  if (['en', 'fr'].includes(stored)) return stored;
  if (['en', 'fr'].includes(configured)) return configured;
  return languages.map(value => String(value).toLowerCase().split('-')[0]).find(value => ['en', 'fr'].includes(value)) || 'en';
}
export async function loadDictionary(language, fetchImpl = globalThis.fetch) {
  const selected = ['en', 'fr'].includes(language) ? language : 'en';
  if (!cache.has(selected)) {
    try {
      const response = await fetchImpl(new URL(`../locales/${selected}.json`, import.meta.url));
      if (!response.ok) throw new Error('Translation unavailable.');
      const dictionary = await response.json();
      if (!dictionary.ui || Object.values(dictionary.ui).some(value => typeof value !== 'string')) throw new Error('Invalid translation.');
      cache.set(selected, dictionary.ui);
    } catch (error) {
      if (selected !== 'en') return { ...await loadDictionary('en', fetchImpl), fallback: true };
      throw error;
    }
  }
  return { language: selected, strings: cache.get(selected), fallback: false };
}
export function format(text, values = {}) { return String(text).replace(/\{(\w+)\}/g, (_, name) => String(values[name] ?? '')); }
