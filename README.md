# Voice Input Plugin for Obsidian

High-accuracy multilingual voice input for Obsidian. Uses OpenAI GPT-4o Audio Transcriptions to transcribe speech (with tuned prompts for ja/en/zh/ko) and insert into your notes with one click or push-to-talk.

## Features

- One‑click recording: start/stop from a microphone ribbon icon
- Push‑to‑talk: long‑press to record, release to stop
- Model selection: GPT‑4o Transcribe or GPT‑4o mini Transcribe
- Language separation: independent UI language and voice recognition language settings
- Language linking: voice recognition follows the UI locale (ja/en/zh/ko) with optional overrides
- AI post‑processing: optional dictionary-based cleanup (applied to all languages when enabled)
- Quick controls in view: copy/clear/insert at cursor/append to end
- Auto‑save drafts: periodic and on blur, automatic restore
- Multilingual support: Japanese, English, Chinese, Korean interface languages
- Voice activity detection modes: Off by default for maximum accuracy, plus optional server-side chunking or local auto-stop when you install fvad.wasm/fvad.js

## Requirements

- OpenAI API key (Audio Transcriptions)
- Internet connectivity
- Obsidian desktop (Windows/macOS). This plugin is desktop‑only.

Note: OpenAI usage is billed by API.

## Installation (manual)

1. Download the latest assets from Releases
2. Copy `main.js`, `manifest.json`, `styles.css` (add `fvad.wasm` and `fvad.js` only if you plan to enable Local VAD)
3. Place them under `<vault>/.obsidian/plugins/voice-input/`
4. Restart Obsidian and enable the plugin

## Commands

- Open Voice Input (`open-voice-input`): opens the Voice Input view. Assign a hotkey from Obsidian’s Settings → Hotkeys if desired.

## Usage

1) Open the view
- Click the microphone ribbon icon, or run “Open Voice Input”.

2) Record
- Click “Start Voice Input” to toggle recording, or use push‑to‑talk: long‑press the record button (starts after a short threshold), release to stop.

3) Use the result
- Copy, Insert at Cursor, or Append to End of the active note. Clear resets the area.

Tip: A settings gear in the view header opens the plugin’s settings.

## Settings

- OpenAI API Key: stored locally (encrypted at rest)
- Transcription Model: `gpt-4o-transcribe` or `gpt-4o-mini-transcribe`
- **Transcription Language**: Japanese/English/Chinese/Korean (defaults to the UI language when linking is enabled; advanced settings let you override per language)
- AI Post‑processing: enable dictionary‑based cleanup (applied to all languages when enabled)
- Maximum Recording Duration: slider (default 5 min)
- Plugin Language: Japanese/English/Chinese/Korean (controls UI display only, auto-detected from Obsidian, adjustable)
- Voice Activity Detection: choose Off (default), Server (faster turnaround), or Local (requires `fvad.wasm`/`fvad.js`)

## Security & Privacy

- Processing in memory; audio is not written to disk by the plugin
- Audio you record is transmitted to OpenAI for transcription over HTTPS (via Obsidian’s `requestUrl`).
- API key is encrypted for storage

Note: When Electron SafeStorage is unavailable, the plugin falls back to lightweight obfuscation for the stored key; the plugin is desktop‑only by design.

See also OpenAI’s Privacy Policy.

## Troubleshooting

- Microphone not recognized: allow mic access and restart Obsidian
- Transcription fails: verify API key, connectivity, and OpenAI credit
- Quiet audio: move closer to the mic and reduce background noise
 - Deploy didn’t find your vault: open the vault in Obsidian once so it appears in `obsidian.json`, then re‑run `npm run deploy`.

## Development

- Install deps: `npm ci`
- Build: `npm run build-plugin` (outputs `build/latest/`)
- Deploy locally: `npm run deploy` (alias: `npm run deploy-local`) — vaults are auto‑detected from Obsidian's config (and a few common locations as fallback). Works for iCloud or local vaults alike.
- Analyze unused code (build-time): `npm run analyze:unused`

### Documentation

- Processing flow visualization: see [`docs/PROCESSING_FLOW.md`](docs/PROCESSING_FLOW.md)

Third‑party licensing: see `THIRD_PARTY_LICENSES.md`.

—

# Voice Input Plugin for Obsidian（日本語）

高精度な多言語音声認識でメモを作成できるプラグインです。OpenAI GPT‑4o Audio Transcriptions を利用し、日・英・中・韓向けに調整したプロンプトで文字起こしを行います。

## 機能

- ワンクリック録音（リボンのマイクアイコン）
- プッシュトゥトーク（長押しで録音開始、離して停止）
- モデル選択（GPT‑4o Transcribe / GPT‑4o mini Transcribe）
- 言語設定の分離（UI言語と音声認識言語を独立設定）
- 言語リンク（UIロケールに合わせて音声認識言語を自動追従。高度設定で個別指定も可能）
- AI後処理（辞書ベースの補正。全言語に適用可能）
- ビュー内のクイック操作（コピー/クリア/カーソル位置へ挿入/末尾へ追記）
- 自動保存（定期保存とフォーカス外れ時）。再オープン時に自動復元
- 多言語サポート（日本語、英語、中国語、韓国語のインターフェース）
- VADモード選択（標準はオフ。必要に応じてサーバーVADや `fvad.wasm` / `fvad.js` を使ったローカルVADを利用可能）

