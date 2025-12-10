const next = require('eslint-config-next');
const importPlugin = require('eslint-plugin-import');
const reactHooksPlugin = require('eslint-plugin-react-hooks');
const tseslint = require('typescript-eslint');

const tsFiles = ['**/*.{ts,tsx,mts,cts}'];

const tsConfigs = tseslint.configs.recommended.map((config) => ({
  ...config,
  files: config.files ?? tsFiles,
  languageOptions: {
    ...config.languageOptions,
    parserOptions: {
      ...config.languageOptions?.parserOptions,
      project: ['./tsconfig.json'],
      tsconfigRootDir: __dirname,
    },
  },
}));

module.exports = [
  {
    ignores: ['.next/**', 'out/**', 'build/**', 'public/dict/**'],
  },
  ...next,
  ...tsConfigs,
  {
    plugins: {
      import: importPlugin,
      'react-hooks': reactHooksPlugin,
      '@typescript-eslint': tseslint.plugin,
    },
    settings: {
      react: {
        version: 'detect',
      },
      'import/resolver': {
        typescript: {
          project: './tsconfig.json',
          alwaysTryTypes: true,
        },
      },
    },
    rules: {
      'react-hooks/set-state-in-effect': 'off',
      'react-hooks/immutability': 'off',
      'react-hooks/preserve-manual-memoization': 'off',
      'import/no-anonymous-default-export': 'warn',
      '@typescript-eslint/explicit-module-boundary-types': 'off',
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': [
        'warn',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
        },
      ],
    },
  },
];
