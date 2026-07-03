import { satteri } from '@astrojs/markdown-satteri'
import mdx from '@astrojs/mdx'
import sitemap from '@astrojs/sitemap'
import solidJs from '@astrojs/solid-js'
import { defineConfig } from 'astro/config'
import UnoCSS from 'unocss/astro'
import katexPlugin from './src/utils/katexPlugin'

// https://astro.build/config
export default defineConfig({
  site: 'https://stblog.penclub.club',
  integrations: [mdx(), sitemap(), solidJs(), UnoCSS()],
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
})
