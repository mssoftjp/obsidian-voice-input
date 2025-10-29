import { App, FileSystemAdapter, normalizePath } from 'obsidian';
import { SpeechSegment } from '../../interfaces';
import { VAD_CONSTANTS, DEFAULT_VAD_SETTINGS, FILE_CONSTANTS } from '../../config';
import { Disposable } from '../../interfaces';
import { FvadModule, FvadModuleFactory, WindowWithFvad, hasFvadModule } from '../../types';
import { createServiceLogger } from '../../services';
import { Logger } from '../../utils';

export interface VADSegment {
    start: number;
    end: number;
    audioData: Float32Array;
}

export interface VADProcessorOptions {
    vadMode?: 0 | 1 | 2 | 3;
    minSpeechDuration?: number;
    minSilenceDuration?: number;
    speechPadding?: number;
}

// WebRTC VAD の型定義は別ファイルに移動

/**
 * WebRTC VAD プロセッサー
 * Google WebRTC プロジェクトの VAD アルゴリズムを使用した高精度な音声検出
 * 
 * CLAUDE.md の哲学に従った実装:
 * - 根本的な解決: 実証済みの WebRTC VAD を使用
 * - 汎用的な設計: 将来の拡張を考慮した interface
 * - 型安全性: TypeScript の型システムを活用
 * - エラーハンドリング: 適切なエラー処理とリソース管理
 */
export class VADProcessor extends Disposable {
    private fvadModule: FvadModule | null = null;
    private vadInstance: number | null = null;
    private bufferPtr: number | null = null;
    private readonly frameSize: number = VAD_CONSTANTS.FRAME_SIZE; // 30ms at 16kHz (WebRTC VAD requirement)
    private readonly sampleRate: number = VAD_CONSTANTS.SAMPLE_RATE; // WebRTC VAD requires 16kHz
    private logger: Logger;
    
    // 設定可能なパラメータ
    private vadMode: 0 | 1 | 2 | 3;
    private minSpeechDuration: number; // ms
    private minSilenceDuration: number; // ms
    private speechPadding: number; // ms
    
    // 自動調整用パラメータ
    private autoAdjust: boolean = DEFAULT_VAD_SETTINGS.autoAdjust;
    private noiseLevel: number = 0;
    private recentFalsePositives: number = 0;
    private recentFalseNegatives: number = 0;
    private adjustmentCounter: number = 0;
    
    constructor(
        private app: App,
        options: VADProcessorOptions = {}
    ) {
        super();
        this.logger = createServiceLogger('VADProcessor');
        this.vadMode = options.vadMode ?? DEFAULT_VAD_SETTINGS.mode;
        this.minSpeechDuration = options.minSpeechDuration ?? DEFAULT_VAD_SETTINGS.minSpeechDuration;
        this.minSilenceDuration = options.minSilenceDuration ?? DEFAULT_VAD_SETTINGS.minSilenceDuration;
        this.speechPadding = options.speechPadding ?? DEFAULT_VAD_SETTINGS.speechPadding;
    }

    async initialize(): Promise<void> {
        this.throwIfDisposed();
        
        // App インスタンスの検証
        if (!this.app) {
            throw new Error('App instance is required for WebRTC VAD');
        }
        
        try {
            this.logger.info('Initializing WebRTC VAD processor', {
                vadMode: this.vadMode,
                minSpeechDuration: this.minSpeechDuration,
                minSilenceDuration: this.minSilenceDuration,
                frameSize: this.frameSize,
                sampleRate: this.sampleRate
            });
            
            // WASM ファイルを読み込む
            const wasmBuffer = await this.loadWasmFile();
            this.logger.debug('WASM file loaded', { size: wasmBuffer.byteLength });
            
            // fvad モジュールを初期化
            await this.initializeFvadModule(wasmBuffer);
            
            // VAD インスタンスを作成して設定
            await this.createAndConfigureVAD();
            
            this.logger.info('WebRTC VAD processor initialized successfully');
            
        } catch (error) {
            this.logger.error('WebRTC VAD initialization error', error);
            // リソースをクリーンアップ
            this.destroy();
            throw error;
        }
    }

