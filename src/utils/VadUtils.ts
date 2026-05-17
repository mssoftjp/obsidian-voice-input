import { App, normalizePath } from 'obsidian';
import { FILE_CONSTANTS } from '../config';

const FVAD_WASM = 'fvad.wasm';

function getPluginBasePath(app: App): string {
    return normalizePath(`${app.vault.configDir}/plugins/${FILE_CONSTANTS.PLUGIN_ID}`);
}

function getPluginAssetPath(app: App, fileName: string): string {
    return normalizePath(`${getPluginBasePath(app)}/${fileName}`);
}

export async function hasLocalVadAssets(app: App): Promise<boolean> {
    const adapter = app.vault.adapter;

    const baseDir = getPluginBasePath(app);
    const wasmCandidates = [
        getPluginAssetPath(app, FVAD_WASM),
        normalizePath(`${baseDir}/node_modules/@echogarden/fvad-wasm/${FVAD_WASM}`)
    ];

    return existsInCandidates(adapter, wasmCandidates);
}

export function getLocalVadInstructionsPath(app: App): string {
    return getPluginBasePath(app);
}

export function getLocalVadAssetPath(app: App, fileName: string): string {
    return getPluginAssetPath(app, fileName);
}

async function existsInCandidates(adapter: App['vault']['adapter'], paths: string[]): Promise<boolean> {
    for (const candidate of paths) {
        try {
            if (await adapter.exists(candidate)) {
                return true;
            }
        } catch {
            // Ignore individual errors and continue checking other candidates
        }
    }
    return false;
}
