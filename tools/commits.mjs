#!/usr/bin/env node
/* Régénère data/commits.json à partir de l'historique Git.
 *
 * Le graphe est figé dans un JSON plutôt que récupéré à l'affichage depuis
 * l'API GitHub : la page des branches ne doit faire aucune requête externe,
 * ce que la page des mentions légales promet.
 *
 * Zéro dépendance, comme tools/build.mjs prévu pour la variante Firefox.
 *
 *   node tools/commits.mjs
 */

import { execFileSync } from 'node:child_process';
import { writeFileSync, mkdirSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const RACINE = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SORTIE = resolve(RACINE, 'data/commits.json');
const BRANCHES = ['main', 'SITE'];

const SEP = '';

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
 *
 * Ne pas confondre : `--quiet` fait que rev-parse n'écrive rien sur stdout,
 * et c'est le code de sortie non nul qu'on exploite. */
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

/* Une seule lecture de l'historique complet, séparé par un caractère
   sentinel : chaque commit est ensuite découpé sur ce caractère. */
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
 * workflow commite le JSON sur une branche, la PR est mergée, ce commit
 * entre dans l'historique de SITE, donc le fichier régénéré diffère encore,
 * donc une nouvelle PR, qui entre encore dans l'historique. Une PR par jour
 * qui n'apporte rien, indéfiniment. */
const commits = lus.filter((c) => !c.auteur.includes('[bot]'));
const nbRobot = lus.length - commits.length;

if (nbRobot) {
  console.log(`  ${nbRobot} commit(s) automatisé(s) écartés du graphe`);
}

  /* Appartenance reelle a une branche. On ne peut pas se fier a %D : cette
     etiquette ne liste que les references qui pointent sur le commit, donc
     presque tous les commits anciens de main en seraient depourvus. */
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
  /* Une branche absente ne doit pas faire echouer le workflow : elle est
     simplement omise du JSON. */
  console.warn(
    `commits.mjs : branche(s) introuvable(s), omise(s) du JSON : ${introuvables.join(', ')}`
  );
}
for (const c of commits) {
  for (const b of BRANCHES) {
    if (appartenance.get(b).has(c.hash)) c.sur.push(b);
  }
}

/* Compte par jour et par branche, puis fusionne les deux dans un objet
   unique : une seule ligne par jour dans le JSON. */
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

/* Une branche introuvable ne doit pas produire un résumé à null : la page
   afficherait « premier le undefined ». On la retire du résumé et des
   branches annoncées, le reste du JSON reste valable. */
const presentes = BRANCHES.filter((b) => introuvables.includes(b) === false);
const resume = {};
for (const b of presentes) {
  resume[b] = { commits: total(b), premier: premier(b) };
}

const contenu = { branches: presentes, resume, jours };

/* `genereLe` ne bouge que si le contenu a bougé.
 *
 * Le workflow tourne chaque matin. Si la date changeait à chaque exécution,
 * le fichier serait différent tous les matins et le workflow ouvrirait une PR
 * ne contenant qu'une date, pour rien. La date est donc celle du dernier
 * changement réel : une journée sans commit produit un fichier identique, et
 * le workflow s'arrête avant la PR. */
let genereLe = new Date().toISOString().slice(0, 10);
try {
  const precedent = JSON.parse(readFileSync(SORTIE, 'utf8'));
  const memeContenu =
    JSON.stringify({ ...precedent, genereLe: null }) === JSON.stringify({ ...contenu, genereLe: null });
  if (memeContenu) {
    genereLe = precedent.genereLe;
    console.log('  contenu inchangé, date conservée');
  }
} catch {
  /* pas de fichier précédent, ou illisible : on garde la date du jour */
}

const donnees = { genereLe, ...contenu };

mkdirSync(dirname(SORTIE), { recursive: true });
writeFileSync(SORTIE, JSON.stringify(donnees, null, 2) + '\n');

const largeur = jours.length ? Math.max(...jours.map((j) => j.main + j.SITE)) : 0;
console.log(`data/commits.json : ${commits.length} commits sur ${jours.length} jours`);
for (const b of presentes) {
  const r = resume[b];
  console.log(`  ${b} : ${r.commits} commits, premier le ${r.premier}`);
}
console.log(`  pic  : ${largeur} commits sur un jour`);
