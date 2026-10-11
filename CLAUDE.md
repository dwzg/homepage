# CLAUDE.md

Personal blog ("dennis/log"): Markdown posts about the author's projects, built with Astro into static HTML and served from a busybox httpd container. Deployed to Portainer on every push to `main`, the same way as `dwzg/weatherpage`.

## Layout

| Path | What |
| --- | --- |
| `src/content/posts/*.md` | The posts. File name = URL slug. |
| `src/content.config.ts` | Front-matter schema. A bad date or unknown project fails the build. |
| `src/data/projects.ts` | The projects a post can belong to. The schema's `project` enum is built from it. |
| `src/consts.ts` | Site URL, title, author, the footer quote. |
| `src/layouts/Base.astro` | Head, header, footer, font imports. |
| `src/pages/` | Home, posts, projects, about, RSS, robots, 404. |
| `src/styles/global.css` | Tokens (light + dark via `prefers-color-scheme`) and the `.prose` styles for post bodies. |
| `httpd.conf` | busybox httpd: the 404 page and MIME types it does not know (woff2, svg, xml). |

## Commands

```bash
npm run dev     # drafts visible
npm run build   # astro check + build; this is what CI runs
```

## Writing posts

Most posts are drafted by Claude from a project's repository and reviewed by Dennis in a pull request. When drafting:

- **Every number must come from the source**: the project's CLAUDE.md, commits, tests or measurements. Never estimate, round up a story, or invent a detail to make it read better. If a fact is not in the source, leave it out.
- Write in the first person, as Dennis. Plain, direct sentences. Explain the *why* and what was learned, not a changelog.
- `summary` is one or two sentences; it is the front page and the RSS description.
- Use `## ` headings (they build the "On this page" list); tables for measured comparisons, with numeric columns right-aligned (`---:`), which renders them in Fira Code and keeps them from wrapping.
- `assisted` defaults to true and prints "Written with Claude … reviewed by Dennis". Leave it on for drafted posts.
- Don't set `draft: true` on a drafted post. Open it as a pull request: merging the pull request is Dennis's review and publishes the post, edited or not. Never merge it yourself. `draft: true` stays available for posts Dennis wants to keep unpublished on `main`.
- Never put the weather station's location, coordinates or anything derived from them into a post. The weatherpage repository keeps them secret on purpose.

## Design

"Lab Log": IBM Plex Sans for text, Fira Code for metadata and code, one teal accent, white / near-black ground. Colours are tokens in `global.css`; style components through them, never with literal colours. Fonts are self-hosted through `@fontsource` (nothing is loaded from third-party servers). Fira Code's ligatures are switched off on the page so a reader sees `>=`, not `≥`.

**Never start a source line with an inline tag inside running text.** Astro drops the line break and indentation in front of it, so `including\n<a …>this site</a>` renders as "includingthis site". Break the line before the word, not before the tag.

Check UI changes in a browser at desktop and phone widths, in both colour schemes; the page must never scroll horizontally (tables and code scroll in their own box).

## Deployment

- `deploy.yml`: on push to `main`, build with buildx, tag `latest` + commit SHA, push to GHCR, call `PORTAINER_WEBHOOK_URL`. The untagged-image cleanup runs **before** the push, and `provenance: false` / `sbom: false` keep the tag a plain manifest. Both lessons came from weatherpage, where getting either wrong left a tag every pull failed on.
- `ci.yml`: on pull requests, `npm run build` plus a Docker build and a smoke test of the container.
- Secrets: `PORTAINER_WEBHOOK_URL`, `DELETE_PACKAGES_TOKEN`; `GITHUB_TOKEN` is automatic.
- Dependencies are pinned to exact versions. The base images are `node:22-alpine` (build) and `lipanski/docker-static-website:2.6.0` (serve).
