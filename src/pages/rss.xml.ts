import rss from '@astrojs/rss';
import type { APIContext } from 'astro';

import { SITE_DESCRIPTION, SITE_TITLE } from '../consts';
import { getPosts } from '../lib/posts';

export async function GET(context: APIContext) {
  const posts = await getPosts();
  return rss({
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    site: context.site!,
    items: posts.map((post) => ({
      title: post.data.title,
      description: post.data.summary,
      pubDate: post.data.date,
      link: `/posts/${post.id}/`,
      categories: [post.data.project],
    })),
  });
}
