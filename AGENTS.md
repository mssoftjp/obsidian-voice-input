# Repository Guidelines

## Project Structure & Module Organization
- Source: `src/` (TypeScript). Key areas: `plugin/` (entry/commands/ribbon), `views/` (`VoiceInputView` and other UI/Actions), `core/` (audio/VAD/transcription), `config/`, `utils/`, `interfaces/`, `settings/`, `security/`.
- Assets: `src/lib/fvad-wasm/{fvad.wasm,fvad.js}` (copied during build). Keep generated binaries inside `build/<version>/`.
- Build output: `build/latest/` and `build/YYYYMMDD_HHMMSS/` (snapshots). Release bundles include `main.js`, `manifest.json`, optional `styles.css`, and wasm/binary assets.
- Root holds `manifest.json`, `package.json`; use `tmp/` only for short-lived review artifacts and clean it up.
- Tests: `tests/` (Jest + jsdom). Mirrors the `src/` layout.

## Build, Test, and Development Commands
- `npm ci`: clean install dependencies.
- `npm run dev`: local development with esbuild watch.
- `npm run build`: `tsc -noEmit -skipLibCheck` + esbuild, outputs to `build/`.
- `npm run build-plugin`: run `npm run build` then post-build steps to populate `build/latest/` and snapshot.
- `npm run check`: `npm run lint` then `npm run build`.
- `npm run deploy-local`: after build, deploy to detected Obsidian vaults.
- `npm test`: run Jest tests. Optional: `npm test -- --runTestsByPath <file>`.
- `npm run analyze:unused`: output unused file list from the esbuild dependency graph.
- `npm run lint` / `npm run lint:fix`: lint TypeScript sources.

## Coding Style & Naming Conventions
- Language: TypeScript (ES2018), 2-space indent. Prefer explicit types and interfaces. Avoid `any` and non-null `!`.
- Do not mutate shared config constants; derive overrides via helpers (e.g., `getModelConfig`).
- Lint: ESLint (`@typescript-eslint`). Example: `npm run lint`.
- Modules: barrel-export per folder via `index.ts`.
- Naming: classes `PascalCase`; functions/variables `camelCase`. Files follow existing pattern (class files `PascalCase.ts`; folders lowercase).
- Comments only for non-obvious logic.

## Lint & Static Analysis
- Pin `eslint-plugin-obsidian` to the CI version and ensure `eslint.config.mjs` loads it; update the plugin and config together.
- After `npm run build`, lint/tsc generated outputs (e.g., `build/**`, `dist/**`) to catch injected `any` or enum mismatches; do not commit temp stores (e.g., `.pnpm-store`).
- Keep TS strict flags: `noImplicitAny`, `noFallthroughCasesInSwitch`, `noImplicitOverride` (consider `noUncheckedIndexedAccess` when helpful).
- Prefer a single enum in comparisons/switch; use `assertUnreachable` for exhaustiveness.
- Track Obsidian API changes and replace deprecated APIs (e.g., `getFilename`).
- Lint imported templates/generated code immediately and clear warnings before merging.
- Prefer CSS files over inline styles; class names/IDs must be plugin-prefixed to avoid clashes.
- Use `getLanguage()` for locale; avoid browser-only globals in mobile builds.

## Testing Guidelines
- Framework: Jest (`jest-environment-jsdom`).
- Location: `tests/**` mirrors `src/**`. Naming uses `*.test.ts`; keep each suite focused.
- Execution: `npm test`. Add tests focused on audio/VAD/transcription, controller/storage paths, and settings migration logic.

## Commit & Pull Request Guidelines
- Commits: Conventional Commits; short and imperative (e.g., `fix: ...`, `chore(css): ...`, `refactor(http): centralize requestUrl`, `style(lint): add EOF newlines`).
- PRs: include summary/background; attach screenshots or GIFs for UI changes; link related issues; add manual-test notes (e.g., deploy path) and relevant logs for UI/build changes. Ensure `npm run lint`, `npm test`, and `npm run build-plugin` pass.
- Do not run `git push`; the user will push at their discretion.

## Pre-PR Checklist
- `npm run lint` (with `eslint-plugin-obsidian`).
- `npm run build`, then `npm run lint -- --ext .ts,.js build/` to scan artifacts.
- `npm test` passes.
- Re-check `obsidian-developer-docs/en/Obsidian October plugin self-critique checklist.md`.
- Any allowed `any` is justified in code comments or PR notes.
- Confirm new/changed commands avoid default hotkeys and commandId/name duplication.

## Security & Configuration Tips
- Never commit API keys; store them encrypted in plugin settings. Obsidian fetches only `main.js`, `manifest.json`, `styles.css`; bundle wasm/binary assets (e.g., `fvad.wasm`) with releases.
- For network requests, use Obsidian `requestUrl` via `ObsidianHttpClient`.
- Do not commit `build/` output. For local verification use `npm run deploy-local`.

