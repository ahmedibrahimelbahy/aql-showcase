// Mobile screenshot tool — uses puppeteer's device emulation so the page
// receives proper viewport, DPR, user-agent, and touch-event support.
//
// Usage:
//   node screenshot-mobile.mjs <url> [device] [scrollY] [label]
// Devices: se (iPhone SE), 15 (iPhone 15), max (iPhone 15 Pro Max)
//
// Examples:
//   node screenshot-mobile.mjs http://localhost:3200/                 15 0    hero
//   node screenshot-mobile.mjs http://localhost:3200/#freeze=order   se 1200 demos
//
import puppeteer, { KnownDevices } from "puppeteer";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.join(ROOT, "temporary screenshots");

const DEVICES = {
  se:   KnownDevices["iPhone SE"]      ?? KnownDevices["iPhone 8"],   // 375×667
  "15": KnownDevices["iPhone 15"]      ?? KnownDevices["iPhone 14"]   // 390×844
                                       ?? KnownDevices["iPhone 13"],
  max:  KnownDevices["iPhone 15 Pro Max"] ?? KnownDevices["iPhone 14 Pro Max"] // 430×932
                                          ?? KnownDevices["iPhone 13 Pro Max"],
};

const url       = process.argv[2];
const deviceKey = process.argv[3] || "15";
const scrollY   = Number(process.argv[4] ?? 0);
const label     = process.argv[5] || `mobile-${deviceKey}`;

if (!url) {
  console.error("usage: node screenshot-mobile.mjs <url> [se|15|max] [scrollY] [label]");
  console.error("\navailable known devices in this puppeteer install:");
  Object.keys(KnownDevices).filter(k => k.includes("iPhone")).forEach(k =>
    console.error("  - " + k)
  );
  process.exit(1);
}

const device = DEVICES[deviceKey];
if (!device) {
  console.error(`unknown device key "${deviceKey}". use: se | 15 | max`);
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
await page.emulate(device);
await page.goto(url, { waitUntil: "networkidle0", timeout: 30_000 });
if (scrollY) {
  await page.evaluate((y) => window.scrollTo(0, y), scrollY);
  await new Promise(r => setTimeout(r, 400));
}
await page.screenshot({ path: outPath, fullPage: false });
await browser.close();

console.log(outPath);
console.log(`  device: ${device.name ?? deviceKey} (${device.viewport.width}×${device.viewport.height})`);
