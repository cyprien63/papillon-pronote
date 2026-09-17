/* ============================================================
   Élément 1 — HEADER (JS)
   Cible : header.ObjetBandeauEspace + menus sticky
   Action : remplacer le logo Pronote par le logo Papillon, et
   caler le second menu / le thirdmenu juste sous le menu.

   IMPORTANT — le header PRONOTE est construit de façon asynchrone
   (après DOMContentLoaded). On n'appelle donc PAS une fonction
   « init » unique : un MutationObserver scrute le body en continu
   et, dès qu'une barre (nav.objetBandeauEntete_menu /
   nav.objetBandeauEntete_secondmenu) apparaît, on la mesure et on
   la suit via un ResizeObserver. Sans cela, --pap-menu-h et
   --pap-second-h ne sont jamais posés et les barres sticky se
   chevauchent au scroll (fallback CSS 60px/54px au hasard).
   ============================================================ */

(function () {
  'use strict';

  /* ----- Mesures des barres sticky ----- */
  let ro = null;

  const measure = () => {
    const menu = document.querySelector('nav.objetBandeauEntete_menu');
    const second = document.querySelector('nav.objetBandeauEntete_secondmenu');
    const menuH = menu ? menu.offsetHeight : 60;
    /* Plancher 54px = min-height CSS du second menu : si la barre est
       provisoirement masquée (offsetHeight = 0, ex. page d'accueil),
       on ne retombe pas sous 54px, sinon le thirdmenu pointerait trop
       haut et passerait SOUS le second menu au scroll. */
    const secondH = Math.max(second ? second.offsetHeight : 0, 54);
    document.documentElement.style.setProperty('--pap-menu-h', menuH + 'px');
    document.documentElement.style.setProperty('--pap-second-h', secondH + 'px');
  };

  /* Observe les barres non encore suivies (ResizeObserver = hauteur
     qui change quand le titre passe à 2 lignes). Retourne true si au
     moins une nouvelle barre a été prise en charge. */
  const ensureObserved = () => {
    if (!ro) ro = new ResizeObserver(measure);
    let added = false;
    document.querySelectorAll('nav.objetBandeauEntete_menu, nav.objetBandeauEntete_secondmenu')
      .forEach((el) => {
        if (!el.dataset.papHeaderObserved) {
          el.dataset.papHeaderObserved = '1';
          ro.observe(el);
          added = true;
        }
      });
    return added;
  };

  /* ----- Branding Papillon (idempotent, indépendant de la mesure) ----- */
  const injectBranding = () => {
    if (document.getElementById('papillon-brand-accueil')) return;
    const zone = document.querySelector('.ibe_gauche');
    if (!zone) return;

    const oldLogo = zone.querySelector('.ibe_logo, .ibe_logo_image, img[src*="logo.png"]');
    if (oldLogo) {
      const parent = oldLogo.closest('.ibe_image_etab') || oldLogo.parentElement;
      if (parent) parent.remove();
    }

    const band = document.createElement('div');
    band.id = 'papillon-brand-accueil';
    band.className = 'papillon-brand-accueil';

    const img = document.createElement('img');
    img.className = 'papillon-brand__logotype';
    img.alt = 'Papillon';
    img.src = chrome.runtime.getURL('assets/brand/logotype.png');

    band.appendChild(img);
    zone.prepend(band);
  };

  const boot = () => {
    ensureObserved();
    measure();
    injectBranding();

    /* PRONOTE reconstruit header/menus à chaque navigation : on garde
       l'œil ouvert en permanence (pas de dépendance au moment initial). */
    new MutationObserver(() => {
      if (ensureObserved()) measure();
      injectBranding();
    }).observe(document.body, { childList: true, subtree: true });
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();