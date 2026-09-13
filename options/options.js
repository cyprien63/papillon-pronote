(() => {
  'use strict';

  const radios = Array.from(document.querySelectorAll('.js-opt-radio'));
  const cards = Array.from(document.querySelectorAll('.js-opt-card'));
  const status = document.querySelector('.js-status');

  function applyTheme(theme) {
    document.documentElement.classList.toggle('papillon-dark', theme === 'dark');
  }

  function selectTheme(theme) {
    radios.forEach((r) => {
      r.checked = r.value === theme;
    });
    applyTheme(theme);
  }

  function saveTheme(theme) {
    const label = theme === 'dark' ? 'Sombre' : 'Clair';
    try {
      chrome.storage.sync.set({ theme }).then(none => {
        status.textContent = 'Thème « ' + label + ' » sauvegardé.';
        setTimeout(() => { status.textContent = ''; }, 1800);
      }, () => {
        status.textContent = 'Thème « ' + label + ' » appliqué (synchronisation indisponible).';
      });
    } catch (e) {
      status.textContent = 'Thème « ' + label + ' » appliqué (stockage indisponible).';
    }
  }

  cards.forEach((card) => {
    card.addEventListener('click', () => {
      const theme = card.dataset.theme;
      selectTheme(theme);
      saveTheme(theme);
    });
  });

  chrome.storage.sync.get({ theme: 'light' }).then((s) => {
    selectTheme(s.theme);
  });
})();