#!/usr/bin/env node
/* Régénère les parties de pages/branches.html qui dépendent de l'historique.
 *
 * Le graphe est écrit directement dans le HTML, et non injecté par le
 * navigateur. Deux raisons :
 *
 *   - la page reste lisible sans JavaScript, et « voir la source » montre le
 *     graphe au lieu de trois conteneurs vides ;
 *   - plus aucun fetch au chargement, donc rien à maintenir des deux côtés.
 *
 * Le HTML produit reste valide sans script. branches.js n'a plus de rôle pour
 * le graphe : il est supprimé.
 *
 * Le fichier data/commits.json est conservé : c'est lui qui alimente le
 * générateur, et il documente les chiffres sans qu'il faille lire le HTML.
 *
 * Zéro dépendance, comme tools/build.mjs prévu pour la variante Firefox.
 *
 *   node tools/commits.mjs
 */

import { execFileSync } from 'node:child_process';
import { writeFileSync, readFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const RACINE = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SORTIE_JSON = resolve(RACINE, 'data/commits.json');
const SORTIE_HTML = resolve(RACINE, 'pages/branches.html');
const BRANCHES = ['main', 'SITE'];

/* Caractère sentinelle qui sépare les champs d'une ligne git log.
 *
 * Écrit en échappement et non en littéral : un caractère de contrôle
 * invisible dans le source disparaît dès qu'on réécrit le fichier, et le
 * découpage casse silencieusement. U+001E, « record separator », qui
 * n'apparaît jamais dans un message de commit. */
const SEP = '\u001e';

function git(...args) {
  return execFileSync('git', args, {
    cwd: RACINE,
    encoding: 'utf8',
    maxBuffer: 32 * 1024 * 1024,
  }).trimEnd();
}

function echec(message) {
  console.error(`commits.mjs : ${message}`);
  process.exit(1);
}

/* Résout le nom d'une branche vers une référence que git accepte.
 *
 * En local, `main` existe comme branche. Dans GitHub Actions, le checkout
 * d'un push ne crée qu'une seule branche locale : `main` y est un nom
 * inconnu et `git rev-list main` échoue. La référence existe quand même,
 * sous origin/main. On essaie donc les formes une par une.
 */
function resoudre(branche) {
  for (const candidat of [
    `refs/heads/${branche}`,
    `refs/remotes/origin/${branche}`,
    `refs/remotes/upstream/${branche}`,
    branche,
  ]) {
    try {
      git('rev-parse', '--verify', '--quiet', `${candidat}^{commit}`);
      return candidat;
    } catch {
      /* forme absente, on essaie la suivante */
    }
  }
  return null;
}

/* --- Lecture de l'historique ---------------------------------------------- */

const LECTURE = ['%H', '%an', '%ae', '%aI', '%s'].join(SEP);

let brut;
try {
  brut = git('log', '--all', `--pretty=format:${LECTURE}`);
} catch {
  echec("impossible de lire l'historique Git");
}

/* Le compte GitHub auquel un commit est rattaché, déduit de son adresse mail.
 *
 * Le nom d'auteur ne suffit pas, et il ment deux fois. `%an` est du texte libre :
 * le dépôt contient « Cyprien63 », « cyprien63 » et « Cyprien » pour la même
 * personne, et « SpartisPerso » pour quelqu'un d'autre. Compter par nom Melange
 * tout le monde.
 *
 * L'adresse n'est pas devinable pour autant. `cyprien@users.noreply.github.com`
 * a exactement la forme d'une adresse noreply valide, et GitHub ne la rattache à
 * aucun compte : une règle de forme l'aurait créditée à un compte `cyprien` qui
 * n'est pas le tien, et cinq commits auraient disparu de ton profil. La table
 * est donc explicite, vérifiée par l'API, et le script signale toute adresse
 * qu'il ne connaît pas plutôt que de deviner. C'est une donnée sur ce dépôt,
 * pas un appel réseau : la page des mentions légales promet qu'aucune requête ne
 * part du navigateur.
 */
const COMPTES = new Map(
  Object.entries({
    'cyprien63@users.noreply.github.com': 'cyprien63',
    '157894664+cyprien63@users.noreply.github.com': 'cyprien63',
    'p.cyprien6312@gmail.com': 'cyprien63',
    '328088496+SpartisPerso@users.noreply.github.com': 'SpartisPerso',
    '41898282+github-actions[bot]@users.noreply.github.com': 'github-actions[bot]',
    // Vérifiée le 2026-10-01 : aucun compte ne porte cette adresse. Cinq
    // commits de SITE ne se rattachent donc à personne, et GitHub les affiche
    // chez un `cyprien` sans rapport.
    'cyprien@users.noreply.github.com': null,
  })
);

const lus = brut.split('\n').filter(Boolean).map((ligne) => {
  const [hash, auteur, email, date, sujet] = ligne.split(SEP);
  return {
    hash: hash.slice(0, 7),
    auteur,
    email,
    compte: COMPTES.has(email) ? COMPTES.get(email) : undefined,
    date,
    jour: date.slice(0, 10),
    sujet,
    sur: [],
  };
});

/* Une adresse nouvelle passe inaperçue si on ne la signale pas : le décompte
 * par compte resterait juste, mais faux, parce qu'un auteur entier serait
 * rangé dans les « non rattachés ». */
const inconnues = [...new Set(lus.map((c) => c.email))].filter(
  (e) => !COMPTES.has(e)
);
if (inconnues.length) {
  console.warn(
    `commits.mjs : adresse${inconnues.length > 1 ? 's' : ''} d'auteur inconnue${inconnues.length > 1 ? 's' : ''} ` +
      `de la table COMPTES, comptée${inconnues.length > 1 ? 's' : ''} comme non rattachée${inconnues.length > 1 ? 's' : ''} : ` +
      inconnues.join(', ')
  );
}

/* Deux familles de commits sortent du graphe, et ce n'est pas cosmétique :
 * sans ça, le fichier se met à jour lui-même et tu merges des PR sans fin.
 *
 * Les commits du robot : le workflow commite le résultat, ce commit entre dans
 * l'historique de SITE, donc le HTML régénéré diffère encore, donc une nouvelle
 * PR — indéfiniment.
 *
 * Les fusions de la PR du graphe : c'est la boucle que tu as subie. Tu merges
 * la PR du graphe, GitHub crée « Merge pull request #25 from
 * cyprien63/commits-graphe » à ton nom, le fichier le comptait, il changeait,
 * le workflow rouvrait une PR, laquelle en créait une autre.
 *
 * Les deux filtres sont cumulés : il suffit que l'un des deux attrape le commit
 * pour que la boucle reste fermée. Mais ils doivent viser la mécanique et rien
 * d'autre. Exclure toute fusion donnait 16 commits le 1er octobre là où il y en
 * avait 26 : les 2 « Merge remote-tracking branch 'origin/SITE' into SITE » que
 * tu as faites à la main, et les 5 de `main`, disparaissaient avec les 3 du
 * pipeline. Un filtre large ne se contente pas de jeter le bruit : il emporte
 * le travail au passage, et le compte faux a l'air plus innocent qu'un compte
 *bruyant. */
const estRobot = (c) => c.auteur.includes('[bot]') || c.email.includes('[bot]');
const estPipeline = (c) =>
  /^Merge pull request #\d+ from \S+\/commits-graphe\s*$/.test(c.sujet);
for (const c of lus)
  c.ecarte = estRobot(c) ? 'robot' : estPipeline(c) ? 'pipeline' : null;
const commits = lus.filter((c) => !c.ecarte);
const nbRobot = lus.filter((c) => c.ecarte === 'robot').length;
const nbPipeline = lus.filter((c) => c.ecarte === 'pipeline').length;

const appartenance = new Map(BRANCHES.map((b) => [b, new Set()]));
const introuvables = [];
for (const b of BRANCHES) {
  const ref = resoudre(b);
  if (!ref) {
    introuvables.push(b);
    continue;
  }
  for (const h of git('rev-list', ref).split('\n').filter(Boolean)) {
    appartenance.get(b).add(h.slice(0, 7));
  }
}

if (introuvables.length) {
  console.warn(
    `commits.mjs : branche(s) introuvable(s), omise(s) : ${introuvables.join(', ')}`
  );
}

/* `sur` est posé sur tous les commits lus, y compris les écartés : c'est la
 * seule façon de dire « la branche en compte 72, dont 5 fusions » plutôt qu'un
 * total global qui ne dit rien. */
for (const c of lus) {
  for (const b of BRANCHES) {
    if (appartenance.get(b).has(c.hash)) c.sur.push(b);
  }
}

/* --- Agrégation ------------------------------------------------------------ */

const parJour = new Map();
for (const c of commits) {
  if (!parJour.has(c.jour)) {
    parJour.set(c.jour, { jour: c.jour, main: 0, SITE: 0, commits: [] });
  }
  const entree = parJour.get(c.jour);
  if (c.sur.includes('main')) entree.main += 1;
  if (c.sur.includes('SITE')) entree.SITE += 1;
  entree.commits.push(c);
}

const jours = [...parJour.values()].sort((a, b) => a.jour.localeCompare(b.jour));

const total = (b) => commits.filter((c) => c.sur.includes(b)).length;
const premier = (b) => {
  const dates = commits.filter((c) => c.sur.includes(b)).map((c) => c.jour).sort();
  return dates[0] ?? null;
};

/* Le compte que GitHub affiche sur la branche, et la raison de l'écart avec le
 * compte ci-dessus. Ces nombres vont sur le terminal, jamais dans un fichier
 * versionné : voir le commentaire à la fin de grapheHtml. */
const dansLaBranche = (b, motif) =>
  lus.filter((c) => c.sur.includes(b) && (!motif || c.ecarte === motif)).length;

const presentes = BRANCHES.filter((b) => !introuvables.includes(b));

/* Qui a écrit les commits représentés, par branche.
 *
 * Le gros chiffre de la carte est l'activité du dépôt, pas la tienne : dix des
 * 67 commits de `main` sont de SpartisPerso, et cinq des quinze de `SITE`
 * portent une adresse que GitHub ne rattache à aucun compte. Additionner les
 * deux revient à annoncer un nombre que personne ne reconnaît — ni ton profil,
 * ni la page du dépôt.
 *
 * Ce décompte est stable, contrairement au total de la branche : les comptes du
 * robot et des fusions sont écartés, donc ils n'apparaissent pas ici et ne
 * changent pas ce que la page affiche. */
const parCompte = (b) => {
  const comptes = new Map();
  for (const c of commits) {
    if (!c.sur.includes(b)) continue;
    const cle = c.compte ?? 'non rattaché';
    comptes.set(cle, (comptes.get(cle) ?? 0) + 1);
  }
  return [...comptes.entries()]
    .sort((a, z) => z[1] - a[1] || a[0].localeCompare(z[0]))
    .map(([nom, n]) => ({ compte: nom, commits: n }));
};

const resume = {};
for (const b of presentes) {
  /* Trois données, et elles sont stables : le nombre de commits représentés, la
   * date du premier, et la répartition par compte.
   *
   * Le total de la branche et la répartition fusions / automatiques
   * n'entrent pas dans le JSON, même s'ils sont affichés sur le terminal. Ils
   * dépendent des commits que le bot crée lui-même : le fichier changerait à
   * chaque régénération, le workflow committerait cette différence, et la mise
   * à jour ne convergerait jamais. Le terminal n'est pas réinjecté dans le
   * dépôt — c'est le seul endroit où le décompte complet est exact. */
  resume[b] = { commits: total(b), premier: premier(b), auteurs: parCompte(b) };
}

/* La date de l'instantané, et elle est celle du dernier commit représenté, pas
 * celle du jour où le script tourne.
 *
 * Avec `new Date()`, le fichier changeait une fois par jour même sans travail
 * nouveau, et le workflow ouvrait une PR ne contenant qu'une date. La date du
 * dernier commit est stable par construction, et elle dit plus : elle date le
 * travail, pas le passage du script. */
const donnees = {
  genereLe: jours.length ? jours[jours.length - 1].jour : new Date().toISOString().slice(0, 10),
  branches: presentes,
  resume,
  jours,
};

/* --- Rendu HTML ------------------------------------------------------------ */

/* Géométrie de la grille, en unités du viewBox : le SVG est redimensionné par
 * le CSS, donc rien ici n'est en pixels d'écran.
 *
 * Les noms sont longs volontairement. Deux clés courtes qui se ressemblent —
 * `h` pour la hauteur et pour la marge haute — se sont déjà fait confondre une
 * fois, et le viewBox est sorti à 14 pixels de haut. */
const PLAN = { larg: 780, haut: 148, etiquette: 56, hautCase: 46, pasCase: 5 };
const SERIE = [
  { cle: 'main', classe: 'main' },
  { cle: 'SITE', classe: 'site' },
];

function echapper(texte) {
  return String(texte)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function moisCourts(cle) {
  return `${cle.slice(0, 4)}/${cle.slice(5, 7)}/${cle.slice(8, 10)}`;
}

/* Un pas de graduation rond.
 *
 * On veut des repères 0, 5, 10, 15 plutôt que 0, 4, 7, 11, 14. Sans ça
 * l'axe ment sur les hauteurs, parce qu'un repère à 7 se trouve au même
 * endroit qu'un commit de 7 sans en être un. */
function pasRond(max, cible = 4) {
  if (max <= cible) return 1;
  const brut = max / cible;
  const puissance = 10 ** Math.floor(Math.log10(brut));
  const normalise = brut / puissance;
  const pas = normalise <= 1 ? 1 : normalise <= 2 ? 2 : normalise <= 5 ? 5 : 10;
  return pas * puissance;
}

function carteResume(b, r, indent) {
  const p = ' '.repeat(indent);
  const classe = b === 'main' ? 'swatch-main' : 'swatch-site';
  const pluriel = r.commits > 1 ? 's' : '';
  const L = [
    `${p}<article class="branch-card">`,
    `${p}  <h3><span class="swatch ${classe}"></span>${b}</h3>`,
    `${p}  <div class="count">${r.commits}</div>`,
    `${p}  <div class="since">commit${pluriel} représenté${pluriel}, premier le ${r.premier}</div>`,
  ];
  /* Le gros chiffre est l'activité du dépôt, pas la tienne. Tant qu'il n'y a
   * qu'un compte, la ligne serait du bruit ; dès qu'il y en a deux, l'écart
   * mérite d'être écrit, sinon le chiffre se compare à un profil GitHub et ne
   * tombe juste pour personne. */
  for (const { compte, commits: n } of r.auteurs.slice(1)) {
    const nom = compte === 'non rattaché' ? 'une adresse sans compte' : compte;
    L.push(`${p}  <div class="auteurs">dont ${n} par ${nom}</div>`);
  }
  L.push(`${p}</article>`);
  return L.join('\n');
}

/* Jour calendaire en nombre, pour poser les colonnes de la grille.
 *
 * Toutes les cases sont là, y compris les jours sans commit. Gratter les
 * colonnes vides ferait disparaître la semaine de silence du 18 au 23/09, et
 * le graphique laisserait croire à une activité continue. */
const jourNum = (cle) =>
  Date.UTC(+cle.slice(0, 4), +cle.slice(5, 7) - 1, +cle.slice(8, 10)) / 86400000;

/* Niveau d'intensité d'une case, de 0 à 4.
 *
 * L'échelle est propre à chaque branche : `main` atteint 14, `SITE` 10, et les
 * deux n'ont pas les mêmes volumes. Une échelle commune ferait passer la
 * première journée de SITE pour une journée calme alors qu'elle compte dix
 * commits. Le nombre est écrit dans la case de toute façon, donc l'intensité
 * n'a pas à être exacte — elle donne juste l'ordre de grandeur d'un coup
 * d'œil. */
function niveau(v, max) {
  if (v <= 0) return 0;
  return Math.max(1, Math.min(4, Math.ceil((v / max) * 4)));
}

/* La grille : une ligne par branche, une colonne par jour calendaire, le
 * nombre de commits écrit dans chaque case.
 *
 * C'est la forme demandée : « voir tout de suite que le 1er octobre il y a dix
 * commits ». La courbe était un mauvais choix — deux séries partageant un axe
 * unique, l'aire de `main` recouvrait tout et la ligne de `SITE` restait
 * collée au sol. Ici chaque valeur est écrite, donc rien n'a à être déduit
 * d'une hauteur. */
function grapheHtml(indent) {
  const p = ' '.repeat(indent);
  const L = [];

  L.push(`${p}<div class="graph-head">`);
  L.push(`${p}  <div class="graph-legend">`);
  for (const s of SERIE) {
    if (!presentes.includes(s.cle)) continue;
    L.push(
      `${p}    <span><span class="swatch swatch-${s.classe}"></span>${s.cle}</span>`
    );
  }
  L.push(`${p}  </div>`);
  L.push(
    `${p}  <span class="since">${moisCourts(donnees.genereLe)} — instantané</span>`
  );
  L.push(`${p}</div>`);

  const actives = SERIE.filter((s) => presentes.includes(s.cle));
  if (!jours.length || !actives.length) {
    L.push(`${p}<p class="graph-foot">Aucun commit à représenter.</p>`);
    return L.join('\n');
  }

  /* Toutes les colonnes du calendrier, avec le nombre d'un jour cherché une
   * seule fois. */
  const depart = jourNum(jours[0].jour);
  const fin = jourNum(jours[jours.length - 1].jour);
  const parJour = new Map(jours.map((j) => [j.jour, j]));
  const colonnes = [];
  for (let t = 0; t <= fin - depart; t++) {
    const cle = new Date((depart + t) * 86400000).toISOString().slice(0, 10);
    colonnes.push({ cle, jour: parJour.get(cle) });
  }

  const pasCase =
    (PLAN.larg - PLAN.etiquette) / colonnes.length - PLAN.pasCase;
  const cx = (i) => PLAN.etiquette + i * (pasCase + PLAN.pasCase);

  const maxPar = {};
  for (const s of actives) {
    maxPar[s.cle] = Math.max(...jours.map((j) => j[s.cle] || 0));
  }
  const pic = Math.max(...actives.map((s) => maxPar[s.cle]));
  const total = jours.reduce((s, j) => s + j.main + j.SITE, 0);
  const debut = jours[0].jour;
  const dernierJour = jours[jours.length - 1].jour;

  L.push(
    `${p}<svg class="grille" viewBox="0 0 ${PLAN.larg} ${PLAN.haut}" role="img" aria-labelledby="titre-grille desc-grille">`
  );
  L.push(
    `${p}  <title id="titre-grille">Commits par jour et par branche, du ${moisCourts(debut)} au ${moisCourts(dernierJour)}</title>`
  );
  L.push(
    `${p}  <desc id="desc-grille">${actives
      .map((s) => {
        const actifs = jours.filter((j) => (j[s.cle] || 0) > 0);
        const meilleur = [...actifs].sort(
          (a, b) => (b[s.cle] || 0) - (a[s.cle] || 0)
        )[0];
        return (
          `${s.cle} : ${resume[s.cle].commits} commits sur ` +
          `${actifs.length} jour${actifs.length > 1 ? 's' : ''} d'activité, ` +
          `maximum ${maxPar[s.cle]} le ${moisCourts(meilleur[s.cle] ? meilleur.jour : dernierJour)}`
        );
      })
      .join('. ')}. Les fusions et les commits automatiques ne sont pas représentés.</desc>`
  );

  /* Les dates, environ une sur trois, pour qu'elles ne se chevauchent pas.
   * La première est calée sur le bord gauche de sa case et la dernière sur le
   * bord droit : centrées, elles débordent l'une et l'autre de la grille. */
  L.push(`${p}  <g class="grille-dates">`);
  const stride = Math.max(1, Math.round(colonnes.length / 7));
  colonnes.forEach((col, i) => {
    const dernier = i === colonnes.length - 1;
    if (i % stride !== 0 && !dernier) return;
    const d = new Date((depart + i) * 86400000);
    const etiquette =
      `${String(d.getUTCDate()).padStart(2, '0')}/` +
      `${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
    const x = i === 0 ? cx(i) : dernier ? cx(i) + pasCase : cx(i) + pasCase / 2;
    const ancre = i === 0 ? 'start' : dernier ? 'end' : 'middle';
    L.push(
      `${p}    <text x="${x.toFixed(1)}" y="14" text-anchor="${ancre}">${etiquette}</text>`
    );
  });
  L.push(`${p}  </g>`);

  /* Une ligne par branche. */
  actives.forEach((s, r) => {
    const y = 30 + r * (PLAN.hautCase + 16);
    L.push(
      `${p}  <text class="grille-etiquette" x="0" y="${y + PLAN.hautCase / 2}" dy=".34em">${s.cle}</text>`
    );
    colonnes.forEach((col, i) => {
      const v = col.jour ? col.jour[s.cle] || 0 : 0;
      const n = niveau(v, maxPar[s.cle]);
      const x = cx(i);
      const pluriel = v > 1 ? 's' : '';
      const aide =
        v === 0
          ? `${s.cle} — ${col.cle} : rien`
          : `${s.cle} — ${col.cle} : ${v} commit${pluriel}`;
      L.push(
        `${p}    <g class="cellule cell-${s.classe} niv-${n}">` +
          `<title>${aide}</title>` +
          `<rect x="${x.toFixed(1)}" y="${y}" width="${pasCase.toFixed(1)}" height="${PLAN.hautCase}" rx="7"/>` +
          `<text x="${(x + pasCase / 2).toFixed(1)}" y="${y + PLAN.hautCase / 2}" dy=".34em">${v}</text>` +
          `</g>`
      );
    });
  });

  L.push(`${p}</svg>`);

  const sansCommit = colonnes.length - jours.length;
  L.push(
    `${p}<p class="graph-foot">Chaque case porte le nombre de commits du jour. ` +
      `<b>${total} commits</b> du ${moisCourts(debut)} au ${moisCourts(dernierJour)}, ` +
      `dont <b>${pic} au maximum</b> sur une journée. ` +
      (sansCommit > 0
        ? `Les ${sansCommit} cases vides sont des jours sans commit, pas des données manquantes.`
        : `Aucun jour sans commit sur la période.`) +
      `</p>`
  );
  /* Pas de « GitHub affiche N commits » ici, même si l'écart mérite une phrase.
   *
   * Le nombre de commits écartés dépend des commits que le bot lui-même crée :
   * il incrémente à chaque régénération et à chaque fusion de la PR, donc le
   * fichier changerait à chaque tour et rouvrirait une PR sans fin. Un fichier
   * produit par le générateur ne peut pas compter les commits que ce
   * générateur crée. La règle s'explique donc en mots, et le décompte exact
   * est dans la sortie de `node tools/commits.mjs` — un terminal n'est pas
   * réinjecté dans le dépôt. */
  L.push(
    `${p}<p class="graph-foot">Ce graphe ne représente que les commits écrits par ` +
      `toi. Les <b>fusions</b> en sont écartées : elles rapprochent des commits déjà ` +
      `comptés un par un. Les <b>commits automatiques</b> aussi : le workflow qui ` +
      `régénère cette page en crée un à chaque mise à jour, donc les compter le ` +
      `ferait changer sans cesse et rouvrirait une PR sans fin. C’est pour cette ` +
      `raison que cette page annonce moins de commits que GitHub n’en affiche — ` +
      `et que <code>node tools/commits.mjs</code> est là pour dire l’écart exact.</p>`
  );
  return L.join('\n');
}

