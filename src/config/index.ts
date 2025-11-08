/**
 * 設定ファイルの統合エクスポート
 * すべての設定定数、デフォルト値、コスト情報をまとめて提供
 */

// 定数のエクスポート
export * from './constants';
export {
    AUDIO_CONSTANTS,
    VAD_CONSTANTS,
    VISUALIZATION_CONSTANTS,
    API_CONSTANTS,
    FILE_CONSTANTS,
    UI_CONSTANTS
} from './constants';

// デフォルト値のエクスポート
export * from './defaults';
export {
    DEFAULT_AUDIO_SETTINGS,
    DEFAULT_VAD_SETTINGS,
    DEFAULT_TRANSCRIPTION_SETTINGS,
    DEFAULT_USER_SETTINGS
} from './defaults';

// Message constants have been migrated to i18n system
// See src/i18n/ for translations

// コスト情報のエクスポート
export * from './costs';
export {
    TRANSCRIPTION_MODEL_COSTS,
    CostCalculator,
    COST_DISPLAY
} from './costs';

/**
 * 設定ヘルパー関数
 * @deprecated 現在未使用 - 将来の拡張用に保持
 */
export const ConfigHelper = {
    /**
   * ユーザー設定とデフォルト設定をマージ
   * @param userSettings ユーザーの設定
   * @param defaults デフォルト設定
   * @returns マージされた設定
   */
    mergeWithDefaults<T extends Record<string, unknown>>(
        userSettings: Partial<T>,
        defaults: T
    ): T {
        return {
            ...defaults,
            ...userSettings,
            // ネストされたオブジェクトも再帰的にマージ
            ...Object.keys(defaults).reduce((acc, key) => {
                if (
                    typeof defaults[key] === 'object' &&
          defaults[key] !== null &&
          !Array.isArray(defaults[key]) &&
          userSettings[key]
                ) {
                    (acc as Record<string, unknown>)[key] = this.mergeWithDefaults(userSettings[key], defaults[key]);
                }
                return acc;
            }, {} as Partial<T>)
        };
    },

    /**
   * 設定値の検証
   * @param value 検証する値
   * @param min 最小値
   * @param max 最大値
   * @returns 検証済みの値
   */
    validateNumber(value: number, min: number, max: number): number {
        if (isNaN(value)) {
            throw new Error('Value must be a number');
        }
        return Math.max(min, Math.min(max, value));
    },

    /**
   * 設定値が有効な範囲内かチェック
   * @param settings 設定オブジェクト
   * @returns エラーメッセージの配列（エラーがない場合は空配列）
   */
    validateSettings(settings: Record<string, unknown>): string[] {
        const errors: string[] = [];

        // 音声設定の検証
        if (settings.autoStopSilenceDuration !== undefined) {
            const value = settings.autoStopSilenceDuration as number;
            if (typeof value === 'number' && (value < 100 || value > 10000)) {
                errors.push('Auto stop duration must be between 100ms and 10000ms');
            }
        }

        // VAD設定の検証
        if (settings.minSpeechDuration !== undefined) {
            const value = settings.minSpeechDuration as number;
            if (typeof value === 'number' && (value < 50 || value > 5000)) {
                errors.push('Minimum speech duration must be between 50ms and 5000ms');
            }
        }

        return errors;
    },

    /**
   * 環境変数から設定を読み込み
   * @param envPrefix 環境変数のプレフィックス
   * @returns 環境変数から読み込んだ設定
   */
    loadFromEnv(envPrefix = 'VOICE_TRANSCRIPTION_'): Record<string, unknown> {
        const config: Record<string, unknown> = {};

        // ブラウザ環境では環境変数は使用できないため、空オブジェクトを返す
        if (typeof process === 'undefined' || !process.env) {
            return config;
        }

        Object.keys(process.env).forEach(key => {
            if (key.startsWith(envPrefix)) {
                const configKey = key
                    .substring(envPrefix.length)
                    .toLowerCase()
                    .replace(/_/g, '.');

                let value: string | number | boolean = process.env[key] || '';

                // 型変換の試行
                if (value === 'true') value = true;
                else if (value === 'false') value = false;
                else if (!isNaN(Number(value))) value = Number(value);

                // ネストされたキーの処理
                const keys = configKey.split('.');
                let current: Record<string, unknown> = config;

                for (let i = 0; i < keys.length - 1; i++) {
                    if (!current[keys[i]]) {
                        current[keys[i]] = {};
                    }
                    current = current[keys[i]] as Record<string, unknown>;
                }

                current[keys[keys.length - 1]] = value;
            }
        });

        return config;
    }
} as const;

// ConfigHelperは現在未使用のため、必要になったらエクスポートを追加
