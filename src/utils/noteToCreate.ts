import type MDInstance from '@app-types/MDInstance';
import postToNote from './postToNote';

const postToCreate = (post: MDInstance) => ({
  '@context': [
    'https://www.w3.org/ns/activitystreams',
    {
      HashTag: 'as:HashTag',
    },
  ],
  id: `https://blog.yunyi.beiyan.us/api/activitypub/create/${post
    .url!.substring(7)
    .replaceAll('/', '_')}`,
  type: 'Create',
  actor: 'https://blog.yunyi.beiyan.us/api/activitypub/actor',
  published: new Date(post.frontmatter.date).toISOString(),
  to: ['https://www.w3.org/ns/activitystreams#Public'],
  cc: ['https://blog.yunyi.beiyan.us/api/activitypub/followers'],
  object: postToNote(post),
});

export default postToCreate;
