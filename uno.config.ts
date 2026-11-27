import presetSodesu from 'sodesu-comment/preset';
import safeList from 'sodesu-comment/safeList';
import {
  defineConfig,
  presetAttributify,
  presetIcons,
  presetTypography,
  presetWind3,
  transformerDirectives,
  transformerVariantGroup,
} from 'unocss';
import { useMiSans } from './src/config';

const sansFont = [
  'Chinese Quotes',
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
];

if (useMiSans) sansFont.unshift('MiSans');

export default defineConfig({
  content: { filesystem: ['src/**/*.{md,mdx,astro,ts,svelte}'] },
  presets: [
    presetWind3(),
    presetAttributify(),
    presetTypography({
      cssExtend: {
        'blockquote *::before, blockquote *::after': {
          content: 'none',
        },
        p: { 'white-space': 'pre-line' },
      },
    }),
    presetIcons(),
    presetSodesu(),
  ],
  safelist: [...safeList, 'blog-typeset', 'blog-typeset-wrap', 'print:hidden'],
  transformers: [transformerDirectives(), transformerVariantGroup()],
  rules: [
    [
      'shadow-app',
      {
        'box-shadow':
          '0 4px 10px rgba(0, 0, 0, 0.05), 0 0 1px rgba(0, 0, 0, 0.1)',
      },
    ],
    ['pre-wrap', { 'white-space': 'pre-wrap' }],
  ],
  shortcuts: {
    card: 'bg-white dark:bg-stone-800 rounded-md shadow-app',
    'blog-typeset-wrap': '[@media_screen]:[overflow-wrap:anywhere]',
    'blog-typeset': [
      '[@media_screen]:!whitespace-nowrap',
      '[@media_screen]:[text-autospace:no-autospace]',
      '[@media_screen]:[text-spacing-trim:space-all]',
      '[@media_screen]:[&_code]:!whitespace-pre',
    ],
  },
  layers: { shortcuts: -1 },
  theme: {
    fontFamily: {
      sans: sansFont,
    },
  },
});
