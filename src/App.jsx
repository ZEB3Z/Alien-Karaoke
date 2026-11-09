import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { ArrowUpRight, ArrowRight, Volume2, VolumeX, X, Trophy, Mic2, Play, Pause, RotateCcw, LogOut, Radio, Camera, Sparkles, ChevronLeft, Music2, Check, ExternalLink, MoveRight, CircleHelp } from 'lucide-react';
import World, { AlienPortrait } from './World.jsx';
import { isAlienFaceProfile } from './face/texture.js';
import Registration from './Registration.jsx';
import YouTubePlayer, { parseYouTubeUrl } from './YouTubePlayer.jsx';
import PlayerChaos, { usePlayerChaos } from './PlayerChaos.jsx';
import HallOfFame from './HallOfFame.jsx';
import audio from './audio.js';
import { loadProfile, saveProfile, clearProfile, loadRecords, addRecord, loadSettings, saveSettings, randomScore } from './storage.js';

const EVENTS = [
  { kind: 'ufo', text: 'AIR TRAFFIC ALERT · Someone parked a saucer on the dance floor.' },
  { kind: 'parade', text: 'CONGA PROTOCOL INITIATED · Resistance is rhythm-less.' },
  { kind: 'notes', text: 'UNIDENTIFIED FLYING NOTES · The crowd is feeling it.' },
  { kind: 'disco', text: 'DISCO ANOMALY · Local gravity now 80% funkier.' },
  { kind: 'visitor', text: 'CLOSE ENCOUNTER · Blorp says you have excellent vibes.' },
];
const AWARDS = ['The Golden Space Noodle', 'Best Voice in This Solar System*', 'The Cosmic Goosebump', 'Honorary Minister of Funk', 'The Platinum Tentacle'];
const abductionLines = ['IDENTITY CONFIRMED. MOSTLY HUMAN.', 'YOUR NEW BODY IS READY.', 'PLEASE KEEP ALL LIMBS INSIDE THE BEAM.', 'NEXT STOP: THE DISCO DIMENSION.'];

function Brand({onClick}) { return <button className="brand" onClick={onClick} aria-label="Alien Karaoke Booth home"><svg viewBox="0 0 38 44" aria-hidden="true"><path d="M19 2C-6 3 1 29 11 36l8 6 8-6C37 29 44 3 19 2Z" fill="currentColor"/><ellipse cx="11" cy="19" rx="4.5" ry="7" transform="rotate(-31 11 19)" fill="#11121a"/><ellipse cx="27" cy="19" rx="4.5" ry="7" transform="rotate(31 27 19)" fill="#11121a"/><path d="M15 32h8" stroke="#11121a" strokeWidth="2"/></svg><span>ALIEN<span>KARAOKE BOOTH</span></span></button>; }

function Modal({children,onClose,label,wide=false,gallery=false}) {
  const ref=useRef();
  useEffect(()=>{
    const previous=document.activeElement;
    const first=ref.current?.querySelector('button,input,a,[tabindex="0"]'); first?.focus();
    const listener=e=>{
      if(e.key==='Escape')onClose();
      if(e.key==='Tab') {
        const all=[...ref.current.querySelectorAll('button:not(:disabled),input,a,[tabindex="0"]')];
        if(e.shiftKey&&document.activeElement===all[0]){e.preventDefault();all.at(-1)?.focus();}
        if(!e.shiftKey&&document.activeElement===all.at(-1)){e.preventDefault();all[0]?.focus();}
      }
    };
    document.addEventListener('keydown',listener);return()=>{document.removeEventListener('keydown',listener);previous?.focus();};
  },[onClose]);
  return <div className="modal-shade" onMouseDown={e=>{if(e.target===e.currentTarget)onClose();}}><section ref={ref} role="dialog" aria-modal="true" aria-label={label} className={`arcade-modal ${wide?'wide':''} ${gallery?'gallery-modal':''}`}><button onClick={onClose} className="close-button" aria-label="Close dialog"><X size={20}/></button>{children}</section></div>;
}

