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
  elements/<nom>/          Un dossier .css + .js par widget (header, edt, tav, grades,
                           viescolaire, informations, ressources, deconnexion,
                           devoirsurveille) — dossier ASCII `elements` (sans accent)
content/pronote/Cahier de textes/<page>/   Pages CDT (Contenus, TravailAFaire, Forums)
  Vue hebdomadaire/        Vue hebdo de Contenus **et** TravailAFaire
                           (1 .js par page, CSS commun voir ci-dessous)
content/pronote/Mes données/<page>/        Pages Compte, Documents
content/pronote/Notes/Mes Notes/           Page « Détail de mes notes » : carte Moyennes
                           (graphique SVG de l'historique des moyennes) + cartes de notes
content/pronote/Notes/relevé/             Page « Notes → Relevé » : carte d'état vide
                           (message « sera publié à partir du … ») + colonnes du bulletin
                           + modales « Méthode de calcul de la moyenne ». Fichiers en ASCII
                           (`releve.js` / `releve.css`) pour les chemins du manifest.
content/pronote/Notes/Mon bulletin de notes/  Page « Notes → Bulletins → Mon bulletin de
                           notes » : carte d'état vide (« Le bulletin sera publié à
                           partir du … ») + boutons du second menu. Fichiers en ASCII
                           (`bulletin.js` / `bulletin.css`). Bulletin publié non traité
                           (DOM inconnu tant qu'aucune période n'est publiée).
content/pronote/Notes/Bulletin de ma classe/  Page « Notes → Bulletins → Bulletin de ma
                           classe » : même traitement (carte d'état vide, icône `user.svg`,
                           boutons du second menu), classes `pap-bc-*`. Fichiers en ASCII
                           (`bulletinclasse.js` / `bulletinclasse.css`).
content/pronote/Notes/Anciens bulletins/     Page « Notes → Bulletins → Anciens bulletins » :
                           l'ARBRE des bulletins déjà publiés (année + trimestres) en carte
                           Papillon (lignes arrondies, icône `calendar` / `newspaper` par
                           ligne, chevron de dépliage teal, libellé `.sr-only` révélé en
                           titre de carte) + la POP-UP de dépôt du PDF
                           (`.ObjetFenetre_SelectionClouds_racine`). Classes `pap-ab-*`.
                            Fichiers en ASCII (`anciensbulletins.js` / `.css`).
content/pronote/Compétences/mes évaluations/  Page « Compétences → Évaluations → Mes
                           évaluations » (fil d'Ariane « Détail de mes évaluations ») :
                           le widget `.InterfaceDernieresNotes` en deux cartes
                           (liste / détail), carte d'état vide pointillée
                           (« Aucune évaluation disponible pour cette période »,
                           icône `ghost` + période en pastille), boutons du second
                           menu. Classes `pap-ev-*`. Fichiers en ASCII
                           (`mesevaluations.js` / `mesevaluations.css`). Lignes
                           d'évaluation et détail d'une évaluation sélectionnée non
                            traités (DOM inconnu : aucune période de test n'en affiche).
content/pronote/Compétences/Difficultés et points d'appui/  Page « Compétences → Évaluations →
                           Difficultés et points d'appui » (fil d'Ariane « Difficultés et
                           points d'appui ») : les DEUX `.PanelDonneesEleveListe`
                           (« Compétences non maîtrisées : 0 » / « Compétences maîtrisées :
                           0 ») en cartes côte à côte, le titre NATIF et sa pastille
                           d'icône **dans** la carte (`cross` pour les non maîtrisées,
                           `check` pour les maîtrisées), et, tant que la liste est vide,
                           masquage du squelette natif (`.liste_btnentete` +
                           `.liste-heriar` + `.liste_zone`) au profit d'un bloc
                           pointillé **à l'intérieur** de la carte (`ghost` + message +
                           pastilles de période ET de cycle). Boutons du second menu.
                           Classes `pap-dp-*`. Fichiers en ASCII (`difficultes.js` /
                            `difficultes.css`). Contenu des lignes non traité (DOM inconnu :
                            le tableau est `vide` sur toutes les périodes de test).
content/pronote/Compétences/Mon bilan périodique/  Page « Compétences → Bilan périodique →
                           Mon bilan périodique » (fil d'Ariane « Mon bilan
                           périodique ») : la carte d'état vide pointillée
                           (« Le bulletin de compétences sera publié à partir
                           du … », icône `graduation-hat` + date en pastille) et
                           les boutons du second menu. Classes `pap-bp-*`.
                           Fichiers en ASCII (`monbilanperiodique.js` /
                            `monbilanperiodique.css`). Bilan publié non traité
                            (DOM inconnu : aucun bilan de test n'est publié).
content/pronote/Compétences/Bilan périodique de ma classe/  Page voisine
                           « Compétences → Bilan périodique → Bilan périodique de ma
                           classe » (fil d'Ariane « Bilan périodique de ma classe ») :
                           quasi le même DOM que « Mon bilan périodique », donc
                           même carte d'état vide pointillée (« Le bulletin de
                           compétences sera publié à partir du … », **icône `user`**
                           + date en pastille) et les boutons du second menu. Classes
                           `pap-bpc-*`. Fichiers en ASCII
                           (`bilanperiodiqueclasse.js` / `.css`).
content/pronote/Compétences/Évaluations par compétence/  Page « Compétences → Bilan par
                           domaine → Évaluations par compétence » (fil d'Ariane
                           STRICTEMENT « Évaluations par compétence ») : la grille
                           BilanParDomaine Items / Niveau / Validé le en carte Papillon
                           pleine largeur. PRONOTE n'y affiche AUCUN titre (le libellé
                           vit dans le `sr-only` `#…_labelListe` du `aria-labelledby` de
                           la grille) : le JS injecte titre « Évaluations par
                           compétence » + compteur « N éléments » + pastille de
                           compétence (lue dans le combiné
                           `[aria-label="Sélectionnez une compétence"]` du troisième
                           menu). Chaque ligne de données est un groupe de TROIS
                           `.liste_celluleGrid` adjacents (une par colonne), les lignes
                           de domaine sont dépliables (cylindre de dépliage) et le DOM
                           fige des largeurs inline (1912px/1900px/1685px, grille
                           1717px 87px 96px, `grid-column:1/3 3/5 5/7`) à rendre
                           fluides. Classes `pap-bpd-*`. Fichiers en ASCII
                           (`evaluationsparcompetence.js` / `.css`).
content/pronote/Compétences/Niveaux de maitrise par matière/  Page « Compétences → Bilan
                           par domaine → Niveaux de maitrise par matière » (fil
                           d'Ariane STRICTEMENT « Niveaux de maitrise par matière »,
                           page voisine d'« Évaluations par compétence » — ne pas
                           élargir l'ancre en préfixe « Niveaux… », sinon les deux
                           pages se marquent) : DOM minimal d'état vide — aucune
                           `.Espace`/`.Table.BorderBox`/`.liste-*`, le `<div
                           role="note">` du message (« Le bulletin de compétences ne
                           contient aucune évaluation. », **icône `graduation-hat`**,
                           PAS de date) est enfant direct de la chaîne
                           `main.interface_affV_client > .interface_affV_padding >
                           .interface_affV_client`. Troisième menu : UN SEUL sélecteur
                           (période). Classes `pap-nm-*`. Fichiers en ASCII
                           (`niveauxmaitrise.js` / `niveauxmaitrise.css`).
                           Contenu publié (grille des niveaux de maitrise) non traité
                           (DOM inconnu tant qu'aucune évaluation n'existe).




