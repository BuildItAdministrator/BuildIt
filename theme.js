/* Build It!++ light/dark appearance toggle. Satellite tiles remain unchanged. */
(function () {
  'use strict';
  const KEY = 'buildit_theme_v1';
  const container = document.getElementById('placeSearchBox');
  if (!container || document.getElementById('builditThemeToggle')) return;

  const button = document.createElement('button');
  button.id = 'builditThemeToggle';
  button.type = 'button';
  button.setAttribute('aria-pressed', 'false');
  container.appendChild(button);

  function theme() {
    return document.documentElement.dataset.builditTheme === 'light' ? 'light' : 'dark';
  }

  function setTheme(value, persist) {
    const next = value === 'light' ? 'light' : 'dark';
    document.documentElement.dataset.builditTheme = next;
    button.textContent = next === 'dark' ? '☀' : '☾';
    const action = next === 'dark' ? 'Switch to light mode' : 'Switch to dark mode';
    button.setAttribute('aria-label', action);
    button.setAttribute('title', action);
    button.setAttribute('aria-pressed', String(next === 'light'));
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', next === 'light' ? '#eaf0f5' : '#132a34');
    if (persist) {
      try { localStorage.setItem(KEY, next); }
      catch (_) { /* Local storage may be disabled; toggle still works this session. */ }
    }
  }

  setTheme(theme(), false);
  button.addEventListener('click', () => setTheme(theme() === 'light' ? 'dark' : 'light', true));
})();
