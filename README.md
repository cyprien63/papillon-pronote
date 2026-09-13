# Papillon — Portail ENT

Extension Chrome (Manifest V3) qui refond les pages scolaires avec le design de l'application
[Papillon](https://papillon.beta.gouv.fr/) :
la page de connexion du portail ENT **Skolengo CAS** (`cas.ent.auvergnerhonealpes.fr`),
la page de connexion **EduConnect** (`educonnect.education.gouv.fr`) et l'espace **PRONOTE**
(`*.index-education.net/pronote`).

## Fonctionnalités

- **Page de connexion ENT** restylée façon Papillon :
  - bandeau dégradé avec le logotype Papillon, panneau central, mise en page desktop plein écran ;
  - cartes de choix d'établissement (Elève ou parent / Enseignant / Accélérateur) arrondies et cliquables
    sur toute la carte, état de sélection en vert Papillon (`#29947A`) ;
  - accordéons et logo Skolengo masqués ou neutralisés, icônes `+`/`−` en couleur Papillon ;
- **Page de connexion EduConnect** : bannière Papillon pleine largeur, panneau 560px, tabs,
  champs et boutons aux couleurs Papillon (profil Élève / Responsable avec icônes dédiées) ;
- **Espace PRONOTE (Élèves)** : bandeau dégradé avec logotype Papillon (logo PRONOTE/établissement
  masqué), menu principal avec icônes **Papicons**, widgets en cartes arrondies avec badges,
  emploi du temps et travail à faire restylés, pied de page épuré ;
- **Mode sombre** réglable depuis les **paramètres de l'extension** (options : thème Clair / Sombre),
  appliqué à toutes les pages (connexions + PRONOTE).

## Installation

1. Ouvrir `chrome://extensions`
2. Activer le **mode développeur**
3. **Charger l'extension non empaquetée** → sélectionner ce dossier
4. Se rendre sur la page de connexion ENT : le thème s'applique automatiquement
5. Pour changer de thème : clic droit sur l'icône → **Options**

## Structure

```
manifest.json              Manifeste MV3 (options_ui, storage, content_script)
content/portal/portal.js   Script de contenu : branding + thème + sélection des cartes (ENT)
content/portal/portal.css  Thème Papillon (clair + sombre) pour la page de connexion ENT
content/educonnect/        Content script + thème pour la page de connexion EduConnect
content/pronote/           Content script + thème pour l'espace PRONOTE (accueil Élèves)
options/                   Page d'options (choix Clair / Sombre, stocké dans chrome.storage.sync)
assets/brand/              Assets officiels Papillon (logotype, icônes)
assets/icons/              Icônes Papicons (SVG, licence MIT) injectées dans l'espace PRONOTE
styles/fonts/              Police Inter (woff2)
icons/                     Icônes d'extension
```

## Fonctionnement

- Les content scripts injectent `portal.css` / `educonnect.css` / `pronote.css` + le branding dans la page
  et appliquent la classe `papillon-dark` sur `<html>` selon le thème enregistré.
- Pour PRONOTE, le DOM étant généré par `eleve.js` (réécrit à chaque navigation), un `MutationObserver`
  ré-applique le logotype et les icônes Papicons après rendu.
- Le choix de thème est lu dans `chrome.storage.sync` (`theme` : `light` par défaut, `dark` sinon),
  et appliqué en direct via l'événement `storage.onChanged`.
- Le restylage ne modifie pas le comportement des formulaires (radios, `wayf.js`, SAML, soumission PRONOTE).

## Roadmap

- [x] Espace PRONOTE : page d'accueil Élèves (bandeau, menu, widgets, emploi du temps, travail à faire).
- [ ] Autres pages PRONOTE (notes, agenda, cahier de textes…) — même méthode : source de la page → restyle.
- [ ] Élargir aux autres académies / portails Skolengo CAS (`*.ent.auvergnerhonealpes.fr` déjà visé).

## Note

Les assets graphiques proviennent du dépôt officiel **Papillon** (branche `dev`). Les icônes proviennent de
**Papicons** ([PapillonApp/Papicons](https://github.com/PapillonApp/Papicons), sous licence **MIT**).
Ce projet est un fork/restyle personnel non affilié à Papillon ni à l'académie.