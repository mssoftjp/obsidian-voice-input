/**
 * Type definitions for WebRTC VAD WebAssembly module
 */

/**
 * WebRTC VAD module interface
 */
export interface FvadModule {
    _fvad_new(): number;
    _fvad_free(handle: number): void;
    _fvad_set_mode(handle: number, mode: number): number;
    _fvad_set_sample_rate(handle: number, sampleRate: number): number;
    _fvad_process(handle: number, audioPtr: number, frameSize: number): number;
    _malloc(size: number): number;
    _free(ptr: number): void;
    HEAP16: { buffer: ArrayBuffer };
}

/**
 * WebAssembly module factory function
 */
export type FvadModuleFactory = (options?: {
    wasmBinary?: Uint8Array;
    instantiateWasm?: (
        imports: WebAssembly.Imports,
        successCallback: (instance: WebAssembly.Instance) => void
    ) => void;
}) => Promise<FvadModule>;

/**
 * Global window interface with fvad module
 */
export interface WindowWithFvad extends Window {
    __fvadModule?: FvadModuleFactory;
}

/**
 * Type guard to check if window has fvad module
 */
export function hasFvadModule(window: Window): window is WindowWithFvad {
    return '__fvadModule' in window && typeof (window as WindowWithFvad).__fvadModule === 'function';
}
