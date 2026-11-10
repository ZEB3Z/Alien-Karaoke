import React, { useCallback, useEffect, useRef, useState } from 'react';
import './player-chaos.css';

// Simple glitch effects only. They are drawn in a transparent overlay that sits ON TOP of the
// YouTube player. They never transform, filter, blend, clone, pause, or otherwise touch the
// player or any of its ancestors, so the video can never vanish while a glitch is playing.
export const PLAYER_PRANKS = ['rgb', 'tear', 'static', 'flicker'];
export const PRANK_DURATION_MS = 1300;

const PRANK_LABELS = {
  rgb: 'SIGNAL DRIFT',
  tear: 'FRAME TEAR',
  static: 'ALIEN STATIC',
  flicker: 'SIGNAL LOST',
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
    // Occasional short glitches at non-overlapping intervals.
    let timer;
    const queue = (first = false) => {
      timer = window.setTimeout(() => {
        if (document.visibilityState !== 'hidden') summon();
        queue();
      }, first ? 7000 + Math.random() * 5000 : 14000 + Math.random() * 12000);
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

/** Purely decorative overlay. Pointer events pass straight through to YouTube.
 * No video, iframe, filter, blend mode, or transform on the player: only small flat-colour
 * bars that animate their own opacity/transform inside a clipped, transparent layer.
 */
export default function PlayerChaos({ prank }) {
  if (!prank) return null;
  const { kind } = prank;
  return <div className={`player-chaos-layer player-chaos--${kind}`} aria-hidden="true" key={prank.id}>
    <div className="glitch-scanlines" />
    <div className="glitch-tint glitch-tint--cyan" />
    <div className="glitch-tint glitch-tint--magenta" />
    <div className="glitch-bar glitch-bar--1" />
    <div className="glitch-bar glitch-bar--2" />
    <div className="glitch-bar glitch-bar--3" />
    <div className="glitch-bar glitch-bar--4" />
    <div className="glitch-bar glitch-bar--5" />
    <span className="glitch-tag">▒ {PRANK_LABELS[kind]}</span>
  </div>;
}
