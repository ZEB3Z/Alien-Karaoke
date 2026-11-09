import { renderAlienPixels } from './warp.js';
self.onmessage=({data:{id,image,landmarks}})=>{
  try{
    const result=renderAlienPixels(image,landmarks);
    self.postMessage({id,result},[result.data.buffer]);
  }catch(error){self.postMessage({id,error:{code:error.code||'TRANSFORM_FAILED',message:error.message}});}
};
