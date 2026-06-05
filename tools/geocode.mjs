/** Geocode eateries by name via OpenStreetMap Nominatim and compare the result
 * with the stored lat/lng. Helps seed coordinates for new eateries and flag
 * pins that drift far from what OSM knows about a place.
 *
 * Usage:
 *   node tools/geocode.mjs                                   # report ALL eateries (dry run)
 *   node tools/geocode.mjs qiaoxi-fried-rice wootea-syntrend # report only these ids
 *   node tools/geocode.mjs --write <ids…>                    # fill lat/lng ONLY where missing
 *
 * Two guards keep the noise down (Nominatim's top hit is often the wrong kind
 * of POI, or a different branch of a chain):
 *   1. Type filter — only OSM results categorized as a food amenity/shop count.
 *      A bus_stop, video shop, office, etc. that merely shares the name is
 *      reported but never flagged as drift nor written.
 *   2. Branch awareness — when a food hit sits in a *different* district than
 *      the stored one, it's labelled "possible different branch" rather than
 *      raw drift (chains like 鼎泰豐 / 阿宗麵線 have many branches).
 *
 * Notes:
 *  - Read-only by default. --write never overwrites an existing coordinate; it
 *    only inserts lat/lng for eateries that have none (formatting + CRLF kept
 *    via a surgical insert after the "id" line) and only when the OSM hit is a
 *    real eatery.
 *  - Respects the Nominatim usage policy: descriptive User-Agent + >=1s between
 *    requests. Coverage is partial — well-known shops resolve, new branches may not.
 *  - Queries the localized (zh) name + city first, then the English name + city.
 */
import { readFile, writeFile, readdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const dataDir = join(dirname(fileURLToPath(import.meta.url)), "..", "data");
const NOMINATIM = "https://nominatim.openstreetmap.org/search";
const UA = "foodie-geocode/1.0 (eatery-map dev tool)";
const DRIFT_M = 150;

const argv = process.argv.slice(2);
const write = argv.includes("--write");
const ids = argv.filter((a) => !a.startsWith("--"));

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Great-circle distance in metres (haversine).
function haversineM(aLat, aLng, bLat, bLng) {
  const R = 6371000, toRad = Math.PI / 180;
  const dLat = (bLat - aLat) * toRad, dLng = (bLng - aLng) * toRad;
  const s = Math.sin(dLat / 2) ** 2 +
    Math.cos(aLat * toRad) * Math.cos(bLat * toRad) * Math.sin(dLng / 2) ** 2;
  return Math.round(R * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s)));
}

// --- Guard 1: is the OSM hit actually a food/drink place? ---
const FOOD_AMENITY = new Set([
  "restaurant", "cafe", "fast_food", "bar", "pub", "food_court",
  "ice_cream", "biergarten", "marketplace"
]);
const FOOD_SHOP = new Set([
  "bakery", "confectionery", "pastry", "tea", "coffee", "beverages",
  "deli", "food", "convenience"
]);
function isEatery(hit) {
  const cat = hit.category ?? hit.class;          // jsonv2 renamed class -> category
  if (cat === "amenity") return FOOD_AMENITY.has(hit.type);
  if (cat === "shop") return FOOD_SHOP.has(hit.type);
  // category occasionally blank — fall back to the type alone.
  return FOOD_AMENITY.has(hit.type) || FOOD_SHOP.has(hit.type);
}

// --- Guard 2: does the hit sit in the same district as the stored record? ---
function osmDistrict(hit) {
  const a = hit.address || {};
  return a.city_district || a.suburb || a.quarter || a.district || a.town || a.county || null;
}
function sameDistrict(rec, hit) {
  const d = rec.zh?.district;
  if (!d) return null;                            // unknown — can't compare
  if (hit.display_name && hit.display_name.includes(d)) return true;
  const od = osmDistrict(hit);
  if (od && (od === d || od.includes(d) || d.includes(od))) return true;
  return false;
}

