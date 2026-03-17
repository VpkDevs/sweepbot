export default [
  {
    ignores: ['dist', 'build', 'node_modules', '.next', '.wxt'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        browser: 'readonly',
        node: 'readonly',
        console: 'readonly',
        process: 'readonly',
      },
    },
    rules: {
      // Best practices
      eqeqeq: ['error', 'always'],
      'no-var': 'error',
      'prefer-const': 'error',
      'no-console': ['warn', { allow: ['warn', 'error', 'info'] }],
      'no-debugger': 'warn',
      'no-unused-vars': 'off', // TypeScript handles this
      'no-empty': ['error', { allowEmptyCatch: true }],

      // Code style
      quotes: ['error', 'single', { avoidEscape: true }],
      semi: ['error', 'never'],
      'comma-dangle': ['error', 'always-multiline'],
      indent: ['error', 2, { SwitchCase: 1 }],
      'arrow-spacing': 'error',
      'keyword-spacing': 'error',
      'space-before-function-paren': ['error', 'never'],
      'object-curly-spacing': ['error', 'always'],
      'array-bracket-spacing': ['error', 'never'],
    },
  },
]
