/* ============================================================
   Élément 11 — PAGE « CONTENUS ET RESSOURCES PÉDAGOGIQUES » (JS)
   Cible : page « Cahier de textes → Contenus et ressources »
   (listes des matières à gauche + contenus par date à droite).
   Action : poser des classes de marquage idempotentes (côté CSS)
   et les rattacher à chaque re-rendu de PRONOTE (changement de
   matière, de date, navigation dans l'arbre de gauche). Le
   restyle en lui-même est porté par Contenus.css ; le thème
   (html.papillon-dark) est géré par pronote.js.

   Ancrages :
   - .pap-contenus     sur le .conteneur-CDT qui contient la liste
     des matières (.DonneesListe_RessourceMatiere). Le conteneur
     est partagé avec la page « Travail à faire » → on ne marque
     que lorsqu'il contient bien la liste des matières.
   - .pap-contenus-left  sur l'ObjetListe des matières (gauche).
   - .pap-contenus-right sur la liste des contenus par date
     (ul.liste-date, droite). Scoped là aussi, car .conteneur-item
     existe sur d'autres pages CDT.
   Aucun comportement natif n'est modifié (sélection de matière,
   dates, thèmes, pièces jointes, bouton « Voir le travail à faire »).
   ============================================================ */

(() => {
  'use strict';

  /* Marque la page et ses deux colonnes, de façon idempotente */
  function markPage() {
    const left = document.querySelector('.ObjetListe.DonneesListe_RessourceMatiere');
    if (!left) return;

    /* Racine de page : le .conteneur-CDT contenant la liste des matières */
    const root = left.closest('.conteneur-CDT');
    if (root && !root.classList.contains('pap-contenus')) {
      root.classList.add('pap-contenus');
      root.dataset.papContenus = '1';
    }

    /* Colonne gauche : la liste des matières */
    if (!left.classList.contains('pap-contenus-left')) {
      left.classList.add('pap-contenus-left');
      left.dataset.papContenusLeft = '1';
    }

    /* Colonne droite : la liste des contenus par date.
       On cible les ul.liste-date de la même racine pour ne pas
       toucher à une éventuelle liste d'une autre page. */
    (root || document).querySelectorAll('ul.liste-date').forEach((right) => {
      if (!right.classList.contains('pap-contenus-right')) {
        right.classList.add('pap-contenus-right');
        right.dataset.papContenusRight = '1';
      }
    });
  }

  function processAll() {
    markPage();
  }

  function init() {
    processAll();

    /* Recapter les re-rendus de PRONOTE (changement de matière/date/menu) */
    const observer = new MutationObserver(() => processAll());
    observer.observe(document.body, { childList: true, subtree: true });

    /* Re-traiter si le thème change (reprocess idempotent) */
    new MutationObserver(() => processAll())
      .observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();