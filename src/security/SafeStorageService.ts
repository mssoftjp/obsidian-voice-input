import { Platform } from 'obsidian';
import { getLogger, Logger } from '../utils';

const PREFIX = 'SAFE_V1::';
const LEGACY_XOR = 'XOR_V1::';
const LEGACY_PLAIN = 'PLAIN::';
const FIXED_KEY = 'voice-input-obsidian-2025';

interface ElectronSafeStorage {
    isEncryptionAvailable(): boolean;
    encryptString(plainText: string): Buffer;
    decryptString(encrypted: Buffer): string;
}

interface ElectronRemote {
    safeStorage?: ElectronSafeStorage;
}

interface ElectronRenderer {
    safeStorage?: ElectronSafeStorage;
    remote?: ElectronRemote;
}

interface ElectronWindow extends Window {
    require?: (moduleName: string) => ElectronRenderer;
    electron?: ElectronRenderer;
}

interface ElectronGlobal {
    electron?: ElectronRenderer;
}

const isElectronWindow = (win: Window): win is ElectronWindow => {
    return 'require' in win && typeof (win as ElectronWindow).require === 'function';
};

const resolveElectronRenderer = (): ElectronRenderer | null => {
    if (isElectronWindow(window)) {
        const electronWindow = window as ElectronWindow;
        const requireFn = electronWindow.require;
        if (typeof requireFn === 'function') {
            return requireFn('electron') ?? null;
        }
        if (electronWindow.electron) {
            return electronWindow.electron ?? null;
        }
    }
    const windowElectron = (window as ElectronWindow).electron;
    if (windowElectron) {
        return windowElectron ?? null;
    }
    return (globalThis as ElectronGlobal).electron ?? null;
};

export class SafeStorageService {
    private static safeStorage: ElectronSafeStorage | null = null;
    private static logger: Logger = getLogger('SafeStorageService');

    /** safeStorageの遅延初期化 */
    private static getSafeStorage() {
        if (!this.safeStorage) {
            try {
                // モバイル環境チェック
                if (Platform.isMobileApp) {
                    this.logger.debug('Running on mobile, safeStorage not available');
                    return null;
                }

                // Obsidianのelectron環境からsafeStorageを取得
                this.logger.debug('Checking for Electron environment');
                this.logger.debug(`window.require exists: ${'require' in window}`);
                this.logger.debug(`window.require is function: ${typeof (window as ElectronWindow).require === 'function'}`);

                const electron = resolveElectronRenderer();

                if (!electron) {
                    this.logger.debug('Electron renderer not available');
                } else {
                    this.logger.debug(`Electron object exists: ${!!electron}`);
                    this.logger.debug(`Electron.remote exists: ${!!electron?.remote}`);
                    this.logger.debug(`Electron.safeStorage exists: ${!!electron?.safeStorage}`);
                    this.logger.debug(`Electron.remote.safeStorage exists: ${!!electron?.remote?.safeStorage}`);

                    this.safeStorage = electron?.remote?.safeStorage || electron?.safeStorage || null;
                }

                this.logger.debug(`SafeStorage initialized: ${!!this.safeStorage}`);
            } catch (e) {
                this.logger.error('Error during safeStorage initialization', e instanceof Error ? e : new Error(String(e)));
            }
        }
        return this.safeStorage;
    }

    /** 暗号化して保存用文字列へ変換 */
    static encryptForStore(apiKey: string): string {
        if (!apiKey) return '';

        // Trim the API key before storing
        const trimmedKey = apiKey.trim();
        if (!trimmedKey) return '';

        this.logger.debug('Encrypting API key for storage');

        const safeStorage = this.getSafeStorage();
        if (safeStorage?.isEncryptionAvailable?.()) {
            try {
                const buf = safeStorage.encryptString(trimmedKey);
                const encrypted = PREFIX + buf.toString('base64');
                this.logger.debug('API key encrypted using SafeStorage');
                return encrypted;
            } catch (e) {
                this.logger.warn('SafeStorage encryption failed, using fallback', { error: e instanceof Error ? e.message : String(e) });
            }
        } else {
            this.logger.debug('SafeStorage not available, using XOR fallback');
        }
        // フォールバック
        const encrypted = this.xorEncrypt(trimmedKey, FIXED_KEY);
        const result = LEGACY_XOR + encrypted;
        this.logger.debug('API key encrypted using XOR fallback');
        return result;
    }

    /** 保存文字列 -> 平文 API キー */
    static decryptFromStore(stored: string): string {
        if (!stored) return '';

        this.logger.debug('Decrypting stored API key');

        // 新方式
        if (stored.startsWith(PREFIX)) {
            const safeStorage = this.getSafeStorage();
            if (safeStorage?.decryptString) {
                const b64 = stored.slice(PREFIX.length);
                try {
                    const decrypted = safeStorage.decryptString(Buffer.from(b64, 'base64'));
                    this.logger.debug('API key decrypted using SafeStorage');
                    return decrypted;
                } catch (e) {
                    this.logger.error('SafeStorage decryption failed', e instanceof Error ? e : new Error(String(e)));
                    return '';
                }
            }
        }

        if (stored.startsWith(LEGACY_XOR)) {
            const encrypted = stored.substring(LEGACY_XOR.length);
            try {
                const decrypted = this.xorDecrypt(encrypted, FIXED_KEY);
                this.logger.debug('API key decrypted using XOR fallback');
                return decrypted;
            } catch (e) {
                this.logger.error('XOR decryption failed', e instanceof Error ? e : new Error(String(e)));
                return '';
            }
        }

        // 平文
        if (stored.startsWith(LEGACY_PLAIN)) {
            return stored.replace(LEGACY_PLAIN, '');
        }

        // 平文のAPIキー（sk-で始まる）をそのまま返す（後方互換性）
        if (stored.startsWith('sk-') && stored.length > 40) {
            return stored;
        }

        return '';
    }

    private static xorEncrypt(text: string, key: string): string {
        let result = '';
        for (let i = 0; i < text.length; i++) {
            result += String.fromCharCode(
                text.charCodeAt(i) ^ key.charCodeAt(i % key.length)
            );
        }
        return btoa(result);
    }

    private static xorDecrypt(encoded: string, key: string): string {
        try {
            const text = atob(encoded);
            let result = '';
            for (let i = 0; i < text.length; i++) {
                result += String.fromCharCode(
                    text.charCodeAt(i) ^ key.charCodeAt(i % key.length)
                );
            }
            return result;
        } catch (e) {
            this.logger.error('XOR decryption failed', e instanceof Error ? e : new Error(String(e)));
            return '';
        }
    }
}
