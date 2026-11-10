import React, { useEffect, useRef, useState } from 'react';
import { Camera, Upload, X, RotateCcw, Check, ScanFace, ArrowRight, ShieldCheck, LoaderCircle, Move, ZoomIn, Sparkles, ChevronLeft } from 'lucide-react';
import { transformAlienFace } from './face/faceFilter.js';
import { AvatarPreview } from './World.jsx';
import { SKINS, ACCESSORIES, OUTFITS, ACCENTS, normalizeAlienStyle } from './alienStyle.js';
import './media.css';

const MAX_FILE_SIZE = 15 * 1024 * 1024;
const FACE_VERSION = 'landmark-alien-v2';

export default function Registration({ profile, onComplete, onCancel, onSound }) {
  const existing = profile?.faceVersion === FACE_VERSION && profile?.photo
    ? { photo: profile.photo, faceVersion: profile.faceVersion, faceMeta: profile.faceMeta || {} } : null;
  const [nickname, setNickname] = useState(profile?.nickname || '');
  const [alienStyle, setAlienStyle] = useState(() => normalizeAlienStyle(profile?.style));
  // A transformed texture is never fed back into the detector as a human source.
  const [image, setImage] = useState(existing ? '' : profile?.photo || '');
  const [generated, setGenerated] = useState(existing);
  const [previewOpen, setPreviewOpen] = useState(!!existing);
  const [previewTab, setPreviewTab] = useState('3d');
  const [sourceCrop, setSourceCrop] = useState('');
  const [cameraOn, setCameraOn] = useState(false);
  const [busy, setBusy] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState({ message: 'Loading the local face scanner…', progress: null });
  const [error, setError] = useState('');
  const [zoom, setZoom] = useState(1);
  const [position, setPosition] = useState({ x: 50, y: 50 });
  const [imageRatio, setImageRatio] = useState(1);
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const fileRef = useRef(null);
  const imageRef = useRef(null);
  const mountedRef = useRef(true);
  const dialogRef = useRef(null);
  const controllerRef = useRef(null);
  const revisionRef = useRef(0);
  const onCancelRef = useRef(onCancel);
  onCancelRef.current = onCancel;
  const isPreview = !!generated && previewOpen;

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setCameraOn(false);
  };

  const cancelTransformation = () => {
    revisionRef.current++;
    controllerRef.current?.abort();
    controllerRef.current = null;
    setProcessing(false);
    setBusy(false);
  };

  const invalidatePreview = () => {
    cancelTransformation();
    setGenerated(null);
    setPreviewOpen(false);
    setSourceCrop('');
    setPreviewTab('3d');
    setError('');
  };

  const closeRegistration = () => {
    cancelTransformation();
    onCancelRef.current?.();
  };

  useEffect(() => {
    mountedRef.current = true;
    const lastFocus = document.activeElement;
    dialogRef.current?.querySelector('input')?.focus();
    const onKey = (event) => {
      if (event.key === 'Escape') {
        revisionRef.current++;
        controllerRef.current?.abort();
        onCancelRef.current?.();
      }
      if (event.key === 'Tab') {
        const focusable = [...(dialogRef.current?.querySelectorAll('button:not([disabled]),input:not([disabled]),[tabindex="0"]') || [])];
        const first = focusable[0];
        const last = focusable.at(-1);
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      mountedRef.current = false;
      revisionRef.current++;
      controllerRef.current?.abort();
      streamRef.current?.getTracks().forEach((track) => track.stop());
      document.removeEventListener('keydown', onKey);
      lastFocus?.focus?.();
    };
  }, []);

  useEffect(() => {
    if (cameraOn && videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current;
      videoRef.current.play().catch(() => { if (mountedRef.current) setError('Tap the camera preview to start your camera.'); });
    }
  }, [cameraOn]);

  useEffect(() => {
    if (isPreview) { dialogRef.current?.scrollTo?.({top:0}); dialogRef.current?.querySelector('.reg-preview-tabs button')?.focus({preventScroll:true}); }
  }, [isPreview]);

  async function startCamera() {
    setError('');
    if (!navigator.mediaDevices?.getUserMedia) {
      setError('Camera access requires HTTPS or localhost. Upload a photograph instead.');
      return;
    }
    setBusy(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 1280 } }, audio: false });
      if (!mountedRef.current) { stream.getTracks().forEach((track) => track.stop()); return; }
      invalidatePreview();
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = stream;
      setCameraOn(true);
      setImage('');
      setZoom(1);
      setPosition({ x: 50, y: 50 });
    } catch (err) {
      if (!mountedRef.current) return;
      const messages = {
        NotAllowedError: 'Camera permission was declined. You can allow it in your browser or upload a photo.',
        NotFoundError: 'No camera found on this device. Upload a photograph to continue.',
        NotReadableError: 'Your camera is busy in another app. Close that app or upload a photograph.',
      };
      setError(messages[err.name] || 'We could not start your camera. Please upload a photograph instead.');
    } finally {
      if (mountedRef.current) setBusy(false);
    }
  }

  function capture() {
    const video = videoRef.current;
    if (!video?.videoWidth) { setError('Your camera is still warming up. Try again in a moment.'); return; }
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 1024;
    const size = Math.min(video.videoWidth, video.videoHeight);
    const context = canvas.getContext('2d');
    if (!context) { setError('The image editor is unavailable. Try another browser.'); return; }
    context.translate(1024, 0);
    context.scale(-1, 1);
    context.drawImage(video, (video.videoWidth - size) / 2, (video.videoHeight - size) / 2, size, size, 0, 0, 1024, 1024);
    invalidatePreview();
    setImage(canvas.toDataURL('image/jpeg', 0.94));
    stopCamera();
    onSound?.('shutter');
  }

  async function upload(event) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setError('');
    if (!/^image\/(jpeg|png|webp|avif|gif)$/.test(file.type)) { setError('Choose a JPG, PNG, WebP, AVIF, or GIF photograph.'); return; }
    if (file.size > MAX_FILE_SIZE) { setError('This photograph is too large. Choose an image smaller than 15 MB.'); return; }
    invalidatePreview();
    const revision = revisionRef.current;
    setBusy(true);
    try {
      const data = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      const decoded = await new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = data;
      });
      if (decoded.width < 96 || decoded.height < 96) throw new Error('small');
      const canvas = document.createElement('canvas');
      const scale = Math.min(1, 1600 / Math.max(decoded.width, decoded.height));
      canvas.width = Math.round(decoded.width * scale);
      canvas.height = Math.round(decoded.height * scale);
      const context = canvas.getContext('2d');
      if (!context) throw new Error('canvas');
      context.drawImage(decoded, 0, 0, canvas.width, canvas.height);
      if (!mountedRef.current || revision !== revisionRef.current) return;
      stopCamera();
      setImage(canvas.toDataURL('image/jpeg', 0.94));
      setZoom(1);
      setPosition({ x: 50, y: 50 });
      onSound?.('click');
    } catch (err) {
      if (!mountedRef.current || revision !== revisionRef.current) return;
      setError(err.message === 'small' ? 'Choose a larger image, at least 96 × 96 pixels.' : 'That image could not be opened. Try a JPG or PNG photograph.');
    } finally {
      if (mountedRef.current && revision === revisionRef.current) setBusy(false);
    }
  }

  function confirm() {
    if (!generated || !nickname.trim() || busy) return;
    onSound?.('confirm');
    stopCamera();
    onComplete({
      id: profile?.id || globalThis.crypto?.randomUUID?.() || `alien-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      nickname: nickname.trim().slice(0, 20),
      photo: generated.photo,
      faceVersion: generated.faceVersion,
      faceMeta: generated.faceMeta,
      style: alienStyle,
      createdAt: profile?.createdAt || new Date().toISOString(),
    });
  }

  async function submit(event) {
    event.preventDefault();
    if (busy) return;
    if (!nickname.trim()) { setError('Your alien needs a nickname.'); return; }
    if (isPreview) { confirm(); return; }
    // A nickname edit or looking at the crop does not run detection again.
    if (generated) { setPreviewOpen(true); return; }
    if (!image || !imageRef.current?.complete || !imageRef.current.naturalWidth) { setError('Capture or upload a photograph to create your alien.'); return; }
    const source = imageRef.current;
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 768;
    const context = canvas.getContext('2d');
    if (!context) { setError('The image editor is unavailable. Try another browser.'); return; }
    const cropSize = Math.min(source.naturalWidth, source.naturalHeight) / zoom;
    const cropX = (source.naturalWidth - cropSize) * position.x / 100;
    const cropY = (source.naturalHeight - cropSize) * position.y / 100;
    context.drawImage(source, cropX, cropY, cropSize, cropSize, 0, 0, 768, 768);
    const crop = canvas.toDataURL('image/jpeg', 0.96);
    const controller = new AbortController();
    controllerRef.current?.abort();
    controllerRef.current = controller;
    const revision = ++revisionRef.current;
    setBusy(true);
    setProcessing(true);
    setError('');
    setProgress({ message: 'Loading the local face scanner…', progress: null });
    stopCamera();
    onSound?.('click');
    try {
      const transformed = await transformAlienFace(crop, {
        signal: controller.signal,
        onProgress: (value) => {
          if (!mountedRef.current || revision !== revisionRef.current || controller.signal.aborted) return;
          const message = typeof value === 'string' ? value : value?.message || value?.label || value?.stage || 'Transforming your alien face…';
          const amount = typeof value === 'object' ? value?.progress : null;
          setProgress({ message, progress: Number.isFinite(amount) ? Math.max(0, Math.min(1, amount > 1 ? amount / 100 : amount)) : null });
        },
      });
      if (!mountedRef.current || revision !== revisionRef.current || controller.signal.aborted) return;
      if (!transformed?.photo || transformed.faceVersion !== FACE_VERSION) throw new Error('The face filter could not finish. Please try your photograph again.');
      setGenerated(transformed);
      setSourceCrop(crop);
      setPreviewOpen(true);
      setPreviewTab('3d');
      onSound?.('teleport');
    } catch (err) {
      if (!mountedRef.current || revision !== revisionRef.current || controller.signal.aborted || err.name === 'AbortError') return;
      setError(err.message || 'The face filter could not finish. Try a clear, front-facing photograph.');
    } finally {
      if (mountedRef.current && revision === revisionRef.current) {
        controllerRef.current = null;
        setBusy(false);
        setProcessing(false);
      }
    }
  }

  const width = imageRatio >= 1 ? 100 * imageRatio * zoom : 100 * zoom;
  const height = imageRatio >= 1 ? 100 * zoom : 100 / imageRatio * zoom;
  const changeCrop = (update) => { invalidatePreview(); update(); };
  const previewProfile = generated ? { nickname: nickname.trim() || 'Your alien', ...generated, style: alienStyle } : null;
  const changeStyle = (name, value) => { setAlienStyle(current => ({ ...current, [name]: value })); onSound?.('click'); };

  return <div className="registration-backdrop">
    <section className={`registration-dialog ${isPreview ? 'reg-is-preview' : ''}`} role="dialog" aria-modal="true" aria-labelledby="registration-title" ref={dialogRef}>
      <button className="reg-close" type="button" aria-label="Close registration" onClick={closeRegistration}><X size={20} /></button>
      <div className="reg-topline"><span className="reg-status-dot" /> EARTHLING INTAKE <span>SECTOR 09</span></div>
      <h2 id="registration-title">YOUR FACE.<br /><em>ALIEN ENERGY.</em></h2>
      <p className="reg-intro">{isPreview ? 'Still unmistakably you. Just a little less terrestrial.' : 'One small photo for you. One giant head for alienkind.'}</p>
      <form onSubmit={submit} className={isPreview ? 'reg-split' : undefined}>
        {isPreview ? <>
          <div className="reg-split-view">
        <div className="reg-label"><span>03</span> MEET YOUR NEW SPECIES</div>
        <div className="reg-preview-tabs" role="group" aria-label="Alien preview view">
          <button type="button" aria-pressed={previewTab === '3d'} onClick={() => setPreviewTab('3d')}><Sparkles size={13} /> 3D ALIEN</button>
          <button type="button" aria-pressed={previewTab === 'face'} onClick={() => setPreviewTab('face')}><ScanFace size={13} /> FACE FILTER</button>
        </div>
        {previewTab === '3d' ? <div className="reg-alien-preview" aria-label="Your transformed 3D alien preview"><AvatarPreview profile={previewProfile} /><span className="reg-preview-badge"><span /> LANDMARK TRANSFORMATION COMPLETE</span></div> : <div className={`reg-transform-compare ${sourceCrop ? '' : 'reg-transformed-only'}`}>
          {sourceCrop && <figure><div><img src={sourceCrop} alt="Original face before transformation" /></div><figcaption>HUMAN FREQUENCY</figcaption></figure>}
          <figure><div className="reg-filtered-photo"><img src={generated.photo} alt="Your transformed alien face" /></div><figcaption>ALIEN FREQUENCY</figcaption></figure>
        </div>}
          </div>
          <div className="reg-split-controls">
      <label className="reg-label" htmlFor="alien-nickname"><span>01</span> PICK YOUR SPACE NAME</label>
      <div className="reg-name-wrap"><input id="alien-nickname" placeholder="e.g. Cosmic Dave" autoComplete="nickname" maxLength={20} value={nickname} onChange={(event) => setNickname(event.target.value)} required /><span>{nickname.length}/20</span></div>
        <section className="reg-customizer" aria-label="Alien customization">
          <div className="reg-customizer-title"><Sparkles size={16} /> <strong>04 / MUTATE YOUR LOOK</strong><span>LIVE 3D</span></div>
          <p className="reg-customizer-help">Pick your species color, ridiculous headgear, suit and neon trim. Your choices appear on your alien and in the Hall of Fame.</p>
          <fieldset className="reg-style-field"><legend>SKIN / SPECIES COLOR</legend><div className="reg-color-grid">{SKINS.map(option => <button key={option.id} type="button" className="reg-color-option" aria-label={`Skin: ${option.label}`} aria-pressed={alienStyle.skin === option.id} onClick={() => changeStyle('skin', option.id)}><span className="reg-color-dot" style={{ '--swatch': option.hex }} /><span>{option.label}</span></button>)}</div></fieldset>
          <fieldset className="reg-style-field"><legend>HEAD ACCESSORY</legend><div className="reg-accessory-grid">{ACCESSORIES.map(option => <button key={option.id} type="button" aria-pressed={alienStyle.accessory === option.id} className="reg-accessory-option" onClick={() => changeStyle('accessory', option.id)}><span aria-hidden="true">{option.icon}</span><small>{option.label}</small></button>)}</div></fieldset>
          <fieldset className="reg-style-field"><legend>SPACE SUIT</legend><div className="reg-palette-row">{OUTFITS.map(option => <button key={option.id} type="button" className="reg-palette-option" aria-label={`Suit: ${option.label}`} aria-pressed={alienStyle.outfit === option.id} title={option.label} onClick={() => changeStyle('outfit', option.id)} style={{ '--swatch': option.hex }} />)}</div></fieldset>
          <fieldset className="reg-style-field"><legend>NEON ACCESSORY COLOR</legend><div className="reg-palette-row">{ACCENTS.map(option => <button key={option.id} type="button" className="reg-palette-option" aria-label={`Neon: ${option.label}`} aria-pressed={alienStyle.accent === option.id} title={option.label} onClick={() => changeStyle('accent', option.id)} style={{ '--swatch': option.hex }} />)}</div></fieldset>
          <div className="reg-customizer-tip">Your face stays yours. Only the alien styling changes.</div>
        </section>
        <div className="reg-filter-summary"><Check size={14} /><p>Face-shaped warp. Bigger eyes. Your new cosmic colors.<br /><span>Your expression and facial details stay yours.</span></p></div>
        <button type="button" className="reg-adjust" onClick={() => { setPreviewOpen(false); setError(''); }}><ChevronLeft size={15} /> {image ? 'ADJUST PHOTO' : 'CHOOSE ANOTHER PHOTO'}</button>
      <div className="reg-photo-buttons">
        {cameraOn ? <button type="button" className="reg-camera-button" onClick={capture} disabled={busy}><Camera size={16} /> CAPTURE PHOTO</button> : <button type="button" className="reg-camera-button" onClick={startCamera} disabled={busy}>{image || generated ? <RotateCcw size={16} /> : <Camera size={16} />}{image || generated ? 'RETAKE PHOTO' : 'USE CAMERA'}</button>}
        <button type="button" className="reg-upload-button" onClick={() => fileRef.current?.click()} disabled={busy}><Upload size={16} /> UPLOAD PHOTO</button>
        <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp,image/avif,image/gif" onChange={upload} hidden />
      </div>
      {error && <p role="alert" className="reg-error">{error}</p>}
      <button type="submit" data-filter-confirm={isPreview ? '' : undefined} className="reg-generate" disabled={busy || (!image && !generated) || !nickname.trim()}><span>{isPreview ? <Check size={18} /> : <ScanFace size={18} />} {isPreview ? 'CONFIRM MY ALIEN' : processing ? 'TRANSFORMING YOUR FACE…' : 'PREVIEW MY ALIEN'}</span><ArrowRight size={20} /></button>
      <p className="reg-privacy"><ShieldCheck size={13} /> Processed once, entirely on this device. Your photo never leaves it.</p>
          </div>
        </> : <>
        <label className="reg-label" htmlFor="alien-nickname"><span>01</span> PICK YOUR SPACE NAME</label>
        <div className="reg-name-wrap"><input id="alien-nickname" placeholder="e.g. Cosmic Dave" autoComplete="nickname" maxLength={20} value={nickname} onChange={(event) => setNickname(event.target.value)} required /><span>{nickname.length}/20</span></div>
          <div className="reg-label"><span>02</span> SCAN YOUR HUMAN FACE</div>
          <div className={`reg-camera ${image ? 'has-photo' : ''}`}>
            {cameraOn ? <video ref={videoRef} playsInline autoPlay muted aria-label="Live camera preview" onClick={() => videoRef.current?.play()} /> : image ? <img ref={imageRef} src={image} alt="Your face crop preview" onLoad={(event) => setImageRatio(event.currentTarget.naturalWidth / event.currentTarget.naturalHeight)} style={{ width: `${width}%`, height: `${height}%`, left: `${-(width - 100) * position.x / 100}%`, top: `${-(height - 100) * position.y / 100}%` }} /> : <div className="reg-camera-empty"><ScanFace size={60} strokeWidth={1} /><strong>HUMAN DETECTED?</strong><span>Center one face. Maximum weirdness encouraged.</span></div>}
            <div className="reg-scan-corners" aria-hidden="true"><i /><i /><i /><i /></div>
            {(image || cameraOn) && <span className="reg-camera-label"><span /> {cameraOn ? 'LIVE · FACE SCANNER' : 'PHOTO READY · PREVIEW NEXT'}</span>}
            {busy && <div className="reg-camera-busy" role="status"><LoaderCircle className="reg-spin" size={26} /><div><strong>{processing ? progress.message : 'OPENING SCANNER…'}</strong>{processing && <><span>Mapping your features on this device</span>{progress.progress !== null && <progress max="1" value={progress.progress} aria-label="Alien face transformation progress" />}</>}</div></div>}
          </div>
          {image && !cameraOn && <div className="reg-crop-tools">
            <label><ZoomIn size={13} /> Zoom<input aria-label="Face zoom" type="range" min="1" max="3" step="0.02" value={zoom} onChange={(event) => changeCrop(() => setZoom(Number(event.target.value)))} /></label>
            <label><Move size={13} /> Left / right<input aria-label="Move face horizontally" type="range" min="0" max="100" value={position.x} onChange={(event) => changeCrop(() => setPosition((value) => ({ ...value, x: Number(event.target.value) })))} /></label>
            <label>Up / down<input aria-label="Move face vertically" type="range" min="0" max="100" value={position.y} onChange={(event) => changeCrop(() => setPosition((value) => ({ ...value, y: Number(event.target.value) })))} /></label>
          </div>}
          {processing && <button type="button" className="reg-cancel-transform" onClick={cancelTransformation}>CANCEL TRANSFORMATION</button>}
          <p className="reg-photo-hint">Use one clear, front-facing face with even light. We detect your features, reshape them into an alien, and blend the result into your 3D head. You’ll see it before you confirm.</p>
        <div className="reg-photo-buttons">
          {cameraOn ? <button type="button" className="reg-camera-button" onClick={capture} disabled={busy}><Camera size={16} /> CAPTURE PHOTO</button> : <button type="button" className="reg-camera-button" onClick={startCamera} disabled={busy}>{image || generated ? <RotateCcw size={16} /> : <Camera size={16} />}{image || generated ? 'RETAKE PHOTO' : 'USE CAMERA'}</button>}
          <button type="button" className="reg-upload-button" onClick={() => fileRef.current?.click()} disabled={busy}><Upload size={16} /> UPLOAD PHOTO</button>
          <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp,image/avif,image/gif" onChange={upload} hidden />
        </div>
        {error && <p role="alert" className="reg-error">{error}</p>}
        <button type="submit" data-filter-confirm={isPreview ? '' : undefined} className="reg-generate" disabled={busy || (!image && !generated) || !nickname.trim()}><span>{isPreview ? <Check size={18} /> : <ScanFace size={18} />} {isPreview ? 'CONFIRM MY ALIEN' : processing ? 'TRANSFORMING YOUR FACE…' : 'PREVIEW MY ALIEN'}</span><ArrowRight size={20} /></button>
        <p className="reg-privacy"><ShieldCheck size={13} /> Processed once, entirely on this device. Your photo never leaves it.</p>
        </>}
      </form>
    </section>
  </div>;
}
