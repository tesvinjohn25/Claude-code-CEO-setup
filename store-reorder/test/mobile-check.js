// Phone-reality check (plan §13.6): drives the core P0a flow in a mobile
// viewport — import fixture → set a par → low-stock list → order sheet —
// and saves screenshots for human review. Run: bun store-reorder/test/mobile-check.js
import { chromium } from "playwright";
import { readFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const appDir = join(here, "..", "app");
const outDir = process.env.SHOT_DIR ?? join(here, "screenshots");
mkdirSync(outDir, { recursive: true });

// Serve the static app so ES modules load (file:// blocks them).
const server = Bun.serve({
  port: 0,
  async fetch(req) {
    const path = new URL(req.url).pathname;
    const file = Bun.file(join(appDir, path === "/" ? "index.html" : path));
    return (await file.exists()) ? new Response(file) : new Response("not found", { status: 404 });
  },
});
const base = `http://localhost:${server.port}`;

// CHROMIUM_PATH overrides for environments with a pre-installed browser.
const browser = await chromium.launch(
  process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {},
);
const page = await browser.newPage({
  viewport: { width: 393, height: 851 }, // mid-range Android
  hasTouch: true,
  isMobile: true,
});
const shot = (name) => page.screenshot({ path: join(outDir, `${name}.png`), fullPage: false });

const fail = (msg) => { console.error("FAIL:", msg); process.exit(1); };

await page.goto(base);
await shot("1-empty-state");

// Import the fixture through the real file input.
await page.click('[data-tab="data"]');
await page.setInputFiles(
  "#import-file",
  {
    name: "fake-liquorpos-export.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(readFileSync(join(appDir, "demo-data.csv"))),
  },
);
await page.waitForSelector("#import-report .notice.ok");
const notice = await page.textContent("#import-report .notice.ok");
if (!notice.includes("Imported 40 products")) fail(`unexpected import notice: ${notice}`);
await shot("2-import-done");

// Set a par: Johnnie Walker Black to 5 cases.
await page.click('[data-tab="inventory"]');
await page.fill("#inv-search", "Johnnie Walker Black");
await page.click('.item[data-barcode="080432400630"]');
await page.fill("#par-cases", "5");
await page.fill("#par-bottles", "0");
await shot("3-par-editor");
await page.click("#par-save");

// Low-stock list should now show it, short 1 case.
await page.click('[data-tab="low"]');
const lowText = await page.textContent("#view");
if (!lowText.includes("Johnnie Walker Black")) fail("low-stock list missing the below-par product");
if (!lowText.includes("1 cs (pack of 12)")) fail("suggestion arithmetic not shown");
await shot("4-low-stock");

// Order sheet for its distributor.
await page.click('[data-tab="orders"]');
const sheet = await page.textContent("pre.sheet");
if (!sheet.includes("ORDER — Southern Glazers")) fail("order sheet missing distributor header");
if (!sheet.includes("1 cs — Johnnie Walker Black 750ml")) fail("order sheet missing suggestion line");
await shot("5-order-sheet");

// Persistence: reload and confirm the par survived localStorage.
await page.reload();
await page.click('[data-tab="low"]');
const afterReload = await page.textContent("#view");
if (!afterReload.includes("Johnnie Walker Black")) fail("state did not survive reload");

// Demo button: clear storage, load demo data from the empty state.
await page.evaluate(() => localStorage.clear());
await page.reload();
await page.click("#load-demo");
await page.waitForSelector(".badge.low");
const demoText = await page.textContent("#view");
if (!demoText.includes("Johnnie Walker Black")) fail("demo data did not load");
await shot("6-demo-loaded");

console.log("PASS: import → par → low stock → order sheet, state persisted.");
console.log("Screenshots in", outDir);

await browser.close();
server.stop();
