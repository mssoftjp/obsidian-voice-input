import tsParser from '@typescript-eslint/parser';
import { defineConfig } from 'eslint/config';
import obsidianmd from 'eslint-plugin-obsidianmd';
import globals from 'globals';

export default defineConfig([
    {
        ignores: [
            'node_modules/**',
            'dist/**',
            'build/**',
            'coverage/**',
            'main.js',
            '*.config.mjs',
            'scripts/**',
            'docs/**',
            'src/lib/fvad-wasm/**'
        ]
    },
    ...obsidianmd.configs.recommendedWithLocalesEn,
    {
        files: ['src/**/*.ts', 'tests/**/*.ts'],
        languageOptions: {
            parser: tsParser,
            parserOptions: {
                project: ['./tsconfig.json', './tsconfig.test.json'],
                tsconfigRootDir: import.meta.dirname ?? process.cwd()
            },
            globals: {
                ...globals.browser,
                ...globals.node,
                Option: 'readonly',
                NodeJS: 'readonly'
            }
        }
    }
]);
