import js from '@eslint/js';
import { defineConfig, globalIgnores } from 'eslint/config';
import tseslint from 'typescript-eslint';

export default defineConfig(
  globalIgnores(['sample', 'dist', '**/export']),
  js.configs.recommended,
  tseslint.configs.strictTypeChecked,
  {
    languageOptions: { parserOptions: { projectService: true } },
    rules: { '@typescript-eslint/restrict-template-expressions': ['error', { allowNumber: true }] },
  },
  { files: ['**/*.js'], extends: [tseslint.configs.disableTypeChecked] },
);
