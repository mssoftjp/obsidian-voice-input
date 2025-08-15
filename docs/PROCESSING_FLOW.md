# Voice Input Processing Flow / 音声入力処理フロー

This document describes the current processing pipeline of the voice input system. As of 2025-08-15, the cleaning stage first strips TRANSCRIPT wrappers mechanically, then runs a safety‑guarded cleaning pipeline, and finally applies optional dictionary correction.

このドキュメントは最新の音声入力処理パイプラインを説明します。2025-08-15 時点では、クリーニング段階でまず機械的に TRANSCRIPT ラッパーを除去し、その後に安全装置付きのクリーニング・パイプラインを実行し、最後に辞書補正（任意）を適用します。

## Updated Overview (Current) / 最新の概要

1) Audio → OpenAI Transcription API（言語ごとにプロンプト付与は日本語のみ）。
2) APIレスポンス `text` を受領。
3) 構造除去（事前処理）: `<TRANSCRIPT ...> ... </TRANSCRIPT>` を機械的に抽出・除去（閉じタグ欠落にも対応）。
4) クリーニング・パイプライン実行（`StandardCleaningPipeline`）
   - `PromptContaminationCleaner`: 指示文・XML/文脈タグ・スニペットなどの混入除去。
   - `UniversalRepetitionCleaner`: 反復抑制（文字/トークン/文/列挙/段落/末尾）＋最終整形。
   - セーフティ: クリーナー単体の削減率上限＋緊急ロールバック。構造除去は過剰ロールバックを避けるため緩和あり。
5) プロンプトエラー検出（無音時にプロンプトが返る等）→ 該当すれば空文字で早期終了。
6) 辞書補正（任意）: `DictionaryCorrector` による語彙修正。
7) 最終テキストを返却。

## Complete Processing Flow / 完全な処理フロー

