import React, { useEffect } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { STORAGE_KEYS, loadProfile, loadRecords, saveProfile } from '../src/storage.js';

const filterMock = vi.hoisted(() => ({ transform: vi.fn() }));
vi.mock('../src/face/faceFilter.js', () => ({ transformAlienFace: filterMock.transform }));

const playerMock = vi.hoisted(() => ({ handlers: null, api: null, real: false }));
const audioMock = vi.hoisted(() => ({
  unlock: vi.fn(), effect: vi.fn(), setVolume: vi.fn(), setMuted: vi.fn(), setScene: vi.fn(),
  stopMicrophone: vi.fn(), startMicrophone: vi.fn(), dispose: vi.fn(), levelRef: { current: 0 },
}));

vi.mock('../src/audio.js', () => ({ default: audioMock }));
vi.mock('../src/World.jsx', () => ({
  default: function TestWorld({ mode, profile, onTransitionComplete }) {
    useEffect(() => {
      if (mode !== 'abduction') return;
      const timer = setTimeout(onTransitionComplete, 100);
      return () => clearTimeout(timer);
    }, [mode, onTransitionComplete]);
    return <div data-testid="world" data-mode={mode} data-profile={profile?.id || ''} />;
  },
  AvatarPreview: ({ profile }) => <div data-testid="alien-filter-preview" data-photo={profile?.photo || ''} data-version={profile?.faceVersion || ''} />,
  AlienPortrait: ({ profile }) => <span role="img" aria-label={`${profile?.nickname || 'Alien'} 3D portrait`} data-photo={profile?.photo || ''} />,
}));
vi.mock('../src/YouTubePlayer.jsx', async (importOriginal) => {
  const actual = await importOriginal();
  function MockVideo({ videoId, onReady, onTitle, onEnded, playerRef }) {
      playerMock.handlers = { onEnded };
      useEffect(() => {
        let state = 1;
        const api = {
          playVideo: vi.fn(() => { state = 1; }), pauseVideo: vi.fn(() => { state = 2; }),
          seekTo: vi.fn(), setVolume: vi.fn(), getCurrentTime: () => 10,
          getDuration: () => 180, getPlayerState: () => state,
        };
        playerRef.current = api;
        playerMock.api = api;
        onTitle('Cosmic Test Song — Karaoke');
        onReady(api);
        return () => { playerRef.current = null; };
      }, [videoId, onReady, onTitle, playerRef]);
      return <div data-testid="video" data-video-id={videoId}><button onClick={onEnded}>Simulate official YouTube ENDED event</button></div>;
  }
  return {
    ...actual,
    default: function TestPlayer(props) {
      return playerMock.real ? <actual.default {...props} /> : <MockVideo {...props} />;
    },
  };
});

import App from '../src/App.jsx';

const sourcePhoto = 'data:image/jpeg;base64,SGVsbG8=';
const photo = 'data:image/png;base64,RmlsdGVyZWQ=';
const fixture = { id: 'known-alien', nickname: 'Cosmic Dave', photo, faceVersion: 'landmark-alien-v2', faceMeta: {}, createdAt: '2026-11-09T00:00:00.000Z' };

beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
  playerMock.handlers = null;
  playerMock.real = false;
  audioMock.startMicrophone.mockResolvedValue(true);
  filterMock.transform.mockReset().mockResolvedValue({ photo, faceVersion: 'landmark-alien-v2', faceMeta: { landmarks: 478, processingMs: 25 } });
  Object.defineProperty(window, 'matchMedia', { configurable: true, value: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }) });
  Object.defineProperty(HTMLImageElement.prototype, 'complete', { configurable: true, get: () => true });
  Object.defineProperty(HTMLImageElement.prototype, 'naturalWidth', { configurable: true, get: () => 1024 });
  Object.defineProperty(HTMLImageElement.prototype, 'naturalHeight', { configurable: true, get: () => 1024 });
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({ drawImage: vi.fn(), translate: vi.fn(), scale: vi.fn() });
  vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue(sourcePhoto);
  vi.stubGlobal('Image', class {
    width = 1024; height = 1024;
    set src(value) { this._src = value; queueMicrotask(() => this.onload?.()); }
    get src() { return this._src; }
  });
});

afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); delete window.YT; });

describe('participant journey', () => {
  it('registers an uploaded face, boards the UFO, validates links, performs, awards once, and preserves the identity on replay and reload', async () => {
    const user = userEvent.setup();
    const view = render(<App />);
    expect(screen.getByTestId('world').dataset.mode).toBe('menu');
    await user.click(screen.getByRole('button', { name: /GET ABDUCTED/i }));
    const registration = screen.getByRole('dialog', { name: /YOUR FACE/i });
    await user.type(within(registration).getByLabelText(/PICK YOUR SPACE NAME/i), 'Cosmic Dave');
    await user.upload(registration.querySelector('input[type=file]'), new File(['photo'], 'face.jpg', { type: 'image/jpeg' }));
    const preview = await within(registration).findByRole('img', { name: /face crop preview/i });
    fireEvent.load(preview);
    await user.click(within(registration).getByRole('button', { name: /PREVIEW MY ALIEN/i }));
    expect(loadProfile()).toBeNull();
    expect(screen.getByTestId('world').dataset.mode).toBe('menu');
    expect((await screen.findByTestId('alien-filter-preview')).dataset.photo).toBe(photo);
    await user.click(within(registration).getByRole('button', { name: /CONFIRM MY ALIEN/i }));
    expect(screen.getByTestId('world').dataset.mode).toBe('abduction');
    const identity = loadProfile();
    expect(identity.nickname).toBe('Cosmic Dave');
    expect(identity.photo).toBe(photo);
    expect(identity.faceVersion).toBe('landmark-alien-v2');
    expect(filterMock.transform).toHaveBeenCalledOnce();
    expect(identity.id).toBeTruthy();
    await waitFor(() => expect(screen.getByTestId('world').dataset.mode).toBe('club'));

    const song = screen.getByLabelText('YOUTUBE VIDEO LINK');
    await user.type(song, 'https://example.com/watch?v=dQw4w9WgXcQ');
    await user.click(screen.getByRole('button', { name: /BEAM UP MY SONG/i }));
    expect(screen.getByRole('alert').textContent).toMatch(/valid YouTube video link/i);
    expect(screen.getByTestId('world').dataset.mode).toBe('club');
    await user.clear(song);
    await user.type(song, 'https://youtu.be/dQw4w9WgXcQ?t=15');
    await user.click(screen.getByRole('button', { name: /BEAM UP MY SONG/i }));
    expect(screen.getByTestId('world').dataset.mode).toBe('performance');
    expect(screen.getByTestId('video').dataset.videoId).toBe('dQw4w9WgXcQ');
    expect(screen.getByText('Cosmic Test Song — Karaoke')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Pause video' }));
    expect(playerMock.api.pauseVideo).toHaveBeenCalledOnce();
    await user.click(screen.getByRole('button', { name: 'Play video' }));
    expect(playerMock.api.playVideo).toHaveBeenCalledOnce();
    await user.click(screen.getByRole('button', { name: 'Restart song' }));
    expect(playerMock.api.seekTo).toHaveBeenCalledWith(0, true);

    // Duplicate SDK end notifications must create exactly one score.
    const ended = playerMock.handlers.onEnded;
    act(() => { ended(); ended(); });
    expect(screen.getByTestId('world').dataset.mode).toBe('results');
    expect(loadRecords()).toHaveLength(1);
    const record = loadRecords()[0];
    expect(record.profileId).toBe(identity.id);
    expect(record.photo).toBe(photo);
    expect(record.faceVersion).toBe('landmark-alien-v2');
    expect(record.song).toBe('Cosmic Test Song — Karaoke');
    expect(record.score).toBeGreaterThanOrEqual(85);
    expect(record.score).toBeLessThanOrEqual(100);
    await waitFor(() => expect(screen.getByText(/ABSOLUTELY/)).toBeTruthy(), { timeout: 3000 });
    await user.click(screen.getByRole('button', { name: /SING ANOTHER/i }));
    expect(screen.getByTestId('world').dataset.mode).toBe('club');
    expect(screen.getByTestId('world').dataset.profile).toBe(identity.id);
    expect(loadProfile()).toEqual(identity);
    expect(filterMock.transform).toHaveBeenCalledOnce();
    await user.click(screen.getByRole('button', { name: /HALL OF FAME/i }));
    const board = screen.getByRole('dialog', { name: 'Galactic leaderboard' });
    expect(within(board).getByText('Cosmic Dave')).toBeTruthy();
    expect(within(board).getByText('Cosmic Test Song — Karaoke')).toBeTruthy();
    expect(within(board).getByRole('img', { name: /Cosmic Dave 3D portrait/ }).dataset.photo).toBe(photo);

    view.unmount();
    render(<App />);
    expect(screen.getByRole('button', { name: /WELCOME BACK, EARTHLING/i })).toBeTruthy();
    expect(screen.getByTestId('world').dataset.profile).toBe(identity.id);
    expect(screen.getByText('Cosmic Test Song — Karaoke')).toBeTruthy();
    expect(loadRecords()).toHaveLength(1);
  });

  it('logs out the current player when the THE BOOTH tab is clicked', async () => {
    const user = userEvent.setup();
    saveProfile(fixture);
    const view = render(<App />);
    expect(screen.getByRole('button', { name: /WELCOME BACK, EARTHLING/i })).toBeTruthy();
    await user.click(screen.getByRole('button', { name: /EXPLORE THE BOOTH/i }));
    await user.click(screen.getByRole('button', { name: 'THE BOOTH' }));
    expect(screen.getByRole('button', { name: /GET ABDUCTED/i })).toBeTruthy();
    expect(screen.getByTestId('world').dataset.profile).toBe('');
    expect(loadProfile()).toBeNull();
    view.unmount();
    render(<App />);
    expect(screen.getByRole('button', { name: /GET ABDUCTED/i })).toBeTruthy();
  });

  it('upgrades a legacy photo identity through the filter preview before allowing abduction', async () => {
    saveProfile({ ...fixture, photo: sourcePhoto, faceVersion: undefined });
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole('button', { name: /WELCOME BACK, EARTHLING/i }));
    const registration = await screen.findByRole('dialog', { name: /YOUR FACE/i });
    expect(screen.getByTestId('world').dataset.mode).toBe('menu');
    fireEvent.load(within(registration).getByRole('img', { name: /face crop preview/i }));
    await user.click(within(registration).getByRole('button', { name: /PREVIEW MY ALIEN/i }));
    expect((await screen.findByTestId('alien-filter-preview')).dataset.photo).toBe(photo);
    await user.click(within(registration).getByRole('button', { name: /CONFIRM MY ALIEN/i }));
    expect(screen.getByTestId('world').dataset.mode).toBe('abduction');
    expect(loadProfile()).toEqual(expect.objectContaining({ id: fixture.id, nickname: fixture.nickname, photo, faceVersion: 'landmark-alien-v2' }));
    expect(filterMock.transform).toHaveBeenCalledOnce();
  });

  it('reuses a transformed identity on the next visit without rerunning detection', async () => {
    saveProfile(fixture);
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole('button', { name: /WELCOME BACK, EARTHLING/i }));
    expect(screen.getByTestId('world').dataset.mode).toBe('abduction');
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(filterMock.transform).not.toHaveBeenCalled();
    expect(loadProfile()).toEqual(expect.objectContaining({ id: fixture.id, photo, faceVersion: 'landmark-alien-v2' }));
  });

  it('asks before leaving an unfinished song and never awards a skipped performance', async () => {
    saveProfile(fixture);
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole('button', { name: /EXPLORE THE BOOTH/i }));
    await user.type(screen.getByLabelText('YOUTUBE VIDEO LINK'), 'https://youtube.com/watch?v=dQw4w9WgXcQ');
    await user.click(screen.getByRole('button', { name: /BEAM UP MY SONG/i }));
    await user.click(screen.getByRole('button', { name: 'EXIT' }));
    expect(screen.getByRole('dialog', { name: 'Leave this performance' })).toBeTruthy();
    await user.click(screen.getByRole('button', { name: /KEEP SINGING/i }));
    expect(screen.queryByRole('dialog', { name: 'Leave this performance' })).toBeNull();
    expect(screen.getByTestId('world').dataset.mode).toBe('performance');
    await user.click(screen.getByRole('button', { name: 'EXIT' }));
    await user.click(screen.getByRole('button', { name: /Leave the stage/i }));
    expect(screen.getByTestId('world').dataset.mode).toBe('club');
    expect(loadRecords()).toEqual([]);
    expect(loadProfile()).toEqual(fixture);
    expect(audioMock.stopMicrophone).toHaveBeenCalled();
  });

  it('keeps karaoke usable when microphone permission is denied', async () => {
    saveProfile(fixture);
    audioMock.startMicrophone.mockRejectedValue(new Error('Microphone permission was declined. You can still sing along.'));
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole('button', { name: /EXPLORE THE BOOTH/i }));
    await user.click(screen.getByRole('button', { name: /LINK YOUR MIC FOR REACTIVE LIGHTS/i }));
    expect(await screen.findByText(/Microphone permission was declined/)).toBeTruthy();
    expect(screen.getByLabelText('YOUTUBE VIDEO LINK').disabled).toBe(false);
    expect(screen.getByRole('button', { name: /BEAM UP MY SONG/i }).disabled).toBe(false);
  });

  it.each(['home', 'stage exit'])('ignores microphone permission resolved after %s cancels the request', async (destination) => {
    saveProfile(fixture);
    let resolvePermission;
    audioMock.startMicrophone.mockImplementation(() => new Promise((resolve) => { resolvePermission = resolve; }));
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole('button', { name: /EXPLORE THE BOOTH/i }));
    if (destination === 'stage exit') {
      await user.type(screen.getByLabelText('YOUTUBE VIDEO LINK'), 'https://youtu.be/dQw4w9WgXcQ');
      await user.click(screen.getByRole('button', { name: /BEAM UP MY SONG/i }));
      await user.click(screen.getByRole('button', { name: 'LINK MIC' }));
      expect(screen.getByRole('button', { name: 'LINKING…' }).disabled).toBe(true);
      await user.click(screen.getByRole('button', { name: 'EXIT' }));
      await user.click(screen.getByRole('button', { name: /Leave the stage/i }));
    } else {
      await user.click(screen.getByRole('button', { name: /LINK YOUR MIC FOR REACTIVE LIGHTS/i }));
      expect(screen.getByRole('button', { name: 'CONNECTING…' }).disabled).toBe(true);
      await user.click(screen.getByRole('button', { name: 'BACK TO EARTH' }));
    }
    expect(audioMock.stopMicrophone).toHaveBeenCalled();
    await act(async () => { resolvePermission(true); });
    if (destination === 'home') await user.click(screen.getByRole('button', { name: /EXPLORE THE BOOTH/i }));
    expect(screen.getByTestId('world').dataset.mode).toBe('club');
    expect(screen.getByRole('button', { name: /LINK YOUR MIC FOR REACTIVE LIGHTS/i }).disabled).toBe(false);
    expect(screen.queryByText(/MIC LINKED · Your voice now controls/)).toBeNull();
    expect(screen.queryByRole('button', { name: /TAP TO DISCONNECT|MIC ON/ })).toBeNull();
  });

  it('does not claim the microphone is linked when audio acquisition reports cancellation', async () => {
    saveProfile(fixture);
    audioMock.startMicrophone.mockResolvedValue(false);
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole('button', { name: /EXPLORE THE BOOTH/i }));
    await user.click(screen.getByRole('button', { name: /LINK YOUR MIC FOR REACTIVE LIGHTS/i }));
    expect(screen.getByRole('button', { name: /LINK YOUR MIC FOR REACTIVE LIGHTS/i }).disabled).toBe(false);
    expect(screen.queryByRole('button', { name: /TAP TO DISCONNECT/ })).toBeNull();
  });

  it('keeps the new score and true rank visible for this session when storage quota rejects persistence', async () => {
    saveProfile(fixture);
    const veteran = { id: 'veteran-performance', profileId: 'veteran', nickname: 'Veteran Alien', photo, song: 'Existing Champion', videoId: 'dQw4w9WgXcQ', score: 100, createdAt: '2026-01-01T00:00:00.000Z' };
    localStorage.setItem(STORAGE_KEYS.records, JSON.stringify([veteran]));
    vi.spyOn(crypto, 'getRandomValues').mockImplementation((array) => { array[0] = 11; return array; });
    const setItem = Storage.prototype.setItem;
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (key, value) {
      if (key === STORAGE_KEYS.records) { const error = new Error('quota exceeded'); error.name = 'QuotaExceededError'; throw error; }
      return setItem.call(this, key, value);
    });
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole('button', { name: /EXPLORE THE BOOTH/i }));
    await user.type(screen.getByLabelText('YOUTUBE VIDEO LINK'), 'https://youtu.be/dQw4w9WgXcQ');
    await user.click(screen.getByRole('button', { name: /BEAM UP MY SONG/i }));
    act(() => playerMock.handlers.onEnded());
    expect(screen.getByTestId('world').dataset.mode).toBe('results');
    expect(screen.getByText(/Device storage is full/)).toBeTruthy();
    expect(document.querySelector('.winner-name b').textContent).toMatch(/^#2/);
    expect(loadRecords()).toHaveLength(1);
    await user.click(screen.getByRole('button', { name: /See the galactic leaderboard/i }));
    const board = screen.getByRole('dialog', { name: 'Galactic leaderboard' });
    expect(within(board).getByText('Veteran Alien')).toBeTruthy();
    const retainedRow = within(board).getByText('Cosmic Dave').closest('.board-row');
    expect(retainedRow.querySelector('.rank').textContent).toBe('02');
    expect(retainedRow.querySelector('.record-score').textContent).toMatch(/^96/);
    expect(within(retainedRow).getByText('Cosmic Test Song — Karaoke')).toBeTruthy();
  });

  it('leaves the actual YouTube retry action available alongside alternate song selection', async () => {
    saveProfile(fixture);
    playerMock.real = true;
    let options;
    const api = { destroy: vi.fn(), setVolume: vi.fn(), getVideoData: () => ({ title: 'Real Player Song' }), getIframe: () => document.createElement('iframe') };
    window.YT = {
      PlayerState: { ENDED: 0, PLAYING: 1, PAUSED: 2 },
      Player: vi.fn(function Player(container, configuration) { options = configuration; return api; }),
    };
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole('button', { name: /EXPLORE THE BOOTH/i }));
    await user.type(screen.getByLabelText('YOUTUBE VIDEO LINK'), 'https://youtu.be/dQw4w9WgXcQ');
    await user.click(screen.getByRole('button', { name: /BEAM UP MY SONG/i }));
    await waitFor(() => expect(options).toBeTruthy());
    act(() => options.events.onError({ data: 150 }));
    expect(screen.getAllByRole('alert')).toHaveLength(1);
    const retry = screen.getByRole('button', { name: /RETRY TRANSMISSION/i });
    expect(retry.disabled).toBe(false);
    expect(screen.getByRole('button', { name: /Choose another song/i })).toBeTruthy();
    await user.click(retry);
    await waitFor(() => expect(window.YT.Player).toHaveBeenCalledTimes(2));
    expect(api.destroy).toHaveBeenCalledOnce();
    act(() => options.events.onReady({ target: api }));
    expect(screen.queryByRole('button', { name: /Choose another song/i })).toBeNull();
    expect(screen.getByRole('button', { name: 'Pause video' }).disabled).toBe(false);
  });
});
