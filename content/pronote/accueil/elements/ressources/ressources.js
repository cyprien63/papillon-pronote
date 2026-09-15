/* ============================================================
   Élément 8 — DERNIÈRES RESSOURCES PÉDAGOGIQUES façon Papillon
   Cible : section.widget.ressourcepedagogique de l'accueil PRONOTE
   Chaque ressource devient une carte façon Papillon : pavé
   teinté à la couleur de la matière (folder), matière colorée,
   nom du fichier (lien conservé), date, icône lien.
   ============================================================ */

(() => {
  'use strict';

  const ICON_CACHE = new Map();
  const ICON_FILES = {
    folder: 'folder.svg',
    link: 'papicons/link.svg',
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

  function svgWrap(inner, component) {
    const span = document.createElement('span');
    span.className = 'papillon-icon';
    span.dataset.papicon = component;
    span.innerHTML = inner;
    return span;
  }

  /* Couleur de matière depuis le style inline (--color-line de PRONOTE) */
  function findColor(el) {
    if (!el) return null;
    if (el.dataset.papRessColor) return el.dataset.papRessColor;
    const match = (el.getAttribute('style') || '').match(/#([0-9a-fA-F]{6}|[0-9a-fA-F]{3})/);
    const color = match ? `#${match[1]}` : null;
    if (color) el.dataset.papRessColor = color;
    return color;
  }

  /* Traite l'en-tête du widget : titre visible + icône folder */
  function processHeader(widget) {
    const header = widget.querySelector(':scope > header');
    if (!header) return;
    const title = header.querySelector('h2, h3');
    if (title && !title.querySelector('.papillon-icon')) {
      const ico = icon('folder');
      if (ico) title.prepend(svgWrap(ico, 'folder'));
    }
    const cta = header.querySelector('.cta-conteneur button');
    if (cta) {
      const arrow = icon('arrowRightUp');
      if (arrow && !cta.querySelector('.papillon-icon')) {
        cta.appendChild(svgWrap(arrow, 'arrowRightUp'));
      }
    }
  }

  /* Construit la carte d'une ressource */
  function buildItem(li, dark) {
    if (li.dataset.papRess) return;
    li.dataset.papRess = '1';
    li.classList.add('pap-ress-item');

    const wrap = li.querySelector('.wrap');
    if (!wrap) return;

    const subjectEl = wrap.querySelector('h3.ie-line-color, h3');
    const subject = (subjectEl ? subjectEl.textContent : '').trim() || 'Ressource';
    const color = findColor(subjectEl) || '#35bba0';

    /* Couleurs : pavé folder + matière teintée */
    li.style.setProperty('--pap-ress-lead-bg', `${color}22`);
    li.style.setProperty('--pap-ress-lead-ic', dark ? adjust(color, 0.2) : adjust(color, -0.4));
    li.style.setProperty('--pap-ress-subject', dark ? adjust(color, 0.3) : adjust(color, -0.2));

    /* Pavé folder à gauche */
    if (!li.querySelector('.pap-ress-lead')) {
      const ico = icon('folder');
      if (ico) {
        const lead = document.createElement('span');
        lead.className = 'pap-ress-lead papillon-icon';
        lead.dataset.papicon = 'folder';
        lead.innerHTML = ico;
        li.prepend(lead);
      }
    }

    /* Icône lien en bout de ligne */
    if (!li.querySelector('.pap-ress-link')) {
      const lk = icon('link');
      if (lk) {
        const t = svgWrap(lk, 'link');
        t.className = 'pap-ress-link papillon-icon';
        li.appendChild(t);
      }
    }

    /* Classes de structure (le lien du fichier reste cliquable) */
    if (subjectEl) subjectEl.classList.add('pap-ress-subject');
    const file = wrap.querySelector('a.chips-btn');
    if (file) file.classList.add('pap-ress-file');
    const dateEl = wrap.querySelector('.date');
    if (dateEl) dateEl.classList.add('pap-ress-date');
  }

  /* Traite un widget « Ressources pédagogiques » complet */
  function processWidget(widget) {
    const isDark = document.documentElement.classList.contains('papillon-dark');
    processHeader(widget);
    widget.querySelectorAll('.one-line > li, ul > li').forEach((li) => buildItem(li, isDark));
  }

  function processAll() {
    document.querySelectorAll('.widget.ressourcepedagogique').forEach((w) => processWidget(w));
  }

  function init() {
    const loadAll = Object.keys(ICON_FILES).map((k) => loadIcon(k));
    Promise.all(loadAll).then(() => {
      processAll();

      const observer = new MutationObserver(() => processAll());
      observer.observe(document.body, { childList: true, subtree: true });

      /* Recolorer si le thème change */
      new MutationObserver(() => {
        document.querySelectorAll('.widget.ressourcepedagogique .pap-ress-item').forEach((li) => delete li.dataset.papRess);
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