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

const LECTURE = ['%H', '%an', '%aI', '%s'].join(SEP);

let brut;
try {
  brut = git('log', '--all', `--pretty=format:${LECTURE}`);
} catch {
  echec("impossible de lire l'historique Git");
}

const lus = brut.split('\n').filter(Boolean).map((ligne) => {
  const [hash, auteur, date, sujet] = ligne.split(SEP);
  return {
    hash: hash.slice(0, 7),
    auteur,
    date,
    jour: date.slice(0, 10),
    sujet,
    sur: [],
  };
});

/* Deux familles de commits sortent du graphe, et ce n'est pas cosmétique :
 * sans ça, le fichier se met à jour lui-même et tu merges des PR sans fin.
 *
 * Les commits du robot : le workflow commite le résultat, la PR est mergée, ce
 * commit entre dans l'historique de SITE, donc le HTML régénéré diffère encore,
 * donc une nouvelle PR — indéfiniment.
 *
 * Les commits de fusion : c'est la boucle que tu as subie. Tu merges la PR du
 * graphe, ça crée un commit « Merge pull request #18… » à ton nom. Le fichier
 * le comptait, donc il changeait, donc le workflow ouvrait une nouvelle PR —
 * laquelle en créait une autre à son tour. Exclure les fusions ne perd rien :
 * les commits qu'elles rapprochent sont déjà comptés un par un.
 *
 * Les deux filtres sont cumulés : il suffit que l'un des deux attrape le
 * commit pour que la boucle reste fermée. */
const estRobot = (c) => c.auteur.includes('[bot]');
const estFusion = (c) => /^Merge (remote-tracking branch|pull request|branch)/.test(c.sujet);
const commits = lus.filter((c) => !estRobot(c) && !estFusion(c));
const nbRobot = lus.filter(estRobot).length;
const nbFusion = lus.length - nbRobot - commits.length;

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

for (const c of commits) {
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

const presentes = BRANCHES.filter((b) => !introuvables.includes(b));
const resume = {};
for (const b of presentes) {
  resume[b] = { commits: total(b), premier: premier(b) };
}

const donnees = {
  genereLe: new Date().toISOString().slice(0, 10),
  branches: presentes,
  resume,
  jours,
};

/* --- Rendu HTML ------------------------------------------------------------ */

/* Géométrie du graphique, en unités du viewBox : le SVG est redimensionné par
 * le CSS, donc rien ici n'est en pixels d'écran.
 *
 * mg/md/mh/mb sont les marges gauche, droite, haute et basse. Les noms sont
 * longs volontairement : deux clés courtes qui se ressemblent, c'est la façon
 * la plus rapide de se retrouver avec une hauteur de 14px. */
const PLAN = { larg: 760, haut: 268, mg: 36, md: 14, mh: 18, mb: 34 };
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
  return [
    `${p}<article class="branch-card">`,
    `${p}  <h3><span class="swatch ${classe}"></span>${b}</h3>`,
    `${p}  <div class="count">${r.commits}</div>`,
    `${p}  <div class="since">commit${pluriel}, premier le ${r.premier}</div>`,
    `${p}</article>`,
  ].join('\n');
}

/* Jour calendaire en nombre, pour poser l'abscisse.
 *
 * Les jours ne sont pas consécutifs : le 17/09, le 24/09… Entre les deux, la
 * personne n'a commité. Les espacer à égalité ferait mentir le graphique sur
 * le temps — il montrerait une activité continue pendant une semaine de
 * silence. L'abscisse suit donc le calendrier, et les trous se voient. */
const jourNum = (cle) =>
  Date.UTC(+cle.slice(0, 4), +cle.slice(5, 7) - 1, +cle.slice(8, 10)) / 86400000;

/* La courbe, une aire par branche : deux lignes qui se lisent l'une par rapport
 * à l'autre. C'est la forme que GitHub utilise dans Pulse, et la seule qui
 * reste lisible avec une poignée de points — une grille de carrés comme les
 * contributions aurait exigé un an d'historique pour avoir l'air pleine. */
