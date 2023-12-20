import idToSlug from '@utils/idToSlug';
import postToCreate from '@utils/noteToCreate';
import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';

export const getStaticPaths = async () => {
  const posts = await getCollection('posts');
  return posts.map((post) => ({ params: { id: idToSlug(post.id) } }));
};

export const GET: APIRoute = async ({ params }) => {
  const allPosts = await getCollection('posts');
  const post = allPosts.find((item) => idToSlug(item.id) === params.id)!;

  return new Response(JSON.stringify(postToCreate(post)));
};