content/pronote/Compétences/Livret de compétences numériques/  Page « Compétences →
                           Livret de compétences numériques » (fil d'Ariane
                           STRICTEMENT « Livret de compétences numériques ») : la
                           GRILLE du livret en carte Papillon — 3 colonnes
                           « Compétences numériques / Évaluations / Niveau » sur une
                           arborescence `role="treegrid"` (aria-rowcount par PRONOTE)
                           où chaque ligne est un groupe de TROIS `.liste_celluleGrid`
                           adjacents (une par colonne, `data-colonne="0|1|2"`), plus le
                           PIED `[id$="_pied"]` (« Appréciation de l'élève » +
                           textarea DÉSACTIVÉE, 10rem réservées par
                           `#…listeConteneur` en `calc(100% - 10rem)`). Aucun titre
                           n'est affiché : le libellé vit dans un
                           `span.sr-only[id$="labelListe"]` (en pratique `…_labelListe`,
                           AVEC underscore ; cibler par le suffixe court pour couvrir les
                           deux formes) → le JS l'injecte en
                           `.pap-lcn-title` + compteur (`.pap-lcn-count`, lu sur
                           `aria-rowcount` car la grille est virtualisée) + pastille de
                           cycle (`.pap-lcn-cycle`, lue dans le sélecteur masqué
                           `[aria-label="Sélectionnez un cycle"]` du troisième menu).
                           Colonnes Évaluations/Niveau vides → repli (même recette que
                           `evaluationsparcompetence`, jetons `pap-lcn-no-eval` /
                           `pap-lcn-no-niveau`). ⚠ ⚠ Contrairement à la page voisine,
                           il n'y a **PAS d'`aria-level`** sur cet arbre (les cellules
                           ne portent que `role="presentation"`/`role="gridcell"`) :
                           le niveau domaine/sous-domaine/item est lu par `cellLevel()`
                           sur la mise en forme INLINE — fond
                           `--theme-moyen1-scalePlus10` (domaine), `--theme-claire`
                           (sous-domaine), `--theme-neutre-moyen1` (item) + cylindre
                           de dépliage (groupes seuls) + `padding-left:12/24px` en
                           repli. ⚠ Troisième menu : le sélecteur de
                           cycle est masqué par PRONOTE dans un
                           `.element-bandeau-wrapper` en `display:none` inline QUE
                           `header.css` exposerait en `inline-flex !important` : une
                           règle scopée `:has(.pap-lcn)` le re-masque (ne pas
                           l'oublier, sinon le cycle réapparaît). ⚠ La textarea du
                           pied est désactivée (`:disabled`) : la styler, JAMAIS la
                           réveiller. Classes `pap-lcn-*`. Fichiers en ASCII
                            (`livretnumerique.js` / `.css`).
content/pronote/Compétences/Anciens bilans/  Page « Compétences → Anciens bilans »
                           (fil d'Ariane STRICTEMENT « Anciens bilans ») : l'ARBRE des
                           bilans périodiques publiés (année `aria-level=1` avec
                           chevron de dépliage, puis un bilan par trimestre
                           `aria-level=2`) en carte Papillon, au max-width 64rem
                           centré. Titre « Anciens bilans » INJECTÉ par le JS
                           (PRONOTE n'affiche aucun titre visible : le libellé
                           vit dans un `span.sr-only[id$="_labelListe"]` servant à
                           l'`aria-labelledby` de la grille `role="tree"`) +
                           compteur « N bilans », icône `calendar` sur l'année et
                           `graduation-hat` sur le trimestre, pastille « T1 »… à
                           droite, chevron teal, `hr.liste_sepligne` masqués.
                           Classes `pap-anb-*`. Fichiers en ASCII
                           (`anciensbilans.js` / `.css`).
                           ⚠ NE PAS CONFONDRE avec « Notes → Bulletins → Anciens
                           bulletins » (`pap-ab-*`) : pages voisines au DOM très
                           proche mais jetons distincts (`.pap-anb` ≠ `.pap-ab`, un
                           sélecteur de classe matche un jeton ENTIER) — ne jamais
                           raccourcir l'un en l'autre.




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

- `adjust(hex, pct)` et `svgWrap(...)` sont redéfinis dans chaque module qui en a
  besoin (tav, edt, grades, ressources, devoirsurveille, TravailAFaire + sa vue
  hebdomadaire ; `svgWrap` en plus dans informations, viescolaire, Documents,
  MesNotes, relevé, bulletin) — suivre la même signature.
  `normalizeSubject`/`EMOJI_MAP` (matières → émoji) existent dans `tav.js`,
  `grades.js` **et** `MesNotes.js` (copie locale, même logique).
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
- `Notes/relevé` : l'ancre est l'**égalité stricte** de `h1#breadcrumbBandeau[aria-label]`
  sur `"Mon relevé de notes"` — elle ne matche pas la regex `/d[ée]tail de mes notes/i` de
  `MesNotes.js`, donc les deux pages restent mutuellement exclusives. Ne pas élargir l'une
  des deux ancres, sinon les deux modules se marquent en même temps.
- `Notes/relevé` : tant que le relevé n'est pas publié, PRONOTE n'affiche qu'un
  `<div role="note">` et laisse le bulletin (`div.Espace.AlignementBas` + les
  `.EspaceBas` de `#…_PiedBull`) en `display:none` et vide. Seul l'état vide est donc
  restylé à fond ; l'intérieur du bulletin reste natif, à faire après un relevé publié
  (même logique que les colonnes du relevé). Ne pas confondre le `role="note"` de l'état
  vide avec celui de la bannière « Consultation temporaire » du second menu : le
  sélecteur est scopé à `main`.
- `Notes/Mon bulletin de notes` : même DOM que `Notes/relevé` (mêmes `.Espace`, même
  `_PiedBull` masqué, même bloc `width:70rem` du graphe araignée) mais un **fil d'Ariane
  différent** (`aria-label="Mon bulletin de notes"`) → module dédié `bulletin.js` /
  `bulletin.css` avec ses classes `pap-bul-*`, jamais `pap-rlv-*`. Les quatre ancres
  Notes restent mutuellement exclusives (égalité stricte pour `releve`, `bulletin` et
  `bulletinclasse`, regex `/d[ée]tail de mes notes/i` pour `MesNotes`).
- `Notes/Bulletin de ma classe` : quasi identique au DOM de `Notes/Mon bulletin de
  notes` (mêmes `.Espace`, même `.Espace.AlignementBas` + `_PiedBull` masqués, mais
  **sans** le bloc `70rem` du graphe araignée, et la bande de filtres ne contient que le
  sélecteur de période) → module dédié `bulletinclasse.js` / `bulletinclasse.css` avec
  ses classes `pap-bc-*`. Le message d'attente est « Le bulletin de la classe sera publié
  à partir du … » : l'icône est `assets/icons/user.svg` (pas `newspaper.svg`) pour
  distinguer la page de « Mon bulletin de notes ». Ancre **égalité stricte** sur
  `aria-label="Bulletin de ma classe"` — ne pas l'élargir en regex.
- `Notes/Anciens bulletins` : **seule** page Notes qui affiche une vraie LISTE
  (`.ObjetListe` `DonneesListe_BIA`, arbre `role="tree"`, lignes `.fd_ligne[data-colonne]`)
  et non un message d'attente. PRONOTE y fige des largeurs inline (`max-width:45rem` sur le
  wrapper, `width:496px` sur `.liste_zone`, `grid-template-columns:479px` sur
  `.liste_content_lignes`, `width:478px` sur `.liste_contenu_ligne`) et une hauteur fixe
  (`height:40px`, ajustée au nombre de lignes) sur le viewport `#…_Zone_1` → les remplacer
  (`minmax(0,1fr)`, `max-height: var(--pap-ab-h)`), sinon la carte reste étroite et la liste
  déborde sous le bas de l'écran. Le wrapper `max-width:45rem` qui contient la carte **n'est
  pas forcément un enfant direct du `<main>`** : l'élargir via
  `main….pap-ab div[style*="max-width"]:has(.pap-ab-list)` (et non `>` seulement).
  ⚠ Cette page n'a **aucun titre visible** : le libellé « Anciens bulletins » est un
  `span.sr-only[id$="_labelListe"]` posé en FIN de liste (servant à l'`aria-labelledby` de la
  grille), pas un `p.liste_enteteTxt` → c'est le JS qui l'injecte en `.pap-ab-title` dans
  `.liste_btnentete` (avec un `.pap-ab-count` et une `.pap-ab-trim` « T1 » par trimestre). Ancre
  **égalité stricte** sur `aria-label="Anciens bulletins"`. Le troisième menu y est **vide et
  masqué** (`nav#ligne_bandeau` en `display:none`) : ne jamais le styler.
- `Compétences/mes évaluations` : cette page réutilise le **widget** de `Notes/Mes Notes`
  (même div racine `.InterfaceDernieresNotes`, mêmes `section.ListeDernieresNotes` /
  `section.Zone-DetailsNotes`, mêmes largeurs inline `--liste-width:625px` /
  `--detail-width:600px`) mais pour les évaluations par compétence, avec un fil d'Ariane
  différent (`aria-label="Détail de mes évaluations"`) → ancre **égalité stricte** et
  classes `pap-ev-*`, et **jamais** `pap-mn-*`. Les six ancres (5 Notes + celle-ci) restent
  mutuellement exclusives. Comme `MesNotes.js` ne dé-classe pas ses marques, une
  navigation depuis « Mes notes » peut laisser `.pap-mn` sur le widget : vérifier en console
  que `main` ne porte **que** `pap-ev`.
  Tant qu'aucune période n'affiche d'évaluation, seul le squelette est restylé (cartes,
  largeurs, état vide) : la colonne de détail ne contient qu'un `&nbsp;` et est donc
  masquée (`.pap-ev-detail-vide`, la grille repassant à une colonne). Les blocs masqués en
  `visibility:hidden` du troisième menu (tri « Par ordre chronologique / Par matière »,
  bouton « Légende ») sont déjà retirés par `header.css` — ne pas refaire la règle.
- `Compétences/Difficultés et points d'appui` : ancre **égalité stricte** sur
  `aria-label="Difficultés et points d'appui"` (apostrophe droite, `d'appui` en un seul mot),
  classes `pap-dp-*`, **jamais** `pap-ev-*`. Les sept ancres (5 Notes + `mes évaluations` +
  celle-ci) restent mutuellement exclusives.
  Les deux titres natifs sont `BandeauTitreTypeResultats` (« Compétences non maîtrisées :
  0 ») : on les garde **tels quels** (texte et compte) et le JS n'injecte que la pastille
  d'icône devant eux — ne jamais scinder ni réécrire ce texte.
  « Compétences non maîtrisées » contient la chaîne « maîtrisées » : tester donc
  `/non\s+ma[îi]tris/i` en premier pour choisir la pastille (`cross` vs `check`).
  Le troisième menu porte **deux** sélecteurs (période PUIS cycle) : cibler chacun par son
  `aria-label` (« Sélectionner une période » / « Sélectionnez un cycle »), **jamais** le
  premier `.ocb-libelle` en aveugle.
  La carte d'état vide est injectée dans le `.ObjetListe` : ne **jamais** la re-appendre
  quand elle est déjà en place, `appendChild()` déplaçant le nœud → mutation `childList` →
  `processAll()` → boucle infinie. Enfin, PRONOTE masque `#…_pageMessage` et
  `#…_pageDonneesClasse` (panneau « données de la classe ») avec un `display:none` en ligne :
  cette feuille ne doit surtout pas les styler, sinon une règle `!important` révélerait un
  bloc vide.
  ⚠ L'état vide est signalé par la **classe `.vide`** de la liste et la hauteur du viewport
  est réécrite dans son `style` : ce sont des mutations d'**attribut**, invisibles pour un
  observateur `childList`. Or les deux panneaux ne sont pas rendus d'un seul coup, donc le
  second restait avec son tableau natif (largeurs 845px/833px figées) pour toute la session.
  D'où `onMutations()` : observer `attributes` (`class`, `style`) en plus de `childList`,
  filtrer sur la zone utile (les deux cartes ou le troisième menu), regrouper les passages par
  image (`requestAnimationFrame`) et poser les observateurs **avant** le premier
  `processAll()` — protégé par un `try/catch` — pour qu'aucune exception les empêche
  d'exister.
  ⚠ La mise en page est scopée sur `.pap-dp-panel`, **pas** sur un marqueur de liste
  (`.pap-dp-list` n'existe plus) : PRONOTE peut remplacer le nœud `.ObjetListe` entre deux
  rendus, et une liste non marquée doit rester aussi belle que les autres.
  ⚠ La carte porte le fond, la bordure et le rayon : le titre natif est **dedans**, et le bloc
  d'état vide est un bloc pointillé interne (pas une seconde carte). Cacher toute la carte
  « vide » faisait浮动 le titre et collait la pastille d'icône au bord de la colonne.
  ⚠ Entre `.liste-heriar` et `.liste_content`, la chaîne de flexibles comporte **deux**
  maillons, dont `div#…_contenuListe_0` qui ne porte AUCUNE classe : viser le maillon par
  `:has()` (`.liste_zoneFils > div:has(.liste_content)` et `div:has(> .liste_content)`), sinon
  le viewport reste à 0 de haut. Même piège de largeur : `div#…_Contenu_1` fige 833px en inline
  sans classe → le remettre à `width: auto` via `.liste_content div`, sinon la grille déborde
  et la carte affiche une barre de défilement horizontale.
  La grille à deux colonnes est forcée sur `.PageDonneesEleve` via un sélecteur préfixé par
  `main.interface_affV_client.pap-dp` (sinon le CSS natif de PRONOTE l'emporte et les deux
  cartes s'empilent).
- `Compétences/Mon bilan périodique` : ancre **égalité stricte** sur
  `aria-label="Mon bilan périodique"`, classes `pap-bp-*`, **jamais** `pap-bul-*` ni
  `pap-bc-*` ni `pap-bpc-*`. Les douze ancres (5 Notes + `mes évaluations` + `Difficultés
  et points d'appui` + `Bilan périodique de ma classe` + `Évaluations par compétence` +
  `Niveaux de maitrise par matière` + `Livret de compétences numériques` + celle-ci) restent mutuellement exclusives. La page voisine « Bilan périodique de ma classe » (même rubrique, DOM quasi
  identique) ne doit **pas** être attrapée : ne pas élargir l'ancre en regex ni en
  préfixe.
  ⚠ Contrairement aux pages Notes, le `<div role="note">` du message n'est **pas** un enfant
  direct de `.Espace` : la chaîne est `.Espace > .Table.BorderBox > .EspaceBas >
  [role="note"]` → le sélecteur de l'état vide est `.Espace [role="note"]` (descendant), et
  non `.Espace > [role="note"]` comme dans `bulletin.js` / `bulletinclasse.js`.
  Le `<main>` contient en outre un **deuxième** `<div role="note">` (bloc `.Table` de
  `70rem`, graphe / légende, enfant direct de `<main>`, `<p>` vide) : exclu par la borne
  `.Espace` et par le test de texte.
  Le masquage « rien à afficher » peut porter sur le `note` **ou** sur un de ses parents
  (`.EspaceBas`, `.Espace`) : `isHidden()` remonte la chaîne jusqu'au `<main>`. Et à
  l'inverse des modules Notes, un message qui disparaît (bilan publié) **démarque** la
  carte au lieu de la laisser en place, sinon `display:flex !important` afficherait une
  carte vide à côté du bilan. Seule la chaîne qui porte `.pap-bp-empty` est libérée en
  hauteur (`:has()`), jamais les `.EspaceBas` du bilan publié.
  Bilan publié (`#…_PiedBull` et ses `.EspaceBas`, `#…_conteneur-tabs`, `#…_bull_legende`)
  non traité : tous en `display:none` en ligne, ne pas les révéler.
- `Compétences/Bilan périodique de ma classe` : ancre **égalité stricte** sur
  `aria-label="Bilan périodique de ma classe"`, classes `pap-bpc-*`, **jamais** `pap-bp-*`
  ni `pap-bc-*`. Les douze ancres restent mutuellement exclusives. Ne **pas** élargir l'ancre
  en regex ni en préfixe « Bilan périodique… », sinon la page voisine « Mon bilan
  périodique » se marque aussi (deux cartes vides superposées).
  ⚠ `pap-bpc-*` (bilan périodique **de ma classe**) et `pap-bc-*` (Notes → « Bulletin de
  ma classe ») ne sont **pas** interchangeables, mais ils ne se recoupent **pas** non plus :
  ce sont deux jetons de classe distincts, donc `.pap-bc-empty` ne matche pas
  `class="pap-bpc-empty"` et inversement. Ne jamais « raccourcir » `pap-bpc-*` en `pap-bc-*`
  (le CSS de l'une styliserait alors la page de l'autre).
  Le DOM est celui de « Mon bilan périodique », à deux détails près : le message est
  identique (« Le bulletin de compétences sera publié à partir du … ») mais l'icône est
  `user.svg` (et non `graduation-hat.svg`, réservé au bilan individuel), et le
  `#…_PiedBull` masqué ne contient que **cinq** `.EspaceBas` (au lieu de dix) — sans
  conséquence tant que le bilan publié n'est pas traité.
- `Compétences/Évaluations par compétence` : ancre **égalité stricte** sur
  `aria-label="Évaluations par compétence"`, classes `pap-bpd-*`, **jamais** `pap-ev-*` ni
`pap-dp-*` ni `pap-bp-*` ni `pap-bpc-*`. Les douze ancres Compétences/Notes restent
   mutuellement exclusives ; ne **pas** élargir l'ancre en regex (elle ressemblerait à
   « Détail de mes évaluations » / « Mes évaluations » de `mesevaluations.js`).
   ⚠ La page voisine « Niveaux de maitrise par matière » (même sous-menu « Bilan par
   domaine ») vit dans un dossier séparé (`niveauxmaitrise.js` / `.css`, classes
   `pap-nm-*`) : l'ancre de « Niveaux… » est une égalité stricte distincte, donc les deux
   modules n'interfèrent pas ; ne jamais élargir leurs ancres en préfixe commun.
  ⚠ DOM inédit : ici une « ligne » de la grille n'est PAS un élément — chaque ligne est un
  groupe de TROIS `.liste_celluleGrid` adjacents (une par colonne Items/Niveau/Validé le),
  FRÈRES consécutifs de la grille (survol/sélection de ligne via `+ .pap-bpd-cell +
  .pap-bpd-cell`). La ligne de domaine est détectée par son cylindre de dépliage
  (`.liste_contenu_cellule_deploiement`) dans la première cellule ; la sélection active est
  `.selected` sur LES TROIS cellules (pas `:has([role=démarque])`).
  ⚠ PRONOTE fige des largeurs/hauteurs en inline à TOUTE la chaîne (largeur 1912px sur
  `.liste_btnentete`/`.liste_zone`/`.liste_zoneFils`, grille `grid-template-columns:1717px
  87px 96px` avec `grid-column:1/3 3/5 5/7` sur les cellules ET l'en-tête, largeurs 1685/1688/
  70/80px, viewport `height:670px`) : remettre `width:auto` + `grid-column:auto` partout et
  `flex` la chaîne `.liste_zone → .liste_zoneFils → .liste-heriar (×2) → div#…_contenuListe_0
  → .liste_content → #…_Zone_1`, sinon la carte reste large et la liste déborde sous le bas
  de l'écran (mêmes recettes que `difficultes` / `anciensbulletins`). La chaîne vide la mode
  NATIVE : le viewport est #…_Zone_1 uniquement (pas #…_Contenu_1, div[style] descendant).
  ⚠ Aucun titre n'est affiché : `.pap-bpd-title` injecté depuis le `sr-only` `#…_labelListe`
  (garde `pap-bpd-*` posée par le JS, `if (el.textContent !== txt)` obligatoire).
  ⚠ PRONOTE pose aussi un bloc final `div[style="height:80px"]` avec deux `.EspaceHaut` (la
  note CECRL en `display:none` — ne jamais la révéler) : le replier via
  `.EspaceHaut:empty`. Le troisième menu porte une checkbox
  `label.iecb` (SANS `.as-chips`) « Uniquement les éléments avec évaluations » : pastille
via `:has(input:checked)`, sans jamais toucher au display des trois SVGs internes
   (PRONOTE n'en montre qu'un selon `.on`/`.off`). Le sélecteur de cycle est désactivé
   (`aria-disabled="true"`) : ne pas le réveiller.
- `Compétences/Livret de compétences numériques` : ancre **égalité stricte** sur
  `aria-label="Livret de compétences numériques"`, classes `pap-lcn-*`, **jamais**
  `pap-bpd-*` ni `pap-nm-*`. Les douze ancres Compétences/Notes restent mutuellement
  exclusives ; ne **pas** élargir l'ancre en préfixe « Livret… ». Même DOM de
  « Évaluations par compétence » (grille à TROIS `.liste_celluleGrid` adjacents par ligne,
  `data-colonne` 0/1/2, largeurs inline 1910px/1898px, grille `1595px 217px 86px`,
  viewport `#…_Zone_1` de 666px) à traiter avec la même recette (`width:auto`,
  `flex` la chaîne, barre de défilement `--pap-lcn-sb` compensée à l'en-tête). La
  différence : c'est un **arbre** (`role="treegrid"`), mais ⚠ **PAS d'`aria-level`**
  sur ce DOM réel (les cellules ne portent que `role="presentation"`/`role="gridcell"`) :
  `cellLevel()` lit donc le niveau domaine/sous-domaine/item sur la mise en forme
  INLINE — fond `--theme-moyen1-scalePlus10` (niveau 1 = domaine en gras, pastille
  teal claire), `--theme-claire` (niveau 2 = sous-domaine, bande neutre), `--theme-neutre-moyen1`
  (niveau 3+ = item), replié par le cylindre de dépliage (groupes seuls) et
  `padding-left:12/24px` (l'`aria-level` restant lu en priorité s'il apparaît un jour).
  L'indentation passe par `data-pap-lcn-niveau` posé sur la **case intérieure**
  (jamais sur la cellule). ⚠ Le titre
  vit dans un `span.sr-only[id$="labelListe"]` : injecter depuis ce sr-only. En pratique
  l'id est `…Instances[0]_labelListe` (AVEC underscore, comme sur la page voisine bpd) :
  cibler par le **suffixe court** `[id$="labelListe"]` couvre les deux formes, donc ne pas
  figer la variante observée. ⚠ La page n'a PAS de note CECRL : le
  bloc final est le **pied** `[id$="_pied"]` (« Appréciation de l'élève », hauteur 10rem
  réservée par `#…listeConteneur` en `calc(100% - 10rem)` ; c'est `_pied` en fin d'id, PAS
  `.pied`) — le marquer via `markPied()` →
  `.pap-lcn-pied`, la textarea DÉSACTIVÉE (`:disabled`) étant stylée mais JAMAIS réveillée.
   Le pied est le **frère** de `#…listeConteneur` — et non son enfant, mais
   comme lui un enfant direct de `div.EspaceGauche.EspaceDroit`, seul wrapper
   du `<main>` : ce wrapper est la **colonne flex** de la page
   (`main { display:flex }` + `wrapper { flex:1 1 auto }`), sinon la pile
   `height:100%` / `calc(100% - 10rem)` de PRONOTE déborde de 10rem sous le
   bord bas. Le pied est donc une **seconde carte arrondie**, centrée comme la
   grille sur le même `max-width: min(100% - 24px, 1120px)` (bords alignés au
   pixel) et séparée par une gouttière de 14px — sans elle, les deux cartes se
   lisaient comme un seul bloc.
  ⚠ Le troisième menu masque le sélecteur de cycle dans un `.element-bandeau-wrapper` en
  `display:none` inline QUE `header.css` exposerait en `inline-flex !important` : règle
  scopée `:has(.pap-lcn)` pour le re-masquer. Une seule checkbox : « Uniquement les items
  évalués » (nu, ne pas le styler dynamiquement — le filtrage peut vider la grille).
  ⚠ **La grille est VIRTUALISÉE** : `role="treegrid"` porte `aria-rowcount="184"` pour
  ~20 lignes réellement dans le DOM. D'où (a) le compteur `.pap-lcn-count` qui lit
  `aria-rowcount` (compter les cellules rendues donnerait 20) ; (b) les gouttières
  `.gabarit-refresh` (le second vaut 6520px) et `._range_0` / `._range_1`, placées AVEC et
  APRÈS les cellules en `grid-column: 1/4` : leur passer `grid-column: 1 / -1` (sinon le
  repli des colonnes Évaluations/Niveau crée deux colonnes implicites et une barre
  horizontale) et **jamais** `display:none` (elles donnent la hauteur de défilement) ;
  (c) la fausse barre de PRONOTE (`.liste_cont_btnscroll` > `._vertical_*` >
   `.real-scroll`, 8×7319px) est masquée au profit du vrai défilement de `#…_Zone_1`.
- `Compétences/Anciens bilans` : ancre **égalité stricte** sur
  `aria-label="Anciens bilans"`, classes `pap-anb-*`, **jamais** `pap-ab-*` (ni aucun
  autre jeton Compétences/Notes). Les treize ancres restent mutuellement exclusives ; ne
  **pas** élargir l'ancre en regex ni en préfixe commun « Ancien… » avec « Anciens
  bulletins », sinon les deux pages « d'archives » se marquent en même temps.
  ⚠ **Même famille de DOM que `Notes → Anciens bulletins`** (`.ObjetListe`
  `DonneesListe_BIA`, `role="tree"`, lignes `.fd_ligne[data-colonne]`, `hr.liste_sepligne`
  entre les lignes, sr-only `_labelListe` en fin de liste) : la recette de mise en page
  d'`anciensbulletins.css` s'applique telle quelle. Les largeurs figées diffèrent
  (`max-width:45rem` sur le wrapper, 450px sur `.liste_btnentete`/`.liste_zone`, 433px sur
  la grille, 432px sur `.liste_contenu_cellule_contenu`, `height:847px` sur le viewport
  `#…_Zone_1`) → même correction (`width:auto` sur toute la chaîne, `max-height:
  var(--pap-anb-h)` + `overflow:auto` sur le viewport, `minmax(0,1fr)` sur la grille).
  ⚠ Ici le wrapper `max-width:45rem` EST un enfant direct du `<main>` (contrairement à
  `Anciens bulletins`, où il peut être imbriqué) : le sélecteur `> div[style*="max-width"]`
  suffit, la variante `:has(.pap-anb-list)` est gardée en filet. La carte garde sa
  hauteur native (contenu) et non la hauteur de l'écran, comme sur la page voisine :
  l'arbre ne compte qu'une année + ses trimestres, une carte pleine hauteur serait vide.
  ⚠ Les lignes enfant (trimestre) n'ont **pas** de `.zone-centrale` : le libellé est
  directement dans `.liste_contenu_ligne` sous `.zone-principale`, alors que l'année
  passe par `.zone-centrale > .zone-contenu-format > .zone-principale`. Cibler les
  trois maillons à plat (comme le fait la feuille) couvre les deux formes.
  ⚠ Le troisième menu est `<nav id="ligne_bandeau">` **vide** et `display:none` inline :
  `header.css:260` (`nav…:not(:has(*))`) le masque déjà, ne pas ajouter de règle
  contraire. Les deux boutons du second menu (Enregistrer, PDF) sont des
  `<i class="btnImageDisable btnImage">` **désactivés** sur le DOM fourni
  (`aria-disabled="true"` + infobulle « Aucun PDF pour cet affichage ») : les styler en
  pastilles fantômes estompées, **jamais** les réveiller. La pop-up de dépôt du PDF
  (si un jour le bouton redevient actif) n'est pas traitée : DOM inconnu.
- ⚠ **Ne jamais réécrire `textContent` d'un noeud injecté à chaque `processAll()`** (titre,
  compteur, pastille de trimestre) : l'observateur `body`/`childList` se redéclenche sur
  l'écriture, qui en provoque une autre, etc. → boucle infinie qui gèle l'onglet. Toujours
  tester `if (el.textContent !== txt)` avant d'écrire.
- **Sur les listes en arbre, `role="treeitem"`, `aria-level` et `aria-selected` sont sur le
  div INTÉRIEUR de la ligne** (`.liste_contenu_cellule`), pas sur `.fd_ligne` (qui ne porte
  qu'un `data-colonne`). Conséquence : `.fd_ligne[role="treeitem"]` ne matche RIEN, et pour
  colorer la ligne sélectionnée il faut `:has([role="treeitem"][aria-selected="true"])` —
  la classe `.selected`, elle, est bien sur `.fd_ligne`.
- **Le fil d'Ariane peut être modifié EN PLACE** (même `<h1>`, `aria-label` réécrit) : les
  observateurs `childList` ne le voient pas, et les marques de l'ancienne page restent
  collées. `anciensbulletins.js` observe donc `#breadcrumbBandeau`
  (`attributeFilter: ['aria-label']`) et ré-attache son observateur quand PRONOTE remplace
  le nœud (`watchBreadcrumb()`).
- **Les boutons d'action du second menu (Enregistrer, Générer le PDF) sont des
  `<i class="btnImage">`** : ni `<a>`, ni `<button>`, ni `[role=button]`. La règle globale
  de `header.css` ne les touche donc pas, et ils restent invisibles. Chaque page qui en a
  doit donc styler SON PROPRE bloc `.menu-commandes .btnImage` scopé à `:has(.pap-xx)`
  (pastille `#f1f1f1` / bordure `#e7efee`, icône `currentColor`, survol `#ddf2ec` +
  `#157a63`, désactivés estompés). Et ne jamais styler les `<li>` du menu : le troisième
  porte la bannière « Consultation temporaire » que PRONOTE masque en `display:none`.
- `Notes/Anciens bulletins` — **pop-up de dépôt du PDF** : rendue dans `#zone_fenetre`, donc
  hors du `<main>`, et réutilisée comme lui → `demark()` doit passer par les classes
  `pap-ab-*` (pas par un sélecteur de page) et la marquer via `markFenetre()`. Racine :
  `.ObjetFenetre_SelectionClouds_racine` → `.pap-ab-fenetre` (+ `pap-ab-cloud` par ligne de
  cloud, `pap-ab-cloud-hint` pour la phrase d'invite). Style : même recette que la fiche CDT
  (`.pap-vh-fiche`) — variables `--pap-ab-fiche-*`, `.Fenetre_Cadre` en radius 20px, titre
  tronqué au choix, boutons Fermer/Déplacer en pastille en haut à droite, bouton principal
  `button.themeBoutonPrimaire:not([style*="display: none"])` (« Voir le PDF »).
  ⚠ Ne jamais réveiller « Voir le document » ni l'engrenage des options PDF : tous deux en
  `display:none` (d'où le `:not([style*="display: none"])`). Les logos des clouds
  (`div.Image_Icone_Logo*`) sont des fonds natifs : ne pas les remplacer.
- **Le `<main>` de PRONOTE est RÉUTILISÉ d'une page à l'autre** (et `#zone_fenetre`
  aussi) : une classe `pap-*` posée par un module reste collée quand on navigue
  ailleurs, et la feuille de style de l'ancienne page continue de s'appliquer. Tout
  module de page doit donc **dé-classer ses marques hors de sa page** : `processAll()`
  appelle `demark()` quand `onPage()` est faux, avec un drapeau `marked` pour ne pas
  reparcourir le DOM à chaque mutation, et un **balayage forcé au boot** (`processAll(true)`)
  car après un rechargement de l'extension les modules re-s'exécutent sur un DOM déjà
  marqué (drapeau encore à `false`). `demark()` dépose aussi la classe et **unwrap** la
  `<b>` de date qu'il avait insérée dans le texte de PRONOTE.
- **Le second menu et le troisième menu doivent rester collés** : les deux barres sont
  `position: sticky` (`top` = `--pap-menu-h` puis `--pap-menu-h + --pap-second-h`,
  mesurés par `header.js`). Ne surtout pas remettre de `margin-top` sur
  `nav.objetBandeauEntete_thirdmenu` : la fente blanche qui en résulte laisse passer le
  contenu de la page au scroll, et elle est très visible sur les pages dont la bande ne
  contient qu'un sélecteur de période (`Notes/Mon bulletin de notes`).
- Les blocs que PRONOTE masque avec `visibility: hidden` en ligne (bouton « Graphe
  araignée » du troisième menu, `div.element-bandeau-wrapper`) **réservent leur boîte**
  dans la barre flex : on les retire au CSS via `[style*="visibility: hidden"]` (c'est
  déjà invisible, donc aucun comportement touché). Viser le style inline, jamais l'`id`
  de ces blocs : il change d'une page à l'autre (`id_154_bandzone_2` sur Mon bulletin,
  `id_216_bandzone_2` ailleurs).
- `Notes/Mon bulletin de notes` : le `<main>` contient **deux** `<div role="note">` —
  celui de l'état vide (parent direct `.Espace`) et celui du bloc `70rem` du graphe
  araignée (parent `.interface_affV`, `<p>` vide). Le sélecteur de l'état vide est donc
  scopé à `.Espace > [role="note"]` + test `/bulletin/i` sur le `<p>`.


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
7. Sur `Notes → Relevé` : vérifier la carte d'état vide (icône + date en pastille), changer
   de période (le message peut changer de date) et sortir/revenir sur la page — pas de
   doublon d'icône. Les deux modales « Méthode de calcul de la moyenne » ne sont
   observables qu'une fois le relevé publié : vérifier alors au minimum que la classe
   `pap-rlv-fenetre` est bien posée (console) et que la modale ne déborde pas.
8. Sur `Notes → Bulletins → Mon bulletin de notes` : même vérifications que pour le
   Relevé (carte d'état vide, icône `newspaper`, date en pastille), **plus** le test de
   fuite : aller sur `Relevé`, revenir sur `Mon bulletin de notes` et vice-versa 2 fois —
   en console, `main` ne doit porter **que** `pap-bul` (jamais `pap-rlv`, ni
   `data-pap-rlv`). Vérifier aussi que la bannière « Consultation temporaire » masquée
   (`li[style*="display: none"]`) n'est pas révélée, et que le bloc `70rem` du graphe
   araignée reste masqué. Sur cette page la bande de filtres ne contient que le
   sélecteur de période : vérifier qu'il n'y a **plus de fente entre le second menu et
   le troisième menu** et que l'emplacement du bouton « Graphe araignée » masqué
   (`div.element-bandeau-wrapper[style*="visibility: hidden"]`) ne réserve plus de trou.
9. Sur `Notes → Bulletins → Bulletin de ma classe` : mêmes vérifications que pour
   « Mon bulletin de notes », avec l'icône `user` et le message « Le bulletin de la
   classe sera publié à partir du … ». Test de fuite : enchaîner les trois pages
   (`Relevé` → `Mon bulletin de notes` → `Bulletin de ma classe`) 2 fois ; en console,
   `main` ne doit porter **qu'un seul** marqueur de page (`pap-rlv` OU `pap-bul` OU
   `pap-bc`, jamais deux) et le `<div role="note">` une seule carte. Vérifier aussi que
   la bande de filtres (sélecteur de période seule) est bien collée au second menu.
10. Sur `Notes → Bulletins → Anciens bulletins` : la carte doit être élargie (titre
   « Anciens bulletins » révélé + bouton de recherche sur une seule ligne, lignes de l'arbre
   en pastilles arrondies avec leur icône `calendar` / `newspaper`, chevron de dépliage
   visible en teal, aucun `hr` visible) et le défilement doit rester DANS la carte. Tester le
   dépliage de « Année 2025/2026 », la recherche (aucun doublon d'icône), le clic sur un
   trimestre → **pop-up de dépôt du PDF** (cadre arrondi, titre tronqué, boutons
   Fermer/Déplacer, « Voir le PDF » en dégradé, 3 lignes de cloud en pastilles avec logo et
   bouton d'info, phrase d'invite en gris) puis sa fermeture, et le thème Clair ↔ Sombre.
   Test de fuite : enchaîner `Relevé` → `Anciens bulletins` → `Mon bulletin de notes` 2 fois ;
   en console, `main` ne doit porter qu'un seul marqueur de page (`pap-rlv` OU `pap-ab` OU
   `pap-bul`), le `.ObjetListe` qu'un seul `pap-ab-list`, et après fermeture de la pop-up
   plus aucun `pap-ab-fenetre` dans `#zone_fenetre`. Vérifier que le troisième menu vide
   (`nav#ligne_bandeau` en `display:none`) n'apparaît pas, que « Consultation temporaire »
   reste masquée, et que rien ne déborde sous le bord bas de l'écran.
11. Sur `Compétences → Évaluations → Mes évaluations` : la page doit n'afficher qu'**une**
    carte pleine largeur — l'état vide pointillé « Aucune évaluation disponible pour cette
    période », icône `ghost` et **période en pastille** (« Trimestre 1 ») — sans colonne de
    détail vide à côté (`.pap-ev-detail-vide` en console). Changer de période : la pastille
    suit le sélecteur du troisième menu, sans doublon d'icône. Test de fuite : enchaîner
    `Notes → Mes notes` → `Mes évaluations` 2 fois ; en console, `main` ne doit porter que
    `pap-ev` (jamais `pap-mn`, ni `pap-rlv`/`pap-bul`), et plus aucun `pap-ev-*` après être
    reparti sur une autre page. Vérifier que les deux boutons du second menu (Enregistrer,
    PDF) sont bien visibles en pastille fantôme (désactivés) et que « Consultation
    temporaire » reste masquée, ainsi que la bande de filtres (sélecteur de période seule)
     collée au second menu. Thème Clair ↔ Sombre.
12. Sur `Compétences → Évaluations → Difficultés et points d'appui` : la page doit afficher
    **deux cartes côte à côte** — « Compétences non maîtrisées : 0 » (pastille `cross` rouge)
    et « Compétences maîtrisées : 0 » (pastille `check` teal) — le titre étant **dans** la
    carte, à ~16px de sa bordure (et non collé au bord), et chacune occupée par un bloc vide
    pointillé qui occupe toute la place restante sous le titre (`ghost`, message
    « Aucune compétence … maîtrisée », pastilles « Trimestre 1 » **et** « Cycle 4 »), le
    squelette natif (barre d'outils, colonnes « Items / Évaluations », viewport) devant être
    invisible. Changer de période PUIS de cycle : les deux pastilles suivent, sans doublon
    d'icône ni dédoublement du bloc vide. **Les deux cartes doivent être traitées** : si celle
    de droite affiche encore les colonnes « Items / Évaluations » et une hauteur figée, c'est
    que le `.vide` n'a pas été vu (mutation d'attribut) — recharger l'extension. Vérifier aussi
    que rien ne déborde sous le bord bas de l'écran et qu'aucune barre de défilement
    horizontale n'apparaît dans les cartes.
    Test de fuite : enchaîner `Mes évaluations` → `Difficultés et points d'appui` 2 fois ; en
    console, `main` ne doit porter qu'un seul marqueur de page (`pap-ev` OU `pap-dp`, jamais
    les deux), **chacun** des deux `.PanelDonneesEleveListe` porter `pap-dp-panel` +
    (`pap-dp-neg` OU `pap-dp-pos`) + `pap-dp-panel-vide` et un `.pap-dp-puce`, et au plus un
    `.pap-dp-empty` par `.ObjetListe` ; plus aucun `pap-dp-*` après être reparti sur une autre
    page. Vérifier que les deux boutons du second menu sont
    visibles en pastille fantôme (désactivés), que « Consultation temporaire » reste masquée,
    que le panneau « données de la classe » (`#…_pageDonneesClasse`) reste invisible, et
     qu'aucun bloc ne déborde sous le bord bas de l'écran. Thème Clair ↔ Sombre.
13. Sur `Compétences → Bilan périodique → Mon bilan périodique` : la page doit n'afficher
    qu'**une** carte d'état vide pointillée — « Le bulletin de compétences sera publié à
    partir du 23/11/26 », icône `graduation-hat` et **date en pastille** teal — occupant la
    hauteur disponible (rien ne doit déborder sous le bord bas de l'écran), et les deux
    boutons du second menu (Enregistrer, PDF) en pastilles fantômes désactivées. Changer de
    période : le message (et donc la date) peut changer, sans doublon d'icône. Test de fuite :
    enchaîner `Difficultés et points d'appui` → `Mon bilan périodique` 2 fois, puis aller sur
    la page voisine `Bilan périodique de ma classe` et revenir ; en console, `main` ne doit
    porter que `pap-bp` (jamais `pap-dp`, `pap-ev`, `pap-rlv`, `pap-bul`, `pap-bc`), et
    `main .Espace [role="note"]` ne porter qu'un seul `pap-bp-empty` (avec un unique
    `.pap-bp-empty-date` et une seule icône). Après être reparti sur une autre page : plus
    aucun `pap-bp-*`. Vérifier que « Consultation temporaire » reste masquée, que le bloc
    `70rem` et le `#…_PiedBull` restent invisibles, et que la bande de filtres (sélecteur de
    période seule) est collée au second menu. Thème Clair ↔ Sombre.
14. Sur `Compétences → Bilan périodique → Bilan périodique de ma classe` : mêmes
    vérifications que pour « Mon bilan périodique », avec l'icône `user` (et non
    `graduation-hat`) et le même message d'attente. Test de fuite : enchaîner
    `Mon bilan périodique` → `Bilan périodique de ma classe` 2 fois, puis aller sur la page
    voisine et revenir ; en console, `main` ne doit porter que `pap-bpc` (jamais `pap-bp`,
    `pap-dp`, `pap-ev`, `pap-rlv`, `pap-bul`, `pap-bc`), et `main .Espace [role="note"]` ne
    porter qu'un seul `pap-bpc-empty` (avec un unique `.pap-bpc-empty-date` et une seule
    icône). ⚠ Vérifier aussi, sur cette page, que rien ne prend la feuille de style de
    `Notes → Bulletin de ma classe` (`.pap-bc`) : les deux pages « de ma classe » sont
    ailleurs dans l'arborescence, donc ne pas les confondre à la navigation. Après être
    reparti sur une autre page : plus aucun `pap-bpc-*`. Vérifier que « Consultation
    temporaire » reste masquée, que le bloc `70rem` et le `#…_PiedBull` (à ses **cinq**
    `.EspaceBas`) restent invisibles, et que la bande de filtres (sélecteur de période seule)
    est collée au second menu. Thème Clair ↔ Sombre.
15. Sur `Compétences → Bilan par domaine → Évaluations par compétence` : la page doit
    afficher une seule carte pleine largeur avec le titre injecté « Évaluations par
    compétence », un compteur (« 16 éléments » selon le nombre d'items) et la pastille de la
    compétence courante (`D1.2 - Langues étrangères - ANGLAIS LV1`), une en-tête de colonnes
    douce (Items / Niveau / Validé le), des lignes de DOMAINE en gras sur pastille teal claire
    avec chevron teal et des items en texte naturel. Le défilement doit rester DANS la carte
    (rien ne déborde sous le bord bas de l'écran, pas de barre horizontale). Survoler une
    ligne : toute la ligne se teinte ; cliquer un item : la ligne sélectionnée reste teintée
    (`.pap-bpd-cell.selected`). Déplier un domaine : les items enfants s'affichent sans
    doublon. Changer de compétence ou d'évaluation dans le troisième menu : le compteur et la
    pastille de compétence suivent, la checkbox « Uniquement les éléments avec évaluations »
    (pastille teal quand cochée) filtre, le sélecteur de cycle reste estompé (désactivé).
    Test de fuite : enchaîner `Difficultés et points d'appui` → `Évaluations par compétence`
    → `Bilan périodique de ma classe` 2 fois ; en console, `main` ne doit porter qu'UN seul
    marqueur de page (`pap-bpd` OU `pap-dp` OU `pap-bpc`, jamais deux), le `.ObjetListe` qu'un
    seul `pap-bpd-list`, et plus aucun `pap-bpd-*` après être reparti sur une autre page.
    Vérifier que la note CECRL reste masquée, que le `#…_message` reste masqué, que les deux
    boutons du second menu sont en pastilles fantômes (désactivés), que « Consultation
    temporaire » reste masquée, et que la bande de filtres est collée au second menu.
    Thème Clair ↔ Sombre.
16. Sur `Compétences → Bilan par domaine → Niveaux de maitrise par matière` : la page doit
    n'afficher qu'**une** carte d'état vide pointillée — « Le bulletin de compétences ne
    contient aucune évaluation. », icône `graduation-hat` et **PAS de date en pastille**
    (contrairement aux pages bilans, le message ne contient aucune date) — occupant la
    hauteur disponible (rien ne doit déborder sous le bord bas de l'écran), et les deux
    boutons du second menu (Enregistrer, PDF) en pastilles fantômes désactivées. Le
    troisième menu porte un **seul** sélecteur (période) : la bande de filtres doit être
    collée au second menu, sans fente. Changer de période : pas de doublon d'icône.
    Test de fuite : enchaîner `Évaluations par compétence` → `Niveaux de maitrise par
    matière` 2 fois ; en console, `main` ne doit porter qu'UN seul marqueur de page
    (`pap-bpd` OU `pap-nm`, jamais deux), `main [role="note"]` qu'un seul `pap-nm-empty`
    (avec une unique icône), et plus aucun `pap-nm-*` après être reparti sur une autre
    page. Vérifier que « Consultation temporaire » reste masquée. Thème Clair ↔ Sombre.
17. Sur `Compétences → Livret de compétences numériques` : la page doit afficher une seule
    carte **centrée** (largeur plafonnée à 1120px, marges latérales égales) avec le titre
    injecté « Livret de compétences numériques », un
    compteur (« N éléments » selon le nombre d'items) et la pastille du cycle courante
    (« Compétences numériques » selon le sélecteur), une en-tête de colonnes douce
    (Compétences numériques / Évaluations / Niveau), des lignes de DOMAINE en gras sur
    pastille teal claire avec chevron teal, les sous-domaines sur bande neutre et les items
    en texte naturel indentés. Le défilement doit rester DANS la carte (rien ne déborde sous
    le bord bas de l'écran, pas de barre horizontale), et le pied « Appréciation de l'élève »
    doit former une **seconde carte en dessous**, de MÊME largeur que la grille (bords
    gauche et droit alignés au pixel) et **séparée par une gouttière visible** — s'il est
    collé à la carte du dessus, la gouttière de 14px n'est pas passée. Sa textarea
    désactivée est stylée et occupe la place restante. Les
    colonnes Évaluations / Niveau (vides tant qu'aucune évaluation n'existe) doivent être
    repliées : la grille n'affiche qu'une colonne de libellés, sans barre horizontale.
    Survoler une ligne : toute la ligne se teinte ; déplier un domaine : les items enfants
    s'affichent sans doublon. Changer de cycle dans le troisième menu : la pastille de cycle
    suit ; cocher « Uniquement les items évalués » filtre la grille.
    Test de fuite : enchaîner `Niveaux de maitrise par matière` → `Livret de compétences
    numériques` 2 fois ; en console, `main` ne doit porter qu'UN seul marqueur de page
    (`pap-nm` OU `pap-lcn`, jamais deux), le `.ObjetListe` qu'un seul `pap-lcn-list` (avec
    un unique `.pap-lcn-title`, `.pap-lcn-count` et `.pap-lcn-cycle`), et plus aucun
    `pap-lcn-*` après être reparti sur une autre page. Vérifier que le sélecteur de cycle ne
    réapparaît pas (re-masqué par la règle `:has(.pap-lcn)`), que les deux boutons du second
    menu sont en pastilles fantômes (désactivés), que « Consultation temporaire » reste
    masquée, et que la bande de filtres est collée au second menu. Thème Clair ↔ Sombre.


18. Sur `Compétences → Anciens bilans` : la page doit afficher une seule carte
    **centrée** (largeur plafonnée à 64rem, marges latérales égales) avec le titre
    injecté « Anciens bilans », un compteur (« 3 bilans ») et le bouton de recherche
    sur une seule ligne ; les lignes de l'arbre en pastilles arrondies avec leur icône
    `calendar` (année) / `graduation-hat` (trimestre), une pastille « T1 »… à droite,
    le chevron de dépliage visible en teal, aucun `hr` visible, et rien qui ne déborde
    sous le bord bas de l'écran. La carte doit garder sa hauteur de CONTENU (ne pas
    chercher à la remplir : l'arbre ne compte qu'une année + ses trimestres). Déplier
    l'année puis la replier, rechercher (aucun doublon d'icône), sélectionner un
    trimestre (ligne teintée), et ouvrir la recherche plusieurs fois — pas de doublon,
    pas de perte d'icône. Thème Clair ↔ Sombre.
    Test de fuite : enchaîner `Livret de compétences numériques` → `Anciens bilans`
    → `Notes → Bulletins → Anciens bulletins` 2 fois ; en console, `main` ne doit porter
    qu'UN seul marqueur de page (`pap-lcn` OU `pap-anb` OU `pap-ab`), le `.ObjetListe` qu'un
    seul `pap-anb-list` (avec un unique `.pap-anb-title` et `.pap-anb-count`), et plus aucun
    `pap-anb-*` après être reparti sur une autre page. Vérifier que les deux boutons du
    second menu sont en pastilles fantômes (désactivés), que « Consultation temporaire »
    reste masquée, que le troisième menu vide n'apparaît pas, et que la bande de filtres
    (absente) ne laisse pas de fente sous le second menu.
