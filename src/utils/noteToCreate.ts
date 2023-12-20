import type { CollectionEntry } from 'astro:content';
import idToSlug from './idToSlug';
import postToNote from './postToNote';

const postToCreate = (post: CollectionEntry<'posts'>) => ({
  '@context': [
    'https://www.w3.org/ns/activitystreams',
    {
      HashTag: 'as:HashTag',
    },
  ],
  id: `https://blog.yunyi.beiyan.us/api/activitypub/create/${idToSlug(post.id)}`,
  type: 'Create',
  actor: 'https://blog.yunyi.beiyan.us/api/activitypub/actor',
  published: post.data.date.toISOString(),
  to: ['https://www.w3.org/ns/activitystreams#Public'],
  cc: ['https://blog.yunyi.beiyan.us/api/activitypub/followers'],
  object: postToNote(post),
});

export default postToCreate;
