# Complete visual asset inventory

The 3D artwork is original, procedural artwork created for Alien Karaoke Booth.
The complete model and animation source is included in `src/World.jsx`; no GLB,
GLTF, FBX, model download, texture CDN, paid asset, or separate model file is
required. Geometry is generated locally by Three.js when the application starts.

## Models and environment

- Reusable low-poly green alien with oversized modeled head, cheeks, eyes,
  antennae, torso, medallion, articulated arms, fingers, legs, and feet.
- Purple-hatted alien judge and differently colored spectator aliens.
- Two-eyed, bouncing extraterrestrial creatures.
- Flying saucer with faceted silver hull, dome, pilot, orbiting lights, and
  transparent abduction beam; smaller event saucer.
- Checkerboard dance floor, circular karaoke stage, neon trim, microphone and
  stand, speaker cabinets and cones, lighting rigs, mirrored disco ball, and
  satellite performance platform.
- Faceted planets, Saturn-style rings, asteroid, star field, and moon terrain.
- Award cup, floating musical notes, confetti, and procedural firework particles.

## Textures and identity

- Club signage is drawn into a local canvas and uploaded as a `CanvasTexture`.
- The participant's uploaded/captured photo is processed once by the bundled
  local MediaPipe landmark detector and original `src/face/warp.js` filter.
  Landmark-guided image warping reshapes the actual facial features; exposure-
  aware green shading and anatomical eye/lip masks retain recognizable detail.
  The result is a feathered transparent 512×640 PNG, mapped onto an ellipsoid-
  conforming surface above the modeled head/chin. Raw photos are never pasted
  onto the final model or sent to a remote image service.
- Leaderboard portraits are rendered from the same real 3D alien model, cached
  as PNGs in memory, and release their temporary WebGL renderer after rendering.
- All remaining surfaces use original material colors and procedural geometry;
  there are no missing texture maps.

## Animation and effects

Character articulation, walking, dancing, microphone reactions, waving, UFO
descent, beam lift, flyaway, camera movement, disco lighting, random events, and
celebration effects are calculated in `useFrame` without external animation
clips. The desktop camera leaves room for the interface and moves the singer to
the visible side of the YouTube player. Narrow screens center the character.

Sound effects and music are included separately under `public/audio/`; see its
README for the audio asset inventory and generation details.

## License

The original models, procedural texture artwork, animations, favicon, sound
effects, and music created for this project may be used, modified, and
redistributed with this project, including commercially, without attribution.
Participant photographs remain the property of their respective rights holders.
Three.js, React, React Three Fiber, Lucide, and other dependencies retain their
respective third-party licenses; this permission does not replace those licenses.