function grapheHtml(indent) {
  const p = ' '.repeat(indent);
  const n = jours.length;
  const L = [];

  const picBrut = n ? Math.max(...jours.map((j) => j.main + j.SITE)) : 0;
  const pas = pasRond(picBrut);
  const plafond = Math.max(pas, Math.ceil(picBrut / pas) * pas);
  const x0 = PLAN.mg;
  const x1 = PLAN.larg - PLAN.md;
  const yHaut = PLAN.mh;
  const yBas = PLAN.haut - PLAN.mb;

  const depart = n ? jourNum(jours[0].jour) : 0;
  const etendue = n ? Math.max(1, jourNum(jours[n - 1].jour) - depart) : 1;
  const px = (i) => x0 + ((jourNum(jours[i].jour) - depart) / etendue) * (x1 - x0);
  const py = (v) => yBas - (v / plafond) * (yBas - yHaut);

  /* Graduations de dates, elles aussi arrondies : 0, 5, 10, 15 jours. */
  const pasJours = pasRond(etendue, 6);
  const jourLabel = (t) => {
    const d = new Date((depart + t) * 86400000);
    return `${String(d.getUTCMonth() + 1).padStart(2, '0')}/${String(d.getUTCDate()).padStart(2, '0')}`;
  };

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

  if (!n) {
    L.push(`${p}<p class="graph-foot">Aucun commit à représenter.</p>`);
    return L.join('\n');
  }

  L.push(
    `${p}<svg class="chart" viewBox="0 0 ${PLAN.larg} ${PLAN.haut}" role="img" aria-labelledby="titre-chart desc-chart">`
  );
  L.push(
    `${p}  <title id="titre-chart">Commits par jour sur ${n} jour${n > 1 ? 's' : ''}</title>`
  );
  L.push(
    `${p}  <desc id="desc-chart">${SERIE.filter((s) => presentes.includes(s.cle))
      .map((s) => `${s.cle}, ${resume[s.cle].commits} commits au total`)
      .join(' ; ')}. Du ${moisCourts(jours[0].jour)} au ${moisCourts(jours[n - 1].jour)}, ${n} jours avec commit. Pic à ${picBrut} commit${picBrut > 1 ? 's' : ''} sur une journée.</desc>`
  );
  L.push(`${p}  <defs>`);
  for (const s of SERIE) {
    L.push(
      `${p}    <linearGradient id="aire-${s.classe}" x1="0" y1="0" x2="0" y2="1">`
    );
    L.push(`${p}      <stop offset="0%" stop-color="currentColor" stop-opacity=".34"/>`);
    L.push(`${p}      <stop offset="100%" stop-color="currentColor" stop-opacity=".03"/>`);
    L.push(`${p}    </linearGradient>`);
  }
  L.push(`${p}  </defs>`);

  /* Graduations horizontales, avec leur valeur. */
  L.push(`${p}  <g class="chart-grille">`);
  for (let v = 0; v <= plafond; v += pas) {
    const y = py(v).toFixed(1);
    L.push(`${p}    <line x1="${x0}" y1="${y}" x2="${x1}" y2="${y}"/>`);
    L.push(
      `${p}    <text class="chart-val" x="${x0 - 8}" y="${y}" dy=".32em" text-anchor="end">${v}</text>`
    );
  }
  L.push(`${p}  </g>`);

  /* Un point par jour, avec son nombre en infobulle. Sans ça, la courbe ne
   * donne pas les chiffres exacts — on ne verrait que la forme. */
  for (const s of SERIE) {
    if (!presentes.includes(s.cle)) continue;
    L.push(`${p}  <g class="chart-pts chart-pts-${s.classe}">`);
    jours.forEach((j, i) => {
      const v = j[s.cle] || 0;
      const pluriel = v > 1 ? 's' : '';
      L.push(
        `${p}    <circle cx="${px(i).toFixed(1)}" cy="${py(v).toFixed(1)}" r="3.2"><title>${s.cle} — ${j.jour} : ${v} commit${pluriel}</title></circle>`
      );
    });
    L.push(`${p}  </g>`);
  }

  /* Aires puis courbes : la ligne par-dessus, sinon le dégradé de la branche du
   * dessus avale celle d'en dessous. */
  for (const s of SERIE) {
    if (!presentes.includes(s.cle)) continue;
    const chemin = jours
      .map((j, i) => `${i ? 'L' : 'M'}${px(i).toFixed(1)} ${py(j[s.cle] || 0).toFixed(1)}`)
      .join(' ');
    const fermeture = `L${px(n - 1).toFixed(1)} ${yBas.toFixed(1)} L${x0} ${yBas.toFixed(1)} Z`;
    L.push(`${p}  <path class="chart-aire chart-aire-${s.classe}" d="${chemin} ${fermeture}"/>`);
    L.push(`${p}  <path class="chart-ligne chart-ligne-${s.classe}" d="${chemin}"/>`);
  }

  /* Dates en bas, sur l'échelle du temps.
   *
   * Les graduations tombent sur des multiples de pasJours. La dernière peut
   * donc rester en deçà du bout de l'axe — le graphique finirait sur une date
   * qui n'est pas celle de la dernière donnée. On colle une graduation de fin
   * quand il reste plus de la moitié d'un pas. */
  L.push(`${p}  <g class="chart-dates">`);
  const reperes = [];
  for (let t = 0; t < etendue; t += pasJours) reperes.push(t);
  if (etendue - reperes[reperes.length - 1] > pasJours * 0.5) {
    reperes.push(etendue);
  } else {
    reperes[reperes.length - 1] = etendue;
  }
  for (const [i, t] of reperes.entries()) {
    const x = x0 + (t / etendue) * (x1 - x0);
    const ancre = i === 0 ? 'start' : t === etendue ? 'end' : 'middle';
    L.push(
      `${p}    <text x="${x.toFixed(1)}" y="${yBas + 18}" text-anchor="${ancre}">${jourLabel(t)}</text>`
    );
  }
  L.push(`${p}  </g>`);
  L.push(`${p}</svg>`);

  const total = jours.reduce((s, j) => s + j.main + j.SITE, 0);
  L.push(
    `${p}<p class="graph-foot">${total} commits répartis sur ${n} jour${n > 1 ? 's' : ''} d'activité, du ${moisCourts(jours[0].jour)} au ${moisCourts(jours[n - 1].jour)}. Pic à ${picBrut} sur une journée. Les jours sans commit sont à zéro : les trous de la courbe sont des jours sans travail, pas des données manquantes. Survole un point pour le chiffre du jour.</p>`
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
  console.log(`  ${nbRobot} commit(s) automatisé(s) écartés du graphe`);
}
if (nbFusion) {
  console.log(`  ${nbFusion} commit(s) de fusion écartés du graphe`);
}
for (const b of presentes) {
  console.log(`  ${b} : ${resume[b].commits} commits, premier le ${resume[b].premier}`);
}