import React, { Component, useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { createFacePatchData, faceTextureFingerprint, isAlienFaceProfile } from './face/texture.js';

const TAU = Math.PI * 2;
const GREEN = '#b3ec63';
const MAT = {
  green: new THREE.MeshStandardMaterial({ color: GREEN, roughness: .55, flatShading: true }),
  dark: new THREE.MeshStandardMaterial({ color: '#10152a', roughness: .38, metalness: .55, flatShading: true }),
  eye: new THREE.MeshStandardMaterial({ color: '#081020', roughness: .1, metalness: .45 }),
  silver: new THREE.MeshStandardMaterial({ color: '#b0becb', roughness: .32, metalness: .8, flatShading: true }),
  purple: new THREE.MeshStandardMaterial({ color: '#6a39b5', roughness: .5, metalness: .4, flatShading: true }),
  yellow: new THREE.MeshStandardMaterial({ color: '#faff82', emissive: '#d6e75c', emissiveIntensity: .7 }),
  pink: new THREE.MeshBasicMaterial({ color: '#f780d3' }),
  mint: new THREE.MeshBasicMaterial({ color: '#c4fa9c' }),
};
const ball = new THREE.SphereGeometry(1, 16, 12);
const capsule = new THREE.CapsuleGeometry(.14, .65, 3, 7);
const cube = new THREE.BoxGeometry(1, 1, 1);

function addMesh(parent, geometry, material, position=[0,0,0], scale=[1,1,1], rotation=[0,0,0]) {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(...position); mesh.scale.set(...scale); mesh.rotation.set(...rotation);
  parent.add(mesh); return mesh;
}

// The face is a curved part of the head, not a floating picture or billboard.
function faceGeometry() {
  const { positions, uv, indices }=createFacePatchData();
  const geo=new THREE.BufferGeometry();
  geo.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
  geo.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2)); geo.setIndex(indices); geo.computeVertexNormals();
  return geo;
}
const faceSurface=faceGeometry();

function disposeAlienModel(model) {
  const sharedGeometry=new Set([ball,capsule,cube,faceSurface]);
  const sharedMaterials=new Set(Object.values(MAT));
  const geometry=new Set(),materials=new Set();
  model.traverse(object=>{
    if(object.geometry&&!sharedGeometry.has(object.geometry))geometry.add(object.geometry);
    const list=Array.isArray(object.material)?object.material:[object.material];
    list.forEach(material=>{if(material&&!sharedMaterials.has(material))materials.add(material);});
  });
  geometry.forEach(resource=>resource.dispose());materials.forEach(resource=>resource.dispose());
}

function makeAlien({color=GREEN, seed=0, photoTexture=null, judge=false}={}) {
  const group=new THREE.Group();
  const skin=new THREE.MeshStandardMaterial({color,roughness:.57,flatShading:true});
  const shirt=new THREE.MeshStandardMaterial({color:judge?'#fbb7e6':seed%3===0?'#705ac7':'#c7da8a',roughness:.7,flatShading:true});
  const torso=addMesh(group,ball,skin,[0,1.38,0],[.38,.52,.28]);
  const head=new THREE.Group(); head.position.set(0,2.47,.02); group.add(head);
  addMesh(head,ball,skin,[0,0,0],[.79,.95,.7]);
  addMesh(head,ball,skin,[0,-.58,.15],[.48,.43,.42]);
  const faceMaterial=new THREE.MeshStandardMaterial({map:photoTexture,transparent:true,roughness:.57,metalness:0,side:THREE.FrontSide,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-1});
  const face=addMesh(head,faceSurface,faceMaterial); face.visible=!!photoTexture;
  const eyeL=addMesh(head,ball,MAT.eye,[-.37,.12,.566],[.225,.35,.105],[0,0,-.32]);
  const eyeR=addMesh(head,ball,MAT.eye,[.37,.12,.566],[.225,.35,.105],[0,0,.32]);
  const glint=new THREE.MeshBasicMaterial({color:'#d3ecf6'});
  const shineL=addMesh(head,ball,glint,[-.42,.22,.655],[.035,.065,.018]);
  const shineR=addMesh(head,ball,glint,[.32,.22,.655],[.035,.065,.018]);
  const mouth=addMesh(head,new THREE.TorusGeometry(.13,.016,4,10,Math.PI),MAT.eye,[0,-.45,.613],[1,.7,1],[0,0,Math.PI]);
  [eyeL,eyeR,shineL,shineR,mouth].forEach(m=>m.visible=!photoTexture);
  // Long spindly limbs make the oversized head especially ridiculous.
  const arms=[]; const legs=[];
  [-1,1].forEach(side=>{
    const arm=new THREE.Group(); arm.position.set(side*.33,1.68,0); group.add(arm);
    addMesh(arm,capsule,skin,[side*.16,-.43,0],[.75,1,.75],[0,0,side*.28]);
    addMesh(arm,ball,skin,[side*.3,-.92,.02],[.12,.18,.11]);
    for(let finger=0;finger<3;finger++) addMesh(arm,capsule,skin,[side*(.24+finger*.057),-1.04,.035],[.18,.23,.18],[0,0,side*(.4-finger*.32)]);
    arms.push(arm);
    const leg=new THREE.Group(); leg.position.set(side*.19,.99,0); group.add(leg);
    addMesh(leg,capsule,skin,[0,-.42,0],[.84,1.06,.84]);
    addMesh(leg,ball,skin,[0,-.87,.11],[.18,.11,.29]); legs.push(leg);
  });
  addMesh(group,new THREE.TorusGeometry(.34,.045,4,16),shirt,[0,1.38,0],[1,1,1],[Math.PI/2,0,0]);
  const medallion=addMesh(group,new THREE.CylinderGeometry(.1,.1,.04,8),MAT.yellow,[0,1.58,.28],[1,1,1],[Math.PI/2,0,0]);
  for(const side of [-1,1]) {
    addMesh(head,new THREE.CylinderGeometry(.026,.04,.4,5),skin,[side*.42,.88,-.04],[1,1,1],[0,0,-side*.42]);
    addMesh(head,ball,MAT.pink,[side*.5,1.07,-.04],[.09,.09,.09]);
  }
  if(judge){
    addMesh(head,new THREE.CylinderGeometry(.5,.6,.15,8),MAT.purple,[0,.92,0]);
    addMesh(head,new THREE.CylinderGeometry(.35,.44,.52,8),MAT.purple,[0,1.2,0]);
    addMesh(group,new THREE.BoxGeometry(.73,.65,.4),MAT.purple,[0,1.27,-.03]);
  }
  group.userData={arms,legs,head,torso,face,faceMaterial,defaultFace:[eyeL,eyeR,shineL,shineR,mouth],skin,medallion};
  return group;
}

