/**
 * Landmark-guided, non-generative face filter. Pure pixel/geometry code shared
 * by the browser worker and offline tests. No DOM, network or learned synthesis.
 */
export const FACE_VERSION = 'landmark-alien-v2';
export const ATLAS_WIDTH = 512;
export const ATLAS_HEIGHT = 640;
export const SKIN_RGB = Object.freeze([179, 236, 99]);
export const OVAL = Object.freeze([10,338,297,332,284,251,389,356,454,323,361,288,397,365,379,378,400,377,152,148,176,149,150,136,172,58,132,93,234,127,162,21,54,103,67,109]);
const LEFT_EYE=[33,7,163,144,145,153,154,155,133,173,157,158,159,160,161,246];
const RIGHT_EYE=[362,382,381,380,374,373,390,249,263,466,388,387,386,385,384,398];
const LIPS=[61,185,40,39,37,0,267,269,270,409,291,375,321,405,314,17,84,181,91,146];
export const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const smooth=(a,b,x)=>{const t=clamp((x-a)/(b-a),0,1);return t*t*(3-2*t);};
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const average=points=>({x:points.reduce((v,p)=>v+p.x,0)/points.length,y:points.reduce((v,p)=>v+p.y,0)/points.length});

export class FaceFilterError extends Error {
  constructor(code,message){super(message);this.name='FaceFilterError';this.code=code;}
}

export function selectFace(result){
  const faces=result?.faceLandmarks||[];
  if(!faces.length)throw new FaceFilterError('NO_FACE','No clear face found. Face the camera, add a little light, or choose a closer photograph.');
  if(faces.length!==1)throw new FaceFilterError('MULTIPLE_FACES','More than one face found. Crop or choose a photograph with just your face.');
  return faces[0];
}

/** Signed Euclidean polygon distance, positive inside. Used for feathered masks. */
export function polygonDistance(x,y,polygon){
  let inside=false,min=Infinity;
  for(let i=0,j=polygon.length-1;i<polygon.length;j=i++){
    const a=polygon[j],b=polygon[i],dx=b.x-a.x,dy=b.y-a.y;
    const t=clamp(((x-a.x)*dx+(y-a.y)*dy)/(dx*dx+dy*dy||1),0,1);
    const qx=x-a.x-t*dx,qy=y-a.y-t*dy;min=Math.min(min,qx*qx+qy*qy);
    if((a.y>y)!==(b.y>y)&&x<(b.x-a.x)*(y-a.y)/(b.y-a.y)+a.x)inside=!inside;
  }
  return Math.sqrt(min)*(inside?1:-1);
}

/**
 * Build a roll-corrected facial coordinate system and a smooth invertible warp.
 * Eye, nose, forehead and jaw effects are fitted to the detected person's own
 * landmarks. Their mouth, smile, asymmetry and feature placement are retained.
 */
