import { ObsidianHttpClient } from '../utils/ObsidianHttpClient';
import { getI18n } from '../services';

export class SecurityUtils {
    /**
     * Mask API key for display purposes
     */
    static maskAPIKey(key: string): string {
        if (!key || key.length < 10) {
            return '';
        }
        return key.substring(0, 7) + '*'.repeat(40);
    }

    /**
     * Validate OpenAI API key format
     */
    static validateOpenAIAPIKey(key: string): boolean {
        // OpenAI API keys start with 'sk-' followed by alphanumeric characters
        // More flexible pattern to accommodate format changes
        return /^sk-[a-zA-Z0-9\-_]{20,}$/.test(key);
    }

    /**
     * Sanitize user input to prevent injection attacks
     */
    static sanitizeInput(input: string): string {
        // Remove potentially dangerous characters
        return input
            .replace(/[<>]/g, '')
            .replace(/javascript:/gi, '')
            .replace(/on\w+\s*=/gi, '')
            .trim();
    }

    /**
     * Validate URL format
     */
    static isValidURL(url: string): boolean {
        try {
            const urlObj = new URL(url);
            return urlObj.protocol === 'https:' || urlObj.protocol === 'http:';
        } catch {
            return false;
        }
    }

    /**
     * Remove sensitive information from error messages
     */
    static sanitizeErrorMessage(message: string): string {
        // Remove API keys, tokens, and URLs that might contain sensitive data
        return message
            .replace(/sk-[a-zA-Z0-9]{48}/g, '[API_KEY_REMOVED]')
            .replace(/Bearer\s+[a-zA-Z0-9\-._~+/]+=*/g, '[TOKEN_REMOVED]')
            .replace(/https?:\/\/[^\s]+/g, '[URL_REMOVED]');
    }

    /**
     * Check if running in secure context (HTTPS or localhost)
     */
    static isSecureContext(): boolean {
        return window.isSecureContext;
    }

    /**
     * Test OpenAI API key by making a simple API call
     */
    static async testOpenAIAPIKey(apiKey: string): Promise<{ valid: boolean; error?: string }> {
        const i18n = getI18n();

        try {
            const { status } = await ObsidianHttpClient.request({
                url: 'https://api.openai.com/v1/models',
                method: 'GET',
                headers: { 'Authorization': `Bearer ${apiKey}` }
            });

            if (status >= 200 && status < 300) {
                return { valid: true };
            } else if (status === 401) {
                return { valid: false, error: i18n.t('error.api.unauthorized') };
            } else if (status === 429) {
                return { valid: false, error: i18n.t('error.api.rateLimited') };
            } else {
                return { valid: false, error: `${i18n.t('error.general.error')}: HTTP ${status}` };
            }
        } catch {
            return { valid: false, error: i18n.t('error.general.network') };
        }
    }
}
