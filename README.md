# ALIEN KARAOKE BOOTH

A complete browser-based, real-time 3D karaoke arcade. A local landmark filter transforms your actual facial features into a goofy green alien, a UFO takes you to a space nightclub, and a deeply unqualified alien jury awards your performance.

**Version 1.1 — landmark alien faces:** MediaPipe detects your facial proportions, then a smooth image warp enlarges your own eyes, broadens the forehead, tapers the jaw and subtly shrinks the nose. Exposure-aware green skin retains shading and facial detail; the original eyes, lips, expression and glasses are blended through anatomical masks. A feathered transparent PNG fits the curved 3D head. Preview both the 3D character and the before/after face before confirming. No generative AI or server image processing is used.

## Run the included build — no package installation needed

1. Extract the entire ZIP to a folder.
2. Install **Node.js 20 or newer** from https://nodejs.org if it is not already installed.
3. On Windows, double-click **START.bat**. On macOS, open **START.command** (if needed, run `chmod +x START.command` first). On Linux, or from any terminal in the extracted folder, run:

   ```sh
   npm start
   ```

4. Open **http://localhost:4173**. Stop the server with Ctrl+C.

The ready-to-run production app is included in `dist/`. Do not open `dist/index.html` through `file://`; camera permissions, JavaScript modules, and YouTube expect an HTTP(S) origin. The bundled server uses localhost so camera and microphone can work without a certificate. Set `PORT` if 4173 is already in use.

## Develop from source

```sh
npm ci
npm run dev
```

