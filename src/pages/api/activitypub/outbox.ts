/* eslint-disable import/prefer-default-export */
import postToCreate from '@utils/noteToCreate';
import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';

export const GET: APIRoute = async () => {
  const allPosts = (await getCollection('posts')).sort(
    (a, b) => b.data.date.getTime() - a.data.date.getTime(),
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