function textureFromPhoto(img){
  // The prepared 512×640 atlas already contains its landmark warp, skin
  // treatment and feathered alpha. Never crop or paste its source photo again.
  const texture=new THREE.Texture(img);texture.needsUpdate=true;
  texture.colorSpace=THREE.SRGBColorSpace;texture.anisotropy=4;
  texture.minFilter=THREE.LinearMipmapLinearFilter;texture.magFilter=THREE.LinearFilter;
  texture.wrapS=texture.wrapT=THREE.ClampToEdgeWrapping;
  return texture;
}

function useFaceTexture(profile) {
  const photo=isAlienFaceProfile(profile)?profile.photo:null;
  const [texture,setTexture]=useState(null);
  useEffect(()=>{
    setTexture(null);
    if(!photo)return;
    let disposed=false; let tex;
    const img=new Image();
    img.onload=()=>{
      if(disposed)return;
      tex=textureFromPhoto(img);setTexture(tex);
    };
    img.src=photo;
    return()=>{disposed=true;tex?.dispose();};
  },[photo]);
  return texture;
}

function Alien({position=[0,0,0],scale=1,seed=0,color=GREEN,hero=false,profile,mode,levelRef,clockStart,reducedMotion=false,judge=false,event}) {
  const texture=useFaceTexture(hero?profile:null);
  const model=useMemo(()=>makeAlien({seed,color,judge}),[seed,color,judge]);
  useEffect(()=>()=>disposeAlienModel(model),[model]);
  const base=useRef(position);
  const restPosition=useRef(new THREE.Vector3(...position));const restScale=useRef(scale);
  const destination=useMemo(()=>new THREE.Vector3(),[]);
  const eventStart=useRef(performance.now()/1000);
  useEffect(()=>{eventStart.current=performance.now()/1000;},[event]);
  useEffect(()=>{base.current=position;},[position]);
  useEffect(()=>{
    model.userData.faceMaterial.map=texture;model.userData.faceMaterial.needsUpdate=true;
    model.userData.face.visible=!!texture;model.userData.defaultFace.forEach(m=>m.visible=!texture);
  },[model,texture]);
  useFrame(({clock},delta)=>{
    const t=clock.elapsedTime, q=t*1.9+seed*2.15, parts=model.userData;
    const level=levelRef?.current||0; const dance=mode==='performance'||mode==='results';
    const amp=reducedMotion?.08:1;
    destination.set(...base.current);
    const travel=restPosition.current.distanceTo(destination);
    restPosition.current.lerp(destination,1-Math.exp(-delta*2.4));
    restScale.current=THREE.MathUtils.lerp(restScale.current,scale,1-Math.exp(-delta*2.4));
    model.position.copy(restPosition.current);
    model.scale.setScalar(restScale.current);
    model.rotation.y=hero?-.23:Math.sin(seed*1.8)*.8;
    if(!reducedMotion){
      model.position.y+=Math.abs(Math.sin(q*(dance?1.5:.65)))*.08;
      model.rotation.z=Math.sin(q)*.045*(dance?2.5:1);
      parts.head.rotation.z=Math.sin(q*.62)*.09;
      parts.head.rotation.y=Math.sin(q*.45)*.14;
      parts.arms[0].rotation.z=-.12-Math.sin(q)*.22-(dance?.5:0)-level*.8;
      parts.arms[1].rotation.z=.12+Math.sin(q+1)*.3+(dance?.4:0)+level*.8;
      parts.arms[0].rotation.x=Math.sin(q)*.25;
      parts.arms[1].rotation.x=Math.sin(q+Math.PI)*.25;
      parts.legs[0].rotation.x=Math.sin(q)*.15*(dance?2:1);
      parts.legs[1].rotation.x=-Math.sin(q)*.15*(dance?2:1);
      if(hero&&travel>.15){parts.legs[0].rotation.x=Math.sin(t*7)*.55;parts.legs[1].rotation.x=-Math.sin(t*7)*.55;}
      if(!hero&&!judge){
        model.position.x+=Math.sin(t*.17+seed)*.65;
        model.position.z+=Math.sin(t*.2+seed*3)*.35;
      }
      if(hero&&(mode==='club'||mode==='performance')){
        model.position.x+=Math.sin(t*.22)*.6;
        model.position.z+=Math.sin(t*.3)*.45;
        model.rotation.y+=Math.sin(t*.4)*.25;
        if(Math.sin(t*.13)>.8)model.position.z+=.7;
      }
      const eventTime=performance.now()/1000-eventStart.current;
      if(event?.kind==='parade'&&!hero&&!judge&&eventTime<7){
        model.position.x+=Math.sin(eventTime*1.7+seed)*1.35;
        model.position.z+=Math.cos(eventTime*1.7+seed)*.55;
        model.rotation.y=eventTime*1.7+seed;
        parts.legs[0].rotation.x=Math.sin(eventTime*10+seed)*.8;
        parts.legs[1].rotation.x=-Math.sin(eventTime*10+seed)*.8;
        parts.arms[0].rotation.x=-1;parts.arms[1].rotation.x=-1;
      }
      if(event?.kind==='visitor'&&hero&&eventTime<7){
        model.position.z+=Math.sin(eventTime/7*Math.PI)*1.7;
        parts.arms[1].rotation.z=2+Math.sin(eventTime*8)*.25;
      }
    }
    if(hero&&mode==='abduction'){
      const elapsed=t-clockStart.current;
      const lift=THREE.MathUtils.smoothstep(elapsed,3.1,6.2);
      model.position.y+=lift*7;
      model.rotation.y+=elapsed*lift*1.8;
      model.scale.setScalar(scale*(1-lift*.77));
      parts.arms[0].rotation.z=-lift*1.8;parts.arms[1].rotation.z=lift*1.8;
      if(elapsed>6.2)model.visible=false;else model.visible=true;
    }else model.visible=true;
    if(hero&&mode==='results'){
      model.position.y+=Math.max(0,Math.sin(t*4))*.25*amp;
      parts.arms[0].rotation.z=-2.1;parts.arms[1].rotation.z=2.1;
    }
  });
  return <primitive object={model} dispose={null}/>;
}

