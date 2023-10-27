import getAllPosts from '@utils/getAllPosts';
import type { APIRoute } from 'astro';

export const getStaticPaths = async () => {
  const posts = await getAllPosts();
  return posts.map((post) => ({ params: { id: post.url!.substring(7).replaceAll('/', '_') } }));
};

export const GET: APIRoute = async ({ params }) => {
  const allPosts = await getAllPosts();
  const post = allPosts.find((item) => item.url === `/posts/${params.id!.replaceAll('_', '/')}`)!;

  return new Response(
    JSON.stringify({
      '@context': [
        'https://www.w3.org/ns/activitystreams',
        {
          HashTag: 'as:HashTag',
        },
      ],
      id: `https://blog.yunyi.beiyan.us/api/activitypub/note/${post.url}`,
      type: 'Note',
      attributedTo: 'https://blog.yunyi.beiyan.us/api/activitypub/actor',
      cc: ['https://blog.yunyi.beiyan.us/api/activitypub/followers'],
      content: `<p><a href="https://blog.yunyi.beiyan.us${post.url}">${
        post.frontmatter.title
      }</a></p><p>${post.frontmatter.description || ''}</p>`,
      published: new Date(post.frontmatter.date).toISOString(),
      to: ['https://www.w3.org/ns/activitystreams#Public'],
      url: `https://blog.yunyi.beiyan.us${post.url}`,
    }),
  );
};
