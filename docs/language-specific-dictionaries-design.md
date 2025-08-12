# Language-Specific Dictionaries Design Document

## 目的 (Purpose)

辞書補正の言語別適用（ja/en/zh/ko）を安全に導入するための設計ドキュメント。現在の単一辞書システムから、言語特化辞書システムへの段階的移行を実現する。

## 現状分析 (Current State Analysis)

### 現在の実装

- **辞書構造**: `SimpleCorrectionDictionary` with `definiteCorrections: CorrectionEntry[]`
- **適用範囲**: 全言語に同一辞書を適用（`enableTranscriptionCorrection: true` の場合）
- **言語サポート**: 'ja', 'en', 'zh', 'ko' + 'auto'
- **設定**: `VoiceInputSettings.customDictionary: SimpleCorrectionDictionary`

### 問題点

1. 言語固有の修正ルールが適用できない
2. 日本語の敬語変換が英語テキストにも適用される可能性
3. 言語特有の音声認識エラーパターンに対応できない
4. 辞書サイズの肥大化

## 型設計の比較と決定 (Type Architecture Comparison)

### オプション1: Record型アプローチ

```typescript
type LanguageSpecificDictionary = Record<'ja' | 'en' | 'zh' | 'ko', CorrectionEntry[]> & {
  global?: CorrectionEntry[];  // 言語共通ルール
};
```

**利点**:
- TypeScript型安全性が高い
- 言語キーの補完とチェックが可能
- 構造が明確で理解しやすい

**欠点**:
- 新言語追加時に型定義の変更が必要
- 空配列でもすべての言語キーが必要
- JSONシリアライゼーション時の冗長性

### オプション2: Array型アプローチ

```typescript
type LanguageSpecificDictionary = Array<{
  lang?: Locale;  // undefined = global
  entries: CorrectionEntry[];
}>;
```

**利点**:
- 動的な言語追加が容易
- 空言語の場合の無駄がない
- JSONサイズが効率的
- 拡張性が高い

**欠点**:
- TypeScript型安全性が低い
- 実行時のvalidationが必要
- 言語重複チェックが必要

### 決定: ハイブリッドアプローチ

最適な解決策として、両方の利点を組み合わせた構造を採用：

```typescript
interface MultiLanguageDictionary {
  // 言語別辞書（型安全）
  languages: {
    ja?: CorrectionEntry[];
    en?: CorrectionEntry[];
    zh?: CorrectionEntry[];
    ko?: CorrectionEntry[];
  };
  // 全言語共通辞書
  global: CorrectionEntry[];
}
```

**理由**:
1. 型安全性を保持しつつ柔軟性を提供
2. 空言語は undefined で省略可能
3. 全言語共通ルールを明示的に分離
4. 後方互換性の実装が容易

## フォールバック順序の定義 (Fallback Strategy)

### フォールバック優先順位

1. **現在の検出言語** (`currentDetectedLanguage`)
2. **英語** (`'en'`) - 国際的共通言語として
3. **グローバル辞書** (`global`) - 言語非依存の修正

### 実装ロジック

```typescript
function getApplicableCorrections(
  detectedLanguage: string,
  dictionary: MultiLanguageDictionary
): CorrectionEntry[] {
  const corrections: CorrectionEntry[] = [];
  
  // 1. 現在の言語の辞書
  const langDict = dictionary.languages[detectedLanguage as Locale];
  if (langDict) {
    corrections.push(...langDict);
  }
  
  // 2. 英語辞書（現在の言語が英語でない場合）
  if (detectedLanguage !== 'en' && dictionary.languages.en) {
    corrections.push(...dictionary.languages.en);
  }
  
  // 3. グローバル辞書
  corrections.push(...dictionary.global);
  
  return corrections;
}
```

### エッジケース処理

- **未知言語**: 'en' → global の順序でフォールバック
- **'auto'言語設定**: 実際の検出結果に基づく
- **空辞書**: 次の優先順位に進む

## 後方互換性戦略 (Backward Compatibility)

### 既存データの受理

現在の `SimpleCorrectionDictionary` 形式を自動的に `MultiLanguageDictionary` に変換：

```typescript
function migrateLegacyDictionary(
  legacy: SimpleCorrectionDictionary
): MultiLanguageDictionary {
  return {
    languages: {},  // 言語別辞書は空
    global: legacy.definiteCorrections  // 既存ルールは全てglobalに
  };
}
```

### 設定保存形式

