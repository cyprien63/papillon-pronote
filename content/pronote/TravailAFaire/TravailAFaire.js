/* ============================================================
   PAGE « TRAVAIL À FAIRE » (Cahier de textes — CDT) — JS
   Cible : page CDT (devoirs à faire par date).
   Action :
   1) Poser des classes de marquage idempotentes (côté CSS) sur
      la page (.pap-taf), la liste des matières (.pap-taf-left)
      et la colonne des devoirs (.pap-taf-right si présente).
   2) Transformer chaque toggle « J'ai terminé » (label.iecb
      .cb-termine) comme sur le widget TAF de l'accueil : check
      Papicon injecté, texte « Terminé », pastille sous la couleur
      de la matière (--pap-taf-tint).
   Le restyle en lui-même est porté par TravailAFaire.css ; le
   thème (html.papillon-dark) est géré par pronote.js.
   Aucun comportement natif n'est modifié (sélection de matière,
   dates, thèmes, pièces jointes, soumission du toggle).
   ============================================================ */

(() => {
  'use strict';

  const ICON_CACHE = new Map();
  const ICON_FILES = {
    check: 'check.svg',
  };

  function icon(name) {
    return ICON_CACHE.get(name) || null;
  }

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

  /* Transformation HSL (ajuste la vivacité, comme adjustColor de Papillon) */
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

  /* Extrait la couleur de la matière depuis un style inline (priorité à
     --color-line, sinon aux couleurs de fond) dans le bloc du devoir. */
  function findColor(root) {
    const scan = (n) => {
      if (!n || n.nodeType !== 1) return null;
      if (n.dataset.papTafColor) return n.dataset.papTafColor;
      const st = n.getAttribute('style') || '';
      const mLine = st.match(/--color-line\s*:\s*#(?:[0-9a-fA-F]{3,8});?/);
      if (mLine) {
        n.dataset.papTafColor = `#${mLine[1]}`;
        return n.dataset.papTafColor;
      }
      const mBg = st.match(/background(?:-color)?\s*:\s*#([0-9a-fA-F]{3,8});?/);
      if (mBg) {
        n.dataset.papTafColor = `#${mBg[1]}`;
        return n.dataset.papTafColor;
      }
      for (const c of n.children) {
        const r = scan(c);
        if (r) return r;
      }
      return null;
    };
    return scan(root);
  }

  /* Marque la page et ses colonnes, de façon idempotente */
  function markPage() {
    const left = document.querySelector('.ObjetListe.DonneesListe_RessourceMatiere');
    if (!left) return;

    /* Racine de page : le .conteneur-CDT contenant la liste des matières */
    const root = left.closest('.conteneur-CDT');

    /* La colonne droite existe s'il y a des blocs de devoirs par date
       (#TAF_BlocDate…) ou un toggle « J'ai terminé » (label.iecb.cb-termine).
       Sans cela, c'est la page « Contenus » (même arbre de gauche). */
    const scope = root || document;
    const droitBloc = scope.querySelector('[id^="TAF_BlocDate"]');
    const aDroite = droitBloc || scope.querySelector('label.iecb.cb-termine');
    if (!aDroite) return;

    if (root && !root.classList.contains('pap-taf')) {
      root.classList.add('pap-taf');
      root.dataset.papTaf = '1';
    }

    /* Colonne gauche : la liste des matières */
    if (!left.classList.contains('pap-taf-left')) {
      left.classList.add('pap-taf-left');
      left.dataset.papTafLeft = '1';
    }

    /* Colonne droite : conteneur des devoirs par date, marqué sur son bloc
       englobant pour restyler toute la colonne. */
    if (droitBloc && !droitBloc.dataset.papTafRight) {
      const rightBox =
        droitBloc.closest('.conteneur-liste-CDT') || droitBloc.closest('.fix-bloc') || droitBloc;
      rightBox.classList.add('pap-taf-right');
      rightBox.dataset.papTafRight = '1';
    }
  }

  /* Transforme un toggle « J'ai terminé » façon Papillon (idempotent) */
  function processCheckbox(label, dark) {
    if (label.dataset.papTafCb) return;
    label.dataset.papTafCb = '1';

    /* Check Papicon : on remplace la pastille PRONOTE (les 3 svg natifs
       sont dans span[aria-hidden="true"]) */
    if (!label.querySelector('.pap-taf-check')) {
      const checkIco = icon('check');
      if (checkIco) {
        const c = svgWrap(checkIco, 'check');
        c.className = 'pap-taf-check papillon-icon';
        c.querySelector('svg').classList.add('pap-taf-check-icon');
        const bullet = label.querySelector('span[aria-hidden="true"]');
        if (bullet) bullet.replaceWith(c);
        else label.prepend(c);
      }
    }

    /* Texte « Terminé » affiché quand coché */
    if (!label.querySelector('.pap-taf-done-text')) {
      const t = document.createElement('span');
      t.className = 'pap-taf-done-text';
      t.textContent = 'Terminé';
      label.appendChild(t);
    }

    /* Retirer le texte PRONOTE « J'ai terminé » (doublon visuel) */
    label.querySelectorAll('span').forEach((s) => {
      if (!s.classList.contains('pap-taf-check') && !s.classList.contains('pap-taf-done-text')) {
        s.remove();
      }
    });

    /* Couleur de la matière + teinte, portées sur la carte du devoir */
    const box = label.closest('.conteneur-item') || label;
    const color = findColor(box) || '#35bba0';
    box.style.setProperty('--pap-taf-color', color);
    box.style.setProperty('--pap-taf-tint', adjust(color, dark ? 0.3 : -0.3));
  }

  function processAll() {
    markPage();

    const dark = document.documentElement.classList.contains('papillon-dark');
    document.querySelectorAll('.pap-taf label.iecb.cb-termine').forEach((l) =>
      processCheckbox(l, dark)
    );
  }

  function init() {
    loadIcon('check').then(() => {
      processAll();

      /* Recapter les re-rendus de PRONOTE (cocher un devoir, navigation…) */
      const observer = new MutationObserver(() => processAll());
      observer.observe(document.body, { childList: true, subtree: true });

      /* Re-traiter si le thème change (la teinte dépend du sombre) */
      new MutationObserver(() => {
        document.querySelectorAll('.pap-taf label.iecb.cb-termine').forEach((l) => {
          delete l.dataset.papTafCb;
        });
        document.querySelectorAll('.pap-taf [data-pap-taf-color]').forEach((el) => {
          delete el.dataset.papTafColor;
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