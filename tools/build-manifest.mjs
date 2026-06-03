/** Generates data/manifest.json by scanning the data/ folder, so the dish and
 * restaurant id lists are derived from the files on disk instead of being
 * hardcoded in api.js. A static host (e.g. GitHub Pages) can't list a
 * directory over HTTP, so the browser reads this manifest at runtime.
 *
 * Run after adding/removing a data file:  node tools/build-manifest.mjs
 * 
 *   data/dish-chawanmushi.json        -> dishes:      "dish-chawanmushi"
 *   data/restaurant-din-tai-fung.json -> restaurants: "din-tai-fung"
 *
 * Dish ids keep the "dish-" prefix; restaurant ids drop "restaurant-"
 * (matching how api.js builds each file path). Ids are sorted; the on-screen
 * restaurant order is decided at runtime by shoppingDistrict, not here.
 */
import { readdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const dataDir = join(dirname(fileURLToPath(import.meta.url)), "..", "data");
const files = await readdir(dataDir);

const dishes = files
  .filter((f) => f.startsWith("dish-") && f.endsWith(".json"))
  .map((f) => f.slice(0, -".json".length))
  .sort();

const restaurants = files
  .filter((f) => f.startsWith("restaurant-") && f.endsWith(".json"))
  .map((f) => f.slice("restaurant-".length, -".json".length))
  .sort();

const json = JSON.stringify({ dishes, restaurants }, null, 2);
// Match the repo's CRLF convention.
await writeFile(join(dataDir, "manifest.json"), json.replace(/\n/g, "\r\n") + "\r\n");

console.log(`manifest.json written: ${dishes.length} dishes, ${restaurants.length} restaurants`);
