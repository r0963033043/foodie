/* ===== foodie — external assets =====
   Single place to maintain third-party CDN dependencies (URLs + SRI hashes),
   so pages don't hardcode https:// links in their HTML. To bump a version or
   self-host, edit here only. loadLeaflet() injects the CSS + JS and resolves
   once the Leaflet global (L) is ready.
*/
(function (global) {
  const LEAFLET = {
    css: {
      href: "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css",
      integrity: "sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY="
    },
    js: {
      src: "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js",
      integrity: "sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo="
    }
  };

  function addStylesheet(spec) {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = spec.href;
    if (spec.integrity) { link.integrity = spec.integrity; link.crossOrigin = ""; }
    document.head.appendChild(link);
  }

  function addScript(spec) {
    return new Promise(function (resolve, reject) {
      const s = document.createElement("script");
      s.src = spec.src;
      if (spec.integrity) { s.integrity = spec.integrity; s.crossOrigin = ""; }
      s.onload = resolve;
      s.onerror = function () { reject(new Error("Failed to load " + spec.src)); };
      document.head.appendChild(s);
    });
  }

  let leafletPromise = null;
  function loadLeaflet() {
    if (leafletPromise) return leafletPromise;
    addStylesheet(LEAFLET.css);
    leafletPromise = addScript(LEAFLET.js);
    return leafletPromise;
  }

  global.FoodieAssets = { leaflet: LEAFLET, loadLeaflet: loadLeaflet };
})(window);