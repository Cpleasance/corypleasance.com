// Post-build step: writes dist/_headers, which Cloudflare Workers static
// assets apply to every response. The CSP allows inline <script> blocks by
// their SHA-256 hash (computed here from the built HTML), so script-src
// never needs 'unsafe-inline'. Re-run on every build: editing an inline
// script changes its hash.
import { createHash } from "node:crypto";
import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const DIST = "dist";

function htmlFiles(dir) {
  return readdirSync(dir).flatMap(name => {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) return htmlFiles(p);
    return p.endsWith(".html") ? [p] : [];
  });
}

const hashes = new Set();
const inline = /<script(?![^>]*\bsrc=)([^>]*)>([\s\S]*?)<\/script>/g;
for (const file of htmlFiles(DIST)) {
  for (const [, attrs, body] of readFileSync(file, "utf8").matchAll(inline)) {
    // JSON-LD is data, not executed, so CSP doesn't apply to it.
    if (/type=["']?application\/ld\+json/.test(attrs)) continue;
    hashes.add(createHash("sha256").update(body).digest("base64"));
  }
}

const scriptSrc = [
  "'self'",
  // Pagefind search compiles WebAssembly.
  "'wasm-unsafe-eval'",
  ...[...hashes].sort().map(h => `'sha256-${h}'`),
].join(" ");

const csp = [
  "default-src 'none'",
  `script-src ${scriptSrc}`,
  // Inline SVG charts and Astro components use style="" attributes.
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data:",
  "font-src 'self' data:",
  "connect-src 'self'",
  "media-src 'self'",
  "manifest-src 'self'",
  "worker-src 'self'",
  "frame-src 'none'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "upgrade-insecure-requests",
].join("; ");

const headers = `/*
  Content-Security-Policy: ${csp}
  Strict-Transport-Security: max-age=31536000; includeSubDomains; preload
  X-Content-Type-Options: nosniff
  X-Frame-Options: DENY
  Referrer-Policy: strict-origin-when-cross-origin
  Cross-Origin-Opener-Policy: same-origin
  Cross-Origin-Resource-Policy: same-origin
  Cross-Origin-Embedder-Policy: credentialless
  Permissions-Policy: camera=(), microphone=(), geolocation=(), interest-cohort=()
`;

writeFileSync(join(DIST, "_headers"), headers);
// eslint-disable-next-line no-console
console.log(`security-headers: wrote ${DIST}/_headers (${hashes.size} script hashes)`);
