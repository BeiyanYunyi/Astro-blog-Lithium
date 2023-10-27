import type MDInstance from '@app-types/MDInstance';

const postToNote = (post: MDInstance) => ({
  '@context': [
    'https://www.w3.org/ns/activitystreams',
    {
      HashTag: 'as:HashTag',
    },
  ],
  id: `https://blog.yunyi.beiyan.us/api/activitypub/note${post.url}`,
  type: 'Note',
  attributedTo: 'https://blog.yunyi.beiyan.us/api/activitypub/actor',
  cc: ['https://blog.yunyi.beiyan.us/api/activitypub/followers'],
  content: `<p><a href="https://blog.yunyi.beiyan.us${post.url}">${
    post.frontmatter.title
  }</a></p><p>${post.frontmatter.description || ''}</p>`,
  published: new Date(post.frontmatter.date).toISOString(),
  to: ['https://www.w3.org/ns/activitystreams#Public'],
  url: `https://blog.yunyi.beiyan.us${post.url}`,
});

export default postToNote;
