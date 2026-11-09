# Local face scanner assets

All files here are shipped with the game. Participant photographs and landmarks are never submitted to Google or any server.

- `face_landmarker.task`: Google MediaPipe Face Landmarker float16 model, version 1. Downloaded from https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task
- Model SHA-256: `64184e229b263107bc2b804c6625db1341ff2bb731874b0bcc2fe6544e0bc9ff`.
- `wasm/`: SIMD and compatibility runtime files from the pinned `@mediapipe/tasks-vision@0.10.32` package, copied by `scripts/prepare-face-assets.mjs`.
- MediaPipe is licensed under Apache 2.0; see `LICENSE`. Source: https://github.com/google-ai-edge/mediapipe

The app lazily loads the scanner only when Preview My Alien is pressed. A current browser fetches one roughly 11 MB WASM runtime plus the 3.7 MB model from the same game origin. The compatibility runtime is an alternate for browsers without WASM SIMD. Face detection runs once in IMAGE/CPU mode; expensive pixel transformation runs in a local worker. The detector is released after 60seconds idle, and all game scenes reuse the cached PNG without repeating inference.

The model is a face landmark detector, not a generative model. It does not create facial content, identify the person, evaluate singing, or infer demographic categories.
