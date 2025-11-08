/**
 * Type definitions for Obsidian internal APIs
 * These extend the official Obsidian API types to include internal/undocumented APIs
 */

import { App, Vault, getLanguage, moment } from 'obsidian';

/**
 * Extended App interface with internal properties
 */
export interface AppInternal extends App {
    setting?: {
        open(): void;
        openTabById(id: string): void;
    };
    locale?: string;
    vault: VaultInternal;
}

/**
 * Extended Vault interface with internal config
 */
export interface VaultInternal extends Vault {
    config?: {
        locale?: string;
    };
}

/**
 * WebKit Audio Context for cross-browser compatibility
 */
export interface WindowWithWebkitAudio extends Window {
    webkitAudioContext?: new (options?: AudioContextOptions) => AudioContext;
}

/**
 * Type guard to check if app has internal setting API
 */
export function hasInternalSettingAPI(app: App): app is AppInternal {
    return 'setting' in app && typeof (app as AppInternal).setting?.open === 'function';
}

/**
 * Safely get Obsidian locale with fallbacks
 */
export function getObsidianLocale(app: App): string {
    try {
        const apiLocale = getLanguage?.();
        if (apiLocale && apiLocale.trim().length > 0) {
            return apiLocale.toLowerCase();
        }
    } catch (error) {
        // Fallback to legacy heuristics if the API call fails for any reason
        console.warn('[voice-input] Failed to resolve locale via getLanguage()', error);
    }

    const appInternal = app as AppInternal;

    // Try to get locale from app configuration first
    const locale = appInternal.vault?.config?.locale ||
                   appInternal.locale ||
                   moment.locale() ||  // Use Obsidian's provided moment instance
                   'en';
    return locale.toLowerCase();
}
