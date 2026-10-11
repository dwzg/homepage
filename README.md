# homepage

A small blog about my projects and experiments. Posts are Markdown files, built into static pages with [Astro](https://astro.build) and served from a tiny container.

```bash
npm install
npm run dev      # http://localhost:4321, drafts included
npm run build    # type-check and build into dist/
```

## Writing a post

Add a file to `src/content/posts/`. The file name becomes the URL (`barometer.md` → `/posts/barometer/`).

```yaml
---
title: A falling barometer does not mean rain on my balcony
summary: One or two sentences, shown on the front page and in the feed.
date: 2026-09-23
project: weatherpage      # an id from src/data/projects.ts
draft: true               # optional: shown by `npm run dev` only
assisted: false           # optional: hides "Written with Claude" (default true)
---
```

To add a project, add an entry to `src/data/projects.ts`.

## Deployment

Every push to `main` builds the image, pushes it to `ghcr.io/dwzg/homepage` (tagged `latest` and with the commit SHA) and calls the Portainer webhook. Pull requests run the build and a container smoke test.
