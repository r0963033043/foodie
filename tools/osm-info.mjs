/** Read-only OSM enrichment report. For each eatery, query OpenStreetMap
 * (Nominatim, with extratags + namedetails) and report what OSM knows that we
 * don't yet have: social/website links, opening hours, and phone. Writes a
 * review file at tools/osm-info-report.md and prints a summary. NEVER edits the
 * eatery JSON — this is the "report first" step before deciding what to adopt.
 *
 * Usage:
 *   node tools/osm-info.mjs                 # all eateries
 *   node tools/osm-info.mjs qiaoxi-fried-rice wootea-syntrend
 *
 * Guards (same as geocode.mjs): a hit only counts if it's a food amenity/shop
 * AND sits in the same district as our record. A different-branch or non-eatery
 * match is reported as skipped, because its hours/phone would be the wrong shop.
 */
import { readFile, writeFile, readdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const dataDir = join(dirname(fileURLToPath(import.meta.url)), "..", "data");
const outFile = join(dirname(fileURLToPath(import.meta.url)), "osm-info-report.md");
const NOMINATIM = "https://nominatim.openstreetmap.org/search";
const UA = "foodie-osm-info/1.0 (eatery-map dev tool)";

const ids = process.argv.slice(2).filter((a) => !a.startsWith("--"));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const FOOD_AMENITY = new Set(["restaurant", "cafe", "fast_food", "bar", "pub", "food_court", "ice_cream", "biergarten", "marketplace"]);
const FOOD_SHOP = new Set(["bakery", "confectionery", "pastry", "tea", "coffee", "beverages", "deli", "food", "convenience"]);
function isEatery(hit) {
  const cat = hit.category ?? hit.class;
  if (cat === "amenity") return FOOD_AMENITY.has(hit.type);
  if (cat === "shop") return FOOD_SHOP.has(hit.type);
  return FOOD_AMENITY.has(hit.type) || FOOD_SHOP.has(hit.type);
}
function osmDistrict(hit) {
  const a = hit.address || {};
  return a.city_district || a.suburb || a.quarter || a.district || a.town || a.county || null;
}
function sameDistrict(rec, hit) {
  const d = rec.zh?.district;
  if (!d) return null;
  if (hit.display_name && hit.display_name.includes(d)) return true;
  const od = osmDistrict(hit);
  return !!(od && (od === d || od.includes(d) || d.includes(od)));
}

// OSM extratag key -> our website[] platform name.
const SOCIAL = {
  "website": "official", "contact:website": "official", "url": "official",
  "contact:facebook": "facebook", "contact:instagram": "instagram",
  "contact:line": "line", "contact:youtube": "youtube", "contact:tiktok": "tiktok",
  "contact:threads": "threads", "contact:twitter": "x", "contact:x": "x"
};
const normUrl = (u) => (u || "").trim().replace(/\/+$/, "").toLowerCase();

let firstCall = true;
async function geocode(query) {
  if (!firstCall) await sleep(1100);
  firstCall = false;
  const url = `${NOMINATIM}?format=jsonv2&addressdetails=1&extratags=1&namedetails=1&limit=1&accept-language=zh-TW&q=${encodeURIComponent(query)}`;
  const res = await fetch(url, { headers: { "User-Agent": UA } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const hits = await res.json();
  return hits[0] || null;
}

async function targetIds() {
  if (ids.length) return ids;
  const files = await readdir(dataDir);
  return files.filter((f) => f.startsWith("eatery-") && f.endsWith(".json"))
    .map((f) => f.slice("eatery-".length, -".json".length)).sort();
}

const list = await targetIds();
const tally = { enriched: 0, noNew: 0, branch: 0, nonEatery: 0, noResult: 0 };
const md = ["# OSM enrichment report", "", `Generated for ${list.length} eatery(ies). Read-only — no data files were changed.`, "",
  "Guards: only food amenity/shop hits in the **same district** are trusted; different-branch / non-eatery matches are skipped.", ""];

for (const id of list) {
  let rec;
  try { rec = JSON.parse(await readFile(join(dataDir, `eatery-${id}.json`), "utf8")); }
  catch { md.push(`### ${id}`, "- file not found / invalid JSON", ""); continue; }

  const queries = [
    [rec.zh?.name, rec.zh?.city].filter(Boolean).join(" "),
    [rec.en?.name, rec.en?.city].filter(Boolean).join(" ")
  ].filter(Boolean);
  let hit = null;
  for (const q of queries) { try { hit = await geocode(q); } catch { /* keep going */ } if (hit) break; }

  const title = `### ${id} — ${rec.zh?.name ?? ""}`;
  if (!hit) { tally.noResult++; md.push(title, "- OSM: no record", ""); continue; }

  const cat = hit.category ?? hit.class ?? "?";
  if (!isEatery(hit)) { tally.nonEatery++; md.push(title, `- SKIPPED — OSM top hit is a non-eatery POI [${cat}/${hit.type}]`, ""); continue; }
  if (sameDistrict(rec, hit) === false) { tally.branch++; md.push(title, `- SKIPPED — OSM hit in a different district (possible other branch); contact info not trusted`, ""); continue; }

  const ex = hit.extratags || {};
  // Existing urls (website[] + reservationUrl[]) to dedupe against.
  const have = new Set();
  for (const arr of [rec.website, rec.reservationUrl]) {
    if (Array.isArray(arr)) arr.forEach((w) => w?.url && have.add(normUrl(w.url)));
  }
  const newLinks = [];
  for (const [key, platform] of Object.entries(SOCIAL)) {
    const url = ex[key];
    if (url && !have.has(normUrl(url))) { newLinks.push({ platform, url }); have.add(normUrl(url)); }
  }
  const hours = ex.opening_hours || null;
  const phone = ex.phone || ex["contact:phone"] || null;

  const lines = [title, `- match: \`${hit.osm_type} ${hit.osm_id}\` [${cat}/${hit.type}]`];
  if (newLinks.length) { lines.push("- new website/social:"); newLinks.forEach((l) => lines.push(`  - ${l.platform}: ${l.url}`)); }
  if (hours) lines.push(`- openingHours (OSM): \`${hours}\``);
  if (phone) lines.push(`- phone (OSM): ${phone}`);

  if (newLinks.length || hours || phone) tally.enriched++;
  else { tally.noNew++; lines.push("- no new info beyond what we already have"); }
  md.push(...lines, "");
}

md.push("---", "",
  `**Summary:** enriched ${tally.enriched} · no-new-info ${tally.noNew} · ` +
  `skipped-branch ${tally.branch} · skipped-non-eatery ${tally.nonEatery} · no-OSM-record ${tally.noResult}`);

await writeFile(outFile, md.join("\r\n") + "\r\n", "utf8");
console.log(`Wrote ${outFile}`);
console.log(`enriched ${tally.enriched} | no-new ${tally.noNew} | branch ${tally.branch} | non-eatery ${tally.nonEatery} | no-result ${tally.noResult}`);