function Ring({r=1,t=.03,color='#cfabff',position=[0,0,0],rotation=[-Math.PI/2,0,0]}){
  return <mesh position={position} rotation={rotation}><torusGeometry args={[r,t,5,80]}/><meshBasicMaterial color={color}/></mesh>;
}

function UFO({mode,clockStart,reducedMotion=false}){
  const group=useRef();const beam=useRef();const ring=useRef();
  useFrame(({clock})=>{
    const t=clock.elapsedTime;
    group.current.position.set(1.8,7.65+Math.sin(t*.8)*.23,-2.5);
    group.current.rotation.set(.08,0,-.13+Math.sin(t*.3)*.05);
    ring.current.rotation.y=reducedMotion?0:t*.24;
    beam.current.visible=false;
    if(mode==='abduction'){
      const e=t-clockStart.current;
      const down=THREE.MathUtils.smoothstep(e,.8,2.7);
      const fly=THREE.MathUtils.smoothstep(e,6.5,8.5);
      group.current.position.set(2.8+fly*18,7.65-down*1.6+fly*5,1.6-fly*9);
      group.current.rotation.z=-.13+fly*.6;
      beam.current.visible=e>2.1&&e<6.5;
      beam.current.material.opacity=.16+Math.sin(t*16)*.035;
    }
    if(mode==='results'){
      group.current.position.set(-1,6.8+Math.sin(t)*.2,-2);
      beam.current.visible=true;beam.current.material.opacity=.07;
    }
  });
  return <group ref={group}>
    <group ref={ring}>
      <mesh scale={[1,.24,1]} material={MAT.silver}><sphereGeometry args={[2,24,10]}/></mesh>
      <mesh position={[0,-.14,0]} rotation={[Math.PI/2,0,0]}><torusGeometry args={[1.56,.15,6,28]}/><meshStandardMaterial color="#71699a" metalness={.8} roughness={.3}/></mesh>
      <Ring r={1.9} t={.045} color="#c5f78c" position={[0,-.05,0]}/>
      {Array.from({length:12},(_,i)=><mesh key={i} position={[Math.sin(i/12*TAU)*1.67,-.24,Math.cos(i/12*TAU)*1.67]} scale={[.16,.07,.16]}><sphereGeometry args={[1,8,5]}/><meshBasicMaterial color={i%3===0?'#ff8ddd':i%3===1?'#d5ff80':'#9aa5ff'}/></mesh>)}
    </group>
    <mesh position={[0,.3,0]} scale={[1.07,.75,1.07]}><sphereGeometry args={[1,20,10,0,TAU,0,Math.PI/2]}/><meshPhysicalMaterial color="#e8c5ef" metalness={.2} roughness={.08} transparent opacity={.65}/></mesh>
    <mesh position={[0,.58,0]} scale={[.23,.32,.23]} material={MAT.green}><sphereGeometry args={[1,10,8]}/></mesh>
    <mesh ref={beam} position={[0,-3.05,0]}><cylinderGeometry args={[.45,2.25,5.7,24,1,true]}/><meshBasicMaterial color="#cbffaa" transparent opacity={.14} side={THREE.DoubleSide} depthWrite={false} blending={THREE.AdditiveBlending}/></mesh>
    <pointLight color="#c4ff9c" intensity={8} distance={8} position={[0,-.4,0]}/>
  </group>;
}

function DanceFloor(){
  const dark=useRef(),light=useRef();
  useEffect(()=>{
    const dummy=new THREE.Object3D();let a=0,b=0;
    for(let x=-7;x<=7;x++)for(let z=-6;z<=6;z++){
      dummy.position.set(x*.83,-.18,z*.83);dummy.updateMatrix();
      ((x+z)%2===0?light.current:dark.current).setMatrixAt((x+z)%2===0?a++:b++,dummy.matrix);
    }
    light.current.instanceMatrix.needsUpdate=true;dark.current.instanceMatrix.needsUpdate=true;
  },[]);
  return <group position={[0,0,.3]}>
    <mesh position={[0,-.34,0]}><boxGeometry args={[13.1,.25,11.6]}/><meshStandardMaterial color="#14152c" metalness={.6} roughness={.4}/></mesh>
    <instancedMesh ref={dark} args={[null,null,98]}><boxGeometry args={[.8,.06,.8]}/><meshStandardMaterial color="#1b2439" roughness={.42} metalness={.6}/></instancedMesh>
    <instancedMesh ref={light} args={[null,null,97]}><boxGeometry args={[.8,.06,.8]}/><meshStandardMaterial color="#504c75" roughness={.55} metalness={.4}/></instancedMesh>
    <Ring r={5.85} t={.035} color="#bcabf1" position={[0,-.12,0]}/>
    {[-1,1].map(s=><mesh key={s} position={[s*6.12,-.1,0]}><boxGeometry args={[.045,.03,11]}/><meshBasicMaterial color="#bd92fb"/></mesh>)}
  </group>;
}

