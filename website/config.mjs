export const site = {
  name: '3DS Personal Website',
  repository: 'https://github.com/trim360/3ds-profile-template',
  version: '1.2.0',
  canonicalUrl: '',
  creator: { name: 'Trim', url: 'https://kirbytrim.buzz/' },
  community: [{ name: 'weizkule', url: 'https://weizkule.be', credit: 'communityCredit' }],
};
export const links = {
  repository: site.repository,
  releases: `${site.repository}/releases`,
  download: `${site.repository}/releases/download/v${site.version}/3ds-personal-website-v${site.version}.zip`,
  issues: `${site.repository}/issues`,
  docs: `${site.repository}/blob/main/README.md`,
  license: `${site.repository}/blob/main/LICENSE`,
  notices: `${site.repository}/blob/main/NOTICE`,
  node: 'https://nodejs.org/en/download',
  demo: './demo/',
};
export const screenshots = ['home', 'profile', 'sona', 'audio', 'gallery'].map(id => ({
  id, src: `assets/screenshots/${id}.webp`,
}));
export function chooseLanguage(languages = [], saved) {
  if (['en', 'fr'].includes(saved)) return saved;
  return languages.map(value => value.toLowerCase().split('-')[0]).find(value => ['en', 'fr'].includes(value)) || 'en';
}
