import { getCollection } from 'astro:content';
import rss from '@astrojs/rss';
import { SITE_DESCRIPTION, SITE_TITLE } from '@config';
import { filePathToSlug } from '@utils/idToSlug';

const importResults = await getCollection('posts', ({ data }) => !data.draft);
const posts = importResults.map((item) => ({
  link: `posts/${filePathToSlug(item.filePath)}`,
  title: item.data.title,
  pubDate: item.data.date,
  customData: `<description>${item.data.description}</description>`,
}));

export function GET() {
  return rss({
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    site: import.meta.env.SITE,
    items: posts,
  });
}
