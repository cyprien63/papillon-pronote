/* ============================================================
   Élément 5 — DERNIÈRES NOTES façon Papillon
   Cible : section.widget.notes de l'accueil PRONOTE
   Transforme chaque note de la liste en carte façon Papillon
   (Grade.tsx) : carte arrondie connectée, matière + date à
   gauche, pilule colorée avec la note et /20 à droite.
   ============================================================ */

(() => {
  'use strict';

  const ICON_CACHE = new Map();
  const ICON_FILES = {
    grades: 'grades.svg',
    arrowRightUp: 'papicons/arrow-right-up.svg',
  };

  function icon(name) {
    return ICON_CACHE.get(name) || null;
  }

  async function loadIcon(name) {
    const file = ICON_FILES[name];
    if (!file || ICON_CACHE.has(name)) return;
    try {
      const url = chrome.runtime.getURL(`assets/icons/${file}`);
      const res = await fetch(url);
      const text = await res.text();
      ICON_CACHE.set(name, text.replace(/fill="black"/g, 'fill="currentColor"'));
    } catch (e) {
      /* ignore — l'icône est optionnelle */
    }
  }

  /* Mélange HSL vers le blanc (p>0) ou le noir (p<0) — like adjustColor de Papillon */
  function adjust(hex, percent) {
    if (!hex) return hex;
    hex = hex.replace(/^#/, '');
    if (hex.length === 3) {
      hex = hex.split('').map((c) => c + c).join('');
    }
    const num = parseInt(hex, 16);
    let r = num >> 16;
    let g = (num >> 8) & 0x00ff;
    let b = num & 0x0000ff;
    const t = percent < 0 ? 0 : 255;
    const p = Math.abs(percent);
    r = Math.round(r + (t - r) * p);
    g = Math.round(g + (t - g) * p);
    b = Math.round(b + (t - b) * p);
    return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
  }

  /* Luminance relative sRGB (WCAG 2.1) */
  function luminance(hex) {
    hex = String(hex).replace(/^#/, '');
    if (hex.length === 3) hex = hex.split('').map((c) => c + c).join('');
    const n = parseInt(hex, 16);
    const canaux = [n >> 16, (n >> 8) & 0xff, n & 0xff].map((c) => {
      c /= 255;
      return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * canaux[0] + 0.7152 * canaux[1] + 0.0722 * canaux[2];
  }

  function contrast(a, b) {
    const la = luminance(a);
    const lb = luminance(b);
    return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
  }

  /* La pilule de note est posée sur un fond neutre : certaines teintes de la
     palette (cyan, ambre) y passent sous le seuil de lisibilité. On les pousse
     vers le noir ou le blanc juste ce qu'il faut, en gardant la teinte. */
  function readableOn(couleur, fond, cible) {
    const vers = luminance(fond) > 0.5 ? -1 : 1;
    for (let p = 0; p <= 0.95; p += 0.05) {
      const candidat = adjust(couleur, vers * p);
      if (contrast(candidat, fond) >= cible) return candidat;
    }
    return vers < 0 ? '#10130f' : '#e7efec';
  }

  function svgWrap(inner, component) {
    const span = document.createElement('span');
    span.className = 'papillon-icon';
    span.dataset.papicon = component;
    span.innerHTML = inner;
    return span;
  }

  /* Palette officielle des matières Papillon (utils/subjects/colors.ts) */
  const COLORS = [
    '#C50017', '#DA2400', '#DD6B00', '#E8901C', '#E8B048',
    '#6BAE00', '#37BB12', '#12BB67', '#26B290', '#26ABB2',
    '#2DB9D8', '#009EC5', '#007FDA', '#3A56D0', '#7600CA',
    '#962DD8', '#B300CA', '#C50066', '#DD004A', '#DD0030',
  ];

  /* Hash déterministe du nom de matière → couleur stable (pas de stockage web) */
  function hashColor(subject) {
    let hash = 0;
    const s = String(subject || '');
    for (let i = 0; i < s.length; i++) {
      hash = ((hash << 5) - hash + s.charCodeAt(i)) | 0;
    }
    return COLORS[Math.abs(hash) % COLORS.length];
  }

  /* Normalisation simple du nom de matière pour trouver l'émoji */
  function normalizeSubject(subject) {
    return String(subject || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]/g, '');
  }

  const EMOJI_MAP = [
    ['allemand', '🇩🇪'],
    ['anglais', '🇬🇧'],
    ['espagnol', '🇪🇸'],
    ['italien', '🇮🇹'],
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
    ['ingenierie', '⚙️'],
    ['ingenier', '⚙️'],
    ['ses', '🏦'],
    ['eps', '⚽'],
    ['educationphysique', '⚽'],
    ['art', '🎨'],
    ['plastique', '🎨'],
    ['musique', '🎵'],
    ['philosophie', '🧠'],
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

  /* Parse « 12,30 » → 12.3 (null si non numérique) */
  function parseScore(text) {
    const raw = String(text || '').trim();
    const numeric = parseFloat(raw.replace(/\s/g, '').replace(',', '.').replace(/[^0-9.\-]/g, ''));
    return { raw, num: isNaN(numeric) ? null : numeric };
  }

  /* Traite l'en-tête du widget : titre visible + icône grades */
  function processHeader(widget) {
    const header = widget.querySelector(':scope > header');
    if (!header) return;
    const title = header.querySelector('h2, h3');
    if (title && !title.querySelector('.papillon-icon')) {
      const ico = icon('grades');
      if (ico) title.prepend(svgWrap(ico, 'grades'));
    }
    /* « Tout voir » : remplacer la flèche PRONOTE par celle de Papillon */
    const cta = header.querySelector('.cta-conteneur button');
    if (cta) {
      const arrow = icon('arrowRightUp');
      if (arrow && !cta.querySelector('.papillon-icon')) {
        cta.appendChild(svgWrap(arrow, 'arrowRightUp'));
      }
    }
  }

  /* Construit la carte d'une note (façon Grade.tsx) */
  function buildGrade(li, dark) {
    if (li.dataset.papGrade) return;
    li.dataset.papGrade = '1';

    const subjectEl = li.querySelector('.wrap h3 span');
    const subject = (subjectEl ? subjectEl.textContent : '').trim() || 'Note';
    const dateEl = li.querySelector('.infos-conteneur .date');
    const scoreEl = li.querySelector('.as-info');
    const { raw, num } = parseScore(scoreEl ? scoreEl.textContent : '');

    /* Date PRONOTE « le 10 sept. » → « 10 sept. » */
    if (dateEl) {
      const text = (dateEl.textContent || '').replace(/^le\s+/i, '').trim();
      if (text) dateEl.textContent = text;
      dateEl.classList.add('pap-grade-date');
    }

    const color = hashColor(subject);

    /* Couleurs : texte de la note = couleur matière (éclaircie en sombre) */
    li.dataset.papGradeEmoji = subjectEmoji(subject);
    li.style.setProperty('--pap-grade-color', readableOn(color, dark ? '#202926' : '#e8e9e9', 4.5));
    li.style.setProperty('--pap-grade-bg', `${color}33`);

    if (subjectEl) subjectEl.classList.add('pap-grade-subject');
    if (scoreEl) {
      scoreEl.classList.add('pap-grade-score');
      /* Pilule score : note + /20 — uniquement si la note est déjà sur 20.
         Quand PRONOTE fournit un barème natif (ex. span.bareme « /10 »),
         on le garde tel quel : un 7/10 n'est pas un 7/20. */
      if (num !== null && !scoreEl.querySelector('.bareme')) {
        const small = document.createElement('small');
        small.className = 'pap-grade-outof';
        small.textContent = '/20';
        if (!scoreEl.querySelector('.pap-grade-outof')) scoreEl.appendChild(small);
        if (num === 20) {
          li.classList.add('pap-grade-max');
          li.style.setProperty('--pap-grade-max', dark ? adjust(color, 0.2) : adjust(color, -0.4));
        }
      }
    }

    /* Widget sans date ni note exploitable : garder une lisibilité propre */
    li.classList.add('pap-grade');
  }

  /* Traite un widget « Dernières notes » complet */
  function processWidget(widget) {
    const isDark = document.documentElement.classList.contains('papillon-dark');
    processHeader(widget);
    widget.querySelectorAll('.liste-clickable > li').forEach((li) => buildGrade(li, isDark));
  }

  function processAll() {
    document.querySelectorAll('.widget.notes').forEach((w) => processWidget(w));
  }

  function init() {
    const loadAll = Object.keys(ICON_FILES).map((k) => loadIcon(k));
    Promise.all(loadAll).then(() => {
      processAll();

      /* Recapter les re-rendus de PRONOTE (navigation, nouvelle note…) */
      const observer = new MutationObserver(() => processAll());
      observer.observe(document.body, { childList: true, subtree: true });

      /* Recolorer si le thème change */
      new MutationObserver(() => {
        document.querySelectorAll('.widget.notes .pap-grade').forEach((li) => delete li.dataset.papGrade);
        processAll();
      }).observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();