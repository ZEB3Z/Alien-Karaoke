import React, { useCallback, useEffect, useRef, useState } from 'react';
import './player-chaos.css';

// Decorative effects only: never call, replace, or cover the YouTube API player.
export const PLAYER_PRANKS = ['grab', 'shake', 'rotate', 'steal', 'abduct', 'portal', 'shrink', 'stampede'];
export const PRANK_DURATION_MS = 3400;

const PRANK_LABELS = {
  grab: 'UNAUTHORIZED SCREEN HUG',
  shake: 'SHAKE TO UNLOCK THE MOON',
  rotate: 'TECH SUPPORT: TRY SPINNING IT',
  steal: 'WE ARE BORROWING YOUR TV',
  abduct: 'SIGNAL ABDUCTION IN PROGRESS',
  portal: 'ILLEGAL WORMHOLE / NO REFUNDS',
  shrink: 'DID ANYONE ORDER POCKET-SIZE TV?',
  stampede: 'EMERGENCY: THREE ALIENS, ONE SCREEN',
};

export function usePlayerChaos(enabled, videoId) {
  const [prank, setPrank] = useState(null);
  const lastPrank = useRef(null);
  const activeUntil = useRef(0);
  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;

  const summon = useCallback(() => {
    if (!enabledRef.current || Date.now() < activeUntil.current) return;
    activeUntil.current = Date.now() + PRANK_DURATION_MS;
    const choices = PLAYER_PRANKS.filter((kind) => kind !== lastPrank.current);
    const kind = choices[Math.floor(Math.random() * choices.length)];
    lastPrank.current = kind;
    setPrank({ kind, id: `${Date.now()}-${Math.random()}` });
  }, []);

  useEffect(() => {
    lastPrank.current = null;
    activeUntil.current = 0;
    setPrank(null);
  }, [videoId]);

  useEffect(() => {
    if (!enabled) {
      activeUntil.current = 0;
      setPrank(null);
      return;
    }
    // First surprise arrives quickly; repeat at comfortable, non-overlapping intervals.
    let timer;
    const queue = (first = false) => {
      timer = window.setTimeout(() => {
        if (document.visibilityState !== 'hidden') summon();
        queue();
      }, first ? 9500 + Math.random() * 5500 : 22000 + Math.random() * 11000);
    };
    queue(true);
    return () => window.clearTimeout(timer);
  }, [enabled, videoId, summon]);

  useEffect(() => {
    if (!prank) return;
    const timer = window.setTimeout(() => setPrank((current) => current?.id === prank.id ? null : current), PRANK_DURATION_MS);
    return () => window.clearTimeout(timer);
  }, [prank]);

  return { prank, summon };
}

function LittleAlien({ side = 'left', color = 'lime' }) {
  return <svg className={`chaos-alien chaos-alien--${side} chaos-alien--${color}`} viewBox="0 0 136 172" aria-hidden="true" focusable="false">
    <g className="chaos-alien-body">
      <path className="chaos-leg chaos-leg--left" d="M55 126 44 151 34 156" stroke="#91cf53" strokeWidth="13" strokeLinecap="round" fill="none" />
      <path className="chaos-leg chaos-leg--right" d="M82 127 93 154 104 158" stroke="#91cf53" strokeWidth="13" strokeLinecap="round" fill="none" />
      <path d="M49 102Q38 118 47 138L90 138Q100 113 84 102Z" fill="#6bb946" stroke="#234832" strokeWidth="3" />
      <path d="M67 104 54 128 81 128Z" fill="#b6f16d" opacity=".48" />
      <path className="chaos-arm chaos-arm--left" d="M50 113Q22 112 20 83L8 77" fill="none" stroke="#80cc4b" strokeWidth="12" strokeLinecap="round" />
      <path className="chaos-arm chaos-arm--right" d="M85 110Q108 107 110 81L125 73" fill="none" stroke="#80cc4b" strokeWidth="12" strokeLinecap="round" />
      <path d="M20 77 10 65M18 76 2 76M18 78 12 90M118 74 128 58M118 74 134 72M118 74 129 85" stroke="#a5ec63" strokeWidth="5" strokeLinecap="round" />
      <path d="M66 14Q21 1 13 47Q8 86 40 106Q59 121 70 117Q103 106 116 67Q136 20 92 15Q78 10 66 14Z" fill="#9cdd64" stroke="#24472d" strokeWidth="3" />
      <path d="M66 17Q25 14 22 55L42 87 64 71 77 19Z" fill="#c6f58a" opacity=".42" />
      <path d="M25 57Q29 37 54 46Q65 56 57 78Q36 94 25 57ZM77 48Q102 34 110 56Q111 78 90 82Q76 74 77 48Z" fill="#171d32" stroke="#263f27" strokeWidth="2" />
      <path d="M35 53 46 49M86 48 98 52" stroke="#adcefb" strokeWidth="3" strokeLinecap="round" opacity=".7" />
      <path d="M53 92Q68 105 86 89" fill="none" stroke="#315139" strokeWidth="4" strokeLinecap="round" />
      <path d="m58 94 4 5m19-7-4 6" stroke="#f2fcdf" strokeWidth="3" />
      <path d="M52 11 43 2M84 12 93 2" stroke="#84c95a" strokeWidth="4" strokeLinecap="round" />
    </g>
  </svg>;
}

