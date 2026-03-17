/** @type {import('eslint').Linter.Config} */
module.exports = {
  root: true,
  env: {
    browser: true,
    es2022: true,
    webextensions: true,
  },
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
    ecmaFeatures: { jsx: true },
  },
  plugins: ['@typescript-eslint'],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
  ],
  rules: {
    // TypeScript handles these — avoid double-reporting
    'no-undef': 'off',
    'no-unused-vars': 'off',
    '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    // Allow `any` during initial development; tighten later
    '@typescript-eslint/no-explicit-any': 'warn',
    // Allow `require()` in config files (this file uses CJS)
    '@typescript-eslint/no-require-imports': 'off',
    // Extension often uses non-null assertions for DOM / Chrome API
    '@typescript-eslint/no-non-null-assertion': 'warn',

    // --- Legacy code patterns in extension internals (warn, not error) ---
    // These should be fixed but won't block CI while the extension matures
    'no-case-declarations': 'warn',
    'no-constant-condition': 'warn',
    'no-useless-escape': 'warn',
    '@typescript-eslint/no-this-alias': 'warn',
    'prefer-rest-params': 'warn',
  },
  ignorePatterns: ['dist/', 'node_modules/', '.wxt/'],
}
