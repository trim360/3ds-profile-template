# 3DS Profile Template

Un site personnel inspiré des paramètres de la Nintendo 3DS, créé par **Trim**.
Profil, réseaux sociaux et réglages audio, en HTML/CSS/JavaScript sans dépendance.

## Utiliser le modèle

Clique sur **Use this template** sur GitHub, puis personnalise `config.js`.
Tu peux aussi cloner le dépôt. Pour tester localement depuis son dossier :

```sh
python3 -m http.server 8080
```

Ouvre http://localhost:8080/. Il n’y a ni installation npm ni compilation.

```js
window.PROFILE_CONFIG = {
  name: 'Votre pseudo',
  domain: 'exemple.fr',
  avatar: 'assets/ma-photo.png',
  music: 'assets/ma-musique.mp3',
  musicTitle: 'Titre de ma musique',
  links: [
    { name: 'GitHub', label: 'mon-pseudo', url: 'https://github.com/mon-pseudo' },
    { name: 'Discord', label: 'Mon serveur', url: 'https://discord.gg/votre-invitation' },
  ],
};
```

Les chemins sont relatifs à la page ; les liens HTTP et HTTPS sont acceptés.
Un nom ou un libellé est affiché comme du texte, jamais comme du HTML.
Sans musique, les contrôles audio sont désactivés avec un message explicite.
Sans réseau configuré, la page affiche un état vide. Une invitation `discord.gg`
active le bouton de copie. L’avatar générique est inclus et remplaçable.

Ajoute uniquement les médias que tu as le droit de publier. La photo, la musique
et les icônes officielles présentes sur le site personnel de Trim ne sont pas
distribuées ici. Les petits SVG inclus sont des alternatives génériques.

Le son démarre après interaction, continue entre les menus et garde le volume
et l’activation dans le stockage local du navigateur. Navigation par liens,
bouton Retour, historique et touche Échap. Les animations respectent
`prefers-reduced-motion`.

## Hébergement

Compatible avec un hébergement statique, dont GitHub Pages. Publie le contenu
du dépôt depuis la branche `main` et la racine dans les réglages Pages.
Ne mets jamais de secret dans `config.js` : ce fichier est public.

Docker est également fourni :

```sh
docker compose up -d --build
```

Le site écoute alors sur http://localhost:8080/. Pour changer le port hôte,
modifie uniquement la partie gauche de `8080:80` dans `docker-compose.yml`.

## Crédit obligatoire

Tu peux utiliser, modifier et redistribuer le modèle sous **GNU GPLv3**,
avec la clause d’attribution de la section 7(b) décrite dans [NOTICE](NOTICE).
**Le nom Trim doit rester dans les crédits du site dérivé.** Le volet
« Crédits : Trim » fourni remplit cette fonction ; tu peux le déplacer ou
le restyler tant qu’il reste accessible et lisible.

Conserve [LICENSE](LICENSE), [NOTICE](NOTICE) et les notices tierces. Les versions
du code que tu distribues doivent rester sous GPLv3 et être accompagnées de
leur source correspondante. Le modèle est fourni sans garantie.

Base historique : notice MIT de JAQLIV conservée dans
[LICENSES/MIT-original.txt](LICENSES/MIT-original.txt). Aucun lien avec Nintendo.

Site de Trim : https://kirbytrim.buzz/ · GitHub : https://github.com/trim360
