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
content/pronote/Cahier de textes/<page>/   Pages CDT (Contenus, TravailAFaire, Forums)
  Vue hebdomadaire/        Vue hebdo de Contenus **et** TravailAFaire
                           (1 .js par page, CSS commun voir ci-dessous)
content/pronote/Mes données/<page>/        Pages Compte, Documents
content/pronote/Notes/Mes Notes/           Page « Détail de mes notes » : carte Moyennes
                           (graphique SVG de l'historique des moyennes) + cartes de notes
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
- `Contenus.js` et `TravailAFaire.js` **sortent tôt** (`.DonneesListe_RessourceMatiere`
  absente) en **vue hebdomadaire** : leurs classes ne sont pas posées du tout. Ce sont
  `Cahier de textes/<page>/Vue hebdomadaire/VueHebdomadaire.js` qui la marquent, via le
  fil d'Ariane `h1#breadcrumbBandeau[aria-label="…"]` (« Contenus et ressources
  pédagogiques » / « Travail à faire à la maison ») + `#conteneur-page.Timeline` — d'où
  l'importance de cette ancre (le DOM de la timeline est identique sur les autres pages
  PRONOTE).
- Les **deux** vues hebdomadaires partagent le même DOM : une seule feuille de style,
  `Contenus/Vue hebdomadaire/VueHebdomadaire.css`, déclarée **une seule fois** dans le
  Manifest, stylise les classes communes `pap-vh*` posées par les deux `.js`. Ne pas
  dupliquer ce CSS dans le dossier TravailAFaire (ni y déclarer un second CSS).
- La modale « Contenu du cours » (`.ObjetFenetre_Espace.ObjetFenetre_racine` contenant
  `.conteneur-fiche-CDT`) est rendue **hors de `#conteneur-page`**, dans `#zone_fenetre` :
  elle est marquée par `markFenetre()` (classe `.pap-vh-fiche`), pas par la timeline.
- PRONOTE pose des **dimensions inline fixes** (largeur/hauteur) sur les conteneurs de
  listes et de colonnes : les remplacer par `height:auto` + `max-height:calc(100vh - …)`
  bâti sur `--pap-menu-h` / `--pap-second-h` (barres sticky mesurées par `header.js`),
  sinon le contenu déborde sous le bas de l'écran. Voir `VueHebdomadaire.css` (colonnes
  de jours, 780px) et `Documents.css` (listes, 865px).
- L'élément témoin de la classe `pap-edt-*` masque le texte source ; ne pas le supprimer
  du DOM, sinon le badge « En cours » se duplique au re-rendu.
- `Notes/Mes Notes` : le DOM ne contient **aucune moyenne générale ni aucun coefficient** —
  `MesNotes.js` la calcule (moyenne des notes ramenées sur 20, ou moyenne des moyennes par
  matière, ou médiane) et la **reconstruit à chaque changement de période/tri**. Ne pas
  reconstruire la carte sur un simple changement de ligne sélectionnée : la signature
  (`state.sig`) sert justement à éviter de casser le graphique pendant la navigation.
- `Notes/Mes Notes` : le `datetime` des dates est en `MM-DD` **sans année** et PRONOTE
  peut lister du plus récent au plus ancien — `chrono()` détecte le sens puis « déroule »
  les mois. En mode « Par matière » l'ordre n'est pas chronologique : on suit alors
  l'ordre d'affichage.
- Le thème est relu en direct via `chrome.storage.onChanged` ; re-tester la bascule
  Clair ↔ Sombre après chaque modification.

## Test manuel (avant de considérer une tâche terminée)

1. Charger le dossier dans `chrome://extensions` (Mode développeur).
2. Ouvrir PRONOTE : vérifier bandeau, widgets, cartes (`pap-*`), lisibilité sombre/clair.
3. Naviguer dans le menu (le DOM est reconstruit) : pas de doublons, pas de perte d'icônes.
4. Sur les pages à plusieurs affichages (Cahier de textes → Contenus et ressources) :
   basculer Chronologique ↔ Hebdomadaire et changer de semaine (flèches) — pas de
   doublon, pas de résidu de l'autre affichage.
5. Sur `Notes → Mes notes` : changer de période, basculer « Par ordre chronologique » ↔
   « Par matière », sélectionner un devoir (panneau de détail) et survoler le graphique —
   pas de doublon, la courbe suit bien la période.
6. Changer le thème depuis les Options : l'UI se recolorise sans recharge.