```
┌─────────────────┐
│  Audio Input    │ 🎤
│  音声入力       │
└─────┬───────────┘
      │
      ▼
┌─────────────────┐
│  Audio Blob     │
│  Creation       │
│  音声Blob作成   │
└─────┬───────────┘
      │
      ▼
┌─────────────────────────────────────────────────────────────┐
│                TranscriptionService.transcribe()            │
│                文字起こしサービス                           │
└─────┬───────────────────────────────────────────────────────┘
      │
      ▼
┌─────────────────┐    ┌──────────────────────────────────────┐
│ Language Check  │────│ buildTranscriptionPrompt(language)  │
│ 言語チェック    │    │ プロンプト構築                      │
└─────┬───────────┘    └──────────────────┬───────────────────┘
      │                                   │
      │ ┌─────────────────────────────────│──────────────────┐
      │ │                                 │                  │
      │ │ IF language === 'ja'            │                  │
      │ │ 日本語の場合:                   │                  │
      │ │                                 ▼                  │
      │ │     ┌───────────────────────────────────────────┐   │
      │ │     │ 以下の音声内容のみを文字に起こしてください │   │
      │ │     │ この指示文は出力に含めないでください      │   │
      │ │     │ 話者の発言内容だけを正確に記録してください │   │
      │ │     │                                           │   │
      │ │     │ 出力形式:                                │   │
      │ │     │ <TRANSCRIPT>                              │   │
      │ │     │ （話者の発言のみ）                       │   │
      │ │     │ </TRANSCRIPT>                             │   │
      │ │     └───────────────────────────────────────────┘   │
      │ │                                 │                  │
      │ │ ELSE (en/zh/ko/auto)            │                  │
      │ │ その他の言語:                   │                  │
      │ │                                 ▼                  │
      │ │     ┌───────────────────────────────────────────┐   │
      │ │     │ No Prompt Added                           │   │
      │ │     │ プロンプト追加なし                       │   │
      │ │     └───────────────────────────────────────────┘   │
      │ └─────────────────────────────────────────────────────┘
      │
      ▼
┌─────────────────────────────────────────────────────────────┐
│                   OpenAI API Request                        │
│                   OpenAI API リクエスト                     │
│                                                             │
│  FormData:                                                  │
│  ├─ file: audio.webm (Blob)                                │
│  ├─ model: gpt-4o-transcribe / gpt-4o-mini-transcribe      │
│  ├─ response_format: json                                   │
│  ├─ temperature: 0                                          │
│  ├─ language: ja/en/zh/ko (if not 'auto')                  │
│  └─ prompt: [Only for Japanese / 日本語のみ]                │
│                                                             │
│  Headers:                                                   │
│  └─ Authorization: Bearer ${apiKey}                         │
└─────┬───────────────────────────────────────────────────────┘
      │
      ▼
┌─────────────────────────────────────────────────────────────┐
│                   OpenAI API Response                       │
│                   OpenAI API レスポンス                     │
│                                                             │
│  { text: "transcribed text...", language: "detected" }     │
└─────┬───────────────────────────────────────────────────────┘
      │
      ▼
┌─────────────────────────────────────────────────────────────┐
│                cleanGPT4oResponse(text, language)           │
│                GPT-4oレスポンスクリーニング                 │
└─────┬───────────────────────────────────────────────────────┘
      │
      ▼
┌─────────────────────────────────────────────────────────────┐
│      Pre-strip TRANSCRIPT wrappers (mechanical extraction)  │
│      TRANSCRIPTラッパーの事前除去（完全/不完全に対応）       │
└─────┬───────────────────────────────────────────────────────┘
      │
      ▼
┌─────────────────────────────────────────────────────────────┐
│            StandardCleaningPipeline（安全判定付き）          │
│            クリーニング・パイプライン                        │
│                                                             │
│  1) PromptContaminationCleaner                              │
│     - TRANSCRIPT/TRANSCRIPTIONタグ残留の除去                 │
│     - 指示文（完全一致/スニペット/文脈）除去                 │
│                                                             │
│  2) UniversalRepetitionCleaner                              │
│     - 文字/記号/トークン/文/段落/列挙/末尾の反復抑制         │
│     - 最終整形（改行・空白の正規化など）                    │
│                                                             │
│  Safety / 安全装置:                                         │
│   - クリーナー単体の削減率上限、緊急ロールバック             │
│   - 構造除去の過剰ロールバック回避（緩和）                   │
└─────┬───────────────────────────────────────────────────────┘
      │
      ▼
┌─────────────────────────────────────────────────────────────┐
│              isPromptErrorDetected(text, language)          │
│              プロンプトエラー検出                           │
└─────┬───────────────────────────────────────────────────────┘
      │
      │ ┌─────────────────────────────────────────────────────┐
      │ │                                                     │
      │ │ Check for prompt leakage patterns:                  │
      │ │ プロンプト漏洩パターンをチェック:                   │
      │ │                                                     │
      │ │ Japanese (ja):                                      │
      │ │ • "この指示文は出力に含めないでください"           │
      │ │ • "話者の発言内容だけを正確に記録してください"     │
      │ │ • "（話者の発言のみ）"                            │
      │ │                                                     │
      │ │ English (en):                                       │
      │ │ • "Please transcribe only the speaker"             │
      │ │ • "Do not include this instruction"                │
      │ │ • "(Speaker content only)"                         │
      │ │                                                     │
      │ │ Chinese (zh):                                       │
      │ │ • "请仅转录说话者"                                  │
      │ │ • "不要包含此指令"                                  │
      │ │ • "（仅说话者内容）"                               │
      │ │                                                     │
      │ │ Korean (ko):                                        │
      │ │ • "화자의 발언만 전사해주세요"                     │
      │ │ • "이 지시사항을 포함하지 마세요"                  │
      │ │ • "（화자 발언만）"                               │
      │ └─────────────────────────────────────────────────────┘
      │
      ▼
┌─────────────────┐    ┌──────────────────────────────────────┐
│ If prompt error │ NO │ Continue to dictionary processing    │
│ detected?       │───▶│ 辞書処理へ続行                       │
│ プロンプトエラー│    └──────────────────┬───────────────────┘
│ 検出？          │                       │
└─────┬───────────┘                       │
      │ YES                               │
      ▼                                   │
┌─────────────────┐                       │
│ Return empty    │                       │
│ string          │                       │
│ 空文字を返す    │                       │
└─────────────────┘                       │
                                          │
                                          ▼
                        ┌─────────────────────────────────────┐
                        │ enableTranscriptionCorrection?     │
                        │ 文字起こし修正が有効？             │
                        └─────┬───────────────────────────────┘
                              │
                    ┌─────────┴─────────┐
                    │ YES               │ NO
                    ▼                   ▼
    ┌───────────────────────────────┐   ┌─────────────────┐
    │ DictionaryCorrector.correct() │   │ Skip correction │
    │ 辞書修正適用                  │   │ 修正をスキップ  │
    └─────┬─────────────────────────┘   └─────┬───────────┘
          │                                   │
          ▼                                   │
    ┌───────────────────────────────────────┐ │
    │ Apply multilingual corrections:       │ │
    │ 多言語修正を適用:                     │ │
    │                                       │ │
    │ 1. Default rules (empty by default)  │ │
    │    デフォルトルール（既定では空）     │ │
    │                                       │ │
    │ 2. Custom rules                       │ │
    │    カスタムルール                     │ │
    │                                       │ │
    │ 3. Dictionary corrections             │ │
    │    辞書修正:                          │ │
    │    • Fixed string replacements       │ │
    │    • Applied to ALL languages        │ │
    │    • 固定文字列置換                  │ │
    │    • 全言語に適用                    │ │
    │                                       │ │
    │ Examples:                             │ │
    │ • "AI" → "artificial intelligence"   │ │
    │ • "こんにちは" → "こんにちは（修正）" │ │
    │ • "你好" → "您好"                     │ │
    │ • "안녕" → "안녕하세요"               │ │
    └─────┬─────────────────────────────────┘ │
          │                                   │
          └───────────────┬───────────────────┘
                          │
                          ▼
                ┌─────────────────────────────────────┐
                │           Final Output              │
                │           最終出力                  │
                │                                     │
                │ TranscriptionResult {               │
                │   text: correctedText,              │
                │   originalText: originalText,       │
                │   duration: processingTime,         │
                │   model: "gpt-4o(-mini)-transcribe", │
                │   language: detectedLanguage        │
                │ }                                   │
                └─────────────────────────────────────┘
```

