import rss from '@astrojs/rss';
import { SITE_TITLE, SITE_DESCRIPTION } from '@config';
import type MDInstance from '@app-types/MDInstance';

const importResults = import.meta.glob<MDInstance>('./posts/*.{md,mdx}', { eager: true });
const posts = Object.values(importResults).map((item) => ({
  link: item.url!,
  title: item.frontmatter.title,
  pubDate: new Date(item.frontmatter.date),
  customData: `<description>${item.frontmatter.description}</description>`,
}));

export const GET = () =>
  rss({
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    site: import.meta.env.SITE,
    items: posts,
  });
