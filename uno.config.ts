import transformerDirectives from '@unocss/transformer-directives';
import { defineConfig, presetTypography, presetWind } from 'unocss';

export default defineConfig({
  presets: [presetWind(), presetTypography()],
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
});
