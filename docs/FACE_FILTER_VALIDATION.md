# Face transformation validation

This report distinguishes real photograph/model checks from simulated UI tests. No generated people, image-generation services, or production photo uploads were used.

## Real photograph set

Four distinct public-domain photographs were used only in the development workspace:

| Photograph | Provenance | Useful coverage |
| --- | --- | --- |
| Eileen Collins | NASA, redistributed in scikit-image | Color portrait, smile, visible fine skin detail |
| Barack Obama | Official White House photograph by Pete Souza | Different face proportions, broad smile, facial lines |
| Grace Hopper | Official U.S. Navy photograph by James S. Davis | Glasses, subdued expression, cap near the forehead |
| Katherine Johnson | NASA photograph, 1983 | Grayscale source, glasses, different facial proportions |

The source URLs and public-domain attribution are recorded in `docs/face-filter-fixtures.json`. The photographs and transformed examples are **not shipped as game assets**.

Each photograph was cropped to a 512 × 512 registration-style face image. Six cases were made from each original:

- Neutral, without a lighting change.
- Dim: brightness multiplied by 0.48.
- Bright: brightness multiplied by 1.40, including highlight clipping.
- Warm: RGB channel gains of 1.14, 0.94, and 0.72.
- Side shadow: horizontal luminance gain from 0.46 to 1.05.
- Tilt: 11-degree roll with a neutral dark fill outside the rotated image.

This is **24 controlled cases from four independent real photographs**, not 24 independent subjects. The cases cover glasses, color and grayscale input, face proportions, exposure, color cast, asymmetric illumination and mild head roll. They do not establish performance for every face, severe occlusion or extreme profile angles.

## Genuine landmark detection

The packaged `public/mediapipe/face_landmarker.task` was executed locally using native MediaPipe 1.2.2 with the CPU/XNNPACK delegate. Its SHA-256 was:

```text
64184e229b263107bc2b804c6625db1341ff2bb731874b0bcc2fe6544e0bc9ff
```

The detector used IMAGE mode, a maximum of two faces, and detection/presence thresholds of 0.5. All **24/24** photo cases produced exactly one face and **478 landmarks**. A blank image produced zero faces; a composite of two portraits produced two faces. Native inference after initialization took approximately 11–23 ms in one development run. These are native CPU observations, **not a browser speed benchmark**.

## Exact shared transformation code

`src/face/warp.js` was run unchanged on the real image pixels and detected landmarks using Node and `@napi-rs/canvas`. This is the same pure pixel/geometry function called by the browser filter. All **24/24** transformations passed:

| Check | Observed result |
| --- | --- |
| Output atlas dimensions | 512 × 640 RGBA in every case |
| Alpha at every outer image edge | Zero; no rectangular photograph boundary |
| Feathered transition pixels | 28,362–29,063 pixels per atlas |
| Preserved green facial luminance variation | Standard deviation 23.97–48.96 on a 0–255 scale |
| Measured eye width, compared with a size-normalized unwarped face | ×1.253–1.273 |
| Measured nose width | ×0.872–0.929 |
| Maximum inverse-map error at 468 facial vertices | 0.0096 source pixels |

The eye and nose measurements demonstrate actual facial geometry changes rather than a color-only overlay. Eye enlargement includes the combined effect of the local eye lens and broader upper face. The appearance parameters are predefined; no substitute eyes, stickers or synthesized facial details are introduced.

One development run of full-resolution pixel processing took approximately 115–183 ms, with a median of 137 ms. This excludes model initialization and PNG encoding and does not predict low-power-device timing. Processing occurs once for the selected registration crop; the generated texture is reused during gameplay.

The original/transformed contact sheet and all 24 rendered outputs were visually inspected locally. The transformed faces retained individual smiles, actual eye appearance, facial lines and glasses. Forehead widening, larger eyes and nose changes were visible. The dim, warm, tilted and grayscale variants remained recognizable; exposure normalization retained shading without flattening all skin to a single green. Clipped bright source highlights contained less recoverable detail, as expected. The alpha contour follows the detected face outline and feathers toward the alien head's skin color.

## Reproduce the photograph checks

These are optional developer checks, not application runtime dependencies. The application itself performs all processing locally in browser JavaScript.

1. Create a Python virtual environment in a user-owned work folder and install `mediapipe`, `pillow` and `numpy` (the recorded run used MediaPipe 1.2.2). Native MediaPipe also requires the platform's EGL/GLES runtime libraries.
2. From the project directory, explicitly download the documented public-domain source photographs and run the packaged model:

   ```sh
   python scripts/validate-face-landmarks.py --work-dir ./work/face-validation --download
   ```

3. After `npm ci`, run the shared transformation on those images and landmarks:

   ```sh
   node scripts/validate-face-fixtures.mjs ./work/face-validation
   ```

The scripts write `detection-report.json`, `transformation-report.json`, transformed PNGs, and before/after contact sheets inside the work folder. They return a failing status if the recorded detection or transformation invariants fail. `work/` is ignored by Git and excluded from the distributable ZIP.

## Verification limits

The photographic detector checks used the genuine packaged model through native MediaPipe; they do not by themselves verify the browser's WASM loader, worker initialization or GPU driver. The exact browser transformation code was executed on genuine image pixels. Automated registration tests simulate detector results to test preview/confirmation, cancellation, errors, cropping and texture reuse. The new face surface also has mathematical geometry checks.

Live browser/WebGL preview, physical camera capture and microphone hardware testing were unavailable in this build session because it did not expose its browser-control tool. Those device-specific checks remain to be performed on the target kiosk. No browser performance or full visual 3D runtime result is claimed by this report.
