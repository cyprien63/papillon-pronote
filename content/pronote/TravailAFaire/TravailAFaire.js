/* ============================================================
   PAGE « TRAVAIL À FAIRE » (Cahier de textes — CDT) — JS
   Cible : page CDT (devoirs à faire par date).
   Action : poser des classes de marquage idempotentes (côté CSS)
   et les rattacher à chaque re-rendu de PRONOTE (changement de
   matière, de date, navigation dans l'arbre de gauche). Le
   restyle en lui-même est porté par TravailAFaire.css ; le thème
   (html.papillon-dark) est géré par pronote.js.

   Ancrages :
   - .pap-taf        sur le .conteneur-CDT qui contient la liste
     des matières (.DonneesListe_RessourceMatiere). Le conteneur
     est partagé avec la page « Contenus » → on ne marque que
     lorsqu'il contient bien la liste des matières.
   - .pap-taf-left   sur l'ObjetListe des matières (gauche).
   - .pap-taf-right  sur le conteneur des devoirs par date
     (contient les blocs #TAF_BlocDate…).
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

    /* On n'est sur le CDT que s'il y a des devoirs par date à droite :
       sinon c'est une page « Contenus » (même arbre de gauche). */
    const right =
      (root || document).querySelector('[id^="TAF_BlocDate"]');
    if (!right) return;

    if (root && !root.classList.contains('pap-taf')) {
      root.classList.add('pap-taf');
      root.dataset.papTaf = '1';
    }

    /* Colonne gauche : la liste des matières */
    if (!left.classList.contains('pap-taf-left')) {
      left.classList.add('pap-taf-left');
      left.dataset.papTafLeft = '1';
    }

    /* Colonne droite : conteneur des devoirs par date (#TAF_BlocDate…).
       Marqué sur son plus proche bloc englobant pour restyler toute
       la colonne. */
    const rightBox =
      right.closest('.conteneur-liste-CDT') || right.closest('.fix-bloc') || right;
    if (!rightBox.classList.contains('pap-taf-right')) {
      rightBox.classList.add('pap-taf-right');
      rightBox.dataset.papTafRight = '1';
    }
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