    /**
     * fvad モジュールを初期化
     */
    private async initializeFvadModule(wasmBuffer: ArrayBuffer): Promise<void> {
        // スクリプトタグを使用して fvad.js を読み込む
        // これは Obsidian の制限された環境でモジュールを読み込む最も確実な方法
        this.ensureFileSystemAdapter();
        
        // グローバルオブジェクトを準備（型安全に）
        const globalWindow = window as WindowWithFvad;
        
        // fvad.js の内容を読み込んで評価（プラグインルートから）
        const fvadJsPath = this.getPluginAssetPath('fvad.js');
        const fvadJsContent = await this.readPluginTextAsset('fvad.js');
        
        // モジュールを評価するための一時的な環境を作成
        return new Promise((resolve, reject) => {
            // スクリプトタグを作成
            const script = document.createElement('script');
            script.type = 'module';
            script.textContent = `
                // import.meta.url のポリフィル
                const importMeta = { url: 'file:///${fvadJsPath}' };
                
                // fvad モジュールを定義
                ${fvadJsContent}
                
                // グローバルに公開
                window.__fvadModule = fvad;
            `;
            
            // エラーハンドリング
            script.onerror = (error) => {
                this.logger.error('WebRTC VAD script loading error', error);
                reject(new Error('Failed to load fvad.js'));
            };
            
            // スクリプトを実行
            document.head.appendChild(script);
            
            // モジュールが読み込まれるのを待つ
            setTimeout(async () => {
                try {
                    if (!hasFvadModule(globalWindow)) {
                        throw new Error('fvad module not found in global scope');
                    }
                    
                    const createModule = globalWindow.__fvadModule;
                    this.logger.debug('fvad module loaded from global scope');
                    
                    // WebAssembly モジュールを初期化
                    this.fvadModule = await createModule!({
                        wasmBinary: new Uint8Array(wasmBuffer),
                        instantiateWasm: (
                            imports: WebAssembly.Imports, 
                            successCallback: (instance: WebAssembly.Instance) => void
                        ) => {
                            WebAssembly.instantiate(new Uint8Array(wasmBuffer), imports)
                                .then((result) => {
                                    successCallback(result.instance);
                                })
                                .catch((error) => {
                                    this.logger.error('WebRTC VAD WASM instantiation error', error);
                                    reject(error);
                                });
                            return {};
                        }
                    });
                    
                    // クリーンアップ
                    document.head.removeChild(script);
                    delete globalWindow.__fvadModule;
                    
                    resolve();
                } catch (error) {
                    reject(error);
                }
            }, 100); // モジュール読み込みを待つ
        });
    }

    /**
     * VAD インスタンスを作成して設定
     */
    private async createAndConfigureVAD(): Promise<void> {
        if (!this.fvadModule) {
            throw new Error('fvad module not initialized');
        }
        
        // VAD インスタンスを作成
        this.vadInstance = this.fvadModule._fvad_new();
        if (!this.vadInstance) {
            throw new Error('Failed to create VAD instance');
        }
        this.logger.debug('VAD instance created');
        
        // サンプルレートを設定（16kHz 固定）
        const sampleRateResult = this.fvadModule._fvad_set_sample_rate(this.vadInstance, this.sampleRate);
        if (sampleRateResult !== 0) {
            throw new Error('Failed to set sample rate');
        }
        
        // VAD モードを設定
        const modeResult = this.fvadModule._fvad_set_mode(this.vadInstance, this.vadMode);
        if (modeResult !== 0) {
            throw new Error(`Failed to set VAD mode: ${this.vadMode}`);
        }
        
        // 処理用バッファを事前確保
        this.bufferPtr = this.fvadModule._malloc(this.frameSize * 2); // 2 bytes per sample (Int16)
        if (!this.bufferPtr) {
            throw new Error('Failed to allocate buffer');
        }
    }

    /**
     * WASM ファイルを読み込む
     */
    private async loadWasmFile(): Promise<ArrayBuffer> {
        this.ensureFileSystemAdapter();
        return this.readPluginBinaryAsset('fvad.wasm');
    }

    private ensureFileSystemAdapter(): FileSystemAdapter {
        const adapter = this.app.vault.adapter;
        if (!(adapter instanceof FileSystemAdapter)) {
            throw new Error('WebRTC VAD requires FileSystemAdapter (desktop version)');
        }
        return adapter;
    }

    private getPluginAssetBasePath(): string {
        return normalizePath(`${this.app.vault.configDir}/plugins/${FILE_CONSTANTS.PLUGIN_ID}`);
    }

    private getPluginAssetPath(fileName: string): string {
        return normalizePath(`${this.getPluginAssetBasePath()}/${fileName}`);
    }

    private async readPluginTextAsset(fileName: string): Promise<string> {
        const fullPath = this.getPluginAssetPath(fileName);
        const existingFile = this.app.vault.getFileByPath(fullPath);
        if (existingFile) {
            return this.app.vault.read(existingFile);
        }

        const adapter = this.ensureFileSystemAdapter();
        const exists = await adapter.exists(fullPath);
        if (!exists) {
            throw new Error(`Asset not found: ${fullPath}`);
        }
        return adapter.read(fullPath);
    }

