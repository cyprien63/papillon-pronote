/* Papillon — Portail ENT · graphe des commits
 *
 * Lit data/commits.json, un fichier local. Aucun appel réseau : c'est ce qui
 * permet à la page des mentions légales de promettre qu'aucune requête ne part
 * du navigateur.
 *
 * Si le fichier est absent ou illisible, les conteneurs restent vides et la
 * page reste lisible. Aucune erreur visible, aucun script bloquant.
 */

(function () {
  'use strict';

  /* Chemin résolu par rapport à la PAGE, pas au script : la page vit dans
     pages/, donc il faut remonter d'un niveau pour atteindre data/. */
  var SOURCE = '../data/commits.json';

  /* Une barre par commit : au-delà, la ligne déborde et le graphique ment. */
  var MAX_TICKS = 14;

  function el(nom, classe, texte) {
    var n = document.createElement(nom);
    if (classe) n.className = classe;
    if (texte !== undefined && texte !== null) n.textContent = String(texte);
    return n;
  }

  function moisCourts(cle) {
    return [cle.slice(0, 4), cle.slice(5, 7), cle.slice(8, 10)].join('/');
  }

  /* --- Résumé des deux branches ------------------------------------------- */
  function resume(donnees, hote) {
    var r = donnees.resume;
    if (!r) return;

    ['main', 'SITE'].forEach(function (b) {
      if (!r[b]) return;
      var carte = el('article', 'branch-card');
      carte.setAttribute('data-apparait', '');

      var titre = el('h3');
      titre.appendChild(el('span', 'swatch swatch-' + (b === 'main' ? 'main' : 'site')));
      titre.appendChild(document.createTextNode(b));
      carte.appendChild(titre);

      carte.appendChild(el('div', 'count', r[b].commits));
      carte.appendChild(el(
        'div',
        'since',
        r[b].commits === 1 ? 'commit, premier le ' + r[b].premier : 'commits, premier le ' + r[b].premier
      ));

      hote.appendChild(carte);
    });
  }

  /* --- Graphe : une ligne par jour, deux pistes ---------------------------- */
  function graphe(donnees, hote) {
    var jours = donnees.jours || [];
    if (!jours.length) return;

    /* La hauteur des barres est relative au jour le plus chargé, pas au
       maximum théorique : sinon les days normales seraient invisibles. */
    var pic = jours.reduce(function (max, j) {
      return Math.max(max, j.main + j.SITE);
    }, 1);

    var tete = el('div', 'graph-head');
    var legende = el('div', 'graph-legend');

    [['main', 'swatch-main'], ['SITE', 'swatch-site']].forEach(function (p) {
      var item = el('span');
      item.appendChild(el('span', 'swatch ' + p[1]));
      item.appendChild(document.createTextNode(p[0]));
      legende.appendChild(item);
    });

    tete.appendChild(legende);
    tete.appendChild(el('span', 'since', jours.length + ' jours'));
    hote.appendChild(tete);

    jours.forEach(function (j) {
      var ligne = el('div', 'graph-row');
      ligne.setAttribute('data-apparait', '');
      ligne.appendChild(el('span', 'graph-date', moisCourts(j.jour)));

      [['main', 'lane'], ['SITE', 'lane lane-site']].forEach(function (p) {
        var n = j[p[0]] || 0;
        var piste = el('div', p[1] + (n === 0 ? ' is-empty' : ''));
        piste.title = p[0] + ' — ' + j.jour + ' : ' + n + (n > 1 ? ' commits' : ' commit');

        var largeur = Math.min(n, MAX_TICKS);
        for (var i = 0; i < largeur; i++) piste.appendChild(el('span', 'tick'));

        /* Au-delà du plafond, on dit combien il y en a en plus : tronquer
           en silence ferait croire que le jour vaut 14 commits. */
        if (n > MAX_TICKS) {
          var reste = el('span', 'tick-more', '+' + (n - MAX_TICKS));
          piste.appendChild(reste);
        }

        ligne.appendChild(piste);
      });

      hote.appendChild(ligne);
    });

    var pied = el('p', 'graph-foot');
    pied.textContent =
      'Pic à ' + pic + ' commits sur une journée. Chaque trait est un commit ; ' +
      'au-delà de ' + MAX_TICKS + ' sur un jour, le reste est indiqué en « +n ».';
    hote.appendChild(pied);
  }

  /* --- Les derniers commits, toutes branches confondues ------------------- */
  function derniersCommits(donnees, hote) {
    var tous = [];
    (donnees.jours || []).forEach(function (j) {
      (j.commits || []).forEach(function (c) { tous.push(c); });
    });

    tous.sort(function (a, b) {
      return a.date < b.date ? 1 : a.date > b.date ? -1 : 0;
    });

    tous.slice(0, 14).forEach(function (c) {
      var li = el('li');
      var a = el('a');
      a.href = 'https://github.com/cyprien63/papillon-pronote/commit/' + c.hash;
      a.rel = 'noopener';
      a.target = '_blank';

      a.appendChild(el('span', 'sha', c.hash));
      a.appendChild(el('span', 'sujet', c.sujet));

      var etiquette = el('span', 'branche branche-' + (c.sur.includes('SITE') ? 'site' : 'main'),
        c.sur.includes('SITE') ? 'SITE' : 'main');
      etiquette.title = c.jour;
      a.appendChild(etiquette);

      li.appendChild(a);
      hote.appendChild(li);
    });
  }

  /* --- Chargement ---------------------------------------------------------- */
  function charger() {
    var hoteResume = document.getElementById('resume');
    var hoteGraphe = document.getElementById('graph');
    var hoteCommits = document.getElementById('commits');
    if (!hoteGraphe || !hoteCommits) return;

    fetch(SOURCE)
      .then(function (r) {
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.json();
      })
      .then(function (donnees) {
        if (hoteResume) resume(donnees, hoteResume);
        graphe(donnees, hoteGraphe);
        derniersCommits(donnees, hoteCommits);

        /* Le pied affiche la date de génération du fichier. */
        var pied = hoteGraphe.querySelector('.graph-head .since');
        if (pied && donnees.genereLe) {
          pied.textContent = moisCourts(donnees.genereLe) + ' — instantané';
        }

        /* Les éléments viennent d'être créés : l'observateur de site.js les a
           manqués, ils resteraient invisibles. On les rend tous d'un coup,
           sans observer : ils sont déjà dans la fenêtre puisque c'est le
           contenu principal de la page. */
        [hoteResume, hoteGraphe, hoteCommits].forEach(function (c) {
          if (!c) return;
          c.querySelectorAll('[data-apparait]').forEach(function (n) {
            n.classList.add('apparu');
          });
        });
      })
      .catch(function () {
        hoteGraphe.textContent = '';
        var avis = el('p', 'card card-empty',
          'Le graphe n’a pas pu être chargé. Le fichier ' + SOURCE +
          ' est produit par node tools/commits.mjs et n’est pas encore présent sur cette branche.');
        hoteGraphe.appendChild(avis);
      });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', charger);
  } else {
    charger();
  }
})();