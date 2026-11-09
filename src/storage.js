/** Device-local data. Photos are never sent to a server. */
const PREFIX = 'alien-karaoke.v1.';
export const STORAGE_KEYS = Object.freeze({ profile: `${PREFIX}profile`, records: `${PREFIX}records`, settings: `${PREFIX}settings` });
export const DEFAULT_SETTINGS = Object.freeze({ volume: 0.45, muted: true, reducedMotion: false });

function storage() {
  try { return globalThis.localStorage ?? null; } catch { return null; }
}
function read(key, fallback) {
  try {
    const raw = storage()?.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch { return fallback; }
}
function write(key, value) {
  try {
    const local = storage();
    if (!local) throw new Error('Device storage is unavailable. Your session still works, but it cannot be saved.');
    local.setItem(key, JSON.stringify(value));
    return { ok: true, value };
  } catch (err) {
    return { ok: false, value, error: err?.name === 'QuotaExceededError'
      ? 'Device storage is full. Your alien works for this session, but could not be saved.'
      : (err?.message || 'Unable to save on this device.') };
  }
}
function text(value, max = 80) { return typeof value === 'string' ? value.trim().slice(0, max) : ''; }
function photo(value) {
  return typeof value === 'string' && value.length <= 2_500_000 && /^data:image\/(?:jpeg|jpg|png|webp);base64,[A-Za-z0-9+/=\s]+$/.test(value) ? value : null;
}
function faceDetails(value) {
  const safePhoto=photo(value?.photo);
  if(value?.faceVersion!=='landmark-alien-v2'||!safePhoto?.startsWith('data:image/png;base64,'))return {};
  const raw=value.faceMeta||{},meta={};
  for(const key of ['landmarks','processingMs','skinLuminance','rollDegrees','eyeEnlargement','noseScale','foreheadScale'])if(Number.isFinite(raw[key]))meta[key]=raw[key];
  return {faceVersion:'landmark-alien-v2',faceMeta:meta};
}
function identity(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const nickname = text(value.nickname, 24);
  const id = text(value.id, 80);
  if (!nickname || !id) return null;
  return { id, nickname, photo: photo(value.photo), ...faceDetails(value), createdAt: typeof value.createdAt === 'string' ? value.createdAt : new Date().toISOString() };
}
function record(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const score = Number(value.score);
  const nickname = text(value.nickname, 24);
  const song = text(value.song, 160);
  const id = text(value.id, 80);
  const profileId = text(value.profileId, 80);
  if (!id || !profileId || !nickname || !song || !Number.isInteger(score) || score < 85 || score > 100) return null;
  return { id, profileId, nickname, photo: photo(value.photo), ...faceDetails(value), song, videoId: /^[\w-]{11}$/.test(value.videoId || '') ? value.videoId : '', score,
    createdAt: typeof value.createdAt === 'string' ? value.createdAt : new Date().toISOString() };
}
function sorted(records) {
  return records.sort((a, b) => b.score - a.score || a.createdAt.localeCompare(b.createdAt)).slice(0, 50);
}
export function loadProfile() { return identity(read(STORAGE_KEYS.profile, null)); }
export function saveProfile(profile) {
  const valid = identity(profile);
  return valid ? write(STORAGE_KEYS.profile, valid) : { ok: false, error: 'Your alien needs a nickname and identity before saving.' };
}
export function loadRecords() {
  const raw = read(STORAGE_KEYS.records, []);
  if(Array.isArray(raw))return sorted(raw.map(record).filter(Boolean));
  if(!raw||raw.version!==2||!Array.isArray(raw.records))return [];
  const avatars=raw.avatars&&typeof raw.avatars==='object'&&!Array.isArray(raw.avatars)?raw.avatars:null;
  const expanded=raw.records.map(value=>{
    if(!value||typeof value!=='object'||Array.isArray(value))return null;
    const ref=value.photoRef;
    const avatar=avatars&&typeof ref==='string'&&/^a\d{1,3}$/.test(ref)&&Object.hasOwn(avatars,ref)?photo(avatars[ref]):null;
    // Missing/corrupt references discard only the avatar, never a valid score.
    // Explicitly override any inline photo so the v2 schema stays unambiguous.
    return record({...value,photo:avatar});
  }).filter(Boolean);
  return sorted(expanded);
}

/** Keep each prepared PNG once, atomically alongside all rows that use it. */
function packedRecords(records) {
  const avatars=Object.create(null),references=new Map();
  const packed=records.map(({photo:avatar,...details})=>{
    if(!avatar)return details;
    let ref=references.get(avatar);
    if(ref===undefined){ref=`a${references.size}`;references.set(avatar,ref);avatars[ref]=avatar;}
    return {...details,photoRef:ref};
  });
  return {version:2,avatars,records:packed};
}

export function addRecord(performance) {
  const valid = record(performance);
  if (!valid) return { ok: false, error: 'This performance could not be saved because its details are incomplete.' };
  const records = loadRecords().filter(item => item.id !== valid.id);
  records.push(valid);
  const expanded=sorted(records);
  const result=write(STORAGE_KEYS.records,packedRecords(expanded));
  // The public API always returns complete rows, including after quota failure.
  return {...result,value:expanded};
}
export function loadSettings() {
  const value = read(STORAGE_KEYS.settings, {});
  if (!value || typeof value !== 'object') return { ...DEFAULT_SETTINGS };
  return {
    volume: Number.isFinite(value.volume) ? Math.min(1, Math.max(0, value.volume)) : DEFAULT_SETTINGS.volume,
    muted: typeof value.muted === 'boolean' ? value.muted : DEFAULT_SETTINGS.muted,
    reducedMotion: typeof value.reducedMotion === 'boolean' ? value.reducedMotion : (globalThis.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches ?? DEFAULT_SETTINGS.reducedMotion),
  };
}
export function saveSettings(value) {
  const settings = { ...loadSettings(), ...value };
  settings.volume = Number.isFinite(settings.volume) ? Math.min(1, Math.max(0, settings.volume)) : DEFAULT_SETTINGS.volume;
  settings.muted = Boolean(settings.muted);
  settings.reducedMotion = Boolean(settings.reducedMotion);
  return write(STORAGE_KEYS.settings, settings);
}
/** Entertainment score only: a fair uniform integer in [85, 100], never an analysis of singing. */
export function randomScore() {
  const data = new Uint8Array(1);
  if (globalThis.crypto?.getRandomValues) {
    globalThis.crypto.getRandomValues(data);
    return 85 + (data[0] & 15);
  }
  return 85 + Math.floor(Math.random() * 16);
}
/** Fictional house characters: keep separate from real participant records. */
export const HOUSE_RECORDS = Object.freeze([
  { id: 'house-1', nickname: 'ZIGGY STARDUST', song: 'Space Oddity', score: 99, color: '#c6ff45', house: true },
  { id: 'house-2', nickname: 'LIL’ ABDUCTION', song: 'Dancing Queen', score: 97, color: '#c591ff', house: true },
  { id: 'house-3', nickname: 'DJ TENTACLES', song: 'Never Gonna Give You Up', score: 95, color: '#ff9159', house: true },
]);
