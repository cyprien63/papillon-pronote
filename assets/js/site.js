/* Papillon — Portail ENT · site de présentation
   Thème et navigation. Pas de dépendance, pas de build. */

(function () {
  'use strict';

  var CLE = 'theme';
  var root = document.documentElement;

  /* --- Thème : appliqué avant le rendu pour éviter le flash ----------------- */
  function appliquer(theme) {
    if (theme === 'dark') {
      root.classList.add('dark');
      root.style.colorScheme = 'dark';
    } else {
      root.classList.remove('dark');
      root.style.colorScheme = 'light';
    }
    document.querySelectorAll('[data-theme-toggle]').forEach(function (b) {
      b.setAttribute('aria-pressed', String(theme === 'dark'));
    });
  }

  var stocke = null;
  try {
    stocke = localStorage.getItem(CLE);
  } catch (e) {
    /* navigation privée : on retombe sur le thème clair */
  }

  if (stocke !== 'dark' && stocke !== 'light') {
    stocke = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }

  appliquer(stocke);

  /* --- Bascule clair / sombre ---------------------------------------------- */
  function basculer() {
    var suivant = root.classList.contains('dark') ? 'light' : 'dark';
    appliquer(suivant);
    try {
      localStorage.setItem(CLE, suivant);
    } catch (e) {
      /* rien à faire, le thème vaut pour la session en cours */
    }
  }

  document.addEventListener('DOMContentLoaded', function () {
    document.querySelectorAll('[data-theme-toggle]').forEach(function (b) {
      b.addEventListener('click', basculer);
    });
  });

  /* --- Navigation mobile ---------------------------------------------------- */
  document.addEventListener('DOMContentLoaded', function () {
    var bouton = document.querySelector('[data-nav-toggle]');
    var nav = document.querySelector('[data-nav]');
    if (!bouton || !nav) return;

    bouton.addEventListener('click', function () {
      var ouvert = nav.classList.toggle('open');
      bouton.setAttribute('aria-expanded', String(ouvert));
    });

    nav.addEventListener('click', function (e) {
      if (e.target.tagName === 'A') {
        nav.classList.remove('open');
        bouton.setAttribute('aria-expanded', 'false');
      }
    });
  });

  /* --- Année courante dans le pied ----------------------------------------- */
  document.addEventListener('DOMContentLoaded', function () {
    document.querySelectorAll('[data-annee]').forEach(function (el) {
      el.textContent = String(new Date().getFullYear());
    });
  });

  /* --- Apparition au défilement -------------------------------------------- */
  /* Une seule animation, déclenchée une fois. Sans IntersectionObserver, ou si
     le visiteur demande moins d'animations, le contenu reste visible. */
  function animerAuDefilement() {
    var elements = document.querySelectorAll('[data-apparait]');

    if (!elements.length) return;

    var reduit = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduit || !('IntersectionObserver' in window)) {
      elements.forEach(function (el) { el.classList.add('apparu'); });
      return;
    }

    var observateur = new IntersectionObserver(function (entrees) {
      entrees.forEach(function (e) {
        if (!e.isIntersecting) return;
        /* Le décalage est lu depuis data-retard pour l'effet d'escalier. */
        e.target.style.transitionDelay = (e.target.dataset.retard || 0) + 'ms';
        e.target.classList.add('apparu');
        observateur.unobserve(e.target);
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });

    elements.forEach(function (el) { observateur.observe(el); });
  }

  /* --- Menu mobile : fermeture a la navigation clavier ----------------------- */
  document.addEventListener('DOMContentLoaded', function () {
    var bouton = document.querySelector('[data-nav-toggle]');
    var nav = document.querySelector('[data-nav]');
    if (!bouton || !nav) return;

    document.addEventListener('keydown', function (e) {
      if (e.key !== 'Escape') return;
      if (!nav.classList.contains('open')) return;
      nav.classList.remove('open');
      bouton.setAttribute('aria-expanded', 'false');
      bouton.focus();
    });
  });

  document.addEventListener('DOMContentLoaded', function () {
    animerAuDefilement();
  });

  /* Le filet de securite pose dans chaque <head> retire la classe .js au bout
     de 1,5 s si rien ne l'a annule. On l'annule ici, une fois pour toutes. */
  clearTimeout(window.papillonRepli);
})();
