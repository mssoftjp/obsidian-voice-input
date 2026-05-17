import { SafeStorageService } from '../../../src/security/SafeStorageService';

describe('SafeStorageService', () => {
    test('round-trips API keys through the fallback store format without browser base64 APIs', () => {
        const apiKey = 'sk-proj-test-key-abcdefghijklmnopqrstuvwxyz1234567890';

        const stored = SafeStorageService.encryptForStore(apiKey);
        expect(stored).toMatch(/^XOR_V1::/u);
        expect(SafeStorageService.decryptFromStore(stored)).toBe(apiKey);
    });
});
