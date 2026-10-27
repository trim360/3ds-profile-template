# 3DS Personal Website showcase

[English](#english) · [Français](#français)

## English

This folder is the project presentation website. It does not replace or modify
the personal template in the repository root. It has its own build, demo, assets
and translations. No domain, production container or DNS setting is changed by
these tools. Nothing is published automatically.

### Run locally

Use Node.js 22+ from the repository root. No npm installation is needed.

```sh
node website/build.mjs
node website/serve.mjs
```

The server prints its actual free loopback address. Open it in your browser;
Ctrl+C stops it. It serves only `website/dist/`. To check the build:

```sh
node --test website/tests/*.test.mjs
```

### Content and links

`config.mjs` contains the project name, release version, real repository links,
creator link, community list and optional `canonicalUrl`. Update the version
and ZIP filename together when the project publishes a new release. The Live
Demo links to the built `demo/`, never the creator’s personal installation.

English and French text lives in `locales/`. Browser language detection falls
back to English and the visitor’s choice is saved locally. The UI and metadata
switch together. Personal content translations in the template are manually
supplied and optional; the showcase does not advertise an automatic translation
service that the project does not have.

To credit another community contribution, append its name, real URL and a
translation key to `site.community`, then add that key in both dictionaries.
Keep the original Trim credit and the historical/Nintendo notices.

### Real screenshots and demo

The five WebP files in `assets/screenshots/` were captured from the actual
bundled demo in Chromium, cropped to the settings window and compressed. They
show labelled demonstration content. `manifest.json` records dimensions, file
hashes and provenance. When replacing a screenshot, update its width, height
and SHA256 in that manifest; the build refuses mismatched files.

For new captures, run `node website/build.mjs --demo-only`, start the server,
then visit `demo/#accueil`, `demo/#profil`, `demo/#sona`, `demo/#audio` and
`demo/#gallery`. Use a sufficiently tall viewport to capture the complete
settings window. This option creates an export containing only the demo.
Run the normal build afterwards to restore the full showcase.

The demo is generated from the existing template without modifying its source.
Its profile is sample data; its local-storage keys are separate from the
personal template. Its optional audio is an original procedurally generated
eight-second loop, not Nintendo music. Visitors can change browser preferences
but cannot write the static configuration on the server. No accounts or backend.

### Production export

For Trim's Debian server, `compose.yaml` and `nginx.conf` serve a prebuilt
`dist/` using `docker compose -f website/compose.yaml up -d --wait` from the
repository root. Port 8098 binds only to the two configured LAN/Tailscale
addresses; adapt them for another host. No domain or TLS is configured.

Deploy only the **contents of `website/dist/`**. That folder is self-contained,
including the demo. Paths are relative and work in a hosting subdirectory.
Do not deploy the repository root or overwrite a personal-site installation.

- **GitHub Pages:** copy the export into a separate publishing branch/folder,
  then select that location in Pages settings, or upload it with your chosen
  Pages workflow. `.nojekyll` is included. Publishing requires your own action.
- **Cloudflare Pages:** use `node website/build.mjs` as the build command and
  `website/dist` as the output directory. No framework preset or backend needed.
- **Other static hosts:** upload the exported HTML, CSS, JS, dictionaries,
  screenshots and `demo/` together. Serve `.mjs` as JavaScript. Do not configure
  an SPA fallback that hides missing assets.

Before publication, set `site.canonicalUrl` to the actual approved public URL,
including its subdirectory, then rebuild. Alternatively use the `WEBSITE_URL`
environment variable for the build; no `.env` file is read or changed. The build
then emits canonical/Open Graph URLs and `sitemap.xml`. Without a configured
public URL, it omits these URL-specific tags and the sitemap instead of inventing
a domain. `robots.txt` is always generated; only an origin-root robots file is
authoritative for that origin, so configure it there when hosting in a subfolder.

Use normal short/revalidation caching for HTML/configuration, and invalidate
changed assets when redeploying. The personal template’s own deployment and
custom domains remain independent.

### Limits and verification

Native dialog, keyboard tabs, a labelled mobile menu, local translations,
reduced-motion support and visible loading/error states are included. No tracking,
font CDN, autoplay carousel or paid API. The page remains readable without JS;
language switching, screenshot enlargement and OS tabs require JavaScript.

Performance is checked with actual file-size budgets, not invented Lighthouse
scores. Browser/accessibility test results and their limits are in
`VERIFICATION.md`. No physical-device or all-browser compatibility promise.

## Français

Ce dossier contient la vitrine du projet, séparée du modèle personnel à la racine.
Son build, sa démo, ses captures et ses traductions sont indépendants. Les commandes
ne modifient ni domaine, ni DNS, ni conteneur de production. Rien n’est publié
automatiquement.

### Lancer et tester

Depuis la racine du dépôt, avec Node.js 22+ et sans installation npm :

```sh
node website/build.mjs
node website/serve.mjs
node --test website/tests/*.test.mjs
```

Le serveur affiche l’adresse locale réellement disponible et sert `website/dist/`.
Ouvre cette adresse ; Ctrl+C arrête l’aperçu.

### Modifier la vitrine

`config.mjs` centralise nom, version, adresses réelles du dépôt, lien du créateur,
communauté et `canonicalUrl` facultative. Lors d’une nouvelle version, mets aussi
à jour le nom de son ZIP. La démo pointe vers `demo/`, pas vers le site de Trim.

Les textes anglais et français sont dans `locales/`. La langue du navigateur est
détectée, avec repli anglais ; le choix du visiteur reste enregistré localement.
Les métadonnées suivent la langue. Les traductions des textes personnels du modèle
restent manuelles et facultatives ; aucun service automatique n’est annoncé.

Pour ajouter un crédit communautaire, ajoute nom, véritable adresse et clé de
traduction à `site.community`, puis cette clé aux deux dictionnaires. Conserve le
crédit original de Trim et les notices historiques et Nintendo.

### Captures et démo

Les cinq WebP de `assets/screenshots/` sont de vraies captures Chromium de la
démo, recadrées autour de la fenêtre et compressées. Les contenus sont indiqués
comme exemples. Le manifeste donne dimensions, SHA256 et provenance ; actualise-le
si tu remplaces un fichier, sinon le build refusera une capture incohérente.

Pour refaire les captures, lance `node website/build.mjs --demo-only`, puis le
serveur. Visite `demo/#accueil`, `demo/#profil`, `demo/#sona`, `demo/#audio` et
`demo/#gallery` avec une fenêtre assez haute pour cadrer toute l’interface.
Cette option exporte seulement la démo : relance le build normal ensuite.

La démo réutilise le vrai modèle sans changer sa source. Son profil est un exemple,
ses préférences navigateur sont séparées et sa boucle audio originale de huit
secondes est générée localement. Aucune musique Nintendo ni donnée personnelle
n’est copiée. Les visiteurs ne peuvent pas enregistrer de configuration sur le
serveur statique. Aucun compte ni backend.

### Héberger séparément

Sur le serveur Debian de Trim, `compose.yaml` et `nginx.conf` servent un `dist/`
déjà construit : `docker compose -f website/compose.yaml up -d --wait` depuis
la racine du dépôt. Le port 8098 écoute uniquement sur les deux adresses locales
et Tailscale configurées ; adapte-les pour un autre hôte. Aucun domaine ni TLS.

Publie uniquement le **contenu de `website/dist/`**, qui contient aussi la démo.
Les chemins relatifs fonctionnent en sous-dossier. Ne publie pas la racine du dépôt
et ne remplace pas un site personnel existant.

- **GitHub Pages :** copie l’export dans une branche ou un dossier de publication
  séparé, puis sélectionne-le dans Pages ou utilise ton workflow. `.nojekyll` est
  inclus. Cette publication reste une action volontaire.
- **Cloudflare Pages :** commande `node website/build.mjs`, sortie `website/dist`,
  sans framework ni backend.
- **Autre hébergeur statique :** transfère HTML, CSS, JS, dictionnaires, captures
  et `demo/` ensemble. Les `.mjs` doivent être servis en JavaScript. Évite une
  redirection SPA qui masquerait les fichiers manquants.

Avant publication, renseigne l’URL publique réellement approuvée, avec son éventuel
sous-dossier, dans `site.canonicalUrl`, puis reconstruis. Tu peux aussi fournir
`WEBSITE_URL` au build ; aucun `.env` n’est lu ou modifié. Le build génère alors les
adresses canoniques/Open Graph et le sitemap. Sans URL fournie, il les omet au lieu
d’inventer un domaine. Le robots.txt est toujours généré ; en sous-dossier, seul le
robots.txt à la racine de l’origine fait autorité.

Prévois un cache court ou une revalidation des pages/configurations, et invalide
les ressources modifiées lors d’un nouveau déploiement. Le site personnel et ses
domaines restent indépendants.

### Vérifications et limites

Visionneuse native, onglets au clavier, menu mobile libellé, traductions locales,
réduction des animations et états de chargement/erreur sont présents. Aucun suivi,
CDN de police, carrousel automatique ni API payante. Sans JS, le contenu et les liens
restent lisibles ; traduction, agrandissement et onglets d’installation demandent JS.

Les performances sont contrôlées avec des tailles réellement mesurées, sans score
Lighthouse inventé. Les essais et leurs limites figurent dans `VERIFICATION.md`.
Pas de garantie sur tous les appareils physiques ou toutes les familles de navigateur.
