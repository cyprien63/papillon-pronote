/* ============================================================
   Élément 4 — TRAVAIL À FAIRE (TAF) façon Papillon
   Transforme chaque devoir du widget en card façon Papillon
   (Task.tsx) : carte arrondie avec dégradé coloré en haut,
   émoji + sujet teinté, pièces jointes, date, toggle
   « J'ai terminé ».
   ============================================================ */

(() => {
  'use strict';

  const ICON_CACHE = new Map();
  const ICON_FILES = {
    tasks: 'tasks.svg',
    check: 'check.svg',
    link: 'link.svg',
    arrowRightUp: 'arrow-right-up.svg',
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

  /* Transformation HSL (ajuste la vivacité, comme adjustColor de Papillon) */
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

  function svgWrap(inner, component) {
    const span = document.createElement('span');
    span.className = 'papillon-icon';
    span.dataset.papicon = component;
    span.innerHTML = inner;
    return span;
  }

  /* Normalisation simple du nom de matière pour trouver l'émoji */
  function normalizeSubject(subject) {
    return String(subject || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]/g, '');
  }

  const EMOJI_MAP = [
    ['allemand', '🇩🇪'],
    ['anglais', '🇬🇧'],
    ['espagnol', '🇪🇸'],
    ['italien', '🇮🇹'],
    ['mathematique', '🧮'],
    ['math', '🧮'],
    ['physiquechimie', '🧪'],
    ['physique', '🧪'],
    ['chimie', '🧪'],
    ['svt', '🌱'],
    ['science', '🔬'],
    ['histoire', '🌍'],
    ['geo', '🌎'],
    ['geographie', '🌎'],
    ['nsi', '💻'],
    ['informatique', '💻'],
    ['technologie', '⚙️'],
    ['ses', '🏦'],
    ['eps', '⚽'],
    ['educationphysique', '⚽'],
    ['art', '🎨'],
    ['plastique', '🎨'],
    ['musique', '🎵'],
    ['philosophie', '🧠'],
    ['emc', '⚖️'],
    ['enseignement', '⚖️'],
    ['latin', '🏛️'],
    ['grec', '🏺'],
  ];

  function subjectEmoji(subject) {
    const normalized = normalizeSubject(subject);
    for (const [key, emoji] of EMOJI_MAP) {
      if (normalized.includes(key)) return emoji;
    }
    return '📚';
  }

  /* Les drapeaux emoji sont des paires d'indicateurs régionaux (🇬🇧 = U+1F1EC
     U+1F1E7). Windows n'embarque aucun glyphe pour ces paires : Edge et Chrome
     retombent alors sur les deux lettres, et « 🇬🇧 » s'affiche « GB ». On les
     dessine donc en SVG, ce qui donne le même rendu sur toutes les plateformes.
     Bandes seules : l'arrondi est posé par .pap-tav-flag (overflow: hidden). */
  const FLAG_SVG = {
    '🇩🇪': '<svg viewBox="0 0 5 3" preserveAspectRatio="none" focusable="false"><rect width="5" height="1" y="0" fill="#262626"/><rect width="5" height="1" y="1" fill="#d00"/><rect width="5" height="1" y="2" fill="#ffce00"/></svg>',
    '🇪🇸': '<svg viewBox="0 0 4 3" preserveAspectRatio="none" focusable="false"><rect width="4" height="3" fill="#aa151b"/><rect width="4" height="1.5" y="0.75" fill="#f1bf00"/></svg>',
    '🇮🇹': '<svg viewBox="0 0 3 2" preserveAspectRatio="none" focusable="false"><rect width="1" height="2" x="0" fill="#009246"/><rect width="1" height="2" x="1" fill="#fff"/><rect width="1" height="2" x="2" fill="#ce2b37"/></svg>',
    '🇬🇧': '<svg viewBox="0 0 60 30" preserveAspectRatio="none" focusable="false"><rect width="60" height="30" fill="#012169"/><path d="M0 0l60 30M60 0L0 30" stroke="#fff" stroke-width="6"/><path d="M0 0l60 30M60 0L0 30" stroke="#c8102e" stroke-width="4"/><path d="M30 0v30M0 15h60" stroke="#fff" stroke-width="10"/><path d="M30 0v30M0 15h60" stroke="#c8102e" stroke-width="6"/></svg>',
  };

  /* Pose l'émoji de matière dans <el>, en SVG si c'est un drapeau */
  function paintSubjectEmoji(el, value) {
    const flag = FLAG_SVG[value];
    if (flag) {
      el.classList.add('pap-tav-flag');
      el.innerHTML = flag;
      el.setAttribute('role', 'img');
      el.setAttribute('aria-label', value);
    } else {
      el.textContent = value;
    }
  }

  /* Extrait la couleur de matière depuis le style inline (--couleur-matiere) */
  function findColor(el) {
    if (!el) return null;
    if (el.dataset.papTavColor) return el.dataset.papTavColor;
    const match = (el.getAttribute('style') || '').match(/#([0-9a-fA-F]{6}|[0-9a-fA-F]{3})/);
    const color = match ? `#${match[1]}` : null;
    if (color) el.dataset.papTavColor = color;
    return color;
  }

  /* Traite l'en-tête du widget : titre visible + icône tasks */
  function processHeader(widget) {
    const header = widget.querySelector(':scope > header');
    if (!header) return;
    const title = header.querySelector('h2, h3');
    if (title && !title.querySelector('.papillon-icon')) {
      const ico = icon('tasks');
      if (ico) title.prepend(svgWrap(ico, 'tasks'));
    }
    /* « Tout voir » : remplacer la flèche PRONOTE par celle de Papillon */
    const cta = header.querySelector('.cta-conteneur button');
    if (cta) {
      const arrow = icon('arrowRightUp');
      if (arrow && !cta.querySelector('.papillon-icon')) {
        cta.appendChild(svgWrap(arrow, 'arrowRightUp'));
      }
    }
  }

  /* Construit la carte d'une tâche */
  function buildTask(wrap, dayLabel, dark) {
    if (wrap.dataset.papTav) return;
    wrap.dataset.papTav = '1';

    const header = wrap.querySelector('.as-header');
    const withColor = wrap.querySelector('.with-color');
    const subjectEl = wrap.querySelector('.titre-matiere');
    const subject = (subjectEl ? subjectEl.textContent : '').trim() || 'Devoir';
    const descEl = wrap.querySelector('.description.widgetTAF');
    const attach = wrap.querySelector('.piece-jointe, .chips-pj');
    const hasAttach = !!attach;

    const color = findColor(withColor) || '#35bba0';
    const tint = adjust(color, dark ? 0.3 : -0.3);

    wrap.style.setProperty('--pap-tav-color', color);
    wrap.style.setProperty('--pap-tav-tint', tint);

    /* Émoji + sujet */
    if (header) {
      if (!header.querySelector('.pap-tav-emoji')) {
        const emoji = document.createElement('span');
        emoji.className = 'pap-tav-emoji';
        paintSubjectEmoji(emoji, subjectEmoji(subject));
        if (withColor) withColor.prepend(emoji);
        else header.prepend(emoji);
      }
      /* Icône pièce jointe après le sujet */
      if (hasAttach && !header.querySelector('.pap-tav-attach')) {
        const linkIco = icon('link');
        if (linkIco) {
          const a = svgWrap(linkIco, 'link');
          a.className = 'pap-tav-attach papillon-icon';
          (withColor || header).appendChild(a);
        }
      }
      /* Date à droite */
      if (dayLabel && !header.querySelector('.pap-tav-day')) {
        const day = document.createElement('span');
        day.className = 'pap-tav-day';
        day.textContent = dayLabel;
        header.appendChild(day);
      }
    }

    /* Toggle « J'ai terminé » : injecter le check Papicon dans le label */
    const label = wrap.querySelector('label.iecb');
    if (label) {
      if (!label.querySelector('.pap-tav-check')) {
        const checkIco = icon('check');
        if (checkIco) {
          const c = svgWrap(checkIco, 'check');
          c.className = 'pap-tav-check papillon-icon';
          c.querySelector('svg').classList.add('pap-tav-check-icon');
          const bullet = label.querySelector('span[aria-hidden="true"]');
          if (bullet) bullet.replaceWith(c);
          else label.prepend(c);
        }
      }
      if (!label.querySelector('.pap-tav-done-text')) {
        const doneText = document.createElement('span');
        doneText.className = 'pap-tav-done-text';
        doneText.textContent = 'Terminé';
        label.appendChild(doneText);
      }
      /* Retirer le texte PRONOTE « J'ai terminé » (doublon visuel) */
      label.querySelectorAll('span:not(.pap-tav-check):not(.pap-tav-done-text)').forEach((s) => {
        if (!s.closest('.pap-tav-check')) s.remove();
      });
    }
  }

  /* Traite un widget TAF complet */
  function processWidget(widget) {
    const isDark = document.documentElement.classList.contains('papillon-dark');
    processHeader(widget);

    const dayGroups = widget.querySelectorAll('.liste-imbriquee > li');
    dayGroups.forEach((group) => {
      const h3 = group.querySelector('h3[id*="_date_"], h3');
      let dayLabel = '';
      if (h3) {
        const raw = (h3.textContent || '').replace(/^Pour\s*/i, '').trim();
        dayLabel = raw ? raw.charAt(0).toUpperCase() + raw.slice(1) : '';
      }
      group.querySelectorAll('.sub-liste > li .wrap.conteneur-item').forEach((wrap) => {
        buildTask(wrap, dayLabel, isDark);
      });
    });
  }

  function processAll() {
    document.querySelectorAll('.widget.travailafaire').forEach((w) => processWidget(w));
  }

  function init() {
    const loadAll = Object.keys(ICON_FILES).map((k) => loadIcon(k));
    Promise.all(loadAll).then(() => {
      processAll();

      /* Recapter les re-rendus de PRONOTE (cocher un devoir, etc.) */
      const observer = new MutationObserver(() => processAll());
      observer.observe(document.body, { childList: true, subtree: true });

      /* Recolorer si le thème change */
      new MutationObserver(() => {
        document.querySelectorAll('.widget.travailafaire .wrap.conteneur-item').forEach((w) => delete w.dataset.papTav);
        processAll();
      }).observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();