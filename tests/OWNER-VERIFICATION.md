# Template 2.1 — vérification du 15 novembre 2026

Les fichiers du template racine sont concernés, ainsi que le ZIP et le paquet
de mise à jour. Le backend reste facultatif ; aucun compte réel n’est précréé.

| Vérification exécutée | Résultat |
| --- | --- |
| `node --test tests/config.test.mjs tests/update.test.mjs tests/owner.test.mjs website/tests/build.test.mjs` | 37 tests réussis, Windows, Node 24.22.1 |
| Tests du template sans la vitrine, dans le ZIP extrait sous Linux et Node 22 | 30 tests réussis, y compris authentification, uploads et mises à jour |
| ZIP neuf : setup, export statique, création du compte et connexion | Réussi sur Windows et Linux, Node 24.22.1 |
| Ancien `main` 5418d73 : installation du vrai paquet 2.1 par son ancien updater | Réussie ; config, profil, page, image et marqueurs privés conservés octet pour octet |
| Profil migré : édition authentifiée, redémarrage et confidentialité du compte | Réussi sur Windows et Linux |
| Chromium via Playwright 1.65 : connexion incorrecte, connexion valide, récupération au clavier, import, édition des sept catégories, publication, rechargement, déconnexion | Réussi ; aucune exception JavaScript |
| Nouvel onglet visiteur : thème initial, page personnalisée et refus de l’API privée | Réussi |
| Éditeur à 320, 390, 768 et 1280 px | Sept catégories testées à chaque largeur ; aucun débordement horizontal |
| Axe : connexion et éditeur | Aucune violation WCAG 2/2.1 A/AA détectée automatiquement |
| Docker : construction des cibles static et owner depuis le ZIP extrait | Réussie sur Debian |
| Conteneur Nginx statique : site, page d’aide propriétaire, absence d’API JSON et refus du dossier privé | Réussi |
| Conteneur propriétaire non root : création du compte, édition, suppression/recréation du conteneur avec le même volume | Profil et connexion conservés ; fichier de compte en 0600 |
| Conteneurs de production avant/après ces tests isolés | Identifiants identiques ; conteneurs de test arrêtés et retirés |

Les tests d’authentification couvrent l’origine, le Host, CSRF, les cookies
Secure sous origine HTTPS, les sessions expirées/réinitialisées, la limitation
des tentatives, les uploads invalides, les chemins privés, les conflits de
révision et le retour à l’ancien profil si la reconstruction échoue.
Le test d’update propriétaire utilise un paquet vérifié déterministe ; il ne
prétend pas installer une version future depuis GitHub.
La commande de création du compte a aussi été exécutée dans un terminal
interactif Linux : les deux saisies du mot de passe n’apparaissent pas dans
la sortie du terminal.

Le visuel conserve les fichiers originaux du N et de la clé 3DS. La capture
de connexion a été relue : identité et consignes en haut, champs et actions
en bas, sans déformation des images. Focus, labels, récupération avec Échap,
erreurs de connexion et état statique ont été vérifiés. Le bouton de mise à
jour n’existe que dans l’espace propriétaire. Aucun nouvel asset généré.

Limites : interface propriétaire en français, Chromium automatisé uniquement ;
pas de test physique Safari, Firefox, mobile ou Nintendo 3DS. Le contrôle Axe
ne remplace pas un audit d’accessibilité humain complet. Le backend HTTP local
a été testé, ainsi que les règles d’origine HTTPS et les cookies Secure ; le
certificat et le proxy TLS dépendent de l’hébergement choisi. Aucun domaine,
proxy Cloudflare ni `.env` de production n’a été modifié pour ces tests.

Choix de sécurité : [Node.js scrypt](https://nodejs.org/api/crypto.html#cryptoscryptpassword-salt-keylen-options-callback),
[gestion des sessions OWASP](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html),
[protection CSRF OWASP](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html).


# Prochaine version (branche `next-generation`) — vérifications exécutées

Ces résultats concernent le template racine uniquement ; le dossier `website/` n’a pas été modifié.

| Vérification | Résultat |
| --- | --- |
| `node --test tests/*.test.mjs website/tests/build.test.mjs`, fichier par fichier, Windows, Node 26.13 | 54 tests réussis, 0 échec |
| Même commande dans `node:22` sous Linux (Docker, avec l’historique Git) | 54 tests réussis, 0 échec |
| `tests/upgrade.test.mjs` : installation 2.1.0 reconstruite depuis le tag, personnalisée, mise à jour par l’installateur vérifié | Profil, pages, média, crédits, traductions, réglages et `.owner/account.json` identiques octet pour octet ; connexion propriétaire, édition, export statique et sauvegarde d’avant mise à jour vérifiés |
| `tests/owner-next.test.mjs` : aperçu de brouillon, sauvegardes, pages supprimées | Accès refusé sans session ; brouillon jamais écrit sur le disque ; chemins privés et traversées refusés ; origine/CSRF exigés |
| `tests/appearance.test.mjs` : thèmes, palette personnalisée, préférences visiteur | Contrastes de tous les thèmes ≥ 4,5:1 ; palette illisible refusée et non rendue ; préférences 2.1.0 conservées |
| `browser-tests/owner-dashboard.mjs` (Playwright 1.65, Chromium, 375/1280/1920 px) | 64 vérifications réussies : aperçu réel du brouillon, badge, annulation, pages (flèches, duplication, confirmation, restauration), sauvegardes, flèches du clavier, aucun débordement ni erreur console |
| `browser-tests/appearance.mjs` (320 et 1280 px) | 89 vérifications réussies : 6 thèmes, 11 options de design sur 3 pages, boutons ≥ 44 px, préférences visiteur persistantes, thème personnalisé, mouvement réduit |
| `browser-tests/profile-fields.mjs` | 9 vérifications réussies : aucune section vide, champs remplis affichés, mobile 320 px |

Limites connues de cette vérification :

- Le glisser-déposer natif de Chromium sans interface ne se déclenche pas dans Playwright ; le test
  envoie donc les mêmes événements `dragstart`, `dragover`, `drop` et `dragend` au gestionnaire.
  Le déplacement par les flèches est testé avec de vrais clics.
- Seul Chromium a été utilisé ; Firefox et Safari ne sont pas testés.
- Aucun appareil physique (iPhone, Android) n’a été utilisé ; les largeurs de téléphone sont émulées.
- Le déploiement Docker propriétaire et la création de la release n’ont pas été relancés pour cette branche.
- `template-manifest.json` n’a pas été régénéré : il l’est par `scripts/release.mjs` lors de la préparation de la release.
