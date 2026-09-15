# CLAUDE.md

## Contexte

Extension Chrome (Manifest V3) qui refond le portail ENT (Skolengo CAS et EduConnect)
et l'espace **PRONOTE** avec le design de l'application [Papillon](https://papillon.beta.gouv.fr/).
Restyle purement visuel : ne jamais modifier le comportement des formulaires PRONOTE
(radios, `wayf.js`, SAML, soumission).

## Commandes de base

- Aucune étape de build : le dossier est chargé tel quel.
- Tester : `chrome://extensions` → Mode développeur → **Charger l'extension non empaquetée**
  → sélectionner ce dossier. Puis se rendre sur `*.index-education.net/pronote` (PRONOTE),
  `cas.ent.auvergnerhonealpes.fr/login*` (ENT) ou `educonnect.education.gouv.fr`.
- Thème : clic droit sur l'icône → **Options** (clair/sombre, stocké dans `chrome.storage.sync`).

## ⚠️ À lire avant de modifier l'UI

Le skill **`papillon-pronote`** (`.claude/skills/papillon-pronote/SKILL.md`) encode toutes
les règles de design : palette, rayons des cartes, mode sombre, icônes Papicons et le
pattern MutationObserver. Invoque-le via `/papillon-pronote` (ou il se charge
automatiquement quand la tâche touche `content/`, `styles/` ou `options/`).

## Structure

```
content/portal/            Content script + thème de la page ENT (portal.css/js)
content/educonnect/        Content script + thème de la page EduConnect
content/pronote/accueil/   Espace PRONOTE — script CSS sous pronote.css + pronote.js (bootstrap)
  éléments/<nom>/          Un dossier .css + .js par widget (header, edt, tav, grades,
                           viescolaire, informations, ressources)
options/                   Page d'options (thème Clair / Sombre)
assets/brand/              Assets officiels Papillon (logotype, favicon, splash)
assets/icons/papicons/     Icônes Papicons (SVG, MIT) injectées dans PRONOTE
styles/fonts/              Police Inter (woff2 locales)
manifest.json              Déclare les content_scripts + web_accessible_resources
```

## Règles de codage

- **Manifest** : chaque nouveau `.css`/`.js` de contenu doit être ajouté en doublon à
  `manifest.json` : dans `content_scripts` (le `css` cible la page, le `js` exécute le
  script) **et** dans `web_accessible_resources` (`chrome.runtime.getURL(...)` sert les
  SVG, PNG, woff2 — uniquement ce qui s'y trouve est accessible).
- **Thème** : s'applique via la classe `html.papillon-dark` posée par `pronote.js`
  (`applyTheme`), jamais par `@media (prefers-color-scheme)`. Redéclarer chaque nouveau
  sélecteur en sombre (`html.papillon-dark …`) pour que les textes restent clairs.
- **Mode sombre** : fond page `#101513`, surfaces cartes `#1a211e`, bordure `#2a3531`,
  texte `#e7efec` (voir palette complète dans le skill).
- **DOM PRONOTE réécrit à chaque navigation** : tout boostrap doit être **idempotent**
  (garde `data-papillon` sur `<html>`, jeton `dataset.pap*` par élément) et s'appuyer
  sur le pattern **MutationObserver** double (voir skill) : un observer sur
  `document.body` (`childList`+`subtree`) → `processAll()`, un sur `document.documentElement`
  (`attributeFilter: ['class']`) → re-thème. Pour les re-rendus, **masquer** la source
  (classe `pap-edt-source`) plutôt que la supprimer.
- **Icônes** : icônes Papicons chargées via `chrome.runtime.getURL('assets/icons/papicons/*.svg')`,
  FETCHées en cache, injectées **inline** dans un `<span class="papillon-icon">`,
  `fill="black"` remplacé par `fill="currentColor"`.
- **Style** : IIFE `(() => { 'use strict'; ... })()` ; commentaires en français ;
  le CSS d'écrasement de PRONOTE utilise `!important`.

## Pièges connus

- `adjust(hex, pct)` et `svgWrap(...)` sont redéfinis dans chaque module `elements/`
  (tav, edt, grades, informations, viescolaire) — suivre la même signature.
  `normalizeSubject`/`EMOJI_MAP` (matières → émoji) n'existent que dans `tav.js`.
- L'élément témoin de la classe `pap-edt-*` masque le texte source ; ne pas le supprimer
  du DOM, sinon le badge « En cours » se duplique au re-rendu.
- Le thème est relu en direct via `chrome.storage.onChanged` ; re-tester la bascule
  Clair ↔ Sombre après chaque modification.

## Test manuel (avant de considérer une tâche terminée)

1. Charger le dossier dans `chrome://extensions` (Mode développeur).
2. Ouvrir PRONOTE : vérifier bandeau, widgets, cartes (`pap-*`), lisibilité sombre/clair.
3. Naviguer dans le menu (le DOM est reconstruit) : pas de doublons, pas de perte d'icônes.
4. Changer le thème depuis les Options : l'UI se recolorise sans recharge.