# Voice Input Processing Flow v2 / 音声入力処理フロー v2

最終更新: 2025-08-15

本バージョンは、TRANSCRIPTタグの事前除去と新しいクリーニング・パイプライン（安全装置付き）を前提とした最新の処理フローをまとめています。詳細版は `docs/PROCESSING_FLOW.md` を参照してください。

## フロー概要

1) 音声 → OpenAI Transcription API（日本語のみプロンプト付与）。
2) APIレスポンス `text` を受領。
3) 事前処理: `<TRANSCRIPT ...> ... </TRANSCRIPT>` を機械的に抽出・除去（閉じタグ欠落にも対応）。
4) クリーニング・パイプライン（`StandardCleaningPipeline`）
   - `PromptContaminationCleaner`: 指示文/タグ/文脈/スニペット除去。
   - `UniversalRepetitionCleaner`: 反復抑制（文字/トークン/文/列挙/段落/末尾）＋整形。
   - セーフティ: 削減率上限・緊急ロールバック。構造除去は誤ロールバック防止のため緩和。
5) プロンプトエラー検出 → 該当時は空文字で早期終了。
6) `DictionaryCorrector` による辞書補正（任意）。
7) 最終テキストを返却。

## 補足

- 事前処理により、タグの有無に影響されずにパイプラインの安全判定が機能します。
- 言語は日本語以外でも有効（クリーナーは言語非依存の設計）。

