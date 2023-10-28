/* eslint-disable import/prefer-default-export */
import getAllPosts from '@utils/getAllPosts';
import postToCreate from '@utils/noteToCreate';
import type { APIRoute } from 'astro';

export const GET: APIRoute = async () => {
  const allPosts = (await getAllPosts()).sort(
    (a, b) => new Date(b.frontmatter.date).getTime() - new Date(a.frontmatter.date).getTime(),
  );

  return new Response(
    JSON.stringify({
      '@context': 'https://www.w3.org/ns/activitystreams',
      id: 'https://blog.yunyi.beiyan.us/api/activitypub/outbox',
      type: 'OrderedCollection',
      totalItems: allPosts.length,
      orderedItems: allPosts.map((post) => postToCreate(post)),
    }),
  );
};
