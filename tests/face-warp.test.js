import test from 'node:test';
import assert from 'node:assert/strict';
import {createAlienWarp,renderAlienPixels,selectFace,OVAL,SKIN_RGB} from '../src/face/warp.js';
import {loadProfile,saveProfile,addRecord,loadRecords,STORAGE_KEYS} from '../src/storage.js';

function face(roll=0){
  const points=Array.from({length:478},()=>({x:.5,y:.5,z:0}));
  const set=(i,x,y)=>{points[i]={x:x/512,y:y/512,z:0};};
  OVAL.forEach((id,i)=>{const a=-Math.PI/2+i/OVAL.length*Math.PI*2;set(id,256+150*Math.cos(a),256+212*Math.sin(a));});
  const left=[33,7,163,144,145,153,154,155,133,173,157,158,159,160,161,246];
  const right=[362,382,381,380,374,373,390,249,263,466,388,387,386,385,384,398];
  for(const [ids,cx] of [[left,202],[right,310]])ids.forEach((id,i)=>{const a=Math.PI+i/ids.length*Math.PI*2;set(id,cx+29*Math.cos(a),218+12*Math.sin(a));});
  const lips=[61,185,40,39,37,0,267,269,270,409,291,375,321,405,314,17,84,181,91,146];
  lips.forEach((id,i)=>{const a=Math.PI+i/lips.length*Math.PI*2;set(id,256+48*Math.cos(a),354+17*Math.sin(a));});
  set(1,256,273);set(4,256,285);set(98,236,285);set(327,276,285);
  set(9,256,100);set(151,256,76);
  for(const [i,x,y] of [[50,160,285],[101,170,280],[118,175,300],[123,155,300],[280,350,285],[330,340,280],[347,335,300],[352,355,300]])set(i,x,y);
  if(roll)for(const p of points){const x=p.x-.5,y=p.y-.5;p.x=.5+x*Math.cos(roll)-y*Math.sin(roll);p.y=.5+x*Math.sin(roll)+y*Math.cos(roll);}
  return points;
}
function source(){
  const data=new Uint8ClampedArray(512*512*4);
  for(let y=0;y<512;y++)for(let x=0;x<512;x++){
    const i=(y*512+x)*4,l=.7+.28*(x/512)+.05*Math.sin(x*.28)*Math.sin(y*.16);
    data[i]=188*l;data[i+1]=143*l;data[i+2]=116*l;data[i+3]=255;
  }
  return {width:512,height:512,data};
}

test('rejects missing, multiple and incomplete face scans instead of copying the photograph',()=>{
  assert.throws(()=>selectFace({faceLandmarks:[]}),{code:'NO_FACE'});
  assert.throws(()=>selectFace({faceLandmarks:[face(),face()]}),{code:'MULTIPLE_FACES'});
  assert.throws(()=>createAlienWarp([],512,512),{code:'BAD_LANDMARKS'});
  const clipped=face();clipped[10].y=0;assert.throws(()=>createAlienWarp(clipped,512,512),{code:'FACE_CROPPED'});
});

test('landmark warp enlarges actual eyes, shrinks nose and keeps mouth recognizable',()=>{
  const input=face(),normal=createAlienWarp(input,512,512,{strength:0}),alien=createAlienWarp(input,512,512);
  const dist=(points,a,b)=>Math.hypot(points[a].x-points[b].x,points[a].y-points[b].y);
  const eyes=dist(alien.points,33,133)/dist(normal.points,33,133);
  const nose=dist(alien.points,98,327)/dist(normal.points,98,327);
  assert.ok(eyes>1.1&&eyes<1.35,`eye factor ${eyes}`);
  assert.ok(nose<.99&&nose>.8,`nose factor ${nose}`);
  assert.ok(Math.abs(dist(alien.points,61,291)/dist(normal.points,61,291)-1)<.08);
  for(const id of [10,33,133,263,362,4,98,327,61,291,152]){
    const result=alien.inverse(alien.points[id].x,alien.points[id].y);
    assert.ok(Math.hypot(result.x-input[id].x*512,result.y-input[id].y*512)<.1);
  }
});

test('face alignment removes head roll without moving expressive feature placement',()=>{
  const normal=createAlienWarp(face(),512,512),tilted=createAlienWarp(face(.19),512,512);
  assert.ok(Math.abs(tilted.roll-.19)<.001);
  for(const id of [33,133,263,362,4,61,291,152])assert.ok(Math.hypot(normal.points[id].x-tilted.points[id].x,normal.points[id].y-tilted.points[id].y)<.01);
});

test('full resolution texture has anatomical transparency, soft feathering and shaded green detail',()=>{
  const result=renderAlienPixels(source(),face());assert.equal(result.data.length,512*640*4);
  let feather=0,opaque=0,sum=0,sumSq=0;
  for(let i=0;i<result.data.length;i+=4){
    const a=result.data[i+3];if(a>0&&a<255)feather++;
    if(a===255){opaque++;sum+=result.data[i+1];sumSq+=result.data[i+1]**2;}
  }
  assert.ok(feather>5000&&opaque>50000);
  assert.ok(Math.sqrt(sumSq/opaque-(sum/opaque)**2)>5);
  for(const [x,y] of [[0,0],[511,0],[0,639],[511,639],[256,0],[0,320]]){
    const i=(y*512+x)*4;assert.equal(result.data[i+3],0);assert.deepEqual([...result.data.slice(i,i+3)],SKIN_RGB);
  }
  const center=(300*512+256)*4;assert.equal(result.data[center+3],255);assert.ok(result.data[center+1]>result.data[center]);
  // Near-transparent edge colors match the modeled skin and cannot reveal a box.
  const edge=[];for(let i=0;i<result.data.length;i+=4)if(result.data[i+3]>1&&result.data[i+3]<10)edge.push(i);
  assert.ok(edge.length>100);
  for(const i of edge.slice(0,100))for(let k=0;k<3;k++)assert.ok(Math.abs(result.data[i+k]-SKIN_RGB[k])<3);
});

test('generated PNG version and safe metadata persist in identity and performance records',()=>{
  const old=globalThis.localStorage,map=new Map();
  globalThis.localStorage={getItem:k=>map.get(k)||null,setItem:(k,v)=>map.set(k,v)};
  try{
    const profile={id:'test-filter',nickname:'Filter Face',photo:'data:image/png;base64,AAAA',faceVersion:'landmark-alien-v2',faceMeta:{landmarks:478,processingMs:190,secret:'discard'},createdAt:'2026-11-10T00:00:00Z'};
    assert.equal(saveProfile(profile).ok,true);assert.equal(loadProfile().faceVersion,profile.faceVersion);assert.equal(loadProfile().photo,profile.photo);assert.equal(loadProfile().faceMeta.secret,undefined);
    assert.equal(addRecord({...profile,id:'performance-1',profileId:profile.id,song:'Space Song',score:98}).ok,true);
    assert.equal(loadRecords()[0].faceVersion,profile.faceVersion);assert.equal(loadRecords()[0].faceMeta.landmarks,478);
    map.set(STORAGE_KEYS.profile,JSON.stringify({...profile,faceVersion:undefined}));assert.equal(loadProfile().faceVersion,undefined);
  }finally{globalThis.localStorage=old;}
});
