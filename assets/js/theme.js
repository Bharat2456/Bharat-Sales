/* Theme: Light is the default for every visitor. The toggle switches and remembers the choice. */
(function () {
  var root = document.documentElement;
  function get() { try { return localStorage.getItem('sb-theme') === 'dark' ? 'dark' : 'light'; } catch (e) { return 'light'; } }
  function set(t) {
    t = t === 'dark' ? 'dark' : 'light';
    root.setAttribute('data-theme', t);
    try { localStorage.setItem('sb-theme', t); } catch (e) {}
    var m = document.querySelector('meta[name="theme-color"]'); if (m) m.setAttribute('content', t === 'dark' ? '#0E0F12' : '#F3F4F6');
    document.querySelectorAll('[data-theme-set]').forEach(function (b) { b.setAttribute('aria-pressed', String(b.getAttribute('data-theme-set') === t)); });
  }
  window.setTheme = set;
  window.currentTheme = function () { return root.getAttribute('data-theme') === 'dark' ? 'dark' : 'light'; };
  root.setAttribute('data-theme', get());
  document.addEventListener('click', function (e) {
    var b = e.target.closest && e.target.closest('[data-theme-set]');
    if (b) { set(b.getAttribute('data-theme-set')); if (window.onThemeChange) window.onThemeChange(); }
    var m = e.target.closest && e.target.closest('[data-menu]');
    if (m) { var open = document.body.classList.toggle('menu-open'); m.setAttribute('aria-expanded', String(open)); }
    else if (document.body.classList.contains('menu-open') && e.target.closest && e.target.closest('.site-nav a')) { document.body.classList.remove('menu-open'); }
  });
  document.addEventListener('DOMContentLoaded', function () { set(get()); });
})();
