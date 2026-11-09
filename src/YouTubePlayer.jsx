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

export default function YouTubePlayer({ videoId, onEnded, onTitle, onError, onReady, playerRef, volume = 75 }) {
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

  return <div className="alien-youtube" aria-label={title}>
    <div className="alien-youtube-host" ref={hostRef} />
    {state === 'loading' && <div className="alien-player-loading" role="status"><LoaderCircle size={30} className="reg-spin" /><strong>CONTACTING EARTH…</strong><span>Loading your YouTube transmission</span></div>}
    {state === 'error' && <div className="alien-player-error" role="alert"><AlertTriangle size={28} /><strong>TRANSMISSION INTERRUPTED</strong><p>{error}</p><button type="button" onClick={() => setRetry((value) => value + 1)}><RotateCcw size={15} /> RETRY TRANSMISSION</button><span>Use Exit to choose a different song.</span></div>}
    <span className="sr-only" role="status">{state === 'ready' ? 'Player ready. Press play on the video if autoplay is blocked.' : state === 'playing' ? `Playing ${title}` : state === 'paused' ? 'Video paused' : ''}</span>
  </div>;
}