function TextSign({text,width=6,height=1,color='#e6fbb2',background='#212237',...props}){
  const tex=useMemo(()=>{
    const c=document.createElement('canvas');c.width=1024;c.height=192;
    const ctx=c.getContext('2d');ctx.fillStyle=background;ctx.fillRect(0,0,1024,192);
    ctx.strokeStyle=color;ctx.lineWidth=6;ctx.strokeRect(9,9,1006,174);
    ctx.font='bold 75px monospace';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillStyle=color;ctx.fillText(text,512,100);
    const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;return t;
  },[text,color,background]);
  useEffect(()=>()=>tex.dispose(),[tex]);
  return <mesh {...props}><planeGeometry args={[width,height]}/><meshBasicMaterial map={tex}/></mesh>;
}

function Speaker({position,rotation=0}){
  return <group position={position} rotation={[0,rotation,0]}>
    <mesh material={MAT.dark}><boxGeometry args={[.88,1.7,.7]}/></mesh>
    <mesh position={[0,0,.365]}><planeGeometry args={[.73,1.52]}/><meshStandardMaterial color="#3f3c56" roughness={.9}/></mesh>
    {[-.37,.32].map((y,i)=><group key={i} position={[0,y,.39]}>
      <mesh rotation={[Math.PI/2,0,0]}><cylinderGeometry args={[i?.22:.28,i?.22:.28,.04,16]}/><meshStandardMaterial color="#111728" roughness={.4}/></mesh>
      <mesh position={[0,0,.035]}><sphereGeometry args={[i?.08:.1,10,6]}/><meshStandardMaterial color="#817ca0" metalness={.7} roughness={.35}/></mesh>
      <Ring r={i?.25:.31} t={.014} color="#9c82c8" rotation={[0,0,0]}/>
    </group>)}
    <mesh position={[.26,.66,.4]}><boxGeometry args={[.07,.025,.02]}/><meshBasicMaterial color="#dcff95"/></mesh>
  </group>;
}

function Stage({mode}){
  const ballRef=useRef();
  const disco=useMemo(()=>{
    const g=new THREE.Group();
    addMesh(g,new THREE.IcosahedronGeometry(.65,2),new THREE.MeshStandardMaterial({color:'#a9acc6',metalness:.98,roughness:.15,flatShading:true}));
    const dummy=new THREE.Object3D();
    for(let j=1;j<8;j++)for(let i=0;i<12;i++){
      const phi=j/8*Math.PI,theta=i/12*TAU;
      const tile=addMesh(g,new THREE.PlaneGeometry(.13,.13),new THREE.MeshBasicMaterial({color:(i+j)%3===0?'#edc8f5':(i+j)%3===1?'#d8f6b2':'#b6bbef'}),[Math.sin(phi)*Math.cos(theta)*.66,Math.cos(phi)*.66,Math.sin(phi)*Math.sin(theta)*.66]);
      tile.lookAt(tile.position.clone().multiplyScalar(2));
    }return g;
  },[]);
  useFrame(({clock})=>{if(ballRef.current)ballRef.current.rotation.y=clock.elapsedTime*.25;});
  return <group position={[0,0,-2.8]}>
    <mesh position={[0,.08,0]}><cylinderGeometry args={[3.5,3.68,.38,48]}/><meshStandardMaterial color="#24213d" roughness={.3} metalness={.6}/></mesh>
    <mesh position={[0,.29,0]}><cylinderGeometry args={[3.25,3.5,.12,48]}/><meshStandardMaterial color="#62547b" roughness={.45} metalness={.4}/></mesh>
    <Ring r={3.5} t={.045} color="#d0a1f7" position={[0,.23,0]}/>
    <Ring r={3.1} t={.025} color="#dbffab" position={[0,.36,0]}/>
    <mesh position={[0,.38,0]} rotation={[-Math.PI/2,0,0]}><circleGeometry args={[1.1,6]}/><meshStandardMaterial color="#292b47"/></mesh>
    <Ring r={1.2} t={.025} color="#ed99d1" position={[0,.39,0]}/>
    <group position={[-.9,.37,.2]}>
      <mesh position={[0,.025,0]} material={MAT.silver}><cylinderGeometry args={[.25,.32,.06,12]}/></mesh>
      <mesh position={[0,.85,0]} material={MAT.silver}><cylinderGeometry args={[.025,.035,1.7,7]}/></mesh>
      <mesh position={[.08,1.71,0]} rotation={[0,0,-.8]} material={MAT.dark}><capsuleGeometry args={[.075,.25,4,10]}/></mesh>
      <mesh position={[.18,1.8,0]} material={MAT.silver}><sphereGeometry args={[.095,10,8]}/></mesh>
    </group>
    <Speaker position={[-3.35,1,-.55]} rotation={.2}/><Speaker position={[3.35,1,-.55]} rotation={-.2}/>
    {[-1,1].map(side=><group key={side} position={[side*3.5,0,-2]}>
      <mesh position={[0,2,0]} material={MAT.dark}><cylinderGeometry args={[.09,.13,4,7]}/></mesh>
      {[1.4,2.6,3.8].map(y=><Ring key={y} r={.14} t={.035} color={side<0?'#a69bea':'#e19ec7'} position={[0,y,0]}/>)}
      <mesh position={[0,4,0]} rotation={[.4,0,side*.6]}><boxGeometry args={[.4,.3,.6]}/><meshStandardMaterial color="#87809d" metalness={.7} roughness={.3}/></mesh>
    </group>)}
    <TextSign text={mode==='results'?'COSMIC TALENT COUNCIL':'THE MOTHERSHIP'} position={[0,4.5,-2.8]} width={5.2} height={.76}/>
    <mesh position={[0,5.52,-1]} material={MAT.silver}><cylinderGeometry args={[.016,.016,1.6,5]}/></mesh>
    <primitive ref={ballRef} object={disco} position={[0,4.78,-1]} dispose={null}/>
  </group>;
}

