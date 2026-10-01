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
| `pages/mentions-legales.html` | Éditeur, hébergeur, licences, RGPD, cookies, sécurité |

## Structure

```
index.html              page d'accueil
pages/                  pages secondaires
assets/css/style.css    feuille de style unique
assets/js/site.js       thème + navigation mobile
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

## Identité visuelle

Les valeurs viennent de l'extension, pour que le site ressemble à ce que
produit le code. Source de vérité :
`content/pronote/accueil/pronote.css` sur la branche `main`.

| Élément | Valeur |
|---|---|
| Dégradé de marque | `linear-gradient(140deg, #35bba0 0%, #2ea08a 46%, #227e6b 100%)` |
| Accent / sélection | `#29947a` |
| Lien (accessible) | `#1f7360` en clair, `#4ecfb4` en sombre |
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