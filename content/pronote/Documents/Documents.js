/* ============================================================
   Élément 10 — PAGE DOCUMENTS (JS)
   Cible : .DonneesListe_RubriqueDocuments de la page
   « Échanges de documents avec l'établissement » PRONOTE.
   Action : poser une classe de marquage idempotente (côté CSS)
   et transformer l'état vide du panneau droit en EmptyItem
   Papillon (icône ghost + texte centré). Le restyle est porté
   par Documents.css ; le thème (html.papillon-dark) est géré
   par pronote.js.
   ============================================================ */

(() => {
  'use strict';

  const ICON_CACHE = new Map();
  const ICON_FILES = {
    ghost: 'papicons/ghost.svg',
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

  /* Marque la page (clic sur « Documents » dans l'arbre du menu) */
  function markPage() {
    const docs = document.querySelector('.DonneesListe_RubriqueDocuments');
    if (!docs) return;
    if (!docs.dataset.papDocs) {
      docs.classList.add('pap-docs');
      docs.dataset.papDocs = '1';
    }
    /* Le panneau droit (documents de la catégorie) reçoit lui aussi
       une classe dédiée pour le restyle de sa toolbar et de sa liste. */
    const right = document.querySelector('.DonneesListe_DAT_MesDocuments');
    if (right && !right.dataset.papDocsRight) {
      right.classList.add('pap-docs-right');
      right.dataset.papDocsRight = '1';
    }
  }

  /* État vide : « Aucun document à télécharger » → EmptyItem Papillon */
  function processEmpty() {
    const empty = document.querySelector('.pap-docs-right .liste_messageVide');
    if (!empty || empty.dataset.papDocsEmpty) return;
    empty.dataset.papDocsEmpty = '1';
    empty.classList.add('pap-docs-empty');

    const ico = icon('ghost');
    if (ico && !empty.querySelector('.pap-docs-empty-icon')) {
      const span = svgWrap(ico, 'ghost');
      span.className = 'pap-docs-empty-icon papillon-icon';
      empty.prepend(span);
    }
  }

  function processAll() {
    markPage();
    processEmpty();
  }

  function init() {
    Promise.all(Object.keys(ICON_FILES).map((k) => loadIcon(k))).then(() => {
      processAll();

      /* Recapter les re-rendus de PRONOTE (changement d'entrée du menu) */
      const observer = new MutationObserver(() => processAll());
      observer.observe(document.body, { childList: true, subtree: true });

      /* Re-traiter si le thème change (reprocess idempotent) */
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