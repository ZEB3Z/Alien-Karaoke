/** Reproducible, original PCM sound assets. No third-party samples. */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const out = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../public/audio');
fs.mkdirSync(out, { recursive: true });
const rate = 22050;
let seed = 23419;
const random = () => { seed = (1664525 * seed + 1013904223) >>> 0; return seed / 4294967296; };
const midi = note => 440 * 2 ** ((note - 69) / 12);
function track(seconds) { return new Float32Array(Math.ceil(seconds * rate)); }
function tone(data, start, duration, frequency, amplitude = 0.15, kind = 'sine', end = frequency) {
  const from = Math.floor(start * rate), length = Math.ceil(duration * rate);
  let phase = 0;
  for (let i = 0; i < length && from + i < data.length; i++) {
    const t = i / rate, p = i / length;
    const f = frequency * (end / frequency) ** p;
    phase += f / rate;
    const sine = Math.sin(phase * Math.PI * 2);
    const wave = kind === 'square' ? Math.tanh(sine * 4) : kind === 'triangle' ? (2 / Math.PI) * Math.asin(sine) : kind === 'saw' ? 2 * (phase % 1) - 1 : sine;
    const attack = Math.min(1, t / 0.006), envelope = attack * (1 - p) ** 2;
    data[from + i] += wave * amplitude * envelope;
  }
}
function noise(data, start, duration, amplitude = 0.1) {
  const from = Math.floor(start * rate), length = Math.floor(duration * rate);
  let previous = 0;
  for (let i = 0; i < length && from + i < data.length; i++) {
    const white = random() * 2 - 1;
    data[from + i] += (white - previous) * amplitude * (1 - i / length) ** 3;
    previous = white;
  }
}
function write(name, data) {
  const wav = Buffer.alloc(44 + data.length * 2);
  wav.write('RIFF', 0); wav.writeUInt32LE(36 + data.length * 2, 4); wav.write('WAVE', 8);
  wav.write('fmt ', 12); wav.writeUInt32LE(16, 16); wav.writeUInt16LE(1, 20); wav.writeUInt16LE(1, 22);
  wav.writeUInt32LE(rate, 24); wav.writeUInt32LE(rate * 2, 28); wav.writeUInt16LE(2, 32); wav.writeUInt16LE(16, 34);
  wav.write('data', 36); wav.writeUInt32LE(data.length * 2, 40);
  for (let i = 0; i < data.length; i++) wav.writeInt16LE(Math.round(Math.tanh(data[i] * 1.1) * 28000), 44 + i * 2);
  fs.writeFileSync(path.join(out, `${name}.wav`), wav);
}
let data = track(4.8);
const arps = [[50,57,62,65,69,65,62,57], [46,53,58,62,65,62,58,53], [48,55,60,64,67,64,60,55], [45,52,57,61,64,61,57,52]];
for (let step = 0; step < 32; step++) {
  const at = step * 0.15, chord = arps[Math.floor(step / 8)];
  tone(data, at, 0.18, midi(chord[step % 8]), 0.11, 'square');
  if (step % 4 === 0) { tone(data, at, 0.45, midi(chord[0] - 12), 0.18, 'triangle'); tone(data, at, 0.14, 130, 0.3, 'sine', 38); }
  if (step % 4 === 2) noise(data, at, 0.07, 0.13);
}
write('menu-loop', data);
data = track(8);
for (let step = 0; step < 64; step++) {
  const at = step * 0.125, root = [38, 34, 36, 33][Math.floor(step / 16)];
  if (step % 4 === 0) tone(data, at, 0.18, 150, 0.52, 'sine', 37);
  if (step % 2 === 1) noise(data, at, 0.035, 0.12);
  if (step % 8 === 4) { noise(data, at, 0.11, 0.16); tone(data, at, 0.07, 180, 0.12, 'triangle'); }
  tone(data, at + 0.005, 0.10, midi(root + [0,0,12,7,0,12,3,7][step % 8]), 0.15, 'saw');
  if (step % 4 === 2) tone(data, at, 0.21, midi(root + [24,31,27,36][Math.floor(step / 4) % 4]), 0.12, 'square');
}
write('club-loop', data);
data = track(0.12); tone(data,0,0.08,850,0.25,'square',1450); write('click',data);
data = track(0.18); noise(data,0,0.09,0.5); tone(data,0.035,0.05,900,0.2,'square'); write('shutter',data);
data = track(2.1); tone(data,0,1.9,110,0.24,'saw',1800); for(let i=0;i<14;i++) tone(data,i*0.12,0.25,350+i*105,0.18); write('teleport',data);
data = track(2.4); tone(data,0,2.1,64,0.25,'saw',350); tone(data,0,2.1,68,0.22,'sine',355); for(let i=0;i<10;i++) tone(data,i*0.18,0.16,280+i*30,0.1); write('ufo',data);
data = track(0.9); for(let i=0;i<6;i++) tone(data,i*0.12,0.16,130+random()*280,0.25,'triangle',70+random()*120); write('chatter',data);
data = track(1.9); for(let i=0;i<9;i++) tone(data,i*0.085,0.12,200+i*95,0.18,'square'); tone(data,0.85,0.85,1046,0.25,'triangle'); write('reveal',data);
data = track(2.4); [62,66,69,74,69,74,78,81].forEach((note,i)=>{tone(data,i*0.14,i===7?1.2:0.28,midi(note),0.22,'square');tone(data,i*0.14,i===7?1.2:0.28,midi(note-12),0.12,'triangle');}); write('victory',data);
console.log(`Generated 9 original WAV assets in ${out}`);
