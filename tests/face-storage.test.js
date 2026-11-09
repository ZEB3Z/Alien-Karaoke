import test from 'node:test';
import assert from 'node:assert/strict';
import { STORAGE_KEYS, addRecord, loadRecords } from '../src/storage.js';

const memory=new Map();
const local={getItem:key=>memory.get(key)??null,setItem:(key,value)=>memory.set(key,value)};
const png=`data:image/png;base64,${'A'.repeat(200_000)}`;
const alternate=`data:image/png;base64,${'B'.repeat(200_000)}`;
const row=(id,photo=png)=>({
  id:`score-${id}`,profileId:'earthling-1',nickname:'Space Singer',photo,
  faceVersion:'landmark-alien-v2',faceMeta:{landmarks:478,eyeEnlargement:1.19,processingMs:180},
  song:`Cosmic Song ${id}`,videoId:'dQw4w9WgXcQ',score:85+(id%16),
  createdAt:new Date(Date.UTC(2026,10,9,0,0,id)).toISOString(),
});
const reset=()=>{memory.clear();globalThis.localStorage=local;};

test('fifty repeat performances store one transformed PNG and reload complete identities',()=>{
  reset();
  for(let i=0;i<50;i++)assert.equal(addRecord(row(i)).ok,true);
  const serialized=memory.get(STORAGE_KEYS.records),saved=JSON.parse(serialized);
  assert.equal(saved.version,2);
  assert.equal(saved.records.length,50);
  assert.deepEqual(Object.keys(saved.avatars),['a0']);
  assert.equal(saved.avatars.a0,png);
  assert.ok(saved.records.every(value=>value.photoRef==='a0'&&!Object.hasOwn(value,'photo')));
  assert.ok(serialized.length<png.length*1.2,'metadata must not duplicate the 200KB texture fifty times');
  const reloaded=loadRecords();
  assert.equal(reloaded.length,50);
  assert.ok(reloaded.every(value=>value.photo===png&&value.faceVersion==='landmark-alien-v2'&&value.faceMeta.landmarks===478));
  assert.equal(reloaded[0].song,'Cosmic Song 49');
  assert.equal(reloaded[0].score,86);
});

test('distinct transformed faces receive distinct references and remain attached to their scores',()=>{
  reset();addRecord(row(1));addRecord(row(2,alternate));addRecord(row(3));
  const saved=JSON.parse(memory.get(STORAGE_KEYS.records));
  assert.equal(Object.keys(saved.avatars).length,2);
  const reloaded=loadRecords();
  assert.equal(reloaded.find(value=>value.id==='score-2').photo,alternate);
  assert.equal(reloaded.find(value=>value.id==='score-1').photo,png);
  assert.equal(reloaded.find(value=>value.id==='score-3').photo,png);
  assert.ok(reloaded.every(value=>!Object.hasOwn(value,'photoRef')));
});

test('legacy arrays remain readable and migrate atomically on the next successful write',()=>{
  reset();
  const legacy={...row(1),photo:'data:image/jpeg;base64,SGVsbG8='};
  delete legacy.faceVersion;delete legacy.faceMeta;
  memory.set(STORAGE_KEYS.records,JSON.stringify([legacy]));
  assert.deepEqual(loadRecords(),[legacy]);
  const outcome=addRecord(row(2));
  assert.equal(outcome.ok,true);
  assert.equal(outcome.value.length,2);
  assert.ok(outcome.value.every(value=>Object.hasOwn(value,'photo')));
  const saved=JSON.parse(memory.get(STORAGE_KEYS.records));
  assert.equal(saved.version,2);assert.equal(Object.keys(saved.avatars).length,2);
  assert.deepEqual(loadRecords(),outcome.value);
});

test('quota failure keeps the previous atomic payload and returns expanded current-session rows',()=>{
  reset();addRecord(row(1));
  const previous=memory.get(STORAGE_KEYS.records);
  globalThis.localStorage={...local,setItem:()=>{const error=new Error('full');error.name='QuotaExceededError';throw error;}};
  const outcome=addRecord(row(2,alternate));
  assert.equal(outcome.ok,false);assert.match(outcome.error,/storage is full/i);
  assert.equal(outcome.value.length,2);
  assert.equal(outcome.value.find(value=>value.id==='score-2').photo,alternate);
  assert.ok(outcome.value.every(value=>!Object.hasOwn(value,'photoRef')));
  assert.equal(memory.get(STORAGE_KEYS.records),previous);
  assert.equal(loadRecords().length,1);
  globalThis.localStorage=local;
});

test('corrupt, unsafe and missing avatar references preserve valid scores without a raw-photo fallback',()=>{
  reset();
  const refs=['missing','a1','__proto__','constructor','a2'];
  const records=refs.map((photoRef,index)=>({...row(index),photoRef}));
  // a1 is not an image. a2 belongs to the prototype rather than the stored map.
  const avatars=Object.create({a2:png});avatars.a0=png;avatars.a1=42;
  memory.set(STORAGE_KEYS.records,JSON.stringify({version:2,avatars,records}));
  const loaded=loadRecords();
  assert.equal(loaded.length,refs.length);
  assert.ok(loaded.every(value=>value.photo===null&&!Object.hasOwn(value,'faceVersion')));
  // An invalid avatar-map shape also loses only the photos, not the scores.
  memory.set(STORAGE_KEYS.records,JSON.stringify({version:2,avatars:[png],records}));
  assert.equal(loadRecords().length,refs.length);
  assert.ok(loadRecords().every(value=>value.photo===null));
  memory.set(STORAGE_KEYS.records,JSON.stringify({version:2,avatars:null,records:null}));
  assert.deepEqual(loadRecords(),[]);
});

test('malformed legacy photo types cannot throw while reading a valid score',()=>{
  reset();memory.set(STORAGE_KEYS.records,JSON.stringify([{...row(1),photo:42}]));
  assert.doesNotThrow(()=>loadRecords());
  const [loaded]=loadRecords();assert.equal(loaded.photo,null);
  assert.equal(Object.hasOwn(loaded,'faceVersion'),false);
});
