import {
  defineConfig,
  presetAttributify,
  presetIcons,
  presetTypography,
  presetWind,
  transformerDirectives,
  transformerVariantGroup,
} from 'unocss';
import presetSodesu from 'sodesu-comment/dist/preset';
import safeList from 'sodesu-comment/dist/safeList';

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
    presetSodesu(),
  ],
  safelist: safeList,
  transformers: [transformerDirectives(), transformerVariantGroup()],
  rules: [
    ['shadow-app', { 'box-shadow': '0 4px 10px rgba(0, 0, 0, 0.05), 0 0 1px rgba(0, 0, 0, 0.1)' }],
    ['pre-wrap', { 'white-space': 'pre-wrap' }],
  ],
  shortcuts: { card: 'bg-white dark:bg-stone-800 rounded-md shadow-app' },
  layers: { shortcuts: -1 },
  theme: {
    fontFamily: {
      sans: [
        'Chinese Quotes',
        // 'MiSans',
        'Inter var',
        'Inter',
        'ui-sans-serif',
        'system-ui',
        '-apple-system',
        'BlinkMacSystemFont',
        'Segoe UI',
        'Roboto',
        'Helvetica Neue',
        'Helvetica',
        'Arial',
        'Noto Sans',
        'sans-serif',
        'Apple Color Emoji',
        'Segoe UI Emoji',
        'Segoe UI Symbol',
        'Noto Color Emoji',
      ],
    },
  },
});
