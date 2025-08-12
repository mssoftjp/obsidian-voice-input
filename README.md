# Voice Input Plugin for Obsidian

High-accuracy voice input for Obsidian. Uses OpenAI GPT-4o Audio Transcriptions to transcribe speech (optimized for Japanese) and insert into your notes with one click or push-to-talk.

## Features

- One‑click recording: start/stop from a microphone ribbon icon
- Push‑to‑talk: long‑press to record, release to stop
- Model selection: GPT‑4o Transcribe or GPT‑4o mini Transcribe
- AI post‑processing: optional dictionary-based cleanup (JA)
- Quick controls in view: copy/clear/insert at cursor/append to end
- Auto‑save drafts: periodic and on blur, automatic restore

## Requirements

- OpenAI API key (Audio Transcriptions)
- Internet connectivity
- Obsidian desktop (Windows/macOS). This plugin is desktop‑only.

Note: OpenAI usage is billed by API.

## Installation (manual)

1. Download the latest assets from Releases
2. Copy `main.js`, `manifest.json`, `styles.css`, `fvad.wasm`, `fvad.js`
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
- AI Post‑processing: enable dictionary‑based cleanup (Japanese)
- Maximum Recording Duration: slider (default 5 min)
- Plugin Language: English/Japanese (controls UI display only, auto‑detected from Obsidian, adjustable)

## Security & Privacy

- Processing in memory; audio is not written to disk by the plugin
- HTTPS for all network requests (via Obsidian’s `requestUrl`)
- API key is encrypted for storage

See also OpenAI’s Privacy Policy.

## Troubleshooting

- Microphone not recognized: allow mic access and restart Obsidian
- Transcription fails: verify API key, connectivity, and OpenAI credit
- Quiet audio: move closer to the mic and reduce background noise

## Development

- Install deps: `npm ci`
- Build: `npm run build-plugin` (outputs `build/latest/`)
- Deploy locally: `npm run deploy-local` (copies to detected vaults)
- Analyze unused code (build-time): `npm run analyze:unused`

Third‑party licensing: see `THIRD_PARTY_LICENSES.md`.

—

# Voice Input Plugin for Obsidian（日本語）

高精度な音声認識でメモを作成できるプラグインです。OpenAI GPT‑4oの音声文字起こしを使用し、日本語に最適化した文字起こしを行います。

## 機能

- ワンクリック録音（リボンのマイクアイコン）
- プッシュトゥトーク（長押しで録音開始、離して停止）
- モデル選択（GPT‑4o Transcribe / GPT‑4o mini Transcribe）
- AI後処理（辞書ベースの補正、JA向け）
- ビュー内のクイック操作（コピー/クリア/カーソル位置へ挿入/末尾へ追記）
- 自動保存（定期保存とフォーカス外れ時）。再オープン時に自動復元

## 必要条件

- OpenAI APIキー（Audio Transcriptions）
- インターネット接続
- Obsidianデスクトップ版（Windows/macOS）。本プラグインはデスクトップ専用です。

※ OpenAI APIの利用には課金が発生します。

## インストール（手動）

1. Releases から最新版を取得
2. `main.js`、`manifest.json`、`styles.css`、`fvad.wasm`、`fvad.js` を配置
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
- AI後処理: 辞書ベースの補正（日本語向け）
- 最大録音時間: スライダー（初期値5分）
- プラグイン言語: 英語/日本語（UI表示のみ制御、Obsidian設定から自動検出、変更可）

## セキュリティ / プライバシー

- 処理はメモリ内で行い、音声ファイルはプラグイン側でディスク保存しません
- 通信はHTTPS（Obsidianの `requestUrl` 経由）
- APIキーは保存時に暗号化

OpenAIのプライバシーポリシーもご参照ください。

## トラブルシューティング

- マイクが認識されない: マイク許可の付与、Obsidianの再起動
- 文字起こしに失敗: APIキー、通信、OpenAIクレジット残高を確認
- 音量が小さい/雑音が多い: マイクに近づく、静かな環境で録音

## 開発

- 依存インストール: `npm ci`
- ビルド: `npm run build-plugin`
- ローカル配布: `npm run deploy-local`

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
