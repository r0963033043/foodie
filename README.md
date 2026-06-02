# foodie

A small, static, bilingual (English / 繁體中文) web app for eating: a **restaurant map** and a set of **recipes**. No build step, no framework — plain HTML, CSS, and vanilla JS that loads its content from JSON over `fetch`.

## Live

<https://r0963033043.github.io/foodie>

Hosted on GitHub Pages from the `gh-pages` branch.

## Pages

| Page | What it does |
| --- | --- |
| `index.html` | Landing page — choose **Restaurants** (map) or **Cook** (recipes). |
| `maps.html` | Leaflet map + restaurant list with filters and a "near me" sort. |
| `recipe.html` | Grid of dishes to cook. |
| `dish.html` | A single recipe (ingredients, steps, video) with serving scaling. |

## Restaurant map (`maps.html`)

- **Map + list stay in sync.** Click a card to pan/zoom and open a poptip on the card linking to the restaurant's **Menu** (`menu.html`), **Google Maps**, and **Web** / **YouTube** searches; clicking a map marker shows the same links in its popup.
- **Filters:** city, district, foodArea, mealtime, tags, service, and price. Logic is **AND across dimensions, OR within a dimension**. Both the list and the map markers update.
- **Near me:** a geolocation toggle that sorts the list by distance and shows each spot's distance.
- Map tiles use **Leaflet + OpenStreetMap** (no API key). The CDN dependency is centralized in `assets.js` — no hardcoded URLs in the HTML.

## Language

A 中文 / EN toggle (top-right) switches all UI text and data between `en` and `zh`. The choice persists in `localStorage` under `foodie.lang` and is shared across pages. UI strings live in `i18n.json`.

## Data

All content is JSON loaded at runtime via `api.js` (`FoodieApi`).

### `data/restaurant-*.json`

One file per restaurant, registered by id in `api.js` (`RESTAURANT_IDS`); the file name is `restaurant-<id>.json`. Add a restaurant by dropping its file and listing its id. Top-level fields are language-neutral; `en` / `zh` blocks hold localized text.

| Field | Scope | Notes |
| --- | --- | --- |
| `id`, `lat`, `lng`, `emoji` | top | identity + map marker |
| `hasBranches` | top | boolean — has other branches |
| `price` | top | `$` … `$$$$` |
| `partySize` | top | `{ "min", "max" }` (`max: null` = open-ended) |
| `hidden` | top | optional — `true` excludes it from the list/map |
| `name`, `cuisine`, `city`, `district`, `address`, `note` | `en`/`zh` | text |
| `foodArea`, `mealtime`, `tags`, `service` | `en`/`zh` | arrays |
| `menu` | `en`/`zh` | optional — array of `{ "name", "price", "note"? }` shown on `menu.html` |

`district` is the administrative region (e.g. 萬華區); `foodArea` is the colloquial food neighborhood (e.g. 西門).

### `data/dish-*.json`

One file per recipe, registered by id in `api.js` (`DISH_IDS`). Add a dish by dropping its file and listing its id.

## Notes

- Restaurant addresses and coordinates were compiled by hand and are approximate — verify before relying on them.