## 必要条件

- OpenAI APIキー（Audio Transcriptions）
- インターネット接続
- Obsidianデスクトップ版（Windows/macOS）。本プラグインはデスクトップ専用です。

※ OpenAI APIの利用には課金が発生します。

## インストール（手動）

1. Releases から最新版を取得
2. `main.js`、`manifest.json`、`styles.css`（ローカルVADを使う場合のみ `fvad.wasm` と `fvad.js` も）を配置
3. `<Vault>/.obsidian/plugins/voice-input/` に置く
4. Obsidianを再起動し、プラグインを有効化

## コマンド

- Open Voice Input（`open-voice-input`）: 音声入力ビューを開きます。必要に応じてホットキーを割り当ててください。

## 使い方

1) ビューを開く
- リボンのマイクアイコンをクリック、またはコマンドパレットから “Open Voice Input”。

2) 録音
- 「音声入力開始」でトグル録音、またはプッシュトゥトーク（ボタン長押しで短い閾値後に録音開始、指を離すと停止）。

3) 結果の利用
- コピー、カーソル位置へ挿入、末尾へ追記。クリアでテキストエリアを初期化。

ヒント: ビューのヘッダにある歯車ボタンから設定を開けます。

## 設定

- OpenAI APIキー: ローカルに暗号化して保存
- 文字起こしモデル: `gpt-4o-transcribe` または `gpt-4o-mini-transcribe`
- **音声認識言語**: 日本語/英語/中国語/韓国語（既定ではUI言語にリンクし、高度設定で個別指定が可能）
- AI後処理: 辞書ベースの補正（有効時は全言語に適用）
- 最大録音時間: スライダー（初期値5分）
- **プラグイン言語**: UI表示のみを制御。Obsidianの言語設定から自動検出（ja/zh/ko/en）。
- 音声区間検出 (VAD): オフ（標準）、サーバー（応答を速めたい場合）、ローカル（`fvad.wasm`/`fvad.js` 必須）から選択

### 言語設定

- **プラグイン言語**: UI表示のみを制御。Obsidianの言語設定から自動検出（ja/zh/ko/en）。
- **音声認識言語**: 音声認識/文字起こしの言語。既定ではプラグイン言語にリンクし、高度設定で個別指定が可能。

#### 初期値の決定（Obsidianロケールに基づく）

- ja-* → 日本語
- zh-* → 中国語
- ko-* → 韓国語
- その他 → 英語

初回起動時およびリンク有効時は、このロケール判定に基づいて UI 言語と音声認識言語が同期されます。

#### 言語別の処理

- 日本語 (ja): 専用プロンプトを付与し、辞書補正（有効時）や言語別クリーンアップを適用
- 中国語/英語/韓国語 (zh/en/ko): 各言語向けプロンプトとクリーニングルールを適用
- 言語リンク有効時: UI 言語の変更に合わせてこれらの処理を自動的に切り替え

## セキュリティ / プライバシー

- 処理はメモリ内で行い、音声ファイルはプラグイン側でディスク保存しません
- 録音した音声は文字起こしのため OpenAI に送信され、HTTPS（Obsidian の `requestUrl` 経由）で通信します。
- APIキーは保存時に暗号化

補足: Electron の SafeStorage が利用できない環境では保存キーを軽度に難読化して保持します（本プラグインはデスクトップ専用の設計です）。

OpenAIのプライバシーポリシーもご参照ください。

## トラブルシューティング

- マイクが認識されない: マイク許可の付与、Obsidianの再起動
- 文字起こしに失敗: APIキー、通信、OpenAIクレジット残高を確認
- 音量が小さい/雑音が多い: マイクに近づく、静かな環境で録音
 - 配布先の Vault が見つからない: 一度 Obsidian でその Vault を開いて `obsidian.json` に登録させてから、`npm run deploy` を再実行してください。

## 開発

- 依存インストール: `npm ci`
- ビルド: `npm run build-plugin`
- ローカル配布: `npm run deploy`（`npm run deploy-local` のエイリアス）。Vault は Obsidian の設定（必要に応じて一般的な場所も）から自動検出します。iCloud/ローカルの別を意識せずに配布できます。

### ドキュメント

- 処理フローの可視化: [`docs/PROCESSING_FLOW.md`](docs/PROCESSING_FLOW.md) を参照

サードパーティライセンスは `THIRD_PARTY_LICENSES.md` を参照してください。

## ライセンス

MIT License - 詳細は[LICENSE](LICENSE)ファイルをご確認ください。

詳細なライセンス情報については [THIRD_PARTY_LICENSES.md](THIRD_PARTY_LICENSES.md) をご覧ください。

## 作者

**Musashino Software**

- GitHub: [@mssoftjp](https://github.com/mssoftjp)
- 支援: [Buy Me a Coffee](https://buymeacoffee.com/mssoft)

## 貢献

バグ報告や機能要望は[Issues](https://github.com/mssoftjp/obsidian-voice-input-private/issues)でお願いします。
