import puppeteer from "puppeteer";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.join(ROOT, "temporary screenshots");

const url   = process.argv[2];
const label = process.argv[3]; // optional label suffix
const width = Number(process.argv[4] ?? 1280);
const height= Number(process.argv[5] ?? 900);

if (!url) {
  console.error("usage: node screenshot.mjs <url> [label] [width] [height]");
  process.exit(1);
}

await fs.mkdir(OUT_DIR, { recursive: true });

// auto-increment: find next available screenshot-N
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
await page.screenshot({ path: outPath, fullPage: true });
await browser.close();

console.log(outPath);
