import { glob } from "astro/loaders";
import { z } from "astro/zod";
import { defineCollection } from "astro:content";

const postsCollection = defineCollection({
  loader: glob({ base: "./src/content/posts", pattern: "*.{md,mdx}" }),
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