## Agent Workflow & Issue Hygiene
- Align with `.gitignore`; do not expose ignored artifacts.
- When creating issues, specify steps, target files/modules, settings/i18n keys, acceptance criteria.
- No branch-naming instructions needed; clarify scope with labels and tasks.

## Obsidian Plugin Compliance (`obsidian-developer-docs/en/Plugins`)
- Submission/naming/distribution: remove placeholders; avoid extra "Obsidian" in the plugin name. Do not include plugin name or ID in command names/IDs. `main.js` only in release assets, not in the repo. `fundingUrl` must point to donation services (set if possible). `minAppVersion` should be minimal. Description must be ≤250 chars, end with `.`, no emoji, proper capitalization, start with an action verb. If using Node/Electron set `isDesktopOnly: true`.
- General/style: use `this.app`, avoid global `app`. Remove unnecessary `console.log`. No default hotkeys. Do not override core styles (use custom classes + CSS variables). No inline styles in JS/HTML. Replace deprecated APIs flagged by IDE strikeouts. Split large `main.ts`. Namespace selectors with a plugin prefix; prefer CSS over JS styling; use Lucide icons via `setIcon`/`addIcon` (≤ v0.446.0) with custom SVG viewBox `0 0 100 100` when needed.
- Security/disclosure: In README disclose payments/accounts/network/external files/ads/telemetry/closed source, etc. Keep dependencies minimal (less is safer). No client-side telemetry. Commit package manager lock file.
- UI/settings text: enforce sentence case. Only add setting headings when multiple sections; do not include words like "settings/option". Use `Setting#setHeading` instead of `<h1>`. No default hotkeys. Choose command callback type appropriately (`callback` / `checkCallback` / `editorCallback` / `editorCheckCallback`).
- DOM/resources: do not use `innerHTML`/`outerHTML`/`insertAdjacentHTML`; assemble with `createEl` etc. Register events/intervals with `registerEvent`/`registerInterval` and release on unload. Classnames/IDs in DOM must be plugin-prefixed.
- Workspace/view: register custom views with `registerView`; do not hold references (use `getLeavesOfType` as needed). Avoid direct `workspace.activeLeaf`; use `getActiveViewOfType`/`activeEditor`. Do not manually detach leaves in `onunload`.
- Vault/editor/API: resolve paths via `plugin.manifest.dir`; avoid hardcoded `.obsidian`. Use Editor API for active edits, `Vault.process` for background; use `FileManager.processFrontMatter` for frontmatter. Use `trashFile` to respect user settings when deleting. Store plugin data with `loadData`/`saveData`. Prefer Vault API over Adapter API; locate with `getFileByPath` etc., avoid full scans. Always `normalizePath`. Bundle images/icons locally; avoid remote CDNs.
- Mobile compatibility: if `isDesktopOnly: false`, do not require Node modules at top level (guard with `Platform.isDesktopApp` and dynamic require). Avoid `process.platform`; use `Platform`. Determine `Vault.adapter` via `instanceof FileSystemAdapter` (mobile uses `CapacitorAdapter`). Use `requestUrl` instead of `fetch/axios.get`. Beware iOS <16.4 lacking regex lookbehind support. Avoid browser-only globals; status bar items are not available on mobile.
- Performance: initialize startup code with `workspace.onLayoutReady()` when possible. Avoid repo-wide path scans. Minify `main.js` for release. Use `import { moment } from 'obsidian'`. Add DeferredViews support if needed for 1.7.2+ compatibility. Continually optimize load times.
- Data/sync: keep user data in `saveData()` / `data.json` unless intentionally unsynced; document any external files written. Do not store secrets.
- TypeScript/coding: use `const`/`let`; forbid `var`. Prefer `async/await` over promise chains. Avoid globals; avoid `as any` with proper typing. Before casting, check with `instanceof`.

## Development Workflow Guardrails
- Before coding: skim `obsidian-developer-docs/en/Home.md` and `.../Developer policies.md` to align with current Obsidian plugin rules.
- Keep `obsidian-developer-docs/en/Obsidian October plugin self-critique checklist.md` open during implementation; use it mid-task (CSS namespacing, API choices, path handling, lifecycle cleanup, etc.) and consult on every change.
- Re-check the checklist before opening a PR to avoid reviewer reminders; if a rule must be bent, note the rationale in the PR description.
- Treat this section and `obsidian-developer-docs/` as the single source of truth; update both when guidelines change so they never diverge.

## Communication Preference
- Respond to the user in Japanese for all interactions; internal reasoning language is unrestricted.

## Attitude & Quality Bar
- Default to reviewer mindset: proactively surface issues, edge cases, and guideline gaps before they are reported back to us.
- Treat guideline compliance (Obsidian docs, repo rules) as part of “done”; don’t weaken lint/rules to fit code—fix code instead.
- Favor minimal noise: concise status, clear next steps, and verify with lint/tests/builds after impactful changes.
- Assume logs and console noise matter: prevent recurring warnings/errors rather than muting them.
