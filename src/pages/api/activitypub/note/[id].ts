import type { APIRoute } from 'astro';
import { filePathToSlug } from '@utils/idToSlug';
import postToNote from '@utils/postToNote';
import { getCollection } from 'astro:content';

export const prerender = false;

export const GET: APIRoute = async ({ params }) => {
  const allPosts = await getCollection('posts');
  const post = allPosts.find((item) => filePathToSlug(item.filePath) === params.id);

  if (!post) return new Response('Not Found', { status: 404 });
  return new Response(JSON.stringify(postToNote(post)), {
    headers: { 'Content-Type': 'application/activity+json' },
  });
};

export const HEAD = GET;
