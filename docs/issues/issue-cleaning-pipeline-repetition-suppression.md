# 強化: 反復ハルシネーション抑制とクリーニング・パイプライン導入

問題: 現状のクリーニングはプロンプト断片やフォーマット除去にとどまり、ハルシネーションによる単語/句/文の機械的な繰り返し抑制が手薄。日本語に多い短語の連発、同一文の連続、列挙パターン (A, B, A, B …)、配信系アウトロ (末尾だけに現れる「ご視聴ありがとうございました」等) の混入に対する堅牢な処理が不足。

目的: 参照プロジェクト（obsidian-ai-transcriber）のパイプライン構造と安全装置を取り入れ、
- プロンプト混入除去
- 反復ハルシネーション抑制（短語/中長フレーズ/文/段落/列挙/末尾）
- 日本語テキスト品質の軽量バリデーション（任意）
を段階的・安全に実行する Cleaning Pipeline を導入する。

非目標:
- モデル選択や音声分割ロジックの変更なし
- UI トグル追加なし（常時オン）。設定は内部定数で集中管理

受け入れ基準 (Acceptance Criteria)
- 短語反復の抑制: 「はい。」「ありがとうございます。」等の連続出力が過剰でなくなる（適切に間引く）。
- 中長フレーズ反復: 5–10/10–20/20–30 文字帯のフレーズが設定回数以上繰り返される場合に削減される。
- 文重複の圧縮: 完全一致/高類似の連続文が閾値回数以上続く場合、1つに圧縮される。
- 列挙周期の圧縮: A, B, A, B, A, B … は「A, B」に圧縮される（区切り/句読点維持）。
- 配信系アウトロ等の末尾限定削除: 終端のみ一致した場合に限り削除される（本文中は保持）。
- 安全装置: 1パターン/1イテレーション/全体削減の上限を超える操作は自動スキップ or ロールバックされる。
- プロンプト混入: XML風タグ/文脈タグ/文頭の完全一致/スニペット一致の安全削除で混入を防ぐ。

タスク (Tasks)
- [ ] `src/config/CleaningConfig.ts` を追加: 言語別パターン、反復しきい値、安全閾値、文脈/タグパターンを集中管理
- [ ] `src/core/transcription/cleaning/` を追加: クリーナーとパイプライン実装
  - [ ] `interfaces.ts`: `TextCleaner`/`CleaningResult`/`CleaningPipeline` ほか
  - [ ] `StandardCleaningPipeline.ts`: 各クリーナーの逐次実行・計測・安全監視
  - [ ] `PromptContaminationCleaner.ts`: XML/文脈タグ、文頭一致、スニペット一致の優先度除去
  - [ ] `BaseHallucinationCleaner.ts`: 短語/中長フレーズ/文/段落/列挙/末尾の反復抑制 + 動的閾値 + 安全装置
- [ ] `src/core/transcription/TranscriptionService.ts` を差分最小で置換: 既存の `cleanGPT4oResponse` からパイプライン委譲へ
- [ ] テスト追加 `tests/unit/core/cleaning/**`
  - [ ] 短語反復（助詞保存/上限制限）
  - [ ] 中長フレーズ反復
  - [ ] 文重複（類似度あり）
  - [ ] 列挙圧縮（句読点保持）
  - [ ] 末尾アウトロ限定削除
  - [ ] 安全装置（削減率超過ロールバック）
- [ ] ロギング: クリーナー別の削減率/時間/警告を記録（既存 Logger を使用）

設計メモ（要点）
- 短語反復（日本語 1–4 文字）: 総文字数に応じて動的閾値。助詞は preserve/limit/reduce モードで過剰削除を抑制。残存比率を設定。
- 文重複: `/(?<=[。.!?！？?])\s*/` で分割し、正規化（句読点/空白除去、NFKC 等）＋類似度で閾値以上を圧縮。
- 列挙圧縮: 区切り（`、`/`,`）とパターン長 2..n/2 の完全周期一致を 1 サイクルへ圧縮。終端句読点は保持。
- 安全装置: `singlePatternMaxReduction`/`repetitionPatternMaxReduction`/`iterationReductionLimit`/`emergencyFallbackThreshold` 等。

---

以下は提案実装の抜粋（コード例）。

