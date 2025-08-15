# Voice Input Processing Flow / 音声入力処理フロー

This document reflects the latest implementation as of 2025‑08‑16. It covers the end‑to‑end flow: recording, queuing, transcription, cleaning with safety guards, and optional dictionary correction.

本ドキュメントは 2025‑08‑16 時点の実装に基づき、録音からキュー処理、文字起こし、セーフティ付きクリーニング、辞書補正までの一連の流れを記載します。

## High‑Level Overview / 全体概要

1) 音声取得 → 連続録音（最大録音時間到達または手動停止）。
2) 録音ごとに audioBlob を非同期キューへ投入（録音は継続可能）。
3) OpenAI Transcription API 呼び出し（ja/en/zh/ko には構造化プロンプト付与）。
4) 機械的な TRANSCRIPT ラッパー除去 → クリーニング・パイプライン（安全判定付き）。
5) プロンプトエラー検出（プロンプトのみが返った場合は空文字へ）。
6) 任意の辞書補正を適用し、UIへ反映。

---

## ASCII Overview / ASCII概要

```
           ┌──────────────────────────┐
           │  AudioRecorder (連続録音) │
           └─────────────┬────────────┘
                         │ audioBlob
                         ▼
           ┌──────────────────────────┐
           │ Processing Queue (直列化) │
           └─────────────┬────────────┘
                         │ audioBlob
                         ▼
┌──────────────────────────────────────────────────────────────┐
│            TranscriptionService.transcribeAudio()             │
├──────────────────────────────────────────────────────────────┤
│ 1) buildTranscriptionPrompt(lang)  ──► ja/en/zh/ko で付与      │
│ 2) POST (multipart/form-data)                                  │
│ 3) text 受領                                                   │
│ 4) preStripTranscriptWrappers(text)                            │
│ 5) StandardCleaningPipeline (安全判定付き)                     │
│    ├─ PromptContaminationCleaner（構造/指示/文脈/スニペット）   │
│    └─ UniversalRepetitionCleaner（反復・体裁）                 │
│ 6) isPromptErrorDetected(text, lang)（プロンプトエコー検出）   │
│ 7) DictionaryCorrector（任意）                                 │
└──────────────────────────────────────────────────────────────┘
```

---

## Recording Path Details / 録音パス詳細

実装参照: `src/core/audio/AudioRecorder.ts`, `src/views/VoiceInputViewActions.ts`, `src/views/VoiceInputViewUI.ts`

- AudioContext 初期化
  - `window.AudioContext`（Safari は `webkitAudioContext`）を使用。
  - `AudioWorklet` が利用可能ならワークレット、不可なら `ScriptProcessor` へフォールバック。
  - `suspended` 状態の場合は `startRecording()` で `resume()` を実行。
- フィルタ/ノード構成
  - `MediaStreamSource → Gain → HighPass(約80Hz) → LowPass(約7.6kHz) → Analyser`
  - ビジュアライザは `Analyser` に接続（シンプル/通常の2種）。
- 連続処理
  - ワークレット/スクリプトプロセッサで 1ch PCM を取り出し、`AudioRingBuffer` に蓄積。
  - マイク実データ検知で `onMicrophoneStatusChange('ready')` 通知。
- 録音制御
  - 既定は VAD 無効の連続録音。`maxRecordingSeconds` 到達で自動停止。
  - 二重開始は `AudioRecorder.isStarting` で抑止。UI側のロックはエントリポイントのみで軽量化。
- UI/操作
  - 通常クリックで開始/停止。プッシュトゥトークは長押しで開始、離して停止（`UI_CONSTANTS.PUSH_TO_TALK_THRESHOLD`）。

---

## Queue & UI / キューとUI

実装参照: `src/views/VoiceInputViewActions.ts`

- 停止ごとに生成された `audioBlob` を `processingQueue` へ追加し、逐次処理。
- ステータス表示は「録音中/処理中/待機数」を反映。キャンセルは録音を中断して音声を破棄。
- 途中で録音を継続しながら、既存キューをバックグラウンドで順次文字起こし可能。

---

## Transcription Path / 文字起こしパス

実装参照: `src/core/transcription/TranscriptionService.ts`

1) リクエスト作成（`multipart/form-data`）
   - `file: audio.webm(Blob)`, `model: gpt-4o(-mini)-transcribe`, `response_format: json`, `temperature: 0`, `language`。
   - 言語に応じて構造化プロンプトを付与（ja/en/zh/ko）。
2) API レスポンスから `text` を取得。
3) `cleanGPT4oResponse(text, language)` を実行。
   - 先に機械的に TRANSCRIPT ラッパーを剥離（完全/不完全タグ双方に対応）。
   - クリーニング・パイプラインを実行（詳細は後述）。
4) プロンプトエラー検出
   - 言語別の検出ルールにより、プロンプトや注釈のみが返るケースを検知。
   - 検出時は空文字に置換して早期終了（無音/極短音声で発生しやすい）。
5) 辞書補正（有効時）
   - `DictionaryCorrector` により語彙の統一・置換を実施。

---

## Cleaning Pipeline / クリーニング・パイプライン

実装参照: `src/core/transcription/cleaning/StandardCleaningPipeline.ts`

