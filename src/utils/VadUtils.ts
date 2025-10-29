import { App, normalizePath } from 'obsidian';
import { FILE_CONSTANTS } from '../config';

const FVAD_WASM = 'fvad.wasm';
const FVAD_JS = 'fvad.js';

function getPluginBasePath(app: App): string {
    return normalizePath(`${app.vault.configDir}/plugins/${FILE_CONSTANTS.PLUGIN_ID}`);
}

function getPluginAssetPath(app: App, fileName: string): string {
    return normalizePath(`${getPluginBasePath(app)}/${fileName}`);
}

export async function hasLocalVadAssets(app: App): Promise<boolean> {
    const adapter = app.vault.adapter;
    const wasmPath = getPluginAssetPath(app, FVAD_WASM);
    const jsPath = getPluginAssetPath(app, FVAD_JS);

    const [hasWasm, hasJs] = await Promise.all([
        adapter.exists(wasmPath),
        adapter.exists(jsPath)
    ]);

    return Boolean(hasWasm && hasJs);
}

export function getLocalVadInstructionsPath(app: App): string {
    return getPluginBasePath(app);
}
