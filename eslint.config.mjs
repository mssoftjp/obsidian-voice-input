import tsParser from '@typescript-eslint/parser';
import { defineConfig } from 'eslint/config';
import obsidianmd from 'eslint-plugin-obsidianmd';
import * as espree from 'espree';
import globals from 'globals';

const manifestJsonParser = {
    meta: {
        name: 'manifest-json-parser',
        version: '1.0.0'
    },
    parseForESLint(text, options) {
        const normalizedText = text.replace(/^\uFEFF/u, '');
        const wrappedText = `(${normalizedText})`;
        const ast = espree.parse(wrappedText, {
            ...options,
            ecmaVersion: 2022,
            sourceType: 'script',
            comment: true,
            loc: true,
            range: true,
            tokens: true
        });
        return { ast, services: {}, visitorKeys: espree.VisitorKeys };
    }
};

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
        files: ['manifest.json'],
        languageOptions: {
            parser: manifestJsonParser
        },
        plugins: {
            obsidianmd
        },
        rules: {
            'obsidianmd/validate-manifest': 'error'
        }
    },
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
