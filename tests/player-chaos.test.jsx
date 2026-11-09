import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, renderHook } from '@testing-library/react';
import PlayerChaos, { PLAYER_PRANKS, PRANK_DURATION_MS, usePlayerChaos } from '../src/PlayerChaos.jsx';

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('nonblocking YouTube player pranks', () => {
  it('automatically starts and cleans up short effects, without overlapping events', () => {
    vi.useFakeTimers();
    vi.spyOn(Math, 'random').mockReturnValue(0);
    const { result } = renderHook(() => usePlayerChaos(true, 'videoA'));
    expect(result.current.prank).toBeNull();
    act(() => vi.advanceTimersByTime(9500));
    expect(result.current.prank.kind).toBe('grab');
    act(() => vi.advanceTimersByTime(PRANK_DURATION_MS));
    expect(result.current.prank).toBeNull();
    act(() => vi.advanceTimersByTime(22000 - PRANK_DURATION_MS));
    expect(result.current.prank.kind).toBe('shake');
  });

  it('stops animating during pause, focus mode, or gentle motion and resets on new song', () => {
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

  it('renders graphics that are decorative, inaccessible to pointer input, and do not contain video elements', () => {
    const { container, rerender } = render(<PlayerChaos prank={{ kind: 'abduct', id: 'ufo-1' }} />);
    const overlay = container.querySelector('.player-chaos-layer');
    expect(overlay.getAttribute('aria-hidden')).toBe('true');
    expect(overlay.querySelector('.chaos-ufo')).not.toBeNull();
    expect(overlay.querySelector('.chaos-tractor-beam')).not.toBeNull();
    expect(overlay.querySelector('iframe,video,audio,button')).toBeNull();
    rerender(<PlayerChaos prank={null} />);
    expect(container.querySelector('.player-chaos-layer')).toBeNull();
  });
});
