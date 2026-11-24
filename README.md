# corypleasance.com

My personal site and blog: [corypleasance.com](https://corypleasance.com).

I'm a Data Science & AI student at the University of Stirling. I write here about AI security, agent evaluation, and systems engineering.

## Stack

- [Astro](https://astro.build), starting from the [AstroPaper](https://github.com/satnaing/astro-paper) theme
- [Tailwind CSS](https://tailwindcss.com) for styling, [KaTeX](https://katex.org) for maths, [Pagefind](https://pagefind.app) for search
- Hosted as a static-assets [Cloudflare Worker](https://developers.cloudflare.com/workers/static-assets/)

## Where things live

| What | File |
| --- | --- |
| Site name, links, features | `astro-paper.config.ts` |
| Home page | `src/pages/index.astro` |
| About page | `src/pages/about.astro` (intro text in `src/content/pages/about.md`) |
| Blog posts | `src/content/posts/*.md` |
| Worker and domains | `wrangler.jsonc` |

A post stays hidden while its frontmatter has `draft: true`. The Posts, Tags and Archives links only appear once at least one post is published.

## Running locally

Astro needs Node 22.23.4 or newer.

```sh
npm install
npm run dev     # http://localhost:4321
npm run build   # type-check, build to dist/, and build the search index
```

## Deploying

Every push to `main` is built and deployed by Cloudflare Workers Builds. `wrangler.jsonc` attaches `corypleasance.com` and `www.corypleasance.com` as custom domains and turns off the `workers.dev` address.

## Licence

The theme code is MIT-licensed by its original author (see `LICENSE`). The writing and images on the site are mine.
