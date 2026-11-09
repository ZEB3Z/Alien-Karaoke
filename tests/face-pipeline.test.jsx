import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createCanvas, Image as NativeImage, ImageData as NativeImageData, loadImage } from '@napi-rs/canvas';
import { OVAL } from '../src/face/warp.js';

const vision = vi.hoisted(() => ({ resolve: vi.fn(), create: vi.fn(), detect: vi.fn(), close: vi.fn() }));
vi.mock('@mediapipe/tasks-vision', () => ({
  FilesetResolver: { forVisionTasks: vision.resolve },
  FaceLandmarker: { createFromOptions: vision.create },
}));

// Anatomically placed detector output, deliberately not a rendered fake filter.
// Actual photo/model inference is covered separately by the documented fixtures.
function landmarks() {
  const points = Array.from({ length: 478 }, () => ({ x: .5, y: .5, z: 0 }));
  const set = (i, x, y) => { points[i] = { x: x / 512, y: y / 512, z: 0 }; };
  OVAL.forEach((id, i) => { const a = -Math.PI / 2 + i / OVAL.length * Math.PI * 2; set(id, 256 + 150 * Math.cos(a), 256 + 212 * Math.sin(a)); });
  for (const [ids, cx] of [
    [[33, 7, 163, 144, 145, 153, 154, 155, 133, 173, 157, 158, 159, 160, 161, 246], 202],
    [[362, 382, 381, 380, 374, 373, 390, 249, 263, 466, 388, 387, 386, 385, 384, 398], 310],
  ]) ids.forEach((id, i) => { const a = Math.PI + i / ids.length * Math.PI * 2; set(id, cx + 29 * Math.cos(a), 218 + 12 * Math.sin(a)); });
  const lips = [61, 185, 40, 39, 37, 0, 267, 269, 270, 409, 291, 375, 321, 405, 314, 17, 84, 181, 91, 146];
  lips.forEach((id, i) => { const a = Math.PI + i / lips.length * Math.PI * 2; set(id, 256 + 48 * Math.cos(a), 354 + 17 * Math.sin(a)); });
  for (const [i, x, y] of [[1, 256, 273], [4, 256, 285], [98, 236, 285], [327, 276, 285], [9, 256, 100], [151, 256, 76], [50, 160, 285], [101, 170, 280], [118, 175, 300], [123, 155, 300], [280, 350, 285], [330, 340, 280], [347, 335, 300], [352, 355, 300]]) set(i, x, y);
  return points;
}

function sourcePhoto() {
  const canvas = createCanvas(512, 512), context = canvas.getContext('2d');
  const pixels = context.createImageData(512, 512);
  for (let y = 0; y < 512; y++) for (let x = 0; x < 512; x++) {
    const i = (y * 512 + x) * 4, light = .65 + .3 * x / 512 + .05 * Math.sin(x * .28) * Math.sin(y * .16);
    pixels.data[i] = 188 * light; pixels.data[i + 1] = 143 * light; pixels.data[i + 2] = 116 * light; pixels.data[i + 3] = 255;
  }
  context.putImageData(pixels, 0, 0);
  return canvas.toDataURL('image/jpeg', .96);
}

let idleCallbacks;
beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  idleCallbacks = [];
  const actualTimeout = globalThis.setTimeout;
  vi.spyOn(globalThis, 'setTimeout').mockImplementation((callback, delay, ...args) => {
    if (delay === 60000) {
      idleCallbacks.push({ callback, delay });
      // Keep the timer handle contract while making the one-minute event explicit.
      return actualTimeout(() => {}, 0);
    }
    return actualTimeout(callback, delay, ...args);
  });
  const createElement = document.createElement.bind(document);
  vi.spyOn(document, 'createElement').mockImplementation((tag, ...args) => tag.toLowerCase() === 'canvas' ? createCanvas(1, 1) : createElement(tag, ...args));
  vi.stubGlobal('Image', NativeImage);
  vi.stubGlobal('ImageData', NativeImageData);
  vi.stubGlobal('Worker', undefined);
  vision.resolve.mockResolvedValue({ wasmLoaderPath: '/mediapipe/wasm/local.js' });
  vision.detect.mockReturnValue({ faceLandmarks: [landmarks()] });
  vision.create.mockResolvedValue({ detect: vision.detect, close: vision.close });
});