## Key Differences by Language / 言語による主な違い

### Japanese (ja) Processing / 日本語処理
1. **Prompt Addition**: Complex Japanese prompt with specific instructions
   - プロンプト追加: 特定の指示を含む複雑な日本語プロンプト
2. **Intensive Cleaning**: Multiple Japanese-specific patterns removed
   - 集約的クリーニング: 複数の日本語特有パターンの除去
3. **Error Detection**: Japanese prompt leakage patterns
   - エラー検出: 日本語プロンプト漏洩パターン

### Other Languages (en/zh/ko) Processing / その他の言語処理
1. **No Prompt**: Direct transcription without additional prompts
   - プロンプトなし: 追加プロンプトなしの直接文字起こし
2. **Conservative Cleaning**: Only generic colon-based patterns
   - 保守的クリーニング: コロンベースの汎用パターンのみ
3. **Language-specific Error Detection**: Each language has its own patterns
   - 言語固有のエラー検出: 各言語が独自のパターンを持つ

### Auto Language Processing / 自動言語処理
- Uses Japanese patterns as fallback for error detection
- エラー検出時は日本語パターンをフォールバックとして使用
- No prompt addition (treated as non-Japanese)
- プロンプト追加なし（非日本語として扱う）

## Dictionary Processing / 辞書処理

Dictionary correction is **language-agnostic** and applies to all languages when enabled:
辞書修正は**言語非依存**で、有効時は全言語に適用されます:

```
Dictionary Entry: { from: ["AI"], to: "artificial intelligence" }
辞書エントリ: { from: ["AI"], to: "artificial intelligence" }

Applied to:
適用対象:
✓ English: "AI system" → "artificial intelligence system"
✓ Japanese: "AIシステム" → "artificial intelligenceシステム"  
✓ Chinese: "AI系统" → "artificial intelligence系统"
✓ Korean: "AI시스템" → "artificial intelligence시스템"
```

## Processing Performance / 処理性能

The system logs detailed performance metrics:
システムは詳細なパフォーマンス指標をログに記録します:

- Audio blob size and type / 音声Blobサイズとタイプ
- Processing duration / 処理時間
- Original vs corrected text length / 元のテキストと修正後のテキスト長
- Model used and cost estimation / 使用モデルとコスト推定

## Error Handling / エラーハンドリング

The system handles various error scenarios:
システムは様々なエラーシナリオを処理します:

1. **API Errors**: Invalid key, quota exceeded, network errors
   - API エラー: 無効なキー、クォータ超過、ネットワークエラー
2. **Prompt Leakage**: Detection and mitigation of prompt content in output
   - プロンプト漏洩: 出力内のプロンプト内容の検出と軽減
3. **Empty Audio**: Graceful handling of silent or empty audio input
   - 空音声: 無音または空の音声入力の適切な処理

This visualization shows the complete flow from audio input to final transcribed and corrected text, highlighting the sophisticated language-specific processing that makes this plugin particularly effective for Japanese users while maintaining compatibility with other languages.

この可視化は、音声入力から最終的な文字起こし・修正テキストまでの完全なフローを示し、このプラグインが日本語ユーザーに特に効果的でありながら他言語との互換性を維持する洗練された言語固有処理を強調しています。
