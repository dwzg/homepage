import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

import { PROJECT_IDS } from './data/projects';

const posts = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/posts' }),
  schema: z.object({
    title: z.string(),
    summary: z.string(),
    date: z.coerce.date(),
    updated: z.coerce.date().optional(),
    project: z.enum(PROJECT_IDS),
    // Drafts are visible in `npm run dev` and left out of the built site.
    draft: z.boolean().default(false),
    // Shown on the post as "Written with Claude". Default on, because most
    // posts here are; set it to false for one written by hand.
    assisted: z.boolean().default(true),
  }),
});

export const collections = { posts };