function Beam({position,color,rotation}){
  const ref=useRef();
  useFrame(({clock})=>{if(ref.current)ref.current.rotation.z=rotation+Math.sin(clock.elapsedTime*.45+position[0])*.12;});
  return <group position={position} ref={ref} rotation={[0,0,rotation]}>
    <mesh position={[0,-2.3,0]}><coneGeometry args={[1,4.6,20,1,true]}/><meshBasicMaterial color={color} transparent opacity={.055} side={THREE.DoubleSide} depthWrite={false} blending={THREE.AdditiveBlending}/></mesh>
  </group>;
}

function Stars(){
  const positions=useMemo(()=>{
    const list=[];let s=873;const rand=()=>{s=(s*16807)%2147483647;return(s-1)/2147483646;};
    for(let i=0;i<600;i++){const x=(rand()-.5)*80,y=rand()*34+2,z=-rand()*55-9;list.push(x,y,z);}return new Float32Array(list);
  },[]);
  return <points><bufferGeometry><bufferAttribute attach="attributes-position" args={[positions,3]}/></bufferGeometry><pointsMaterial size={.065} color="#e3dff1" sizeAttenuation transparent opacity={.75}/></points>;
}

function Planets(){
  const orbit=useRef();
  useFrame(({clock})=>{if(orbit.current)orbit.current.rotation.y=clock.elapsedTime*.04;});
  return <group>
    <group position={[-10,7,-13]} rotation={[.3,0,-.35]}>
      <mesh><sphereGeometry args={[2.05,16,12]}/><meshStandardMaterial color="#9361ac" roughness={1} flatShading/></mesh>
      <mesh rotation={[Math.PI/2,0,0]}><ringGeometry args={[2.6,3.8,48]}/><meshStandardMaterial color="#c7a4b4" side={THREE.DoubleSide} roughness={.8} transparent opacity={.9}/></mesh>
      <Ring r={3.02} t={.07} color="#e7bfad"/>
    </group>
    <mesh position={[10,6,-16]}><icosahedronGeometry args={[1.15,1]}/><meshStandardMaterial color="#ce9cb5" flatShading roughness={1}/></mesh>
    <group ref={orbit} position={[4,6,-15]}><mesh position={[4,1,0]}><icosahedronGeometry args={[.35,0]}/><meshStandardMaterial color="#a0a7c9" flatShading/></mesh></group>
  </group>;
}

function Creature({position}){
  const ref=useRef();
  useFrame(({clock})=>{ref.current.position.y=.15+Math.abs(Math.sin(clock.elapsedTime*1.3))*.2;ref.current.rotation.y=clock.elapsedTime*.3;});
  return <group position={position}><group ref={ref}>
    <mesh scale={[.5,.3,.4]}><icosahedronGeometry args={[1,1]}/><meshStandardMaterial color="#d4a9e6" flatShading/></mesh>
    {[-1,1].map(s=><group key={s} position={[s*.2,.26,.18]}><mesh scale={[.08,.22,.08]}><sphereGeometry args={[1,8,6]}/><meshStandardMaterial color="#c3a1dc"/></mesh><mesh position={[0,.22,.04]} scale={[.12,.12,.12]}><sphereGeometry args={[1,10,8]}/><meshStandardMaterial color="#faf3d3"/></mesh><mesh position={[0,.22,.14]} scale={[.06,.07,.04]} material={MAT.eye}><sphereGeometry args={[1,8,6]}/></mesh></group>)}
    {[-1,1].map(s=><mesh key={s} position={[s*.43,-.12,0]} scale={[.2,.06,.17]}><sphereGeometry args={[1,8,6]}/><meshStandardMaterial color="#b88bda"/></mesh>)}
  </group></group>;
}

function Trophy(){
  const ref=useRef();
  useFrame(({clock})=>{ref.current.position.y=2.3+Math.sin(clock.elapsedTime*2)*.15;ref.current.rotation.y=clock.elapsedTime*.55;});
  return <group ref={ref} position={[-.4,2.3,1.5]}>
    <mesh><cylinderGeometry args={[.1,.18,.8,8]}/><meshStandardMaterial color="#f2d888" metalness={.8} roughness={.3}/></mesh>
    <mesh position={[0,.6,0]}><cylinderGeometry args={[.56,.18,.55,10,1,true]}/><meshStandardMaterial color="#f2d888" metalness={.8} roughness={.3} side={THREE.DoubleSide}/></mesh>
    {[-1,1].map(s=><mesh key={s} position={[s*.5,.6,0]} rotation={[0,0,s*Math.PI/2]}><torusGeometry args={[.24,.065,5,12,Math.PI]}/><meshStandardMaterial color="#ffe4a0" metalness={.8} roughness={.3}/></mesh>)}
    <mesh position={[0,-.47,0]}><boxGeometry args={[.7,.18,.6]}/><meshStandardMaterial color="#745181" roughness={.6}/></mesh>
    <mesh position={[0,.97,0]} rotation={[0,0,Math.PI/4]}><boxGeometry args={[.28,.28,.09]}/><meshBasicMaterial color="#fff3ab"/></mesh>
    <pointLight color="#ffe7aa" intensity={4} distance={4}/>
  </group>;
}

