# Demo video recorder

Re-records `../trustline-demo-voice.mp4` (and the silent `../trustline-demo.mp4`): a captioned, narrated, 3-minute run of demo mode.

## One-time setup

```bash
pip install kokoro-onnx soundfile          # text-to-speech (runs locally)
mkdir -p models && cd models
curl -LO https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0/kokoro-v1.0.onnx
curl -LO https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0/voices-v1.0.bin
cd ..
```

Also needs `ffmpeg`, and Chromium (set `CHROME_PATH` if it isn't at `/opt/pw-browsers/...`).

## Record

```bash
# 1. Fresh demo server (from trustline/). With a key, Claude writes the officer's explanation.
#    In a cloud environment, store the key as TRUSTLINE_ANTHROPIC_KEY (ANTHROPIC_API_KEY is reserved there).
rm -f data/demo.db* && ANTHROPIC_API_KEY="${ANTHROPIC_API_KEY:-$TRUSTLINE_ANTHROPIC_KEY}" DEMO_MODE=1 TRUSTLINE_DB_PATH=data/demo.db npx next dev --turbopack -p 3100

# 2. In demo-video/recorder/ (same ANTHROPIC_API_KEY setting, so the narration matches the screen)
python3 gen.py                  # voice clips + lines.json
node record.mjs > rec.log       # ~3 min; paced by the voice clips
python3 build.py                # aligns voice to video, fits it to 3:00, writes ../trustline-demo*.mp4
```

Edit captions and narration in `lines.py`. Restart the server with a fresh `data/demo.db` before every take.
