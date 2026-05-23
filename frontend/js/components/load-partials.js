/**
 * load-partials.js
 * ----------------
 * Fetches each HTML partial and injects it into its matching
 * container element. Runs before DOMContentLoaded completes,
 * so all IDs are available immediately when scripts run.
 *
 * Usage: <script src="js/components/load-partials.js"></script>
 * (plain script, NOT type="module" so it runs synchronously-ish)
 */

(function () {
  'use strict';

  /**
   * Fetch an HTML partial and insert it into the given container.
   * Returns a Promise that resolves when the HTML has been inserted.
   */
  function loadPartial(containerSelector, url) {
    var container = document.querySelector(containerSelector);
    if (!container) return Promise.resolve();

    return fetch(url + '?v=' + Date.now())
      .then(function (res) {
        if (!res.ok) throw new Error('Failed to load ' + url + ' (' + res.status + ')');
        return res.text();
      })
      .then(function (html) {
        container.innerHTML = html;
      })
      .catch(function (err) {
        console.error('[load-partials]', err);
        container.innerHTML = '<p style="color:red;padding:10px;">Failed to load component: ' + url + '</p>';
      });
  }

  // ── Partials map: container selector → partial file ──────────
  var partials = [
    { selector: '#partial-header',  url: 'partials/header.html'  },
    { selector: '#partial-sidebar', url: 'partials/sidebar.html' },
    { selector: '#partial-modals',  url: 'partials/modals.html'  },
  ];

  // Load all partials in parallel, then fire a custom event
  // so the rest of the page scripts know everything is ready.
  Promise.all(partials.map(function (p) {
    return loadPartial(p.selector, p.url);
  })).then(function () {
    document.dispatchEvent(new Event('partials:loaded'));
  });
})();