function Confetti(){
  const ref=useRef();
  const particles=useMemo(()=>Array.from({length:100},(_,i)=>({x:Math.sin(i*12.5)*8,z:Math.cos(i*7.8)*6,s:(i*.779)%1,c:['#ddff9d','#e3b3ff','#ffbecc','#9bdde2'][i%4]})),[]);
  useFrame(({clock})=>{
    const t=clock.elapsedTime;
    ref.current.children.forEach((m,i)=>{const p=particles[i];m.position.set(p.x+Math.sin(t+p.s*TAU)*.5,8-((t*(.65+p.s)+p.s*9)%8),p.z);m.rotation.set(t+p.s,t*.8,t);});
  });
  return <group ref={ref}>{particles.map((p,i)=><mesh key={i}><planeGeometry args={[.08,.16]}/><meshBasicMaterial color={p.c} side={THREE.DoubleSide}/></mesh>)}</group>;
}

function Firework({position,color,delay=0}){
  const ref=useRef();
  const directions=useMemo(()=>Array.from({length:70},(_,i)=>{
    const a=i*2.399963, y=1-i/35, r=Math.sqrt(Math.max(0,1-y*y));
    return new THREE.Vector3(Math.cos(a)*r,y,Math.sin(a)*r);
  }),[]);
  const positions=useMemo(()=>new Float32Array(70*3),[]);
  useFrame(({clock})=>{
    const phase=(clock.elapsedTime+delay)%4.2, progress=Math.min(1,phase/2);
    directions.forEach((d,i)=>{positions[i*3]=d.x*progress*2.1;positions[i*3+1]=d.y*progress*2.1-progress*progress*.6;positions[i*3+2]=d.z*progress*2.1;});
    ref.current.geometry.attributes.position.needsUpdate=true;
    ref.current.material.opacity=phase<2?1-progress:0;
  });
  return <points ref={ref} position={position}><bufferGeometry><bufferAttribute attach="attributes-position" args={[positions,3]}/></bufferGeometry><pointsMaterial color={color} size={.075} sizeAttenuation transparent depthWrite={false} blending={THREE.AdditiveBlending}/></points>;
}

function EventProps({event}){
  const ref=useRef();const start=useRef(0);
  useEffect(()=>{start.current=performance.now()/1000;},[event]);
  useFrame(()=>{
    if(!ref.current)return;
    const t=performance.now()/1000-start.current;
    ref.current.visible=!!event&&t<7&&['ufo','notes'].includes(event.kind);
    ref.current.position.x=event?.kind==='ufo'?-9+t*3:Math.sin(t*.7)*5;
    ref.current.rotation.y=t;
    ref.current.position.y=event?.kind==='ufo'?5+Math.sin(t*1.5)*.3:3.8+Math.sin(t*2)*.3;
  });
  return <group ref={ref} position={[0,4,0]}>
    {event?.kind==='ufo'?<group scale={.5} rotation={[.1,0,.2]}>
      <mesh scale={[1,.2,1]} material={MAT.silver}><sphereGeometry args={[1.5,16,8]}/></mesh>
      <mesh position={[0,.23,0]} scale={[.7,.5,.7]}><sphereGeometry args={[1,12,8]}/><meshStandardMaterial color="#c8a9ef" metalness={.5} roughness={.2}/></mesh>
      <Ring r={1.4} t={.055} color="#e3ffb8"/>
      <pointLight color="#d7ffae" intensity={4} distance={5}/>
    </group>:Array.from({length:5},(_,i)=><group key={i} position={[(i-2)*.4,Math.sin(i)*.3,0]} rotation={[0,0,i*.2]}>
      <mesh material={i%2?MAT.pink:MAT.mint}><sphereGeometry args={[.12,8,6]}/></mesh>
      <mesh position={[.1,.3,0]} material={i%2?MAT.pink:MAT.mint}><boxGeometry args={[.035,.6,.035]}/></mesh>
      <mesh position={[.18,.57,0]} rotation={[0,0,-.4]} material={i%2?MAT.pink:MAT.mint}><boxGeometry args={[.22,.06,.04]}/></mesh>
    </group>)}
  </group>;
}

function CameraRig({mode,reducedMotion,clockStart}){
  const {camera,size}=useThree();const target=useMemo(()=>new THREE.Vector3(),[]);const look=useMemo(()=>new THREE.Vector3(),[]);const smoothLook=useMemo(()=>new THREE.Vector3(.4,2.5,-.7),[]);
  useFrame(({clock},delta)=>{
    const menu=mode==='menu'||mode==='register';
    if(menu){target.set(10.2,6.7,14.7);look.set(.4,2.5,-.7);}
    else if(mode==='abduction'){
      const e=clock.elapsedTime-clockStart.current;
      const n=THREE.MathUtils.smoothstep(e,0,3);
      target.set(8-n*2,5.1+n*1.4,12.7-n*1.1);look.set(2.2,2.8+THREE.MathUtils.smoothstep(e,3,7)*3.4,.6);
    }else if(mode==='results'){target.set(7.6,5.6,12);look.set(.4,2,-.7);}
    else{target.set(9.3,6.1,14.6);look.set(.4,2.4,-1.1);}
    // A narrow device gets a centered character portrait rather than a cropped desktop composition.
    if(size.width/size.height<1.05&&mode!=='abduction'){
      target.set(7.8,5.1,14.8);look.set(2.4,2.65,.6);
    }
    const speed=1-Math.exp(-delta*1.8);
    camera.position.lerp(target,speed);smoothLook.lerp(look,speed);camera.lookAt(smoothLook);
    if(!reducedMotion&&mode!=='abduction')camera.position.x+=Math.sin(clock.elapsedTime*.15)*.001;
  });return null;
}

