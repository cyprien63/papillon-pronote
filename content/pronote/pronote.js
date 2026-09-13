/* ============================================================
   Papillon — Content script pour l'espace PRONOTE (connexion)
   Cible : https://*.index-education.net/pronote/*
   Interface générée par eleve.js (DOM réécrit à chaque navigation) :
   un MutationObserver ré-applique branding + icônes après rendu.
   Icônes : Papicons (repo PapillonApp/Papicons, licences MIT),
   chargées depuis assets/icons/ puis injectées en inline SVG
   (fill: currentColor -> recolorables par le thème).
   ============================================================ */

(() => {
  'use strict';

  if (document.documentElement.hasAttribute('data-papillon')) return;
  document.documentElement.setAttribute('data-papillon', '1');

  const asset = (name) => chrome.runtime.getURL(`assets/brand/${name}`);
  const font = (name) => chrome.runtime.getURL(`styles/fonts/${name}`);
  const icon = (name) => chrome.runtime.getURL(`assets/icons/${name}`);

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

  /* ---------- Libellés PRONOTE -> icône Papicons ---------- */
  const MENU_ICONS = [
    { re: /accueil/i, name: 'home' },
    { re: /donn/i, name: 'user' },
    { re: /cahier/i, name: 'pen' },
    { re: /note/i, name: 'grades' },
    { re: /comp.tence/i, name: 'sparkles' },
    { re: /r.sultat/i, name: 'coefficient' },
    { re: /vie scolaire/i, name: 'graduation-hat' },
    { re: /communic/i, name: 'text-bubble' },
  ];

  const WIDGET_ICONS = [
    { re: /emploi du temps|mon emploi/i, name: 'calendar' },
    { re: /pense[- ]b.te/i, name: 'pen-alt' },
    { re: /travail.*\u00e0 faire|travail.*a faire|taf/i, name: 'tasks' },
    { re: /ressource/i, name: 'folder' },
    { re: /carnet/i, name: 'bookmark' },
    { re: /note/i, name: 'grades' },
    { re: /sondage|information|actualit/i, name: 'newspaper' },
  ];

  const iconCache = new Map();
  function loadIcon(name) {
    if (!iconCache.has(name)) {
      iconCache.set(
        name,
        fetch(icon(name))
          .then((r) => (r.ok ? r.text() : ''))
          .catch(() => '')
      );
    }
    return iconCache.get(name);
  }

  function iconSpan(name, cls) {
    const s = document.createElement('span');
    s.className = cls;
    s.dataset.papillonIcon = name;
    s.setAttribute('aria-hidden', 'true');
    loadIcon(name).then((svg) => {
      if (svg && s.isConnected) s.innerHTML = svg;
    });
    return s;
  }

  function pick(list, text) {
    for (const e of list) if (e.re.test(text)) return e.name;
    return null;
  }

  function applyMenuIcons() {
    const anchors = document.querySelectorAll('.menu-principal_niveau0 a');
    for (const a of anchors) {
      if (a.dataset.papillonIcon) continue;
      const name = pick(MENU_ICONS, (a.textContent || '').trim());
      if (!name) continue;
      a.classList.add('papillon-menu-item');
      a.dataset.papillonIcon = name;
      a.prepend(iconSpan(name, 'papillon-icon papillon-icon--menu'));
    }
  }

  function firstTitle(widget) {
    for (const el of widget.querySelectorAll('h1, h2, h3, h4, [class*="titre"], [class*="title"]')) {
      const text = (el.textContent || '').trim();
      if (text && !el.querySelector('img')) return { el, text };
    }
    return null;
  }

  function applyContainer() {
    const c = document.querySelector('.AffichagePageAccueil')
      || document.querySelector('.interface_affV_client')
      || document.querySelector('.widgets-global-container')?.parentElement;
    if (!c || c.dataset.papillonContainer) return;
    c.dataset.papillonContainer = '1';
    c.classList.add('papillon-home-container');
    Object.assign(c.style, { maxWidth: '700px', margin: '0 auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' });
  }

  function applyWidgetIcons() {
    const widgets = document.querySelectorAll('.widget');
    for (const w of widgets) {
      if (w.dataset.papillonWidget) continue;
      const t = firstTitle(w);
      if (!t) continue;
      const name = pick(WIDGET_ICONS, t.text);
      if (!name) continue;
      t.el.classList.add('papillon-widget-title');
      t.el.prepend(iconSpan(name, 'papillon-icon papillon-icon--widget'));
      w.dataset.papillonWidget = name;
      const more = w.querySelector('a, [role="button"]');
      if (more && !more.dataset.papillonMore) { more.dataset.papillonMore = '1'; more.classList.add('papillon-widget-more'); }
    }
  }

  function injectBrand() {
    const zone = document.querySelector('.ibe_gauche');
    if (!zone || document.getElementById('papillon-brand-accueil')) return;
    const band = document.createElement('div');
    band.id = 'papillon-brand-accueil';
    band.className = 'papillon-brand-accueil';
    band.innerHTML = `
      <img class="papillon-brand__logotype" src="${asset('logotype.png')}" alt="Papillon" />`;
    zone.appendChild(band);
  }

  function applyAll() {
    applyContainer();
    injectBrand();
    applyMenuIcons();
    applyWidgetIcons();
  }

  function watch() {
    if (!window.MutationObserver || document.documentElement.dataset.papillonObserved) return;
    document.documentElement.dataset.papillonObserved = '1';
    let t = null;
    new MutationObserver(() => {
      clearTimeout(t);
      t = setTimeout(applyAll, 60);
    }).observe(document.body, { childList: true, subtree: true });
  }

  function applyTheme(theme) {
    document.documentElement.classList.toggle('papillon-dark', theme === 'dark');
  }

  function start() {
    document.body.classList.add('papillon-pronote');
    injectFonts();
    applyAll();
    watch();
    console.log('[papillon] DOM snapshot:', {
      bandeau: document.querySelector('.ObjetBandeauEspace')?.outerHTML?.slice(0, 500),
      menu1: document.querySelector('.objetBandeauEntete_menu')?.outerHTML?.slice(0, 500),
      menu2: document.querySelector('.objetBandeauEntete_secondmenu')?.outerHTML?.slice(0, 500),
      widgets: document.querySelector('.widgets-global-container')?.outerHTML?.slice(0, 500),
    });

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