function commitsHtml(indent) {
  const p = ' '.repeat(indent);
  const tous = jours.flatMap((j) => j.commits);
  tous.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));

  if (!tous.length) {
    return `${p}<li class="card card-empty">Aucun commit à afficher.</li>`;
  }

  const L = [];
  for (const c of tous.slice(0, 14)) {
    const estSite = c.sur.includes('SITE');
    const etiquette = estSite ? 'SITE' : 'main';
    const classe = estSite ? 'branche-site' : 'branche-main';
    const sha = echapper(c.hash);
    const sujet = echapper(c.sujet);
    L.push(`${p}<li>`);
    L.push(
      `${p}  <a href="https://github.com/cyprien63/papillon-pronote/commit/${sha}" rel="noopener" target="_blank">`
    );
    L.push(`${p}    <span class="sha">${sha}</span>`);
    L.push(`${p}    <span class="sujet">${sujet}</span>`);
    L.push(
      `${p}    <span class="branche ${classe}" title="${c.jour}">${etiquette}</span>`
    );
    L.push(`${p}  </a>`);
    L.push(`${p}</li>`);
  }
  return L.join('\n');
}

/* --- Écriture -------------------------------------------------------------- */

/* Remplace le contenu entre les deux marqueurs d'une section.
 *
 * Fonction pure : elle reçoit le HTML et le renvoie modifié. Elle ne relit
 * surtout pas le fichier, sinon chaque appel repart de la version sur disque et
 * écrase ce que l appel précédent venait d écrire — ce qui est exactement ce
 * qui faisait disappear le graphe et le résumé tout en laissant passer la
 * liste des commits. */
