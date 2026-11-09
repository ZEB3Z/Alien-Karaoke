import { FACE_VERSION, FaceFilterError, renderAlienPixels, selectFace } from './warp.js';

let detectorPromise,detectorTimer;
const abortError=()=>new DOMException('Face transformation canceled.','AbortError');
const check=signal=>{if(signal?.aborted)throw abortError();};
const yieldUI=()=>new Promise(resolve=>setTimeout(resolve,0));
const assetURL=path=>new URL(`${import.meta.env.BASE_URL}mediapipe/${path}`,document.baseURI).href;

async function getDetector(){
  clearTimeout(detectorTimer);
  if(!detectorPromise){
    detectorPromise=(async()=>{
      const {FilesetResolver,FaceLandmarker}=await import('@mediapipe/tasks-vision');
      const files=await FilesetResolver.forVisionTasks(assetURL('wasm'));
      let expired=false;
      let timeout;
      const creation=FaceLandmarker.createFromOptions(files,{
        baseOptions:{modelAssetPath:assetURL('face_landmarker.task'),delegate:'CPU'},
        runningMode:'IMAGE',numFaces:2,minFaceDetectionConfidence:.5,minFacePresenceConfidence:.5,
        outputFaceBlendshapes:false,outputFacialTransformationMatrixes:false,
      }).then(detector=>{if(expired)detector.close();return detector;});
      try{return await Promise.race([creation,new Promise((_,reject)=>{timeout=setTimeout(()=>{expired=true;reject(new Error('Scanner initialization timed out.'));},45000);})]);}
      finally{clearTimeout(timeout);}
    })().catch(error=>{detectorPromise=null;throw new FaceFilterError('MODEL_UNAVAILABLE','The local face scanner could not load. Retry once, or reload the app.');});
  }
  return detectorPromise;
}

function retireDetector(){
  clearTimeout(detectorTimer);
  detectorTimer=setTimeout(()=>{
    const previous=detectorPromise;detectorPromise=null;
    previous?.then(detector=>detector.close()).catch(()=>{});
  },60000);
}

function decodePhoto(url,signal){
  return new Promise((resolve,reject)=>{
    check(signal);const image=new Image();
    const abort=()=>{image.src='';reject(abortError());};
    const clean=()=>signal?.removeEventListener('abort',abort);
    image.onload=()=>{clean();resolve(image);};image.onerror=()=>{clean();reject(new FaceFilterError('BAD_IMAGE','That photograph could not be opened. Try a JPG or PNG.'));};
    signal?.addEventListener('abort',abort,{once:true});image.src=url;
  });
}

function warpInWorker(image,landmarks,signal){
  if(typeof Worker==='undefined')return Promise.resolve().then(()=>{check(signal);return renderAlienPixels(image,landmarks);});
  return new Promise((resolve,reject)=>{
    let worker;
    try{worker=new Worker(new URL('./warp.worker.js',import.meta.url),{type:'module'});}catch{resolve(renderAlienPixels(image,landmarks));return;}
    const cleanup=()=>{clearTimeout(timeout);worker.terminate();signal?.removeEventListener('abort',abort);};
    const abort=()=>{cleanup();reject(abortError());};
    const timeout=setTimeout(()=>{cleanup();reject(new FaceFilterError('TRANSFORM_TIMEOUT','The face filter took too long. Try a smaller, clear face photograph.'));},15000);
    worker.onmessage=({data})=>{cleanup();if(data.error)reject(new FaceFilterError(data.error.code,data.error.message));else resolve(data.result);};
    worker.onerror=()=>{cleanup();try{check(signal);resolve(renderAlienPixels(image,landmarks));}catch(error){reject(error);}};
    signal?.addEventListener('abort',abort,{once:true});
    // Copy the source buffer so a browser that refuses Worker loading can still
    // run the same bounded one-time rasterizer on the main thread.
    try{worker.postMessage({id:1,image:{width:image.width,height:image.height,data:image.data},landmarks});}
    catch(error){cleanup();reject(new FaceFilterError('WORKER_UNAVAILABLE','The local image processor could not start. Reload and try the photograph again.'));}
  });
}

/** Process one photograph locally. The generated PNG is reused for all scenes. */
export async function transformAlienFace(dataURL,{signal,onProgress=()=>{}}={}){
  const started=performance.now();check(signal);
  if(!/^data:image\//.test(dataURL||''))throw new FaceFilterError('BAD_IMAGE','Capture or upload a photograph before scanning.');
  onProgress({message:'Loading your local face scanner…',progress:.08});await yieldUI();
  try{
    const [photo,detector]=await Promise.all([decodePhoto(dataURL,signal),getDetector()]);check(signal);
    const canvas=document.createElement('canvas'),scale=Math.min(1,768/Math.max(photo.naturalWidth||photo.width,photo.naturalHeight||photo.height));
    canvas.width=Math.round((photo.naturalWidth||photo.width)*scale);canvas.height=Math.round((photo.naturalHeight||photo.height)*scale);
    const context=canvas.getContext('2d',{willReadFrequently:true});
    if(!context)throw new FaceFilterError('CANVAS_UNAVAILABLE','Your browser cannot prepare a face texture. Try another current browser.');
    context.drawImage(photo,0,0,canvas.width,canvas.height);
    onProgress({message:'Finding your eyes, nose, smile and face shape…',progress:.38});await yieldUI();check(signal);
    const landmarks=selectFace(detector.detect(canvas));check(signal);
    const pixels=context.getImageData(0,0,canvas.width,canvas.height);
    onProgress({message:'Warping your alien features and blending green skin…',progress:.65});await yieldUI();check(signal);
    const result=await warpInWorker({width:pixels.width,height:pixels.height,data:pixels.data},landmarks,signal);check(signal);
    const texture=document.createElement('canvas');texture.width=result.width;texture.height=result.height;
    const output=texture.getContext('2d');
    if(!output)throw new FaceFilterError('CANVAS_UNAVAILABLE','The face texture could not be created. Try another current browser.');
    output.putImageData(new ImageData(new Uint8ClampedArray(result.data),result.width,result.height),0,0);
    onProgress({message:'Your extraterrestrial identity is ready.',progress:1});
    return {photo:texture.toDataURL('image/png'),faceVersion:FACE_VERSION,faceMeta:{...result.meta,processingMs:Math.round(performance.now()-started)}};
  }catch(error){
    if(error.name==='AbortError'||error instanceof FaceFilterError)throw error;
    throw new FaceFilterError('SCAN_FAILED','The face scanner could not read this image. Try a clear, front-facing photo in a current browser with 3D graphics enabled.');
  }finally{retireDetector();}
}
