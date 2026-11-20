# Changelog

## Unreleased (next release, not yet published)

- Owner dashboard: live preview of unpublished changes on the top screen, unsaved-changes
  badge with discard, page reordering (buttons and drag and drop), duplication, drafts,
  per-page menu icons, confirmed removal, restoration of deleted pages, backups tab with
  reversible restore, cream 3DS-style restyle.
- Appearance: DSi, eShop and Network themes, a custom palette with automatic WCAG
  contrast checks, and owner-chosen text size, shape, spacing, layout, panel style,
  decorations and animation intensity. Visitors keep their own theme, accent, text size,
  animation and readability choices.
- Optional profile details: status, favourite games, consoles, time zone, mascot,
  personal colour. Optional music loop.
- Compatibility: configuration schema stays at 2; 2.1.0 data loads unchanged (tested from a
  real 2.1.0 installation). The `website/` showcase folder is unchanged.
- Not included: block-based rich content editor, avatar cropping, a restore button for
  finished updates, additional interface languages (the README documents the manual
  update restore).

## 2.1.0

- Administration locale facultative dans le template distribué : compte privé,
  connexion à deux écrans inspirée des références NNID et récupération depuis setup.
- Édition persistante du profil, des pages, médias, réseaux, musique et apparence.
- Sessions HttpOnly, contrôle d’origine et CSRF, limitation des connexions,
  vérification des uploads et rejet des chemins privés lors de l’export.
- Mises à jour réservées au propriétaire ; installateur vérifié conservé,
  redémarrage du backend explicite après installation.
- Mode Docker propriétaire avec volume persistant ; export statique conservé.
- Migration additive du schéma 2, sauvegardes et détection des éditions concurrentes.

## 2.0.0

- Added persistent appearance, language, readability, animation and audio settings.
- Removed browser update checks; the owner's setup/CLI updater remains available.
- Refreshed the showcase with floating glass navigation and the supplied original Bagu.
- Replaced synthesized demo music with optional supplied MP3 input at build time.
- Added a working versioned template download, excluding personal media.
- Preserved existing profile data, icons, setup tools and update recovery.

## 1.2.0

- Shared English/French Easy Setup for Windows and Linux; no npm dependencies.
- Local media imports, separate profile/page JSON, atomic saves and backups.
- Optional pronouns, biography, cover, interests, projects, galleries and Sona pages.
- Configurable menu order, visibility, titles, initial page and credits.
- Browser language detection, persistent language selection and opt-in manual content translations.
- Existing audio playback retained, with declared Nintendo/artist credits.
- Stable GitHub Release checks and a separate installer with checksum verification,
  conflict detection, protected personal files, recovery journal and rollback.
- Static export and Docker build; neither setup nor updater publishes automatically.
- Original supplied 3DS settings wrench restored; original orange Nintendo Network
  mark used for the default profile icon. Other icons, geometry and styles retained.

### Français

- Easy Setup commun à Windows et Linux, en anglais/français, sans dépendance npm.
- Import local des médias, profil/pages JSON séparés, écritures atomiques et sauvegardes.
- Pronoms, biographie, couverture, centres d’intérêt, projets, galeries et pages Sona facultatifs.
- Ordre, visibilité et titres des menus, page initiale et crédits personnalisables.
- Détection de langue, choix persistant et traductions manuelles du contenu sur activation.
- Lecteur musical conservé, crédits Nintendo/artistes selon la déclaration du propriétaire.
- Versions stables GitHub Releases et installation séparée avec vérification des empreintes,
  détection des conflits, protection des données, journal de reprise et restauration.
- Export statique et build Docker ; aucune publication automatique.
- Clé 3DS fournie restaurée et véritable logo Nintendo Network orange pour le profil.
  Autres icônes, dimensions, espacements et effets conservés.
