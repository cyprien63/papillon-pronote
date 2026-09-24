/* ============================================================
    Élément — DEVOIRS SURVEILLÉS (DS) façon Papillon
    Transforme chaque DS du widget en carte façon Papillon :
    badge date à gauche, matière + description + horaire +
    salle à droite.
    ============================================================ */

(() => {
  'use strict';

  const ICON_CACHE = new Map();
  const ICON_FILES = {
    calendar: 'calendar.svg',
    arrowRightUp: 'papicons/arrow-right-up.svg',
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

  function svgWrap(inner, component) {
    const span = document.createElement('span');
    span.className = 'papillon-icon';
    span.dataset.papicon = component;
    span.innerHTML = inner;
    return span;
  }

  /* Extrait la couleur de matière depuis le style inline (--color-line) */
  function findColor(el) {
    if (!el) return null;
    if (el.dataset.papDSColor) return el.dataset.papDSColor;
    const match = (el.getAttribute('style') || '').match(/#([0-9a-fA-F]{6}|[0-9a-fA-F]{3})/);
    const color = match ? `#${match[1]}` : null;
    if (color) el.dataset.papDSColor = color;
    return color;
  }

  /* Traite l'en-tête du widget : titre visible + icône calendar */
  function processHeader(widget) {
    const header = widget.querySelector(':scope > header');
    if (!header) return;
    const title = header.querySelector('h2, h3');
    if (title && !title.querySelector('.papillon-icon')) {
      const cal = icon('calendar');
      if (cal) title.prepend(svgWrap(cal, 'calendar'));
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

  /* Construit la carte d'un DS */
  function buildItem(li, dark) {
    if (li.dataset.papDS) return;
    li.dataset.papDS = '1';
    li.classList.add('pap-ds-item');

    const wrap = li.querySelector('.wrap');
    if (!wrap) return;

    const dateEl = wrap.querySelector('.bloc-date-conteneur');
    if (dateEl) {
      const dayDiv = dateEl.querySelector('div');
      const monthDiv = dateEl.querySelectorAll('div')[1];
      if (dayDiv && !dayDiv.classList.contains('pap-ds-date-day')) {
        dayDiv.classList.add('pap-ds-date-day', 'date-day');
      }
      if (monthDiv && !monthDiv.classList.contains('pap-ds-date-month')) {
        monthDiv.classList.add('pap-ds-date-month', 'date-month');
      }
    }
    const infosEl = wrap.querySelector('.infos-ds-conteneur');
    const subjectEl = infosEl ? infosEl.querySelector('h3') : null;
    const descEl = infosEl ? infosEl.querySelector('p.Gras') : null;
    const timeEl = infosEl ? infosEl.querySelector('.date') : null;
    const roomEl = infosEl ? infosEl.querySelector('span:last-child') : null;

    const subject = (subjectEl ? subjectEl.textContent : '').trim() || 'DS';
    const color = findColor(subjectEl) || '#35bba0';

    const tint = dark ? adjust(color, 0.3) : adjust(color, -0.2);
    const bgTint = dark ? adjust(color, -0.5) : adjust(color, 0.85);

    li.style.setProperty('--pap-ds-color', dark ? adjust(color, 0.3) : color);
    li.style.setProperty('--pap-ds-tint', tint);
    li.style.setProperty('--pap-ds-bg', bgTint);

    if (subjectEl) subjectEl.classList.add('pap-ds-subject');
    if (descEl) descEl.classList.add('pap-ds-desc');
    if (timeEl) timeEl.classList.add('pap-ds-time');
    if (roomEl) roomEl.classList.add('pap-ds-room');

    /* Icône pièce jointe / lien si présente */
    const pjLink = li.querySelector('a[href]');
    if (pjLink && !li.querySelector('.pap-ds-link')) {
      const linkIcon = icon('arrowRightUp');
      if (linkIcon) {
        const t = svgWrap(linkIcon, 'arrowRightUp');
        t.className = 'pap-ds-link papillon-icon';
        li.appendChild(t);
      }
    }

    /* La carte entière est cliquable si un lien existe */
    if (pjLink && !li.dataset.papDSClick) {
      li.dataset.papDSClick = '1';
      li.addEventListener('click', (e) => {
        if (e.target.closest('a')) return;
        e.preventDefault();
        pjLink.click();
      });
    }
  }

  /* Traite un widget DS complet */
  function processWidget(widget) {
    const isDark = document.documentElement.classList.contains('papillon-dark');
    processHeader(widget);
    widget.querySelectorAll('ul.liste-clickable > li').forEach((li) => buildItem(li, isDark));
  }

  function processAll() {
    document.querySelectorAll('.widget.devoirsurveille').forEach((w) => processWidget(w));
  }

  function init() {
    const loadAll = Object.keys(ICON_FILES).map((k) => loadIcon(k));
    Promise.all(loadAll).then(() => {
      processAll();

      /* Recapter les re-rendus de PRONOTE */
      const observer = new MutationObserver(() => processAll());
      observer.observe(document.body, { childList: true, subtree: true });

      /* Recolorer si le thème change */
      new MutationObserver(() => {
        document.querySelectorAll('.widget.devoirsurveille .pap-ds-item').forEach((li) => delete li.dataset.papDS);
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
