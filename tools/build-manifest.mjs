/** Generates data/manifest.json by scanning the data/ folder, so the dish and
 * eatery id lists are derived from the files on disk instead of being
 * hardcoded in api.js. A static host (e.g. GitHub Pages) can't list a
 * directory over HTTP, so the browser reads this manifest at runtime.
 *
 * Run after adding/removing a data file:  node tools/build-manifest.mjs
 * 
 *   data/dish-chawanmushi.json        -> dishes:      "dish-chawanmushi"
 *   data/eatery-din-tai-fung.json -> eateries: "din-tai-fung"
 *
 * Dish ids keep the "dish-" prefix; eatery ids drop "eatery-"
 * (matching how api.js builds each file path). Ids are sorted; the on-screen
 * eatery order is decided at runtime by shoppingDistrict, not here.
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

const eateries = files
  .filter((f) => f.startsWith("eatery-") && f.endsWith(".json"))
  .map((f) => f.slice("eatery-".length, -".json".length))
  .sort();

const json = JSON.stringify({ dishes, eateries }, null, 2);
// Match the repo's CRLF convention.
await writeFile(join(dataDir, "manifest.json"), json.replace(/\n/g, "\r\n") + "\r\n");

console.log(`manifest.json written: ${dishes.length} dishes, ${eateries.length} eateries`);
