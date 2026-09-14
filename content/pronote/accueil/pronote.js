/* ============================================================
   Papillon — Script principal PRONOTE (bootstrap)
   Charge le thème + observe. Les éléments sont injectés par
   le manifest (header.css + header.js) dans la page.
   ============================================================ */
(() => {
  'use strict';

  if (document.documentElement.hasAttribute('data-papillon')) return;
  document.documentElement.setAttribute('data-papillon', '1');

  function applyTheme(theme) {
    const isDark = theme === 'dark';
    document.documentElement.classList.toggle('papillon-dark', isDark);
    document.documentElement.style.colorScheme = isDark ? 'dark' : 'light';
  }

  function loadTheme() {
    try {
      chrome.storage.sync.get({ theme: 'light' }).then((s) => applyTheme(s.theme), () => applyTheme('light'));
      chrome.storage.onChanged.addListener((changes, area) => {
        if (area === 'sync' && changes.theme) applyTheme(changes.theme.newValue);
      });
    } catch (e) {
      applyTheme('light');
    }
  }

  function start() {
    document.body.classList.add('papillon-pronote');
    loadTheme();

    // Si le branding header n'est pas là, le réinjecter
    if (!document.getElementById('papillon-brand-accueil')) {
      const zone = document.querySelector('.ibe_gauche');
      if (zone) {
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
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
})();