function Saucer() {
  return <svg className="chaos-ufo" viewBox="0 0 230 125" aria-hidden="true" focusable="false">
    <ellipse cx="115" cy="82" rx="97" ry="22" fill="#11192d" opacity=".4" />
    <path d="M58 68Q65 15 114 9Q169 12 174 68" fill="#a3fae1" stroke="#6e7fc0" strokeWidth="5" />
    <path d="M81 51Q94 18 128 22" fill="none" stroke="#e8fff3" strokeWidth="9" strokeLinecap="round" opacity=".7" />
    <path d="M30 70Q61 48 115 49Q169 48 202 70L218 83Q171 112 113 113Q57 110 13 82Z" fill="#8f75c8" stroke="#35284c" strokeWidth="5" />
    <path d="M18 82Q114 119 212 82L198 94Q120 129 34 94Z" fill="#533a83" />
    <ellipse cx="114" cy="74" rx="104" ry="18" fill="#b2a5e7" stroke="#39305c" strokeWidth="5" />
    <g fill="#dcff65" stroke="#4a6e36" strokeWidth="3"><circle cx="46" cy="78" r="9"/><circle cx="90" cy="88" r="9"/><circle cx="138" cy="88" r="9"/><circle cx="182" cy="78" r="9"/></g>
    <path d="M96 58Q114 41 135 58" fill="none" stroke="#25354a" strokeWidth="6" strokeLinecap="round" />
    <circle cx="159" cy="37" r="5" fill="#fefb98" />
  </svg>;
}

const PRANK_COMICS = {
  grab: 'YOINK!', shake: 'BLORP BLORP!', rotate: 'WHEEEEE!',
  steal: 'MINE NOW!', abduct: 'BEAM ME UP!', portal: 'WRONG DIMENSION!',
  shrink: 'TINY TV!', stampede: 'RUN, GREG!',
};

/** Never clone, replace, crop, remount, pause, or capture the real YouTube iframe.
 * The "stolen screen" below is intentionally an empty translucent outline.
 * Every pixel is decorative, all pointers pass straight through to YouTube.
 */
export default function PlayerChaos({ prank }) {
  if (!prank) return null;
  const { kind } = prank;
  return <div className={`player-chaos-layer player-chaos--${kind}`} aria-hidden="true" key={prank.id}>
    <span className="chaos-edge chaos-edge--top" />
    <span className="chaos-edge chaos-edge--bottom" />
    {['grab', 'steal', 'portal', 'shrink', 'abduct'].includes(kind) && <div className="chaos-ghost-screen"><span className="chaos-ghost-label">PROPERTY OF BLORP</span><span className="chaos-ghost-play">▶</span><i /></div>}
    {['grab', 'steal', 'shake'].includes(kind) && <>
      <LittleAlien side="left" />
      <LittleAlien side="right" color="violet" />
    </>}
    {kind === 'rotate' && <LittleAlien side="left" />}
    {['abduct', 'portal', 'shrink'].includes(kind) && <>
      <div className="chaos-tractor-beam" />
      <Saucer />
      <LittleAlien side="right" color="violet" />
    </>}
    {kind === 'stampede' && <div className="chaos-stampede-crew"><LittleAlien side="left" /><LittleAlien side="left" color="violet" /><LittleAlien side="left" /></div>}
    {['portal', 'shrink'].includes(kind) && <div className="chaos-portal-ring"><div className="chaos-portal-ring-inner" /></div>}
    {kind === 'rotate' && <div className="chaos-gyro"><span>ANTI-GRAVITY / 0.7G</span></div>}
    {kind === 'shake' && <div className="chaos-quake"><i /><i /><i /><i /><i /></div>}
    {kind === 'stampede' && <div className="chaos-dust"><i /><i /><i /><i /></div>}
    <div className="chaos-static chaos-static--one" />
    <div className="chaos-static chaos-static--two" />
    <div className="chaos-static chaos-static--three" />
    <span className="chaos-warning"><span className="chaos-warning-dot" /> {PRANK_LABELS[kind]}</span>
    <span className="chaos-comic">{PRANK_COMICS[kind]}</span>
  </div>;
}
