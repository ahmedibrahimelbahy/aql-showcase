// Variant of screenshot.mjs that scrolls to a Y position and captures
// only the viewport (no fullPage). Useful for reviewing long stitched pages.
//
// Usage:  node screenshot-scroll.mjs <url> <scrollY> [label] [width=1440] [height=900]
import puppeteer from "puppeteer";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.join(ROOT, "temporary screenshots");

const url     = process.argv[2];
const scrollY = Number(process.argv[3] ?? 0);
const label   = process.argv[4] || "scroll";
const width   = Number(process.argv[5] ?? 1440);
const height  = Number(process.argv[6] ?? 900);

if (!url) {
  console.error("usage: node screenshot-scroll.mjs <url> <scrollY> [label] [w] [h]");
  process.exit(1);
}

await fs.mkdir(OUT_DIR, { recursive: true });
const existing = await fs.readdir(OUT_DIR).catch(() => []);
const used = new Set();
for (const f of existing) {
  const m = f.match(/^screenshot-(\d+)/);
  if (m) used.add(Number(m[1]));
}
let n = 1;
while (used.has(n)) n++;
const suffix = label ? `-${label.replace(/[^a-z0-9-]/gi, "_")}` : "";
const outPath = path.join(OUT_DIR, `screenshot-${n}${suffix}.png`);

const browser = await puppeteer.launch({ headless: true });
const page = await browser.newPage();
await page.setViewport({ width, height, deviceScaleFactor: 2 });
await page.goto(url, { waitUntil: "networkidle0", timeout: 30_000 });
await page.evaluate((y) => window.scrollTo(0, y), scrollY);
await new Promise(r => setTimeout(r, 400)); // let any reveal/scroll-trigger settle
await page.screenshot({ path: outPath, fullPage: false });
await browser.close();
console.log(outPath);
