/* ============================================================
   Élément 6 — CARNET DE CORRESPONDANCE façon Papillon
   Cible : section.widget.viescolaire de l'accueil PRONOTE
   En-tête + état vide façon Papillon (EmptyItem.tsx) ;
   les éventuels évènements deviennent de petites cartes.
   ============================================================ */

(() => {
  'use strict';

  const ICON_CACHE = new Map();
  const ICON_FILES = {
    bubble: 'text-bubble.svg',
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

  /* Traite l'en-tête du widget : titre visible + icône text-bubble */
  function processHeader(widget) {
    const header = widget.querySelector(':scope > header');
    if (!header) return;
    const title = header.querySelector('h2, h3');
    if (title && !title.querySelector('.papillon-icon')) {
      const ico = icon('bubble');
      if (ico) title.prepend(svgWrap(ico, 'bubble'));
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

  /* État vide façon EmptyItem de Papillon (icône + titre centrés) */
  function processEmpty(widget) {
    const empty = widget.querySelector('.no-events');
    if (!empty || empty.dataset.papVs) return;
    empty.dataset.papVs = '1';
    empty.classList.add('pap-vs-empty');

    const ico = icon('bubble');
    if (ico && !empty.querySelector('.pap-vs-empty-icon')) {
      const span = svgWrap(ico, 'bubble');
      span.className = 'pap-vs-empty-icon papillon-icon';
      empty.prepend(span);
    }
  }

  /* Cartes génériques si des évènements sont réellement présents */
  function processEvents(widget) {
    const list = widget.querySelector('.liste-clickable');
    if (list) {
      list.classList.add('pap-vs-list');
      list.querySelectorAll('li').forEach((li) => li.classList.add('pap-vs-item'));
    }
  }

  /* Traite un widget « Carnet de correspondance » complet */
  function processWidget(widget) {
    processHeader(widget);
    processEmpty(widget);
    processEvents(widget);
  }

  function processAll() {
    document.querySelectorAll('.widget.viescolaire').forEach((w) => processWidget(w));
  }

  function init() {
    const loadAll = Object.keys(ICON_FILES).map((k) => loadIcon(k));
    Promise.all(loadAll).then(() => {
      processAll();

      /* Recapter les re-rendus de PRONOTE */
      const observer = new MutationObserver(() => processAll());
      observer.observe(document.body, { childList: true, subtree: true });

      /* Reprendre l'état vide si le thème change (reprocess idempotent) */
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