import test from 'node:test';
import assert from 'node:assert/strict';
import { STORAGE_KEYS, loadProfile, saveProfile, loadRecords, addRecord, loadSettings, saveSettings, randomScore, HOUSE_RECORDS } from '../src/storage.js';
import { AlienAudio } from '../src/audio.js';
const memory = new Map();
globalThis.localStorage = { getItem: key => memory.get(key) ?? null, setItem: (key, value) => memory.set(key, value), removeItem: key => memory.delete(key) };
const reset = () => memory.clear();
const profile = { id: 'participant-1', nickname: 'Moon Singer', photo: 'data:image/jpeg;base64,SGVsbG8=', createdAt: '2026-11-09T00:00:00.000Z' };
const performance = (index, score=90) => ({ id: `performance-${index}`, profileId: profile.id, nickname: profile.nickname, photo: profile.photo, song: `Song ${index}`, videoId: 'dQw4w9WgXcQ', score, createdAt: `2026-11-09T00:00:${String(index % 60).padStart(2,'0')}.000Z` });
test('corrupt JSON and wrong storage shapes recover safely', () => {
  reset(); memory.set(STORAGE_KEYS.profile, '{broken'); memory.set(STORAGE_KEYS.records, '{broken'); memory.set(STORAGE_KEYS.settings, 'null');
  assert.equal(loadProfile(), null); assert.deepEqual(loadRecords(), []); assert.equal(loadSettings().muted, true);
  memory.set(STORAGE_KEYS.records, JSON.stringify([null, {}, { score: 100 }, 'bad'])); assert.deepEqual(loadRecords(), []);
});
test('identity remains recognizable across reload and repeat performance', () => {
  reset(); assert.equal(saveProfile(profile).ok, true); assert.deepEqual(loadProfile(), profile);
  addRecord(performance(1)); addRecord(performance(2, 99));
  assert.equal(loadRecords()[0].profileId, loadProfile().id); assert.equal(loadRecords()[0].photo, profile.photo);
});
test('records are ranked, bounded and idempotent; fictional house scores are separate', () => {
  reset(); for(let i=0;i<60;i++) assert.equal(addRecord(performance(i,85+(i%16))).ok,true);
  const result = loadRecords(); assert.equal(result.length,50); assert.equal(result[0].score,100);
  for(let i=1;i<result.length;i++) assert.ok(result[i-1].score>=result[i].score);
  addRecord(performance(15,100)); assert.equal(loadRecords().filter(r=>r.id==='performance-15').length,1);
  assert.ok(HOUSE_RECORDS.every(r=>r.house)); assert.ok(loadRecords().every(r=>!r.house));
});
test('impossible scores and missing identities cannot enter the leaderboard', () => {
  reset(); assert.equal(addRecord(performance(1,101)).ok,false); assert.equal(addRecord(performance(2,84)).ok,false);
  assert.equal(addRecord({...performance(3),profileId:''}).ok,false); assert.deepEqual(loadRecords(),[]);
});
test('storage quota failure returns a useful result without losing in-memory value', () => {
  reset(); const original = globalThis.localStorage.setItem;
  globalThis.localStorage.setItem = () => { const err = new Error('full'); err.name='QuotaExceededError'; throw err; };
  const result = saveProfile(profile); assert.equal(result.ok,false); assert.match(result.error,/storage is full/i); assert.equal(result.value.id,profile.id);
  globalThis.localStorage.setItem = original;
});
test('settings are validated and bounded after both read and write', () => {
  reset(); saveSettings({volume:8,muted:false}); assert.equal(loadSettings().volume,1); assert.equal(loadSettings().muted,false);
  memory.set(STORAGE_KEYS.settings,JSON.stringify({volume:-3,muted:'yes',reducedMotion:1}));
  assert.deepEqual(loadSettings(),{volume:0,muted:true,reducedMotion:false});
});
test('entertainment scores include both endpoints and remain within requested range', () => {
  const values = new Set(); for(let i=0;i<10000;i++){const value=randomScore();assert.ok(Number.isInteger(value)&&value>=85&&value<=100);values.add(value);}
  assert.equal(values.size,16); assert.ok(values.has(85)&&values.has(100));
});
test('audio is silent by default and safe to configure before a user gesture', () => {
  const audio = new AlienAudio(); assert.equal(audio.muted,true); assert.equal(audio.context,null);
  audio.setVolume(0.8); audio.setMuted(false); audio.setScene('performance'); audio.effect('click'); audio.stopMicrophone();
  assert.equal(audio.volume,0.8); assert.equal(audio.levelRef.current,0); audio.dispose();
});

test('built-app server provides correct MIME, SPA routes and blocks escaping the build directory', async t => {
  const fs = await import('node:fs/promises');
  const os = await import('node:os');
  const path = await import('node:path');
  const { createStaticServer } = await import('../scripts/serve.mjs');
  const temporary = await fs.mkdtemp(path.join(os.tmpdir(), 'alien-server-test-'));
  const root = path.join(temporary, 'dist'); await fs.mkdir(root);
  await fs.writeFile(path.join(root,'index.html'),'<h1>Alien Karaoke</h1>');
  await fs.writeFile(path.join(root,'game.js'),'console.log("aliens");');
  await fs.writeFile(path.join(root,'click.wav'),Buffer.from('RIFFtest'));
  await fs.writeFile(path.join(root,'face.wasm'),Buffer.from([0,97,115,109,1,0,0,0]));
  await fs.writeFile(path.join(temporary,'secret.txt'),'private source');
  await fs.symlink(path.join(temporary,'secret.txt'),path.join(root,'secret-link.txt'));
  const server = createStaticServer(root);
  await new Promise(resolve => server.listen(0,'127.0.0.1',resolve));
  t.after(async () => { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); await fs.rm(temporary,{recursive:true,force:true}); });
  const origin = `http://127.0.0.1:${server.address().port}`;
  const index = await fetch(origin); assert.equal(index.status,200); assert.match(index.headers.get('content-type'),/text\/html/);
  const js = await fetch(`${origin}/game.js`); assert.match(js.headers.get('content-type'),/javascript/);
  const audioFile = await fetch(`${origin}/click.wav`); assert.equal(audioFile.headers.get('content-type'),'audio/wav');
  const wasmFile = await fetch(`${origin}/face.wasm`); assert.equal(wasmFile.headers.get('content-type'),'application/wasm');
  const spa = await fetch(`${origin}/hall-of-fame`); assert.equal(spa.status,200); assert.match(await spa.text(),/Alien Karaoke/);
  const head = await fetch(origin,{method:'HEAD'}); assert.equal(head.status,200); assert.equal(await head.text(),'');
  assert.equal((await fetch(`${origin}/missing.js`)).status,404);
  assert.equal((await fetch(`${origin}/%2e%2e%2fsecret.txt`)).status,404);
  assert.equal((await fetch(`${origin}/secret-link.txt`)).status,404);
  assert.equal((await fetch(`${origin}/.env`)).status,404);
  assert.equal((await fetch(`${origin}/%ZZ`)).status,400);
  assert.equal((await fetch(origin,{method:'POST'})).status,405);
});
