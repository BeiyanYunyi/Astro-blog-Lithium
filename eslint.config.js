import antfu from '@antfu/eslint-config'

export default antfu({
  formatters: {
    astro: true,
    css: true,
    prettierOptions: {
      printWidth: 100,
      tabWidth: 2,
      useTabs: false,
      semi: true,
      singleQuote: true,
      quoteProps: 'as-needed',
      jsxSingleQuote: false,
      trailingComma: 'all',
      bracketSpacing: true,
      arrowParens: 'always',
      requirePragma: false,
      insertPragma: false,
      proseWrap: 'preserve',
      htmlWhitespaceSensitivity: 'css',
      endOfLine: 'lf',
      embeddedLanguageFormatting: 'auto',
    },
  },
  unocss: true,
  astro: true,
  solid: true,
})