let firstCall = true;
async function geocode(query) {
  if (!firstCall) await sleep(1100);              // Nominatim policy: <=1 req/s
  firstCall = false;
  const url = `${NOMINATIM}?format=jsonv2&addressdetails=1&limit=1&accept-language=zh-TW&q=${encodeURIComponent(query)}`;
  const res = await fetch(url, { headers: { "User-Agent": UA } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const hits = await res.json();
  return hits[0] || null;
}

// Insert lat/lng right after the "id" line, keeping CRLF and indentation.
function insertCoords(text, lat, lng) {
  return text.replace(/(\r?\n\s*"id":\s*"[^"]*",\r?\n)/, (m) =>
    m + `  "lat": ${lat},\r\n  "lng": ${lng},\r\n`);
}

async function targetIds() {
  if (ids.length) return ids;
  const files = await readdir(dataDir);
  return files
    .filter((f) => f.startsWith("eatery-") && f.endsWith(".json"))
    .map((f) => f.slice("eatery-".length, -".json".length))
    .sort();
}

const list = await targetIds();
console.log(`Nominatim geocode — ${list.length} eatery(ies)${write ? " [--write: fill missing only]" : " [dry run]"}\n`);

const tally = { close: 0, branch: 0, nonEatery: 0, noResult: 0, drift: 0 };

for (const id of list) {
  const path = join(dataDir, `eatery-${id}.json`);
  let text, rec;
  try { text = await readFile(path, "utf8"); rec = JSON.parse(text); }
  catch { console.log(`x ${id}: not found / invalid JSON\n`); continue; }

  const queries = [
    [rec.zh?.name, rec.zh?.city].filter(Boolean).join(" "),
    [rec.en?.name, rec.en?.city].filter(Boolean).join(" ")
  ].filter(Boolean);

  let hit = null, used = null;
  for (const q of queries) {
    used = q;
    try { hit = await geocode(q); } catch (e) { console.log(`  ! ${id}: ${e.message}`); }
    if (hit) break;
  }

  const stored = (rec.lat != null && rec.lng != null) ? [rec.lat, rec.lng] : null;
  console.log(`- ${id}  ${rec.zh?.name ?? ""}`);
  if (!hit) {
    tally.noResult++;
    console.log(`   query : "${used}"\n   OSM   : (no result)\n   stored: ${stored ? stored.join(", ") : "-- missing"}\n`);
    continue;
  }

  const cat = hit.category ?? hit.class ?? "?";
  const oLat = +(+hit.lat).toFixed(4), oLng = +(+hit.lon).toFixed(4);
  const dist = stored ? haversineM(stored[0], stored[1], oLat, oLng) : null;
  const eatery = isEatery(hit);
  const sameDist = sameDistrict(rec, hit);

  console.log(`   query : "${used}"`);
  console.log(`   OSM   : ${oLat}, ${oLng}  [${cat}/${hit.type}]`);
  console.log(`   name  : ${hit.display_name}`);
  console.log(`   stored: ${stored ? stored.join(", ") : "-- missing"}${dist != null ? `   delta ${dist} m` : ""}`);

  let note = "";
  if (!eatery) {
    tally.nonEatery++;
    note = `non-eatery POI [${cat}/${hit.type}] - ignored`;
  } else if (dist != null && dist > DRIFT_M) {
    if (sameDist === false) { tally.branch++; note = `possible different branch (OSM in a different district) - delta ${dist} m`; }
    else { tally.drift++; note = `DRIFT ${dist} m - check this`; }
  } else if (dist != null) {
    tally.close++;
  }
  if (note) console.log(`   ! ${note}`);

  if (write && !stored) {
    if (!eatery) {
      console.log(`   -> OSM hit is not an eatery; not writing`);
    } else {
      const out = insertCoords(text, oLat, oLng);
      if (out !== text) { await writeFile(path, out, "utf8"); console.log(`   -> wrote lat/lng (was missing)`); }
      else console.log(`   -> could not locate id line to insert; skipped`);
    }
  }
  console.log("");
}

console.log(
  `Done. close ${tally.close} | possible-branch ${tally.branch} | ` +
  `non-eatery ${tally.nonEatery} | no-result ${tally.noResult} | ` +
  `REAL DRIFT ${tally.drift}` +
  (write ? "" : `.  Re-run with --write to fill only the missing ones.`)
);