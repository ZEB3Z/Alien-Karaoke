import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, renderHook } from '@testing-library/react';
import PlayerChaos, { PLAYER_PRANKS, PRANK_DURATION_MS, usePlayerChaos } from '../src/PlayerChaos.jsx';

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('nonblocking YouTube player glitches', () => {
  it('automatically starts and cleans up short glitches, without overlapping events', () => {
    vi.useFakeTimers();
    vi.spyOn(Math, 'random').mockReturnValue(0);
    const { result } = renderHook(() => usePlayerChaos(true, 'videoA'));
    expect(result.current.prank).toBeNull();
    act(() => vi.advanceTimersByTime(7000));
    expect(result.current.prank.kind).toBe('rgb');
    act(() => vi.advanceTimersByTime(PRANK_DURATION_MS));
    expect(result.current.prank).toBeNull();
    act(() => vi.advanceTimersByTime(14000 - PRANK_DURATION_MS));
    expect(result.current.prank.kind).toBe('tear');
  });

  it('stops glitching during pause, focus mode, or gentle motion and resets on new song', () => {
    vi.useFakeTimers();
    vi.spyOn(Math, 'random').mockReturnValue(0);
    const { result, rerender } = renderHook(({ enabled, videoId }) => usePlayerChaos(enabled, videoId), {
      initialProps: { enabled: true, videoId: 'videoA' },
    });
    act(() => result.current.summon());
    expect(PLAYER_PRANKS).toContain(result.current.prank.kind);
    rerender({ enabled: false, videoId: 'videoA' });
    expect(result.current.prank).toBeNull();
    act(() => vi.advanceTimersByTime(45000));
    expect(result.current.prank).toBeNull();
    rerender({ enabled: true, videoId: 'videoB' });
    expect(result.current.prank).toBeNull();
  });

  it('renders a decorative overlay that is hidden from assistive tech and holds no media elements', () => {
    const { container, rerender } = render(<PlayerChaos prank={{ kind: 'tear', id: 'glitch-1' }} />);
    const overlay = container.querySelector('.player-chaos-layer');
    expect(overlay.getAttribute('aria-hidden')).toBe('true');
    expect(overlay.querySelector('.glitch-bar')).not.toBeNull();
    expect(overlay.querySelector('iframe,video,audio,button')).toBeNull();
    rerender(<PlayerChaos prank={null} />);
    expect(container.querySelector('.player-chaos-layer')).toBeNull();
  });
});
