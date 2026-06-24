# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

`foodie` is a static, bilingual (English / 繁體中文) web app: a Leaflet **eatery map** plus **recipes** and a **pantry/ingredients** tracker. No build step, no framework, no dependencies installed — plain HTML/CSS/vanilla JS that `fetch`es JSON from `data/` at runtime. Deployed to GitHub Pages from the `gh-pages` branch (which is the default working branch here; `main` exists for PRs).

## Commands

There is no build, lint, or test suite. The only tooling is Node scripts in `tools/`.

- **Run locally:** serve the repo root over HTTP and open a page — `python -m http.server` then visit `http://localhost:8000/`. Pages **must** be served over HTTP; `fetch` of the JSON data is blocked on `file://`, so opening the HTML directly shows an error.
- **After adding/removing any `data/*.json` file:** `node tools/build-manifest.mjs` — regenerates `data/manifest.json` (the id lists the browser reads, since a static host can't list a directory). Forgetting this means the new dish/eatery won't appear.
- **OSM helpers (read-only, optional, rate-limited):** `node tools/geocode.mjs [ids…]` compares stored coords against Nominatim and can `--write` *missing* coords; `node tools/osm-info.mjs [ids…]` writes `tools/osm-info-report.md` listing website/hours/phone OSM knows. Both are "report first"; neither overwrites existing data except geocode's `--write` for absent coords.

## Architecture

**Page = self-contained IIFE.** Each `*.html` is its own page with an inline `<script>` IIFE; there is no shared app bundle or router. Pages: `index.html` (landing), `maps.html` (eatery map + filters + "near me"), `menu.html` (one eatery's detail/links/menu), `recipe.html` (dish grid), `dish.html` (one recipe with live serving scaling), `ingredients.html` (pantry editor). Small helpers like `el()`, `fmtAddress()`, `fmtPartySize()` are **intentionally duplicated** across pages rather than shared.

**Three shared globals** (loaded via `<script>`, attached to `window`):
- `api.js` → `FoodieApi` — the data layer. Loads `data/manifest.json` for id lists, then `data/eatery-<id>.json` / `data/dish-<id>.json` (cached). `getEateries()` filters out `hidden` and sorts by `shoppingDistrict` (`DISTRICT_ORDER`).
- `assets.js` → `FoodieAssets` — centralizes CDN deps (Leaflet URLs + SRI hashes); `loadLeaflet()` injects them. Bump versions here only.
- `links.js` → `FoodieLinks` — builds external URLs (Google Maps / web / YouTube search) and holds the map-tile URL. Keep raw `https://` endpoints out of page markup; add them here.

**Bilingual model is pervasive.** Every data file and the i18n file split into language-neutral top-level fields plus parallel `en` / `zh` blocks. The language toggle persists in `localStorage["foodie.lang"]` and is shared across pages. UI strings live in `i18n.json` under `ui.en` / `ui.zh`. When editing data or UI, **always update both `en` and `zh`** in lockstep. Filter values are language-specific, so switching language resets filter selections.

**Eatery data** (`data/eatery-<id>.json`): top-level `id`, `emoji`, `price`, `partySize`, `hasBranches`, optional `hidden`/`menuUpdated`. **All place/coordinate data lives in `locations[]`** — every eatery has one (single-location eateries hold exactly one entry), each `{ lat, lng, en/zh: { name?, address, district, city, shoppingDistrict } }`. `name` is the branch name, present only for multi-location eateries. The top-level `en`/`zh` blocks hold only eatery-wide text (`name`, `cuisine`, `mainType`, `mealtime[]`, `tags[]`, `service[]`, `note`, optional `menu[]`) — **no address/lat/lng there**. Two link arrays are distinct: `website[]` is official/social links (rendered via `WEBSITE_LABEL` in `menu.html`); `reservationUrl[]` is booking/order links (rendered via `reservePlatform*` i18n keys, e.g. `inline`, `ubereats`). Don't put reservation/order links in `website`. `maps.html` renders one marker per location (`markers[id]` is an array of markers); `menu.html` lists every location (and falls back to a single address line when there's one). `district` = administrative region (萬華區); `shoppingDistrict` = commercial district (西門). Map filters are **AND across dimensions, OR within a dimension**; location-level dims (`city`/`district`/`shoppingDistrict`, flagged `loc:true` in `DIMS`) are **unioned across all of an eatery's locations** via `locField()`, so a multi-branch eatery matches every district/商圈 it sits in. The shopping-district sort lives in `api.js` `districtRank` (reads `locations[0]`).

**Recipe data** (`data/dish-<id>.json`): `dish.html` scales ingredient quantities live by `servings / dish.servings`. Cooking method is a **language-neutral code** at the top level (alongside `main`/`uses`), resolved to a name via `data/methods.json` (`{ en/zh: { CODE: name } }`, same shape as `units.json`) — add new codes there. A dish has either a single `"method": "CODE"` or, for a method chooser, `"methods": ["CODE", …]`; in the latter case each step phase may carry a `"method": "CODE"` so it shows only for that choice (phases with no `method` always show).

**Ingredients/pantry** is data-as-seed + localStorage-as-truth. Three files are joined by a shared ingredient **`code`**: `food-types.json` (category + which codes belong to it), `pantry.json` (seed items with amounts, grouped by storage), `storage-tips.json` (per-code `unit` + storage tip). Adding a new ingredient means touching **all three** consistently (see the codes like `DAIKON`, `CARROT`). The `ingredients.html` editor never writes the data files — user changes (moves, amounts, dates, deletions, custom items) are stored as per-code overrides in `localStorage` keyed `foodie.pantry*`.

## Conventions

- **Line endings: CRLF.** All tracked text files use `\r\n` (`build-manifest.mjs` even re-applies it). After creating/editing a file, normalize with `unix2dos`; do not introduce LF-only files.
- **Coordinates are hand-compiled and approximate.** Verify a new `lat`/`lng` rather than trusting raw geocoding. `tools/geocode.mjs` (Nominatim) helps, but its name-only search lands on the wrong branch/POI for Taiwan chains and full house-number addresses miss — query brand name + street and accept the OSM hit only when both match. For anything OSM can't resolve, prefer a real Google Maps share link. Multi-branch eateries need this per branch.
- Commit/push only when asked; branch off `gh-pages` if needed.