    private async readPluginBinaryAsset(fileName: string): Promise<ArrayBuffer> {
        const fullPath = this.getPluginAssetPath(fileName);
        const existingFile = this.app.vault.getFileByPath(fullPath);
        if (existingFile) {
            return this.app.vault.readBinary(existingFile);
        }

        const adapter = this.ensureFileSystemAdapter();
        const exists = await adapter.exists(fullPath);
        if (!exists) {
            throw new Error(`Asset not found: ${fullPath}`);
        }
        return adapter.readBinary(fullPath);
    }

    /**
     * ノイズレベルを分析して VAD モードを自動調整
     */
    private analyzeAndAdjustVAD(audioData: Float32Array): void {
        if (!this.autoAdjust) return;
        
        // RMS (Root Mean Square) でノイズレベルを計算
        let sum = 0;
        for (let i = 0; i < audioData.length; i++) {
            sum += audioData[i] * audioData[i];
        }
        const rms = Math.sqrt(sum / audioData.length);
        
        // 指数移動平均でノイズレベルを更新
        this.noiseLevel = this.noiseLevel * VAD_CONSTANTS.NOISE_LEVEL_EMA.PREVIOUS + rms * VAD_CONSTANTS.NOISE_LEVEL_EMA.CURRENT;
        
        // 調整カウンターをインクリメント
        this.adjustmentCounter++;
        if (this.adjustmentCounter >= VAD_CONSTANTS.ADJUSTMENT_INTERVAL) {
            this.adjustmentCounter = 0;
            
            // ノイズレベルに基づいて VAD モードを調整
            if (this.noiseLevel > VAD_CONSTANTS.NOISE_THRESHOLDS.NOISY) {
                // 騒音が多い環境 → 低感度
                this.vadMode = 0;
            } else if (this.noiseLevel > VAD_CONSTANTS.NOISE_THRESHOLDS.NORMAL) {
                // 普通の環境 → 標準感度
                this.vadMode = 2;
            } else {
                // 静かな環境 → 高感度
                this.vadMode = 3;
            }
            
            // WebRTC VAD のモードを更新
            if (this.fvadModule && this.vadInstance) {
                this.fvadModule._fvad_set_mode(this.vadInstance, this.vadMode);
            }
        }
    }

    /**
     * 音声セグメントを検出
     */
    async detectSpeechSegments(audioData: Float32Array): Promise<VADSegment[]> {
        this.throwIfDisposed();
        if (!this.fvadModule || !this.vadInstance || !this.bufferPtr) {
            throw new Error('VAD not initialized');
        }

        // 自動調整を実行
        this.analyzeAndAdjustVAD(audioData);
        
        // 48kHz → 16kHz にリサンプリング（必要な場合）
        const resampledAudio = this.resampleAudio(audioData, VAD_CONSTANTS.INPUT_SAMPLE_RATE, this.sampleRate);
        this.logger.trace('Audio resampled', {
            inputSampleRate: VAD_CONSTANTS.INPUT_SAMPLE_RATE,
            outputSampleRate: this.sampleRate,
            inputLength: audioData.length,
            outputLength: resampledAudio.length
        });
        
        // Float32 → Int16 に変換
        const int16Audio = this.float32ToInt16(resampledAudio);
        
        // VAD でフレームごとに処理
        const frameDuration = (this.frameSize / this.sampleRate) * 1000; // ms
        const frameCount = Math.floor(int16Audio.length / this.frameSize);
        
        // 音声区間の検出結果を格納
        const vadResults: boolean[] = new Array(frameCount);
        
        // フレームごとに VAD を実行
        for (let i = 0; i < frameCount; i++) {
            const frameStart = i * this.frameSize;
            const frame = int16Audio.slice(frameStart, frameStart + this.frameSize);
            
            // バッファにコピー
            const bufferView = new Int16Array(this.fvadModule.HEAP16.buffer, this.bufferPtr, this.frameSize);
            bufferView.set(frame);
            
            // VAD 判定（1 = 音声, 0 = 無音）
            const isSpeech = this.fvadModule._fvad_process(this.vadInstance, this.bufferPtr, this.frameSize) === 1;
            vadResults[i] = isSpeech;
        }
        
        
        // 後処理: セグメントの統合とフィルタリング
        const processedSegments = this.postProcessSegments(vadResults, frameDuration, resampledAudio);
        
        this.logger.debug('VAD processing completed', {
            inputDuration: (audioData.length / this.sampleRate * 1000).toFixed(1),
            totalFrames: vadResults.length,
            speechFrames: vadResults.filter(v => v).length,
            segments: processedSegments.length
        });
        
        return processedSegments;
    }