1) 設定: `src/config/CleaningConfig.ts`
```ts
export type ParticleMode = 'preserve' | 'limit' | 'reduce';

export interface SafetyThresholds {
  singleCleanerMaxReduction: number;
  singlePatternMaxReduction: number;
  repetitionPatternMaxReduction?: number;
  iterationReductionLimit?: number;
  emergencyFallbackThreshold: number;
  warningThreshold: number;
}

export interface RepetitionThresholds {
  baseThreshold: number;
  lengthFactor: number;
  dynamicThresholdDivisor: number;
  shortCharMinLength: number;
  shortCharMaxLength: number;
  shortCharKeepRatio: number;
  essentialParticles: string[];
  maxConsecutiveParticles: number;
  particleReductionMode: ParticleMode;
  sentenceRepetition: number;
  similarityThreshold: number;
  minimumSentenceLengthForSimilarity: number;
  consecutiveNewlineLimit: number;
  mediumLengthRanges: Array<{ min: number; max: number; threshold: number }>;
  enumerationDetection?: { enabled: boolean; minRepeatCount?: number };
  paragraphRepeat?: { enabled: boolean; headChars: number };
}

export interface LanguagePatterns {
  japanese: string[];
  english: string[];
  chinese: string[];
  korean: string[];
}

export interface ContaminationPatterns {
  instructionPatterns: string[];
  xmlPatternGroups: {
    completeXmlTags: string[];
    sentenceBoundedTags: string[];
    lineBoundedTags: string[];
    standaloneTags: string[];
  };
  contextPatterns: string[];
  promptSnippetLengths: number[];
}

export interface CleaningConfig {
  safety: SafetyThresholds;
  repetition: RepetitionThresholds;
  hallucinations: LanguagePatterns;
  contamination: ContaminationPatterns;
}
```

2) クリーナー IF とパイプライン骨子
```ts
// src/core/transcription/cleaning/interfaces.ts
export interface CleaningResult {
  cleanedText: string;
  issues: string[];
  hasSignificantChanges: boolean;
  metadata?: Record<string, unknown>;
}

export interface CleaningContext {
  language: string;
  originalLength: number;
  enableDetailedLogging?: boolean;
  originalPrompt?: string;
}

export interface TextCleaner {
  readonly name: string;
  readonly enabled: boolean;
  clean(text: string, language: string, context?: CleaningContext): Promise<CleaningResult> | CleaningResult;
}

export interface CleaningPipeline {
  readonly name: string;
  execute(text: string, language: string, context?: CleaningContext): Promise<{
    finalText: string;
    metadata: { totalOriginalLength: number; totalFinalLength: number; totalReductionRatio: number };
  }>;
}

// src/core/transcription/cleaning/StandardCleaningPipeline.ts
export class StandardCleaningPipeline implements CleaningPipeline {
  readonly name = 'StandardCleaningPipeline';
  constructor(private cleaners: TextCleaner[] = []) {}
  async execute(text: string, language: string, context?: CleaningContext) {
    const originalLength = text.length;
    let current = text;
    for (const cleaner of this.cleaners) {
      if (!cleaner.enabled) continue;
      const res = await Promise.resolve(
        cleaner.clean(current, language, { ...context, originalLength })
      );
      current = res.cleanedText;
    }
    return {
      finalText: current,
      metadata: {
        totalOriginalLength: originalLength,
        totalFinalLength: current.length,
        totalReductionRatio: originalLength > 0 ? (originalLength - current.length) / originalLength : 0,
      },
    };
  }
}
```

