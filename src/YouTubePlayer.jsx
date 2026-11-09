import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AlertTriangle, LoaderCircle, RotateCcw } from 'lucide-react';
import './media.css';

let youtubePromise;

export function parseYouTubeUrl(input) {
  if (typeof input !== 'string' || !input.trim()) return null;
  let value = input.trim();
  if (/^(www\.|m\.)?(youtube\.com|youtu\.be)\//i.test(value)) value = `https://${value}`;
  let url;
  try { url = new URL(value); } catch { return null; }
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) return null;
  const host = url.hostname.toLowerCase();
  let id;
  if (host === 'youtu.be' || host === 'www.youtu.be') id = url.pathname.split('/')[1];
  else if (['youtube.com', 'www.youtube.com', 'm.youtube.com', 'music.youtube.com', 'youtube-nocookie.com', 'www.youtube-nocookie.com'].includes(host)) {
    const path = url.pathname.split('/').filter(Boolean);
    if (path[0] === 'watch') id = url.searchParams.get('v');
    else if (['embed', 'shorts', 'live', 'v'].includes(path[0])) id = path[1];
  }
  return typeof id === 'string' && /^[a-zA-Z0-9_-]{11}$/.test(id) ? id : null;
}

function loadYouTubeAPI() {
  if (window.YT?.Player) return Promise.resolve(window.YT);
  if (youtubePromise) return youtubePromise;
  youtubePromise = new Promise((resolve, reject) => {
    let finished = false;
    let timer;
    let poll;
    const complete = () => {
      if (finished || !window.YT?.Player) return;
      finished = true;
      clearTimeout(timer);
      clearInterval(poll);
      resolve(window.YT);
    };
    const fail = () => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      clearInterval(poll);
      youtubePromise = undefined;
      reject(new Error('YouTube could not be reached. Check your connection or allow YouTube in your browser.'));
    };
    const previous = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => { try { previous?.(); } finally { complete(); } };
    let script = document.querySelector('script[data-alien-youtube-api]');
    if (!script) {
      script = document.createElement('script');
      script.src = 'https://www.youtube.com/iframe_api';
      script.async = true;
      script.dataset.alienYoutubeApi = 'true';
      document.head.appendChild(script);
    }
    script.addEventListener('error', () => { script.remove(); fail(); }, { once: true });
    poll = setInterval(complete, 150);
    timer = setTimeout(fail, 18000);
    complete();
  });
  return youtubePromise;
}

const errors = {
  2: 'This video link is invalid. Return to song selection and choose another YouTube URL.',
  5: 'This video cannot play in this browser. Try another video or a different browser.',
  100: 'This video is unavailable, private, or has been removed. Choose another song.',
  101: 'The video owner has disabled embedded playback. Choose another karaoke video.',
  150: 'The video owner has disabled embedded playback. Choose another karaoke video.',
  153: 'YouTube could not verify this browser session. Try allowing third-party video playback or choose another video.',
};

// Comedic overlay "gags" that alien-handle the player from the outside. These only ever
// animate CSS transforms/opacity on elements layered OVER the iframe — the host div, the
// iframe itself and the YouTube API instance are never touched, so playback never stops.
const GAG_TYPES = ['shake', 'tilt', 'steal', 'ufo'];
const GAG_DURATIONS = { shake: 2200, tilt: 2600, steal: 3400, ufo: 4600 };
const GAG_CAPTIONS = {
  shake: 'HEY — LET GO OF THAT!',
  tilt: 'JUST TILTING IT FOR A BETTER ANGLE…',
  steal: "IT WON'T FIT IN THE UFO, BLORP.",
  ufo: 'ABDUCTION ABORTED: SIGNAL TOO GROOVY.',
};

function AlienClaw({ flip = false }) {
  return (
    <svg viewBox="0 0 140 60" className="mischief-claw-svg" aria-hidden="true" focusable="false" style={flip ? { transform: 'scaleX(-1)' } : undefined}>
      <rect x="0" y="22" width="92" height="18" rx="9" fill="#8fce52" />
      <circle cx="104" cy="31" r="21" fill="#9bda5c" stroke="#5f9335" strokeWidth="2" />
      <ellipse cx="126" cy="13" rx="8" ry="14" fill="#9bda5c" stroke="#5f9335" strokeWidth="1.5" transform="rotate(25 126 13)" />
      <ellipse cx="130" cy="31" rx="8" ry="15" fill="#9bda5c" stroke="#5f9335" strokeWidth="1.5" />
      <ellipse cx="126" cy="49" rx="8" ry="14" fill="#9bda5c" stroke="#5f9335" strokeWidth="1.5" transform="rotate(-25 126 49)" />
    </svg>
  );
}

