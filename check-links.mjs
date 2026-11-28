/* eslint-disable no-console */
// Post-build validation: verifies all internal links, anchors, and images across dist/
// to prevent dead links, broken fragments, and missing assets.
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, normalize, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const DIST = fileURLToPath(new URL("dist", import.meta.url));

function htmlFiles(dir) {
  return readdirSync(dir).flatMap(name => {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) return htmlFiles(p);
    return p.endsWith(".html") ? [p] : [];
  });
}

const files = htmlFiles(DIST);
const pageIds = new Map(); // normalizedPath -> Set of IDs
const fileCache = new Set();

// Pass 1: Index all available files and page anchors (id and name attributes)
for (const file of files) {
  const normFile = normalize(file);
  fileCache.add(normFile);

  const html = readFileSync(file, "utf8");
  const ids = new Set();
  const idRegex = /\b(?:id|name)=["']([^"']+)["']/gi;
  for (const match of html.matchAll(idRegex)) {
    ids.add(match[1]);
  }
  pageIds.set(normFile, ids);
}

// Also index non-HTML assets in dist
function indexAllAssets(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) {
      indexAllAssets(p);
    } else {
      fileCache.add(normalize(p));
    }
  }
}
indexAllAssets(DIST);

let errors = 0;
let checkedLinks = 0;

// Pass 2: Check all links and asset references
const linkRegex = /<(?:a|link)\b[^>]*\bhref=["']([^"']+)["']/gi;
const imgRegex = /<img\b[^>]*\bsrc=["']([^"']+)["']/gi;

function resolveLocalTarget(sourceFile, href) {
  const [withoutAnchor, anchor] = href.split("#");
  const [pathPart] = withoutAnchor.split("?");
  let targetPath = null;

  if (pathPart === "" && anchor !== undefined) {
    // Same-page anchor
    targetPath = normalize(sourceFile);
  } else if (pathPart.startsWith("/")) {
    // Root-relative
    const cleaned = pathPart.replace(/^\/+/, "");
    const direct = join(DIST, cleaned);
    const asHtml = join(DIST, `${cleaned}.html`);
    const asIndex = join(DIST, cleaned, "index.html");

    if (fileCache.has(normalize(direct))) {
      targetPath = normalize(direct);
    } else if (fileCache.has(normalize(asIndex))) {
      targetPath = normalize(asIndex);
    } else if (fileCache.has(normalize(asHtml))) {
      targetPath = normalize(asHtml);
    }
  } else {
    // Relative to source file
    const sourceDir = dirname(sourceFile);
    const resolved = resolve(sourceDir, pathPart);
    const relToDist = normalize(resolved);

    const asHtml = `${relToDist}.html`;
    const asIndex = join(relToDist, "index.html");

    if (fileCache.has(relToDist)) {
      targetPath = relToDist;
    } else if (fileCache.has(normalize(asIndex))) {
      targetPath = normalize(asIndex);
    } else if (fileCache.has(normalize(asHtml))) {
      targetPath = normalize(asHtml);
    }
  }

  return { targetPath, anchor };
}

for (const file of files) {
  const html = readFileSync(file, "utf8");

  // Check <a> links
  for (const match of html.matchAll(linkRegex)) {
    const href = match[1].trim();
    if (!href || href.startsWith("http://") || href.startsWith("https://") || href.startsWith("mailto:") || href.startsWith("tel:") || href.startsWith("javascript:")) {
      continue;
    }

    checkedLinks++;
    const { targetPath, anchor } = resolveLocalTarget(file, href);

    if (!targetPath) {
      console.error(`[BROKEN LINK] in ${file}: "${href}" target not found`);
      errors++;
      continue;
    }

    if (anchor) {
      const ids = pageIds.get(targetPath);
      if (ids && !ids.has(anchor)) {
        console.error(`[BROKEN ANCHOR] in ${file}: "${href}" -> anchor #${anchor} not found in ${targetPath}`);
        errors++;
      }
    }
  }

  // Check <img> src
  for (const match of html.matchAll(imgRegex)) {
    const src = match[1].trim();
    if (!src || src.startsWith("http://") || src.startsWith("https://") || src.startsWith("data:")) {
      continue;
    }

    const { targetPath } = resolveLocalTarget(file, src);
    if (!targetPath) {
      console.error(`[BROKEN IMAGE] in ${file}: "${src}" file not found`);
      errors++;
    }
  }
}

if (errors > 0) {
  console.error(`\n❌ Found ${errors} broken link/anchor reference(s) in dist/`);
  process.exit(1);
} else {
  console.log(`✓ Verified ${checkedLinks} internal links and anchors across ${files.length} HTML files — no broken links found!`);
}
