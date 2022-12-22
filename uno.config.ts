import transformerDirectives from '@unocss/transformer-directives';
import { defineConfig, presetTypography, presetWind, presetAttributify } from 'unocss';

export default defineConfig({
  presets: [presetWind(), presetAttributify(), presetTypography()],
  transformers: [transformerDirectives()],
  rules: [
    ['shadow-app', { 'box-shadow': '0 4px 10px rgba(0, 0, 0, 0.05), 0 0 1px rgba(0, 0, 0, 0.1)' }],
    [
      'shadow-appDark',
      {
        'box-shadow': '0 4px 10px rgba(255, 255, 255, 0.05), 0 0 1px rgba(255, 255, 255, 0.1)',
      },
    ],
  ],
  shortcuts: { card: 'bg-white dark:bg-stone-800 rounded-md shadow-app dark:shadow-appDark' },
  layers: { shortcuts: -1 },
});