export function createAlienWarp(landmarks,sourceWidth,sourceHeight,{width=ATLAS_WIDTH,height=ATLAS_HEIGHT,strength=1}={}){
  if(!Number.isFinite(sourceWidth)||!Number.isFinite(sourceHeight)||sourceWidth<32||sourceHeight<32)throw new FaceFilterError('BAD_IMAGE','Choose a larger, clear photograph.');
  if(!Array.isArray(landmarks)||landmarks.length<468||landmarks.some(p=>!Number.isFinite(p.x)||!Number.isFinite(p.y)))throw new FaceFilterError('BAD_LANDMARKS','The face scan was incomplete. Try a clear, front-facing photograph.');
  const points=landmarks.map(p=>({x:p.x*sourceWidth,y:p.y*sourceHeight}));
  let eyeA=average(LEFT_EYE.map(i=>points[i])),eyeB=average(RIGHT_EYE.map(i=>points[i]));
  if(eyeA.x>eyeB.x)[eyeA,eyeB]=[eyeB,eyeA];
  const eyeDistance=distance(eyeA,eyeB);
  if(eyeDistance<sourceWidth*.065)throw new FaceFilterError('FACE_TOO_SMALL','Your face is too far away. Move closer or zoom the crop before scanning.');
  const ax={x:(eyeB.x-eyeA.x)/eyeDistance,y:(eyeB.y-eyeA.y)/eyeDistance},ay={x:-ax.y,y:ax.x};
  const project=p=>({x:p.x*ax.x+p.y*ax.y,y:p.x*ay.x+p.y*ay.y});
  const local=points.map(project),oval=OVAL.map(i=>local[i]);
  const bounds={left:Math.min(...oval.map(p=>p.x)),right:Math.max(...oval.map(p=>p.x)),top:Math.min(...oval.map(p=>p.y)),bottom:Math.max(...oval.map(p=>p.y))};
  const faceWidth=bounds.right-bounds.left,faceHeight=bounds.bottom-bounds.top;
  if(faceWidth<32||faceHeight<48)throw new FaceFilterError('FACE_TOO_SMALL','The face needs more detail. Use a closer photograph.');
  if(Math.abs((local[1].x-(project(eyeA).x+project(eyeB).x)/2)/eyeDistance)>.60)throw new FaceFilterError('FACE_TURNED','Turn toward the camera so both eyes and the outline of your face are visible.');
  if(bounds.left< -sourceWidth*.05||OVAL.some(i=>points[i].x<1||points[i].y<1||points[i].x>sourceWidth-1||points[i].y>sourceHeight-1))throw new FaceFilterError('FACE_CROPPED','Part of your face is outside the crop. Zoom out a little and include your forehead and chin.');
  const scale=Math.min(width*.81/faceWidth,height*.85/faceHeight);
  const center={x:(bounds.left+bounds.right)/2,y:(bounds.top+bounds.bottom)/2};
  const toAtlas=p=>({x:(p.x-center.x)*scale+width*.5,y:(p.y-center.y)*scale+height*.5});
  const base=local.map(toAtlas),cx=width*.5,top=toAtlas({x:center.x,y:bounds.top}).y,faceH=faceHeight*scale;
  const foreheadY=top+faceH*.29;
  const globalWarp=p=>{
    const t=(p.y-top)/faceH;
    const wide=1+strength*(.095*(1-smooth(.16,.53,t))-.065*smooth(.61,1.02,t));
    return {x:cx+(p.x-cx)*wide,y:p.y-strength*faceH*.018*(1-smooth(0,.38,t))};
  };
  const eyes=[average(LEFT_EYE.map(i=>globalWarp(base[i]))),average(RIGHT_EYE.map(i=>globalWarp(base[i])))];
  const eyeRadius=distance(base[33],base[133])*.84;
  const nose=globalWarp(base[4]);
  const noseRx=distance(base[98],base[327])*.83,noseRy=faceH*.105;
  const forward=p=>{
    const q=globalWarp(p);let dx=0,dy=0;
    for(const eye of eyes){
      const ex=q.x-eye.x,ey=q.y-eye.y,r2=(ex/(eyeRadius*1.5))**2+(ey/(eyeRadius*1.12))**2;
      const w=Math.exp(-r2*r2*.7)*.19*strength;
      dx+=ex*w;dy+=ey*w;
    }
    const nx=q.x-nose.x,ny=q.y-nose.y,nr=(nx/Math.max(12,noseRx))**2+(ny/Math.max(15,noseRy))**2;
    const nw=Math.exp(-nr*nr*.6)*.14*strength;
    dx-=nx*nw;dy-=ny*nw;
    return {x:q.x+dx,y:q.y+dy};
  };
  const inverse=(x,y)=>{
    let px=x,py=y;
    for(let i=0;i<6;i++){const q=forward({x:px,y:py});px+=x-q.x;py+=y-q.y;}
    const lx=(px-width*.5)/scale+center.x,ly=(py-height*.5)/scale+center.y;
    return {x:lx*ax.x+ly*ay.x,y:lx*ax.y+ly*ay.y};
  };
  return {width,height,points:base.map(forward),sourcePoints:points,forward,inverse,scale,eyeDistance,faceWidth,faceHeight,roll:Math.atan2(ax.y,ax.x),foreheadY};
}

function sample(data,w,h,x,y,out){
  x=clamp(x,0,w-1.001);y=clamp(y,0,h-1.001);
  const ix=Math.floor(x),iy=Math.floor(y),tx=x-ix,ty=y-iy,a=(iy*w+ix)*4,b=a+4,c=a+w*4,d=c+4;
  for(let k=0;k<3;k++)out[k]=(data[a+k]*(1-tx)+data[b+k]*tx)*(1-ty)+(data[c+k]*(1-tx)+data[d+k]*tx)*ty;
  return out;
}

/** Robust cheek/forehead median avoids skin-tone or lighting dependent flat tint. */
export function skinLuminance(image,landmarks){
  const values=[],px=[0,0,0],w=image.width,h=image.height;
  for(const i of [50,101,118,123,280,330,347,352,9,151]){
    const p=landmarks[i];
    for(let oy=-2;oy<=2;oy++)for(let ox=-2;ox<=2;ox++){
      sample(image.data,w,h,p.x*w+ox*2,p.y*h+oy*2,px);
      const l=px[0]*.2126+px[1]*.7152+px[2]*.0722;if(l>8&&l<250)values.push(l);
    }
  }
  values.sort((a,b)=>a-b);return clamp(values[Math.floor(values.length/2)]||120,25,230);
}