3) プロンプト混入: 文頭一致 + スニペット一致 + XML/文脈タグ
```ts
// src/core/transcription/cleaning/PromptContaminationCleaner.ts
import { CleaningResult, CleaningContext, TextCleaner } from './interfaces';
import { CLEANING_CONFIG } from '../../../config/CleaningConfig';

export class PromptContaminationCleaner implements TextCleaner {
  readonly name = 'PromptContaminationCleaner';
  readonly enabled = true;

  clean(text: string): CleaningResult {
    const original = text;
    const { instructionPatterns, xmlPatternGroups, contextPatterns, promptSnippetLengths } = CLEANING_CONFIG.contamination;
    let cleaned = text;

    // XML風タグ（優先度順）
    for (const group of ['completeXmlTags','sentenceBoundedTags','lineBoundedTags','standaloneTags'] as const) {
      for (const patt of (xmlPatternGroups as any)[group] as string[]) {
        cleaned = cleaned.replace(new RegExp(patt.slice(1, patt.lastIndexOf('/')), patt.slice(patt.lastIndexOf('/')+1)), '');
      }
    }

    // 文頭の完全一致
    for (const prompt of instructionPatterns) {
      if (cleaned.startsWith(prompt)) cleaned = cleaned.slice(prompt.length).trim();
    }

    // スニペット一致（保守的）
    for (const prompt of instructionPatterns) {
      for (const len of promptSnippetLengths) {
        if (prompt.length < len) continue;
        const snippet = prompt.slice(0, len).replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');
        const re = new RegExp(`${snippet}[^。.!?！？\n]{0,50}(?:ください|してください|です|ます)`, 'g');
        cleaned = cleaned.replace(re, '');
      }
    }

    // 文脈パターン
    for (const patt of contextPatterns) {
      cleaned = cleaned.replace(new RegExp(patt.slice(1, patt.lastIndexOf('/')), patt.slice(patt.lastIndexOf('/')+1)), '');
    }

    cleaned = cleaned.replace(/\n{3,}/g, '\n\n').trim();
    const rr = original.length ? (original.length - cleaned.length) / original.length : 0;
    return { cleanedText: cleaned, issues: rr > 0.25 ? [`Text reduction warning: ${Math.round(rr*100)}%`] : [], hasSignificantChanges: rr > 0.05 };
  }
}
```

