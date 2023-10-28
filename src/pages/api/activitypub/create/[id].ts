import getAllPosts from '@utils/getAllPosts';
import postToCreate from '@utils/noteToCreate';
import type { APIRoute } from 'astro';

export const getStaticPaths = async () => {
  const posts = await getAllPosts();
  return posts.map((post) => ({ params: { id: post.url!.substring(7).replaceAll('/', '_') } }));
};

export const GET: APIRoute = async ({ params }) => {
  const allPosts = await getAllPosts();
  const post = allPosts.find((item) => item.url === `/posts/${params.id!.replaceAll('_', '/')}`)!;

  return new Response(JSON.stringify(postToCreate(post)));
};
