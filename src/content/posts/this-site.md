---
title: How this site is built
summary: Markdown files in a Git repository, built into static pages by Astro, and served from a small container that redeploys itself on every push to main.
date: 2026-10-11
project: homepage
---

This site is deliberately boring to run. There is no database, no admin panel and no JavaScript in the pages. It is a folder of Markdown files that turns into a folder of HTML files.

## Writing a post

Each post is one file in `src/content/posts/`, with a few lines of front matter:

```yaml
---
title: The model said 11% on the first wet evening
summary: One or two sentences for the front page and the feed.
date: 2026-10-04
project: weatherpage
---
```

The front matter is checked when the site builds. If a date doesn't parse, or a post names a project that doesn't exist, the build fails instead of quietly publishing a broken page. A post marked `draft: true` shows up on my machine and nowhere else.

Most posts are drafted with Claude from the project's own repository: its commit history, its design notes and the numbers it measured. A draft arrives as a pull request. I read it, fix what is wrong, and merge it.

## From merge to page

Merging into `main` starts a GitHub Actions workflow that:

1. builds the site with [Astro](https://astro.build), which turns the Markdown into plain HTML and CSS;
2. copies the output into a tiny static file server image and pushes it to the GitHub container registry, tagged with the commit;
3. calls a Portainer webhook, which pulls the new image and restarts the container.

Tagging every image with its commit means a bad deploy can be rolled back by pinning the previous one. The weather page deploys the same way. It learned a few lessons along the way, and this site now uses them from the start.

## What isn't here

There are no comments, no tracking, and no fonts or scripts loaded from anyone else's servers. The typefaces are IBM Plex Sans and Fira Code, served from this site itself. If you want to follow along, there is an [RSS feed](/rss.xml).
