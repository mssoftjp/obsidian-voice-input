# Voice Input Plugin for Obsidian

Capture notes with high-accuracy multilingual voice input using OpenAI Speech-to-Text. Uses GPT-4o Audio Transcriptions (with tuned prompts for ja/en/zh/ko) and inserts into your notes with one click or push-to-talk.

## Features

- One‑click recording: start/stop from a microphone ribbon icon
- Push‑to‑talk: long‑press to record, release to stop
- Model selection: GPT‑4o Transcribe or GPT‑4o mini Transcribe
- Language separation: independent UI language and voice recognition language settings
- Language linking: voice recognition follows the UI locale (ja/en/zh/ko) with optional overrides
- AI post‑processing: optional dictionary-based cleanup (applied to all languages when enabled)
- Quick controls in view: copy/clear/insert at caret/append to end
- Auto‑save drafts: periodic and on blur, automatic restore
- Multilingual support: Japanese, English, Chinese, Korean interface languages
- Voice activity detection modes: Off by default for maximum accuracy. Optional server-side chunking or local auto‑stop (requires fvad.wasm/fvad.js, installed manually)

## Requirements

- OpenAI API key (Audio Transcriptions)
- Internet connectivity
- Obsidian desktop (Windows/macOS). This plugin is desktop‑only.

Note: OpenAI usage is billed by API.

## Installation (manual)

1. Download the latest assets from Releases.
2. Copy `main.js`, `manifest.json`, and `styles.css` into `<vault>/.obsidian/plugins/voice-input/`.
3. Restart Obsidian and enable the plugin.

Compatibility: requires Obsidian 1.8.0 or later (per `minAppVersion`).

Release assets: the plugin only needs `main.js`, `manifest.json`, and `styles.css` from the release bundle. Optional local VAD files are user-provided and are not included in releases.

Local VAD (optional): this plugin does not ship the WebAssembly files. If you want local VAD auto‑stop, download `fvad.wasm` and `fvad.js` from the fvad‑wasm project and place them in the same plugin folder, or use the “Choose fvad.wasm / fvad.js…” button in Settings → Voice Activity Detection to copy them. The loader uses `fetch` only to read these local files from the installed plugin folder. No external network requests are made for local VAD. Local VAD is desktop‑only.

## Commands

- Open Voice Input (`open-view`): opens the Voice Input view. Assign a hotkey from Obsidian’s Settings → Hotkeys if desired.

## Usage

1) Open the view
- Click the microphone ribbon icon, or run “Open Voice Input”.

2) Record
- Click “Start Voice Input” to toggle recording, or use push‑to‑talk: long‑press the record button (starts after a short threshold), release to stop.

3) Use the result
- Copy, Insert at caret, or Append to end of the active note. Clear resets the area.

Tip: A settings gear in the view header opens the plugin’s settings.

## Settings

- OpenAI API Key: stored locally (encrypted at rest)
- Transcription Model: `gpt-4o-transcribe` or `gpt-4o-mini-transcribe`
- **Transcription Language**: Japanese/English/Chinese/Korean (defaults to the UI language when linking is enabled; advanced settings let you override per language)
- AI Post‑processing: enable dictionary‑based cleanup (applied to all languages when enabled)
- Maximum Recording Duration: slider (default 5 min)
- Plugin Language: Japanese/English/Chinese/Korean (controls UI display only, auto-detected from Obsidian, adjustable)
- Voice Activity Detection: choose Off (default, most accurate), Server (faster turnaround via upstream silence trimming), or Local (desktop auto‑stop; requires `fvad.wasm`/`fvad.js` installed manually)

### Drafts and sync

- The plugin periodically auto‑saves your in‑progress text as a draft under `<vault>/.obsidian/plugins/voice-input/draft.txt` and restores it when you reopen the view.
- Drafts are device‑local and are not synchronized by Obsidian Sync or other services. If you clear the text area, the draft is removed.

## Security & Privacy

