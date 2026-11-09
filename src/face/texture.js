/** Shared, dependency-free geometry contract for the generated face atlas. */
export const ALIEN_FACE_VERSION = 'landmark-alien-v2';
export const HEAD_RADII = Object.freeze({ x: .79, y: .95, z: .7 });

export function isAlienFaceProfile(profile) {
  return profile?.faceVersion === ALIEN_FACE_VERSION && typeof profile.photo === 'string' && profile.photo.startsWith('data:image/png;base64,');
}

/** Compact cache identity: do not duplicate a large PNG URL for every rank. */
export function faceTextureFingerprint(photo = '') {
  let a=2166136261,b=0x9e3779b9;
  for(let i=0;i<photo.length;i++){
    const value=photo.charCodeAt(i);
    a=Math.imul(a^value,16777619)>>>0;
    b=Math.imul(b^value,2246822519)>>>0;
  }
  return `${photo.length}-${a.toString(16)}-${b.toString(16)}`;
}

/**
 * Conform the face decal to the actual head, including its protruding chin.
 * The old rectangular patch used incompatible ellipse radii and cut through
 * the model at its edges. This surface remains outside both head meshes.
 */
export function getFacePatchPoint(u, v) {
  const theta = (u - .5) * 2.12;
  const phi = (v - .5) * 2.2;
  const x = HEAD_RADII.x * Math.sin(theta) * Math.cos(phi);
  const y = HEAD_RADII.y * Math.sin(phi);
  const headZ = HEAD_RADII.z * Math.cos(theta) * Math.cos(phi);
  const chinRadius = 1 - (x / .48) ** 2 - ((y + .58) / .43) ** 2;
  const chinZ = chinRadius > 0 ? .15 + .42 * Math.sqrt(chinRadius) : -1;
  // A small smooth union avoids a ridge where the original two head meshes meet.
  const delta = headZ - chinZ;
  const unionZ = .5 * (headZ + chinZ + Math.sqrt(delta * delta + .0001));
  return [x, y, unionZ + .006];
}

export function createFacePatchData(columns = 40, rows = 48) {
  const positions = [], uv = [], indices = [];
  for (let y = 0; y <= rows; y++) {
    for (let x = 0; x <= columns; x++) {
      const u = x / columns, v = y / rows;
      positions.push(...getFacePatchPoint(u, v));
      uv.push(u, v);
    }
  }
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < columns; x++) {
      const a = y * (columns + 1) + x, b = a + 1, c = a + columns + 1, d = c + 1;
      indices.push(a, b, c, b, d, c);
    }
  }
  return { positions, uv, indices };
}
