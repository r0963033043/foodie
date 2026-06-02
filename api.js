/* ===== foodie — data API =====
   Single source of truth for the dish and restaurant catalogues.
   Each id maps to a file in data/:
     dishes      -> "dish-chawanmushi"      -> data/dish-chawanmushi.json
     restaurants -> "din-tai-fung-xinyi"    -> data/restaurant-din-tai-fung-xinyi.json
   (A static host can't list a directory, so the files are registered here;
   add a new dish/restaurant by dropping its file and listing its id.)
*/
(function (global) {
  const DATA_DIR = "data/";

  const DISH_IDS = [
    "dish-chawanmushi",
    "dish-honey-garlic-wings"
  ];

  // Restaurant ids, in display order. File name is "restaurant-" + id + ".json".
  const RESTAURANT_IDS = [
    "din-tai-fung-xinyi",
    "fu-hang-soy-milk",
    "raohe-night-market",
    "addiction-aquatic",
    "yongkang-beef-noodle",
    "what-day-kitchen",
    "puzzle-kitchen-xining",
    "gan-mei-alley",
    "tian-tian-li",
    "da-wan-roast",
    "zhang-ji-potsticker",
    "dicos-chongqing",
    "bonchon-chongqing",
    "foodstop",
    "ay-chung-misua",
    "ya-rou-bian",
    "lao-tian-lu"
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

  // Load the restaurant directory (cached). Returns visible restaurants in
  // registration order; hidden ones are still reachable via getRestaurant(id).
  let restaurants = null;
  function getRestaurants() {
    if (restaurants) return Promise.resolve(restaurants);
    return Promise.all(RESTAURANT_IDS.map(getRestaurant))
      .then(function (all) {
        restaurants = all.filter(function (r) { return !r.hidden; });
        return restaurants;
      });
  }

  global.FoodieApi = {
    dishIds: DISH_IDS.slice(),
    restaurantIds: RESTAURANT_IDS.slice(),
    getDish: getDish,
    listDishes: listDishes,
    getRestaurant: getRestaurant,
    getRestaurants: getRestaurants
  };
})(window);
