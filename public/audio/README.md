# Original arcade audio

All WAV files are original procedural compositions and effects generated for Alien Karaoke Booth. No third-party recordings or samples are used.

- `menu-loop.wav`: 4.8 second chiptune attract-mode loop.
- `club-loop.wav`: 8 second extraterrestrial dance loop.
- `click.wav`, `shutter.wav`, `teleport.wav`, `ufo.wav`, `chatter.wav`, `reveal.wav`, `victory.wav`: original interaction and ceremony sounds.

Recreate these assets with `node scripts/generate-audio.mjs`. Mono PCM, 22,050 Hz, 16 bit. The Web Audio engine loads the bundled files and includes a procedural fallback. Sound starts only after a user gesture and is muted initially. Background music stops during karaoke playback; microphone analysis is never routed back to speakers.
