/* ===== foodie — data API =====
   Single source of truth for the dish and eatery catalogues.
   Each id maps to a file in data/:
     dishes      -> "dish-chawanmushi"      -> data/dish-chawanmushi.json
     eateries -> "din-tai-fung-xinyi"    -> data/eatery-din-tai-fung-xinyi.json
   The id lists are NOT hardcoded here: they live in data/manifest.json, which
   tools/build-manifest.mjs regenerates by scanning data/. Add a dish/eatery
   by dropping its file in data/ and re-running that script.
*/
(function (global) {
  const DATA_DIR = "data/";
  const MANIFEST_URL = DATA_DIR + "manifest.json";

  /** Eatery display order, by shopping district. Keyed off the English
   * shoppingDistrict value (language-neutral); unknown/absent districts sort
   * last. Within a district, manifest order is kept (sort is stable).
   */
  const DISTRICT_ORDER = [
    "DongmenYongkang", "Guanghua", "Huashan", "Ximen", "Zhongshan", "Songshan"
  ];

  // Fetch the generated id lists once. { dishes: [...], eateries: [...] }.
  let manifestPromise = null;
  function loadManifest() {
    if (manifestPromise) return manifestPromise;
    manifestPromise = fetch(MANIFEST_URL).then(function (r) {
      if (!r.ok) throw new Error("Manifest not found: " + MANIFEST_URL);
      return r.json();
    });
    return manifestPromise;
  }
  function getDishIds() {
    return loadManifest().then(function (m) { return (m.dishes || []).slice(); });
  }
  function getEateryIds() {
    return loadManifest().then(function (m) { return (m.eateries || []).slice(); });
  }

  const cache = {};

  // Load one dish file (cached).
  function getDish(id) {
    if (cache[id]) return Promise.resolve(cache[id]);
    return fetch(DATA_DIR + id + ".json")
      .then(function (r) {
        if (!r.ok) throw new Error("Dish not found: " + id);
        return r.json();
      })
      .then(function (d) { cache[id] = d; return d; });
  }

  // List all dishes as { id, name: { en, zh }, uses: [pantryCode…] }, pulled
  // from each file. `uses` is the language-neutral list of pantry-item codes a
  // dish needs, used by ingredients.html to suggest what you can cook.
  function listDishes() {
    return getDishIds().then(function (ids) {
      return Promise.all(ids.map(function (id) {
        return getDish(id).then(function (d) {
          return {
            id: id,
            name: { en: d.en.name, zh: d.zh.name },
            main: (d.main || []).slice(),
            uses: (d.uses || []).slice()
          };
        });
      }));
    });
  }

  // Load one eatery file (cached).
  const eateryCache = {};
  function getEatery(id) {
    if (eateryCache[id]) return Promise.resolve(eateryCache[id]);
    return fetch(DATA_DIR + "eatery-" + id + ".json")
      .then(function (r) {
        if (!r.ok) throw new Error("Eatery not found: " + id);
        return r.json();
      })
      .then(function (d) { eateryCache[id] = d; return d; });
  }

  // Rank an eatery by its shopping district for display ordering.
  function districtRank(r) {
    const loc = (r.locations && r.locations[0]) || {};
    const d = (loc.en && loc.en.shoppingDistrict && loc.en.shoppingDistrict[0]) || "";
    const i = DISTRICT_ORDER.indexOf(d);
    return i === -1 ? DISTRICT_ORDER.length : i;
  }

  // Load the eatery directory (cached). Returns visible eateries sorted
  // by shopping district (DISTRICT_ORDER), keeping manifest order within a
  // district; hidden ones are excluded but still reachable via getEatery(id).
  let eateries = null;
  function getEateries() {
    if (eateries) return Promise.resolve(eateries);
    return getEateryIds()
      .then(function (ids) { return Promise.all(ids.map(getEatery)); })
      .then(function (all) {
        eateries = all
          .filter(function (r) { return !r.hidden; })
          .sort(function (a, b) { return districtRank(a) - districtRank(b); });
        return eateries;
      });
  }

  global.FoodieApi = {
    getDishIds: getDishIds,
    getEateryIds: getEateryIds,
    getDish: getDish,
    listDishes: listDishes,
    getEatery: getEatery,
    getEateries: getEateries
  };
})(window);
