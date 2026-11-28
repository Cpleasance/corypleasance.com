---
title: "Getting a static Astro site to 145/100 on MDN Observatory"
description: "TODO: one line, e.g. a strict, hash-based CSP for an Astro site on Cloudflare Workers, generated at build time so it never goes stale."
pubDatetime: 2026-11-28T12:00:00Z
draft: true
featured: false
tags:
  - security
  - web
  - astro
  - cloudflare
repoUrl: "https://github.com/Cpleasance/corypleasance.com"
---

<!--
OUTLINE: notes for you to write over. Everything in the bullets is
checked against the repo / live headers as of 2026-11-27. Delete these
comments as you go.
-->

## Hook

- Static blog: no login, no forms, no database. So why bother?
- A personal site is the first thing people see when they look you up. It's a cheap place to show you actually do the security stuff you write about (links nicely to the Kaggle agent-security post).
- End result: A+, 145/100 on MDN HTTP Observatory. Footer badge links to the scan.
- TODO: say what the score was before you started (did you run a scan first? AstroPaper on Workers out of the box ships no security headers at all).

## The setup

- AstroPaper theme, built to static files in `dist/`, served by Cloudflare Workers static assets (`wrangler.jsonc` points at `./dist`).
- No server code means you can't set headers in middleware. Workers static assets read a `_headers` file in the output dir instead (Netlify-style syntax, `/*` applies to everything).

## The obvious approach, and why it breaks

- Easy version: put a hand-written `_headers` in `public/` and copy it through.
- Problem is the CSP. Astro inlines some scripts into the HTML. The big one is the theme script in `<head>` that sets dark/light before first paint (to stop the flash of the wrong theme). It has to be inline and synchronous, so you can't just move it to a file.
- Most guides fix this with `script-src 'unsafe-inline'`, which pretty much switches off the XSS protection CSP is there for. Observatory penalises it.
- Next option is hashing each inline script into the CSP. But change one character in a script, or upgrade Astro/the theme, and the hash changes. A hand-written `_headers` silently goes stale and the site breaks (theme toggle, search, TOC just stop working, with errors only in the console).
- The live policy currently has 9 hashes. Nobody's keeping that up to date by hand.

## The fix: generate `_headers` after the build

- `security-headers.mjs` runs as the last step of `npm run build`:
  `astro check && astro build && pagefind --site dist && node copy-pagefind.mjs && node security-headers.mjs`
- It walks every `.html` file in `dist/`, finds inline `<script>` tags (ones without `src=`), SHA-256 hashes the body, and puts each as `'sha256-…'` in `script-src`.
- Skips `application/ld+json` blocks: they're structured data, not executed, so CSP doesn't apply to them.
- Has to run last, after Pagefind, because it reads the final HTML.
- Show the core loop (~10 lines), something like:

```js
const inline = /<script(?![^>]*\bsrc=)([^>]*)>([\s\S]*?)<\/script>/g;
for (const file of htmlFiles(DIST)) {
  for (const [, attrs, body] of readFileSync(file, "utf8").matchAll(inline)) {
    if (/type=["']?application\/ld\+json/.test(attrs)) continue;
    hashes.add(createHash("sha256").update(body).digest("base64"));
  }
}
```

- Payoff: every deploy (push to main → Cloudflare rebuilds) gets a CSP that matches exactly what's shipped. Rule for future you: never hand-edit `_headers`.
- TODO: did anything actually break while you were getting this working? A specific console error ("Refused to execute inline script…") would make a good screenshot or quote here.

## Deny by default

- Started with `default-src 'self'`, then tightened to `default-src 'none'` (commit 1c0660b). With `'none'`, anything not explicitly allowed is blocked, so every resource type gets listed:
  - `script-src 'self' 'wasm-unsafe-eval' <hashes>`. `wasm-unsafe-eval` because Pagefind search compiles WebAssembly. Worth explaining: it allows WASM compilation only, not JS `eval`.
  - `style-src 'self' 'unsafe-inline'`. Be honest here: inline SVG charts and Astro components use `style=""` attributes, which hashes can't cover. Inline styles are much lower risk than inline scripts, and Observatory doesn't penalise it.
  - `img-src`/`font-src 'self' data:`, plus `connect-src`, `media-src`, `manifest-src`, `worker-src` all `'self'`.
  - `frame-src 'none'`, `object-src 'none'`, `frame-ancestors 'none'`.
  - `base-uri 'self'`, `form-action 'self'`, `upgrade-insecure-requests`.
- Gotcha worth mentioning: with `'none'` you need `manifest-src` or the web manifest stops loading. TODO: confirm whether you actually hit this or just added it pre-emptively.

## The rest of the headers

Short table or list, one line each on what it stops:

| Header                       | Value                                                          | Why                                                                                      |
| ---------------------------- | -------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| Strict-Transport-Security    | `max-age=31536000; includeSubDomains; preload`                 | HTTPS only for a year, subdomains too                                                    |
| X-Content-Type-Options       | `nosniff`                                                      | no MIME sniffing                                                                         |
| X-Frame-Options              | `DENY`                                                         | no framing (for old browsers; `frame-ancestors` covers new ones)                         |
| Referrer-Policy              | `strict-origin-when-cross-origin`                              | don't leak full URLs to other sites                                                      |
| Cross-Origin-Opener-Policy   | `same-origin`                                                  | isolate the browsing context                                                             |
| Cross-Origin-Resource-Policy | `same-origin`                                                  | other sites can't embed your assets                                                      |
| Cross-Origin-Embedder-Policy | `credentialless`                                               | `credentialless` instead of `require-corp` so cross-origin loads don't need CORP headers |
| Permissions-Policy           | `camera=(), microphone=(), geolocation=(), interest-cohort=()` | turn off APIs the site never uses                                                        |

- HSTS `preload`: TODO. Did you actually submit to hstspreload.org? If not, say that the header only makes you eligible.
- One thing not in the repo: the HTTP→HTTPS redirect is Cloudflare's zone-level "Always Use HTTPS" toggle. Observatory checks the redirect too.

## Verifying it

- `curl -sI https://corypleasance.com` and show the headers coming back.
- Observatory scan → A+, 145/100 (it gives bonus points above 100 for things like a strict CSP and HSTS preload).
- Click round the site with DevTools open: theme toggle, search (WASM), TOC, back-to-top. No CSP errors in the console.
- TODO: screenshot of the Observatory result.

## What I'd tell someone doing the same

- Generate the CSP from the build output, don't write it by hand.
- Start at `default-src 'none'` and add what breaks, instead of starting loose.
- `'unsafe-inline'` for styles is a fair trade on a static site; for scripts it isn't.
- Wrap up: honest take on how much this matters for a static blog (not much risk, but it's cheap, and it's a good signal).
