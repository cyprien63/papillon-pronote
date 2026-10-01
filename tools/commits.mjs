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
import { writeFileSync, mkdirSync } from 'node:fs';
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

/* Une seule lecture de l'historique complet, séparé par un caractère
   sentinel : chaque commit est ensuite découpé sur ce caractère. */
const LECTURE = ['%H', '%an', '%aI', '%s'].join(SEP);

let brut;
try {
  brut = git('log', '--all', `--pretty=format:${LECTURE}`);
} catch {
  echec("impossible de lire l'historique Git");
}

const commits = brut
  .split('\n')
  .filter(Boolean)
  .map((ligne) => {
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

  /* Appartenance reelle a une branche. On ne peut pas se fier a %D : cette
     etiquette ne liste que les references qui pointent sur le commit, donc
     presque tous les commits anciens de main en seraient depourvus. */
const appartenance = new Map(BRANCHES.map((b) => [b, new Set()]));
for (const b of BRANCHES) {
  for (const h of git('rev-list', b).split('\n').filter(Boolean)) {
    appartenance.get(b).add(h.slice(0, 7));
  }
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

const donnees = {
  genereLe: new Date().toISOString().slice(0, 10),
  branches: BRANCHES,
  resume: {
    main: { commits: total('main'), premier: premier('main') },
    SITE: { commits: total('SITE'), premier: premier('SITE') },
  },
  jours,
};

mkdirSync(dirname(SORTIE), { recursive: true });
writeFileSync(SORTIE, JSON.stringify(donnees, null, 2) + '\n');

const largeur = Math.max(...jours.map((j) => j.main + j.SITE));
console.log(`data/commits.json : ${commits.length} commits sur ${jours.length} jours`);
console.log(`  main : ${donnees.resume.main.commits} commits, depuis le ${donnees.resume.main.premier}`);
console.log(`  SITE : ${donnees.resume.SITE.commits} commits, depuis le ${donnees.resume.SITE.premier}`);
console.log(`  pic  : ${largeur} commits sur un jour`);
