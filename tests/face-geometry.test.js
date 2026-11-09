import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ALIEN_FACE_VERSION,
  HEAD_RADII,
  createFacePatchData,
  faceTextureFingerprint,
  getFacePatchPoint,
  isAlienFaceProfile,
} from '../src/face/texture.js';

test('the prepared face surface remains in front of both existing head and chin meshes', () => {
  let chinPoints = 0;
  for (let row = 0; row <= 80; row++) {
    for (let column = 0; column <= 80; column++) {
      const [x, y, z] = getFacePatchPoint(column / 80, row / 80);
      assert.ok([x, y, z].every(Number.isFinite));
      const mainHeadZ = HEAD_RADII.z * Math.sqrt(Math.max(0, 1 - (x / HEAD_RADII.x) ** 2 - (y / HEAD_RADII.y) ** 2));
      assert.ok(z >= mainHeadZ + .00599, `head intersection at ${column},${row}`);
      const chinRadius = 1 - (x / .48) ** 2 - ((y + .58) / .43) ** 2;
      if (chinRadius > 0) {
        chinPoints++;
        const chinZ = .15 + .42 * Math.sqrt(chinRadius);
        assert.ok(z >= chinZ + .00599, `chin intersection at ${column},${row}`);
      }
    }
  }
  assert.ok(chinPoints > 100, 'the check must exercise the protruding chin, not only the sphere');
});

test('face UVs retain the whole generated atlas and every triangle faces the viewer', () => {
  const columns = 40, rows = 48;
  const { positions, uv, indices } = createFacePatchData(columns, rows);
  assert.equal(positions.length / 3, (columns + 1) * (rows + 1));
  assert.equal(uv.length / 2, positions.length / 3);
  assert.equal(indices.length / 3, columns * rows * 2);
  assert.deepEqual(uv.slice(0, 2), [0, 0]);
  assert.deepEqual(uv.slice(-2), [1, 1]);
  assert.ok(uv.every(value => value >= 0 && value <= 1));
  for (let triangle = 0; triangle < indices.length; triangle += 3) {
    const [a, b, c] = indices.slice(triangle, triangle + 3).map(index => positions.slice(index * 3, index * 3 + 3));
    // Front-facing means positive z in model coordinates. A flipped triangle
    // disappears under the material's FrontSide setting and makes a face hole.
    const normalZ = (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
    assert.ok(normalZ > 0, `back-facing or degenerate triangle ${triangle / 3}`);
  }
});

test('only explicitly generated, alpha-capable v2 textures can replace the default 3D face', () => {
  const png = 'data:image/png;base64,aGVsbG8=';
  assert.equal(isAlienFaceProfile({ photo: png, faceVersion: ALIEN_FACE_VERSION }), true);
  assert.equal(isAlienFaceProfile({ photo: png }), false);
  assert.equal(isAlienFaceProfile({ photo: png, faceVersion: 'legacy-photo' }), false);
  assert.equal(isAlienFaceProfile({ photo: 'data:image/jpeg;base64,aGVsbG8=', faceVersion: ALIEN_FACE_VERSION }), false);
  assert.equal(isAlienFaceProfile(null), false);
  assert.equal(isAlienFaceProfile({ faceVersion: ALIEN_FACE_VERSION }), false);
});

test('portrait cache identities are stable, compact, and change when pixels change', () => {
  const first = `data:image/png;base64,${'A'.repeat(500_000)}`;
  const changed = `${first.slice(0, -1)}B`;
  assert.equal(faceTextureFingerprint(first), faceTextureFingerprint(first));
  assert.notEqual(faceTextureFingerprint(first), faceTextureFingerprint(changed));
  assert.notEqual(faceTextureFingerprint(first), faceTextureFingerprint(`${first}A`));
  assert.ok(faceTextureFingerprint(first).length < 40, 'do not retain a duplicate PNG URL for every rank');
});
