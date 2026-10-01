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

/* Les commits du robot sont retirés du graphe.
 *
 * Ce n'est pas cosmétique : sans ça, le fichier se met à jour lui-même. Le
 * workflow commite le résultat, la PR est mergée, ce commit entre dans
 * l'historique de SITE, donc le HTML régénéré diffère encore, donc une
 * nouvelle PR — indéfiniment. */
const commits = lus.filter((c) => !c.auteur.includes('[bot]'));
const nbRobot = lus.length - commits.length;

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

/* Une barre par commit : au-delà, la ligne déborde et le graphique ment. */
const MAX_TICKS = 14;

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

function grapheHtml(indent) {
  const p = ' '.repeat(indent);
  const pic = jours.length ? Math.max(...jours.map((j) => j.main + j.SITE)) : 0;
  const L = [];

  L.push(`${p}<div class="graph-head">`);
  L.push(`${p}  <div class="graph-legend">`);
  for (const b of presentes) {
    const classe = b === 'main' ? 'swatch-main' : 'swatch-site';
    L.push(`${p}    <span><span class="swatch ${classe}"></span>${b}</span>`);
  }
  L.push(`${p}  </div>`);
  L.push(
    `${p}  <span class="since">${moisCourts(donnees.genereLe)} — instantané</span>`
  );
  L.push(`${p}</div>`);

  for (const j of jours) {
    L.push(`${p}<div class="graph-row">`);
    L.push(`${p}  <span class="graph-date">${moisCourts(j.jour)}</span>`);
    for (const b of ['main', 'SITE']) {
      const n = j[b] || 0;
      const classe = b === 'main' ? 'lane' : 'lane lane-site';
      const vide = n === 0 ? ' is-empty' : '';
      const pluriel = n > 1 ? 's' : '';
      L.push(
        `${p}  <div class="${classe}${vide}" title="${b} — ${j.jour} : ${n} commit${pluriel}">`
      );
      for (let i = 0; i < Math.min(n, MAX_TICKS); i++) {
        L.push(`${p}    <span class="tick"></span>`);
      }
      if (n > MAX_TICKS) {
        L.push(`${p}    <span class="tick-more">+${n - MAX_TICKS}</span>`);
      }
      L.push(`${p}  </div>`);
    }
    L.push(`${p}</div>`);
  }

  L.push(
    `${p}<p class="graph-foot">Pic à ${pic} commit${pic > 1 ? 's' : ''} sur une journée. Chaque trait est un commit ; au-delà de ${MAX_TICKS} sur un jour, le reste est indiqué en « +n ».</p>`
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
for (const b of presentes) {
  console.log(`  ${b} : ${resume[b].commits} commits, premier le ${resume[b].premier}`);
}