# 3DS Profile Template

Un modèle de site personnel créé par **Trim**, avec une interface inspirée des
paramètres de la Nintendo 3DS. Tu peux y mettre ton pseudo, ta photo, tes réseaux
et une musique de fond.

Le site comprend trois menus : **Profil**, **Réseaux** et **Réglages audio**.
Il fonctionne sur ordinateur et téléphone, en HTML, CSS et JavaScript.

Pour créer ton site, suis les étapes 1 à 3 ci-dessous. Tout se fait depuis GitHub,
avec un compte gratuit. Les parties « Tester sur ton PC » et « Docker » sont
facultatives.

## 1. Créer ta copie du site

1. Connecte-toi à ton compte GitHub et ouvre [ce dépôt](https://github.com/trim360/3ds-profile-template).
2. Au-dessus des fichiers, clique sur **Use this template**, puis **Create a new repository**.
3. Choisis ton compte comme propriétaire et donne un nom à ton dépôt, par exemple `mon-profil`.
4. Choisis **Public** pour utiliser gratuitement GitHub Pages, puis clique sur **Create repository from template**.

Tu as maintenant ta propre copie. Fais les modifications dans **ton dépôt**.

## 2. Mettre ton pseudo et tes liens

Dans ton dépôt, ouvre [config.js](config.js), puis clique sur le crayon pour
modifier le fichier. Remplace son contenu par cet exemple, en adaptant le pseudo
et les deux liens :

```js
// Copyright (C) 2026 Trim. GPLv3 and attribution: see LICENSE and NOTICE.
window.PROFILE_CONFIG = {
  name: 'Ton pseudo',
  domain: 'Mon site personnel',
  avatar: 'assets/avatar.svg',
  music: '',
  musicTitle: '',
  links: [
    {
      name: 'GitHub',
      label: '@ton-pseudo',
      url: 'https://github.com/ton-pseudo',
    },
    {
      name: 'Discord',
      label: 'Mon serveur',
      url: 'https://discord.gg/ton-invitation',
    },
  ],
};
```

Clique ensuite sur **Commit changes** pour enregistrer. Le pseudo et l’invitation
de cet exemple sont à remplacer par les tiens.

| Champ | Ce qu’il change |
| --- | --- |
| `name` | Ton pseudo dans le titre et la page Profil. |
| `domain` | Le texte affiché en haut à gauche. Ce champ ne configure pas un nom de domaine. |
| `avatar` | Le chemin de ta photo. Garde `assets/avatar.svg` pour utiliser l’avatar fourni. |
| `music` | Le chemin du fichier audio. Garde `''` pour laisser la musique désactivée. |
| `musicTitle` | Le titre affiché dans les réglages audio. |
| `links` | Les liens affichés dans Réseaux. Garde `[]` si tu n’en veux aucun. |

Pour chaque réseau, `name` est son nom, `label` est le texte affiché dessous et
`url` est l’adresse complète qui s’ouvre au clic. Tu peux ajouter TikTok, YouTube,
un autre réseau ou ton propre site en reprenant un des blocs entre `{` et `}`.
Sépare les blocs par une virgule et utilise des liens commençant par `https://`.

Les apostrophes servent à délimiter le texte. Si ton texte contient une apostrophe,
entoure-le de guillemets doubles, par exemple `musicTitle: "Ma musique d'ambiance"`.
Ne mets aucun mot de passe ni clé secrète dans ce fichier : son contenu est public.

## 3. Mettre ton site en ligne avec GitHub Pages

Dans **ton dépôt** :

1. Ouvre **Settings**, puis **Pages** dans le menu de gauche.
2. Dans **Build and deployment**, choisis **Deploy from a branch** comme source.
3. Sélectionne la branche **main**, puis le dossier **/ (root)** et clique sur **Save**.
4. Attends la fin du déploiement. La page **Settings → Pages** affichera le lien de ton site.

Pour un dépôt nommé `mon-profil`, l’adresse habituelle est
`https://ton-pseudo.github.io/mon-profil/`. Utilise le lien indiqué par GitHub.
Chaque modification enregistrée sur `main` déclenche une nouvelle publication.

Tu peux garder cette adresse gratuite. Si tu possèdes déjà un domaine, son
raccordement se règle séparément dans GitHub Pages et chez ton fournisseur DNS.
Changer `domain` dans `config.js` ne change que le texte du site.

Ces étapes suivent les guides GitHub pour [créer une copie d’un modèle](https://docs.github.com/en/repositories/creating-and-managing-repositories/creating-a-repository-from-a-template)
et [publier depuis une branche](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site).

## Ajouter ta photo ou ta musique

Dans le dossier `assets` de ton dépôt, utilise **Add file → Upload files**,
ajoute ton fichier, puis enregistre avec **Commit changes**.

Par exemple, si tu ajoutes `photo.png` et `musique.mp3` dans `assets`, change
uniquement ces lignes de `config.js` :

```js
avatar: 'assets/photo.png',
music: 'assets/musique.mp3',
musicTitle: 'Le titre de ma musique',
```

Ce bloc remplace les trois lignes correspondantes dans la configuration ;
ne remplace pas tout le fichier avec ces trois lignes seules.
Respecte exactement le nom du fichier, son extension et les majuscules.
Les chemins `assets/...` fonctionnent aussi quand GitHub Pages héberge le site
dans un sous-dossier. Choisis de préférence des noms sans espaces ni accents.

La musique attend une interaction sur la page pour démarrer. Tu peux ensuite
la couper ou changer son volume dans **Réglages audio**. Le navigateur conserve
ces réglages et la musique continue quand tu changes de menu.

Ajoute uniquement des médias que tu as le droit de publier. Ce dépôt fournit
un avatar et des icônes SVG génériques. La photo de Trim, la musique et les
icônes officielles Nintendo de son site personnel ne sont pas incluses.

## Tester sur ton PC avant de publier (facultatif)

Télécharge ton dépôt avec **Code → Download ZIP**, puis extrais le ZIP.
Ouvre un terminal dans le dossier qui contient `index.html`.
Il faut avoir Python 3 installé pour utiliser les commandes suivantes.

Sous Windows, dans PowerShell :

```powershell
py -m http.server 8080 --bind 127.0.0.1
```

Sous Linux ou macOS :

```sh
python3 -m http.server 8080 --bind 127.0.0.1
```

Ouvre ensuite [http://127.0.0.1:8080/](http://127.0.0.1:8080/) dans ton navigateur.
Garde le terminal ouvert pendant le test ; **Ctrl + C** arrête le serveur local.
Il n’y a aucune commande npm à lancer. Les changements faits sur ton PC restent
locaux tant que tu ne les envoies pas dans ton dépôt GitHub.

## Héberger avec Docker (facultatif)

Cette méthode sert à héberger le site sur un ordinateur ou un serveur équipé
de Docker et du plugin Docker Compose. Elle remplace l’hébergement GitHub Pages.
Depuis le dossier du projet, après avoir personnalisé `config.js` :

```sh
docker compose up -d --build
```

Ouvre [http://localhost:8080/](http://localhost:8080/) sur cette machine, ou
`http://IP-DU-SERVEUR:8080/` depuis un appareil qui peut joindre le serveur.
Pour choisir un autre port, remplace la partie gauche de `8080:80` dans
`docker-compose.yml`, par exemple par `8081:80`.

Après une modification des fichiers, relance la même commande pour reconstruire
l’image. Pour arrêter le site, lance `docker compose down` depuis ce dossier.

## Si quelque chose ne marche pas

| Problème | À vérifier |
| --- | --- |
| Le site affiche encore « Votre pseudo ». | As-tu modifié et enregistré `config.js` dans ton dépôt ? Attends le nouveau déploiement, puis recharge la page. |
| La photo ne s’affiche pas. | Le fichier est-il dans `assets` ? Son nom correspond-il exactement à la valeur de `avatar` ? |
| Mes infos disparaissent après une modification. | Vérifie les virgules, les guillemets et les accolades de `config.js`. Repars de l’exemple complet si nécessaire. |
| Le son reste désactivé. | Renseigne `music`, vérifie le fichier, clique sur la page et active le son avec un volume supérieur à zéro. |
| Aucun réseau ne s’affiche. | Ajoute des blocs dans `links` et remplace les adresses d’exemple par tes liens HTTPS. |
| Le site GitHub Pages renvoie 404. | Vérifie que la publication utilise `main` et `/ (root)`, puis consulte le déploiement dans l’onglet Actions du dépôt. |
| Le bouton Use this template n’apparaît pas. | Connecte-toi à GitHub et ouvre le dépôt original indiqué à l’étape 1. |

## Crédit de Trim et licence

Tu peux utiliser, modifier et redistribuer le modèle sous **GNU GPLv3** avec
la clause d’attribution décrite dans [NOTICE](NOTICE).
**Le nom Trim doit rester dans les crédits de ton site.** Le volet
« Crédits : Trim » est déjà inclus. Tu peux le déplacer ou changer son apparence,
tant qu’il reste accessible et lisible.

Conserve [LICENSE](LICENSE), [NOTICE](NOTICE) et la notice d’origine
[LICENSES/MIT-original.txt](LICENSES/MIT-original.txt). Les versions du code que
tu distribues doivent rester sous GPLv3 et être accompagnées de leur source
correspondante. Le modèle est fourni sans garantie.

La notice MIT de JAQLIV concerne la base historique du projet. Ce projet n’est
pas affilié à Nintendo.

Créé par [Trim](https://kirbytrim.buzz/) · [Profil GitHub](https://github.com/trim360)
