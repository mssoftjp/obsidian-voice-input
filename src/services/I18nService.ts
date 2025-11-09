/**
 * 国際化（i18n）サービスの実装
 *
 * CLAUDE.md の哲学に従った実装:
 * - 型安全な翻訳キーアクセス
 * - パフォーマンスを考慮したキャッシング
 * - 拡張可能な設計
 */
import {
    I18nService,
    Locale,
    TranslationKey,
    DEFAULT_LOCALE,
    SUPPORTED_LOCALES
} from '../interfaces';
import { translations } from '../i18n';
import { createServiceLogger } from './ServiceLocator';
import { Logger } from '../utils';

export class I18nServiceImpl implements I18nService {
    private currentLocale: Locale = DEFAULT_LOCALE;
    private localeChangeCallbacks: Set<(locale: Locale) => void> = new Set();
    private logger: Logger;
    private translationCache: Map<string, string> = new Map();

    constructor(initialLocale?: Locale) {
        this.logger = createServiceLogger('I18nService');
        if (initialLocale && SUPPORTED_LOCALES.includes(initialLocale)) {
            this.currentLocale = initialLocale;
        }
    }

    getCurrentLocale(): Locale {
        return this.currentLocale;
    }

    setLocale(locale: Locale): void {
        if (!SUPPORTED_LOCALES.includes(locale)) {
            this.logger.warn('Unsupported locale, falling back to default', {
                requestedLocale: locale,
                fallbackLocale: DEFAULT_LOCALE,
                supportedLocales: SUPPORTED_LOCALES
            });
            locale = DEFAULT_LOCALE;
        }

        if (this.currentLocale !== locale) {
            this.currentLocale = locale;
            this.translationCache.clear(); // Clear cache on locale change
            this.notifyLocaleChange(locale);
        }
    }

    t(key: TranslationKey, params?: Record<string, string | number>): string {
    // Check cache first
        const cacheKey = `${this.currentLocale}:${key}:${JSON.stringify(params || {})}`;
        if (this.translationCache.has(cacheKey)) {
            const cached = this.translationCache.get(cacheKey);
            return cached !== undefined ? cached : key;
        }

        // Get translation
        let translation = this.getTranslation(key, this.currentLocale);

        // Fallback to English if not found
        if (!translation && this.currentLocale !== 'en') {
            translation = this.getTranslation(key, 'en');
        }

        // Fallback to key if still not found
        if (!translation) {
            this.logger.warn('Translation not found for key', {
                key,
                currentLocale: this.currentLocale,
                hasEnglishFallback: this.currentLocale !== 'en'
            });
            translation = key;
        }

        // Apply parameter substitution
        if (params) {
            translation = this.substituteParams(translation, params);
        }

        // Cache the result
        this.translationCache.set(cacheKey, translation);

        return translation;
    }

    getAvailableLocales(): readonly Locale[] {
        return SUPPORTED_LOCALES;
    }

    onLocaleChange(callback: (locale: Locale) => void): void {
        this.localeChangeCallbacks.add(callback);
    }

    offLocaleChange(callback: (locale: Locale) => void): void {
        this.localeChangeCallbacks.delete(callback);
    }

    /**
   * Get translation from resource by key path
   */
    private getTranslation(key: string, locale: Locale): string | undefined {
        const resource = translations[locale];
        if (!resource) return undefined;

        // Navigate through the object using the key path
        const keys = key.split('.');
        let current: unknown = resource;

        for (const k of keys) {
            if (current && typeof current === 'object' && current !== null && k in current) {
                current = (current as Record<string, unknown>)[k];
            } else {
                return undefined;
            }
        }

        return typeof current === 'string' ? current : undefined;
    }

    /**
   * Substitute parameters in translation string
   * Supports {paramName} syntax
   */
    private substituteParams(translation: string, params: Record<string, string | number>): string {
        return translation.replace(/{(\w+)}/g, (match, captured) => {
            const paramKey = captured as keyof typeof params;
            const value = params[paramKey];
            return value !== undefined ? value.toString() : match;
        });
    }

    /**
   * Notify all registered callbacks about locale change
   */
    private notifyLocaleChange(locale: Locale): void {
        this.localeChangeCallbacks.forEach(callback => {
            try {
                callback(locale);
            } catch (error) {
                this.logger.error('Error in locale change callback', error);
            }
        });
    }
}

/**
 * Create a singleton instance
 */
let i18nServiceInstance: I18nServiceImpl | null = null;

export function getI18nService(): I18nServiceImpl {
    if (!i18nServiceInstance) {
        i18nServiceInstance = new I18nServiceImpl();
    }
    return i18nServiceInstance;
}

/**
 * Helper function for translations
 */
export function t(key: TranslationKey, params?: Record<string, string | number>): string {
    return getI18nService().t(key, params);
}