function playTime(value) {
  const time = new Date(value);
  if (!Number.isFinite(time.getTime())) return 'UNKNOWN TIME';
  return new Intl.DateTimeFormat('en-PH', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(time).toUpperCase();
}

function Board({records,compact=false,onExpand}) {
  const rows=[...records].sort((a,b)=>b.createdAt.localeCompare(a.createdAt));
  return <div className={`leaderboard recent-board ${compact?'compact':''}`}>
    <div className="board-heading"><div><span className="eyebrow"><Radio size={13}/> RECENT PLAYS</span>{!compact&&<h2>FRESH FROM<br/><em>THE MOTHERSHIP.</em></h2>}</div>{compact&&<button className="text-button" onClick={onExpand}>Meet the aliens <ArrowUpRight size={15}/></button>}</div>
    <div className="board-columns"><span>NEWEST PERFORMANCES</span><span>SPACE LUCK</span></div>
    {rows.slice(0,compact?3:20).map((r,i)=><div className="board-row" key={r.id}><span className={`rank rank-${i}`}>{i===0?'NEW':'✳'}</span><AlienPortrait profile={{nickname:r.nickname,photo:r.photo||null,faceVersion:r.faceVersion,style:r.style}} seed={i} size={compact?40:52}/><div className="record-info"><strong>{r.nickname}</strong><span title={r.song}>{r.song}</span><time dateTime={r.createdAt}>{playTime(r.createdAt)}</time></div><b className="record-score">{r.score}<small> / 100</small></b></div>)}
    {rows.length===0&&<div className="recent-empty"><Sparkles size={22}/><strong>NO SINGERS SPOTTED YET</strong><span>Be the first alien to make a transmission.</span></div>}
    <p className="house-note">{rows.length?`LATEST ${Math.min(rows.length,3)} PLAYS · SAVED ON THIS DEVICE`:'THE FIRST EARTHLING IS STILL OUT THERE'}</p>
  </div>;
}

export default function App(){
  const initial=useRef(loadSettings());
  const [profile,setProfile]=useState(loadProfile);
  const [records,setRecords]=useState(loadRecords);
  const [mode,setMode]=useState('menu');
  const [dialog,setDialog]=useState(null);
  const [muted,setMuted]=useState(initial.current.muted ?? true);
  const [volume,setVolume]=useState(initial.current.volume ?? .45);
  const [motion,setMotion]=useState(initial.current.reducedMotion ?? window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const [toast,setToast]=useState('');
  const [event,setEvent]=useState(null);
  const [url,setUrl]=useState('');
  const [song,setSong]=useState(null);
  const [songError,setSongError]=useState('');
  const [playing,setPlaying]=useState(true);
  const [videoReady,setVideoReady]=useState(false);
  const [videoVolume,setVideoVolume]=useState(75);
  const [mic,setMic]=useState(false);
  const [micPending,setMicPending]=useState(false);
  const [result,setResult]=useState(null);
  const [reveal,setReveal]=useState(false);
  const [abductionStep,setAbductionStep]=useState(0);
  const [cinema,setCinema]=useState(false);
  const [pageVisible,setPageVisible]=useState(()=>document.visibilityState!=='hidden');
  const chaosEnabled=mode==='performance'&&videoReady&&playing&&!motion&&!cinema&&!dialog&&!songError&&pageVisible;
  const {prank,summon}=usePlayerChaos(chaosEnabled,song?.videoId);
  const [elapsed,setElapsed]=useState(0);
  const [duration,setDuration]=useState(0);
  const playerRef=useRef(null), finishRef=useRef(false), toastTimer=useRef(null), micSession=useRef(0);
  const notify=useCallback(text=>{setToast(text);clearTimeout(toastTimer.current);toastTimer.current=setTimeout(()=>setToast(''),5500);},[]);
  const unlock=useCallback(()=>{audio.unlock();audio.effect('button');},[]);
  useEffect(()=>{const check=()=>setPageVisible(document.visibilityState!=='hidden');document.addEventListener('visibilitychange',check);return()=>document.removeEventListener('visibilitychange',check);},[]);
  useEffect(()=>{audio.setVolume(volume);audio.setMuted(muted);saveSettings({muted,volume,reducedMotion:motion});},[muted,volume,motion]);
  useEffect(()=>{audio.setScene(mode);},[mode]);
  useEffect(()=>()=>{audio.stopMicrophone();clearTimeout(toastTimer.current);audio.dispose();},[]);
  useEffect(()=>{
    if(!['menu','club','performance'].includes(mode))return;
    let reset;
    const timer=setInterval(()=>{const next={...EVENTS[Math.floor(Math.random()*EVENTS.length)],id:Date.now()};setEvent(next);audio.effect('chatter');reset=setTimeout(()=>setEvent(null),5200);},18000+Math.random()*11000);
    return()=>{clearInterval(timer);clearTimeout(reset);setEvent(null);};
  },[mode]);
  useEffect(()=>{
    if(mode!=='abduction')return;
    setAbductionStep(0);
    const interval=setInterval(()=>setAbductionStep(s=>Math.min(3,s+1)),2200);
    return()=>clearInterval(interval);
  },[mode]);
  useEffect(()=>{
    if(mode!=='results')return;
    setReveal(false);audio.effect('reveal');
    const timer=setTimeout(()=>{setReveal(true);audio.effect('victory');},2100);
    return()=>clearTimeout(timer);
  },[mode]);
  useEffect(()=>{
    if(mode!=='performance')return;
    const t=setInterval(()=>{const p=playerRef.current;if(p?.getCurrentTime){setElapsed(p.getCurrentTime()||0);setDuration(p.getDuration()||0);setPlaying(p.getPlayerState()===1);}},500);
    return()=>clearInterval(t);
  },[mode]);
  const completeRegistration=useCallback(p=>{
    const saved=saveProfile(p);setProfile(p);setDialog(null);micSession.current++;audio.stopMicrophone();setMic(false);setMicPending(false);setMode('abduction');audio.effect('abduction');
    if(saved?.ok===false)notify(saved.error);
  },[notify]);
  const start=()=>{unlock();if(isAlienFaceProfile(profile)){setMode('abduction');audio.effect('abduction');}else setDialog('register');};
  const enterClub=useCallback(()=>{setMode('club');audio.effect('teleport');},[]);
  const home=()=>{unlock();setMode('menu');setDialog(null);setCinema(false);micSession.current++;audio.stopMicrophone();setMic(false);setMicPending(false);};
  // The BOOTH tab returns to the default menu and logs out the current player.
  const boothTab=()=>{home();clearProfile();setProfile(null);};
  const toggleMic=async()=>{
    unlock();if(mic){audio.stopMicrophone();setMic(false);return;}
    const session=++micSession.current;
    setMicPending(true);try{const linked=await audio.startMicrophone();if(linked&&session===micSession.current){setMic(true);notify('MIC LINKED · Your voice now controls the party lights.');}}catch(e){if(session===micSession.current)notify(e.message||'Microphone unavailable. You can still sing along.');}finally{if(session===micSession.current)setMicPending(false);}
  };
  const chooseSong=e=>{
    e?.preventDefault();unlock();
    if(!isAlienFaceProfile(profile)){setDialog('register');return;}
    const videoId=parseYouTubeUrl(url);
    if(!videoId){setSongError('Paste a valid YouTube video link (youtube.com or youtu.be).');return;}
    finishRef.current=false;setSongError('');setSong({videoId,title:'Your intergalactic performance'});setVideoReady(false);setElapsed(0);setDuration(0);setPlaying(true);setMode('performance');setDialog(null);audio.effect('teleport');
  };
  const finish=useCallback(()=>{
    if(finishRef.current||!profile||!song)return;
    finishRef.current=true;
    const row={id:crypto.randomUUID(),profileId:profile.id,nickname:profile.nickname,photo:profile.photo,faceVersion:profile.faceVersion,faceMeta:profile.faceMeta,style:profile.style,song:song.title,videoId:song.videoId,score:randomScore(),createdAt:new Date().toISOString()};
    const save=addRecord(row);
    const combined=[...records.filter(r=>r.id!==row.id),row].sort((a,b)=>b.score-a.score||a.createdAt.localeCompare(b.createdAt));
    const latest=[row,...records.filter(r=>r.id!==row.id)].sort((a,b)=>b.createdAt.localeCompare(a.createdAt));
    setRecords(save?.ok?save.value:latest.slice(0,50));setResult({...row,rank:combined.findIndex(r=>r.id===row.id)+1,award:AWARDS[Math.floor(Math.random()*AWARDS.length)]});setMode('results');setCinema(false);micSession.current++;audio.stopMicrophone();setMic(false);setMicPending(false);
    if(save?.ok===false)notify(save.error);
  },[profile,song,records,notify]);
  const leavePerformance=()=>{unlock();setDialog('exit');};
  const stopPerformance=()=>{setMode('club');setDialog(null);setCinema(false);setSongError('');micSession.current++;audio.stopMicrophone();setMic(false);setMicPending(false);};
  const playPause=()=>{unlock();const p=playerRef.current;if(p?.getPlayerState?.()===1){p.pauseVideo();setPlaying(false);}else{p?.playVideo?.();setPlaying(true);}};
  const setTitle=useCallback(title=>setSong(s=>s?{...s,title:title||s.title}:s),[]);
  const onVideoError=useCallback(error=>{setSongError(error);setVideoReady(false);},[]);
  const onVideoReady=useCallback(()=>{setVideoReady(true);setSongError('');},[]);
  const rank=result?.rank||0;
  const formatTime=s=>`${Math.floor(s/60)}:${String(Math.floor(s%60)).padStart(2,'0')}`;
  const closeDialog=useCallback(()=>setDialog(null),[]);

  const gameRef=useRef(null);
  useLayoutEffect(()=>{
    const el=gameRef.current;if(!el)return;
    let raf=0;
    const fit=()=>{
      const vw=window.innerWidth,vh=window.innerHeight;
      if(vw<=760){el.classList.remove('fit','measure');el.style.removeProperty('--fit');el.style.removeProperty('--fit-w');return;}
      el.classList.add('fit','measure');
      let s=1;
      for(let i=0;i<4;i++){
        el.style.setProperty('--fit-w',`${vw/s}px`);
        const h=el.offsetHeight;
        const next=Math.max(.4,Math.min(1,vh/h));
        if(Math.abs(next-s)<.002){s=next;break;}
        s=next;
      }
      el.style.setProperty('--fit-w',`${vw/s}px`);
      el.style.setProperty('--fit-h',`${vh/s}px`);
      el.style.setProperty('--fit',String(s));
      el.classList.remove('measure');
    };
    const queue=()=>{cancelAnimationFrame(raf);raf=requestAnimationFrame(fit);};
    fit();
    window.addEventListener('resize',queue);
    document.fonts?.ready.then(queue);
    return()=>{window.removeEventListener('resize',queue);cancelAnimationFrame(raf);};
  },[mode,cinema,songError,reveal,result,profile,song]);

  return <div ref={gameRef} className={`game game-${mode} ${motion?'reduced-motion':''} ${cinema?'cinema':''}`}>
    <div className="world-wrap"><World mode={mode} profile={profile} levelRef={audio.levelRef} event={event} onTransitionComplete={enterClub} reducedMotion={motion}/></div>
    <div className="world-vignette"/><div className="scanlines" aria-hidden="true"/>
    <header className="header"><Brand onClick={mode==='performance'?leavePerformance:home}/><nav aria-label="Main navigation"><button className={mode==='menu'?'active':''} onClick={mode==='performance'?leavePerformance:boothTab}>THE BOOTH</button><button onClick={()=>{unlock();setDialog('leaderboard');}}>HALL OF FAME</button><button onClick={()=>{unlock();setDialog('help');}}>HOW TO PLAY <ArrowUpRight size={12}/></button></nav><div className="header-right"><span className="online"><i/> TRANSMITTING LIVE</span><button className="icon-button sound-toggle" onClick={()=>{audio.unlock();setMuted(!muted);}} aria-label={muted?'Enable game sound':'Mute game sound'} title={muted?'Enable game sound':'Mute game sound'}>{muted?<VolumeX size={18}/>:<Volume2 size={18}/>}</button><button className="icon-button" onClick={()=>setDialog('settings')} aria-label="Sound and motion settings"><span className="settings-symbol">≡</span></button></div></header>

    {mode==='menu'&&<main className="menu">
      <div className="hero-copy"><div className="edition"><span className="mini-star">✦</span> ALL SPECIES. ALL VOICES. ZERO SHAME.</div><h1>ALIEN<br/><span>KARAOKE</span><br/>BOOTH<span className="title-star" aria-hidden="true">✳</span></h1><p className="hero-description">Your face. A new species. One cosmic mic.<br/>The galaxy is ready for your questionable talent.</p><div className="hero-actions"><button className="primary-button" onClick={start}>{profile?'WELCOME BACK, EARTHLING':'GET ABDUCTED'} <ArrowUpRight size={23}/></button><button className="tour-button" onClick={()=>{unlock();setMode('club');}}><Play size={14} fill="currentColor"/> EXPLORE THE BOOTH</button></div><div className="entry-note"><span className="tiny-live"/> FREE ENTRY <span>·</span> NO TALENT REQUIRED <span>·</span> HEADPHONES RECOMMENDED</div></div>
      <div className="scene-label"><span className="live-dot"/> LIVE FROM SECTOR 07 <span className="label-divider">/</span> THE DISCO DIMENSION</div><div className="orbit-note"><span>CAUTION</span> UNUSUALLY<br/>GOOD VIBES <ArrowUpRight size={19}/></div>
      <section className="menu-bottom"><div className="board-card"><Board records={records} compact onExpand={()=>setDialog('leaderboard')}/></div><div className="welcome-channel"><span className="channel-tag">INCOMING TRANSMISSION</span><p>“We came for your planet.<br/><em>We stayed for the karaoke.”</em></p><span className="channel-credit">— BLORP, RESIDENT PARTY ORGANISM</span><div className="join-steps"><span><Camera size={16}/> SCAN YOUR FACE</span><MoveRight size={16}/><span><Sparkles size={16}/> BECOME ALIEN</span><MoveRight size={16}/><span><Mic2 size={16}/> MAKE NOISE</span></div></div><div className="human-stamp"><span>100%</span> HUMAN<br/>OPTIONAL<svg viewBox="0 0 70 15"><path d="m0 6 8 5 8-9 8 9 8-9 8 9 8-9 8 9 14-5" fill="none" stroke="currentColor" strokeWidth="2"/></svg></div></section>
    </main>}

    {mode==='abduction'&&<main className="abduction-hud"><div className="cinematic-top"><span>EARTH DEPARTURE SEQUENCE</span><span>PASSENGER 01 / {profile?.nickname.toUpperCase()}</span></div><div className="abduction-caption"><span className="eyebrow">CLOSE ENCOUNTERS OF THE LOUD KIND</span><h2>{abductionLines[abductionStep]}</h2><div className="abduction-progress"><span/></div><p>Your new alien identity is boarding.</p></div></main>}

    {mode==='club'&&<main className="club-ui"><div className="club-heading"><button className="back-link" onClick={home}><ChevronLeft size={16}/> BACK TO EARTH</button><span className="eyebrow"><i className="live-dot"/> THE DISCO DIMENSION · SECTOR 07</span><h1>THE MIC IS<br/><em>YOURS.</em></h1><p>{profile?`Looking extraterrestrial, ${profile.nickname}.`:'Take a look around, earthling.'}<br/>{profile?'Give the galaxy something to talk about.':'Your new species is just one selfie away.'}</p></div><section className="song-console"><div className="console-status"><Radio size={16}/><span>UPLINK READY</span><i/></div><h2>What are we singing?</h2><p>Bring any YouTube karaoke video to the mothership.</p><form onSubmit={chooseSong}><label htmlFor="song-url">YOUTUBE VIDEO LINK</label><div className="url-input"><Music2 size={18}/><input id="song-url" type="url" placeholder="https://youtube.com/watch?v=…" value={url} onChange={e=>{setUrl(e.target.value);setSongError('');}} autoComplete="off"/></div>{songError&&<p className="form-error" role="alert">{songError}</p>}<button className="primary-button" type="submit">{profile?'BEAM UP MY SONG':'CREATE YOUR ALIEN FIRST'} <ArrowUpRight size={21}/></button></form><button className={`mic-link ${mic?'linked':''}`} onClick={toggleMic} disabled={micPending}><Mic2 size={16}/>{micPending?'CONNECTING…':mic?'MIC LINKED · TAP TO DISCONNECT':'LINK YOUR MIC FOR REACTIVE LIGHTS'}{mic&&<Check size={14}/>}</button><div className="console-foot"><span>YOUTUBE POWERED</span><span>GOOD VIBES ONLY</span></div></section>{profile&&<div className="profile-chip"><AlienPortrait profile={profile} size={46}/><div><span>YOUR ALIEN IDENTITY</span><strong>{profile.nickname}</strong></div><button onClick={()=>setDialog('register')}>New alien <ArrowUpRight size={13}/></button></div>}</main>}

    {mode==='performance'&&<main className="performance-ui"><div className="performance-top"><span className="eyebrow"><i className="live-dot"/> LIVE ON THE MOTHERSHIP</span><div className="performance-top-actions"><button className="glass-button chaos-summon" disabled={!chaosEnabled||!!prank} onClick={summon} title={motion?'Turn off Gentle motion in settings to enable pranks':cinema?'Show the party to summon aliens':'Invite aliens to mess with the video'}><Sparkles size={14}/> SUMMON ALIENS</button><button className="glass-button" onClick={()=>setCinema(!cinema)}>{cinema?'SHOW THE PARTY':'FOCUS MODE'}</button></div></div><section className="performance-stage"><div className={`player-frame ${prank?`chaos-${prank.kind}`:''}`}><div className="player-header"><span><Radio size={14}/> GALACTIC BROADCAST</span><span>CH. 07 / ON AIR</span></div><YouTubePlayer videoId={song.videoId} onPlaybackState={setPlaying} onEnded={finish} onTitle={setTitle} onError={onVideoError} onReady={onVideoReady} playerRef={playerRef} volume={videoVolume}/><PlayerChaos prank={prank}/></div>{songError&&<div className="player-selection-error"><span>Having trouble with this transmission?</span><button className="text-button" onClick={stopPerformance}>Choose another song <ArrowRight size={14}/></button></div>}<div className="performance-info"><div className="performer"><AlienPortrait profile={profile} size={48}/><div><span>NOW PERFORMING / {profile.nickname}</span><strong>{song.title}</strong></div></div><span className="time-display">{formatTime(elapsed)} <span>/ {formatTime(duration)}</span></span></div><div className="performance-controls"><button className="play-control" disabled={!videoReady} onClick={playPause} aria-label={playing?'Pause video':'Play video'}>{playing?<Pause size={21}/>:<Play size={21}/>}</button><button className="icon-button" disabled={!videoReady} onClick={()=>{unlock();playerRef.current?.seekTo(0,true);playerRef.current?.playVideo();}} aria-label="Restart song"><RotateCcw size={18}/></button><label className="video-volume"><Volume2 size={17}/><input aria-label="YouTube volume" type="range" min="0" max="100" value={videoVolume} onChange={e=>setVideoVolume(Number(e.target.value))}/></label><div className="control-spacer"/><button className={`mic-control ${mic?'linked':''}`} onClick={toggleMic} disabled={micPending}><Mic2 size={17}/><span>{micPending?'LINKING…':mic?'MIC ON':'LINK MIC'}</span></button><button className="exit-control" onClick={leavePerformance}><LogOut size={17}/><span>EXIT</span></button></div><p className="performance-note">Sing your heart out. Your score is a silly arcade souvenir, not a measurement of your singing.</p></section><div className="performer-world-label"><span className="live-dot"/> {profile.nickname.toUpperCase()}<span>EARTH'S FINEST EXPORT</span></div></main>}

    {mode==='results'&&result&&<main className="results-ui"><section className={`results-card ${reveal?'revealed':''}`}><span className="eyebrow"><Trophy size={15}/> THE INTERGALACTIC AWARD CEREMONY</span><h1>{reveal?'ABSOLUTELY':'THE JUDGES ARE'}<br/><em>{reveal?'OTHERWORLDLY.':'COMMUNICATING…'}</em></h1><div className="result-score" aria-live="polite">{reveal?result.score:'??'}<span>/100</span></div><span className="award-label">{reveal?result.award:'Decoding the cosmic verdict…'}</span><div className="winner-name"><AlienPortrait profile={profile} size={58}/><div><strong>{profile.nickname}</strong><span>{result.song}</span></div><b>#{rank||1}<small>GALACTIC RANK</small></b></div><p className="score-note">Awarded by a deeply unqualified alien jury.<br/>Every singer is a star in this galaxy.</p><div className="result-actions"><button className="primary-button" onClick={()=>{unlock();setMode('club');setSongError('');}}>SING ANOTHER <Mic2 size={20}/></button><button className="glass-button" onClick={home}>BACK TO EARTH <ArrowUpRight size={18}/></button></div><button className="text-button" onClick={()=>setDialog('leaderboard')}>Meet the galactic hall of fame <ArrowRight size={15}/></button></section></main>}

    {event&&['club','performance'].includes(mode)&&<div className="event-toast" role="status"><Sparkles size={16}/>{event.text}</div>}
    {mode!=='performance'&&<footer className="footer"><span><i/> EARTH CONNECTION STABLE</span><span>EST. 2003 IN A GALAXY FAR, FAR WEIRDER.</span><button onClick={()=>setDialog('help')}>INSERT PERSONALITY. PRESS START. <ArrowUpRight size={12}/></button></footer>}
    {toast&&<div className="system-toast" role="status">{toast}<button onClick={()=>setToast('')} aria-label="Dismiss message"><X size={15}/></button></div>}

    {dialog==='register'&&<Registration profile={profile} onComplete={completeRegistration} onCancel={closeDialog} onSound={name=>{audio.unlock();audio.effect(name);}}/>}
    {dialog==='leaderboard'&&<Modal label="Hall of Fame" onClose={closeDialog} wide gallery><HallOfFame records={records} reducedMotion={motion}/></Modal>}
    {dialog==='help'&&<Modal label="How to play" onClose={closeDialog}><span className="eyebrow">EARTHLING FIELD GUIDE / 001</span><h2>SMALL SONG.<br/><em>GIANT LEAP.</em></h2><div className="guide-step"><b>01</b><Camera/><div><h3>Become one of us.</h3><p>Choose a nickname and take or upload a face photo. A local face scanner gives you an alien face. Customize your color, outfit and headgear in the 3D preview.</p></div></div><div className="guide-step"><b>02</b><Radio/><div><h3>Get wonderfully abducted.</h3><p>Your ride is a UFO. Your destination is the least sensible nightclub in the galaxy.</p></div></div><div className="guide-step"><b>03</b><Mic2/><div><h3>Make some cosmic noise.</h3><p>Paste a YouTube karaoke link. Link your mic for dancing lights. Sing along and collect your ridiculous award when the song ends.</p></div></div><p className="privacy-note">Photos and scores stay in this browser. Microphone audio is analyzed locally and never recorded. YouTube needs an internet connection; some videos cannot be embedded.</p><button className="primary-button" onClick={()=>{setDialog(null);start();}}>I WAS BORN FOR THIS <ArrowUpRight size={20}/></button></Modal>}
    {dialog==='settings'&&<Modal label="Sound and motion settings" onClose={closeDialog}><span className="eyebrow">MOTHERSHIP CONTROLS</span><h2>SET YOUR<br/><em>FREQUENCY.</em></h2><div className="setting-row"><div><h3>Arcade sound</h3><p>Music, alien chatter & cosmic effects</p></div><button className={`toggle ${!muted?'on':''}`} aria-label="Arcade sound" aria-pressed={!muted} onClick={()=>{audio.unlock();setMuted(!muted);}}><span/></button></div><label className="setting-volume">GAME VOLUME <b>{Math.round(volume*100)}%</b><input aria-label="Game sound volume" type="range" min="0" max="1" step=".01" value={volume} onChange={e=>setVolume(Number(e.target.value))}/></label><div className="setting-row"><div><h3>Gentle motion</h3><p>Calmer dancing and fewer light effects</p></div><button className={`toggle ${motion?'on':''}`} aria-label="Gentle motion" aria-pressed={motion} onClick={()=>setMotion(!motion)}><span/></button></div><p className="privacy-note">YouTube playback volume has its own control on the karaoke screen. Your preferences are saved on this device.</p></Modal>}
    {dialog==='exit'&&<Modal label="Leave this performance" onClose={closeDialog}><span className="eyebrow">HOLD THE SPACE PHONE</span><h2>LEAVING<br/><em>SO SOON?</em></h2><p>The song will stop. Finish a full video to receive an award and a leaderboard score.</p><button className="primary-button" onClick={closeDialog}>KEEP SINGING <Mic2 size={19}/></button><button className="text-button exit-confirm" onClick={stopPerformance}>Leave the stage <LogOut size={16}/></button></Modal>}
  </div>;
}
