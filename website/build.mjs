import { readFile, writeFile, mkdir, copyFile, cp, rename, rm, realpath } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID, createHash } from 'node:crypto';
import { ROOT as PROJECT, managedFiles, saveProfile, buildSite, exists } from '../lib/project.mjs';
import { site, links, screenshots } from './config.mjs';

export const ROOT = path.dirname(fileURLToPath(import.meta.url));
const escape = text => String(text).replace(/[&<>"']/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[char]));
export function demoSound() {
  const rate = 11025, seconds = 8, samples = rate * seconds;
  const wav = Buffer.alloc(44 + samples * 2);
  wav.write('RIFF'); wav.writeUInt32LE(wav.length - 8, 4); wav.write('WAVEfmt ', 8); wav.writeUInt32LE(16, 16);
  wav.writeUInt16LE(1, 20); wav.writeUInt16LE(1, 22); wav.writeUInt32LE(rate, 24); wav.writeUInt32LE(rate * 2, 28);
  wav.writeUInt16LE(2, 32); wav.writeUInt16LE(16, 34); wav.write('data', 36); wav.writeUInt32LE(samples * 2, 40);
  for (let i = 0; i < samples; i++) {
    const t = i / rate, beat = t % 2, frequency = [261.63, 329.63, 392, 523.25][Math.floor(t / 2)];
    const envelope = Math.min(1, beat / .08) * Math.exp(-beat * 2) * Math.min(1, (seconds - t) / .2);
    wav.writeInt16LE(Math.round(Math.sin(2 * Math.PI * frequency * t) * envelope * 4400), 44 + i * 2);
  }
  return wav;
}
async function clean(folder) {
  const parent = await realpath(path.dirname(folder));
  if (parent !== await realpath(ROOT) || !path.basename(folder).startsWith('.build-')) throw new Error('Unsafe build cleanup.');
  await rm(folder, { recursive: true, force: true });
}
export async function build({ demoOnly = false, canonicalUrl = site.canonicalUrl } = {}) {
  if (canonicalUrl && (!/^https?:\/\//.test(canonicalUrl) || new URL(canonicalUrl).username || new URL(canonicalUrl).password || new URL(canonicalUrl).search || new URL(canonicalUrl).hash)) throw new Error('Use a public HTTP(S) canonical URL without credentials, query or fragment.');
  const base = canonicalUrl ? canonicalUrl.replace(/\/?$/, '/') : '';
  const temporary = path.join(ROOT, '.build-' + randomUUID());
  const output = path.join(ROOT, 'dist');
  await mkdir(temporary);
  try {
    const demo = path.join(temporary, 'source'); await mkdir(demo);
    const demoAssets = new Set(['assets/avatar.svg','assets/settings-3ds.png','assets/profile.svg','assets/network.svg','assets/audio.svg']);
    for (const file of [...await managedFiles(PROJECT), 'config.js'].filter(file => !file.startsWith('assets/') || demoAssets.has(file))) {
      const target = path.join(demo, file); await mkdir(path.dirname(target), { recursive: true }); await copyFile(path.join(PROJECT, file), target);
    }
    await mkdir(path.join(demo, 'user-content/media'), { recursive: true });
    await writeFile(path.join(demo, 'user-content/media/demo-loop.wav'), demoSound());
    await saveProfile(demo, {
      name: 'Demo profile', pronouns: 'they / them', about: 'A sample profile. Make the next one your own.',
      bio: 'This is a demonstration of the template, with example content and no personal information.',
      links: [{ name: 'Project source', url: links.repository, icon: 'github' }],
      music: 'user-content/media/demo-loop.wav', musicTitle: 'Original demonstration loop',
      musicCredit: { owner: 'other', artist: 'Procedurally generated for this demo', source: '', rightsConfirmed: true },
      updates: { enabled: false }, language: 'auto',
      translations: { enabled: true, values: { fr: { about: 'Un profil de démonstration. À toi de créer le suivant.', bio: 'Cette démo utilise des contenus d’exemple et ne contient aucune information personnelle.', 'page.sona': 'Une fiche de personnage avec des caractéristiques et des illustrations d’exemple.', 'page.gallery': 'Des images d’exemple pour découvrir la galerie.' } } },
      pages: [
        { id: 'sona', type: 'sona', title: 'Sona', content: 'A character sheet with traits and example illustrations.', traits: [{ label: 'Name / Nom', value: 'Demo character / Personnage de démonstration' }, { label: 'Mood / Humeur', value: 'Curious / Curieux' }], images: [{ src: 'assets/avatar.svg', caption: 'Example illustration / Illustration d’exemple', credit: 'Template placeholder / Exemple du modèle' }] },
        { id: 'gallery', type: 'gallery', title: 'Gallery / Galerie', content: 'Example images to explore the gallery.', images: [{ src: 'assets/avatar.svg', caption: 'Example image / Image d’exemple', credit: 'Template placeholder / Exemple du modèle' }, { src: 'assets/network.svg', caption: 'Bundled icon / Icône incluse', credit: 'Template asset / Ressource du modèle' }] },
      ],
    });
    const script = path.join(demo, 'script.js');
    let source = await readFile(script, 'utf8');
    for (const key of ['AudioPreferences','Language','UpdateCache','DismissedUpdate','ViewCount','HasVisited']) source = source.replaceAll('trim' + key, 'showcaseDemo' + key);
    await writeFile(script, source);
    await buildSite(demo);
    const ready = path.join(temporary, 'ready'); await mkdir(ready);
    await rename(path.join(demo, 'dist'), path.join(ready, 'demo'));
    await writeFile(path.join(ready, '.3ds-showcase-build'), '1\n');
    if (!demoOnly) {
      const en = JSON.parse(await readFile(path.join(ROOT, 'locales/en.json'), 'utf8'));
      for (const file of ['style.css', 'app.mjs', 'config.mjs']) await copyFile(path.join(ROOT, file), path.join(ready, file));
      await cp(path.join(ROOT, 'locales'), path.join(ready, 'locales'), { recursive: true });
      await cp(path.join(ROOT, 'assets'), path.join(ready, 'assets'), { recursive: true });
      for (const shot of screenshots) if (!await exists(path.join(ready, shot.src))) throw new Error(`Missing real screenshot: ${shot.src}. Capture the built demo first.`);
      await copyFile(path.join(PROJECT, 'assets/settings-3ds.png'), path.join(ready, 'assets/settings-3ds.png'));
      await copyFile(path.join(PROJECT, 'NOTICE'), path.join(ready, 'NOTICE'));
      let html = await readFile(path.join(ROOT, 'index.html'), 'utf8');
      const dimensions = JSON.parse(await readFile(path.join(ROOT, 'assets/screenshots/manifest.json'), 'utf8'));
      for (const shot of screenshots) {
        const info = dimensions[shot.id];
        if (!info || createHash('sha256').update(await readFile(path.join(ready, shot.src))).digest('hex') !== info.sha256) throw new Error('Screenshot manifest mismatch: ' + shot.id);
        html = html.replaceAll(`src="${shot.src}" width="1020" height="850"`, `src="${shot.src}" width="${info.width}" height="${info.height}"`);
      }
      html = html.replace('<!-- locale bootstrap -->', '<script type="application/json" id="messages">' + JSON.stringify(en).replaceAll('<', '\\u003c') + '</script>');
      const values = { ...en, projectName: site.name, version: site.version, ...Object.fromEntries(Object.entries(links).map(([key,value]) => ['link.' + key, value])) };
      html = html.replace(/\{\{([\w.]+)\}\}/g, (_, key) => { if (!(key in values)) throw new Error('Unknown template key: ' + key); return escape(values[key]); });
      if (base) html = html.replace('<!-- canonical -->', `<link rel="canonical" href="${escape(base)}"><meta property="og:url" content="${escape(base)}">`).replaceAll('content="assets/screenshots/home.webp"', `content="${escape(base)}assets/screenshots/home.webp"`);
      await writeFile(path.join(ready, 'index.html'), html);
      await writeFile(path.join(ready, 'robots.txt'), 'User-agent: *\nAllow: /\n' + (base ? `Sitemap: ${base}sitemap.xml\n` : ''));
      if (base) await writeFile(path.join(ready, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>${escape(base)}</loc></url></urlset>`);
      await writeFile(path.join(ready, '.nojekyll'), '');
      const imageHashes = await Promise.all(screenshots.map(async s => ({ ...s, sha256: createHash('sha256').update(await readFile(path.join(ready, s.src))).digest('hex') })));
      await writeFile(path.join(ready, 'build-info.json'), JSON.stringify({ version: site.version, canonicalUrl: base, screenshots: imageHashes }));
    }
    let previous;
    if (await exists(output)) {
      if (!await exists(path.join(output, '.3ds-showcase-build'))) throw new Error('dist is not an owned showcase build.');
      previous = path.join(ROOT, '.build-previous-' + randomUUID()); await rename(output, previous);
    }
    try { await rename(ready, output); } catch (error) { if (previous) await rename(previous, output); throw error; }
    if (previous) await clean(previous);
    return output;
  } finally { await clean(temporary); }
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) build({ demoOnly: process.argv.includes('--demo-only'), canonicalUrl: process.env.WEBSITE_URL || site.canonicalUrl }).then(console.log).catch(error => { console.error(error.message); process.exitCode = 1; });