- Processing in memory: audio is not written to disk by the plugin.
- Network use: recorded audio is sent over HTTPS to `https://api.openai.com/v1/audio/transcriptions` via Obsidian’s `requestUrl` for transcription. The settings connection test calls `https://api.openai.com/v1/models`. No telemetry, ads, or self-update requests are sent by the plugin.
- Account and billing: an OpenAI API key is required, and OpenAI API usage may be billed by OpenAI.
- API key storage: the API key is stored in plugin settings. When Electron SafeStorage is available, the key is encrypted with SafeStorage before saving.
- SafeStorage fallback: if Electron SafeStorage is unavailable, the plugin stores the key with a lightweight XOR/Base64 obfuscation fallback for backward compatibility. This fallback is not equivalent to OS-backed encryption.
- Clipboard access: the Copy button writes only the current transcription text to the system clipboard. If note creation or insertion fails, the plugin may also write that same transcription text to the clipboard as a recovery fallback. The plugin does not read from the clipboard.
- Vault file access: drafts are saved to, loaded from, and cleared from `<vault>/.obsidian/plugins/voice-input/draft.txt` using Obsidian Vault/FileManager APIs. Insert and append actions write only to the active target note, or create a timestamped `Voice-Memo-*.md` note when no suitable note is available.
- Local files: optional local VAD reads `fvad.wasm` and `fvad.js` from the plugin folder after you install or choose those files. The release bundle does not include these WebAssembly files.
- External links: settings may show a link to the fvad-wasm GitHub project for manual download, but the plugin does not download those files automatically.
- Privacy policy: see [OpenAI’s Privacy Policy](https://openai.com/policies/privacy-policy/) for OpenAI API data handling.

## Troubleshooting

- Microphone not recognized: allow mic access and restart Obsidian
- Transcription fails: verify API key, connectivity, and OpenAI credit
- Quiet audio: move closer to the mic and reduce background noise

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
- VADモード選択（標準はオフ＝精度重視。必要に応じてサーバーVAD（応答を速めたい場合）や `fvad.wasm` / `fvad.js` を使ったローカルVAD（デスクトップの自動停止）を利用可能）

## 必要条件

- OpenAI APIキー（Audio Transcriptions）
- インターネット接続
- Obsidianデスクトップ版（Windows/macOS）。本プラグインはデスクトップ専用です。

※ OpenAI APIの利用には課金が発生します。

## インストール（手動）

1. Releases から最新版を取得
2. `main.js`、`manifest.json`、`styles.css` を `<Vault>/.obsidian/plugins/voice-input/` に配置
3. Obsidianを再起動し、プラグインを有効化

リリースアセット: プラグインの実行に必要なファイルはリリースバンドル内の `main.js`、`manifest.json`、`styles.css` です。任意のローカルVADファイルはユーザーが用意するもので、リリースには含めません。

ローカルVAD（任意）: 本プラグインは WebAssembly ファイルを同梱しません。ローカルVADの自動停止を使う場合、`fvad.wasm` と `fvad.js` を fvad‑wasm プロジェクトから取得して同じフォルダに配置するか、設定 → 音声区間検出 の「fvad.wasm / fvad.js を選択…」ボタンでコピーしてください。ローダーはインストール済みプラグインフォルダ内のローカルファイルを `fetch` で読むだけで、ローカルVADのための外部ネットワーク通信は行いません。ローカルVADはデスクトップ専用です。

## コマンド

- Open Voice Input（`open-view`）: 音声入力ビューを開きます。必要に応じてホットキーを割り当ててください。

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
- 音声区間検出 (VAD): オフ（標準・精度重視）、サーバー（応答を速めたい場合の無音カット）、ローカル（デスクトップの自動停止。`fvad.wasm`/`fvad.js` を手動導入）から選択

### ドラフトと同期

- 入力途中のテキストは定期的にドラフトとして `<Vault>/.obsidian/plugins/voice-input/draft.txt` に保存され、ビュー再オープン時に復元されます。
- ドラフトは端末ローカルの一時保存であり、Obsidian Sync 等では同期されません。テキストエリアを空にするとドラフトは削除されます。

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

- 処理はメモリ内で行い、音声ファイルはプラグイン側でディスク保存しません。
- ネットワーク利用: 録音した音声は文字起こしのため `https://api.openai.com/v1/audio/transcriptions` に HTTPS（Obsidian の `requestUrl` 経由）で送信されます。設定画面の接続テストでは `https://api.openai.com/v1/models` に接続します。プラグインはテレメトリ、広告、自己更新のための通信を行いません。
- アカウントと課金: OpenAI API キーが必要です。OpenAI API の利用料金は OpenAI 側で発生する場合があります。
- APIキー保存: APIキーはプラグイン設定に保存されます。Electron SafeStorage が利用できる場合は、SafeStorage で暗号化して保存します。
- SafeStorage フォールバック: Electron SafeStorage が利用できない場合、後方互換性のため XOR/Base64 による軽度の難読化で保存します。この方式は OS レベルの暗号化と同等ではありません。
- クリップボードアクセス: コピーボタンは現在の文字起こし結果だけをシステムクリップボードへ書き込みます。ノート作成や挿入に失敗した場合も、復旧用 fallback として同じ文字起こし結果をクリップボードへ書き込むことがあります。プラグインはクリップボードからの読み取りは行いません。
- Vault ファイルアクセス: 下書きは Obsidian の Vault/FileManager API を使って `<Vault>/.obsidian/plugins/voice-input/draft.txt` に保存、読み込み、削除されます。挿入と追記は対象ノートのみに書き込み、適切なノートが見つからない場合は `Voice-Memo-*.md` 形式のノートを作成します。
- ローカルファイル: 任意のローカルVADは、ユーザーが配置または選択した `fvad.wasm` と `fvad.js` をプラグインフォルダから読み込みます。リリースバンドルにはこれらの WebAssembly ファイルは含めません。
- 外部リンク: 設定画面に fvad-wasm の GitHub プロジェクトへのリンクを表示することがありますが、プラグインが自動でこれらのファイルをダウンロードすることはありません。
- プライバシーポリシー: OpenAI API におけるデータの扱いは [OpenAI のプライバシーポリシー](https://openai.com/policies/privacy-policy/) も参照してください。

## トラブルシューティング

- マイクが認識されない: マイク許可の付与、Obsidianの再起動
- 文字起こしに失敗: APIキー、通信、OpenAIクレジット残高を確認
- 音量が小さい/雑音が多い: マイクに近づく、静かな環境で録音

サードパーティライセンスは `THIRD_PARTY_LICENSES.md` を参照してください。

## ライセンス

MIT License - 詳細は[LICENSE](LICENSE)ファイルをご確認ください。

詳細なライセンス情報については [THIRD_PARTY_LICENSES.md](THIRD_PARTY_LICENSES.md) をご覧ください。

## 作者

**Musashino Software**

- GitHub: [@mssoftjp](https://github.com/mssoftjp)
- 支援: [Buy Me a Coffee](https://buymeacoffee.com/mssoft)

## 貢献

バグ報告や機能要望は[Issues](https://github.com/mssoftjp/obsidian-voice-input/issues)でお願いします。
