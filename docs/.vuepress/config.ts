import { defineHopeConfig } from 'vuepress-theme-hope';
import { path } from '@vuepress/utils';
import mdPangu from 'markdown-it-pangu';
import themeConfig from './themeConfig';

export default defineHopeConfig({
  base: '/',
  source: './source',

  dest: './dist',

  head: [
    [
      'link',
      {
        rel: 'stylesheet',
        href: '//at.alicdn.com/t/font_2410206_mfj6e1vbwo.css',
      },
    ],
  ],

  locales: {
    '/': {
      lang: 'zh-CN',
      title: '黎想的博客',
      description: '地上的人不应该进来',
    },
  },

  themeConfig,

  markdown: { breaks: true },

  extendsMarkdown: (mdit) => {
    mdit.use(mdPangu);
  },

  plugins: [
    [
      '@vuepress/register-components',
      {
        componentsDir: path.resolve(__dirname, '../../src'),
      },
    ],
  ],
});
