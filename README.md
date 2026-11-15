# 3DS Personal Website · 2.1.0

[English](#english) · [Français](#français)

[Project website / Site du projet](https://3ds.kirbytrim.buzz/) · [Live demo / Démo](https://3ds.kirbytrim.buzz/demo/)

## English

A personal website template created by **Trim**, inspired by the Nintendo 3DS
settings menu. The cream background, raised buttons, spacing, textures,
animations and continuous music player are retained. Setup runs locally;
your personal files are never uploaded automatically.

### Download and start

Download the ZIP from this repository or its GitHub Releases, extract it,
and open the extracted folder. Install a supported [Node.js LTS](https://nodejs.org/)
release, version **22 or newer**. Node.js is needed for the setup tools, not for
visitors or static hosting. No npm package installation is required.

- **Windows:** double-click `setup.bat`. If Node.js is missing, the launcher
  offers installation through `winget` when available, after asking you.
  Installer/UAC prompts remain yours to approve. Restart setup after installation.
- **Linux:** run `sh setup.sh`, or `chmod +x setup.sh` then `./setup.sh`.
  If Node.js is missing or too old, the launcher identifies an available package
  manager and points you to Node.js. It never runs `sudo` or installs silently.

Choose English or French at the first prompt. Select **1** to configure your
profile. Blank answers keep existing values or skip optional questions;
enter `-` to clear an optional text field. Run the same launcher again to edit
only the profile, picture, links, pages, music, credits or language settings.

### Profile, pages and images

The wizard supports your display name, pronouns, title, short About Me,
biography, interests, projects, website, social links, portrait and cover.
Empty optional fields create no extra section. Names, pronouns and URLs remain
exactly as supplied, including when visitors change language.

Create **About Me, Projects, Sona, Gallery, Links or Custom** pages. Each has
a title, plain-text content and visibility. Images can have captions and artist
credits. Sona pages also accept character traits and multiple illustrations.
The page/image lists let you add and remove entries; removing an entry keeps
its media files and backups. Advanced settings control menu order, hidden
sections, titles, icon files and the initial page. Back still opens the main menu.

Paste local paths, including paths with spaces. Images support **PNG, JPG,
GIF and WebP up to 10 MB**; audio supports **MP3, OGG and WAV up to 30 MB**.
Setup checks the extension and file signature, copies the bytes under a unique
filename and verifies the copy. Originals are never moved or recompressed.
Imported SVG files are not accepted by the wizard; existing template SVG icons
and advanced icon URLs remain supported.

Social links have built-in `github`, `tiktok`, `x`/`twitter`, `youtube` and
`discord` logos. For your own image, paste its local path into option **3**
(social icon) or **a** (menu icons). Quoted paths with spaces work; setup copies
the image into `user-content/media/` and includes it in the export.
For manual configuration, use `icons` and `links[].icon` in `config.js` before
the first setup, or in `user-content/profile.json` afterwards. After editing JSON,
run setup and save a setting to regenerate `config.js`. Use `assets/logo.png`, without
a leading slash, for project sites hosted in a subfolder. A missing image uses
the supplied fallback and a visible message. The original supplied settings
wrench and orange Nintendo Network profile mark are included with separate
asset notices in [NOTICE](NOTICE); other icons are retained.

### Music and credits

Music is optional. When configuring it, the wizard asks whether it belongs to
Nintendo: **Yes / No / Not sure**. It does not infer rights from an MP3.
Nintendo music asks for a title and generates the Nintendo attribution and
unofficial-project notice. Other music asks for its artist, title and optional
license/source URL. Unknown rights can continue without music.

**Attribution is not permission to use Nintendo music.** Confirm that you may
publish your audio before importing it. No Nintendo music is distributed here.
Personal media under `user-content/` and audio extensions are ignored by Git by
default. `.gitignore` does not remove files already tracked or their history;
review those separately before publishing a repository.

The looping player keeps its volume/mute preferences and continues between
menus and language changes. Browser autoplay restrictions still require an
interaction. Without a configured track, audio controls are disabled cleanly.
Add artist/community credits through setup; the required original **Trim**
credit remains visible in the Credits disclosure.

### Languages

The interface chooses English/French from the browser on the first visit,
with English as fallback. The language selector remembers a visitor’s choice
and does not reload the player. UI dictionaries live in `locales/en.json` and
`locales/fr.json`. Add further dictionaries and extend the supported-language
list in `lib/translations.mjs` to support another language.

Personal content translations are **opt-in and manually supplied** in setup.
Descriptions, biographies and page text can have English/French versions;
missing translations retain the original content. UI dictionaries are cached
in memory and translation failures fall back to English. No translation API,
paid service or private API key is required, and profile text is not sent to
a third-party translator. No external automatic content-translation provider
is integrated in this release.

### Preview, export and deployment

Select **9** in setup for a local-only preview. The wizard prints the actual
available loopback address; keep it running, then press Enter to stop.
Select **b** to export the site to `dist/`, after confirming. Export includes
the current profile and only the referenced personal media. Existing generated
builds are moved into `backups/`; an unrelated output folder is not overwritten.

- **Static hosting / GitHub Pages:** deploy the contents of `dist/`. Uploading
  the source root alone after setup omits Git-ignored personal media. For Pages,
  put the exported contents in your chosen publishing branch and select that
  branch’s root in Settings → Pages. Your publishing action is separate from setup.
- **Docker:** from the project folder run `docker compose up -d --build`.
  The Node.js build stage creates the static export; Nginx serves it on port 8080.
  Run it again after local changes. `docker compose down` stops the container.

Everything in a deployed website, including `config.js` and media, is public.
Never put secrets in your profile. The `domain` field is a display label;
DNS/custom-domain configuration is separate. No setup action publishes a site.

### Optional owner administration (Node.js or Docker)

Static hosting remains the default. To edit in a browser, run **o** in setup
to create your local owner account, then start:

```sh
node scripts/owner.mjs serve
```

Open `http://127.0.0.1:8120/assets/owner/index.html`. The two-screen interface
uses a local identifier and a password of 12–128 characters. It never connects
to Nintendo. Only a logged-in owner can edit the profile, avatar, biography,
pages, gallery, social links, music, language and default appearance.
**Enregistrer et publier** saves and rebuilds the public site immediately;
visitors cannot use these APIs. The editor currently uses French labels.
Existing visitors keep their own audio and appearance preferences.

The first interactive setup offers static or owner mode. Existing installs
can add owner mode at any time with **o**; no profile is replaced. Passwords
are entered without echo and stored as salted scrypt hashes in `.owner/`,
outside the public export. Keep that directory private and back it up along
with `user-content/`. Never upload the source directory as a public static root:
publish **dist/** only. A static export contains owner setup guidance, without
a working login or editing API. GitHub Pages needs no backend.

For Docker, the optional service has its own persistent volume:

```sh
docker compose --profile owner build owner
docker compose --profile owner run --rm owner node scripts/owner.mjs configure --root /data/site
docker compose --profile owner up -d owner
```

This serves the site and editor on loopback port 8120. It does not start the
static service or change your domain. The first start copies the template
and configured profile into `owner-data`; subsequent starts preserve it.
Back up the volume; **do not use `docker compose down -v`** to restart it.
Rebuilding the image does not overwrite the volume. Use setup/update inside
that workspace or the owner's update tab to update an existing workspace.

For remote use, put an HTTPS reverse proxy in front of port 8120, preserve
the public Host header, and set `OWNER_ORIGIN=https://your-domain.example`
in the Docker process environment. For direct Node, pass
`--origin https://your-domain.example`; binding outside loopback also requires
`--host` and an explicit HTTPS origin. This is an origin setting, not a TLS
certificate installer. Public HTTP is rejected. Sessions use HttpOnly,
SameSite cookies (Secure on HTTPS), CSRF checks, an eight-hour maximum and a
30-minute idle timeout. A shared reverse proxy shares the login rate limit;
forwarded IP headers are deliberately ignored.

Forgotten password: run **o** in local setup and confirm reset, or run
`node scripts/owner.mjs reset`. Docker:
`docker compose --profile owner run --rm owner node scripts/owner.mjs reset --root /data/site`.
There is no email reset. Reset/restart invalidates existing sessions and keeps
the profile and media. Restart the Node process or run
`docker compose --profile owner restart owner` after installing an update.
This reloads the updated backend modules; sign in again afterwards.

### Updates and backups

Visitors cannot check or install updates. The public site has no update button
or public update endpoint. Owners check stable GitHub Releases in local setup
or the authenticated owner settings; commits on `main` do not count as releases.

Open **Settings** below the console, or `#parametres`, to adjust music, volume,
button feedback, theme, accent, language, readability and animations. Choices
stay in this browser. System reduced-motion preferences are respected.

Use setup option **8**, or `node scripts/update.mjs`, for installation.
The tool shows the version/changelog and asks before installing. It verifies
the GitHub asset’s SHA256 digest, every file hash, Node/schema compatibility
and the installed core-file baseline. An edited core file or conflicting
personal image stops the update instead of overwriting it. No `git reset --hard`,
downloaded migration code or package-install scripts are executed.

Your profile, pronouns, pages, translations, images, music and credits stay in
`user-content/`; generated `config.js`, `.env` files and personal paths are
protected. Backups are in `backups/`. Core writes are journaled, the version is
written last, and a failed install restores prior files. If an interrupted
update left a journal, rerun the updater to approve recovery. A new manual edit
during recovery causes a stop for manual merging; the backup is retained.

The previous literal `window.PROFILE_CONFIG` format is imported without
executing JavaScript and migrated to schema 2. Unsupported executable
configuration or unknown schema versions require manual migration. Older ZIP
installs need a known baseline; modified or unrecognized core files require
a manual merge. Back up the whole folder before updating. Docker and Pages
still need their own rebuild/deployment after a local update.

### File layout and troubleshooting

`user-content/profile.json` stores your profile; individual pages live in
`user-content/pages/`, imported media in `user-content/media/`. `config.js` is
the generated browser payload and is protected by the updater. Editing through
setup uses the JSON profile as its source once present. `examples/` contains
clearly labeled sample data with no personal profile or music.

If setup reports an error, correct the path/format or dependency and retry.
If a lock says another setup is running, close that process first. Stale locks
from a dead process are reclaimed. If icons look wrong after a manual update,
use HTML, CSS, JS and bundled assets from the same version, keeping your profile
and personal media. `node scripts/validate-config.mjs` checks configuration;
`node --test` runs the test suite. Physical-browser testing is currently Chromium;
other browser families are not claimed as tested.

### Community Credits

Thanks to [weizkule](https://weizkule.be) for their creative customizations,
Sona page and ideas for improving the profile. Original creator: **Trim**.
The historical MIT notice for JAQLIV remains in `LICENSES/MIT-original.txt`.

### License

Code: [GNU GPLv3](LICENSE), with the reasonable attribution term in [NOTICE](NOTICE).
**Keep Trim’s name in accessible site credits.** You may restyle or move that
credit. Retain license notices and provide corresponding source when distributing
modified code. Third-party images retain their separate notices and trademark
rights; the code license grants no Nintendo endorsement. Provided without warranty.

## Français

### Administration locale facultative — version 2.1

Le template téléchargé contient le backend et l’éditeur ; ils ne sont pas
réservés à la démo. Le mode statique reste disponible sans serveur Node.
Au premier setup interactif, choisis le mode statique ou propriétaire.
Sur une installation existante, l’option **o** ajoute le compte sans remplacer
ton profil. L’identifiant et le mot de passe appartiennent uniquement au site.
Le mot de passe (12 à 128 caractères) est saisi de façon masquée et enregistré
sous forme d’empreinte scrypt dans le dossier privé `.owner/`.

```sh
node scripts/owner.mjs serve
```

Ouvre `http://127.0.0.1:8120/assets/owner/index.html`. L’écran supérieur reprend
le profil et les consignes ; l’écran inférieur contient la connexion puis les
réglages. L’éditeur permet de modifier le profil, les images, la biographie,
les pages, la galerie, les réseaux, la musique, la langue et l’apparence.
**Enregistrer et publier** sauvegarde les données puis reconstruit le site.
Les API d’édition sont réservées au propriétaire connecté. Les préférences
déjà choisies par les visiteurs restent prioritaires sur les valeurs initiales.

Les commandes Docker ci-dessus créent un service facultatif `owner`, avec
ses données dans le volume `owner-data`. Le port 8120 reste local. Pour un
domaine, utilise un proxy HTTPS qui transmet le Host public et définis
`OWNER_ORIGIN=https://ton-domaine.example` dans l’environnement du processus
Docker, ou `--origin https://ton-domaine.example` avec Node. Le backend ne
génère pas de certificat. Aucune connexion aux serveurs Nintendo n’est utilisée.
La création de compte par une page publique est désactivée.

Le bouton **Vérifier les mises à jour** se trouve uniquement dans l’espace
propriétaire ; l’option **8** de setup et `scripts/update.mjs` sont conservés.
Après une mise à jour, redémarre le backend puis reconnecte-toi. Pour récupérer
un compte, utilise **o** dans setup et confirme la réinitialisation, ou
`node scripts/owner.mjs reset`. Avec Docker, utilise la commande `reset`
ci-dessus. Les anciennes sessions sont invalidées, les données sont conservées.

Sauvegarde `.owner/` et `user-content/` en privé. Avec Docker, sauvegarde le
volume ; une suppression avec `down -v` effacerait ces données. Pour un hébergement
statique, publie uniquement `dist/` : le compte privé et les scripts serveur
n’y figurent pas. La page propriétaire affiche alors les instructions de setup,
sans formulaire de connexion actif. Aucun mot de passe ne va dans `config.js`.

Un modèle de site personnel créé par **Trim**, inspiré des paramètres Nintendo 3DS.
Le fond crème, les boutons en relief, les dimensions, les textures, les animations
et le lecteur musical continu sont conservés. L’assistant fonctionne en local
et ne téléverse jamais automatiquement tes fichiers personnels.

### Télécharger et lancer

Télécharge le ZIP du dépôt ou de ses GitHub Releases, extrais-le et ouvre son
dossier. Installe une version [Node.js LTS](https://nodejs.org/) prise en charge,
**22 ou plus récente**. Node.js sert aux outils de configuration, pas aux visiteurs
ni à l’hébergement statique. Aucune installation de paquet npm n’est nécessaire.

- **Windows :** double-clique sur `setup.bat`. Si Node.js manque, le lanceur
  propose `winget` lorsqu’il est disponible et demande ton accord. Les fenêtres
  de l’installateur/UAC restent à valider par toi. Relance setup après installation.
- **Linux :** lance `sh setup.sh`, ou `chmod +x setup.sh` puis `./setup.sh`.
  Si Node.js manque ou est trop ancien, le lanceur identifie un gestionnaire de
  paquets disponible et indique la source Node.js. Il n’exécute jamais `sudo`
  et n’installe rien silencieusement.

Choisis le français ou l’anglais au premier écran, puis **1** pour créer ton profil.
Une réponse vide conserve la valeur existante ou ignore une question facultative ;
`-` efface un texte facultatif. Relance le même fichier pour modifier uniquement
le profil, la photo, les réseaux, les pages, la musique, les crédits ou la langue.

### Profil, pages et images

L’assistant gère pseudo, pronoms, titre, courte description À propos, biographie,
centres d’intérêt, projets, site, réseaux, portrait et couverture. Un champ vide
n’ajoute aucune rubrique. Pseudonymes, pronoms et adresses restent tels quels,
même lorsque les visiteurs changent de langue.

Crée des pages **About Me, Projects, Sona, Gallery, Links ou Custom**. Chacune a
un titre, un contenu en texte simple et une visibilité. Les images acceptent
légendes et crédits d’artistes. Les pages Sona peuvent contenir des caractéristiques
et plusieurs illustrations. Tu peux ajouter/retirer des pages et des images ;
retirer une entrée conserve ses fichiers et sauvegardes. Les réglages avancés
gèrent l’ordre, la visibilité, les titres, les icônes et la page initiale.
Le bouton Retour continue d’ouvrir le menu principal.

Colle les chemins locaux, y compris avec des espaces. Images : **PNG, JPG, GIF
et WebP jusqu’à 10 Mo** ; audio : **MP3, OGG et WAV jusqu’à 30 Mo**. Setup contrôle
l’extension et la signature, copie les octets sous un nom unique et vérifie la
copie. Il ne déplace ni ne recompresse l’original. L’import SVG n’est pas proposé
par l’assistant ; les SVG du modèle et les adresses d’icônes avancées restent utilisables.

Les réseaux possèdent les logos intégrés `github`, `tiktok`, `x`/`twitter`,
`youtube` et `discord`. Pour ta propre image, colle son chemin dans **3**
(logo de réseau) ou **a** (icônes des menus). Les chemins avec espaces et guillemets
fonctionnent ; setup copie l’image dans `user-content/media/` et l’ajoute à l’export.
En configuration manuelle, utilise `icons` et `links[].icon` dans `config.js` avant
le premier setup, puis dans `user-content/profile.json`. Après modification du JSON,
relance setup et enregistre un réglage pour régénérer `config.js`. Utilise `assets/logo.png`
sans `/` initial pour un site placé dans un sous-dossier. Une image manquante
utilise une icône de secours et un message visible. La clé 3DS originale fournie
et le logo Nintendo Network orange sont inclus avec leurs mentions séparées
dans [NOTICE](NOTICE) ; les autres icônes restent conservées.

### Musique et crédits

La musique est facultative. Setup demande si elle appartient à Nintendo :
**Oui / Non / Je ne sais pas**. Il ne déduit pas les droits depuis le MP3.
Une musique Nintendo demande son titre et génère son crédit avec la mention
de projet non officiel. Pour une autre musique, renseigne artiste, titre et
éventuelle adresse de licence/source. Une provenance inconnue permet de continuer sans musique.

**Créditer Nintendo ne donne pas l’autorisation d’utiliser sa musique.**
Confirme ton droit de diffusion avant l’import. Aucune musique Nintendo n’est
distribuée ici. Les médias de `user-content/` et les extensions audio sont ignorés
par Git par défaut. `.gitignore` ne retire pas les fichiers déjà suivis ni leur
historique : vérifie-les séparément avant de publier un dépôt.

Le lecteur boucle, garde volume/mute et continue entre les menus et les langues.
Le navigateur impose toujours une interaction avant lecture. Sans fichier,
les commandes audio sont désactivées proprement. Ajoute les crédits d’artistes
ou communautaires dans setup ; le crédit obligatoire **Trim** reste accessible
dans le volet Crédits.

### Langues

Au premier chargement, l’interface choisit français/anglais selon le navigateur,
avec l’anglais en secours. Le sélecteur mémorise le choix du visiteur sans
relancer le lecteur. Les dictionnaires sont `locales/en.json` et `locales/fr.json`.
Pour une autre langue, ajoute son dictionnaire et étends la liste prise en charge
dans `lib/translations.mjs`.

Les traductions du contenu sont **manuelles et sur activation** dans setup.
Descriptions, biographies et textes des pages peuvent avoir une version française
et anglaise ; une traduction absente conserve l’original. Les dictionnaires sont
mis en cache en mémoire ; une traduction d’interface indisponible revient à l’anglais.
Aucune API de traduction, offre payante ou clé privée n’est requise. Les textes
personnels ne sont pas envoyés à un traducteur tiers. Cette version n’intègre
aucun fournisseur de traduction automatique du contenu.

### Aperçu, export et déploiement

Choisis **9** pour l’aperçu local. Setup affiche l’adresse de boucle locale réellement
disponible ; garde-le ouvert et appuie sur Entrée pour arrêter. Choisis **b** pour
exporter dans `dist/`, après confirmation. L’export contient le profil et seulement
les médias personnels référencés. Les anciens exports générés passent dans `backups/` ;
un dossier de sortie étranger au projet n’est pas écrasé.

- **Hébergement statique / GitHub Pages :** déploie le contenu de `dist/`.
  Publier seulement la racine du code après setup omet les médias ignorés par Git.
  Pour Pages, place l’export dans ta branche de publication et sélectionne sa racine
  dans Settings → Pages. La publication est une action distincte de setup.
- **Docker :** lance `docker compose up -d --build` depuis le projet. L’étape Node.js
  crée l’export statique puis Nginx le sert sur le port 8080. Relance la commande
  après modification ; `docker compose down` arrête le conteneur.

Tout fichier déployé, dont `config.js` et les médias, devient public. Ne mets
aucun secret dans ton profil. `domain` ne change que le libellé affiché ; le DNS
et le domaine personnalisé se règlent séparément. Setup ne publie aucun site.

### Mises à jour et sauvegardes

Les visiteurs n’ont aucun bouton ni point d’accès public de mise à jour. Le propriétaire
consulte les GitHub Releases stables depuis setup ou son espace authentifié. Les commits sur
`main` ne comptent pas comme des versions publiées.

Ouvre **Paramètres** sous la console, ou `#parametres`, pour régler musique,
volume, retour sonore, thème, couleur, langue, lisibilité et animations. Les choix
restent dans ce navigateur. La réduction des animations du système est respectée.

Utilise **8** dans setup ou `node scripts/update.mjs --fr` pour installer.
L’outil présente version/changements puis demande confirmation. Il vérifie
l’empreinte SHA256 fournie par GitHub, chaque fichier, Node.js, le schéma et la
référence des fichiers internes installés. Un fichier interne modifié ou une
image personnelle en conflit arrête l’installation. Aucun `git reset --hard`,
script de migration téléchargé ou script d’installation de paquets n’est exécuté.

Profil, pronoms, pages, traductions, images, musiques et crédits résident dans
`user-content/` ; le `config.js` généré, les `.env` et les chemins personnels sont
protégés. Les sauvegardes sont dans `backups/`. Les écritures sont journalisées,
la version est enregistrée en dernier et un échec restaure les anciens fichiers.
Après une interruption laissant un journal, relance l’outil pour accepter la
restauration. Si un nouveau travail manuel crée un conflit pendant la reprise,
l’outil s’arrête pour une fusion manuelle et conserve la sauvegarde.

L’ancien objet littéral `window.PROFILE_CONFIG` est importé sans exécuter de
JavaScript puis migré vers le schéma 2. Une configuration exécutable ou un schéma
inconnu demande une migration manuelle. Une ancienne installation ZIP doit
correspondre à une référence connue ; les fichiers internes inconnus ou modifiés
demandent une fusion manuelle. Sauvegarde tout le dossier avant une mise à jour.
Docker et Pages nécessitent toujours leur propre reconstruction/déploiement ensuite.

### Fichiers et dépannage

Le profil est `user-content/profile.json`, les pages individuelles sont dans
`user-content/pages/` et les imports dans `user-content/media/`. `config.js` est
le fichier navigateur généré et protégé par l’updater. Dès qu’il existe, le profil
JSON sert de source à setup. `examples/` contient des exemples explicitement nommés,
sans profil personnel réel ni musique.

En cas d’erreur, corrige chemin/format ou dépendance puis réessaie. Si un verrou
signale un autre setup actif, ferme ce processus d’abord. Les verrous d’un processus
terminé sont repris. Après une mise à jour manuelle, garde HTML, CSS, JS et images
de la même version, en conservant ton profil et tes médias. La commande
`node scripts/validate-config.mjs` vérifie le profil ; `node --test` lance les tests.
Les essais de navigateur physique concernent actuellement Chromium ; les autres
familles ne sont pas déclarées testées.

### Community Credits

Merci à [weizkule](https://weizkule.be) pour ses personnalisations créatives,
sa page sona et ses idées d’amélioration du profil. Créateur original : **Trim**.
La notice MIT historique de JAQLIV reste dans `LICENSES/MIT-original.txt`.

### Licence

Code sous [GNU GPLv3](LICENSE), avec la clause d’attribution de [NOTICE](NOTICE).
**Le nom Trim doit rester dans des crédits accessibles.** Tu peux déplacer ou
restyler ce crédit. Conserve les notices et fournis le code source correspondant
en distribuant une version modifiée. Les images tierces gardent leurs propres
mentions et droits de marque ; la licence du code n’accorde aucune approbation
Nintendo. Le modèle est fourni sans garantie.
