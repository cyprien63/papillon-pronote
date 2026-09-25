/* ============================================================
   PAGE « TRAVAIL À FAIRE À LA MAISON » — VUE HEBDOMADAIRE (JS)
   Cible : page « Cahier de textes → Travail à faire » affichée en
   « Vue hebdomadaire » (une colonne par jour de la semaine, au lieu
   de la liste chronologique de TravailAFaire.js).

   Pourquoi un module à part : en vue hebdomadaire, la colonne des
   matières (`.DonneesListe_RessourceMatiere`) est vide et masquée,
   donc TravailAFaire.js (comme Contenus.js) sort immédiatement et
   aucune de ses classes `pap-taf*` n'est posée : la timeline reste
   entièrement native. Ce module la marque à son tour.

   Le DOM de la timeline est strictement le même que sur « Contenus
   et ressources » (mêmes .PetitEspaceHaut, .ObjetTimeline_classScol
   lPanel, .DivBloc.ArrondisBloc, .celluleMarqueur…), donc on réutilise
   **les mêmes classes `pap-vh*`** et la feuille de style déjà
   déclarée dans manifest.json une seule fois pour les deux pages :
   `Cahier de textes/Contenus/Vue hebdomadaire/VueHebdomadaire.css`.
   Aucun CSS n'est dupliqué ici, seule l'ancre de page change.

   Ancrages :
   - h1#breadcrumbBandeau[aria-label="Travail à faire à la maison"] :
     la page courante est bien « Travail à faire » (ancre de
     détection — le DOM de la timeline est identique sur les autres
     pages, on ne veut pas les capturer).
   - #conteneur-page.Timeline : la grille hebdomadaire.

   Classes posées (idempotentes, un jeton dataset par élément) :
   - .pap-vh-grid sur le .conteneur-CDT de la page (wrappers blancs)
   - .pap-vh       sur #conteneur-page (racine, pour le fond de page)
   - .pap-vh-day   sur chaque colonne de jour ([role="group"])
   - .pap-vh-head  sur l'en-tête du jour (.PetitEspaceHaut)
   - .pap-vh-panel sur le panneau défilant d'un jour
   - .pap-vh-event sur chaque carte de contenu (.DivBloc.ArrondisBloc)
   - .pap-vh-fiche sur la modale « Contenu du cours » ouverte au clic

   En plus, comme sur la page d'accueil (widget TAF) et comme le fait
   `TravailAFaire.js` en vue chronologique : chaque toggle « J'ai
   terminé » (`label.iecb.cb-termine`) est transformé façon Papillon —
   pastille ronde, check dessiné en CSS, texte « Terminé » affiché
   seulement quand c'est coché. Le label reste le même élément
   interactive : le comportement natif (soumission du toggle) n'est
   pas touché.

   Aucun comportement natif n'est modifié : pas de pli/dépli, pas de
   navigation de semaine, pas d'ouverture de contenu, pas de filtrage
   « À faire / Fait ». Le jour courant est signalé en CSS pur
   (:has(.couleurClaireDuTheme)) pour suivre le changement de jour sans
   re-marquage.
   ============================================================ */

