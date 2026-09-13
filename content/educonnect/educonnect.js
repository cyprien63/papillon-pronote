/* ============================================================
   Papillon — Content script pour la page de connexion EduConnect
   Cible : educonnect.education.gouv.fr/idp/profile/SAML2/POST/SSO
   Flux Shibboleth : vérif navigateur (e1s1), sélection profil +
   identifiants (e1s2), redirection SAML (SAMLResponse).
   Injecte le thème Papillon + branding (assets officiels du
   repo Papillon), sans toucher au fonctionnement du formulaire
   (posts SAML, champs j_username / j_password, typeUser, ...).
   ============================================================ */

(() => {
  'use strict';

  if (document.documentElement.hasAttribute('data-papillon')) return;
  document.documentElement.setAttribute('data-papillon', '1');

  const asset = (name) => chrome.runtime.getURL(`assets/brand/${name}`);
  const font = (name) => chrome.runtime.getURL(`styles/fonts/${name}`);

  function injectFonts() {
    if (document.getElementById('papillon-fonts')) return;
    const s = document.createElement('style');
    s.id = 'papillon-fonts';
    s.textContent = [
      { w: 400, latin: 'inter-400-latin.woff2', latinExt: 'inter-400-latin-ext.woff2' },
      { w: 500, latin: 'inter-500-latin.woff2', latinExt: 'inter-500-latin-ext.woff2' },
      { w: 600, latin: 'inter-600-latin.woff2', latinExt: 'inter-600-latin-ext.woff2' },
      { w: 700, latin: 'inter-700-latin.woff2', latinExt: 'inter-700-latin-ext.woff2' },
      { w: 800, latin: 'inter-800-latin.woff2', latinExt: 'inter-800-latin-ext.woff2' },
    ].map(({ w, latin, latinExt }) => `
      @font-face { font-family: 'Inter'; font-style: normal; font-weight: ${w}; font-display: swap; src: url(${font(latin)}) format('woff2'); unicode-range: U+0000-00FF; }
      @font-face { font-family: 'Inter'; font-style: normal; font-weight: ${w}; font-display: swap; src: url(${font(latinExt)}) format('woff2'); unicode-range: U+0100-024F; }
    `).join('\n');
    (document.head || document.documentElement).appendChild(s);
  }

  const ICONS = {
    responsable: `
      <svg viewBox="0 0 24 24" fill="#ffffff" aria-hidden="true" focusable="false">
        <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
      </svg>`,
    eleve: `
      <svg viewBox="0 0 24 24" fill="#ffffff" aria-hidden="true" focusable="false">
        <path d="M5 13.18v4L12 21l7-3.82v-4L12 17l-7-3.82zM12 3L1 9l11 6 9-4.91V17h2V9L12 3z"/>
      </svg>`,
  };

  function injectProfileIcons() {
    const rep = document.getElementById('bouton_responsable');
    const elv = document.getElementById('bouton_eleve');

    const setIcon = (btn, svg) => {
      if (!btn) return;
      const icone = btn.closest('.choixProfil__btn') && btn.closest('.choixProfil__btn').querySelector('.choixProfil__icone')
        || btn.parentElement && btn.parentElement.querySelector('.choixProfil__icone');
      if (!icone) return;
      icone.innerHTML = svg;
      icone.classList.add('papillon-profile-icon');
    };

    setIcon(rep, ICONS.responsable);
    setIcon(elv, ICONS.eleve);

    document.querySelectorAll('.choixProfil__btn').forEach((card) => {
      if (card.dataset.papillonClickable) return;
      card.dataset.papillonClickable = '1';
      card.style.cursor = 'pointer';
      card.addEventListener('click', (e) => {
        if (e.target.closest('button')) return;
        const btn = card.querySelector('button');
        if (btn && btn.onclick) {
          btn.onclick.call(btn, e);
        } else if (btn) {
          btn.click();
        }
      });
    });
  }

  function injectBrand() {
    if (document.getElementById('papillon-brand')) return;

    const band = document.createElement('div');
    band.id = 'papillon-brand';
    band.className = 'papillon-brand';
    band.innerHTML = `
      <img class="papillon-brand__logotype" src="${asset('logotype.png')}" alt="Papillon" />`;

    document.body.prepend(band);
  }

  function applyTheme(theme) {
    document.documentElement.classList.toggle('papillon-dark', theme === 'dark');
  }

  function activateConnexionTab() {
    const tabConnect = document.getElementById('onglet-connexion');
    const tabInscription = document.getElementById('onglet-inscription');
    const panelConnect = document.getElementById('connexion');
    const panelInscription = document.getElementById('inscription');
    if (!tabConnect || !panelConnect) return;
    if (tabInscription) {
      tabInscription.setAttribute('aria-selected', 'false');
      tabInscription.setAttribute('tabindex', '-1');
    }
    if (panelInscription) {
      panelInscription.classList.remove('fr-tabs__panel--selected');
      panelInscription.setAttribute('hidden', '');
      panelInscription.style.display = 'none';
    }
    tabConnect.setAttribute('aria-selected', 'true');
    tabConnect.setAttribute('tabindex', '0');
    panelConnect.classList.add('fr-tabs__panel--selected');
    panelConnect.removeAttribute('hidden');
    panelConnect.style.display = 'block';
  }

  function watchConnexion() {
    const bloc = document.getElementById('div_connexion');
    if (!bloc || !window.MutationObserver) return;
    new MutationObserver((records) => {
      for (const r of records) {
        if (r.type === 'attributes' && !bloc.classList.contains('fr-hidden')) {
          activateConnexionTab();
          break;
        }
      }
    }).observe(bloc, { attributes: true, attributeFilter: ['class'] });
  }

  function start() {
    document.body.classList.add('papillon-educonnect');
    injectFonts();
    injectBrand();
    injectProfileIcons();
    activateConnexionTab();
    watchConnexion();

    if (chrome && chrome.storage && chrome.storage.sync) {
      const get = chrome.storage.sync.get;
      const p = (get.call
        ? get.call(chrome.storage.sync, { theme: 'light' })
        : chrome.storage.sync.get({ theme: 'light' }));
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