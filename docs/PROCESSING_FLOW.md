本ドキュメントは最新実装に基づき、設計時の参照用として録音からキュー処理、文字起こし、セーフティ付きクリーニング、辞書補正までの流れ、主要コンポーネント、データ構造、安全装置を体系的に説明します。

Contents / 目次
- High‑Level Overview / 全体概要
- System Architecture & Key Components / アーキテクチャと主要コンポーネント
- End‑to‑End Sequence / エンドツーエンドの逐次フロー
- Recording Path / 録音パス
- Processing Queue / キュー処理
- Transcription Path / 文字起こしパス
- Cleaning Pipeline & Safety / クリーニングと安全装置
- Prompt Error Detection / プロンプトエラー検出
- Dictionary Processing / 辞書処理
- Error Handling / エラーハンドリング
- Metrics & Logging / 計測とログ
- Configuration & Defaults / 設定とデフォルト
- Performance Notes / パフォーマンス
- Manual Validation Checklist / 手動検証チェックリスト
- Edge Cases & Troubleshooting / エッジケースと対処
- Extension Points / 拡張ポイント
- Glossary / 用語集


## High‑Level Overview / 全体概要

1) 音声取得 → 連続録音（最大録音時間到達または手動停止）。
2) 停止ごとに `audioBlob` を非同期の直列キューへ投入（録音は継続可能）。
3) OpenAI Transcription API 呼び出し（ja/en/zh/ko には構造化プロンプト付与）。
4) 機械的な TRANSCRIPT ラッパー除去 → クリーニング・パイプライン（安全判定付き）。
5) プロンプトエラー検出（プロンプトのみが返った場合は空文字へ）。
6) 任意の辞書補正を適用し、UIへ反映。

ASCII overview:
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


## System Architecture & Key Components / アーキテクチャと主要コンポーネント

- UI Layer
  - `src/views/VoiceInputView.ts` 主ビュー（レイアウト/ライフサイクル）
  - `src/views/VoiceInputViewUI.ts` UI生成とイベント結線
  - `src/views/VoiceInputViewActions.ts` 録音・キュー・API・挿入等の操作中枢

- Core: Audio
  - `src/core/audio/AudioRecorder.ts` 連続録音、AudioWorklet/ScriptProcessor、フィルタ、リングバッファ、可視化連携
  - `src/core/audio/AudioRingBuffer.ts` 音声リングバッファ
  - `src/core/audio/AudioVisualizer.ts` 波形/レベル表示（2種）

- Core: Transcription & Cleaning
  - `src/core/transcription/TranscriptionService.ts` API呼び出し、プロンプト付与、クリーニング、辞書補正
  - `src/core/transcription/DictionaryCorrector.ts` 固定置換ベースの辞書補正
  - `src/core/transcription/cleaning/*` クリーナー群と標準パイプライン

- Config & Defaults
  - `src/config/constants.ts`, `defaults.ts`, `costs.ts`, `CleaningConfig.ts`

- Errors & Services
  - `src/errors/*` エラー型・通知
  - `src/services/*` ServiceLocator, I18n, HTTPクライアント

- Managers
  - `src/managers/DraftManager.ts` 下書き保存/復元
  - `src/managers/ViewManager.ts` ビュー管理


## End‑to‑End Sequence / エンドツーエンドの逐次フロー

1. ユーザーが Record ボタン操作
   - `VoiceInputViewUI` が `VoiceInputViewActions.toggleRecording()` を呼ぶ
2. 録音開始
   - `AudioRecorder.initialize()` → WebAudioセットアップ（Gain/HPF/LPF/Analyser）
   - AudioWorklet利用可能なら `audio-processor-worklet`、不可なら ScriptProcessor
   - `MediaRecorder.start(timeslice=100ms)` で WebM/Opus を分割収集
3. 最大時間到達 or 手動停止
   - `AudioRecorder.stopRecording()` → `Blob`（audio/webm）生成 → `onSpeechEnd` 経由で通知
4. キュー投入
   - `VoiceInputViewActions.processRecordedAudio()` が `processingQueue` に追加
   - バックグラウンドで直列処理 `processQueue()` 実行
5. 文字起こし
   - `TranscriptionService.transcribeAudio()` が `FormData` を構築し API へ送信
   - 応答 `text` を取得 → `cleanGPT4oResponse()`
   - `preStripTranscriptWrappers()` → `StandardCleaningPipeline.execute()` → `isPromptErrorDetected()` → `DictionaryCorrector.correct()`
6. UI反映
   - `VoiceInputViewUI.textArea` に追記、下書き保存、ステータス更新


## Recording Path / 録音パス

