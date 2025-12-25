#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.join(__dirname, '..');

const buildLatestDir = path.join(rootDir, 'build', 'latest');
const buildLatestMainPath = path.join(buildLatestDir, 'main.js');
const buildLatestManifestPath = path.join(buildLatestDir, 'manifest.json');

function fail(message) {
    console.error(`ERROR: ${message}`);
    process.exit(1);
}

function ensureFileExists(filePath) {
    if (!fs.existsSync(filePath)) {
        fail(`Missing file: ${path.relative(rootDir, filePath)}`);
    }
}

function excerpt(text, index, context = 80) {
    const start = Math.max(0, index - context);
    const end = Math.min(text.length, index + context);
    const prefix = start > 0 ? '…' : '';
    const suffix = end < text.length ? '…' : '';
    return `${prefix}${text.slice(start, end)}${suffix}`;
}

if (!fs.existsSync(buildLatestDir)) {
    fail('Missing build/latest. Run `npm run build-plugin` first.');
}

ensureFileExists(buildLatestMainPath);
ensureFileExists(buildLatestManifestPath);

const mainStat = fs.statSync(buildLatestMainPath);
if (!mainStat.isFile() || mainStat.size < 10_000) {
    fail(`build/latest/main.js looks too small (${mainStat.size} bytes).`);
}

try {
    JSON.parse(fs.readFileSync(buildLatestManifestPath, 'utf8'));
} catch (error) {
    fail(`build/latest/manifest.json is not valid JSON: ${error instanceof Error ? error.message : String(error)}`);
}

const mainJs = fs.readFileSync(buildLatestMainPath, 'utf8');
const forbidden = [
    { name: 'innerHTML', regex: /\binnerHTML\b/u },
    { name: 'outerHTML', regex: /\bouterHTML\b/u },
    { name: 'insertAdjacentHTML', regex: /\binsertAdjacentHTML\b/u },
    { name: 'eval(', regex: /\beval\s*\(/u },
    { name: 'new Function', regex: /\bnew\s+Function\b/u },
    { name: 'debugger', regex: /\bdebugger\b/u },
    { name: 'console.log(', regex: /\bconsole\.log\s*\(/u }
];

const failures = [];
for (const check of forbidden) {
    const match = mainJs.match(check.regex);
    if (!match || typeof match.index !== 'number') {
        continue;
    }
    failures.push({
        name: check.name,
        index: match.index,
        snippet: excerpt(mainJs, match.index)
    });
}

if (failures.length > 0) {
    for (const failureInfo of failures) {
        console.error(`ERROR: Forbidden pattern "${failureInfo.name}" found in build/latest/main.js (index ${failureInfo.index}).`);
        console.error(failureInfo.snippet);
        console.error('');
    }
    process.exit(1);
}

console.log('OK: build/latest artifacts passed sanity checks.');