4) 反復抑制（抜粋: 短語・文重複・列挙）
```ts
// src/core/transcription/cleaning/BaseHallucinationCleaner.ts
import { CleaningResult, TextCleaner } from './interfaces';
import { CLEANING_CONFIG } from '../../../config/CleaningConfig';

export class BaseHallucinationCleaner implements TextCleaner {
  readonly name = 'BaseHallucinationCleaner';
  readonly enabled = true;

  clean(text: string, language: string): CleaningResult {
    const original = text;
    let cleaned = text;

    // 言語別の固定パターン（終端アウトロ等）
    const patterns = language === 'ja' ? CLEANING_CONFIG.hallucinations.japanese : CLEANING_CONFIG.hallucinations.english;
    for (const patt of patterns) {
      const re = new RegExp(patt.slice(1, patt.lastIndexOf('/')), patt.slice(patt.lastIndexOf('/')+1));
      cleaned = cleaned.replace(re, '');
    }

    // 短語反復
    cleaned = this.applyShortCharDedupe(cleaned, original.length);
    // 文重複
    cleaned = this.collapseRepeatingSentences(cleaned);
    // 列挙圧縮
    cleaned = this.compressEnumerations(cleaned);

    cleaned = cleaned.replace(/\uFFFD+/g, '').trim();
    const rr = original.length ? (original.length - cleaned.length) / original.length : 0;
    return rr > CLEANING_CONFIG.safety.emergencyFallbackThreshold
      ? { cleanedText: text, issues: ['Emergency fallback: excessive reduction'], hasSignificantChanges: false }
      : { cleanedText: cleaned, issues: [], hasSignificantChanges: rr > 0.05 };
  }

  private applyShortCharDedupe(text: string, originalLength: number): string {
    const r = CLEANING_CONFIG.repetition; const words = text.split(/\s+/); const counts = new Map<string, number>();
    for (const w of words) {
      const s = w.replace(/[。、！？\s]/g, '');
      if (s.length >= r.shortCharMinLength && s.length <= r.shortCharMaxLength && /^[あ-んア-ン]+$/.test(s)) counts.set(s, (counts.get(s) || 0) + 1);
    }
    const dyn = r.baseThreshold + Math.floor(originalLength / r.dynamicThresholdDivisor) * r.lengthFactor; let out = text;
    for (const [w, c] of counts) {
      if (r.essentialParticles.includes(w)) continue;
      if (c >= dyn) { const keep = Math.max(1, Math.floor(c * r.shortCharKeepRatio)); const re = new RegExp(`${w}[。、]?\\s*`, 'g'); for (let i = 0; i < c - keep; i++) out = out.replace(re, ''); }
    }
    return out;
  }

  private collapseRepeatingSentences(text: string): string {
    const r = CLEANING_CONFIG.repetition; const sents = text.split(/(?<=[。.!?！？?])\s*/); const out: string[] = [];
    let prev = '', count = 0; const norm = (s: string) => s.replace(/[。、！？\s]/g, '').normalize('NFKC');
    for (const s of sents) { const cur = s.trim(); const same = cur && (cur === prev || (cur.length >= r.minimumSentenceLengthForSimilarity && prev.length >= r.minimumSentenceLengthForSimilarity && norm(cur) === norm(prev))); if (same) { count++; } else { if (prev) out.push(count >= r.sentenceRepetition ? prev : prev.repeat(Math.max(1, count))); prev = s; count = 1; } }
    if (prev) out.push(count >= r.sentenceRepetition ? prev : prev.repeat(Math.max(1, count))); return out.join('').trim();
  }

  private compressEnumerations(text: string): string {
    const r = CLEANING_CONFIG.repetition; if (!r.enumerationDetection?.enabled) return text;
    return text.split(/(?<=[。.!?！？])\s*/).map(sentence => {
      const sep = sentence.includes('、') ? '、' : (sentence.includes(',') ? ',' : ''); if (!sep) return sentence;
      const parts = sentence.split(new RegExp(`\\s*${sep.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*`));
      const minRep = r.enumerationDetection.minRepeatCount ?? 3; if (parts.length < minRep * 2) return sentence;
      for (let len = 2; len <= Math.floor(parts.length / minRep); len++) { const pattern = parts.slice(0, len); let ok = true, reps = 1; for (let i = len; i < parts.length; i += len) { if (parts.slice(i, i+len).join('\u0001') !== pattern.join('\u0001')) { ok = false; break; } reps++; } if (ok && reps >= minRep) { const punc = /[。.!?！？]+$/.exec(parts[parts.length-1])?.[0] || ''; return pattern.join(sep === '、' ? '、' : ', ') + punc; } }
      return sentence;
    }).join(' ').trim();
  }
}
```

5) `TranscriptionService` への導線（概念サンプル）
```ts
// cleanGPT4oResponse 内での委譲
import { StandardCleaningPipeline } from './cleaning/StandardCleaningPipeline';
import { PromptContaminationCleaner } from './cleaning/PromptContaminationCleaner';
import { BaseHallucinationCleaner } from './cleaning/BaseHallucinationCleaner';

private async cleanGPT4oResponse(text: string, language: string): Promise<string> {
  const pipeline = new StandardCleaningPipeline([
    new PromptContaminationCleaner(),
    new BaseHallucinationCleaner(),
  ]);
  const lang = this.normalizeLanguage(language);
  const res = await pipeline.execute(text, lang, { language: lang, originalLength: text.length });
  return res.finalText.trim().replace(/\n{3,}/g, '\n\n');
}
```

ラベル案: `type:enhancement`, `area:transcription`, `lang:ja`, `safety`, `cleaning`

提案ブランチ名: `feat/cleaning-pipeline-repetition-suppression`
# 強化: 反復ハルシネーション抑制（言語非依存）とクリーニング・パイプライン導入

問題: 現状のクリーニングはプロンプト断片やフォーマット除去にとどまり、ハルシネーションによる単語/句/文の機械的な繰り返し抑制が手薄。特定言語（日本語）に偏った対策となっており、英語/中国語/韓国語/混在文書など言語に依存しない「反復」現象への一般的な仕組みが不足。

目的: 参照プロジェクト（obsidian-ai-transcriber）のパイプライン構造と安全装置を取り入れ、言語に依存しない一般的なテキスト反復抑制を中心とした Cleaning Pipeline を導入する。
- プロンプト混入除去（汎用）
- 反復ハルシネーション抑制（文字/トークン/フレーズ/文/段落/列挙/末尾）を言語非依存の規則で実装
- 言語固有ロジックは最小限（任意・後続）

非目標:
- モデル選択や音声分割ロジックの変更なし
- UI トグル追加なし（常時オン）。設定は内部定数で集中管理

