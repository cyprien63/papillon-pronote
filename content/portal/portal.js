/* ============================================================
   Papillon — Content script pour la page de connexion ENT
   Cible : cas.ent.auvergnerhonealpes.fr/login (+ ports ENT)
   Injecte le thème Papillon + branding (assets officiels du
   repo Papillon), sans toucher au fonctionnement du formulaire
   (radios, wayf.js, Confirm).
   ============================================================ */

(() => {
  'use strict';

  if (document.documentElement.hasAttribute('data-papillon')) return;
  document.documentElement.setAttribute('data-papillon', '1');

  const asset = (name) => chrome.runtime.getURL(`assets/brand/${name}`);

  function injectStylesheet() {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.type = 'text/css';
    link.id = 'papillon-portal-css';
    link.href = chrome.runtime.getURL('content/portal/portal.css');
    (document.head || document.documentElement).appendChild(link);
  }

  function injectBrand() {
    const panel = document.querySelector('.cas__login .cas__panel') || document.querySelector('.cas__panel');
    if (!panel || document.getElementById('papillon-brand')) return;

    const band = document.createElement('div');
    band.id = 'papillon-brand';
    band.className = 'papillon-brand';
    band.innerHTML = `
      <img class="papillon-brand__logotype" src="${asset('logotype.png')}" alt="Papillon" />`;

    panel.prepend(band);
  }

  function enforceSingleSelection() {
    const radios = Array.from(document.querySelectorAll('input[type="radio"][name="selection"]'));

    document.addEventListener(
      'change',
      (e) => {
        if (e.target && e.target.name === 'selection') {
          radios.forEach((r) => {
            if (r !== e.target) r.checked = false;
          });
        }
      },
      true
    );

    document.addEventListener(
      'click',
      (e) => {
        const card = e.target.closest('.cas__wayf-idp, li .cas__wayf-categorie');
        if (!card) return;
        const radio = card.querySelector('.js-wayf-composant');
        if (!radio) return;
        radio.checked = true;
        radios.forEach((r) => {
          if (r !== radio) r.checked = false;
        });
      },
      true
    );
  }

  function applyTheme(theme) {
    document.documentElement.classList.toggle('papillon-dark', theme === 'dark');
  }

  function start() {
    document.body.classList.add('papillon-theme');
    injectStylesheet();
    injectBrand();
    enforceSingleSelection();

    if (chrome && chrome.storage && chrome.storage.sync) {
      const get = chrome.storage.sync.get;
      const p = (get.call ? get.call(chrome.storage.sync, { theme: 'light' }) : chrome.storage.sync.get({ theme: 'light' }));
      Promise.resolve(p).then((s) => applyTheme(s.theme));
      chrome.storage.onChanged.addListener((changes, area) => {
        if (area === 'sync' && changes.theme) applyTheme(changes.theme.newValue);
      });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
})();