function poser(html, section, contenu) {
  const debut = `<!-- graphe:${section}:debut -->`;
  const fin = `<!-- graphe:${section}:fin -->`;
  const i = html.indexOf(debut);
  const j = html.indexOf(fin);
  if (i === -1 || j === -1 || j < i) {
    echec(`marqueurs « graphe:${section} » absents ou désordonnés dans la page`);
  }
  return html.slice(0, i + debut.length) + '\n' + contenu + '\n' + html.slice(j);
}

let html;
try {
  html = readFileSync(SORTIE_HTML, 'utf8');
} catch {
  echec('pages/branches.html est introuvable');
}

const cartes = presentes.map((b) => carteResume(b, resume[b], 6)).join('\n');

html = poser(html, 'resume', cartes);
html = poser(html, 'graphe', grapheHtml(6));
html = poser(html, 'commits', commitsHtml(6));

mkdirSync(dirname(SORTIE_JSON), { recursive: true });
writeFileSync(SORTIE_JSON, JSON.stringify(donnees, null, 2) + '\n');
writeFileSync(SORTIE_HTML, html);

console.log(`pages/branches.html : graphe écrit (${jours.length} jours)`);
console.log(`data/commits.json   : ${commits.length} commits`);
if (nbRobot) {
  console.log(`  ${nbRobot} commit(s) du robot écartés du graphe`);
}
if (nbPipeline) {
  console.log(`  ${nbPipeline} fusion(s) de la PR du graphe écartée(s) du graphe`);
}
/* Le décompte complet, ici et nulle part ailleurs. C'est le seul endroit où il
 * peut figurer : un fichier versionné serait réécrit par ce que ce décompte
 * mesure. */
for (const b of presentes) {
  const r = resume[b];
  const fusions = dansLaBranche(b, 'pipeline');
  const robots = dansLaBranche(b, 'robot');
  const ecarts = [];
  if (fusions) ecarts.push(`${fusions} fusion${fusions > 1 ? 's' : ''} de la PR du graphe`);
  if (robots) ecarts.push(`${robots} commit${robots > 1 ? 's' : ''} du robot`);
  console.log(
    `  ${b} : ${r.commits} représentés sur ${dansLaBranche(b)} dans la branche` +
      (ecarts.length ? ` (écartés : ${ecarts.join(', ')})` : '') +
      `, premier le ${r.premier}`
  );
  for (const { compte, commits: n } of r.auteurs) {
    console.log(
      `      ${String(n).padStart(3)}  ${compte === 'non rattaché' ? 'adresse non rattachée à un compte' : compte}`
    );
  }
}