import test from 'node:test';
import assert from 'node:assert/strict';
import { ACCESSORIES, ACCENTS, OUTFITS, SKINS, normalizeAlienStyle, styleFingerprint } from '../src/alienStyle.js';
import { STORAGE_KEYS, loadProfile, saveProfile, loadRecords, addRecord } from '../src/storage.js';

const values=new Map();
globalThis.localStorage={getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,value)};
const style={ skin:'lilac', accessory:'crown', outfit:'starlight', accent:'blue' };

test('registrar offers a rich set of validated options and stable fingerprints',()=>{
  assert.ok(SKINS.length>=8);
  assert.ok(ACCESSORIES.length>=9);
  assert.ok(OUTFITS.length>=6);
  assert.ok(ACCENTS.length>=5);
  assert.deepEqual(normalizeAlienStyle(style),style);
  assert.notEqual(styleFingerprint(style),styleFingerprint({...style,accessory:'headphones'}));
  assert.deepEqual(normalizeAlienStyle({skin:'javascript:alert(1)',accessory:'<script>',outfit:'???',accent:null}),{skin:'lime',accessory:'none',outfit:'nebula',accent:'lemon'});
});

test('customization survives profile and play-record round trips without altering face data',()=>{
  values.clear();
  const profile={id:'visitor-1',nickname:'Captain Blorp',photo:'data:image/png;base64,RmlsdGVy',faceVersion:'landmark-alien-v2',faceMeta:{landmarks:478},style,createdAt:'2026-11-10T00:00:00.000Z'};
  assert.equal(saveProfile(profile).ok,true);
  assert.deepEqual(loadProfile().style,style);
  assert.equal(loadProfile().photo,profile.photo);
  const row={...profile,profileId:profile.id,score:92,song:'Outer Space',videoId:'dQw4w9WgXcQ'};
  assert.equal(addRecord(row).ok,true);
  assert.deepEqual(loadRecords()[0].style,style);
  assert.equal(loadRecords()[0].photo,profile.photo);
  const packed=JSON.parse(values.get(STORAGE_KEYS.records));
  assert.deepEqual(packed.records[0].style,style);
});