実装参照: `src/core/audio/AudioRecorder.ts`, `src/views/VoiceInputViewActions.ts`, `src/views/VoiceInputViewUI.ts`

- AudioContext 初期化
  - `window.AudioContext`（Safari は `webkitAudioContext`）
  - `latencyHint='interactive'`, `sampleRate=16000`
  - `AudioWorklet` 利用試行 → 失敗時は `ScriptProcessor` へフォールバック
- ノード構成
  - `MediaStreamSource → Gain → HighPass(80Hz) → LowPass(7.6kHz) → Analyser`
  - 可視化: `AudioVisualizer` or `SimpleAudioLevelIndicator`
- 連続処理
  - 1ch PCM をリングバッファへ蓄積（`AudioRingBuffer`）
  - マイク有効データの検出で `onMicrophoneStatusChange('ready')`
- 録音制御
  - 既定は VAD 無効の連続録音（`useVAD=false`）
  - `maxRecordingSeconds` 到達で自動停止
  - 二重開始は `isStarting` ガードで抑止
- UI/操作
  - クリック開始/停止 + 長押し Push‑to‑Talk（閾値: `UI_CONSTANTS.PUSH_TO_TALK_THRESHOLD`）


State model（簡略）:
- idle → initializing → recording → stopping → idle
- 例外時は error 表示後に idle 復帰


## Processing Queue / キュー処理

実装参照: `src/views/VoiceInputViewActions.ts`

- データ構造
  - `RecordingState.processingQueue: Array<{ audioBlob, timestamp, stopReason }>`
- 挙動
  - `processRecordedAudio()` がキューに追加し、`processQueue()` で直列処理
  - 録音継続中でもキュー処理はバックグラウンドで進行
- ステータス
  - 処理中/待機数を `statusEl` に表示（例: "Transcribing... (2 waiting)"）
- キャンセル
  - 録音中断は `cancelRecording()`（収集済み音声は破棄）


## Transcription Path / 文字起こしパス

実装参照: `src/core/transcription/TranscriptionService.ts`

1) リクエスト作成（multipart/form-data）
   - fields:
     - `file: audio.webm (Blob)`
     - `model: 'gpt-4o-transcribe' | 'gpt-4o-mini-transcribe'`
     - `response_format: 'json'`
     - `temperature: 0`
     - `language: 'ja'|'en'|'zh'|'ko'`（auto は廃止）
     - `prompt: 構造化プロンプト（ja/en/zh/ko 対応）`
   - 送信先: `API_CONSTANTS.ENDPOINTS.TRANSCRIPTION`
   - 送信手段: `ObsidianHttpClient.postFormData()`（独自 boundary 付与）

2) レスポンス処理
   - `response.json.text` を取得（なければ `text` 文字列も許容）
   - `cleanGPT4oResponse(text, language)` 実行
     - `preStripTranscriptWrappers()` で `<TRANSCRIPT>...</TRANSCRIPT>` 抽出/除去
     - `StandardCleaningPipeline` 実行
     - `isPromptErrorDetected(text, lang)` に該当すれば空文字で早期終了
     - 有効時 `DictionaryCorrector` 適用

3) エラー分類
   - 401 → `INVALID_API_KEY`
   - 429 → `API_QUOTA_EXCEEDED`
   - 5xx → `NETWORK_ERROR`
   - それ以外 → `TRANSCRIPTION_FAILED`

サンプル: 成功時の最小レスポンス（概念例）
```
{ "text": "こんにちは。今日の予定は..." , "language": "ja" }
```


## Cleaning Pipeline & Safety / クリーニングと安全装置

実装参照:
- `src/core/transcription/cleaning/StandardCleaningPipeline.ts`
- `src/core/transcription/cleaning/PromptContaminationCleaner.ts`
- `src/core/transcription/cleaning/UniversalRepetitionCleaner.ts`
- `src/config/CleaningConfig.ts`

構成:
- 前処理（言語非依存）
  - `preStripTranscriptWrappers()`:
    - `<TRANSCRIPT>...</TRANSCRIPT>` 完全/不完全タグから中身抽出
    - 残存タグ除去（TRANSCRIPT/transcription/transcription系）
- パイプライン（順次実行）
  1) `PromptContaminationCleaner`
     - 指示文・フォーマット行・スニペット・XML/タグ・「話者のみ」等の構造物を除去
     - 多言語 instructionPatterns と snippet 検出（EN/ZH/KO 語彙 + JA レガシー）
  2) `UniversalRepetitionCleaner`
     - 文字/トークン/文/段落/列挙/末尾反復の抑制と体裁整形（言語非依存）