- **新形式**: `MultiLanguageDictionary`
- **レガシー検出**: `definiteCorrections` プロパティの存在で判定
- **自動変換**: 読み込み時に一度だけ実行
- **保存形式**: 常に新形式で保存

## マイグレーション計画 (Migration Plan)

### フェーズ1: 基盤実装

1. **型定義の追加**
   - `MultiLanguageDictionary` インターフェース
   - 互換性ヘルパー関数

2. **コア機能の拡張**
   - `DictionaryCorrector` のマルチ言語対応
   - フォールバックロジックの実装

3. **テストの追加**
   - 言語別辞書テスト
   - フォールバックテスト
   - 後方互換性テスト

### フェーズ2: UI拡張

1. **設定画面の改良**
   - 言語タブまたはフィルター機能
   - 言語別エントリの表示・編集
   - インポート・エクスポート機能の対応

2. **UX考慮事項**
   - 既存ユーザーへの移行案内
   - 言語別エントリ数の表示
   - 辞書サイズの警告機能

### フェーズ3: 最適化

1. **パフォーマンス改善**
   - 辞書キャッシュ機能
   - 部分読み込み対応

2. **高度な機能**
   - 辞書の言語間コピー機能
   - 共通ルールの自動検出・提案

## セキュリティ・パフォーマンス考慮事項 (Security & Performance)

### エントリ数制限

```typescript
const LIMITS = {
  MAX_ENTRIES_PER_LANGUAGE: 1000,
  MAX_GLOBAL_ENTRIES: 500,
  MAX_PATTERN_LENGTH: 100,
  MAX_REPLACEMENT_LENGTH: 200,
  MAX_PATTERNS_PER_ENTRY: 10
};
```

### メモリ使用量

- **推定サイズ**: 言語4つ × 1000エントリ × 100文字 ≈ 400KB
- **制限値**: 総辞書サイズ 1MB以下
- **警告しきい値**: 500KB

### セキュリティ対策

1. **入力検証**
   - 正規表現インジェクション防止
   - 文字列長制限
   - 特殊文字のサニタイゼーション

2. **DoS攻撃対策**
   - 処理時間制限（100ms/テキスト）
   - 再帰的置換の防止
   - メモリ使用量監視

### パフォーマンス最適化

1. **処理効率**
   - パターンマッチングの最適化
   - 辞書の事前コンパイル
   - キャッシュの活用

2. **UI応答性**
   - 大量エントリの仮想化表示
   - 非同期でのバリデーション
   - プログレス表示

## 実装ロードマップ (Implementation Roadmap)

### 必要なサブタスク

#### Issue #XX: 型定義とコア機能実装
- [ ] `MultiLanguageDictionary` インターフェース定義
- [ ] `DictionaryCorrector` のマルチ言語対応
- [ ] フォールバック機能の実装
- [ ] 後方互換性ヘルパー関数
- [ ] ユニットテストの追加

#### Issue #XX: 設定UI拡張  
- [ ] 言語タブ機能の実装
- [ ] 言語別エントリの表示・編集UI
- [ ] インポート・エクスポート機能の対応
- [ ] 既存データの移行UI

#### Issue #XX: バリデーション・制限機能
- [ ] エントリ数制限の実装
- [ ] 入力検証の強化
- [ ] メモリ使用量監視
- [ ] パフォーマンス最適化

#### Issue #XX: ドキュメント・テスト
- [ ] ユーザーガイドの更新
- [ ] API リファレンスの更新
- [ ] E2Eテストの追加
- [ ] マイグレーションガイドの作成

### 推定工数

- **フェーズ1**: 2-3 人日
- **フェーズ2**: 3-4 人日  
- **フェーズ3**: 1-2 人日
- **合計**: 6-9 人日

### リスク要因

1. **既存ユーザーデータの移行**
   - リスク: データ損失・破損
   - 対策: バックアップ機能とロールバック機能

2. **パフォーマンス影響**
   - リスク: 辞書処理の遅延
   - 対策: 段階的最適化とベンチマーク

3. **UI複雑化**
   - リスク: ユーザビリティの低下
   - 対策: プロトタイプと段階的展開

## 結論 (Conclusion)

本設計により、言語特化辞書システムを安全かつ段階的に導入できる。ハイブリッド型アプローチにより型安全性と拡張性を両立し、堅牢なフォールバック機能により既存の使用体験を維持しながら新機能を提供する。

適切な制限とセキュリティ対策により、パフォーマンスと安全性を確保し、明確なマイグレーション計画により実装リスクを最小化する。