/**
 * Rasterize a smooth inverse warp with bilinear sampling and anatomical masks.
 * A 4px control grid keeps full-resolution processing inexpensive. Every pixel
 * still samples the original photograph; no stickers or substitute eyes exist.
 */
export function renderAlienPixels(image,landmarks,options={}){
  if(!image?.data||image.data.length!==image.width*image.height*4)throw new FaceFilterError('BAD_IMAGE','The photograph could not be decoded. Try a JPG or PNG.');
  const warp=createAlienWarp(landmarks,image.width,image.height,options);
  const {width,height,points}=warp;
  const outline=OVAL.map(i=>points[i]),left=LEFT_EYE.map(i=>points[i]),right=RIGHT_EYE.map(i=>points[i]),mouth=LIPS.map(i=>points[i]);
  const median=skinLuminance(image,landmarks),step=4,gw=Math.ceil((width-1)/step)+1,gh=Math.ceil((height-1)/step)+1;
  const grid=new Float32Array(gw*gh*5),feather=width*.034;
  for(let gy=0;gy<gh;gy++)for(let gx=0;gx<gw;gx++){
    const x=Math.min(width-1,gx*step),y=Math.min(height-1,gy*step),idx=(gy*gw+gx)*5;
    const dist=polygonDistance(x,y,outline),p=warp.inverse(x,y);
    grid[idx]=p.x;grid[idx+1]=p.y;grid[idx+2]=smooth(0,feather,dist);
    const eye=Math.max(smooth(-5,3,polygonDistance(x,y,left)),smooth(-5,3,polygonDistance(x,y,right)));
    const lips=smooth(-4,4,polygonDistance(x,y,mouth));
    grid[idx+3]=Math.max(eye*.94,lips*.69)*smooth(0,feather*2.5,dist);
    grid[idx+4]=smooth(0,feather*2.5,dist);
  }
  const output=new Uint8ClampedArray(width*height*4),px=[0,0,0],v=[0,0,0,0,0];
  for(let y=0;y<height;y++){
    const gy=Math.min(gh-2,Math.floor(y/step)),fy=(y-gy*step)/(Math.min(height-1,(gy+1)*step)-gy*step||1);
    for(let x=0;x<width;x++){
      const gx=Math.min(gw-2,Math.floor(x/step)),fx=(x-gx*step)/(Math.min(width-1,(gx+1)*step)-gx*step||1);
      const a=(gy*gw+gx)*5,b=a+5,c=a+gw*5,d=c+5;
      for(let k=0;k<5;k++)v[k]=(grid[a+k]*(1-fx)+grid[b+k]*fx)*(1-fy)+(grid[c+k]*(1-fx)+grid[d+k]*fx)*fy;
      const alpha=v[2],out=(y*width+x)*4;
      // Colored, fully transparent gutters prevent dark mipmap fringes where
      // the atlas blends into the modeled skin at small rendering sizes.
      if(alpha<.003){output[out]=SKIN_RGB[0];output[out+1]=SKIN_RGB[1];output[out+2]=SKIN_RGB[2];continue;}
      sample(image.data,image.width,image.height,v[0],v[1],px);
      const lum=px[0]*.2126+px[1]*.7152+px[2]*.0722;
      const shade=clamp(1+(lum/median-1)*.72,.18,1.11),blend=v[4],keep=v[3];
      // Preserve natural facial shadows, freckles and beard detail, normalize
      // exposure, then restore actual eyes/lips through softly blended masks.
      const exposure=clamp(145/median,.72,1.85);
      for(let k=0;k<3;k++){
        const green=SKIN_RGB[k]+(SKIN_RGB[k]*(shade-1)+(px[k]-lum)*.095)*blend;
        const original=clamp(px[k]*Math.sqrt(exposure),0,255);
        output[out+k]=green*(1-keep)+original*keep;
      }
      output[out+3]=Math.round(alpha*255);
    }
  }
  return {width,height,data:output,meta:{landmarks:landmarks.length,skinLuminance:Math.round(median),rollDegrees:Math.round(warp.roll*180/Math.PI),eyeEnlargement:1.19,noseScale:.86,foreheadScale:1.095}};
}
