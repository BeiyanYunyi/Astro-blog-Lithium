import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
import solidJs from '@astrojs/solid-js';
import tailwind from '@astrojs/tailwind';
import { defineConfig } from 'astro/config';
import rehypeKatex from 'rehype-katex';
import remarkMath from 'remark-math';
import injectDefaultLayout from './src/utils/injectDefaultLayouts';

export default defineConfig({
  site: 'https://stblog.penclub.club',
  integrations: [mdx(), sitemap(), solidJs(), tailwind({ config: { applyBaseStyles: false } })],
  markdown: {
    syntaxHighlight: 'prism',
    remarkPlugins: [injectDefaultLayout, remarkMath],
    rehypePlugins: [rehypeKatex],
  },
});
