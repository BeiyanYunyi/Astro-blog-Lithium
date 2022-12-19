/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}'],
  theme: {
    extend: {
      boxShadow: {
        app: '0 4px 10px rgba(0, 0, 0, 0.05), 0 0 1px rgba(0, 0, 0, 0.1)',
        appDark: '0 4px 10px rgba(255, 255, 255, 0.05), 0 0 1px rgba(255, 255, 255, 0.1)',
      },
      typography: {
        DEFAULT: {
          css: {
            blockquote: {
              'font-style': 'initial',
              // 在找到对暗黑模式友好的方式以前保持注释
              // 'background-color': colorPalette.majorBright,
              'margin-inline': '0',
            },
          }
        }
      },
    },
  },
  darkMode: 'class',
  plugins: [require('@tailwindcss/typography')],
};