function AlienBurglar() {
  return (
    <svg viewBox="0 0 100 140" className="mischief-burglar-svg" aria-hidden="true" focusable="false">
      <rect x="30" y="68" width="40" height="56" rx="18" fill="#8fce52" />
      <ellipse cx="50" cy="38" rx="34" ry="38" fill="#9bda5c" stroke="#5f9335" strokeWidth="2" />
      <ellipse cx="34" cy="36" rx="9" ry="14" fill="#10152a" transform="rotate(-20 34 36)" />
      <ellipse cx="66" cy="36" rx="9" ry="14" fill="#10152a" transform="rotate(20 66 36)" />
      <path d="M38 58 q12 10 24 0" stroke="#10152a" strokeWidth="3" fill="none" strokeLinecap="round" />
    </svg>
  );
}

function UfoGraphic() {
  return (
    <svg viewBox="0 0 160 90" className="mischief-ufo-svg" aria-hidden="true" focusable="false">
      <ellipse cx="80" cy="42" rx="78" ry="15" fill="#b0becb" />
      <ellipse cx="80" cy="34" rx="46" ry="26" fill="#e8c5ef" stroke="#c89cf0" strokeWidth="2" />
      <ellipse cx="80" cy="46" rx="60" ry="9" fill="#71699a" />
      {[20, 50, 80, 110, 140].map((x, i) => <circle key={x} cx={x} cy="45" r="5" fill={i % 2 ? '#f780d3' : '#c4fa9c'} />)}
    </svg>
  );
}

function MischiefLayer({ type }) {
  return (
    <div className={`alien-mischief-layer mischief-${type}`} aria-hidden="true">
      {type === 'shake' && <>
        <div className="mischief-hand mischief-hand-left" style={{ animationDuration: `${GAG_DURATIONS.shake}ms` }}><AlienClaw /></div>
        <div className="mischief-hand mischief-hand-right" style={{ animationDuration: `${GAG_DURATIONS.shake}ms` }}><AlienClaw flip /></div>
        <span className="mischief-caption" style={{ animationDuration: `${GAG_DURATIONS.shake}ms` }}>{GAG_CAPTIONS.shake}</span>
      </>}
      {type === 'tilt' && <>
        <div className="mischief-hand mischief-hand-corner" style={{ animationDuration: `${GAG_DURATIONS.tilt}ms` }}><AlienClaw /></div>
        <span className="mischief-caption" style={{ animationDuration: `${GAG_DURATIONS.tilt}ms` }}>{GAG_CAPTIONS.tilt}</span>
      </>}
      {type === 'steal' && <>
        <div className="mischief-burglar" style={{ animationDuration: `${GAG_DURATIONS.steal}ms` }}><AlienBurglar /></div>
        <span className="mischief-caption" style={{ animationDuration: `${GAG_DURATIONS.steal}ms` }}>{GAG_CAPTIONS.steal}</span>
      </>}
      {type === 'ufo' && <>
        <div className="mischief-ufo" style={{ animationDuration: `${GAG_DURATIONS.ufo}ms` }}>
          <UfoGraphic />
          <div className="mischief-ufo-beam" style={{ animationDuration: `${GAG_DURATIONS.ufo}ms` }} />
        </div>
        <span className="mischief-caption mischief-caption-ufo" style={{ animationDuration: `${GAG_DURATIONS.ufo}ms` }}>{GAG_CAPTIONS.ufo}</span>
      </>}
    </div>
  );
}

