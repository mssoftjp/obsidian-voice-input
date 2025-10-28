# Processing Flow (High Level)

This document outlines the high‑level processing pipeline for Voice Input.

- Capture audio from microphone (WebAudio)
- Voice Activity Detection (VAD via `fvad-wasm`)
- Buffering and segmenting frames
- Encode and send via Obsidian `requestUrl`
- OpenAI Audio Transcriptions (GPT‑4o Transcribe / GPT‑4o mini Transcribe)
- Optional post‑processing (dictionary‑based clean up)
- Render transcript in the Voice Input view; quick actions (copy/insert/append)

Details will be expanded in future revisions.
