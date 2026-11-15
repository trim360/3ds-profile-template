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
