import * as globals from 'globals';
import * as pluginJs from '@eslint/js';
import * as tseslint from 'typescript-eslint';

const config: tseslint.Config = [
  {
    ignores: ['dist/**', 'node_modules/**', 'coverage/**', 'package-lock.json'],
  },
  { files: ['src/**/*.{js,mjs,cjs,ts}'] },
  {
    rules: {
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          destructuredArrayIgnorePattern: '^_',
          ignoreRestSiblings: true,
        },
      ],
    },
  },
  { languageOptions: { globals: globals.browser } },
  pluginJs.configs.recommended,
  ...tseslint.configs.recommended,
];

export default config;