受け入れ基準 (Acceptance Criteria)
- 言語非依存の反復抑制: 英語/日本語/中国語/韓国語/混在文書で、過剰な「同一トークン/フレーズ/文」の連続が適切に抑制される。
- 文字/句読点の連続抑制: 言語に依存しない繰り返し（"...", "!!!", "????", "——", "•••" など）を適正な上限で収束。
- フレーズ反復の削減: 可変長 n-gram（トークンベース、CJK は文字ベース）で閾値以上の反復を縮約。
- 文重複の圧縮: 文境界（汎用句読点セット）で分割し、正規化＋類似度で連続重複を1つに圧縮。
- 段落重複の削減: 段落先頭フィンガープリントで重複段落を除去。
- 列挙周期の圧縮: 区切り（","/";"/"、"/"·"/タブ/スペース列）に依らず A,B,A,B,… 型の反復を1周期へ圧縮（句読点/区切りは自然に保持）。
- 末尾反復の抑制: 文末近傍の自己反復密度が高い塊は終端限定で抑制（言語固有フレーズに依存しない構造的ルール）。
- 安全装置: 1パターン/1イテレーション/全体削減の上限を超える操作は自動スキップ or ロールバックされる。
- プロンプト混入: XML風タグ/文脈タグ/文頭の完全一致/スニペット一致の安全削除（汎用）。

タスク (Tasks)
- [ ] `src/config/CleaningConfig.ts` を追加: 反復しきい値/安全閾値/文脈・タグの汎用パターンを集中管理（言語非依存）
- [ ] `src/core/transcription/cleaning/` を追加: クリーナーとパイプライン実装
  - [ ] `interfaces.ts`: `TextCleaner`/`CleaningResult`/`CleaningPipeline` ほか
  - [ ] `StandardCleaningPipeline.ts`: 各クリーナーの逐次実行・計測・安全監視
  - [ ] `PromptContaminationCleaner.ts`: XML/文脈タグ、文頭一致、スニペット一致の優先度除去（汎用）
  - [ ] `UniversalRepetitionCleaner.ts`: 文字/トークン/フレーズ/文/段落/列挙/末尾の反復抑制 + 動的閾値 + 安全装置（言語非依存）
- [ ] `src/core/transcription/TranscriptionService.ts` を差分最小で置換: 既存の `cleanGPT4oResponse` からパイプライン委譲へ
- [ ] テスト追加 `tests/unit/core/cleaning/**`
  - [ ] 英語の反復（"Okay okay okay"/"Thank you"×N）
  - [ ] CJK の短語/文字反復（助詞等は一般ルールの範囲で保持）
  - [ ] 中長フレーズ反復（言語混在）
  - [ ] 文重複（句読点・空白正規化＋類似度）
  - [ ] 列挙圧縮（","/";"/"、"/"·"/タブなど）
  - [ ] 末尾の反復塊（高自己反復密度）抑制
  - [ ] 安全装置（削減率超過ロールバック）
- [ ] ロギング: クリーナー別の削減率/時間/警告を記録（既存 Logger を使用）

設計メモ（要点 / 言語非依存）
- 正規化: Unicode NFKC、ケース折り、不要空白の正規化、句読点の共通集合化（`. ! ? … 。 ！ ？` 等）
- トークン化: 空白・句読点でのスプリット＋CJK 連続ブロックは文字ベースで扱うフォールバック
- 文字/記号の連続抑制: 例 `.{6,}`, `!{6,}`, `\?{6,}`, `…{3,}`, `[-—–]{6,}`, `[•·・]{6,}` を上限で収束
- n-gram 反復: トークンベース n-gram（CJK は文字ベース）で閾値以上の反復を圧縮。窓幅は可変（例 3–10）
- 文重複: 汎用句読点で文境界→正規化→完全一致/高類似は連続閾値以上で1件に圧縮
- 段落重複: 先頭フィンガープリント（NFKC + 抜粋長）で重複を除去
- 列挙圧縮: 区切り記号（`,`/`;`/`、`/`·`/タブ/連続スペース）を検出→周期パターンのみ1周期保持
- 末尾抑制: 末尾 N 文字の自己反復率と語彙多様性に基づく抑制（言語固有フレーズに依存しない）
- 安全装置: `singlePatternMaxReduction`/`repetitionPatternMaxReduction`/`iterationReductionLimit`/`emergencyFallbackThreshold` 等

---

以下は提案実装の抜粋（コード例）。