    /**
     * セグメントの後処理
     * - 短い無音で分離されたセグメントを結合
     * - パディングを追加
     * - 最小セグメント長でフィルタ
     */
    private postProcessSegments(
        vadResults: boolean[],
        frameDuration: number,
        audioData: Float32Array
    ): VADSegment[] {
        const segments: VADSegment[] = [];
        let currentSegment: { start: number; end: number } | null = null;
        
        const minSilenceFrames = Math.ceil(this.minSilenceDuration / frameDuration);
        const minSpeechFrames = Math.ceil(this.minSpeechDuration / frameDuration);
        const paddingFrames = Math.ceil(this.speechPadding / frameDuration);
        
        let speechFrames = 0;
        let silenceFrames = 0;
        
        for (let i = 0; i < vadResults.length; i++) {
            if (vadResults[i]) {
                // 音声フレーム
                speechFrames++;
                silenceFrames = 0;
                
                if (!currentSegment && speechFrames >= minSpeechFrames) {
                    // 新しいセグメントの開始
                    const startFrame = Math.max(0, i - speechFrames + 1 - paddingFrames);
                    currentSegment = {
                        start: startFrame * frameDuration,
                        end: 0
                    };
                }
                
                if (currentSegment) {
                    // セグメントの終了時間を更新
                    currentSegment.end = Math.min(
                        (i + 1 + paddingFrames) * frameDuration,
                        (audioData.length / this.sampleRate) * 1000
                    );
                }
            } else {
                // 無音フレーム
                silenceFrames++;
                speechFrames = 0;
                
                if (currentSegment && silenceFrames >= minSilenceFrames) {
                    // セグメントの終了
                    segments.push(this.createSegment(currentSegment, audioData));
                    currentSegment = null;
                }
            }
        }
        
        // 最後のセグメントを処理
        if (currentSegment) {
            segments.push(this.createSegment(currentSegment, audioData));
        }
        
        return segments;
    }

    /**
     * Create a segment from current segment data
     */
    private createSegment(currentSegment: { start: number; end: number }, audioData: Float32Array): VADSegment {
        const startSample = Math.floor((currentSegment.start / 1000) * this.sampleRate);
        const endSample = Math.floor((currentSegment.end / 1000) * this.sampleRate);
        
        return {
            start: currentSegment.start,
            end: currentSegment.end,
            audioData: audioData.slice(startSample, endSample)
        };
    }

    /**
     * Float32 配列を Int16 配列に変換
     */
    private float32ToInt16(float32Array: Float32Array): Int16Array {
        const int16Array = new Int16Array(float32Array.length);
        for (let i = 0; i < float32Array.length; i++) {
            // クリッピングを含む変換
            const s = Math.max(-1, Math.min(1, float32Array[i]));
            int16Array[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
        }
        return int16Array;
    }

    /**
     * オーディオデータをリサンプリング
     */
    private resampleAudio(audioData: Float32Array, fromRate: number, toRate: number): Float32Array {
        if (fromRate === toRate) {
            return audioData;
        }
        
        const ratio = fromRate / toRate;
        const newLength = Math.floor(audioData.length / ratio);
        const resampled = new Float32Array(newLength);
        
        // 線形補間によるリサンプリング
        for (let i = 0; i < newLength; i++) {
            const srcIndex = i * ratio;
            const srcIndexInt = Math.floor(srcIndex);
            const srcIndexFrac = srcIndex - srcIndexInt;
            
            if (srcIndexInt + 1 < audioData.length) {
                // 線形補間
                resampled[i] = audioData[srcIndexInt] * (1 - srcIndexFrac) + 
                              audioData[srcIndexInt + 1] * srcIndexFrac;
            } else {
                resampled[i] = audioData[srcIndexInt];
            }
        }
        
        return resampled;
    }

    /**
     * VAD モードを設定
     */
    setMode(mode: 0 | 1 | 2 | 3): void {
        this.vadMode = mode;
        
        if (this.fvadModule && this.vadInstance) {
            const result = this.fvadModule._fvad_set_mode(this.vadInstance, mode);
            if (result !== 0) {
                this.logger.error(`Failed to set VAD mode (mode: ${mode}, result: ${result})`);
            }
        }
    }

    /**
     * 無音継続時間を設定
     */
    setSilenceDuration(duration: number): void {
        this.minSilenceDuration = duration;
    }

    /**
     * Disposableパターンの実装
     */
    protected onDispose(): void {
        if (this.fvadModule) {
            // バッファを解放
            if (this.bufferPtr !== null) {
                this.fvadModule._free(this.bufferPtr);
                this.bufferPtr = null;
            }
            
            // VAD インスタンスを解放
            if (this.vadInstance !== null) {
                this.fvadModule._fvad_free(this.vadInstance);
                this.vadInstance = null;
            }
            
            this.fvadModule = null;
        }
    }
    
    /**
     * 互換性のためのdestroyメソッド
     * @deprecated dispose()を使用してください
     */
    destroy(): void {
        this.dispose();
    }
}
