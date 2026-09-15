/* ============================================================
   Élément 1 — HEADER (JS)
   Cible : header.ObjetBandeauEspace + menus sticky
   Action : remplacer le logo Pronote par le logo Papillon, et
   caler le second menu juste sous le menu principal.
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

    /* Header supprimé : le second menu doit se coller sous le menu principal.
       Le CSS lit --pap-menu-h pour positionner la barre sticky du second menu. */
    const menu = document.querySelector('nav.objetBandeauEntete_menu');
    if (menu) {
      const apply = () => {
        document.documentElement.style.setProperty('--pap-menu-h', menu.offsetHeight + 'px');
      };
      apply();
      new ResizeObserver(apply).observe(menu);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
