# Voice Input Plugin for Obsidian

High-accuracy voice input for Obsidian. Uses OpenAI GPT-4o Audio Transcriptions to transcribe speech (optimized for Japanese) and insert into your notes with one click or push-to-talk.

## Features

- One‑click recording: start/stop from a microphone ribbon icon
- Push‑to‑talk: long‑press to record, release to stop
- Model selection: GPT‑4o Transcribe or GPT‑4o mini Transcribe
- Language separation: independent UI language and voice recognition language settings
- Auto language detection: automatic voice recognition language based on Obsidian locale
- AI post‑processing: optional dictionary-based cleanup (Japanese only)
- Quick controls in view: copy/clear/insert at cursor/append to end
- Auto‑save drafts: periodic and on blur, automatic restore
- Multilingual support: Japanese, English, Chinese, Korean interface languages

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
- **Transcription Language**: Auto/Japanese/English/Chinese/Korean (auto-detection recommended)
- AI Post‑processing: enable dictionary‑based cleanup (applied to Japanese only)
- Maximum Recording Duration: slider (default 5 min)
- **Plugin Language**: English/Japanese/Chinese/Korean (controls UI display only; auto‑detected from Obsidian)

### Language Settings Explained

The plugin provides **complete separation** between UI language and voice recognition language for optimal user experience:

- **Plugin Language**: Controls the interface language (menus, buttons, messages). Auto-detected from your Obsidian language setting.
- **Transcription Language**: Determines the language for speech recognition and transcription. "Auto" is recommended - it automatically selects the optimal language based on your Obsidian interface language.

### Auto-Detection Behavior

When **Transcription Language** is set to "Auto":
- **Japanese locale** (ja-*) → Japanese transcription
- **Chinese locale** (zh-*) → Chinese transcription  
- **Korean locale** (ko-*) → Korean transcription
- **All other locales** → English transcription

### Language-specific Processing

The plugin applies different processing strategies based on the selected transcription language:

- **Japanese (ja)**: Enhanced prompts for optimal transcription accuracy + dictionary correction for technical terms
- **Chinese (zh)**: Clean transcription without language-specific processing
- **English/Korean (en/ko)**: Clean transcription without prompts or correction to avoid interference
- **Auto Mode**: Dynamically selects the optimal language and processing strategy based on your Obsidian interface language

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
- 言語設定の分離（UI言語と音声認識言語を独立設定）
- 自動言語検出（Obsidianロケールに基づく音声認識言語の自動検出）
- AI後処理（辞書ベースの補正、日本語のみ適用）
- ビュー内のクイック操作（コピー/クリア/カーソル位置へ挿入/末尾へ追記）
- 自動保存（定期保存とフォーカス外れ時）。再オープン時に自動復元
- 多言語サポート（日本語、英語、中国語、韓国語のインターフェース）

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
- **音声認識言語**: 自動/日本語/英語/中国語/韓国語（自動検出を推奨）
- AI後処理: 辞書ベースの補正（日本語のみ適用）
- 最大録音時間: スライダー（初期値5分）
- **プラグイン言語**: 英語/日本語/中国語/韓国語（UI表示言語、Obsidian設定から自動検出）

### 言語設定について

プラグインは最適なユーザー体験のため、UI言語と音声認識言語を**完全に分離**しています：

- **プラグイン言語**: インターフェースの言語（メニュー、ボタン、メッセージ）。Obsidianの言語設定から自動検出されます。
- **音声認識言語**: 音声認識と文字起こしの言語。「自動」を推奨 - Obsidianのインターフェース言語に基づいて最適な言語を自動選択します。

### 自動検出の動作

**音声認識言語**が「自動」に設定されている場合：
- **日本語ロケール** (ja-*) → 日本語での文字起こし
- **中国語ロケール** (zh-*) → 中国語での文字起こし
- **韓国語ロケール** (ko-*) → 韓国語での文字起こし
- **その他のロケール** → 英語での文字起こし

### 言語別の処理

プラグインは選択された音声認識言語に基づいて異なる処理戦略を適用します：

- **日本語 (ja)**: 高精度化のための専用プロンプト + 専門用語の辞書補正
- **中国語 (zh)**: 言語固有処理なしのクリーンな文字起こし
- **英語/韓国語 (en/ko)**: 干渉を避けるため、プロンプトや補正なしのクリーンな文字起こし
- **自動モード**: Obsidianのインターフェース言語に基づいて最適な言語と処理戦略を動的に選択

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
