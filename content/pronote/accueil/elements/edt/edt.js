/* ============================================================
   Élément 3 — EMPLOI DU TEMPS (EDT) façon Papillon
   Transforme chaque cours de la liste en « Course » du style
   Papillon : carte arrondie teintée à la couleur de la matière,
   barre colorée verticale, prof / salle avec icônes Papicons,
   badge « En cours » + durée. Les pauses deviennent des
   séparateurs (Sunrise / Cutlery / Sun).
   ============================================================ */

(() => {
  'use strict';

  const ICON_CACHE = new Map();
  const ICON_FILES = {
    calendar: 'calendar.svg',
    mapPin: 'map-pin.svg',
    user: 'user.svg',
    sunrise: 'sunrise.svg',
    sun: 'sun.svg',
    cutlery: 'cutlery.svg',
    ghost: 'ghost.svg',
    arrow: 'arrow-right-up.svg',
  };

  /* Récupère (en cache) le contenu d'un SVG Papicons,
     avec fill/currentColor pour suivre la couleur CSS. */
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

  /* Transformation HSL basée sur adjustColor() de Papillon */
  function adjust(hex, percent) {
    if (!hex) return hex;
    hex = hex.replace(/^#/, '');
    if (hex.length === 3) {
      hex = hex.split('').map((c) => c + c).join('');
    }
    const num = parseInt(hex, 16);
    let r = num >> 16;
    let g = (num >> 8) & 0x00ff;
    let b = num & 0x0000ff;
    const t = percent < 0 ? 0 : 255;
    const p = Math.abs(percent);
    r = Math.round(r + (t - r) * p);
    g = Math.round(g + (t - g) * p);
    b = Math.round(b + (t - b) * p);
    return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
  }

  function parseTime(txt) {
    const m = String(txt).trim().match(/^(\d{1,2})[h:](\d{2})$/);
    return m ? m[1] * 60 + Number(m[2]) : null;
  }

  function formatDuration(mins) {
    if (mins == null) return null;
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    if (h === 0) return `${m}min`;
    return m ? `${h}h${String(m).padStart(2, '0')}` : `${h}h`;
  }

  function svgWrap(inner, component) {
    const span = document.createElement('span');
    span.className = 'papillon-icon';
    span.dataset.papicon = component;
    span.innerHTML = inner;
    return span;
  }

  function chip(text, iconName, isGroup) {
    const span = document.createElement('span');
    span.className = `pap-chip${isGroup ? ' pap-group-chip' : ''}`;
    const ico = icon(iconName);
    if (ico) span.appendChild(svgWrap(ico, iconName));
    span.appendChild(document.createTextNode(text));
    return span;
  }

  /* Classe les sous<li> restants : groupe / salle / prof */
  function classifyLi(text) {
    const t = text.trim();
    const isGroup = /^\[.*\]$/.test(t);
    const isRoom = !isGroup && /^[A-Za-z]{0,4}\s?\d{1,4}[A-Za-z]?$/.test(t);
    return { isGroup, isRoom, text: t };
  }

  function buildCourse(containerCours, li, dark) {
    const coursUl = li.querySelector('.container-cours');
    if (!coursUl) return;

    const trait = li.querySelector('.trait-matiere');
    /* Récupérer la couleur inline de la matière (ex: #A49E6C) */
    const colorMatch = trait && (trait.getAttribute('style') || '').match(/#([0-9a-fA-F]{6}|[0-9a-fA-F]{3})/);
    const color = colorMatch ? `#${colorMatch[1]}` : '#35bba0';

    /* Idempotence : supprimer nos éléments déjà injectés */
    coursUl.querySelectorAll('.pap-meta-row, .pap-status').forEach((el) => el.remove());

    /* Variables de colorimétrie (comme Course.tsx de Papillon) */
    const bg = adjust(color, dark ? -0.7 : 0.85);
    const bar = adjust(color, dark ? 0.15 : -0.15);
    const txt = adjust(color, dark ? 0.45 : -0.15);
    const border = `${adjust(color, dark ? 0.7 : -0.7)}36`;
    coursUl.style.setProperty('--pap-edt-bg', bg);
    coursUl.style.setProperty('--pap-edt-bar', bar);
    coursUl.style.setProperty('--pap-edt-txt', txt);
    coursUl.style.setProperty('--pap-edt-border', border);

    /* Rép. la barre ŕ l'intérieur de la carte */
    if (trait) coursUl.appendChild(trait);

    /* Extraction des infos */
    const nameLi = coursUl.querySelector('.libelle-cours');
    const subLis = Array.from(coursUl.querySelectorAll(':scope > li'));
    const others = subLis.filter((c) => c !== nameLi);

    /* Rangée méta (prof · salle · groupe) */
    const metaRow = document.createElement('div');
    metaRow.className = 'pap-meta-row';

    others.forEach((c) => {
      const { isGroup, isRoom, text } = classifyLi(c.textContent || '');
      if (!text) return;
      if (isGroup) {
        metaRow.appendChild(chip(text, null, true));
      } else if (isRoom) {
        metaRow.appendChild(chip(text, 'mapPin'));
      } else {
        metaRow.appendChild(chip(text, 'user'));
      }
      c.remove();
    });

    /* Durée + badge « En cours » */
    const heures = li.querySelector('.container-heures');
    const times = heures ? Array.from(heures.querySelectorAll('div')).map((d) => parseTime(d.textContent)) : [];
    let duration = null;
    if (times.length >= 2 && times[0] != null && times[1] != null) {
      duration = formatDuration(times[1] - times[0]);
    }

    const now = new Date();
    const nowMin = now.getHours() * 60 + now.getMinutes();
    const isNow = times.length >= 2 && times[0] != null && times[1] != null
      && nowMin >= times[0] && nowMin <= times[1];

    const status = document.createElement('div');
    status.className = 'pap-status';
    if (isNow) {
      const pill = document.createElement('span');
      pill.className = 'pap-pill';
      pill.textContent = 'En cours';
      status.appendChild(pill);
    }
    if (duration) status.appendChild(document.createTextNode(duration));

    /* Assembler */
    coursUl.appendChild(metaRow);
    if (isNow || duration) coursUl.appendChild(status);
  }

  function buildPause(coursUl, li) {
    const ariaLabel = (li.querySelector('.container-cours') || {}).getAttribute && li.querySelector('.container-cours').getAttribute('aria-label');
    const label = ariaLabel || 'Pause';

    const heures = li.querySelector('.container-heures');
    const firstTime = heures ? parseTime((heures.firstElementChild || {}).textContent) : null;
    let iconName = 'sun';
    if (firstTime != null && firstTime < 11 * 60) iconName = 'sunrise';
    else if (firstTime != null && firstTime < 14 * 60) iconName = 'cutlery';

    let duration = null;
    const times = heures ? Array.from(heures.querySelectorAll('div')).map((d) => parseTime(d.textContent)) : [];
    if (times.length >= 2 && times[0] != null && times[1] != null) {
      duration = formatDuration(times[1] - times[0]);
    }

    const wrap = document.createElement('div');
    wrap.className = 'pap-greyed-label';
    const ico = icon(iconName);
    if (ico) wrap.appendChild(svgWrap(ico, iconName));
    wrap.appendChild(document.createTextNode(label));
    if (duration) {
      const d = document.createElement('span');
      d.className = 'pap-sep-dur';
      d.textContent = duration;
      wrap.appendChild(d);
    }

    coursUl.innerHTML = '';
    coursUl.appendChild(wrap);
  }

  function processWidget(widget) {
    const isDark = document.documentElement.classList.contains('papillon-dark');

    /* En-tête : rendre le titre visible + icône calendrier */
    const header = widget.querySelector('header');
    if (header) {
      const title = header.querySelector('h2, h3');
      if (title && !title.querySelector('.papillon-icon')) {
        const cal = icon('calendar');
        if (cal) title.prepend(svgWrap(cal, 'calendar'));
      }
    }

    widget.querySelectorAll('.liste-cours > li').forEach((li) => {
      if (li.dataset.papEdt) return;

      const coursUl = li.querySelector('.container-cours');
      if (!coursUl) return;

      const isPause = li.classList.contains('greyed') || coursUl.classList.contains('demi-pension');
      if (isPause) {
        buildPause(coursUl, li);
      } else {
        buildCourse(coursUl, li, isDark);
      }
      li.dataset.papEdt = '1';
    });
  }

  function init() {
    /* Charger les icônes puis traiter les widgets existants */
    const loadAll = Object.keys(ICON_FILES).map((k) => loadIcon(k));
    Promise.all(loadAll).then(() => {
      processAll();

      /* Recapter les re-rendus PRONOTE (changement de jour/semaine) */
      const observer = new MutationObserver(() => processAll());
      observer.observe(document.body, { childList: true, subtree: true });

      /* Recolorer si le thème change */
      new MutationObserver(() => {
        const dark = document.documentElement.classList.contains('papillon-dark');
        document.querySelectorAll('.widget.edt .liste-cours > li').forEach((li) => delete li.dataset.papEdt);
        processAll(dark);
      }).observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    });
  }

  function processAll() {
    document.querySelectorAll('.widget.edt').forEach((w) => processWidget(w));
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();