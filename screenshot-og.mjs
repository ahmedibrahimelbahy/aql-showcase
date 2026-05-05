// Captures a 1200x630 OG image from a dedicated layout served at localhost.
// Saves to brand_assets/og.png. Used by WhatsApp / LinkedIn / Twitter / iMessage / Slack.
import puppeteer from "puppeteer";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const url = process.argv[2] || "http://localhost:3200/og.html";
const outPath = path.join(ROOT, "brand_assets", "og.png");

const browser = await puppeteer.launch({ headless: true });
const page = await browser.newPage();
await page.setViewport({ width: 1200, height: 630, deviceScaleFactor: 1 });
await page.goto(url, { waitUntil: "networkidle0", timeout: 30_000 });
// Let the hub pulse + orbit settle into a clean frame
await new Promise(r => setTimeout(r, 1200));
await page.screenshot({ path: outPath, fullPage: false, omitBackground: false });
await browser.close();

const stat = await fs.stat(outPath);
console.log(`wrote ${outPath} (${(stat.size / 1024).toFixed(1)} KB)`);
