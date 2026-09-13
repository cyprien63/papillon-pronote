# Papillon — Portail ENT

Extension Chrome (Manifest V3) qui refond la page de connexion du portail ENT **Skolengo CAS**
(`cas.ent.auvergnerhonealpes.fr`) avec le design de l'application [Papillon](https://papillon.beta.gouv.fr/),
sur desktop.

## Fonctionnalités

- **Page de connexion** restylée façon Papillon :
  - bandeau dégradé avec le logotype Papillon, panneau central, mise en page desktop plein écran ;
  - cartes de choix d'établissement (Elève ou parent / Enseignant / Accélérateur) arrondies et cliquables
    sur toute la carte, état de sélection en vert Papillon (`#29947A`) ;
  - accordéons et logo Skolengo masqués ou neutralisés, icônes `+`/`−` en couleur Papillon ;
- **Mode sombre** réglable depuis les **paramètres de l'extension** (options : thème Clair / Sombre),
  appliqué aussi bien à la page de connexion qu'à la page d'options.

## Installation

1. Ouvrir `chrome://extensions`
2. Activer le **mode développeur**
3. **Charger l'extension non empaquetée** → sélectionner ce dossier
4. Se rendre sur la page de connexion ENT : le thème s'applique automatiquement
5. Pour changer de thème : clic droit sur l'icône → **Options**

## Structure

```
manifest.json              Manifeste MV3 (options_ui, storage, content_script)
content/portal/portal.js   Script de contenu : branding + thème + sélection des cartes
content/portal/portal.css  Thème Papillon (clair + sombre) pour la page de connexion
options/                   Page d'options (choix Clair / Sombre, stocké dans chrome.storage.sync)
assets/brand/              Assets officiels Papillon (logotype, icônes)
styles/fonts/              Police Inter (woff2)
icons/                     Icônes d'extension
```

## Fonctionnement

- Le content script injecte `portal.css` + un bandeau de marque dans la page de login et
  applique la classe `papillon-dark` sur `<html>` selon le thème enregistré.
- Le choix de thème est lu dans `chrome.storage.sync` (`theme` : `light` par défaut, `dark` sinon),
  et appliqué en direct via l'événement `storage.onChanged`.
- Le restylage ne modifie pas le comportement du formulaire (radios, `wayf.js`, soumission).

## Roadmap

- [ ] Autres pages PRONOTE (accueil élève, notes, agenda…) — même méthode : source de la page → restyle.
- [ ] Élargir aux autres académies / portails Skolengo CAS (`*.ent.auvergnerhonealpes.fr` déjà visé).

## Note

Les assets graphiques proviennent du dépôt officiel **Papillon** (branche `dev`). Ce projet est
un fork/restyle personnel non affilié à Papillon ni à l'académie.