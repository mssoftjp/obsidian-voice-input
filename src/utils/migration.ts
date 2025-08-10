import { CorrectionEntry, CorrectionEntryLegacy } from '../interfaces';

/**
 * データマイグレーション関数
 * 旧形式の補正エントリを新形式に変換する
 */
export function migrateCorrectionEntries(
    entries: (CorrectionEntry | CorrectionEntryLegacy)[]
): CorrectionEntry[] {
    return entries.map(entry => {
        if (Array.isArray(entry.from)) {
            // 既に新形式の場合
            return entry as CorrectionEntry;
        } else {
            // 旧形式から変換
            const legacyEntry = entry as CorrectionEntryLegacy;
            return {
                from: [legacyEntry.from],
                to: legacyEntry.to
                // categoryは削除、priorityも削除
            };
        }
    });
}

/**
 * UI表示用：パターン配列を文字列に変換
 */
export function patternsToString(patterns: string[]): string {
    return patterns.join(', ');
}

/**
 * UI入力用：文字列をパターン配列に変換
 */
export function stringToPatterns(input: string): string[] {
    return input ? input.split(',').map(s => s.trim()).filter(s => s) : [];
}
