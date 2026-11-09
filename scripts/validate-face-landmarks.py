#!/usr/bin/env python3
"""Optional developer-only fixture check. Requires mediapipe, pillow and numpy.
This script runs the SAME packaged model natively for reproducible image tests;
the application itself performs all processing locally in browser JavaScript.
"""
import argparse, json, math, pathlib, time, hashlib, urllib.request
import numpy as np
from PIL import Image, ImageEnhance, ImageOps
import mediapipe as mp
from mediapipe.tasks import python
from mediapipe.tasks.python import vision
PROJECT=pathlib.Path(__file__).resolve().parent.parent
parser=argparse.ArgumentParser(description="Validate the packaged face model on documented public-domain portraits; no product photos leave the browser.")
parser.add_argument('--work-dir', type=pathlib.Path, required=True, help='User-owned folder for downloaded portraits and output fixtures')
parser.add_argument('--download', action='store_true', help='Download the four documented public-domain validation photographs')
args=parser.parse_args()
ROOT=args.work_dir.resolve();ROOT.mkdir(parents=True,exist_ok=True)
MODEL=PROJECT/'public/mediapipe/face_landmarker.task'
if args.download:
 (ROOT/'photos').mkdir(exist_ok=True)
 metadata=json.loads((PROJECT/'docs/face-filter-fixtures.json').read_text())
 for entry in metadata['photos']:
  destination=ROOT/'photos'/entry['file']
  if not destination.exists():
   print('Downloading '+entry['file'],flush=True)
   urllib.request.urlretrieve(entry['source'],destination)

OUT=ROOT/'fixtures';OUT.mkdir(exist_ok=True)
options=vision.FaceLandmarkerOptions(base_options=python.BaseOptions(model_asset_path=str(MODEL),delegate=python.BaseOptions.Delegate.CPU),running_mode=vision.RunningMode.IMAGE,num_faces=2,min_face_detection_confidence=0.5,min_face_presence_confidence=0.5,output_face_blendshapes=False)

def detect(detector,im):
 arr=np.array(im.convert('RGB'))
 started=time.perf_counter()
 result=detector.detect(mp.Image(image_format=mp.ImageFormat.SRGB,data=arr))
 return result,(time.perf_counter()-started)*1000

def serial(face):return [{'x':p.x,'y':p.y,'z':p.z} for p in face]

report={'runtime':'Python MediaPipe '+mp.__version__+' CPU / XNNPACK, same packaged face_landmarker.task','model_sha256':hashlib.sha256(MODEL.read_bytes()).hexdigest(),'fixtures':[],'baseFailures':[]}
with vision.FaceLandmarker.create_from_options(options) as detector:
 sources=['eileen-collins.png','barack-obama.jpg','grace-hopper-official.jpg','katherine-johnson.jpg']
 for filename in sources:
  im=ImageOps.exif_transpose(Image.open(ROOT/'photos'/filename)).convert('RGB')
  im.thumbnail((1024,1024),Image.Resampling.LANCZOS)
  initial,ms=detect(detector,im)
  if len(initial.face_landmarks)!=1:
   report['baseFailures'].append({'source':filename,'faces':len(initial.face_landmarks)})
   continue
  face=initial.face_landmarks[0]
  xs=[p.x*im.width for p in face[:468]];ys=[p.y*im.height for p in face[:468]]
  x0,x1,y0,y1=min(xs),max(xs),min(ys),max(ys)
  side=max(x1-x0,y1-y0)*1.42
  cx=(x0+x1)/2;cy=(y0+y1)/2-side*.025
  base=im.crop((int(cx-side/2),int(cy-side/2),int(cx+side/2),int(cy+side/2))).resize((512,512),Image.Resampling.LANCZOS)
  name=pathlib.Path(filename).stem
  raw=np.array(base,dtype=np.float32)
  shadow=np.linspace(.46,1.05,512,dtype=np.float32)[None,:,None]
  variants={
   'neutral':base,
   'dim':ImageEnhance.Brightness(base).enhance(.48),
   'bright':ImageEnhance.Brightness(base).enhance(1.4),
   'warm':Image.fromarray(np.clip(raw*np.array([1.14,.94,.72],dtype=np.float32),0,255).astype(np.uint8)),
   'side-shadow':Image.fromarray(np.clip(raw*shadow,0,255).astype(np.uint8)),
   'tilted':base.rotate(11,resample=Image.Resampling.BICUBIC,fillcolor=(32,34,38)),
  }
  for kind,img in variants.items():
   key=name+'-'+kind
   img.save(OUT/(key+'.jpg'),quality=95)
   result,ms=detect(detector,img)
   row={'id':key,'source':filename,'variation':kind,'image':str(OUT/(key+'.jpg')),'faces':len(result.face_landmarks),'detectionMs':round(ms,2),'width':512,'height':512}
   if len(result.face_landmarks)==1:
    landmarks=serial(result.face_landmarks[0]); row['landmarkCount']=len(landmarks)
    row['landmarks']=str(OUT/(key+'.json'))
    (OUT/(key+'.json')).write_text(json.dumps(landmarks))
   report['fixtures'].append(row)
 # Negative and multi-face detection are genuine model runs.
 blank=Image.new('RGB',(512,512),(190,200,180));blank.save(OUT/'no-face.png')
 result,ms=detect(detector,blank)
 report['noFace']={'faces':len(result.face_landmarks),'detectionMs':round(ms,2)}
 available=[f for f in report['fixtures'] if f['variation']=='neutral' and f.get('landmarks')]
 if len(available)>=2:
  a=Image.open(available[0]['image']).resize((320,320)); b=Image.open(available[1]['image']).resize((320,320))
  multi=Image.new('RGB',(640,320));multi.paste(a,(0,0));multi.paste(b,(320,0));multi.save(OUT/'two-faces.jpg',quality=95)
  result,ms=detect(detector,multi)
  report['twoFaces']={'faces':len(result.face_landmarks),'detectionMs':round(ms,2)}
report['passed']=sum(f['faces']==1 for f in report['fixtures'])
report['total']=len(report['fixtures'])
(ROOT/'detection-report.json').write_text(json.dumps(report,indent=2))
print(json.dumps({k:v for k,v in report.items() if k!='fixtures'},indent=2))
for f in report['fixtures']:print(f['id'],f['faces'],f.get('landmarkCount',0),f['detectionMs'])

if report['baseFailures'] or report['passed'] != 24 or report['total'] != 24 or report['noFace']['faces'] != 0 or report.get('twoFaces', {}).get('faces') != 2:
 raise SystemExit('Face fixture detection validation failed. See detection-report.json for the exact cases.')
