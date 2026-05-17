declare module '@echogarden/fvad-wasm' {
    interface FvadWasmModule {
        _fvad_new(): number;
        _fvad_free(handle: number): void;
        _fvad_set_mode(handle: number, mode: number): number;
        _fvad_set_sample_rate(handle: number, sampleRate: number): number;
        _fvad_process(handle: number, audioPtr: number, frameSize: number): number;
        _malloc(size: number): number;
        _free(ptr: number): void;
        HEAP16: { buffer: ArrayBuffer };
    }

    type FvadWasmModuleFactory = (options?: {
        wasmBinary?: Uint8Array;
    }) => Promise<FvadWasmModule>;

    const createFvadModule: FvadWasmModuleFactory;
    export default createFvadModule;
}
