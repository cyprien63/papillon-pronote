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
    cross: 'cross.svg',
    arrowRight: 'arrow-right.svg',
  };

  /* Marqueurs PRONOTE : cours annulé / reporté / remplacé */
  const ANNUL_RE = /annul|suppr|repor|remplac/i;
  /* Marqueurs PRONOTE : changement de salle / déplacement / exceptionnel */
  const CHANG_RE = /chang|déplac|deplac|transf|modif|except|→/i;

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

  /* Luminance relative sRGB (WCAG 2.1) */
  function luminance(hex) {
    hex = String(hex).replace(/^#/, '');
    if (hex.length === 3) hex = hex.split('').map((c) => c + c).join('');
    const n = parseInt(hex, 16);
    const canaux = [n >> 16, (n >> 8) & 0xff, n & 0xff].map((c) => {
      c /= 255;
      return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * canaux[0] + 0.7152 * canaux[1] + 0.0722 * canaux[2];
  }

  function contrast(a, b) {
    const la = luminance(a);
    const lb = luminance(b);
    return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
  }

  /* Les couleurs de matière viennent de PRONOTE et vont du très pâle au très
     sombre : un écart fixe laisse un jaune illisible sur sa propre teinte
     claire. On pousse donc la couleur vers le noir ou le blanc juste ce qu'il
     faut pour atteindre le contraste visé, en gardant la teinte d'origine. */
  function readableOn(couleur, fond, cible) {
    const vers = luminance(fond) > 0.5 ? -1 : 1;
    for (let p = 0; p <= 0.95; p += 0.05) {
      const candidat = adjust(couleur, vers * p);
      if (contrast(candidat, fond) >= cible) return candidat;
    }
    return vers < 0 ? '#10130f' : '#e7efec';
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

  function chip(text, iconName, isGroup, extraClass) {
    const span = document.createElement('span');
    span.className = `pap-chip${isGroup ? ' pap-group-chip' : ''}${extraClass ? ` ${extraClass}` : ''}`;
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

  /* État de la carte : annulé / déplacé, déduit de toutes les
     sources de texte/classes du cours (robuste aux variations). */
  function detectStatus(li, coursUl) {
    const sources = [
      li.className,
      coursUl.className || '',
      li.getAttribute('aria-label') || '',
      coursUl.textContent || '',
    ].join(' ');
    return {
      cancelled: ANNUL_RE.test(sources),
      changed: CHANG_RE.test(sources),
    };
  }

  /* Mois français (minuscules, tronqués) → index 0-11 */
  const MONTHS = {
    'janvier': 0, 'janv': 0, 'jan': 0, 'january': 0,
    'fevrier': 1, 'février': 1, 'fevr': 1, 'févr': 1, 'february': 1,
    'mars': 2, 'march': 2,
    'avril': 3, 'avr': 3, 'april': 3,
    'mai': 4, 'may': 4,
    'juin': 5, 'june': 5,
    'juillet': 6, 'juil': 6, 'july': 6,
    'aout': 7, 'août': 7, 'august': 7,
    'septembre': 8, 'sept': 8, 'september': 8,
    'octobre': 9, 'oct': 9, 'october': 9,
    'novembre': 10, 'nov': 10, 'november': 10,
    'decembre': 11, 'décembre': 11, 'dec': 11, 'december': 11,
  };

  function sameDay(a, b) {
    return a && b && a.getFullYear() === b.getFullYear()
      && a.getMonth() === b.getMonth()
      && a.getDate() === b.getDate();
  }

  /* Date affichée par le sélecteur de date du widget. Retourne un
     objet Date, ou null si introuvable. */
  function widgetDate(widget) {
    const el = widget.querySelector('.ObjetCelluleDate') || widget;

    /* 1) valeur brute d'un <input> : 17/09/2026 ou 2026-09-17 */
    const inputs = el.querySelectorAll('input');
    for (const inp of inputs) {
      const v = (inp.value || '').trim();
      let m = v.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
      if (m) return new Date(+m[3], +m[2] - 1, +m[1]);
      m = v.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
      if (m) return new Date(+m[1], +m[2] - 1, +m[3]);
    }

    /* 2) libellés / aria-labels / titres : « Jeudi 17 septembre 2026 */
    const sources = [el.textContent || ''];
    el.querySelectorAll('[aria-label],[title]').forEach((n) => {
      const a = n.getAttribute('aria-label') || n.getAttribute('title');
      if (a) sources.push(a);
    });
    for (const s of sources) {
      const m = String(s).match(/(\d{1,2})\s+(janvier|février|mars|avril|mai|juin|juillet|août|septembre|octobre|novembre|décembre|janv|févr|fevr|avr|juil|sept|oct|nov|déc|dec|aout)\.?\s*(\d{4})?/i);
      if (m && MONTHS[m[2].toLowerCase()] !== undefined) {
        const day = Number(m[1]);
        const year = m[3] ? Number(m[3]) : new Date().getFullYear();
        return new Date(year, MONTHS[m[2].toLowerCase()], day);
      }
    }
    return null;
  }

  /* Vrai si le widget affiche le jour courant. Si le sélecteur de
     date est introuvable, on garde l'ancien comportement (badge au
     temps de l'horloge) plutôt que de casser l'affichage. */
  function widgetShowsToday(widget) {
    const shown = widgetDate(widget);
    return shown ? sameDay(shown, new Date()) : true;
  }

  function buildCourse(containerCours, li, dark, isToday) {
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
    const txt = readableOn(color, bg, 4.5);
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

    /* État de la carte : cours annulé / déplacé (salle changée) */
    const flags = detectStatus(li, coursUl);

    /* Rangée méta (prof · salle · groupe · statuts) */
    const metaRow = document.createElement('div');
    metaRow.className = 'pap-meta-row';

    others.forEach((c) => {
      const raw = (c.textContent || '').trim();
      const { isGroup, isRoom, text } = classifyLi(raw);
      if (!text) { c.classList.add('pap-edt-source'); return; }
      if (ANNUL_RE.test(text)) {
        metaRow.appendChild(chip(text, 'cross', false, 'pap-chip-annul'));
      } else if (CHANG_RE.test(text)) {
        metaRow.appendChild(chip(text, 'arrowRight', false, 'pap-chip-chang'));
      } else if (isGroup) {
        metaRow.appendChild(chip(text, null, true));
      } else if (isRoom) {
        metaRow.appendChild(chip(text, 'mapPin'));
      } else {
        metaRow.appendChild(chip(text, 'user'));
      }
      /* Masquer la source (au lieu de la supprimer) pour que les
         re-rendus périodiques du badge « En cours » restent idempotents. */
      c.classList.add('pap-edt-source');
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
    const isNow = isToday !== false && times.length >= 2 && times[0] != null && times[1] != null
      && nowMin >= times[0] && nowMin <= times[1];

    const status = document.createElement('div');
    status.className = 'pap-status';
    if (isNow && !flags.cancelled) {
      const pill = document.createElement('span');
      pill.className = 'pap-pill';
      pill.textContent = 'En cours';
      status.appendChild(pill);
    }
    if (duration && !flags.cancelled) status.appendChild(document.createTextNode(duration));

    /* Marquer l'état sur la carte */
    coursUl.classList.toggle('pap-edt-cancelled', flags.cancelled);
    coursUl.classList.toggle('pap-edt-changed', flags.changed);

    /* Assembler */
    coursUl.appendChild(metaRow);
    if (status.childNodes.length) coursUl.appendChild(status);
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
    const isToday = widgetShowsToday(widget);

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

      /* Une vraie pause est grisée SANS matière : pas de libelle-cours.
         Les cours annulés ont un libellé → on les garde en carte. */
      const hasName = !!coursUl.querySelector('.libelle-cours');
      const isPause = (li.classList.contains('greyed') && !hasName) || coursUl.classList.contains('demi-pension');
      if (isPause) {
        buildPause(coursUl, li);
      } else {
        buildCourse(coursUl, li, isDark, isToday);
      }
      li.dataset.papEdt = '1';
    });
  }

  function init() {
    /* Charger les icônes puis traiter les widgets existants */
    const loadAll = Object.keys(ICON_FILES).map((k) => loadIcon(k));
    Promise.all(loadAll).then(() => {
      processAll();

      /* Cache identifiant les cartes déjà traitées (pas de boucle). */
      const resetCache = () => {
        document.querySelectorAll('.widget.edt .liste-cours > li').forEach((li) => delete li.dataset.papEdt);
      };

      /* Re-rendus PRONOTE (changement de jour/semaine) : les nouveaux
         <li> n'ont pas papEdt → traits, badges et chips sont recalculés. */
      const observer = new MutationObserver(() => processAll());
      observer.observe(document.body, { childList: true, subtree: true });

      /* Badge « En cours » : rafraîchir à chaque changement de minute
         pour apparaître dès le début du cours et s'éteindre à la fin. */
      setInterval(() => {
        resetCache();
        processAll();
      }, 30 * 1000);

      /* Recolorer si le thème change */
      new MutationObserver(() => {
        resetCache();
        processAll();
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