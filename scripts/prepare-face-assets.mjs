/** All inference assets are hosted with the app; visitors never fetch a CDN. */
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const source=path.join(root,'node_modules/@mediapipe/tasks-vision/wasm');
const dest=path.join(root,'public/mediapipe/wasm');fs.mkdirSync(dest,{recursive:true});
for(const name of ['vision_wasm_internal.js','vision_wasm_internal.wasm','vision_wasm_nosimd_internal.js','vision_wasm_nosimd_internal.wasm'])fs.copyFileSync(path.join(source,name),path.join(dest,name));
const model=path.join(root,'public/mediapipe/face_landmarker.task');
if(!fs.existsSync(model))throw new Error('Bundled face_landmarker.task model is missing. Restore public/mediapipe from the project ZIP.');
if(createHash('sha256').update(fs.readFileSync(model)).digest('hex')!=='64184e229b263107bc2b804c6625db1341ff2bb731874b0bcc2fe6544e0bc9ff')throw new Error('The bundled Face Landmarker model does not match its pinned checksum.');
console.log('Local MediaPipe SIMD + compatibility WASM assets prepared.');
