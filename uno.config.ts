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
  safelist: [
    ...safeList,
    'blog-typeset',
    'blog-typeset-wrap',
    'blog-letter-spacing',
    'print:hidden',
    "after:content-['-']",
    'after:generated-newline',
  ],
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
    // A preserved newline in generated content forces a line break that is
    // not copied with the selection.
    ['generated-newline', { content: '"\\a"', 'white-space': 'pre' }],
  ],
  shortcuts: {
    card: 'bg-white dark:bg-stone-800 rounded-md shadow-app',
    'blog-typeset-wrap': '[@media_screen]:[overflow-wrap:anywhere]',
    'blog-letter-spacing': [
      '[@media_screen]:[letter-spacing:var(--blog-letter-spacing)]',
      '[@media_screen]:[margin-inline-end:var(--blog-letter-spacing-end)]',
    ],
    'blog-typeset': [
      '[@media_screen]:!whitespace-nowrap',
      '[@media_screen]:[text-autospace:no-autospace]',
      // Keep kerning consistent between width probes and mixed-script text.
      '[@media_screen]:[font-kerning:normal]',
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