1) 設定: `src/config/CleaningConfig.ts`
```ts
export interface SafetyThresholds {
  singleCleanerMaxReduction: number;
  singlePatternMaxReduction: number;
  repetitionPatternMaxReduction?: number;
  iterationReductionLimit?: number;
  emergencyFallbackThreshold: number;
  warningThreshold: number;
}

export interface RepetitionThresholds {
  baseThreshold: number;
  lengthFactor: number;
  dynamicThresholdDivisor: number;
  shortCharKeepRatio: number;
  sentenceRepetition: number;
  similarityThreshold: number;
  minimumSentenceLengthForSimilarity: number;
  consecutiveNewlineLimit: number;
  ngram: { min: number; max: number; thresholds: Array<{ n: number; repeat: number }> };
  enumerationDetection?: { enabled: boolean; minRepeatCount?: number };
  paragraphRepeat?: { enabled: boolean; headChars: number };
}

export interface ContaminationPatterns {
  instructionPatterns: string[];
  xmlPatternGroups: {
    completeXmlTags: string[];
    sentenceBoundedTags: string[];
    lineBoundedTags: string[];
    standaloneTags: string[];
  };
  contextPatterns: string[];
  promptSnippetLengths: number[];
}

export interface CleaningConfig {
  safety: SafetyThresholds;
  repetition: RepetitionThresholds;
  contamination: ContaminationPatterns;
}
```

2) クリーナー IF とパイプライン骨子
```ts
// src/core/transcription/cleaning/interfaces.ts
export interface CleaningResult {
  cleanedText: string;
  issues: string[];
  hasSignificantChanges: boolean;
  metadata?: Record<string, unknown>;
}

export interface CleaningContext {
  language: string;           // 'auto' を含む
  originalLength: number;
  enableDetailedLogging?: boolean;
  originalPrompt?: string;
}

export interface TextCleaner {
  readonly name: string;
  readonly enabled: boolean;
  clean(text: string, language: string, context?: CleaningContext): Promise<CleaningResult> | CleaningResult;
}

export interface CleaningPipeline {
  readonly name: string;
  execute(text: string, language: string, context?: CleaningContext): Promise<{
    finalText: string;
    metadata: { totalOriginalLength: number; totalFinalLength: number; totalReductionRatio: number };
  }>;
}

// src/core/transcription/cleaning/StandardCleaningPipeline.ts
export class StandardCleaningPipeline implements CleaningPipeline {
  readonly name = 'StandardCleaningPipeline';
  constructor(private cleaners: TextCleaner[] = []) {}
  async execute(text: string, language: string, context?: CleaningContext) {
    const originalLength = text.length;
    let current = text;
    for (const cleaner of this.cleaners) {
      if (!cleaner.enabled) continue;
      const res = await Promise.resolve(
        cleaner.clean(current, language, { ...context, originalLength })
      );
      current = res.cleanedText;
    }
    return {
      finalText: current,
      metadata: {
        totalOriginalLength: originalLength,
        totalFinalLength: current.length,
        totalReductionRatio: originalLength > 0 ? (originalLength - current.length) / originalLength : 0,
      },
    };
  }
}
```

