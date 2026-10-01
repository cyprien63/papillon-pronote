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
})();