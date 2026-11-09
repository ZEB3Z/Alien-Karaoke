#!/usr/bin/env node
/** Optional developer-only image regression check. Portraits are not app assets. */
import fs from 'node:fs';
import path from 'node:path';
import { createCanvas, loadImage, ImageData } from '@napi-rs/canvas';
import { renderAlienPixels, createAlienWarp } from '../src/face/warp.js';

const input = process.argv[2];
if (!input) {
  console.error('Usage: node scripts/validate-face-fixtures.mjs <fixture-work-directory>');
  console.error('First run scripts/validate-face-landmarks.py to create detection-report.json and fixtures.');
  process.exit(1);
}
const work = path.resolve(input);
const detection = JSON.parse(fs.readFileSync(path.join(work, 'detection-report.json'), 'utf8'));
const output = path.join(work, 'transformed');
fs.mkdirSync(output, { recursive: true });
const results = [];
let failed = 0;
for (const fixture of detection.fixtures) {
  if (fixture.faces !== 1 || !fixture.landmarks) { failed++; continue; }
  try {
    const image = await loadImage(fixture.image);
    const source = createCanvas(image.width, image.height);
    const sourceContext = source.getContext('2d');
    sourceContext.drawImage(image, 0, 0);
    const pixels = sourceContext.getImageData(0, 0, image.width, image.height);
    const landmarks = JSON.parse(fs.readFileSync(fixture.landmarks, 'utf8'));
    const start = performance.now();
    const rendered = renderAlienPixels(pixels, landmarks);
    const renderMs = performance.now() - start;
    const atlas = createCanvas(rendered.width, rendered.height);
    atlas.getContext('2d').putImageData(new ImageData(rendered.data, rendered.width, rendered.height), 0, 0);
    const destination = path.join(output, fixture.id + '.png');
    fs.writeFileSync(destination, atlas.toBuffer('image/png'));
    const warp = createAlienWarp(landmarks, pixels.width, pixels.height);
    let maxInverseError = 0;
    for (let i = 0; i < 468; i++) {
      const actual = warp.inverse(warp.points[i].x, warp.points[i].y);
      const expected = warp.sourcePoints[i];
      maxInverseError = Math.max(maxInverseError, Math.hypot(actual.x - expected.x, actual.y - expected.y));
    }
    const distances = (a, b) => Math.hypot(warp.points[a].x - warp.points[b].x, warp.points[a].y - warp.points[b].y) / (Math.hypot(warp.sourcePoints[a].x - warp.sourcePoints[b].x, warp.sourcePoints[a].y - warp.sourcePoints[b].y) * warp.scale);
    let opaque = 0, feathered = 0, greenPixels = 0, luminance = 0, squared = 0;
    for (let i = 0; i < rendered.data.length; i += 4) {
      const [r, g, b, a] = rendered.data.subarray(i, i + 4);
      if (a > 0 && a < 255) feathered++;
      if (a === 255) opaque++;
      if (a > 250 && g > r * 1.08 && g > b * 1.2) {
        const l = r * .2126 + g * .7152 + b * .0722;
        greenPixels++; luminance += l; squared += l * l;
      }
    }
    const mean = luminance / greenPixels;
    const contrast = Math.sqrt(Math.max(0, squared / greenPixels - mean * mean));
    let edgeAlpha = 0;
    for (let x = 0; x < rendered.width; x++) {
      edgeAlpha = Math.max(edgeAlpha, rendered.data[x * 4 + 3], rendered.data[((rendered.height - 1) * rendered.width + x) * 4 + 3]);
    }
    for (let y = 0; y < rendered.height; y++) {
      edgeAlpha = Math.max(edgeAlpha, rendered.data[(y * rendered.width) * 4 + 3], rendered.data[(y * rendered.width + rendered.width - 1) * 4 + 3]);
    }
    const metrics = {
      ...fixture, output: destination, renderMs: +renderMs.toFixed(2),
      ...rendered.meta, opaquePixels: opaque, featheredPixels: feathered,
      greenPixels, greenMeanLuminance: +mean.toFixed(2), greenLuminanceStdDev: +contrast.toFixed(2),
      maxEdgeAlpha: edgeAlpha, maxInverseErrorPx: +maxInverseError.toFixed(5),
      measuredEyeWidthScale: +distances(33, 133).toFixed(3),
      measuredNoseWidthScale: +distances(98, 327).toFixed(3),
    };
    metrics.pass = rendered.width === 512 && rendered.height === 640 && edgeAlpha === 0 && opaque > 50000 && feathered > 5000 && contrast > 5 && maxInverseError < .5;
    if (!metrics.pass) failed++;
    results.push(metrics);
    console.log(fixture.id, metrics.pass ? 'PASS' : 'FAIL', `${metrics.renderMs}ms`, `contrast ${metrics.greenLuminanceStdDev}`, `eye ${metrics.measuredEyeWidthScale}`, `nose ${metrics.measuredNoseWidthScale}`);
  } catch (error) {
    failed++;
    results.push({ ...fixture, pass: false, code: error.code, error: error.message });
    console.error(fixture.id, error.code, error.message);
  }
}
// Contact sheet: before+after for each original, plus all controlled variants.
const identities = [...new Set(results.map(row => row.source))];
const variants = ['neutral','dim','bright','warm','side-shadow','tilted'];
const sheet = createCanvas(identities.length * 400, 350);
const ctx = sheet.getContext('2d');
ctx.fillStyle = '#101120'; ctx.fillRect(0, 0, sheet.width, sheet.height);
ctx.font = '14px sans-serif';
for (let i = 0; i < identities.length; i++) {
  const row = results.find(row => row.source === identities[i] && row.variation === 'neutral' && row.pass);
  if (!row) continue;
  ctx.drawImage(await loadImage(row.image), i * 400, 24, 190, 190);
  ctx.fillStyle = '#b3ec63'; ctx.beginPath(); ctx.ellipse(i * 400 + 295, 143, 85, 117, 0, 0, Math.PI * 2); ctx.fill();
  ctx.drawImage(await loadImage(row.output), i * 400 + 200, 24, 190, 237);
  ctx.fillStyle = '#f4f2ff'; ctx.fillText(row.source.replace(/\.(png|jpg)$/, ''), i * 400 + 8, 280);
  ctx.fillStyle = '#aab2bb'; ctx.fillText('Original / transformed face atlas', i * 400 + 8, 300);
  ctx.fillText(`Eye width ×${row.measuredEyeWidthScale}`, i * 400 + 8, 320);
  ctx.fillText(`Nose width ×${row.measuredNoseWidthScale}`, i * 400 + 200, 320);
}
fs.writeFileSync(path.join(work, 'before-after-contact-sheet.png'), sheet.toBuffer('image/png'));
const allSheet = createCanvas(variants.length * 190, identities.length * 275);
const all = allSheet.getContext('2d'); all.fillStyle = '#141522'; all.fillRect(0, 0, allSheet.width, allSheet.height); all.font = '12px sans-serif';
for (let y = 0; y < identities.length; y++) for (let x = 0; x < variants.length; x++) {
  const row = results.find(row => row.source === identities[y] && row.variation === variants[x]);
  if (!row?.pass) continue;
  const px = x * 190, py = y * 275;
  all.fillStyle = '#b3ec63'; all.beginPath(); all.ellipse(px + 95, py + 125, 83, 120, 0, 0, Math.PI * 2); all.fill();
  all.drawImage(await loadImage(row.output), px, py, 190, 237);
  all.fillStyle = '#f4f2ff'; all.fillText(variants[x], px + 10, py + 257);
}
fs.writeFileSync(path.join(work, 'all-transformed-contact-sheet.png'), allSheet.toBuffer('image/png'));
const report = { total: detection.total, passed: results.filter(row => row.pass).length, failed, model_sha256: detection.model_sha256, results };
fs.writeFileSync(path.join(work, 'transformation-report.json'), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ total: report.total, passed: report.passed, failed: report.failed, outputDirectory: output }, null, 2));
if (failed || report.passed !== 24) process.exitCode = 1;
