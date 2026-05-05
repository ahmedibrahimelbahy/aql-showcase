// Stitches the 4 section files into index.html.
// Reads sections/*.html, extracts <style>, <body> innerHTML, and <script>
// from each, and writes index-full.html with everything inlined.

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.dirname(fileURLToPath(import.meta.url));

// Order matches the page flow.
// Sections that don't exist yet (e.g. apex-wealth-card, vignettes) are skipped silently.
// "plain-language" is the new "in plain English" intro that slows the visitor
// down for 30 seconds before the dense interactive sections.
const sections = [
  { id: "plain",        file: "sections/plain-language.html"   },
  { id: "capabilities", file: "sections/capabilities.html"     },
  { id: "demos",        file: "sections/playable-demos.html"   },
  { id: "vignettes",    file: "sections/vignettes.html"        },
  { id: "apex",         file: "sections/apex-wealth-card.html" },
  { id: "cases",        file: "sections/case-studies.html"     },
  { id: "process",      file: "sections/process.html"          },
  { id: "contact",      file: "sections/contact.html"          },
];

// Extract content between matching tags. Returns array of inner contents.
function extractTagContents(html, tag) {
  const re = new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)<\\/${tag}>`, "g");
  const out = [];
  let m;
  while ((m = re.exec(html)) !== null) out.push(m[1]);
  return out;
}

function extractBodyInner(html) {
  const m = html.match(/<body\b[^>]*>([\s\S]*)<\/body>/);
  return m ? m[1] : "";
}

// Strip <script>, <style>, and <nav> from a body inner so we don't double-inline them.
// (Each section file is standalone with its own nav — we want only the master nav.)
function stripScriptsAndStyles(html) {
  return html
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/g, "")
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/g, "")
    .replace(/<nav\b[^>]*>[\s\S]*?<\/nav>/g, "");
}

// Drop bits we don't want from a section's <style>: the :root block (already in index)
// and any `body` selectors that would override the master body styles.
function pruneSectionCss(css) {
  return css
    // remove :root { ... }
    .replace(/:root\s*\{[\s\S]*?\}/g, "")
    // remove plain `body { ... }` rules (won't affect class selectors)
    .replace(/(?:^|\s)body\s*\{[\s\S]*?\}/g, "")
    // remove .grain::before duplicate (already defined globally)
    .replace(/\.grain::before\s*\{[\s\S]*?\}/g, "");
}

// Source: hero-only template. Output: index.html (full stitched page).
const templatePath = path.join(ROOT, "_hero.template.html");
let master = await fs.readFile(templatePath, "utf-8");

// Build the combined block to splice in before </body> in master.
let combinedStyles = "";
let combinedBody   = "";
let combinedScripts= "";

for (const sec of sections) {
  const filePath = path.join(ROOT, sec.file);
  let raw;
  try {
    raw = await fs.readFile(filePath, "utf-8");
  } catch (err) {
    if (err.code === "ENOENT") {
      console.log(`  skip: ${sec.file} (not yet written)`);
      continue;
    }
    throw err;
  }

  // Grab styles
  const styles  = extractTagContents(raw, "style");
  for (const s of styles) {
    combinedStyles += `\n/* === ${sec.id} === */\n` + pruneSectionCss(s) + "\n";
  }

  // Grab body (without scripts/styles)
  const bodyInner = extractBodyInner(raw);
  const cleanBody = stripScriptsAndStyles(bodyInner);
  combinedBody += `\n<!-- ============== ${sec.id.toUpperCase()} ============== -->\n` +
                  `<section id="${sec.id}" data-section="${sec.id}">\n` + cleanBody + `\n</section>\n`;

  // Grab scripts
  const scripts = extractTagContents(raw, "script");
  for (const s of scripts) {
    // skip scripts that are external (src=) — we only inline IIFEs
    combinedScripts += `\n<!-- ${sec.id} -->\n<script>\n${s}\n</script>\n`;
  }
}

// Inject the styles into the master <head> (before </head>)
master = master.replace(
  /<\/head>/,
  `<style id="merged-section-styles">${combinedStyles}</style>\n</head>`
);

// Inject body content + scripts before </body>
master = master.replace(
  /<\/body>/,
  combinedBody + combinedScripts + "\n</body>"
);

const outPath = path.join(ROOT, "index.html");
await fs.writeFile(outPath, master, "utf-8");

console.log("wrote " + outPath);
console.log(`  styles: ${combinedStyles.length} chars`);
console.log(`  body:   ${combinedBody.length} chars`);
console.log(`  scripts:${combinedScripts.length} chars`);
