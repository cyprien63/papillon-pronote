---
name: papillon-pronote
description: Règles de design Papillon pour l'extension Papillon-Pronote (tokens couleur, cartes arrondies, mode sombre, icônes Papicons, MutationObserver sur le DOM PRONOTE). À lire avant toute modification de content/, styles/ ou options/.
---

# Papillon — Règles de design (extension Chrome)

Ce skill encode le design de l'extension **Papillon — Portail ENT** qui refond le
portail Skolengo CAS, la page EduConnect et l'espace **PRONOTE** avec le design de
l'application [Papillon](https://papillon.beta.gouv.fr/). Toute nouvelle fonctionnalité
ou restyle doit respecter ces règles pour rester cohérent avec le reste du repo.

## Architecture

- Extension Chrome **Manifest V3**. Trois zones de contenu :
  `content/portal/` (page ENT), `content/educonnect/` (page EduConnect),
  `content/pronote/accueil/` (espace PRONOTE).
- Chaque widget PRONOTE vit dans `content/pronote/accueil/elements/<nom>/<nom>.{css,js}`
  (header, edt, tav, grades, viescolaire, informations, ressources).
- Chaque `css`/`js` doit être déclaré dans `manifest.json` dans `content_scripts`
  ET dans `web_accessible_resources` (fonts, PNG, SVG chargés via
  `chrome.runtime.getURL(...)`).
- Le thème est lu depuis `chrome.storage.sync` (`theme` : `light` par défaut, `dark`
  sinon) et appliqué par `pronote.js` via la classe `html.papillon-dark` +
  `documentElement.style.colorScheme`. Le changement de thème est écouté avec
  `chrome.storage.onChanged`.

## Palette Papillon

Source de vérité : `content/pronote/accueil/pronote.css`, section
`/* ---------- Palette Papillon ---------- */`.

- Dégradé `--papillon-grad` : `linear-gradient(140deg,#35bba0 0%,#2ea08a 46%,#227e6b 100%)`
  (bandeau header, bannières, boutons principaux).
- Vert Papillon primaire : **`#35bba0`** ; vert de sélection/radio : **`#29947a`** ;
  vert profond : `#227e6b`.

| Rôle          | Clair                        | Sombre (`html.papillon-dark`) |
|---------------|------------------------------|-------------------------------|
| Fond page     | `#ffffff`                    | `#101513`                     |
| Surface carte | `#ffffff`                    | `#1a211e`                     |
| Bordure       | `#e7efee`                    | `#2a3531`                     |
| Texte         | `#10130f`                    | `#e7efec`                     |
| Texte doux    | `#8a9b95`                    | `#93a79f`                     |
| Hover         | `#f2f6f5`                    | `#202926`                     |
| Accent primaire | `#35bba0`                  | `#35bba0`                     |

> **Note brand** : l'application officielle Papillon utilise **`#121212`** comme fond
> sombre. Cette extension s'en écarte volontairement avec **`#101513`** (fond page) et
> **`#1a211e`** (cartes). Ne pas « corriger » ces valeurs vers `#121212`.

## Typographie

- Police **Inter**, fournie localement en woff2 (`styles/fonts/`), poids **400 à 800**.
- Base : `font-size: 15px`, `line-height: 1.5`, `font-family: 'Inter', -apple-system,
  BlinkMacSystemFont, 'Segoe UI', sans-serif`.

## Cartes arrondies & rayons

- **Cartes widget** : `border-radius: 25px` (edt, grades, tav, ressources,
  viescolaire, informations).
- Sous-cartes / gros éléments internes : `22px`, `20px`, `18px`, `16px` ; popups ~`20px`.
- Pills / chips / badges : `300px` ou `999px` ; cercles : `50%` / `100%`.
- **En mode sombre**, une carte type :
  `background:#1a211e; border-color:#2a3531; box-shadow:0 2px 8px rgba(0,0,0,.3)`.

## Mode sombre

- Appliqué par la classe `html.papillon-dark` (jamais un `@media (prefers-color-scheme)`).
- **Tous** les textes doivent rester clairs en sombre : couvrir les sélecteurs non
  restylés via des règles `html.papillon-dark …` (cf. « Textes restants » dans pronote.css).
- La norme est `!important` pour écraser le CSS natif de PRONOTE (les règles PRONOTE ont
  souvent une spécificité élevée).

## Icônes Papicons

- SVG chargés via `chrome.runtime.getURL('assets/icons/papicons/<fichier>.svg')`,
  FETCHés et mis en cache (`ICON_CACHE` / `loadIcon`).
- Injectés **inline** dans un `<span class="papillon-icon" data-papicon="...">`.
- Le SVG source contient `fill="black"` → remplacé par `fill="currentColor"` au
  chargement ; CSS associé : `.papillon-icon svg path { fill: currentColor }`.

## MutationObserver sur le DOM PRONOTE

PRONOTE réécrit son DOM à chaque navigation et fait des re-rendus périodiques
(ex. badge « En cours »). Pattern canonique (cf. `elements/tav/tav.js`, `edt.js`,
`grades.js`, …) :

1. **Observer de contenu** sur `document.body` : `{ childList: true, subtree: true }`
   → rappelle `processAll()`.
2. **Observer de thème** sur `document.documentElement` :
   `{ attributes: true, attributeFilter: ['class'] }` → purge les jetons de cache
   (ex. `delete w.dataset.papTav`) puis re-`processAll()`.
3. **Idempotence** :
   - garde `data-papillon` posée sur `<html>` au boot (`pronote.js`) pour ne pas
     exécuter le bootstrap deux fois ;
   - jeton par élément traité (`dataset.papTav`, etc.) pour ne pas re-transformer ;
   - pour les re-rendus, **masquer** la source (classe `pap-edt-source`) plutôt que
     la supprimer du DOM.

## Conventions de code

- IIFE : `(() => { 'use strict'; ... })()` ; commentaires en **français**.
- Helpers réutilisables :
  - `adjust(hex, pct)` — ajuste la luminance d'une couleur (équivalent du
    `adjustColor` de Papillon) ;
  - `svgWrap(inner, component)` — enveloppe un SVG inline dans `.papillon-icon` ;
  - `normalizeSubject` + `EMOJI_MAP` — attribuer un émoji à chaque matière
    (normalisation NFD minuscules, mapping par mot-clé).
- Restyler sans casser le comportement des formulaires PRONOTE (radios, SAML,
  soumission).

## Vérification rapide

Toujours tester sur la page PRONOTE réelle : observer dans le DOM que le widget
transformé porte bien les classes `pap-*` / `papillon-*`, que les textes restent
lisibles en mode sombre, et que la navigation + rechangement de thème ne dupliquent
pas les éléments (idempotence).