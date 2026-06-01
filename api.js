/* ===== foodie — data API =====
   Single source of truth for the dish catalogue.
   Each id maps to a file in data/ whose name starts with "dish-":
     "dish-chawanmushi" -> data/dish-chawanmushi.json
   (A static host can't list a directory, so the dish-* files are
   registered here; add a new dish by dropping its file and listing its id.)
*/
(function (global) {
  const DATA_DIR = "data/";

  const DISH_IDS = [
    "dish-chawanmushi",
    "dish-honey-garlic-wings"
  ];

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
    return Promise.all(DISH_IDS.map(function (id) {
      return getDish(id).then(function (d) {
        return { id: id, name: { en: d.en.name, zh: d.zh.name } };
      });
    }));
  }

  // Load the restaurant directory (cached). Returns an array of restaurants.
  let restaurants = null;
  function getRestaurants() {
    if (restaurants) return Promise.resolve(restaurants);
    return fetch(DATA_DIR + "restaurants.json")
      .then(function (r) {
        if (!r.ok) throw new Error("Restaurants not found");
        return r.json();
      })
      .then(function (d) {
        const all = Array.isArray(d) ? d : (d.restaurants || []);
        restaurants = all.filter(function (r) { return !r.hidden; });
        return restaurants;
      });
  }

  global.FoodieApi = {
    dishIds: DISH_IDS.slice(),
    getDish: getDish,
    listDishes: listDishes,
    getRestaurants: getRestaurants
  };
})(window);
