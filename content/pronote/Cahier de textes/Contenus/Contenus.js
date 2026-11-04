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

   Lisibilité du texte riche : les enseignants colorent leur texte avec
   des styles inline (color:#000000, rouge, fond gris sur les en-têtes de
   tableau…) écrits pour une page blanche. En thème sombre le noir sur fond
   sombre devient illisible, et aucune règle CSS ne peut battre un style
   inline sans connaître la couleur. On mesure donc le contraste réel de
   chaque élément coloré et on ne corrige que ceux qui passent sous 4.5.
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

  /* ---------- Contraste du texte riche ---------- */

  const SEUIL = 4.5;
  const TEXTE_SOMBRE = [16, 19, 15]; /* #10130f */
  const TEXTE_CLAIR = [231, 239, 236]; /* #e7efec */
  const RE_COLOR = /(^|[;\s])color\s*:/i;
  const RE_BG = /(^|[;\s])background(-color)?\s*:/i;

  function parseRgb(css) {
    const m = /rgba?\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)(?:[,\s/]+([\d.]+))?/.exec(css || '');
    return m ? [Number(m[1]), Number(m[2]), Number(m[3]), m[4] === undefined ? 1 : Number(m[4])] : null;
  }

  function luminance(rgb) {
    const [r, g, b] = rgb.slice(0, 3).map((c) => {
      c /= 255;
      return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  }

  function ratio(a, b) {
    const la = luminance(a);
    const lb = luminance(b);
    return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
  }

  /* Premier fond opaque rencontré en remontant (soi-même compris) */
  function backdrop(el) {
    for (let n = el; n && n.nodeType === 1; n = n.parentElement) {
      const c = parseRgb(getComputedStyle(n).backgroundColor);
      if (c && c[3] > 0.95) return c;
    }
    return [255, 255, 255, 1];
  }

  /* Rend la couleur lisible sur le fond : un gris/noir/blanc devient la
     couleur de texte du thème ; une vraie teinte (rouge, bleu…) est poussée
     vers le clair ou le sombre juste ce qu'il faut, en gardant sa teinte. */
  function readable(fg, bg) {
    const surFondSombre = luminance(bg) < 0.4;
    const defaut = surFondSombre ? TEXTE_CLAIR : TEXTE_SOMBRE;
    const sature = Math.max(fg[0], fg[1], fg[2]) - Math.min(fg[0], fg[1], fg[2]) >= 24;
    if (!sature) return defaut;
    const cible = surFondSombre ? 255 : 0;
    for (let p = 0.05; p <= 0.95; p += 0.05) {
      const c = fg.slice(0, 3).map((v) => Math.round(v + (cible - v) * p));
      if (ratio(c, bg) >= SEUIL) return c;
    }
    return defaut;
  }

  /* Rend à l'élément la couleur inline d'origine avant de la réévaluer */
  function restore(el) {
    if (el.dataset.papFix === undefined) return;
    if (el.dataset.papFix) el.style.setProperty('color', el.dataset.papFix);
    else el.style.removeProperty('color');
    delete el.dataset.papFix;
  }

  function fixContrast(force) {
    const cle = document.documentElement.classList.contains('papillon-dark') ? 'd' : 'l';
    document.querySelectorAll('.pap-contenus-right [style], .pap-contenus-right td, .pap-contenus-right th').forEach((el) => {
      if (!force && el.dataset.papChk === cle) return;
      const style = el.getAttribute('style') || '';
      /* Les cellules de tableau sont toujours évaluées : leur fond gris vient
         d'une règle PRONOTE, pas d'un style inline. */
      const colore = el.dataset.papFix !== undefined || RE_COLOR.test(style) || RE_BG.test(style)
        || el.tagName === 'TD' || el.tagName === 'TH';
      if (!colore) return;
      restore(el);
      el.dataset.papChk = cle;
      const fg = parseRgb(getComputedStyle(el).color);
      if (!fg) return;
      const bg = backdrop(el);
      if (ratio(fg, bg) >= SEUIL) return;
      const c = readable(fg, bg);
      el.dataset.papFix = el.style.getPropertyValue('color');
      el.style.setProperty('color', `rgb(${c[0]}, ${c[1]}, ${c[2]})`, 'important');
    });
  }

  let fixPlanifie = false;
  function planifierFix(force) {
    if (fixPlanifie) return;
    fixPlanifie = true;
    requestAnimationFrame(() => {
      fixPlanifie = false;
      fixContrast(force);
    });
  }

  function processAll() {
    markPage();
    planifierFix(false);
  }

  function init() {
    processAll();

    /* Recapter les re-rendus de PRONOTE (changement de matière/date/menu) */
    const observer = new MutationObserver(() => processAll());
    observer.observe(document.body, { childList: true, subtree: true });

    /* Re-traiter si le thème change. Les fonds se repeignent en fondu : on
       mesure une fois tout de suite, puis une fois le fondu terminé. */
    new MutationObserver(() => {
      processAll();
      planifierFix(true);
      setTimeout(() => fixContrast(true), 1200);
    }).observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();