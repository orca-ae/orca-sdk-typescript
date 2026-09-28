// Copyright The Orca Authors
// SPDX-License-Identifier: Apache-2.0

// @ts-check
import tseslint from 'typescript-eslint';
import unusedImports from 'eslint-plugin-unused-imports';

export default tseslint.config(
  { ignores: ['dist/', 'node_modules/'] },
  {
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: { sourceType: 'module' },
    },
    files: ['**/*.ts', '**/*.mts', '**/*.cts', '**/*.js', '**/*.mjs', '**/*.cjs'],
    plugins: {
      '@typescript-eslint': tseslint.plugin,
      'unused-imports': unusedImports,
    },
    rules: {
      'no-unused-vars': 'off',
      'unused-imports/no-unused-imports': 'error',
      'unused-imports/no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/no-explicit-any': 'off',
      'no-empty': 'warn',
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              regex: '^@orca-ae/orca-sdk(/.*)?',
              message: 'Use a relative import, not a package import.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['tests/**', 'examples/**'],
    rules: {
      'no-restricted-imports': 'off',
    },
  },
);
