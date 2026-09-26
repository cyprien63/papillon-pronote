/* ============================================================
   Papillon — Content script pour la page de connexion EduConnect
   Cible : educonnect.education.gouv.fr/idp/profile/SAML2/POST/SSO
   Flux Shibboleth : vérif navigateur (e1s1), sélection profil +
   identifiants (e1s2), redirection SAML (SAMLResponse).
   Injecte le thème Papillon + branding (assets officiels du
   repo Papillon), sans toucher au fonctionnement du formulaire
   (posts SAML, champs j_username / j_password, typeUser, ...).
   Couvre aussi l'étape « Confirmation de l'identité » : le site
   redemande la date de naissance (formulaire #theForm avec les
   champs #jour / #mois / #annee) — page marquée via la classe
   body.pap-ec-identite puis stylée par educonnect.css.
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

  /* ---------- Icônes Papicons (assets/icons/papicons) ---------- */
  const ICON_CACHE = new Map();
  const ICON_FILES = {
    user: 'user.svg',
    calendar: 'calendar.svg',
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

  function svgWrap(inner, component) {
    const span = document.createElement('span');
    span.className = 'papillon-icon';
    span.dataset.papicon = component;
    span.innerHTML = inner;
    return span;
  }

  /* ============================================================
     Étape « Confirmation de l'identité » — date de naissance
     Le DOM est celui du formulaire #theForm : .titreCompte (profil
     « Élève »), #titreSaisieDate, #dateNaissance (#jour, #mois,
     #annee), #dateHelpEleve et les boutons #submit-button /
     #bouton_precedent. On se contente de poser la classe de
     marquage et d'injecter les Papicons : la concaténation de la
     date dans #password-input et l'activation de #submit-button
     restent gérées par les scripts de la page.
     ============================================================ */
  function markIdentitePage() {
    const form = document.getElementById('theForm');
    if (!form || !form.querySelector('#dateNaissance')) return;
    document.body.classList.add('pap-ec-identite');
  }

  /* Pastille du profil : l'icône native est remplacée par le
     Papicon `user` (l'<img> n'est masqué qu'une fois l'SVG prêt) */
  function injectProfileIcon() {
    const zone = document.querySelector('.pap-ec-identite .titreCompte__icone');
    const svg = icon('user');
    if (!zone || !svg || zone.dataset.papEcProfile) return;
    zone.dataset.papEcProfile = '1';
    const img = zone.querySelector('img');
    if (img) img.hidden = true;
    zone.appendChild(svgWrap(svg, 'ec-profile'));
  }

  /* Icône calendrier dans l'aide sous les champs de date */
  function injectDateIcon() {
    const hint = document.querySelector('.pap-ec-identite #dateHelpEleve');
    const svg = icon('calendar');
    if (!hint || !svg || hint.dataset.papEcDate) return;
    hint.dataset.papEcDate = '1';
    hint.insertBefore(svgWrap(svg, 'ec-calendar'), hint.firstChild);
  }

  /* Icône de validation dans le bouton « Confirmer » */
  function injectConfirmIcon() {
    const btn = document.querySelector('.pap-ec-identite #submit-button');
    const svg = icon('check');
    if (!btn || !svg || btn.dataset.papEcConfirm) return;
    btn.dataset.papEcConfirm = '1';
    btn.insertBefore(svgWrap(svg, 'ec-check'), btn.firstChild);
  }

  function focusFirstField() {
    const jour = document.getElementById('jour');
    if (!jour) return;
    const root = document.documentElement;
    if (root.dataset.papEcFocus) return;
    root.dataset.papEcFocus = '1';
    if (document.activeElement === document.body) jour.focus();
  }

  function processAll() {
    markIdentitePage();
    injectProfileIcon();
    injectDateIcon();
    injectConfirmIcon();
    focusFirstField();
  }

  function watch() {
    if (!window.MutationObserver || !document.body) return;
    new MutationObserver(processAll).observe(document.body, { childList: true, subtree: true });
    new MutationObserver(processAll).observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class'],
    });
  }

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

    processAll();
    watch();
    loadIcon('user').then(processAll);
    loadIcon('calendar').then(processAll);
    loadIcon('check').then(processAll);

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