export default function YouTubePlayer({ videoId, onEnded, onTitle, onError, onReady, playerRef, volume = 75, reducedMotion = false }) {
  const hostRef = useRef(null);
  const instanceRef = useRef(null);
  const callbacksRef = useRef({ onEnded, onTitle, onError, onReady });
  callbacksRef.current = { onEnded, onTitle, onError, onReady };
  const volumeRef = useRef(volume);
  volumeRef.current = volume;
  const [state, setState] = useState('loading');
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  const [title, setTitle] = useState('Your intergalactic performance');
  const [gag, setGag] = useState(null);
  const reducedMotionRef = useRef(reducedMotion);
  reducedMotionRef.current = reducedMotion;

  const reportError = useCallback((message) => {
    setError(message);
    setState('error');
    callbacksRef.current.onError?.(message);
  }, []);

  useEffect(() => {
    let alive = true;
    let readyTimer;
    setState('loading');
    setError('');
    if (!/^[a-zA-Z0-9_-]{11}$/.test(videoId || '')) { reportError('Choose a valid YouTube video to begin.'); return; }
    const container = document.createElement('div');
    hostRef.current?.replaceChildren(container);
    loadYouTubeAPI().then((YT) => {
      if (!alive || !container.isConnected) return;
      readyTimer = setTimeout(() => { if (alive) reportError('The YouTube player is taking too long to respond. Retry, or choose another song.'); }, 20000);
      const player = new YT.Player(container, {
        width: '100%', height: '100%', videoId,
        playerVars: { autoplay: 1, controls: 1, rel: 0, playsinline: 1, enablejsapi: 1, origin: window.location.origin, cc_load_policy: 1 },
        events: {
          onReady: (event) => {
            if (!alive) return;
            clearTimeout(readyTimer);
            event.target.setVolume(Math.max(0, Math.min(100, volumeRef.current)));
            event.target.getIframe()?.setAttribute('title', 'YouTube karaoke video player');
            event.target.getIframe()?.setAttribute('allow', 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share; fullscreen');
            const videoTitle = event.target.getVideoData?.()?.title;
            if (videoTitle) { setTitle(videoTitle); callbacksRef.current.onTitle?.(videoTitle); }
            setState('ready');
            callbacksRef.current.onReady?.(event.target);
          },
          onStateChange: (event) => {
            if (!alive) return;
            if (event.data === YT.PlayerState.ENDED) callbacksRef.current.onEnded?.();
            if (event.data === YT.PlayerState.PLAYING) {
              clearTimeout(readyTimer);
              setState('playing');
              const videoTitle = event.target.getVideoData?.()?.title;
              if (videoTitle) { setTitle(videoTitle); callbacksRef.current.onTitle?.(videoTitle); }
            }
            if (event.data === YT.PlayerState.PAUSED) setState('paused');
          },
          onError: (event) => { if (alive) { clearTimeout(readyTimer); reportError(errors[event.data] || 'YouTube could not play this video. Try another karaoke song.'); } },
          onAutoplayBlocked: () => { if (alive) setState('ready'); },
        },
      });
      instanceRef.current = player;
      if (playerRef) playerRef.current = player;
    }).catch((err) => { if (alive) reportError(err.message); });
    return () => {
      alive = false;
      clearTimeout(readyTimer);
      try { instanceRef.current?.destroy?.(); } catch { /* player may already have detached */ }
      instanceRef.current = null;
      if (playerRef) playerRef.current = null;
    };
  }, [videoId, retry, reportError, playerRef]);

  useEffect(() => {
    try { instanceRef.current?.setVolume?.(Math.max(0, Math.min(100, volume))); } catch { /* API is still initializing */ }
  }, [volume]);

  // Purely cosmetic alien antics layered over the player. Never reaches into the YT
  // instance, the iframe or its host div, so actual video/audio playback is untouched.
  useEffect(() => {
    if (state !== 'playing') { setGag(null); return undefined; }
    let scheduleTimer;
    let clearTimer;
    const scheduleNext = () => {
      scheduleTimer = setTimeout(() => {
        if (!reducedMotionRef.current && !document.hidden) {
          const type = GAG_TYPES[Math.floor(Math.random() * GAG_TYPES.length)];
          setGag({ type, id: Date.now() });
          clearTimer = setTimeout(() => setGag(null), GAG_DURATIONS[type]);
        }
        scheduleNext();
      }, 12000 + Math.random() * 9000);
    };
    scheduleNext();
    return () => { clearTimeout(scheduleTimer); clearTimeout(clearTimer); setGag(null); };
  }, [state]);

  return <div className={`alien-youtube-frame ${gag ? `mischief-${gag.type}` : ''}`} style={gag ? { animationDuration: `${GAG_DURATIONS[gag.type]}ms` } : undefined}>
    <div className="alien-youtube" aria-label={title}>
      <div className="alien-youtube-host" ref={hostRef} />
      {state === 'loading' && <div className="alien-player-loading" role="status"><LoaderCircle size={30} className="reg-spin" /><strong>CONTACTING EARTH…</strong><span>Loading your YouTube transmission</span></div>}
      {state === 'error' && <div className="alien-player-error" role="alert"><AlertTriangle size={28} /><strong>TRANSMISSION INTERRUPTED</strong><p>{error}</p><button type="button" onClick={() => setRetry((value) => value + 1)}><RotateCcw size={15} /> RETRY TRANSMISSION</button><span>Use Exit to choose a different song.</span></div>}
      <span className="sr-only" role="status">{state === 'ready' ? 'Player ready. Press play on the video if autoplay is blocked.' : state === 'playing' ? `Playing ${title}` : state === 'paused' ? 'Video paused' : ''}</span>
    </div>
    {gag && <MischiefLayer type={gag.type} />}
  </div>;
}