function Scene({mode,profile,levelRef,event,onTransitionComplete,reducedMotion}){
  const {clock,size}=useThree();const clockStart=useRef(clock.elapsedTime);
  const narrow=size.width/size.height<1.05;
  const heroPosition=narrow?[2.8,.05,2]:mode==='menu'||mode==='register'?[6,.05,2]:mode==='performance'?[8,.05,2]:mode==='results'?[6,.05,2]:mode==='abduction'?[2.8,.05,2]:[4.5,.05,2];
  const heroScale=narrow?1.3:mode==='menu'||mode==='register'?1.55:mode==='results'?1.5:1.3;
  useEffect(()=>{clockStart.current=clock.elapsedTime;},[mode,clock]);
  const lights=useRef();
  useFrame(({clock})=>{
    const level=levelRef?.current||0;
    lights.current.intensity=10+level*20+(mode==='performance'?Math.sin(clock.elapsedTime*4)*2:0);
    lights.current.color.set(event?.kind==='disco'?['#d5ffa2','#e2a3ff','#ffb5d6'][Math.floor(clock.elapsedTime*1.5)%3]:'#d5ffa2');
  });
  return <>
    <color attach="background" args={['#161c30']}/><fog attach="fog" args={['#161c30',22,61]}/>
    <ambientLight intensity={1.25} color="#c6c8ee"/>
    <hemisphereLight args={['#e2d7fa','#464368',2]}/>
    <directionalLight position={[3,9,8]} intensity={3.1} color="#f4f0c9"/>
    <directionalLight position={[-8,4,-3]} intensity={2.4} color="#b1a2ff"/>
    <pointLight ref={lights} position={[3,2,3]} intensity={10} color="#d5ffa2" distance={13}/>
    <pointLight position={[-4,3,-1]} intensity={20} color="#e99acb" distance={14}/>
    <Stars/><Planets/>
    <mesh position={[0,-.67,-3]}><cylinderGeometry args={[19,23,.8,32]}/><meshStandardMaterial color="#2b2a43" roughness={1} flatShading/></mesh>
    <DanceFloor/><Stage mode={mode}/><UFO mode={mode} clockStart={clockStart} reducedMotion={reducedMotion}/>
    <group position={[7.4,-.12,2.2]}>
      <mesh><cylinderGeometry args={[1.8,2,.22,32]}/><meshStandardMaterial color="#25213e" roughness={.45} metalness={.5}/></mesh>
      <Ring r={1.8} t={.035} color="#c9b0ee" position={[0,.12,0]}/>
    </group>
    <Beam position={[-4,6,-4]} color="#c49afa" rotation={-.5}/><Beam position={[4,6,-3]} color="#d6ff9e" rotation={.6}/>
    <Beam position={[-2,8,0]} color="#ef9fcf" rotation={-.3}/>
    <Alien hero profile={profile} position={heroPosition} scale={heroScale} mode={mode} clockStart={clockStart} levelRef={levelRef} reducedMotion={reducedMotion} event={event}/>
    {[
      [-3.2,0,2.3,.72,'#be99e7'],[-4.8,0,-.2,.72,'#bed97c'],[4.7,0,-1,.7,'#a8ccd9'],
      [-1.9,0,4.3,.58,'#c8e189'],[1,.37,-3.5,.66,'#a5dd9c'],[-2,.37,-4,.7,'#d3b4e5'],
      [5.3,0,3.1,.6,'#a4d8a0'],[-5.6,0,3.9,.59,'#e6a2b4'],[4.5,0,-5.4,.62,'#c4dd93'],
    ].map(([x,y,z,s,c],i)=><Alien key={i} position={[x,y,z]} scale={s} seed={i+1} color={c} mode={mode} clockStart={clockStart} levelRef={levelRef} reducedMotion={reducedMotion} event={event}/>)}
    <Creature position={[-1,0,2.7]}/><Creature position={[5,0,-4]}/>
    <EventProps event={event}/>
    {mode==='results'&&<><Alien judge position={[-.6,.37,-1.5]} scale={.9} mode={mode} clockStart={clockStart}/><Trophy/><Confetti/><Firework position={[-5,6,-8]} color="#d8ffb0"/><Firework position={[6,7,-8]} color="#e7a6e3" delay={1.4}/><Firework position={[0,9,-10]} color="#b1baff" delay={2.8}/></>}
    <CameraRig mode={mode} reducedMotion={reducedMotion} clockStart={clockStart}/>
  </>;
}

class WorldBoundary extends Component {
  state={failed:false};
  static getDerivedStateFromError(){return{failed:true};}
  render(){return this.state.failed?<div className="world-fallback" role="status" style={{position:'absolute',inset:0,background:'radial-gradient(ellipse at 65% 50%,#5c457b,#18213a 68%)'}}><span style={{position:'absolute',right:'10%',top:'45%',color:'#d8f6b2'}}>3D graphics unavailable on this device. The booth controls are ready.</span></div>:this.props.children;}
}

