/* ============================================================
   Élément 9 — PAGE COMPTE (JS)
   Cible : div.ObjetCompte de la page « Compte » PRONOTE.
   Action : poser une classe de marquage idempotente sur le
   conteneur et la rattacher à chaque re-rendu de PRONOTE
   (navigation dans l'arbre de gauche). Le restyle en lui-même
   est porté par compte.css ; le thème (html.papillon-dark)
   est géré par pronote.js.
   ============================================================ */

(() => {
  'use strict';

  function markCompte() {
    const compte = document.querySelector('.ObjetCompte');
    if (!compte || compte.dataset.papCompte) return;
    compte.classList.add('pap-compte');
    compte.dataset.papCompte = '1';
  }

  function init() {
    markCompte();

    /* Recapter les re-rendus de PRONOTE (changement d'entrée du menu) */
    const observer = new MutationObserver(() => markCompte());
    observer.observe(document.body, { childList: true, subtree: true });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();