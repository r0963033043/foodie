/* ===== foodie — data API =====
   Single source of truth for the dish and restaurant catalogues.
   Each id maps to a file in data/:
     dishes      -> "dish-chawanmushi"      -> data/dish-chawanmushi.json
     restaurants -> "din-tai-fung-xinyi"    -> data/restaurant-din-tai-fung-xinyi.json
   The id lists are NOT hardcoded here: they live in data/manifest.json, which
   tools/build-manifest.mjs regenerates by scanning data/. Add a dish/restaurant
   by dropping its file in data/ and re-running that script.
*/
(function (global) {
  const DATA_DIR = "data/";
  const MANIFEST_URL = DATA_DIR + "manifest.json";

  /** Restaurant display order, by shopping district. Keyed off the English
   * shoppingDistrict value (language-neutral); unknown/absent districts sort
   * last. Within a district, manifest order is kept (sort is stable).
   */
  const DISTRICT_ORDER = [
    "DongmenYongkang", "Guanghua", "Huashan", "Ximen", "Zhongshan", "Raohe"
  ];

  // Fetch the generated id lists once. { dishes: [...], restaurants: [...] }.
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
  function getRestaurantIds() {
    return loadManifest().then(function (m) { return (m.restaurants || []).slice(); });
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

  // List all dishes as { id, name: { en, zh } }, name pulled from each file.
  function listDishes() {
    return getDishIds().then(function (ids) {
      return Promise.all(ids.map(function (id) {
        return getDish(id).then(function (d) {
          return { id: id, name: { en: d.en.name, zh: d.zh.name } };
        });
      }));
    });
  }

  // Load one restaurant file (cached).
  const restCache = {};
  function getRestaurant(id) {
    if (restCache[id]) return Promise.resolve(restCache[id]);
    return fetch(DATA_DIR + "restaurant-" + id + ".json")
      .then(function (r) {
        if (!r.ok) throw new Error("Restaurant not found: " + id);
        return r.json();
      })
      .then(function (d) { restCache[id] = d; return d; });
  }

  // Rank a restaurant by its shopping district for display ordering.
  function districtRank(r) {
    const d = (r.en && r.en.shoppingDistrict && r.en.shoppingDistrict[0]) || "";
    const i = DISTRICT_ORDER.indexOf(d);
    return i === -1 ? DISTRICT_ORDER.length : i;
  }

  // Load the restaurant directory (cached). Returns visible restaurants sorted
  // by shopping district (DISTRICT_ORDER), keeping manifest order within a
  // district; hidden ones are excluded but still reachable via getRestaurant(id).
  let restaurants = null;
  function getRestaurants() {
    if (restaurants) return Promise.resolve(restaurants);
    return getRestaurantIds()
      .then(function (ids) { return Promise.all(ids.map(getRestaurant)); })
      .then(function (all) {
        restaurants = all
          .filter(function (r) { return !r.hidden; })
          .sort(function (a, b) { return districtRank(a) - districtRank(b); });
        return restaurants;
      });
  }

  global.FoodieApi = {
    getDishIds: getDishIds,
    getRestaurantIds: getRestaurantIds,
    getDish: getDish,
    listDishes: listDishes,
    getRestaurant: getRestaurant,
    getRestaurants: getRestaurants
  };
})(window);