export default function World({mode='menu',profile=null,levelRef,event=null,onTransitionComplete,reducedMotion=false}){
  const complete=useRef(onTransitionComplete);complete.current=onTransitionComplete;
  useEffect(()=>{if(mode!=='abduction')return;const id=setTimeout(()=>complete.current?.(),9300);return()=>clearTimeout(id);},[mode]);
  return <WorldBoundary><Canvas className="world-canvas" camera={{position:[10.2,6.7,14.7],fov:47,near:.1,far:100}} dpr={[1,1.5]} gl={{antialias:true,alpha:false,powerPreference:'high-performance'}} style={{position:'absolute',inset:0,width:'100%',height:'100%'}} onCreated={({gl})=>{gl.outputColorSpace=THREE.SRGBColorSpace;gl.toneMapping=THREE.ACESFilmicToneMapping;gl.toneMappingExposure=1.12;}}>
    <Scene mode={mode} profile={profile} levelRef={levelRef} event={event} reducedMotion={reducedMotion}/>
  </Canvas></WorldBoundary>;
}

function PreviewScene({profile}) {
  const {camera}=useThree();
  const clockStart=useRef(0);
  useEffect(()=>{camera.lookAt(0,1.92,0);},[camera]);
  return <>
    <color attach="background" args={['#181b26']}/>
    <ambientLight intensity={1.25} color="#c6c8ee"/>
    <hemisphereLight args={['#e2d7fa','#464368',2]}/>
    <directionalLight position={[3,9,8]} intensity={3.1} color="#f4f0c9"/>
    <directionalLight position={[-8,4,-3]} intensity={2.4} color="#b1a2ff"/>
    <mesh position={[0,-.04,0]}><cylinderGeometry args={[.95,1.05,.08,24]}/><meshStandardMaterial color="#302a42" roughness={.7}/></mesh>
    <Ring position={[0,.005,0]} r={.95} t={.014} color="#c7ff54"/>
    <Alien hero profile={profile} position={[0,.04,0]} scale={1} seed={0} mode="preview" clockStart={clockStart}/>
  </>;
}

/** Registration preview: the exact textured mesh used in the game and portraits. */
export function AvatarPreview({profile}) {
  return <div className="avatar-filter-preview" role="img" aria-label={`${profile?.nickname||'Your'} transformed 3D alien preview`} style={{width:'100%',height:300,position:'relative',overflow:'hidden',borderRadius:8}}>
    <WorldBoundary><Canvas camera={{position:[0,2.25,5.5],fov:36,near:.1,far:30}} dpr={[1,1.5]} gl={{antialias:true,alpha:false,powerPreference:'low-power'}} onCreated={({gl})=>{gl.outputColorSpace=THREE.SRGBColorSpace;gl.toneMapping=THREE.ACESFilmicToneMapping;gl.toneMappingExposure=1.12;}}>
      <PreviewScene profile={profile}/>
    </Canvas></WorldBoundary>
  </div>;
}

const portraitCache=new Map();
const PORTRAIT_CACHE_LIMIT=24;
export function AlienPortrait({profile,size=64,seed=0}){
  const [url,setUrl]=useState('');
  useEffect(()=>{
    const photo=isAlienFaceProfile(profile)?profile.photo:null;
    let cancelled=false;const key=`${faceTextureFingerprint(photo||'')}:${profile?.faceVersion||'default'}:${seed}`;
    setUrl('');
    if(portraitCache.has(key)){setUrl(portraitCache.get(key));return;}
    const render=(texture=null)=>{
      if(cancelled){texture?.dispose();return;}
      let renderer,alien;
      try{
        renderer=new THREE.WebGLRenderer({alpha:true,antialias:true,preserveDrawingBuffer:true});renderer.setSize(128,128);renderer.setPixelRatio(1);renderer.outputColorSpace=THREE.SRGBColorSpace;
        renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.12;
        const scene=new THREE.Scene();const camera=new THREE.PerspectiveCamera(35,1,.1,20);camera.position.set(.4,2.5,5.2);camera.lookAt(0,2,0);
        alien=makeAlien({seed,photoTexture:texture});alien.rotation.y=-.12;scene.add(alien);
        scene.add(new THREE.AmbientLight('#c6c8ee',1.25));scene.add(new THREE.HemisphereLight('#e2d7fa','#464368',2));const light=new THREE.DirectionalLight('#f4f0c9',3.1);light.position.set(3,9,8);scene.add(light);
        renderer.render(scene,camera);const result=renderer.domElement.toDataURL('image/png');portraitCache.set(key,result);if(!cancelled)setUrl(result);
        if(portraitCache.size>PORTRAIT_CACHE_LIMIT)portraitCache.delete(portraitCache.keys().next().value);
      }catch{if(!cancelled)setUrl('');}
      finally{renderer?.dispose();renderer?.forceContextLoss();if(alien)disposeAlienModel(alien);texture?.dispose();}
    };
    if(photo){const img=new Image();img.onload=()=>render(textureFromPhoto(img));img.onerror=()=>render();img.src=photo;}else render();
    return()=>{cancelled=true;};
  },[profile?.photo,profile?.faceVersion,seed]);
  return url?<img className="alien-portrait" src={url} alt={`${profile?.nickname||'Galactic singer'}'s 3D alien`} width={size} height={size}/>:<svg className="alien-portrait" width={size} height={size} viewBox="0 0 64 64" role="img" aria-label="Alien portrait"><path fill="#b8e87b" d="M22 58l3-22h14l3 22-10-4z"/><ellipse fill="#b8e87b" cx="32" cy="24" rx="19" ry="22"/><ellipse fill="#172034" cx="24" cy="24" rx="5" ry="8" transform="rotate(-25 24 24)"/><ellipse fill="#172034" cx="40" cy="24" rx="5" ry="8" transform="rotate(25 40 24)"/></svg>;
}
