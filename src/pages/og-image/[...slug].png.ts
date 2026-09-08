import type { APIRoute, GetStaticPaths } from 'astro';
import type { CollectionEntry } from 'astro:content';
import svgPathToName from '@utils/svgPathToName';
import { getCollection } from 'astro:content';
import sharp from 'sharp';

export const getStaticPaths = (async () => {
  const blogEntries = await getCollection('posts');
  return blogEntries
    .filter((i) => !!i.data.image && !!i.data.image.src)
    .map((entry) => ({
      params: { slug: svgPathToName(entry.data.image!.src) },
      props: entry,
    }));
}) satisfies GetStaticPaths;

export const GET: APIRoute<CollectionEntry<'posts'>> = async ({ props }) => {
  // Dev metadata points to the source file (sometimes through Vite's /@fs/ prefix).
  // Build metadata points to assets emitted in dist/server before prerendering finishes.
  const pathname = decodeURIComponent(new URL(props.data.image!.src, 'http://astro.local').pathname);
  const source = import.meta.env.DEV
    ? pathname.replace(/^\/@fs(?=\/)/, '')
    : `./dist/server${pathname}`;
  const image = await sharp(source)
    .resize(1200, 630, { fit: 'contain' })
    .png()
    .toBuffer();
  return new Response(new Uint8Array(image), {
    headers: { 'Content-Type': 'image/png' },
  });
};
