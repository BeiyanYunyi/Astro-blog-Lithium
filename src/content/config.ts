import { defineCollection, z } from 'astro:content';

const postsCollection = defineCollection({
  type: 'content',
  schema: ({ image }) =>
    z.object({
      title: z.string(),
      date: z.date(),
      description: z.string(),
      tag: z.array(z.string()).optional(),
      image: image().optional(),
    }),
});

export const collections = { posts: postsCollection };
