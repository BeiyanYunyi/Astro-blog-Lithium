import {
  defineConfig,
  presetTypography,
  presetWind,
  presetAttributify,
  transformerDirectives,
  presetIcons,
} from 'unocss';

export default defineConfig({
  presets: [
    presetWind(),
    presetAttributify(),
    presetTypography({
      cssExtend: {
        'blockquote:before, blockquote:after, code:before, code:after': { content: 'none' },
        p: { 'white-space': 'pre-line' },
      },
    }),
    presetIcons(),
  ],
  transformers: [transformerDirectives()],
  rules: [
    ['shadow-app', { 'box-shadow': '0 4px 10px rgba(0, 0, 0, 0.05), 0 0 1px rgba(0, 0, 0, 0.1)' }],
  ],
  shortcuts: { card: 'bg-white dark:bg-stone-800 rounded-md shadow-app' },
  layers: { shortcuts: -1 },
});
