import type { CollectionEntry } from 'astro:content';
import idToSlug from './idToSlug';

const postToNote = (post: CollectionEntry<'posts'>) => ({
  '@context': [
    'https://www.w3.org/ns/activitystreams',
    {
      HashTag: 'as:HashTag',
    },
  ],
  id: `https://blog.yunyi.beiyan.us/api/activitypub/note/${idToSlug(post.id)}`,
  type: 'Note',
  attributedTo: 'https://blog.yunyi.beiyan.us/api/activitypub/actor',
  cc: ['https://blog.yunyi.beiyan.us/api/activitypub/followers'],
  content: `<p><a href="https://blog.yunyi.beiyan.us/posts/${idToSlug(post.id)}">${
    post.data.title
  }</a></p><p>${post.data.description || ''}</p>`,
  published: post.data.date.toISOString(),
  to: ['https://www.w3.org/ns/activitystreams#Public'],
  url: `https://blog.yunyi.beiyan.us/posts/${idToSlug(post.id)}`,
});

export default postToNote;