(() => {
  'use strict';

  /* Libellé du fil d'Ariane (2e menu) de la page « Travail à faire
     à la maison » : ancre de détection. */
  const PAGE_LABEL = 'Travail à faire à la maison';

  /* Papicons (même cache que les autres modules) */
  const ICON_CACHE = new Map();
  const ICON_FILES = { check: 'check.svg' };

  async function loadIcon(name) {
    const file = ICON_FILES[name];
    if (!file || ICON_CACHE.has(name)) return;
    try {
      const url = chrome.runtime.getURL(`assets/icons/papicons/${file}`);
      const res = await fetch(url);
      const text = await res.text();
      ICON_CACHE.set(name, text.replace(/fill="black"/g, 'fill="currentColor"'));
    } catch (e) {
      /* ignore — l'icône est optionnelle */
    }
  }

  function icon(name) {
    return ICON_CACHE.get(name) || null;
  }

  function svgWrap(inner, component) {
    const span = document.createElement('span');
    span.className = 'papillon-icon';
    span.dataset.papicon = component;
    span.innerHTML = inner;
    return span;
  }

  /* Ajuste la vivacité d'une couleur (équivalent adjustColor de Papillon) */
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

  /* Couleur de l'événement : liseré .celluleMarqueur de la carte, à
     défaut le fond inline de la colonne du jour. */
  function findColor(label) {
    const card = label.closest('.DivBloc.ArrondisBloc');
    const day = label.closest('[role="group"]');
    for (const scope of [card, day]) {
      if (!scope) continue;
      const marker = scope.querySelector('.celluleMarqueur');
      const st = (marker || scope).getAttribute('style') || '';
      const m = st.match(/background(?:-color)?\s*:\s*#([0-9a-fA-F]{3,8});?/);
      if (m) return `#${m[1]}`;
    }
    return null;
  }

  /* Ajoute une classe une seule fois par élément (jeton dataset) */
  function addClass(el, cls, token) {
    if (!el || el.dataset[token]) return;
    el.dataset[token] = '1';
    el.classList.add(cls);
  }

  /* Renvoie #conteneur-page.Timeline si la page courante est
     « Travail à faire » ET affichée en vue hebdomadaire. */
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
     .conteneur-fiche-CDT : c'est bien la fiche d'un travail de la
     semaine ouverte. Le marqueur permet de ne pas toucher aux autres
     fenêtres de PRONOTE. */
  function markFenetre() {
    document.querySelectorAll('.ObjetFenetre_Espace.ObjetFenetre_racine').forEach((win) => {
      if (win.classList.contains('is-info') || win.querySelector('.afficheJeux')) return;
      if (!win.querySelector('.conteneur-fiche-CDT')) return;
      addClass(win, 'pap-vh-fiche', 'papVhFiche');
    });
  }

  /* Transforme un toggle « J'ai terminé » façon Papillon (idempotent) :
     même rendu que le widget TAF de l'accueil et que la vue
     chronologique de TravailAFaire.js (check dessiné en CSS, texte
     « Terminé » seulement quand coché, teinte sous la couleur de la
     matière). */
  function processCheckbox(label, dark) {
    if (label.dataset.papVhCb) return;
    label.dataset.papVhCb = '1';

    /* Check Papicon à la place des 3 svg natifs */
    if (!label.querySelector('.pap-vh-check')) {
      const checkIco = icon('check');
      if (checkIco) {
        const c = svgWrap(checkIco, 'check');
        c.className = 'pap-vh-check papillon-icon';
        c.querySelector('svg').classList.add('pap-vh-check-icon');
        const bullet = label.querySelector('span[aria-hidden="true"]');
        if (bullet) bullet.replaceWith(c);
        else label.prepend(c);
      }
    }

    /* Texte « Terminé » affiché quand coché */
    if (!label.querySelector('.pap-vh-done-text')) {
      const t = document.createElement('span');
      t.className = 'pap-vh-done-text';
      t.textContent = 'Terminé';
      label.appendChild(t);
    }

    /* Retirer le libellé natif « J'ai terminé » (doublon visuel) */
    label.querySelectorAll('span').forEach((s) => {
      if (!s.classList.contains('pap-vh-check') && !s.classList.contains('pap-vh-done-text')) {
        s.remove();
      }
    });

    /* Couleur de l'événement, portée sur la carte (ou sur la fiche) */
    const box = label.closest('.DivBloc.ArrondisBloc') || label.closest('.conteneur-fiche-CDT') || label;
    const color = findColor(label) || '#35bba0';
    box.style.setProperty('--pap-vh-cb-color', color);
    box.style.setProperty('--pap-vh-cb-tint', adjust(color, dark ? 0.3 : -0.3));
  }

  function processAll() {
    const root = findTimeline();
    if (!root) return;
    markPage(root);
    markFenetre();

    const dark = document.documentElement.classList.contains('papillon-dark');
    document
      .querySelectorAll(':is(.pap-vh-event, .pap-vh-fiche) label.iecb.cb-termine')
      .forEach((l) => processCheckbox(l, dark));
  }

  function init() {
    /* Le check Papicon est chargé une fois, comme dans les autres
       modules : processAll() est relancé ensuite. */
    loadIcon('check').then(() => {
      processAll();

      /* Recapter les re-rendus de PRONOTE (changement de semaine,
       ouverture d'un contenu, cocher « J'ai terminé »…) */
      const observer = new MutationObserver(() => processAll());
      observer.observe(document.body, { childList: true, subtree: true });

      /* Re-traiter si le thème change (la teinte dépend du sombre) */
      new MutationObserver(() => {
        document
          .querySelectorAll(':is(.pap-vh-event, .pap-vh-fiche) label.iecb.cb-termine')
          .forEach((l) => {
            delete l.dataset.papVhCb;
          });
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
