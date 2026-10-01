# Site de présentation — Papillon Portail ENT

Site statique de présentation pour l'extension
[Papillon — Portail ENT](https://github.com/cyprien63/papillon-pronote).

Il vit sur la branche `SITE` du dépôt papillon-pronote, volontairement séparée de
`main` : le site ne touche pas au code de l'extension, et l'extension ne touche
pas au site.

## Pages

| Fichier | Contenu |
|---|---|
| `index.html` | Accueil : ce que fait l'extension, chiffres clés, installation, données stockées |
| `pages/fonctionnalites.html` | Détail page par page : connexion, accueil, notes, compétences, design |
| `pages/branches.html` | Séparation `main` / `SITE`, règles GitHub, graphe des commits |
| `pages/mentions-legales.html` | Éditeur, hébergeur, licences, RGPD, cookies, sécurité |

## Structure

```
index.html              page d'accueil
pages/                  pages secondaires
data/commits.json       chiffres des commits, source du générateur
tools/commits.mjs       écrit le graphe dans la page + le JSON
.github/workflows/      régénération automatique de l'instantané
assets/css/style.css    feuille de style unique
assets/js/site.js       thème, navigation mobile, apparition au défilement
assets/fonts/           Inter 400→800, embarquée (10 fichiers woff2)
assets/img/             logotype, icônes, splash
LICENSE                 MIT
.nojekyll               désactive Jekyll sur GitHub Pages
CLAUDE.md               documentation du projet (conservée)
.claude/skills/         règles de design et de commit (conservées)
```

## Aucune dépendance, aucune étape de build

Du HTML et du CSS servis tels quels. Pas de npm, pas de bundler, pas de
framework, pas de police distante. Le site fonctionne en ouvrant `index.html`
directement dans un navigateur.

## Le graphe des commits

`pages/branches.html` affiche l'activité par jour et par branche. Les données
viennent de l'historique Git, **pas** de l'API GitHub.

Ce choix est une contrainte : la page des mentions légales promet qu'aucune
requête ne part du navigateur. Récupérer le graphe à l'affichage rendrait cette
promesse fausse. Il est donc produit en amont, par `tools/commits.mjs`.

Le graphe est **écrit directement dans le HTML**, entre des marqueurs
`<!-- graphe:…:debut -->`, et non injecté par le navigateur. Conséquence
concrète : « voir la source » montre le graphe, et la page reste lisible
sans JavaScript. `assets/js/branches.js` a été supprimé, il n'avait plus de
rôle. Le site n'a donc plus que deux scripts, et un seul pour tout le site :
`site.js`.

`data/commits.json` est conservé : c'est lui qui alimente le générateur, et il
donne les chiffres sans qu'il faille lire le HTML.

```bash
node tools/commits.mjs
```

### Pourquoi la page annonce moins de commits que GitHub

La page annonce **72** commits pour `main` et **19** pour `SITE`. GitHub affiche
**72** et **25**. `main` tombe juste. `SITE` a 6 commits d'écart, et ils ont
tous la même origine.

L'écart vient des commits que la mécanique crée en se régénérant : les commits
du workflow, et les fusions de sa propre pull request. Le raisonnement tient en
une phrase : **un fichier produit par un générateur ne peut pas compter ce que
la génération produit.** Le workflow écrit la page, tu merges sa PR, la
branche gagne deux commits, la page change, le workflow rouvre une PR. Sans
exclusion, le cycle n'a pas de fin.

Ce sont donc les seuls commits écartés, et le filtre est écrit pour viser cette
mécanique-là, rien de plus. La réconciliation est dans la sortie du générateur :

```
$ node tools/commits.mjs
  main : 72 représentés sur 72 dans la branche
  SITE : 19 représentés sur 25 dans la branche (écartés : 3 fusions de la PR du graphe, 3 commits du robot)
```

**Le terminal, et lui seul, peut porter le compte des écartés.** C'est la leçon
de la section suivante : ces chiffres ne peuvent pas revenir dans un fichier
versionné, puisque le fichier les ferait changer.

Les compteurs vivaient dans une variable unique, calculée sur `git log --all` :
ils étaient vrais globalement et impossibles à répartir sur une branche. C'est
pour ça que `sur` est posé sur *tous* les commits lus, y compris les écartés —
sinon il n'y a aucun moyen de distinguer, pour `main`, ses fusions de celles de
`SITE`.

### « 72 commits sur main » n'est pas ton nombre de commits

Un deuxième écart, de même nature mais qu'aucun réglage ne referme : le gros
chiffre compte l'activité du dépôt, et le dépôt n'est pas à toi seul.

```
main   72   dont 10 par SpartisPerso
SITE   19   dont 5 par une adresse sans compte
```

Donc 62 commits de `main` et 14 de `SITE` t'appartiennent. Le reste est réel —
le travail de SpartisPerso sur les menus, le thème sombre et le contraste est
dans l'historique — mais il ne se retrouve pas sur ton profil GitHub. C'est ce
qui rendait le chiffre « faux » à qui le comparait à son profil : il l'était
pour cette raison, et pas pour une erreur de comptage.

Pour le voir, il a fallu lire l'adresse mail des commits et non leur nom
d'auteur. `%an` est du texte libre, et le dépôt contient « Cyprien63 »,
« cyprien63 » et « Cyprien » pour la même personne : compter par nom additionne
tout le monde sans dire pourquoi.

L'adresse, elle, n'est pas devinable non plus. Cinq commits de `SITE` sont
signés `cyprien@users.noreply.github.com`, qui a exactement la forme d'une
adresse noreply valide — et à laquelle GitHub ne rattache aucun compte. Une règle
de forme les aurait crédités à un compte `cyprien` sans rapport avec le tien, et
ils auraient disparu du décompte au lieu d'être signalés. La table `COMPTES` est
donc explicite, vérifiée par l'API, et le script **signale toute adresse qu'il ne
connaît pas** au lieu de la classer en « non rattaché » : sans cet avertissement,
un auteur entier pourrait passer dans la case muette et le décompte resterait
juste en apparence.

C'est une donnée sur ce dépôt, pas un appel réseau : la table est dans le
script, et la page des mentions légales promet qu'aucune requête ne part du
navigateur.

### La boucle que j'ai ouverte en voulant réconcilier les comptes

Le coupable n'était pas la boucle qu'on cherchait à éviter, mais le moyen de la
montrer.

La page disait « 72 représentés sur 72 dans la branche — 3 fusions écartées ».
À la régénération suivante, le bot crée son commit, la PR est mergée, et la
branche compte donc **74** commits : le fichier change, une PR se rouvre, on la
merge, on arrive à 76. Le cycle ne s'arrêtait jamais. Vérifié sur un clone : le
diff ne faisait que grossir, `97 commits, 17 non représentés`, puis `99, 19`.

Le graphe lui-même n'avait rien à voir là-dedans. La grille ne bougeait pas, la
liste des 14 derniers commits non plus : la grille et la liste sont construites
sur les commits filtrés, donc un commit de fusion ou du robot n'y entre pas. Ce
qui bougeait, c'était le texte que j'y avais ajouté pour justifier l'écart.

Un fichier produit par un générateur **ne peut pas compter les commits que ce
générateur crée**. Le compte est une fonction de lui-même, il croît à chaque
tour, et aucune garde ne le fixe : il n'y a pas de point fixe. Les chiffres sont
donc sortis de `data/commits.json` et du HTML, et restent dans la sortie
terminale, que rien ne réinjecte dans le dépôt.

Le repli, lui, est bien réel et vérifié : `paths-ignore` sur les deux fichiers
générés fait que le push du bot ne relance pas le workflow. C'est une seconde
barrière, pas la première — sans elle, la moindre mesure affichée qui dépende
du nombre de commits écartés réintroduirait la boucle sans qu'on s'en aperçoive.

La même règle vaut pour `genereLe`, la date d'instantané : elle change une fois
par jour. Sans conséquence tant qu'aucun déclencheur quotidien ne tourne, et il
n'y en a pas — voir plus loin pourquoi le cron a été retiré.

Zéro dépendance, comme le `tools/build.mjs` prévu pour la variante Firefox. Le
workflow `.github/workflows/commits.yml` le relance à chaque push sur `SITE` et à
la main. Il n'ouvre une PR que si le fichier a réellement changé.

### Le workflow passe par une PR, volontairement

`SITE` porte un ruleset qui impose une pull request, et le robot n'est pas dans
la liste de contournement : un `git push` direct de sa part serait refusé. Le
workflow pousse donc sur une branche jetable (`commits-graphe`) et ouvre une PR,
que tu merges. C'est plus lent d'un push direct, mais ça respecte la protection
au lieu de la contourner en douce.

### Trois pièges que le script désamorce

**Le robot ne se compte pas lui-même.** Sans précaution, le workflow
s'auto-entretient : le fichier est commité, la PR est mergée, ce commit entre
dans l'historique de `SITE`, donc le fichier régénéré diffère encore, donc une
nouvelle PR — indéfiniment. Les commits dont l'auteur contient `[bot]` sont
donc écartés du graphe.

**Et les fusions de la PR du graphe non plus.** C'est la boucle que tu as
réellement subie, et le filtre `[bot]` ne l'attrapait pas. Tu merges la PR du
graphe, ce qui crée un commit « Merge pull request #25 from
cyprien63/commits-graphe » à ton nom ; le fichier le comptait, donc il changeait,
donc le workflow ouvrait une PR — laquelle en créait une autre.

Le piège est la largeur du filtre. Écrire `/^Merge /` règle la boucle d'un
coup, et ça marche : la boucle se ferme. Mais le 1er octobre, la page annonçait
**16** commits là où il y en avait **26**. Les 2 « Merge remote-tracking branch
'origin/SITE' into SITE » que tu avais faites à la main, et les 5 de `main`,
étaient jetées avec les 3 du pipeline. Un filtre large ne se contente pas
d'écarter le bruit : il emporte du travail au passage, et un compte faux paraît
plus innocent qu'un compte bruyant. Le filtre vise donc la branche
`commits-graphe`, et rien d'autre. `main` est maintenant à 72 sur 72,
exactement ce que GitHub affiche.

**La date de l'instantané ne bouge que si le travail bouge.** `genereLe` prend
la date du dernier commit représenté, pas celle du jour où le script tourne.
Avec `new Date()`, le fichier changeait une fois par jour même sans travail
nouveau, et le workflow ouvrait une PR ne contenant qu'une date. La date du
dernier commit est stable par construction, et elle dit plus : elle date le
travail, pas le passage du script.

### Ce que montre le graphique

Une grille : **une ligne par branche, une colonne par jour calendaire, et le
nombre de commits écrit dans chaque case.** En SVG, écrit par le générateur.

La demande était « voir tout de suite que le 1er octobre il y a dix commits ».
Trois choix en découlent.

**Le nombre est écrit, pas seulement codé par la couleur.** C'est ce qui évite
d'avoir à déduire une hauteur. La couleur ne porte qu'un ordre de grandeur, et
le chiffre porte l'information.

**Les jours sans commit ont leur case**, vide et en pointillés. Gratter les
colonnes vides aurait fait disparaître la semaine de silence du 18 au 23/09, et
le graphique aurait laissé croire à une activité continue. Une case vide
signifie « personne n'a rien commité ce jour-là », pas « le fichier ne sait
pas ».

**L'échelle d'intensité est propre à chaque branche.** `main` atteint 14
commits, `SITE` 10, et les deux n'ont pas les mêmes volumes. Une échelle
commune aurait fait passer le premier jour de `SITE` pour une journée calme
alors qu'elle en compte onze.

Un `<desc>` résume l'ensemble pour les lecteurs d'écran, et chaque case porte
son chiffre en infobulle.

### Ce qui a été essayé avant, et pourquoi c'est parti

Une courbe en aire par branche, façon GitHub Pulse, avec un axe des dates. Elle
ne convenait pas : deux séries partageant un axe unique, l'aire de `main`
recouvrait tout et la ligne de `SITE` restait collée au sol sur onze jours. Les
deux informations s'y lisaient mal, et il fallait des hauteurs pour retrouver
des chiffres.

Avant cela, une bande de traits, un trait par commit. Plus illisible encore :
au-delà de quatorze traits par jour la ligne débordait, et le graphique mentait
sur les jours chargés.

### Sept pièges que ce générateur a désamorcés

**Le caractère sentinelle disparaît.** Le script découpe chaque ligne de
`git log` sur un caractère de contrôle, `U+001E`. Invisible dans le source, il
s'est effacé lors d'une réécriture du fichier, et le découpage a cassé
silencieusement : `main` est tombé à 0 commit sans lever la moindre erreur.
Il est désormais écrit `\u001e`, en échappement, pour que ça ne puisse plus
arriver.

**Une fonction pure, ou le graphe disparaît.** La fonction qui insère le
contenu entre les marqueurs relisait le fichier à chaque appel. Les deux
premiers résultats étaient donc écrasés par le suivant : la liste des commits
passait, le graphe et le résumé non. Elle reçoit désormais le HTML et le
renvoie modifié, sans toucher au disque.

Un troisième, dans la même famille : deux clés `h` dans la géométrie du
graphique — la hauteur et la marge haute. La seconde écrasait la première, et
le `viewBox` sortait à 14 pixels de haut. Les clés s'appellent maintenant
`larg`, `haut`, `etiquette`, `hautCase`, `pasCase`.

Un quatrième, lui aussi invisible : `git clone` ne recopie que l'état *commité*
d'un dépôt. Un test de boucle lancé depuis un clone ne teste donc pas les
modifications non commitées, mais la version précédente du script — et conclut
que le correctif n'a rien changé. Le test copie l'arbre de travail.

Un cinquième : le script qui vérifiait le contraste des cases appariait
« conforme » alors qu'il assemblait un texte du thème clair sur un fond du
thème sombre. Treize paires, neuf déclarées non conformes, aucune vraie. Le
contraste se vérifie en appariant la ligne CSS entière — thème, branche, niveau,
et le couple fond/texte — et non en relisant les couleurs une par une. Les seize
paires réelles passent, de 4.80 à 9.19.

Un sixième, de la même famille : en diagnostiquant l'écart de comptes, j'ai
cherché les commits du robot sur le **sujet** du message — « Corriger la
refspec du workflow… » contient « workflow » — au lieu de l'**auteur**. Deux
vrais commits de travail sont apparus comme automatisés, et j'ai conclu à tort
que le générateur en perdait un. Le filtre lui-même testait l'auteur et était
juste ; c'est le coup d'œil qui mentait. Un filtre se vérifie sur le même champ
que celui qu'il lit.

Un septième, toujours dans la même famille, et le plus coûteux : **un fichier
généré ne peut pas compter ce que sa génération produit.** Je voulais
réconcilier le 15 de la page avec le 23 de GitHub, alors j'ai écrit « sur 23
dans la branche, 5 fusions, 3 commits du robot » dans la page et dans le JSON.
Le bot commite, la PR est mergée, la branche passe à 25 : le fichier change, une
PR se rouvre, on arrive à 27. Le décompte est une fonction de lui-même, il croît
à chaque tour, et il n'existe aucun point fixe. Vérifié sur un clone : le diff ne
faisait que grossir. Aucun garde ne l'arrête, pas même `paths-ignore` — celui-ci
empêche la PR de s'ouvrir, pas le chiffre d'être faux au moment où elle
s'ouvre. Le compte complet vit dans la sortie du terminal, que rien ne
réinjecte dans le dépôt.

### Deux détails qui ont coûté du temps

L'appartenance d'un commit à une branche ne se lit pas dans l'étiquette `%D` de
`git log`, qui ne liste que les références qui pointent *sur* le commit.
Presque tous les commits anciens de `main` en sont dépourvus et seraient
apparus sans branche. Le script utilise donc `git rev-list <branche>`.

Et le nom `main` n'existe pas toujours : déclenché depuis un push, le checkout
de GitHub Actions ne crée qu'une seule branche locale, donc sur un push vers
`SITE`, `git rev-list main` échoue alors que `origin/main` est là. Le script
essaie les formes de référence une par une, et une branche absente est
simplement omise du JSON avec un avertissement, plutôt que de faire échouer le
workflow.

### Un repli incohérent qu'il ne fallait pas laisser

Le site avait un filet pour les animations : si le JavaScript ne charge pas,
une minuterie retire la classe qui masque le contenu, sinon la page resterait
vide. Le graphe, lui, n'avait aucun repli — il dépendait entièrement de
`branches.js`. Le même socle, deux traitements différents, ce qui se voyait.
D'où le pré-rendu : le filet est devenu inutile pour cette partie.

## Identité visuelle

Les valeurs viennent de l'extension, pour que le site ressemble à ce que
produit le code. Source de vérité :
`content/pronote/accueil/pronote.css` sur la branche `main`.

| Élément | Valeur |
|---|---|
| Dégradé de marque | `linear-gradient(140deg, #35bba0 0%, #2ea08a 46%, #227e6b 100%)` |
| Accent / sélection | `#29947a` |
| Lien (accessible) | `#1f7360` en clair, `#4ecfb4` en sombre |
| Barre `main` (graphe) | `#2c9581` |
| Barre `SITE` (graphe) | `#8f62e0` |
| Rayon des cartes | `25px` |
| Pastilles | `300px` |
| Police | Inter 400 / 500 / 600 / 700 / 800, embarquée |
| Fond sombre | `#101513`, surfaces `#1a211e` |

Le fond sombre retenu ici est volontairement différent du `#121212` de
l'application Papillon : c'est celui de l'extension, légèrement teinté vert.

## Un écart assumé : le dégradé des surfaces à texte blanc

Le dégradé de l'extension est `#35bba0 → #2ea08a → #227e6b`. Sur du texte blanc,
il ne donne que **2.40:1** au premier palier, ce qui est très en dessous du seuil
AA de 4.5:1. Ce n'est pas un problème dans l'extension, où le bandeau ne porte
que des formes et des icônes, mais ici l'en-tête et le bouton principal portent
du texte.

Le site utilise donc un second dégradé, `--papillon-grad-strong` :

```css
linear-gradient(140deg, #1c8270 0%, #1a7563 46%, #16604f 100%)
```

Même teinte, mêmes proportions, assez sombre pour passer AA partout (4.69:1 au
début, 7.45:1 à la fin). Le dégradé d'origine reste utilisé partout où aucun
texte blanc ne le surmonte : le filet des titres de section et la maquette CSS.

Pour la même raison, les liens utilisent `#1f7360` et non `#29947a`, qui ne
faisait que 3.49:1 sur le fond clair. Toutes les paires texte/fond ont été
vérifiées : 0 non-conformité.

Le mode sombre est piloté par la classe `html.dark`, comme dans l'extension, et
jamais par `prefers-color-scheme` seul. La préférence est lue avant le rendu via
une script inline dans chaque `<head>`, sinon la page clignote en clair.

## Thème et navigation

`assets/js/site.js` applique le thème, gère le menu mobile, déclenche les
apparitions au défilement et ferme le menu avec la touche Échap. Sans
JavaScript, la page reste lisible et navigable : seule la bascule de thème
disparaît.

## Animations

Peu nombreuses, courtes, toutes facultatives.

| Effet | Durée | Où |
|---|---|---|
| Apparition au défilement, décalée en escalier | 550 ms | chaque section, via `data-apparait` + `data-retard` |
| Montée du hero | 600 ms, 80 ms d'écart | les 5 blocs du premier écran |
| Reflet traversant le bandeau | 1,5 s, une fois | en-tête au chargement |
| Soulèvement au survol | 200 ms | cartes, statistiques, pastilles |
| Respiration de la maquette | 7 s en boucle | visuel du hero |
| Rotation de l'icône de thème | 300 ms | au survol du bouton |

Uniquement `transform` et `opacity`, donc aucun reflow. Les apparitions
utilisent un `IntersectionObserver` qui se désabonne après le premier passage :
un élément ne peut pas réapparaître en remontant la page.

Trois garde-fous, du plus au moins important :

1. **`prefers-reduced-motion`** coupe tout. Ce bloc est en fin de fichier et
   écrase celui qui existait auparavant, qui faisait `transition: none` sur `*`
   et annulait au passage les transitions de couleur utiles au survol.
2. **Pas d'`IntersectionObserver`** : les éléments reçoivent immédiatement la
   classe `apparu`, rien ne reste masqué.
3. **Filet de sécurité dans chaque `<head>`** : la classe `js` n'est conservée que
   si `site.js` s'est exécuté.

Le point 3 est la partie non évidente du code. La classe `js` doit être posée
dans la tête, avant le premier rendu, sinon les sections apparaissent une
fraction de seconde avant de repartir en fondu — le clignotement est exactement
ce qu'on cherche à éviter. Mais la poser avant de savoir si `site.js` va
arriver expose la page vide si ce script échoue. D'où le `setTimeout` de 1,5 s
qui retire la classe, annulé par `site.js` dès son chargement. Sans JavaScript
du tout, ce bloc ne s'exécute pas et rien n'est masqué.

## Ce qui est volontaire

- **Pas de capture d'écran.** Le dépôt n'en contient aucune. La maquette de
  l'accueil est dessinée en CSS plutôt qu'inventée en image.
- **Pas de script tiers.** Ni analytics, ni vidéo intégrée, ni bouton social,
  ni CDN de polices. La page sur les données personnelles l'annonce, autant
  mieux le tenir.
- **Pas de claim d'analytique.** La page légale décrit ce qui est vérifiable dans
  le code : une permission, zéro appel réseau sortant, deux clés de stockage.

## Déploiement sur GitHub Pages

La source est déjà prête pour être servie depuis la racine de la branche.

```bash
gh api -X PUT repos/cyprien63/papillon-pronote/pages \
  -f source[branch]=SITE \
  -f source[path]=/ \
  -F build_type=legacy
```

L'URL obtenue sera de la forme
`https://cyprien63.github.io/papillon-pronote/`. Les liens internes sont tous
relatifs, donc le site fonctionne à la racine d'un sous-domaine comme à
n'importe quel sous-chemin.

## Contributeur

Cyprien63 — <p.cyprien6312@gmail.com>
Code sous licence MIT.