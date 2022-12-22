import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
import solidJs from '@astrojs/solid-js';
import transformerDirectives from '@unocss/transformer-directives';
import compress from 'astro-compress';
import { defineConfig } from 'astro/config';
import rehypeKatex from 'rehype-katex';
import remarkMath from 'remark-math';
import { presetTypography, presetWind } from 'unocss';
import UnoCSS from 'unocss/astro';
import injectDefaultLayout from './src/utils/injectDefaultLayouts';

// https://astro.build/config
export default defineConfig({
  site: 'https://stblog.penclub.club',
  integrations: [
    mdx(),
    sitemap(),
    solidJs(),
    UnoCSS({
      presets: [presetWind(), presetTypography()],
      transformers: [transformerDirectives()],
      rules: [
        [
          'shadow-app',
          { 'box-shadow': '0 4px 10px rgba(0, 0, 0, 0.05), 0 0 1px rgba(0, 0, 0, 0.1)' },
        ],
        [
          'shadow-appDark',
          {
            'box-shadow': '0 4px 10px rgba(255, 255, 255, 0.05), 0 0 1px rgba(255, 255, 255, 0.1)',
          },
        ],
      ],
    }),
    compress(),
  ],
  markdown: {
    syntaxHighlight: 'prism',
    remarkPlugins: [injectDefaultLayout, remarkMath],
    rehypePlugins: [rehypeKatex],
  },
});
