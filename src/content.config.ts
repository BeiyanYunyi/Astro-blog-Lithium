import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

const postsCollection = defineCollection({
  loader: glob({ base: './src/content/posts', pattern: '*.{md,mdx}' }),
  schema: ({ image }) =>
    z.object({
      title: z.string(),
      date: z.date(),
      description: z.string(),
      draft: z.boolean().default(false),
      tag: z.array(z.string()).optional(),
      image: image().optional(),
    }),
});

export const collections = { posts: postsCollection };
