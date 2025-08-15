# Voice Input Processing Flow / 音声入力処理フロー

This document describes the current processing pipeline of the voice input system. As of 2025-08-15, the system supports multilingual prompts for ja/en/zh/ko languages, followed by mechanical TRANSCRIPT wrapper stripping, safety-guarded cleaning pipeline, and optional dictionary correction.

このドキュメントは最新の音声入力処理パイプラインを説明します。2025-08-15 時点では、日本語/英語/中国語/韓国語の多言語プロンプトをサポートし、その後に機械的な TRANSCRIPT ラッパー除去、安全装置付きのクリーニング・パイプライン、任意の辞書補正を実行します。

## Updated Overview (Current) / 最新の概要

1) Audio → OpenAI Transcription API（**全言語 ja/en/zh/ko にプロンプト付与**）。
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
      │ │ IF language === 'auto'          │                  │
      │ │ 自動検出の場合:                 │                  │
      │ │                                 ▼                  │
      │ │     ┌───────────────────────────────────────────┐   │
      │ │     │ No Prompt Added                           │   │
      │ │     │ プロンプト追加なし                       │   │
      │ │     │ (言語検出に干渉しない)                   │   │
      │ │     └───────────────────────────────────────────┘   │
      │ │                                 │                  │
      │ │ ELSE (ja/en/zh/ko)              │                  │
      │ │ 対応言語の場合:                 │                  │
      │ │                                 ▼                  │
      │ │     ┌───────────────────────────────────────────┐   │
      │ │     │ Structured Multilingual Prompts          │   │
      │ │     │ 構造化多言語プロンプト                   │   │
      │ │     │                                           │   │
      │ │     │ 日本語: 以下の音声内容のみを文字に...     │   │
      │ │     │ English: Please transcribe only the...   │   │
      │ │     │ 中文: 请仅转录以下音频内容...             │   │
      │ │     │ 한국어: 다음 음성 내용만 전사해주세요...  │   │
      │ │     │                                           │   │
      │ │     │ Format: INSTRUCTION×2 + OUTPUT_FORMAT     │   │
      │ │     │         + <TRANSCRIPT> + SPEAKER_ONLY     │   │
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
│  └─ prompt: [Multilingual prompts for ja/en/zh/ko]         │
│             [多言語プロンプト（ja/en/zh/ko用）]            │
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

### All Supported Languages (ja/en/zh/ko) Processing / 全対応言語処理
1. **Prompt Addition**: Structured prompts with language-specific instructions
   - プロンプト追加: 言語固有の指示を含む構造化プロンプト
2. **Comprehensive Cleaning**: Language-aware pattern removal via PromptContaminationCleaner
   - 包括的クリーニング: PromptContaminationCleaner による言語認識パターン除去
3. **Error Detection**: Language-specific prompt leakage patterns
   - エラー検出: 言語固有のプロンプト漏洩パターン

### Auto Language Processing / 自動言語処理
- Uses Japanese patterns as fallback for error detection
- エラー検出時は日本語パターンをフォールバックとして使用
- No prompt addition (prevents interference with language detection)
- プロンプト追加なし（言語検出への干渉を防ぐ）

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

This visualization shows the complete flow from audio input to final transcribed and corrected text, highlighting the sophisticated multilingual processing that makes this plugin effective for users of Japanese, English, Chinese, and Korean languages while maintaining auto-detection compatibility.

この可視化は、音声入力から最終的な文字起こし・修正テキストまでの完全なフローを示し、このプラグインが日本語、英語、中国語、韓国語のユーザーに効果的でありながら自動検出との互換性を維持する洗練された多言語処理を強調しています。
