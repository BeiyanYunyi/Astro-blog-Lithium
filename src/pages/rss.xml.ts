import rss from '@astrojs/rss';
import { SITE_DESCRIPTION, SITE_TITLE } from '@config';
import idToSlug from '@utils/idToSlug';
import { getCollection } from 'astro:content';

const importResults = await getCollection('posts');
const posts = importResults.map((item) => ({
  link: `posts/${idToSlug(item.id)}`,
  title: item.data.title,
  pubDate: item.data.date,
  customData: `<description>${item.data.description}</description>`,
}));

export const GET = () =>
  rss({
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    site: import.meta.env.SITE,
    items: posts,
  });
