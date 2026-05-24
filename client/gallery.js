/**
 * insta-scraper — client-side gallery renderer
 *
 * Usage (JS API):
 *   renderInstagramGallery({
 *     gallery: '#insta-feed-gallery',   // required — CSS selector for the wrapper
 *     item:    '.grid > div',           // optional — selector for placeholder items to replace
 *   });
 *
 * Usage (data attributes — zero JS required):
 *   <script src="client/gallery.js"
 *           data-gallery="#insta-feed-gallery"
 *           data-item=".grid > div">
 *   </script>
 *
 * Options / data-* equivalents:
 *   gallery        data-gallery         CSS selector for the gallery wrapper            (required)
 *   item           data-item            Selector for placeholders to replace             (optional)
 *                                         • provided → replaces matching children 1-to-1
 *                                         • omitted  → clears wrapper and appends cards
 *   jsonPath       data-json-path       Path to insta-links.json  (default: ./insta-links.json)
 *   linkTarget     data-link-target     <a> target attribute      (default: _blank)
 *   buildCard      —                    fn(post) → HTMLElement     overrides default card builder
 */

(function () {
  'use strict';

  // Capture before any async context (document.currentScript is null after parse)
  const _scriptEl = document.currentScript;

  // ─── Public API ──────────────────────────────────────────────────────────────

  function renderInstagramGallery(options) {
    const {
      gallery,
      item: itemSelector,
      jsonPath = './insta-links.json',
      linkTarget = '_blank',
      buildCard = defaultBuildCard,
    } = options || {};

    if (!gallery) {
      console.error('[insta-gallery] options.gallery is required.');
      return;
    }

    const wrapper = document.querySelector(gallery);
    if (!wrapper) {
      console.warn(`[insta-gallery] Element not found: "${gallery}"`);
      return;
    }

    fetch(jsonPath)
      .then(function (res) {
        if (!res.ok) throw new Error('Could not load ' + jsonPath + ' (' + res.status + ')');
        return res.json();
      })
      .then(function (data) {
        var posts = (data && data.posts) || [];
        if (!posts.length) return;

        if (itemSelector) {
          // Replace mode — swap existing placeholder items one-to-one
          var placeholders = Array.from(wrapper.querySelectorAll(itemSelector));
          posts.forEach(function (post, i) {
            if (placeholders[i]) {
              placeholders[i].replaceWith(buildCard(post, linkTarget));
            }
          });
        } else {
          // Append mode — clear wrapper and build all cards from scratch
          wrapper.innerHTML = '';
          posts.forEach(function (post) {
            wrapper.appendChild(buildCard(post, linkTarget));
          });
        }
      })
      .catch(function (err) {
        console.error('[insta-gallery]', err.message);
      });
  }

  // ─── Default card builder ─────────────────────────────────────────────────────

  function defaultBuildCard(post, linkTarget) {
    var a = document.createElement('a');
    a.href = post.permalink;
    a.target = linkTarget || '_blank';
    a.rel = 'noopener noreferrer';
    a.setAttribute('aria-label', 'Instagram post ' + post.index);

    var img = document.createElement('img');
    img.src = post.localImage + '?v=' + Date.now();
    img.alt = 'Instagram post ' + post.index;
    img.loading = 'lazy';
    img.decoding = 'async';
    img.style.cssText = 'width:100%;height:100%;object-fit:cover;display:block;';

    a.appendChild(img);
    return a;
  }

  // ─── Auto-init via data attributes ───────────────────────────────────────────

  function maybeAutoInit() {
    if (!_scriptEl || !_scriptEl.dataset.gallery) return;
    renderInstagramGallery({
      gallery:    _scriptEl.dataset.gallery,
      item:       _scriptEl.dataset.item || undefined,
      jsonPath:   _scriptEl.dataset.jsonPath,
      linkTarget: _scriptEl.dataset.linkTarget,
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', maybeAutoInit);
  } else {
    maybeAutoInit();
  }

  window.renderInstagramGallery = renderInstagramGallery;

}());
