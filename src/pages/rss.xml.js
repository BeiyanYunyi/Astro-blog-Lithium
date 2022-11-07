import rss from '@astrojs/rss';
import { SITE_TITLE, SITE_DESCRIPTION } from '../config';

const importResults = import.meta.glob('./posts/*.{md,mdx}', { eager: true });
const posts = Object.values(importResults).map((item) => ({
  link: item.url,
  title: item.frontmatter.title,
  pubDate: item.frontmatter.date,
  customData: `<description>${item.frontmatter.description}</description>`,
}));

export const get = () =>
  rss({
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    site: import.meta.env.SITE,
    items: posts,
  });
