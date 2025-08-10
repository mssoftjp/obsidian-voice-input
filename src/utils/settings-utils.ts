/**
 * Type-safe utilities for settings management
 */

import { VoiceInputSettings } from '../interfaces';

/**
 * Type-safe function to merge settings objects
 */
export function mergeSettings(
    target: VoiceInputSettings,
    source: Partial<VoiceInputSettings>
): void {
    (Object.keys(source) as Array<keyof VoiceInputSettings>).forEach(key => {
        const value = source[key];
        if (value !== undefined) {
            // Use index signature for type-safe assignment
            (target as Record<keyof VoiceInputSettings, unknown>)[key] = value;
        }
    });
}

/**
 * Check if a key exists in settings (including legacy keys)
 */
export function hasSettingsKey(
    obj: unknown,
    key: keyof VoiceInputSettings | string
): obj is Record<string, unknown> {
    return typeof obj === 'object' && obj !== null && key in obj;
}

/**
 * Type guard for partial settings objects
 */
export function isPartialSettings(obj: unknown): obj is Partial<VoiceInputSettings> {
    return typeof obj === 'object' && obj !== null;
}
