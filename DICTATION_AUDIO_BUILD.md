# Listening 300 Kokoro audio

This is synthesized vocabulary practice audio, not official examination audio.
The 300 files correspond exactly to the existing sentence-completion examples.

## Rebuild

Use Node 24 or newer. Install the build tools outside this repository:

```powershell
npm install --prefix ../kokoro-audio-build kokoro-js@1.2.1 lamejs@1.2.1 --no-audit --no-fund
node --use-env-proxy scripts/build-dictation-audio.mjs ../kokoro-audio-build
node scripts/check-dictation-audio.mjs
```

The first run downloads the Kokoro ONNX model into the build-tool runtime cache.
Generation is local and needs no API key. Model weights, npm dependencies and
build caches must not be committed to this repository.

Output: 300 MP3s in `assets/dictation/ielts-listening-300/heart-v1/` and
`data/ielts-listening-300-audio.json`. The model is Kokoro-82M-v1.0 q8,
voice af_heart, generation speed 0.9, mono 24 kHz, MP3 64 kbps.
Existing content-addressed outputs are reused on interrupted builds. The full
manifest is only emitted after all 300 entries have been processed.

The filename includes the sentence hash. Do not change the voice, encoding or
speed in-place: use a new pack version and new paths when those change.

## Runtime / offline behavior

- Fast playback is the default only for IELTS Listening 300. Other decks still
  use the existing local Kokoro path. Users can explicitly choose their locally
  selected voice instead of the pre-generated Heart pack.
- The current sentence and up to two following sentences are fetched on demand.
  No model is downloaded or initialized for pre-generated playback.
- The explicit download action caches and verifies all 300 MP3s, plus the
  vocabulary and example data needed by the existing trainer.
- Cache name: `english-memory-dictation-audio-v1`; regular application cache
  updates do not delete it. Each file is checked for byte length and SHA-256.
- Downloads are resumable, quota failures never report full completion, and
  offline audio requests return an error rather than an HTML fallback.
- The service worker supports byte ranges for audio clients, including Safari.
- Browser storage can still be cleared or evicted by the OS. Always test in
  airplane mode before travel.

Sentence and audio attribution: see `THIRD_PARTY_NOTICES.md`.
