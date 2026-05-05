// Detects horizontal overflow on iPhone SE and reports the offending elements.
import puppeteer, { KnownDevices } from "puppeteer";

const url = process.argv[2] || "http://localhost:3200/#freeze=order";
const device = KnownDevices["iPhone SE"] ?? KnownDevices["iPhone 8"];

const browser = await puppeteer.launch({ headless: true });
const page = await browser.newPage();
await page.emulate(device);
await page.goto(url, { waitUntil: "networkidle0", timeout: 30_000 });

// Wait for fonts/animations to settle
await new Promise(r => setTimeout(r, 800));

const result = await page.evaluate(() => {
  const docW   = document.documentElement.clientWidth;
  const bodyW  = document.body.scrollWidth;
  // Walk up an element's ancestors checking computed `overflow-x` / `overflow`.
  function isClippedByAncestor(el) {
    let cur = el.parentElement;
    while (cur && cur !== document.body) {
      const cs = getComputedStyle(cur);
      if (cs.overflowX === "hidden" || cs.overflow === "hidden" ||
          cs.overflowX === "auto"   || cs.overflow === "auto"   ||
          cs.overflowX === "scroll" || cs.overflow === "scroll") return true;
      cur = cur.parentElement;
    }
    return false;
  }
  const offending = [];
  const all = document.querySelectorAll("*");
  for (const el of all) {
    const r = el.getBoundingClientRect();
    if (r.right > docW + 0.5 && !isClippedByAncestor(el)) {
      offending.push({
        tag: el.tagName.toLowerCase(),
        cls: el.className && typeof el.className === "string"
              ? el.className.split(/\s+/).slice(0, 3).join(".")
              : "",
        right: Math.round(r.right),
        width: Math.round(r.width),
        text: (el.innerText || "").trim().slice(0, 60),
      });
    }
  }
  // Top 25 worst offenders by `right`
  offending.sort((a, b) => b.right - a.right);
  return {
    viewportWidth: docW,
    bodyScrollWidth: bodyW,
    horizontalScroll: bodyW > docW,
    topOffenders: offending.slice(0, 25),
  };
});

console.log(`viewport: ${result.viewportWidth}px  body.scrollWidth: ${result.bodyScrollWidth}px  overflow: ${result.horizontalScroll}`);
console.log("\nTop offenders (right edge in px):");
for (const o of result.topOffenders) {
  console.log(`  ${o.right.toString().padStart(5)}  ${o.tag}.${o.cls}  w=${o.width}  "${o.text}"`);
}

await browser.close();
