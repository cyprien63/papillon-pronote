/* ============================================================
   Élément 8 — PAGE DE DÉCONNEXION (JS)
   Cible : main.deco-content de la page de déconnexion PRONOTE
   Action : injecter le logotype Papillon dans la carte (contenu
   minimal — le reste est masqué par deconnexion.css).
   ============================================================ */

(function () {
  'use strict';

  function init() {
    const card = document.querySelector('main.deco-content');
    if (!card) return;

    /* Idempotence : ne pas ré-injecter lors d'un re-rendu */
    if (document.getElementById('papillon-brand-deco')) return;

    const band = document.createElement('div');
    band.id = 'papillon-brand-deco';
    band.className = 'papillon-brand-deco';

    const img = document.createElement('img');
    img.className = 'papillon-brand__logotype';
    img.alt = 'Papillon';
    img.src = chrome.runtime.getURL('assets/brand/logotype.png');

    band.appendChild(img);
    card.prepend(band);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();