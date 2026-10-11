import { getCollection, type CollectionEntry } from 'astro:content';

export type Post = CollectionEntry<'posts'>;

/** Published posts, newest first. Drafts appear only in the dev server. */
export async function getPosts(): Promise<Post[]> {
  const posts = await getCollection('posts', ({ data }) => import.meta.env.DEV || !data.draft);
  return posts.sort((a, b) => b.data.date.getTime() - a.data.date.getTime());
}

/** ISO calendar date, the format the whole site prints dates in. */
export function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** Rounded up, never below one minute. */
export function readingMinutes(body: string | undefined): number {
  const words = (body ?? '')
    .replace(/```[\s\S]*?```/g, ' ')
    .split(/\s+/)
    .filter(Boolean).length;
  return Math.max(1, Math.ceil(words / 220));
}
