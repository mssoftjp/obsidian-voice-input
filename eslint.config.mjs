import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import obsidianmd from 'eslint-plugin-obsidianmd';
import globals from 'globals';

export default tseslint.config(
    {
        ignores: [
            'node_modules/**',
            'build/**',
            'dist/**',
            'main.js',
            'docs/**'
        ]
    },
    js.configs.recommended,
    ...tseslint.configs.recommended,
    ...obsidianmd.configs.recommended,
    {
        files: [
            'src/**/*.ts',
            'tests/**/*.ts'
        ],
        languageOptions: {
            globals: {
                ...globals.browser,
                ...globals.node,
                NodeJS: 'readonly'
            },
            parserOptions: {
                ecmaVersion: 2020,
                sourceType: 'module',
                project: ['./tsconfig.json'],
                tsconfigRootDir: import.meta.dirname
            }
        },
        rules: {
            '@typescript-eslint/no-explicit-any': 'warn',
            '@typescript-eslint/explicit-function-return-type': 'off',
            '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
            '@typescript-eslint/no-non-null-assertion': 'warn',
            'no-console': ['warn', { allow: ['warn', 'error', 'debug'] }],
            'semi': ['error', 'always'],
            'quotes': ['error', 'single', { avoidEscape: true }],
            'comma-dangle': ['error', 'never'],
            'no-trailing-spaces': 'error',
            'indent': ['error', 4, { SwitchCase: 1 }],
            'linebreak-style': ['error', 'unix'],
            'eol-last': ['error', 'always'],
            'no-multiple-empty-lines': ['error', { max: 1, maxEOF: 0 }]
        }
    }
);
