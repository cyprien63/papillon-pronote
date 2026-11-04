/* ============================================================
   Icônes de matière — LISTES ET EN-TÊTES (JS)
   Cible : les endroits où PRONOTE affiche une matière avec une
   simple pastille de couleur ou rien du tout :
   - Cahier de textes → Contenus et Travail à faire : liste des
     matières à gauche, en-tête de chaque contenu à droite ;
   - Accueil : « Dernières ressources pédagogiques », « Dernières
     évaluations », « Dernières notes » et cartes de l'emploi du temps.
   Action : poser devant le nom de la matière la même icône que le
   widget « Travail à faire » de l'accueil (émoji, ou drapeau SVG pour
   les langues), sans pastille.
   Rien n'est retiré du DOM natif : la pastille d'origine est seulement
   masquée par la feuille de style quand l'icône est posée.
   ============================================================ */

(() => {
  'use strict';

  /* Normalisation simple du nom de matière pour trouver l'émoji */
  function normalizeSubject(subject) {
    return String(subject || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]/g, '');
  }

  /* Même table que tav.js. L'ordre compte : le premier motif trouvé gagne. */
  const EMOJI_MAP = [
    ['educationphysique', '⚽'],
    ['allemand', '🇩🇪'],
    ['anglais', '🇬🇧'],
    ['espagnol', '🇪🇸'],
    ['italien', '🇮🇹'],
    ['francais', '📖'],
    ['mathematique', '🧮'],
    ['math', '🧮'],
    ['physiquechimie', '🧪'],
    ['physique', '🧪'],
    ['chimie', '🧪'],
    ['svt', '🌱'],
    ['science', '🔬'],
    ['histoire', '🌍'],
    ['geo', '🌎'],
    ['geographie', '🌎'],
    ['nsi', '💻'],
    ['informatique', '💻'],
    ['technologie', '⚙️'],
    ['ses', '🏦'],
    ['eps', '⚽'],
    ['art', '🎨'],
    ['plastique', '🎨'],
    ['musique', '🎵'],
    ['musical', '🎵'],
    ['philosophie', '🧠'],
    ['parcourscitoyen', '⚖️'],
    ['emc', '⚖️'],
    ['enseignement', '⚖️'],
    ['latin', '🏛️'],
    ['grec', '🏺'],
  ];

  function subjectEmoji(subject) {
    const normalized = normalizeSubject(subject);
    for (const [key, emoji] of EMOJI_MAP) {
      if (normalized.includes(key)) return emoji;
    }
    return '📚';
  }

  /* Windows n'embarque aucun glyphe pour les drapeaux emoji (🇬🇧 s'affiche
     « GB ») : on les dessine en SVG, comme tav.js. Bandes seules, l'arrondi
     est posé par la feuille de style. */
  const FLAG_SVG = {
    '🇩🇪': '<svg viewBox="0 0 5 3" preserveAspectRatio="none" focusable="false"><rect width="5" height="1" y="0" fill="#262626"/><rect width="5" height="1" y="1" fill="#d00"/><rect width="5" height="1" y="2" fill="#ffce00"/></svg>',
    '🇪🇸': '<svg viewBox="0 0 4 3" preserveAspectRatio="none" focusable="false"><rect width="4" height="3" fill="#aa151b"/><rect width="4" height="1.5" y="0.75" fill="#f1bf00"/></svg>',
    '🇮🇹': '<svg viewBox="0 0 3 2" preserveAspectRatio="none" focusable="false"><rect width="1" height="2" x="0" fill="#009246"/><rect width="1" height="2" x="1" fill="#fff"/><rect width="1" height="2" x="2" fill="#ce2b37"/></svg>',
    '🇬🇧': '<svg viewBox="0 0 60 30" preserveAspectRatio="none" focusable="false"><rect width="60" height="30" fill="#012169"/><path d="M0 0l60 30M60 0L0 30" stroke="#fff" stroke-width="6"/><path d="M0 0l60 30M60 0L0 30" stroke="#c8102e" stroke-width="4"/><path d="M30 0v30M0 15h60" stroke="#fff" stroke-width="10"/><path d="M30 0v30M0 15h60" stroke="#c8102e" stroke-width="6"/></svg>',
  };

  /* <i> et non <span> : grades.js lit `.wrap h3 span` pour trouver le nom de la
     matière. L'émoji passe par ::before (data-emoji) pour que textContent reste
     celui de PRONOTE. */
  function buildIcon(subject) {
    const value = subjectEmoji(subject);
    const el = document.createElement('i');
    el.className = 'pap-subj-ico';
    el.setAttribute('aria-hidden', 'true');
    if (FLAG_SVG[value]) {
      el.innerHTML = `<i class="pap-subj-flag">${FLAG_SVG[value]}</i>`;
    } else {
      el.dataset.emoji = value;
    }
    return el;
  }

  /* Pose l'icône dans `host` (avant `before`, sinon en premier enfant) si
     elle n'y est pas déjà. PRONOTE refait parfois le rendu d'une ligne :
     on regarde l'état réel du DOM plutôt qu'un drapeau mémorisé. */
  function ensureIcon(host, subject, before) {
    if (!host || !subject) return null;
    const present = host.querySelector(':scope > .pap-subj-ico');
    if (present) return present;
    const icon = buildIcon(subject);
    host.insertBefore(icon, before && before.parentElement === host ? before : host.firstChild);
    return icon;
  }

  const text = (el) => (el ? el.textContent.trim() : '');

  /* Liste des matières (gauche) de Contenus et de Travail à faire */
  function processLeftLists() {
    document.querySelectorAll('.pap-contenus-left .liste_contenu_ligne').forEach((row) => {
      const gauche = row.querySelector(':scope > .zone-gauche');
      const bar = gauche && gauche.querySelector(':scope > .ie-line-color');
      const subject = text(row.querySelector('.titre-principal'));
      if (!bar || !subject) return; // « Toutes les matières » n'a pas de pastille
      const icon = ensureIcon(gauche, subject, bar);
      if (icon) gauche.classList.add('pap-subj-host');
    });
  }

  /* En-tête de chaque contenu (Contenus, à droite) */
  function processContenusRight() {
    document.querySelectorAll('.pap-contenus-right .couleur-matiere').forEach((bloc) => {
      const subject = text(bloc.querySelector('.titre-matiere'));
      if (!subject) return;
      if (ensureIcon(bloc, subject)) bloc.classList.add('pap-subj-on');
    });
  }

  /* En-tête de chaque devoir (Travail à faire, à droite) : un petit bloc
     coloré vide précède le nom de la matière. */
  function processTafRight() {
    document.querySelectorAll('.pap-contenus-right .entete-element > .flex-contain').forEach((ligne) => {
      const subject = text(ligne.querySelector('.titre-matiere'));
      if (!subject) return;
      const pastille = ligne.querySelector(':scope > div[style*="background-color"]');
      if (!pastille) return;
      if (ensureIcon(ligne, subject, pastille)) {
        ligne.classList.add('pap-subj-host');
      }
    });
  }

  /* Titres <h3> des widgets de l'accueil : l'icône passe avant le nom */
  function processWidgetTitle(selector, getHost) {
    document.querySelectorAll(selector).forEach((h3) => {
      const subject = text(h3);
      const host = getHost ? getHost(h3) : h3;
      if (ensureIcon(host, subject)) {
        host.classList.add('pap-subj-on');
      }
    });
  }

  function processWidgets() {
    processWidgetTitle('.widget.ressourcepedagogique h3.pap-ress-subject');
    processWidgetTitle('.widget.competences li .wrap > h3');
    processWidgetTitle('.widget.notes li h3');
    document.querySelectorAll('.widget.edt li.libelle-cours').forEach((li) => {
      ensureIcon(li, text(li));
    });
  }

  function processAll() {
    processLeftLists();
    processContenusRight();
    processTafRight();
    processWidgets();
  }

  let pending = false;
  function schedule() {
    if (pending) return;
    pending = true;
    requestAnimationFrame(() => {
      pending = false;
      processAll();
    });
  }

  function init() {
    processAll();
    /* PRONOTE refait le rendu des listes et des widgets à chaque navigation */
    new MutationObserver(schedule).observe(document.body, { childList: true, subtree: true });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