3) プロンプト混入: 文頭一致 + スニペット一致 + XML/文脈タグ（汎用）
```ts
// src/core/transcription/cleaning/PromptContaminationCleaner.ts
import { CleaningResult, TextCleaner } from './interfaces';
import { CLEANING_CONFIG } from '../../../config/CleaningConfig';

export class PromptContaminationCleaner implements TextCleaner {
  readonly name = 'PromptContaminationCleaner';
  readonly enabled = true;

  clean(text: string): CleaningResult {
    const original = text;
    const { instructionPatterns, xmlPatternGroups, contextPatterns, promptSnippetLengths } = CLEANING_CONFIG.contamination;
    let cleaned = text;

    // XML風タグ（優先度順）
    for (const group of ['completeXmlTags','sentenceBoundedTags','lineBoundedTags','standaloneTags'] as const) {
      for (const patt of (xmlPatternGroups as any)[group] as string[]) {
        cleaned = cleaned.replace(new RegExp(patt.slice(1, patt.lastIndexOf('/')), patt.slice(patt.lastIndexOf('/')+1)), '');
      }
    }

    // 文頭の完全一致
    for (const prompt of instructionPatterns) {
      if (cleaned.startsWith(prompt)) cleaned = cleaned.slice(prompt.length).trim();
    }

    // スニペット一致（保守的）
    for (const prompt of instructionPatterns) {
      for (const len of promptSnippetLengths) {
        if (prompt.length < len) continue;
        const snippet = prompt.slice(0, len).replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');
        const re = new RegExp(`${snippet}[^。.!?！？\n]{0,50}(?:ください|してください|です|ます)`, 'g');
        cleaned = cleaned.replace(re, '');
      }
    }

    // 文脈パターン
    for (const patt of contextPatterns) {
      cleaned = cleaned.replace(new RegExp(patt.slice(1, patt.lastIndexOf('/')), patt.slice(patt.lastIndexOf('/')+1)), '');
    }

    cleaned = cleaned.replace(/\n{3,}/g, '\n\n').trim();
    const rr = original.length ? (original.length - cleaned.length) / original.length : 0;
    return { cleanedText: cleaned, issues: rr > 0.25 ? [`Text reduction warning: ${Math.round(rr*100)}%`] : [], hasSignificantChanges: rr > 0.05 };
  }
}
```

