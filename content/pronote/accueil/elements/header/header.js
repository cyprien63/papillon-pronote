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

  /* ----- Bascule clair / sombre dans la barre de menu -----
     Le thème n'était réglable que depuis la page d'options de l'extension,
     que rien n'indique depuis PRONOTE. On pose un bouton dans le groupe
     d'icônes rondes du bandeau, en réutilisant les classes de PRONOTE
     (btnImage) pour hériter du style déjà défini dans header.css.

     On écrit dans chrome.storage.sync, la même clé que la page d'options :
     pronote.js écoute storage.onChanged et applique le thème sans
     rechargement, et les deux réglages restent d'accord. */
  const ICONE_SOLEIL = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" class="icone-svg" aria-hidden="true"><circle cx="8" cy="8" r="3.4"/><path d="M8 .8v2.1M8 13.1v2.1M15.2 8h-2.1M2.9 8H.8M13.09 2.91l-1.48 1.48M4.39 11.61l-1.48 1.48M13.09 13.09l-1.48-1.48M4.39 4.39L2.91 2.91" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" fill="none"/></svg>';
  const ICONE_LUNE = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" class="icone-svg" aria-hidden="true"><path d="M14 10.2A6.4 6.4 0 0 1 5.8 2 6.4 6.4 0 1 0 14 10.2z"/></svg>';

  let themeCourant = 'light';

  const peindreBascule = (bouton) => {
    const sombre = themeCourant === 'dark';
    bouton.innerHTML = sombre ? ICONE_SOLEIL : ICONE_LUNE;
    const libelle = sombre ? 'Passer au thème clair' : 'Passer au thème sombre';
    bouton.setAttribute('aria-label', libelle);
    bouton.setAttribute('title', libelle);
  };

  const basculer = () => {
    themeCourant = themeCourant === 'dark' ? 'light' : 'dark';
    document.querySelectorAll('.pap-theme-toggle').forEach(peindreBascule);
    try {
      chrome.storage.sync.set({ theme: themeCourant });
    } catch (e) {
      /* storage indisponible : on applique au moins pour la session */
      document.documentElement.classList.toggle('papillon-dark', themeCourant === 'dark');
    }
  };

  const injectThemeToggle = () => {
    const liste = document.querySelector('nav.objetBandeauEntete_menu .objetBandeauEntete_boutons');
    if (!liste || liste.querySelector('.pap-theme-toggle')) return;

    const li = document.createElement('li');
    const bouton = document.createElement('i');
    bouton.className = 'btnImageIcon btnImage pap-theme-toggle';
    bouton.setAttribute('role', 'button');
    bouton.setAttribute('tabindex', '0');
    peindreBascule(bouton);

    bouton.addEventListener('click', basculer);
    bouton.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        basculer();
      }
    });

    li.appendChild(bouton);
    liste.prepend(li);
  };

  /* Le thème peut changer depuis la page d'options : on suit la valeur. */
  const suivreTheme = () => {
    try {
      chrome.storage.sync.get({ theme: 'light' }).then((s) => {
        themeCourant = s.theme === 'dark' ? 'dark' : 'light';
        document.querySelectorAll('.pap-theme-toggle').forEach(peindreBascule);
      }, () => {});
      chrome.storage.onChanged.addListener((changes, area) => {
        if (area !== 'sync' || !changes.theme) return;
        themeCourant = changes.theme.newValue === 'dark' ? 'dark' : 'light';
        document.querySelectorAll('.pap-theme-toggle').forEach(peindreBascule);
      });
    } catch (e) {
      /* storage indisponible : le bouton reste utilisable pour la session */
    }
  };

  const boot = () => {
    ensureObserved();
    measure();
    injectBranding();
    injectThemeToggle();
    suivreTheme();

    /* PRONOTE reconstruit header/menus à chaque navigation : on garde
       l'œil ouvert en permanence (pas de dépendance au moment initial). */
    new MutationObserver(() => {
      if (ensureObserved()) measure();
      injectBranding();
      injectThemeToggle();
    }).observe(document.body, { childList: true, subtree: true });
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();