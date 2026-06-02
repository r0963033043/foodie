/* ===== foodie — external URLs =====
   Keeps raw https endpoints out of the page markup. The caller supplies the
   localized query text; this module owns the URL shapes.
*/
(function (global) {
  function enc(s) { return encodeURIComponent(s); }

  global.FoodieLinks = {
    // OpenStreetMap raster tiles (Leaflet).
    tileUrl: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    tileAttribution: "&copy; OpenStreetMap contributors",

    // Search/link builders.
    gmaps: function (query) {
      return "https://www.google.com/maps/search/?api=1&query=" + enc(query);
    },
    webSearch: function (query) {
      return "https://www.google.com/search?q=" + enc(query);
    },
    youtubeSearch: function (query) {
      return "https://www.youtube.com/results?search_query=" + enc(query);
    }
  };
})(window);
