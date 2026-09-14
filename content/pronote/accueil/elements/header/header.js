/* ============================================================
   Élément 1 — HEADER (JS)
   Cible : header.ObjetBandeauEspace (.ibe_gauche .ibe_logo Image_Logo_PronoteBarreHaut)
   Action : remplacer le logo Pronote par le logo Papillon.
   ============================================================ */

(function () {
  'use strict';

  /* Attendre que le DOM soit stable */
  function init() {
    const zone = document.querySelector('.ibe_gauche');
    if (!zone) return;

    /* Si le branding est déjà présent, rien à faire */
    if (document.getElementById('papillon-brand-accueil')) return;

    /* Nettoyer le logo Pronote existant dans cette zone */
    const oldLogo = zone.querySelector('.ibe_logo, .ibe_logo_image, img[src*="logo.png"]');
    if (oldLogo) {
      const parent = oldLogo.closest('.ibe_image_etab') || oldLogo.parentElement;
      if (parent) parent.remove();
    }

    /* Créer le branding Papillon */
    const band = document.createElement('div');
    band.id = 'papillon-brand-accueil';
    band.className = 'papillon-brand-accueil';

    const img = document.createElement('img');
    img.className = 'papillon-brand__logotype';
    img.alt = 'Papillon';
    img.src = chrome.runtime.getURL('assets/brand/logotype.png');

    band.appendChild(img);
    zone.prepend(band);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