afterEach(async () => {
  idleCallbacks.at(-1)?.callback();
  await Promise.resolve();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('actual browser face pipeline with native canvas', () => {
  it('detects once using local CPU IMAGE assets and returns a real shaded, feathered PNG', async () => {
    const { transformAlienFace } = await import('../src/face/faceFilter.js');
    const original = sourcePhoto(), progress = vi.fn();
    const result = await transformAlienFace(original, { onProgress: progress });
    expect(vision.detect).toHaveBeenCalledOnce();
    expect(vision.detect.mock.calls[0][0].width).toBe(512);
    const wasm = new URL(vision.resolve.mock.calls[0][0]);
    const options = vision.create.mock.calls[0][1], model = new URL(options.baseOptions.modelAssetPath);
    expect(wasm.origin).toBe(window.location.origin);
    expect(wasm.pathname).toBe('/mediapipe/wasm');
    expect(model.origin).toBe(window.location.origin);
    expect(model.pathname).toBe('/mediapipe/face_landmarker.task');
    expect(options).toMatchObject({ runningMode: 'IMAGE', numFaces: 2, baseOptions: { delegate: 'CPU' } });
    expect(result.faceVersion).toBe('landmark-alien-v2');
    expect(result.photo).toMatch(/^data:image\/png;base64,/);
    expect(result.photo).not.toBe(original);
    expect(result.faceMeta).toMatchObject({ landmarks: 478, eyeEnlargement: 1.19, noseScale: .86 });
    expect(progress.mock.calls.at(-1)[0].progress).toBe(1);

    const image = await loadImage(result.photo);
    expect([image.width, image.height]).toEqual([512, 640]);
    const context = createCanvas(512, 640).getContext('2d');
    context.drawImage(image, 0, 0);
    const data = context.getImageData(0, 0, 512, 640).data;
    for (const [x, y] of [[0, 0], [511, 0], [0, 639], [511, 639], [256, 0]]) expect(data[(y * 512 + x) * 4 + 3]).toBe(0);
    const center = (300 * 512 + 256) * 4;
    expect(data[center + 3]).toBe(255);
    expect(data[center + 1]).toBeGreaterThan(data[center]);
    let feathered = 0;
    for (let i = 3; i < data.length; i += 4) if (data[i] > 0 && data[i] < 255) feathered++;
    expect(feathered).toBeGreaterThan(5000);
  });

  it('rejects an empty face scan and never returns the original photograph as an avatar', async () => {
    vision.detect.mockReturnValue({ faceLandmarks: [] });
    const { transformAlienFace } = await import('../src/face/faceFilter.js');
    await expect(transformAlienFace(sourcePhoto())).rejects.toMatchObject({ code: 'NO_FACE' });
    expect(vision.detect).toHaveBeenCalledOnce();
    expect(idleCallbacks.at(-1)?.delay).toBe(60000);
  });

  it('discards a scan canceled while model initialization is in flight', async () => {
    let ready;
    vision.create.mockImplementationOnce(() => new Promise(resolve => { ready = resolve; }));
    const { transformAlienFace } = await import('../src/face/faceFilter.js');
    const controller = new AbortController();
    const outcome = transformAlienFace(sourcePhoto(), { signal: controller.signal }).then(value => ({ value }), error => ({ error }));
    await vi.waitFor(() => expect(vision.create).toHaveBeenCalledOnce());
    controller.abort();
    ready({ detect: vision.detect, close: vision.close });
    expect((await outcome).error).toMatchObject({ name: 'AbortError' });
    expect(vision.detect).not.toHaveBeenCalled();
  });

  it('closes the cached detector when its scheduled one-minute idle callback fires', async () => {
    const { transformAlienFace } = await import('../src/face/faceFilter.js');
    await transformAlienFace(sourcePhoto());
    expect(vision.close).not.toHaveBeenCalled();
    expect(idleCallbacks.at(-1)?.delay).toBe(60000);
    idleCallbacks.at(-1).callback();
    await Promise.resolve();
    expect(vision.close).toHaveBeenCalledOnce();
    idleCallbacks = [];
  });
});
