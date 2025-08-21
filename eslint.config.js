import js from '@eslint/js';
import typescript from '@typescript-eslint/eslint-plugin';
import typescriptParser from '@typescript-eslint/parser';
import importPlugin from 'eslint-plugin-import';
import unusedImports from 'eslint-plugin-unused-imports';
import promise from 'eslint-plugin-promise';
import security from 'eslint-plugin-security';
import prettier from 'eslint-config-prettier';

export default [
  js.configs.recommended,
  {
    ignores: [
      'node_modules/',
      'dist/',
      'coverage/',
      '*.log',
      '**/*.min.js',
      'public/**/*.js', // Exclude browser-side JavaScript
      'scripts/**/*.js', // Exclude Node.js scripts
      '**/*.js', // Exclude all JavaScript files
      '**/*.mjs', // Exclude ES modules
      '**/*.cjs', // Exclude CommonJS files
    ],
  },
  {
    files: ['**/*.ts'],
    languageOptions: {
      parser: typescriptParser,
      parserOptions: {
        project: ['./tsconfig.eslint.json'],
        tsconfigRootDir: import.meta.dirname,
        sourceType: 'module',
      },
      globals: {
        node: true,
        es2022: true,
        process: 'readonly',
        __dirname: 'readonly',
        require: 'readonly',
        module: 'readonly',
        exports: 'readonly',
      },
    },
    plugins: {
      '@typescript-eslint': typescript,
      import: importPlugin,
      'unused-imports': unusedImports,
      promise: promise,
      security: security,
    },
    rules: {
      /* General hygiene */
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      'no-unsafe-finally': 'error',

      /* Imports */
      'import/order': [
        'warn',
        {
          'newlines-between': 'always',
          alphabetize: { order: 'asc', caseInsensitive: true },
          groups: [
            'builtin',
            'external',
            'internal',
            ['parent', 'sibling', 'index'],
            'object',
            'type',
          ],
        },
      ],
      'import/no-duplicates': 'warn',

      /* Unused code */
      'unused-imports/no-unused-imports': 'warn',
      'unused-imports/no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],

      /* TS specifics */
      '@typescript-eslint/consistent-type-imports': ['warn', { prefer: 'type-imports' }],
      '@typescript-eslint/no-misused-promises': [
        'error',
        { checksVoidReturn: { attributes: false } },
      ],
      '@typescript-eslint/no-floating-promises': ['error', { ignoreIIFE: true }],

      /* Express augmentation safety (our ambient types) */
      '@typescript-eslint/no-namespace': 'off', // we use `namespace Express` in d.ts
    },
  },
  {
    files: ['**/*.d.ts'],
    rules: {
      '@typescript-eslint/ban-types': 'off',
      '@typescript-eslint/no-unused-vars': 'off',
    },
  },
  prettier,
];
