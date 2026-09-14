/* ============================================================
   Papillon — Content script pour l'espace PRONOTE
   Cible : https://*.index-education.net/pronote/*
   Principe : on ne touche PAS au layout Pronote.
   On injecte UNIQUEMENT : fonts, logo Papillon, icônes, theme.
   ============================================================ */

(() => {
  'use strict';

  if (document.documentElement.hasAttribute('data-papillon')) return;
  document.documentElement.setAttribute('data-papillon', '1');

  const asset = (name) => chrome.runtime.getURL(`assets/brand/${name}`);
  const font = (name) => chrome.runtime.getURL(`styles/fonts/${name}`);
  const icon = (name) => chrome.runtime.getURL(`assets/icons/${name}.svg`);

  /* ---------- Fonts Inter ---------- */
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
    { re: /travail.*à faire|travail.*a faire|taf/i, name: 'tasks' },
    { re: /ressource/i, name: 'folder' },
    { re: /carnet/i, name: 'bookmark' },
    { re: /note/i, name: 'grades' },
    { re: /sondage|information|actualit/i, name: 'newspaper' },
  ];

  const iconCache = new Map();
  const iconSvgCache = new Map();

  function loadIcon(name) {
    if (!iconCache.has(name)) {
      iconCache.set(
        name,
        fetch(icon(name))
          .then((r) => (r.ok ? r.text() : ''))
          .then((svg) => { if (svg) iconSvgCache.set(name, svg); return svg; })
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
    if (iconSvgCache.has(name)) {
      s.innerHTML = iconSvgCache.get(name);
    } else {
      loadIcon(name).then((svg) => {
        if (svg && s.isConnected) s.innerHTML = svg;
      });
    }
    return s;
  }

  // Précharger toutes les icônes
  [
    ...MENU_ICONS.map((e) => e.name),
    ...WIDGET_ICONS.map((e) => e.name),
  ].forEach((n) => loadIcon(n));

  function pick(list, text) {
    for (const e of list) if (e.re.test(text)) return e.name;
    return null;
  }

  /* ---------- Icônes dans le menu ---------- */
  function applyMenuIcons() {
    const anchors = document.querySelectorAll('.menu-principal_niveau0 a');
    for (const a of anchors) {
      if (a.dataset.papillonIcon) continue;
      const name = pick(MENU_ICONS, (a.textContent || '').trim());
      if (!name) continue;
      a.dataset.papillonIcon = name;
      a.prepend(iconSpan(name, 'papillon-icon papillon-icon--menu'));
    }
  }

  /* ---------- Icônes dans les widgets ---------- */
  function firstTitle(widget) {
    for (const el of widget.querySelectorAll('h1, h2, h3, h4, [class*="titre"], [class*="title"]')) {
      const text = (el.textContent || '').trim();
      if (text && !el.querySelector('img')) return { el, text };
    }
    return null;
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
    }
  }

  /* ---------- Logo Papillon dans l'en-tête ---------- */
  function injectBrand() {
    const zone = document.querySelector('.ibe_gauche');
    if (!zone) return;
    // Si on a déjà injecté notre logo, ne rien faire
    if (document.getElementById('papillon-brand-accueil')) return;
    // Vider la zone d'origine pour éviter la superposition avec le logo Pronote
    zone.innerHTML = '';
    const band = document.createElement('div');
    band.id = 'papillon-brand-accueil';
    band.className = 'papillon-brand-accueil';
    band.innerHTML = `<img class="papillon-brand__logotype" src="${asset('logotype.png')}" alt="Papillon" />`;
    zone.appendChild(band);
  }

  /* ---------- Appliquer tout ---------- */
  function applyAll() {
    injectBrand();
    applyMenuIcons();
    applyWidgetIcons();
  }

  /* ---------- Observer les changements DOM ---------- */
  function watch() {
    if (!window.MutationObserver) return;
    if (document.documentElement.dataset.papillonObserved) return;
    document.documentElement.dataset.papillonObserved = '1';
    // Laisser Pronote finir son rendu initial (eleve.js réécrit le DOM)
    setTimeout(() => {
      applyAll();
      let t = null;
      new MutationObserver(() => {
        clearTimeout(t);
        t = setTimeout(applyAll, 150);
      }).observe(document.body, { childList: true, subtree: true });
    }, 500);
  }

  /* ---------- Thème ---------- */
  function applyTheme(theme) {
    const isDark = theme === 'dark';
    document.documentElement.classList.toggle('papillon-dark', isDark);
    document.documentElement.style.colorScheme = isDark ? 'dark' : 'light';
    console.log('[papillon] Thème appliqué:', isDark ? 'sombre' : 'clair');
  }

  /* ---------- Démarrage ---------- */
  function start() {
    document.body.classList.add('papillon-pronote');
    injectFonts();
    applyAll();
    watch();

    // Par défaut, on applique le thème clair si pas de stockage
    let themeApplied = false;
    try {
      chrome.storage.sync.get({ theme: 'light' }).then((s) => {
        applyTheme(s.theme);
        themeApplied = true;
      }, () => {
        applyTheme('light');
        themeApplied = true;
      });
      chrome.storage.onChanged.addListener((changes, area) => {
        if (area === 'sync' && changes.theme) applyTheme(changes.theme.newValue);
      });
    } catch (e) {
      applyTheme('light');
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
})();
