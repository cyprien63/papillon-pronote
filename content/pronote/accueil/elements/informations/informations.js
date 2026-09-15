/* ============================================================
   Élément 7 — INFORMATIONS façon Papillon
   Cible : section.widget contenant les « diffusions
   d'information » de l'accueil PRONOTE (icône
   .icone-svg-diffuser_information).
   Chaque info devient une carte façon news.tsx : avatar rond
   coloré (initiales de l'auteur), titre, auteur.
   ============================================================ */

(() => {
  'use strict';

  const ICON_CACHE = new Map();
  const ICON_FILES = {
    newspaper: 'newspaper.svg',
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

  function svgWrap(inner, component) {
    const span = document.createElement('span');
    span.className = 'papillon-icon';
    span.dataset.papicon = component;
    span.innerHTML = inner;
    return span;
  }

  /* Palette officielle Papillon (utils/subjects/colors.ts) — aussi utilisée
     pour les avatars (getProfileColorByName). */
  const COLORS = [
    '#C50017', '#DA2400', '#DD6B00', '#E8901C', '#E8B048',
    '#6BAE00', '#37BB12', '#12BB67', '#26B290', '#26ABB2',
    '#2DB9D8', '#009EC5', '#007FDA', '#3A56D0', '#7600CA',
    '#962DD8', '#B300CA', '#C50066', '#DD004A', '#DD0030',
  ];

  /* Couleur d'avatar déterministe par nom d'auteur (getProfileColorByName) */
  function profileColor(name) {
    let hash = 0;
    const s = String(name || '');
    for (let i = 0; i < s.length; i++) {
      hash = s.charCodeAt(i) + ((hash << 5) - hash);
    }
    return COLORS[Math.abs(hash) % COLORS.length];
  }

  /* Initiales (getInitials) : 1re lettre du 1er mot + du dernier, en maj. */
  function initialsOf(name) {
    const rgx = /(\p{L})\p{L}*|\p{L}/gu;
    const m = [...String(name || '').matchAll(rgx)];
    const first = m.length ? (m[0][1] || m[0][0]) : '';
    const last = m.length > 1 ? (m[m.length - 1][1] || m[m.length - 1][0]) : '';
    return (first + last).toUpperCase();
  }

  /* Traite l'en-tête du widget : titre visible + icône newspaper */
  function processHeader(widget) {
    const header = widget.querySelector(':scope > header');
    if (!header) return;
    const title = header.querySelector('h2, h3');
    if (title && !title.querySelector('.papillon-icon')) {
      const ico = icon('newspaper');
      if (ico) title.prepend(svgWrap(ico, 'newspaper'));
    }
    const cta = header.querySelector('.cta-conteneur button');
    if (cta) {
      const arrow = icon('arrowRightUp');
      if (arrow && !cta.querySelector('.papillon-icon')) {
        cta.appendChild(svgWrap(arrow, 'arrowRightUp'));
      }
    }
  }

  /* Construit la carte d'une information (façon news.tsx) */
  function buildItem(li) {
    if (li.dataset.papInfo) return;
    li.dataset.papInfo = '1';
    li.classList.add('pap-info-item');

    /* Récupérer titre + auteur depuis .wrap (.titre + texte brut) */
    const wrap = li.querySelector('.wrap');
    const titre = wrap && wrap.querySelector('.titre');
    if (!wrap || !titre) return;

    const titleText = (titre.textContent || '').trim() || 'Information';
    let author = '';
    wrap.childNodes.forEach((n) => {
      if (n.nodeType === Node.TEXT_NODE) author += n.textContent || '';
    });
    if (!author.trim()) author = (wrap.textContent || '').replace(titleText, '');
    author = author.trim();

    const color = profileColor(author);

    /* Avatar rond avec initiales */
    if (!li.querySelector('.pap-info-avatar')) {
      const avatar = document.createElement('span');
      avatar.className = 'pap-info-avatar';
      avatar.textContent = initialsOf(author) || '?';
      avatar.style.setProperty('--pap-info-avatar-bg', color);
      li.prepend(avatar);
    }

    /* Neutraliser l'icône PRONOTE (megaphone) sans la retirer du DOM,
       pour que la détection :has() reste valable */
    const nativeIco = li.querySelector('svg.icone-svg-diffuser_information');
    if (nativeIco) nativeIco.classList.add('pap-info-native-icon');

    /* Normaliser le contenu du wrap */
    titre.classList.add('pap-info-title');
    wrap.querySelectorAll(':scope > :not(.pap-info-title)').forEach((el) => el.remove());
    Array.from(wrap.childNodes).forEach((n) => {
      if (n.nodeType === Node.TEXT_NODE) n.nodeValue = '';
    });
    const authorSpan = document.createElement('span');
    authorSpan.className = 'pap-info-author';
    authorSpan.textContent = author;
    wrap.appendChild(authorSpan);
  }

  /* Traite un widget « Informations » complet */
  function processWidget(widget) {
    widget.classList.add('pap-infos');
    processHeader(widget);
    widget.querySelectorAll('.liste-clickable > li').forEach((li) => buildItem(li));
  }

  function isInfosWidget(widget) {
    return !!widget.querySelector('.icone-svg-diffuser_information');
  }

  function processAll() {
    document.querySelectorAll('section.widget').forEach((w) => {
      if (isInfosWidget(w)) processWidget(w);
    });
  }

  function init() {
    const loadAll = Object.keys(ICON_FILES).map((k) => loadIcon(k));
    Promise.all(loadAll).then(() => {
      processAll();

      /* Recapter les re-rendus de PRONOTE (dépliage des infos masquées…) */
      const observer = new MutationObserver(() => processAll());
      observer.observe(document.body, { childList: true, subtree: true });

      /* Reprendre le traitement si le thème change (reprocess idempotent) */
      new MutationObserver(() => processAll())
        .observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();