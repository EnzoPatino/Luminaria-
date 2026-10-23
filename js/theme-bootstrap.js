(function applySavedTheme() {
  try {
    const theme = localStorage.getItem('luminaria_theme');
    if (theme === 'light' || theme === 'dark') {
      document.documentElement.setAttribute('data-theme', theme);
      if (theme === 'light') document.documentElement.classList.add('light-mode');
    }
  } catch (_) {
    // La preferencia de tema no es necesaria para iniciar la aplicación.
  }
  document.documentElement.setAttribute('data-role', 'tecnico');
})();