Open the URL printed by Vite (normally http://localhost:5173). To create a fresh production build:

```sh
npm run build
npm start
```

No API keys, accounts, database, 3D model downloads, or audio downloads are required. YouTube needs an internet connection. The app, fonts, geometry, textures, music and effects are bundled locally.

## The full experience

1. Press **GET ABDUCTED**. Enter a nickname and capture a camera photograph or upload an image. The crop supports zoom and horizontal/vertical adjustment. Include one clear, front-facing face with the forehead and chin visible.
2. Press **PREVIEW MY ALIEN**. The local scanner finds 478 facial landmarks; the filter transforms the actual photo once. Review the animated 3D preview or switch to **FACE FILTER** for the before/after view. Choose **ADJUST PHOTO** if needed, then **CONFIRM MY ALIEN**. Watch its introduction, UFO descent, beam lift and departure, followed by the smooth nightclub camera transition.
3. Paste a YouTube karaoke video URL. Standard watch links, youtu.be links, Shorts, live and embed links are supported. No singing evaluation or lyric extraction is performed; choose a video that already contains the lyrics/instrumental you want.
4. Optionally **LINK YOUR MIC**. Live local audio analysis drives the stage light and alien reactions. Microphone audio is never routed to speakers, recorded or transmitted. The game works when permission is declined.
5. Use the video controls or the app's play/pause, restart, video volume and exit controls. Focus mode expands the player. Arcade ambience automatically stops during karaoke. Muting arcade sound does not mute YouTube; each has its own volume control.
6. Let the full video finish. The judge introduces a random, uniformly distributed **85–100** entertainment score, an absurd award, fireworks, confetti and a trophy. Leaving an unfinished performance does not award a score.
7. Sing another song with the same alien, or return to the menu. The participant identity and up to 50 ranked performances remain in this browser's localStorage.

The leaderboard initially shows three clearly labeled fictional **house legends**. Real performances replace these demonstration entries. Scores celebrate participation and never measure singing ability. Profiles and scores are device-local, not shared across kiosks or browsers.

## Visual and sound design

- Three.js / React Three Fiber renders the complete animated world: giant aliens, nine spectators, roaming creatures, checker dance floor, neon rings, central stage, microphone, speaker stacks, disco decorations, planets, stars and a modeled flying saucer.
- Every character is built from original procedural meshes. `src/World.jsx` contains the complete geometry and animation source; there are no missing external model files. See `public/assets/README.md`.
- The participant's generated transparent 512×640 face atlas is physically mapped onto a surface that conforms to the oversized head and chin. Its shaded green edge fades into the same material color as the body. The same mesh renders the registration preview, leaderboard and performer portraits. No raw photo is used as the final avatar. Portraits are cached; temporary graphics contexts are released.
- The MediaPipe Face Landmarker package, float16 model, SIMD and compatibility WASM runtimes are bundled under `public/mediapipe/`. They load lazily when transformation is requested, with no CDN or external API calls. Inference is a single IMAGE-mode CPU scan; a local worker performs the inverse image warp and pixel blending. No detection runs during gameplay. Changing the source/crop invalidates the cached result, and canceling or closing registration discards stale work.
- Face scans reject missing, multiple, heavily turned, too-small or cropped faces with a useful message. Existing participants from version 1.0 keep their nickname/scores and are asked to preview the upgraded filter once. Previously pasted raw photos are no longer projected onto any 3D character.
- Infrequent randomized UFO flybys, conga runs, musical notes, disco changes and close encounters keep the club active. Events never pause or alter the YouTube player, and their notifications do not intercept clicks.
- Original WAV music and effects are in `public/audio/`. Recreate them with `node scripts/generate-audio.mjs`. The Web Audio engine also has a procedural fallback.
- Sound starts muted and requires a user gesture, respecting autoplay restrictions. Sound and gentle-motion preferences persist. The OS reduced-motion preference is respected on first use.
- Desktop/kiosk 16:9 is the primary composition. Responsive layouts and a centered 3D camera support phones/tablets. Rendering caps device pixel ratio at 1.5, reuses core geometry and instances dance-floor tiles.

## Hosting

Build, then deploy the **contents of `dist/`** to any static HTTPS host. Keep the `audio/`, `assets/`, and `fonts/` directories together. The app has no server-side runtime. Use HTTPS for camera/microphone access on any origin other than localhost. For a physical kiosk, a current Chrome, Edge, Firefox or Safari browser with WebGL2 and a working GPU is recommended. Audio from the mic is analyzed only; use a separate PA/microphone system if the singer needs amplified vocals.

Some YouTube owners prohibit embedding, some videos are region/age restricted, and network/ad-blocking policies can block YouTube. The player reports these errors, offers retry, and allows choosing another video. No application can override the video's playback restrictions. If autoplay is blocked, press Play inside the official player. Its native controls remain available.

All storage keys start with `alien-karaoke.v1.` for compatibility. Clearing site data removes the saved texture and local scores. Repeat-performance records share stored texture data to avoid duplicating large PNGs. Legacy score arrays remain readable. Storage failures produce a visible message and the current session remains usable. A new registration replaces the active alien identity while previous performance entries retain their portraits.

## Verification

```sh
npm test
npm run test:ui
npm run build
```

The included tests cover data validation/corruption, persistent generated identity, deduplicated textures, bounded ranking, fair score endpoints, storage quota errors, sound defaults, static-server routing/security, actual registration/photo cropping and camera cleanup, preview-before-confirm, stale/canceled transformations, filter errors/retry, URL validation, official YouTube API lifecycle and retry, and the registration → abduction → performance → award → replay journey. Pure pixel tests verify the actual eye/nose warp, roll correction, anatomical alpha mask, green shading and seamless edge colors. Geometry tests check face-surface clearance, front-facing triangles and whole-atlas UV coverage.

The actual bundled Face Landmarker model was also tested natively on four public-domain portraits under six controlled lighting/rotation variants: **24/24 detections and 24/24 exact JavaScript transformations passed**. Original eyes, smiles, facial lines and glasses remained recognizable on visual inspection. Source provenance, measurements, reproducible scripts and the precise verification limits are in [docs/FACE_FILTER_VALIDATION.md](docs/FACE_FILTER_VALIDATION.md). Portrait fixtures are not game assets and are not required to run the app.

UI tests run in jsdom with simulated browser media devices and YouTube API events; the 3D renderer is mocked in these flow tests. **Live visual browser QA, physical camera/microphone testing, and actual internet YouTube playback were not available in the build session** because its browser-control tool was unavailable. These remain manual verification steps on the target kiosk. This is a complete runnable application, with the exact extent of automated verification stated here.

## Project map

```text
src/App.jsx                 Game state, UI, controls, events and awards
src/World.jsx               Original 3D models, nightclub and animations
src/Registration.jsx        Camera, upload, crop and registration
src/face/faceFilter.js       Local MediaPipe loading, scan and lifecycle
src/face/warp.js             Shared landmark warp, skin shading and alpha masks
src/face/warp.worker.js      One-time background image processing
src/face/texture.js          Atlas version, mesh data and portrait fingerprints
src/YouTubePlayer.jsx       Official YouTube IFrame Player API
src/audio.js                Audio engine, ambience and mic analysis
src/storage.js              Device-local profiles, settings and scores
src/style.css               Responsive arcade interface
src/responsive.css          Compact kiosk adjustments
src/fonts.css               Bundled typeface declarations
public/audio/               Original WAV assets and provenance
public/fonts/               Bundled fonts and OFL licenses
public/assets/README.md     Procedural asset inventory
public/mediapipe/            Bundled model, WASM runtimes and Apache license
scripts/serve.mjs           Dependency-free built-app server
scripts/generate-audio.mjs  Reproducible original sound assets
tests/                      Unit and integrated UI checks
dist/                       Ready-to-run compiled application
package-lock.json           Exact reproducible dependency versions
```

## Credits and licenses

Original project code, models, procedural textures, animation and sounds are supplied under the MIT license in `LICENSE`. MediaPipe and its bundled model/runtime retain their Apache 2.0 license in `public/mediapipe/LICENSE`. Three.js, React, React Three Fiber, Lucide and build/test dependencies retain their respective open-source licenses. Barlow Condensed, DM Sans and Space Mono are bundled under the SIL Open Font License; their license files are in `public/fonts/`. YouTube is a third-party service and retains its own terms and branding. No third-party music recordings are included.
