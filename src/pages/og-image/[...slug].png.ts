import svgPathToName from '@utils/svgPathToName';
import type { APIRoute, GetStaticPaths } from 'astro';
import { getCollection, type CollectionEntry } from 'astro:content';
import sharp from 'sharp';

export const getStaticPaths = (async () => {
  const blogEntries = await getCollection('posts');
  return blogEntries
    .filter((i) => !!i.data.image)
    .map((entry) => ({
      params: { slug: svgPathToName(entry.data.image!.src) },
      props: entry,
    }));
}) satisfies GetStaticPaths;

export const GET: APIRoute<CollectionEntry<'posts'>> = async ({ props }) => {
  const image = await sharp(`./dist${props.data.image!.src}`)
    .resize(1200, 630, { fit: 'contain' })
    .png()
    .toBuffer();
  return new Response(image.buffer);
};
