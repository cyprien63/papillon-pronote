/* ============================================================
   PAGE « FORUMS PÉDAGOGIQUES » — JS
   Cible : page « Cahier de textes → Forums pédagogiques »
   (.InterfaceForumPedagogique : liste des matières à gauche,
   liste des sujets au milieu, messages du forum à droite).
   Action : poser des classes de marquage idempotentes portées
   par Forums.css (fond de page, trois cartes, états vides,
   toolbar) et les rattacher à chaque re-rendu de PRONOTE
   (changement de matière, sélection d'un sujet, filtre). Le
   thème (html.papillon-dark) est géré par pronote.js.

   Ancrages :
   - .pap-forums         sur .InterfaceForumPedagogique
   - .pap-forums-left    sur l'ObjetListe des matières (gauche)
     — elle porte aussi pap-contenus-left (Contenus.js, même
     widget) : le restyle de la colonne gauche est partagé.
   - .pap-forums-middle  sur l'ObjetListe des sujets (milieu)
   - .pap-forums-right   sur .ObjetForumVisuPosts (droite)
   Aucun comportement natif n'est modifié (sélection, recherche,
   filtre, combo « Thème », clic sur un sujet, composition).
   ============================================================ */

(() => {
  'use strict';

  /* Marque un élément de façon idempotente */
  function mark(el, cls, token) {
    if (!el || el.classList.contains(cls)) return;
    el.classList.add(cls);
    el.dataset[token] = '1';
  }

  /* Marque la page et ses trois colonnes */
  function markPage() {
    const root = document.querySelector('.InterfaceForumPedagogique');
    if (!root) return;

    mark(root, 'pap-forums', 'papForums');

    /* Gauche : liste des matières (même widget que Contenus) */
    mark(root.querySelector('.DonneesListe_RessourceMatiere'),
      'pap-forums-left', 'papForumsLeft');

    /* Milieu : liste des sujets / forums */
    mark(root.querySelector('.DonneesListe_Forum_ListeSujets'),
      'pap-forums-middle', 'papForumsMiddle');

    /* Droite : messages du forum sélectionné */
    mark(root.querySelector('.ObjetForumVisuPosts'),
      'pap-forums-right', 'papForumsRight');
  }

  function processAll() {
    markPage();
  }

  function init() {
    processAll();

    /* Recapter les re-rendus de PRONOTE (matière, sujet, filtre…) */
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