セーフティ（安全判定）:
- 設定（`CLEANING_CONFIG.safety`）
  - `singleCleanerMaxReduction: 0.3`
  - `emergencyFallbackThreshold: 0.5`
  - `warningThreshold: 0.15`
- 構造的クリーナー緩和（PromptContaminationCleaner に適用）
  - 単一上限: `max(0.9, 0.3) = 0.9`
  - 緊急閾値: `max(0.95, 0.5) = 0.95`
- 超過時の動作
  - Single 超過 → `skip`（当該クリーナーの変更を適用しない）
  - Emergency 超過 → `rollback`（元テキストへ差し戻し）
- パイプライン全体の最終セーフティも実行（全体削減率が異常なら原文へ戻す）

ログ例:
```
[Voice Transcription] [StandardCleaningPipeline] Rolling back cleaner PromptContaminationCleaner {
  reason: 'Reduction ratio 1.000 exceeds emergency threshold 0.95',
  reductionRatio: 1
}
```
意味: 上流で「実発話が少ない/無い」（無音/極短/プロンプトエコー）可能性が高い。


実例（Before → After 概念例）:
- Before:
  ```
  Output format:
  <TRANSCRIPT>
  （話者の発言のみ）
  今日は晴れです。今日は晴れです。今日は晴れです。。。。。
  </TRANSCRIPT>
  ```
- After:
  ```
  今日は晴れです。
  ```


## Prompt Error Detection / プロンプトエラー検出

実装参照: `TranscriptionService.isPromptErrorDetected()`

- 言語別の固定句や「SPEAKER ONLY」等がそのまま返るケースを検知
- 検出時は空文字へ置換し早期終了（UI は「No audio detected」等を表示）

注意:
- `auto` は廃止。UI/設定で明示言語（ja/en/zh/ko）を選択し、該当のプロンプトと検出ロジックを適用


## Dictionary Processing / 辞書処理

実装参照: `src/core/transcription/DictionaryCorrector.ts`, `src/interfaces/transcription.ts`

- 固定置換（definiteCorrections）のみをサポート
- 設定値・制限（`DICTIONARY_CONSTANTS`）
  - 最大個数（固定補正）: 200
- 多言語に同一置換を適用（言語非依存）

例:
```
{ from: ["AI"], to: "artificial intelligence" }

EN: "AI system" → "artificial intelligence system"
JA: "AIシステム" → "artificial intelligenceシステム"
ZH: "AI系统" → "artificial intelligence系统"
KO: "AI시스템" → "artificial intelligence시스템"
```

UIで表形式の編集/インポート/エクスポートに対応（全言語UIで利用可能）。


## Error Handling / エラーハンドリング

実装参照: `src/errors/*`, `src/services/*`

- エラー型: `TranscriptionErrorType`
  - PERMISSION_DENIED, NETWORK_ERROR, API_QUOTA_EXCEEDED, INVALID_API_KEY, AUDIO_* 他
- 通知: `Notice` によるユーザー表示（i18n 対応）
- グローバル: `ErrorHandler` が未処理例外/Promise拒否を収集しログ化
- API ステータスからの分類:
  - 401 → INVALID_API_KEY
  - 429 → API_QUOTA_EXCEEDED
  - 5xx → NETWORK_ERROR
  - その他 → TRANSCRIPTION_FAILED
- 無音/極短データ: 早期終了で空文字返却 + UI で「音声が検出されませんでした」


## Metrics & Logging / 計測とログ

実装参照: `src/utils/Logger.ts`

- 共通プリフィクス: `[Voice Transcription]`
- 主要ログポイント
  - 録音開始/終了、サンプルレート、チャンク数、所要時間
  - リングバッファ使用率（確率的に警告）
  - API呼び出しモデル/言語/入力サイズ/出力長/時間
  - クリーニング各段の削減率/処理時間/セーフティ判定
- ログレベルは設定に従い、開発モードで詳細化


## Configuration & Defaults / 設定とデフォルト

- 定数: `src/config/constants.ts`
  - Audio: SAMPLE_RATE=16000, BUFFER_SIZE=4096, MAX_RECORDING_SECONDS=300, FILTERS(HPF=80Hz/LPF=7.6kHz), WEBM_CODEC, RECORDER_TIMESLICE=100ms
  - API: `TRANSCRIPTION` エンドポイント、temperature=0
  - UI: Push‑to‑Talk 閾値=300ms ほか
- デフォルト: `src/config/defaults.ts`
  - 文字起こしモデル: `gpt-4o-transcribe`
  - 補正有効化: true
  - VAD デフォルトは存在するが録音は既定で VAD 無効の連続録音
- コスト: `src/config/costs.ts`
  - 参考: 4o‑transcribe=$0.06/min, 4o‑mini‑transcribe=$0.03/min


