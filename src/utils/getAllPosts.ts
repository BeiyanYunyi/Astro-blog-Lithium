import type MDInstance from '@app-types/MDInstance';

let allPosts: MDInstance[] = [];
let lock = false;

const getAllPosts = async () => {
  const posts = import.meta.glob<MDInstance>('../pages/posts/*.{md,mdx}');

  //if (allPosts.length === 0) {
  //  lock = true;
  await Promise.all(
    Object.values(posts).map(async (iterator, index) => {
      if (index === 0) {
        allPosts = [];
      }
      allPosts.push(await iterator());
    }),
  );
  //  lock = false;
  //} else if (!lock) {
  //  Promise.all(
  //    Object.values(posts).map(async (iterator, index) => {
  //      const post = await iterator();
  //      if (index === 0) {
  //        allPosts = [];
  //      }
  //      allPosts.push(post);
  //    }),
  //  ).then(() => {
  //    lock = false;
  //  });
  //  lock = true;
  //}
  return allPosts;
};

export default getAllPosts;
