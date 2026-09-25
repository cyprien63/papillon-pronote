/* ============================================================
   PAGE « CONTENUS ET RESSOURCES PÉDAGOGIQUES » — VUE HEBDOMADAIRE (JS)
   Cible : page « Cahier de textes → Contenus et ressources »
   affichée en « Vue hebdomadaire » (une colonne par jour de la
   semaine, au lieu de la liste chronologique de Contenus.js).

   Pourquoi un module à part : en vue hebdomadaire, la colonne des
   matières (`.DonneesListe_RessourceMatiere`) est vide et masquée,
   donc `Contenus.js` / `TravailAFaire.js` sortent immédiatement et
   aucune de leurs classes `pap-contenus*` / `pap-taf*` n'est posée :
   la timeline reste entièrement native. Ce module la marque à son
   tour, le restyle restant porté par VueHebdomadaire.css ; le
   thème (html.papillon-dark) est géré par pronote.js.

   Ancrages :
   - h1#breadcrumbBandeau[aria-label="Contenus et ressources
     pédagogiques"] : la page courante est bien « Contenus » (ancre
     de détection — le DOM de la timeline est identique sur les
     autres pages, on ne veut pas les capturer).
   - #conteneur-page.Timeline : la grille hebdomadaire (lattitude
     de la vue hebdo).

   Classes posées (idempotentes, un jeton dataset par élément) :
   - .pap-vh-grid sur le .conteneur-CDT de la page (wrappers blancs)
   - .pap-vh       sur #conteneur-page (racine, pour le fond de page)
   - .pap-vh-day   sur chaque colonne de jour ([role="group"])
   - .pap-vh-head  sur l'en-tête du jour (.PetitEspaceHaut)
   - .pap-vh-panel sur le panneau défilant d'un jour
    - .pap-vh-event sur chaque carte de contenu (.DivBloc.ArrondisBloc)
    - .pap-vh-fiche sur la modale « Contenu du cours » ouverte au clic
      sur une carte (ObjetFenetre_Espace, rendue hors de #conteneur-page,
      donc marquée via processAll() et non via la timeline)

   Aucun comportement natif n'est modifié : pas de pli/dépli, pas de
   navigation de semaine, pas d'ouverture de contenu. Le jour courant
   est signalé en CSS pur (:has(.couleurClaireDuTheme)) pour suivre
   le changement de jour sans re-marquage.
   ============================================================ */

(() => {
  'use strict';

  /* Libellé du fil d'Ariane (2e menu) de la page « Contenus et
     ressources pédagogiques » : ancre de détection. */
  const PAGE_LABEL = 'Contenus et ressources pédagogiques';

  /* Ajoute une classe une seule fois par élément (jeton dataset) */
  function addClass(el, cls, token) {
    if (!el || el.dataset[token]) return;
    el.dataset[token] = '1';
    el.classList.add(cls);
  }

  /* Renvoie #conteneur-page.Timeline si la page courante est
     « Contenus et ressources » ET affichée en vue hebdomadaire. */
  function findTimeline() {
    const h1 = document.getElementById('breadcrumbBandeau');
    if (!h1) return null;
    if ((h1.getAttribute('aria-label') || '').trim() !== PAGE_LABEL) return null;
    return document.querySelector('#conteneur-page.Timeline');
  }

  function markPage(root) {
    /* Wrappers de la page (colonnes blanches natives) */
    addClass(root.closest('.conteneur-CDT'), 'pap-vh-grid', 'papVhGrid');

    /* Racine de la timeline */
    addClass(root, 'pap-vh', 'papVh');

    /* Colonnes de jours : on part des panneaux de défilement, plus
       fiables que la structure du parent (et qui suit les re-rendus :
       PRONOTE reconstruit la semaine entière au changement de semaine). */
    root.querySelectorAll('.ObjetTimeline_classScrollPanel').forEach((panel) => {
      addClass(panel, 'pap-vh-panel', 'papVhPanel');
      const day = panel.closest('[role="group"]');
      addClass(day, 'pap-vh-day', 'papVhDay');
      const head = day && day.querySelector('.PetitEspaceHaut');
      addClass(head, 'pap-vh-head', 'papVhHead');
    });

    /* Cartes de contenu (matière, prof, corps dépliable) */
    root.querySelectorAll('.DivBloc.ArrondisBloc').forEach((event) => {
      addClass(event, 'pap-vh-event', 'papVhEvent');
    });
  }

  /* Modale « Contenu du cours » : PRONOTE la rend hors de
     #conteneur-page (dans #zone_fenetre), on la marque donc à part.
     Sans .is-info (modale de confirmation) ni afficheJeux, et avec
     .conteneur-fiche-CDT : c'est bien la fiche d'un contenu de la
     semaine ouverte. Le marqueur permet de ne pas toucher aux autres
     fenêtres de PRONOTE. */
  function markFenetre() {
    document.querySelectorAll('.ObjetFenetre_Espace.ObjetFenetre_racine').forEach((win) => {
      if (win.classList.contains('is-info') || win.querySelector('.afficheJeux')) return;
      if (!win.querySelector('.conteneur-fiche-CDT')) return;
      addClass(win, 'pap-vh-fiche', 'papVhFiche');
    });
  }

  function processAll() {
    const root = findTimeline();
    if (!root) return;
    markPage(root);
    markFenetre();
  }

  function init() {
    processAll();

    /* Recapter les re-rendus de PRONOTE (changement de semaine,
     ouverture d'un contenu, reconstruction du DOM) */
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
