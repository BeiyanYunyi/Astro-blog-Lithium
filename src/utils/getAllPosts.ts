import type MDInstance from '@app-types/MDInstance';

let allPosts: MDInstance[] = [];

const getAllPosts = async () => {
  const posts = import.meta.glob<MDInstance>('../pages/posts/*.{md,mdx}');

  if (allPosts.length === 0) {
    await Promise.all(
      Object.values(posts).map(async (iterator, index) => {
        if (index === 0) {
          allPosts = [];
        }
        allPosts.push(await iterator());
      }),
    );
  } else {
    Object.values(posts).map(async (iterator, index) => {
      const post = await iterator();
      if (index === 0) {
        allPosts = [];
      }
      allPosts.push(post);
    });
  }
  return allPosts;
};

export default getAllPosts;