- 構成
  1) `PromptContaminationCleaner`
     - TRANSCRIPT/TRANSCRIPTION タグ残留、指示文（完全一致/スニペット/文脈）、フォーマット行の除去。
     - 空行/空白の正規化。
  2) `UniversalRepetitionCleaner`
     - 文字/文/列挙/段落レベルの反復抑制、末尾ハルシネーション緩和、体裁整形。

- セーフティ（安全判定）
  - 設定値（`src/config/CleaningConfig.ts`）
    - `singleCleanerMaxReduction`: 0.3（単一クリーナーの削減率上限）
    - `emergencyFallbackThreshold`: 0.5（緊急ロールバック閾値）
    - `warningThreshold`: 0.15（警告ログ）
  - 構造的クリーナー緩和（`PromptContaminationCleaner` に適用）
    - `singleCleanerMaxReduction → max(0.9, 0.3) = 0.9`
    - `emergencyFallbackThreshold → max(0.95, 0.5) = 0.95`
  - 超過時の動作
    - 単一上限（single）超過 → `skip`（そのクリーナーの変更を適用しない）
    - 緊急（emergency）超過 → `rollback`（そのクリーナーの結果を破棄して元のテキストに戻す）

例（ログ）:
```
[Voice Transcription] [StandardCleaningPipeline] Rolling back cleaner PromptContaminationCleaner {
  reason: 'Reduction ratio 1.000 exceeds emergency threshold 0.95',
  reductionRatio: 1
}
```
意味: 構造的クリーナーが 95% 超の削減を行おうとしたため、安全装置によりロールバックされました。上流で「実発話が少ない/無い」状態（無音、極短、プロンプトエコー等）が疑われます。

---

## Language‑by‑Language / 言語別の違いと共通点

```
                 (選択された言語: ja / en / zh / ko)
                                 │
                                 ▼
             ┌──────────────────────────────┐
             │  構造化プロンプトの内容が言語別 │  ← 違い（プロンプト文面）
             └──────────────┬───────────────┘
                            ▼
┌──────────────────────────────────────────────────────────────┐
│ preStripTranscriptWrappers（機械的ラッパー除去）              │  ← 共通（言語非依存）
├──────────────────────────────────────────────────────────────┤
│ StandardCleaningPipeline                                      │
│  ├─ PromptContaminationCleaner                                │
│  │    ・instructionPatterns: 多言語（ja/en/zh/ko）            │  ← 共通（多言語対応）
│  │    ・snippet検出: EN/ZH/KO 追加語彙 + JA レガシー保護     │  ← ほぼ共通（内部最適化）
│  └─ UniversalRepetitionCleaner                                │  ← 共通（言語非依存）
├──────────────────────────────────────────────────────────────┤
│ isPromptErrorDetected(text, lang)                              │
│   ・各言語のエコー特有フレーズで検出                          │  ← 違い（検出語句が言語別）
├──────────────────────────────────────────────────────────────┤
│ DictionaryCorrector（任意）                                   │  ← 共通（言語非依存）
└──────────────────────────────────────────────────────────────┘
```

- 違い（language‑specific）
  - プロンプト文面（`buildTranscriptionPrompt`）は ja/en/zh/ko で固有。
  - プロンプトエコー検出（`isPromptErrorDetected`）は各言語の固定句で評価。
  - スニペット検出は EN/ZH/KO の接尾語語彙を追加し、JA にはレガシーパターンを併用。

- 共通（language‑agnostic）
  - pre-strip（ラッパー除去）は構造ベースで言語に依存しない。
  - クリーニング・パイプラインの安全判定（single/ emergency しきい値）は全言語共通。
  - UniversalRepetitionCleaner と辞書補正は言語非依存ロジック。
  - API パラメータ（multipart、temperature=0 等）は共通（model は選択式）。

注意: `auto` は廃止。UI/設定で言語を明示し、該当言語のプロンプトと検出ロジックを適用します。

---

## Dictionary Processing / 辞書処理

- 有効時、言語非依存で置換を適用。
- 例:
```
{ from: ["AI"], to: "artificial intelligence" }

EN: "AI system" → "artificial intelligence system"
JA: "AIシステム" → "artificial intelligenceシステム"
ZH: "AI系统" → "artificial intelligence系统"
KO: "AI시스템" → "artificial intelligence시스템"
```

---

## Status & Metrics / ステータスと計測

- ステータス: 録音準備/録音中/処理中（待機数付き）/完了/エラー。
- メトリクス: 音声サイズ、処理時間、原文/補正後の長さ、モデル、出力長などをログ出力。

---

## Error Handling / エラーハンドリング

1) API エラー: 401（キー不正）、429（クォータ超過）、5xx（ネットワーク/サーバ）
2) プロンプト漏洩: 言語別検出 → 空文字化で軽減
3) 空/無音: 早期終了で空文字返却、UIに短すぎ警告
4) クリーニング安全装置: 過剰削減を検知してスキップ/ロールバック

---

## Notes / 補足

- 既定は VAD 無効の連続録音。必要に応じて `maxRecordingSeconds` を調整してください。
- 連打・素早い操作でも安定するよう、開始の二重実行は内部ガードで抑止しています。
- 「開始しにくい」挙動を避けるため、UIロックは最小限に留めています。
