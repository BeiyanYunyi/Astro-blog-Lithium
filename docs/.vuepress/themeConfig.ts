import { defineThemeConfig } from 'vuepress-theme-hope';
import navbar from './navbar';
import sidebar from './sidebar';

export default defineThemeConfig({
  hostname: 'https://stblog.penclub.club',

  author: {
    name: '黎想',
    url: 'https://stblog.penclub.club',
  },

  iconPrefix: 'iconfont icon-',

  logo: '/头像圆.png',

  repo: 'https://github.com/lixiang810/comb',

  docsDir: '/docs',

  // navbar
  navbar: navbar,
  darkmode: 'auto',
  themeColor: false,
  fullScreen: false,

  // sidebar
  sidebar: false,

  footer: '默认页脚',
  displayFooter: false,

  copyright: 'Copyleft © 黎想',

  // page meta
  metaLocales: {
    editLink: '在 GitHub 上编辑此页',
  },

  blog: {
    description: '整活型人才',
    intro: '/intro.html',
    medias: {
      GitHub: 'https://github.com/lixiang810',
    },
    roundAvatar: true,
  },

  encrypt: {
    config: {
      '/guide/encrypt.html': ['1234'],
    },
  },

  plugins: {
    blog: {
      autoExcerpt: true,
    },

    comment: {
      type: 'waline',
      serverURL: 'https://bmhgu5.deta.dev/',
    },

    mdEnhance: {
      vpre: true,
      container: true,
      codegroup: true,
      presentation: false,
      align: true,
      sup: true,
      sub: true,
      footnote: true,
      lazyLoad: true,
      mark: true,
      tasklist: true,
      tex: true,
    },

    pwa: false,
    /*
    {
      favicon: "/favicon.ico",
      cachePic: true,
      apple: {
        icon: "/assets/icon/apple-icon-152.png",
        statusBarColor: "black",
      },
      msTile: {
        image: "/assets/icon/ms-icon-144.png",
        color: "#ffffff",
      },
      manifest: {
        icons: [
          {
            src: "/assets/icon/chrome-mask-512.png",
            sizes: "512x512",
            purpose: "maskable",
            type: "image/png",
          },
          {
            src: "/assets/icon/chrome-mask-192.png",
            sizes: "192x192",
            purpose: "maskable",
            type: "image/png",
          },
          {
            src: "/assets/icon/chrome-512.png",
            sizes: "512x512",
            type: "image/png",
          },
          {
            src: "/assets/icon/chrome-192.png",
            sizes: "192x192",
            type: "image/png",
          },
        ],
        shortcuts: [
          {
            name: "Guide",
            short_name: "Guide",
            url: "/guide/",
            icons: [
              {
                src: "/assets/icon/guide-maskable.png",
                sizes: "192x192",
                purpose: "maskable",
                type: "image/png",
              },
              {
                src: "/assets/icon/guide-monochrome.png",
                sizes: "192x192",
                purpose: "monochrome",
                type: "image/png",
              },
            ],
          },
        ],
      },
    }, */
  },
});