4) 反復抑制（抜粋: 言語非依存の短語/記号・文重複・列挙・末尾）
```ts
// src/core/transcription/cleaning/UniversalRepetitionCleaner.ts
import { CleaningResult, TextCleaner } from './interfaces';
import { CLEANING_CONFIG } from '../../../config/CleaningConfig';

export class UniversalRepetitionCleaner implements TextCleaner {
  readonly name = 'UniversalRepetitionCleaner';
  readonly enabled = true;

  clean(text: string): CleaningResult {
    const original = text;
    let cleaned = text;

    // 文字/記号の連続抑制（言語非依存）
    cleaned = cleaned
      .replace(/([.!?])\1{5,}/g, '$1$1$1')       // !!! or ??? → 上限
      .replace(/[…]{3,}/g, '…')                  // 省略記号の収束
      .replace(/[-—–]{6,}/g, '—')               // ダッシュ類
      .replace(/[•·・]{6,}/g, '・');             // ドット/中点類

    // トークン反復の抑制（言語非依存）
    cleaned = this.applyTokenDedupe(cleaned, original.length);
    // 文重複
    cleaned = this.collapseRepeatingSentences(cleaned);
    // 列挙圧縮
    cleaned = this.compressEnumerations(cleaned);
    // 末尾の反復塊抑制
    cleaned = this.trimRepetitiveTail(cleaned);

    cleaned = cleaned.replace(/\uFFFD+/g, '').trim();
    const rr = original.length ? (original.length - cleaned.length) / original.length : 0;
    return rr > CLEANING_CONFIG.safety.emergencyFallbackThreshold
      ? { cleanedText: text, issues: ['Emergency fallback: excessive reduction'], hasSignificantChanges: false }
      : { cleanedText: cleaned, issues: [], hasSignificantChanges: rr > 0.05 };
  }

  private applyTokenDedupe(text: string, originalLength: number): string {
    const r = CLEANING_CONFIG.repetition;
    const norm = (s: string) => s.normalize('NFKC').toLowerCase();
    // トークン化（空白/句読点）。CJK の連続は 1 文字ずつ扱うフォールバック
    const tokens = Array.from(text.matchAll(/\p{L}+|\p{N}+|\p{P}+|\s+/gu)).map(m => m[0]);
    const counts = new Map<string, number>();
    for (const t of tokens) {
      const key = norm(t).trim();
      if (!key || /^\p{P}+$|^\s+$|^[、。.!?！？…]+$/u.test(key)) continue; // 純粋な句読点/空白は別処理
      counts.set(key, (counts.get(key) || 0) + 1);
    }
    const dyn = r.baseThreshold + Math.floor(originalLength / r.dynamicThresholdDivisor) * r.lengthFactor;
    let out = text;
    for (const [key, c] of counts) {
      if (c >= dyn) {
        const keep = Math.max(1, Math.floor(c * r.shortCharKeepRatio));
        const esc = key.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');
        const re = new RegExp(`(?:^|\b)${esc}(?:\b|$)`, 'giu');
        for (let i = 0; i < c - keep; i++) out = out.replace(re, '');
      }
    }
    return out;
  }

  private collapseRepeatingSentences(text: string): string {
    const r = CLEANING_CONFIG.repetition; const sents = text.split(/(?<=[。.!?！？?])\s*/); const out: string[] = [];
    let prev = '', count = 0; const norm = (s: string) => s.replace(/[、。,.;:!！?？\s]/g, '').normalize('NFKC').toLowerCase();
    for (const s of sents) { const cur = s.trim(); const same = cur && (cur === prev || (cur.length >= r.minimumSentenceLengthForSimilarity && prev.length >= r.minimumSentenceLengthForSimilarity && norm(cur) === norm(prev))); if (same) { count++; } else { if (prev) out.push(count >= r.sentenceRepetition ? prev : prev.repeat(Math.max(1, count))); prev = s; count = 1; } }
    if (prev) out.push(count >= r.sentenceRepetition ? prev : prev.repeat(Math.max(1, count))); return out.join('').trim();
  }

  private compressEnumerations(text: string): string {
    const r = CLEANING_CONFIG.repetition; if (!r.enumerationDetection?.enabled) return text;
    return text.split(/(?<=[。.!?！？.?])\s*/).map(sentence => {
      const sepMatch = sentence.match(/(、|,|;|·|\t|\s{2,})/);
      const sep = sepMatch?.[1] || '';
      if (!sep) return sentence;
      const parts = sentence.split(new RegExp(`\s*${sep.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\s*`));
      const minRep = r.enumerationDetection.minRepeatCount ?? 3; if (parts.length < minRep * 2) return sentence;
      for (let len = 2; len <= Math.floor(parts.length / minRep); len++) { const pattern = parts.slice(0, len); let ok = true, reps = 1; for (let i = len; i < parts.length; i += len) { if (parts.slice(i, i+len).join('\u0001') !== pattern.join('\u0001')) { ok = false; break; } reps++; } if (ok && reps >= minRep) { const punc = /[。.!?！？]+$/.exec(parts[parts.length-1])?.[0] || ''; return pattern.join(sep === '、' ? '、' : sep.trim() === '' ? ' ' : `${sep.trim()} `) + punc; } }
      return sentence;
    }).join(' ').trim();
  }

  private trimRepetitiveTail(text: string): string {
    // 末尾 400 文字を評価し、自己反復率が高い場合に末尾を切り戻す（保守的）
    const tail = text.slice(-400);
    if (tail.length < 80) return text;
    const uniq = new Set(tail.normalize('NFKC').toLowerCase().split(/\s+/));
    const diversity = uniq.size / Math.max(1, tail.split(/\s+/).length);
    const repetitions = (tail.match(/(.{2,20})\1{2,}/gs) || []).length;
    if (diversity < 0.3 || repetitions >= 2) {
      // 直前の文末まで巻き戻す
      const cut = text.slice(0, -400);
      const lastEnd = Math.max(cut.lastIndexOf('.'), cut.lastIndexOf('。'), cut.lastIndexOf('!'), cut.lastIndexOf('！'), cut.lastIndexOf('?'), cut.lastIndexOf('？'));
      return lastEnd > -1 ? cut.slice(0, lastEnd + 1) : cut;
    }
    return text;
  }
}
```

5) `TranscriptionService` への導線（概念サンプル）
```ts
// cleanGPT4oResponse 内での委譲
import { StandardCleaningPipeline } from './cleaning/StandardCleaningPipeline';
import { PromptContaminationCleaner } from './cleaning/PromptContaminationCleaner';
import { UniversalRepetitionCleaner } from './cleaning/UniversalRepetitionCleaner';

private async cleanGPT4oResponse(text: string, language: string): Promise<string> {
  const pipeline = new StandardCleaningPipeline([
    new PromptContaminationCleaner(),
    new UniversalRepetitionCleaner(),
  ]);
  const lang = this.normalizeLanguage(language);
  const res = await pipeline.execute(text, lang, { language: lang, originalLength: text.length });
  return res.finalText.trim().replace(/\n{3,}/g, '\n\n');
}
```

ラベル案: `enhancement`, `area:transcription`, `safety`, `cleaning`

提案ブランチ名: `feat/cleaning-pipeline-repetition-suppression`

