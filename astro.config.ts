import { readdirSync, readFileSync } from 'node:fs';
import cloudflare from '@astrojs/cloudflare';
import { satteri } from '@astrojs/markdown-satteri';
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
import solidJs from '@astrojs/solid-js';
import { defineConfig } from 'astro/config';
import { parseFrontmatter } from 'astro/markdown';
import UnoCSS from 'unocss/astro';
import { filePathToSlug } from './src/utils/idToSlug';
import katexPlugin from './src/utils/katexPlugin';

const site = 'https://stblog.penclub.club';
const postPages = readdirSync(new URL('./src/content/posts/', import.meta.url))
  .filter((file) => /\.mdx?$/.test(file))
  .filter((file) => {
    const source = readFileSync(
      new URL(`./src/content/posts/${file}`, import.meta.url),
      'utf8',
    );
    return parseFrontmatter(source).frontmatter.draft !== true;
  })
  .map((file) => new URL(`/posts/${filePathToSlug(file)}/`, site).href);

// https://astro.build/config
export default defineConfig({
  site,
  output: 'static',
  session: false,
  adapter: cloudflare({
    prerenderEnvironment: 'node',
    imageService: 'compile',
  }),
  integrations: [
    mdx(),
    sitemap({ customPages: postPages }),
    solidJs(),
    UnoCSS(),
  ],
  markdown: {
    processor: satteri({
      features: {
        gfm: true,
        math: true,
        smartPunctuation: true,
      },
      hastPlugins: [katexPlugin],
    }),
    syntaxHighlight: 'prism',
  },
  image: { domains: ['s3.penclub.club'] },
  vite: {
    build: {
      sourcemap: true,
    },
  },
});