## Performance Notes / パフォーマンス

- WebAudio
  - `latencyHint='interactive'` で起動体感改善
  - HPF/LPF により音声帯域へ制限し雑音影響を軽減
- MediaRecorder
  - 100ms timeslice で小刻み収集し停止時の結合負荷を低減
- クリーニング
  - 早期のラッパー剥離で後段の削減率を安定化
  - セーフティにより過剰削除を抑制（skip/rollback）
- UI/操作感
  - プッシュトゥトークは長押し→離すで録音区間を素早く収集
  - キュー直列処理により安定した逐次反映


## Manual Validation Checklist / 手動検証チェックリスト

ビルド/検証（`public/.github/copilot-instructions.md` 準拠）:
- Build Success
  - `npm run build` 後、`build/latest/main.js` が生成される（~128KB）
- Lint Compliance
  - `npm run lint`（~10 warnings, 0 errors 目安）
- Tests
  - `npm run test`（182 近辺のテスト、時間 ~17s）
- Packaging
  - `npm run build-plugin` 後、`build/latest/` に `main.js/manifest.json/styles.css/fvad.wasm/fvad.js`
- WASM 配布確認
  - `src/lib/fvad-wasm/` の `fvad.wasm` と `fvad.js` が出力に含まれる

動作確認:
- 文字起こし成功（言語=設定値、モデル=設定値）
- 無音/極短音声で空結果を返し UI が警告
- クリーニングの安全装置ログが想定通り（過剰削減は skip/rollback）
- 下書きの自動保存/復元が機能


## Edge Cases & Troubleshooting / エッジケースと対処

- マイクトラックが muted で始まる（Windows 等）
  - `AudioRecorder` が mute/unmute を監視し、音声検出時に `ready` 通知
- 極小 `audioBlob`（~<500B）
  - ヘッダのみの可能性 → 早期終了 + UI 警告
- プロンプトエコー（モデルがプロンプトを返す）
  - `isPromptErrorDetected()` が空文字へ置換
- TRANSCRIPT タグしか無い/内容が空
  - `PromptContaminationCleaner` による削除でほぼ全削除 → セーフティで rollback
- Obsidian Deferred Views（1.7.2+）
  - `DeferredViewHelper` で安全に leaf/view を扱う


## Extension Points / 拡張ポイント

- クリーナーの追加
  - `StandardCleaningPipeline.addCleaner(new MyCleaner())`
  - セーフティ閾値は `CLEANING_CONFIG` に集約
- 置換辞書の拡張
  - UI から `definiteCorrections` を編集/Import/Export
  - プログラムからは `TranscriptionService.setCustomDictionary()`
- モデル切替
  - UI（設定パネル）で 4o / 4o‑mini を動的に切替


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
  - プロンプト文面（`buildTranscriptionPrompt`）
  - プロンプトエコー検出（`isPromptErrorDetected`）
- 共通（language‑agnostic）
  - TRANSCRIPT ラッパー除去
  - セーフティ判定と反復抑制
  - 辞書補正


## API Contracts & Data Shapes / API とデータ構造（要点）

Request (multipart/form-data fields):
- file: Blob (audio/webm; codecs=opus)
- model: 'gpt-4o-transcribe' | 'gpt-4o-mini-transcribe'
- language: 'ja'|'en'|'zh'|'ko'
- response_format: 'json'
- temperature: '0'
- prompt: string (言語別の構造化プロンプト)

Response (主要):
- text: string
- language: string（オプション。なければ UI 設定言語を採用）


## Examples & Logs / 例とログ

- クリーニング高削減率の警告:
  - `High reduction ratio in PromptContaminationCleaner reductionRatio=0.220 threshold=0.15`
- リングバッファ警告:
  - `Audio buffer usage high: 82.4%`


## Notes / 補足

- 既定は VAD 無効の連続録音。必要に応じて `maxRecordingSeconds` を調整
- 二重開始抑止や UI ロックは最小限にし、操作性を重視
- Obsidian 環境では `requestUrl` を使用し CORS を回避
- セキュアコンテキスト判定はブラウザではなく Obsidian の前提でスキップ


## Glossary / 用語集

- TRANSCRIPT ラッパー: `<TRANSCRIPT> ... </TRANSCRIPT>` のようなXML風タグ。モデル出力の安定化のためプロンプトで使用
- セーフティ（Safety）: クリーニングでの過剰削除を防ぐ skip/rollback のしきい値判定
- プロンプトエコー: モデルが指示文やフォーマット見出しをそのまま出力してしまう現象
- 反復抑制: 文やトークンの過剰反復を抑える整形ロジック
