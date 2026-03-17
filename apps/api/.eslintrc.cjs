/** @type {import('eslint').Linter.Config} */
// NOTE: This package runs `eslint src --max-warnings 0`, meaning even a single
// warning fails CI. Rules are therefore set to `off` instead of `warn` until
// each area of the codebase is ready for enforcement. Promote rules to `error`
// or `warn` incrementally as the API matures.
module.exports = {
  root: true,
  env: {
    node: true,
    es2022: true,
  },
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
  },
  plugins: ['@typescript-eslint'],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
  ],
  rules: {
    // --- Silenced for zero-warning compatibility ---
    // TypeScript compiler handles these better than ESLint
    'no-undef': 'off',
    'no-unused-vars': 'off',
    '@typescript-eslint/no-unused-vars': 'off',
    // Allow `any` — API has dynamic DB types and Fastify request shapes
    '@typescript-eslint/no-explicit-any': 'off',
    '@typescript-eslint/no-non-null-assertion': 'off',
    '@typescript-eslint/no-require-imports': 'off',
    // API uses structured logging (pino) — console calls are intentional
    'no-console': 'off',
    // Common Fastify/Node patterns that are intentional
    '@typescript-eslint/no-empty-function': 'off',
    '@typescript-eslint/no-empty-object-type': 'off',
    '@typescript-eslint/no-unsafe-function-type': 'off',
    // Allow empty catch blocks in DB retry logic
    'no-empty': ['error', { allowEmptyCatch: true }],
    // Project uses "semi: false" — leading semicolons like ;(expr) are intentional
    // ASI guards. Prettier manages all semicolon decisions. Must be off since this
    // script uses --max-warnings 0 and the rule would produce warnings.
    'no-extra-semi': 'off',
  },
  ignorePatterns: ['dist/', 'node_modules/'],
}
