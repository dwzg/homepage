// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

import { SITE_URL } from './src/consts.ts';

export default defineConfig({
  site: SITE_URL,
  integrations: [sitemap()],
  // Every page is a directory with an index.html, which the static file
  // server in the image serves without any rewrite rules.
  build: { format: 'directory' },
  trailingSlash: 'ignore',
  markdown: {
    shikiConfig: {
      // One dark theme in both colour schemes: the code block is a dark panel
      // on the light page too, which is the look the design was chosen for.
      theme: 'github-dark-dimmed',
      wrap: false,
    },
  },
});
