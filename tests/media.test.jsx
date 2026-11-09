import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Registration from '../src/Registration.jsx';
import YouTubePlayer, { parseYouTubeUrl } from '../src/YouTubePlayer.jsx';

const filterMock = vi.hoisted(() => ({ transform: vi.fn() }));
vi.mock('../src/face/faceFilter.js', () => ({ transformAlienFace: filterMock.transform }));
vi.mock('../src/World.jsx', () => ({
  AvatarPreview: ({ profile }) => <div data-testid="alien-filter-preview" data-photo={profile?.photo || ''} data-version={profile?.faceVersion || ''} />,
}));
const sourcePhoto = 'data:image/jpeg;base64,SGVsbG8=';
const filteredPhoto = 'data:image/png;base64,RmlsdGVyZWQ=';
const filteredResult = { photo: filteredPhoto, faceVersion: 'landmark-alien-v2', faceMeta: { landmarks: 478, processingMs: 25 } };
const legacyProfile = { id: 'human', nickname: 'Human', photo: sourcePhoto, createdAt: '2026-01-01' };

beforeEach(() => {
  filterMock.transform.mockReset().mockResolvedValue(filteredResult);
  Object.defineProperty(window, 'matchMedia', { configurable: true, value: () => ({ matches: false }) });
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); delete window.YT; });

describe('camera registration', () => {
  it('explains denied camera permission and offers upload without completing registration', async () => {
    const error = new Error('denied'); error.name = 'NotAllowedError';
    const request = vi.fn().mockRejectedValue(error);
    Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: { getUserMedia: request } });
    const complete = vi.fn();
    const user = userEvent.setup();
    render(<Registration onComplete={complete} onCancel={vi.fn()} />);
    await user.click(screen.getByRole('button', { name: /USE CAMERA/i }));
    expect((await screen.findByRole('alert')).textContent).toMatch(/permission was declined/i);
    expect(screen.getByRole('button', { name: /UPLOAD PHOTO/i }).disabled).toBe(false);
    expect(screen.getByRole('button', { name: /PREVIEW MY ALIEN/i }).disabled).toBe(true);
    expect(request).toHaveBeenCalledWith(expect.objectContaining({ audio: false }));
    expect(complete).not.toHaveBeenCalled();
  });

  it('captures a real stream frame, stops tracks, and cleans up a retake on close', async () => {
    const track = { stop: vi.fn() };
    const stream = { getTracks: () => [track] };
    Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: { getUserMedia: vi.fn().mockResolvedValue(stream) } });
    vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined);
    Object.defineProperty(HTMLVideoElement.prototype, 'videoWidth', { configurable: true, get: () => 1280 });
    Object.defineProperty(HTMLVideoElement.prototype, 'videoHeight', { configurable: true, get: () => 720 });
    const drawImage = vi.fn();
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({ drawImage, translate: vi.fn(), scale: vi.fn() });
    vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue('data:image/jpeg;base64,SGVsbG8=');
    const user = userEvent.setup();
    const view = render(<Registration onComplete={vi.fn()} onCancel={vi.fn()} />);
    await user.click(screen.getByRole('button', { name: /USE CAMERA/i }));
    await user.click(await screen.findByRole('button', { name: /CAPTURE PHOTO/i }));
    expect(drawImage).toHaveBeenCalledWith(expect.any(HTMLVideoElement), 280, 0, 720, 720, 0, 0, 1024, 1024);
    expect(track.stop).toHaveBeenCalledOnce();
    expect(screen.getByRole('img', { name: /face crop preview/i })).toBeTruthy();
    await user.click(screen.getByRole('button', { name: /RETAKE PHOTO/i }));
    await screen.findByRole('button', { name: /CAPTURE PHOTO/i });
    view.unmount();
    expect(track.stop).toHaveBeenCalledTimes(2);
  });

  it('processes the chosen high-quality crop and confirms only the transformed texture', async () => {
    Object.defineProperty(HTMLImageElement.prototype, 'complete', { configurable: true, get: () => true });
    Object.defineProperty(HTMLImageElement.prototype, 'naturalWidth', { configurable: true, get: () => 1200 });
    Object.defineProperty(HTMLImageElement.prototype, 'naturalHeight', { configurable: true, get: () => 800 });
    const drawImage = vi.fn();
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({ drawImage });
    const encode = vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue('data:image/jpeg;base64,SGVsbG8=');
    const complete = vi.fn();
    const user = userEvent.setup();
    render(<Registration profile={legacyProfile} onComplete={complete} onCancel={vi.fn()} />);
    fireEvent.load(screen.getByRole('img'));
    fireEvent.change(screen.getByLabelText('Face zoom'), { target: { value: '2' } });
    fireEvent.change(screen.getByLabelText('Move face horizontally'), { target: { value: '25' } });
    fireEvent.change(screen.getByLabelText('Move face vertically'), { target: { value: '75' } });
    await user.click(screen.getByRole('button', { name: /PREVIEW MY ALIEN/i }));
    expect(drawImage).toHaveBeenCalledWith(expect.any(HTMLImageElement), 200, 300, 400, 400, 0, 0, 768, 768);
    expect(encode).toHaveBeenCalledWith('image/jpeg', 0.96);
    expect(filterMock.transform).toHaveBeenCalledWith(sourcePhoto, expect.objectContaining({ signal: expect.any(AbortSignal), onProgress: expect.any(Function) }));
    expect(complete).not.toHaveBeenCalled();
    expect((await screen.findByTestId('alien-filter-preview')).dataset.photo).toBe(filteredPhoto);
    await user.click(screen.getByRole('button', { name: /CONFIRM MY ALIEN/i }));
    expect(complete).toHaveBeenCalledWith(expect.objectContaining({ id: 'human', nickname: 'Human', photo: filteredPhoto, faceVersion: 'landmark-alien-v2', faceMeta: filteredResult.faceMeta }));
  });
});

describe('landmark-filter registration gate', () => {
  beforeEach(() => {
    Object.defineProperty(HTMLImageElement.prototype, 'complete', { configurable: true, get: () => true });
    Object.defineProperty(HTMLImageElement.prototype, 'naturalWidth', { configurable: true, get: () => 1024 });
    Object.defineProperty(HTMLImageElement.prototype, 'naturalHeight', { configurable: true, get: () => 1024 });
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({ drawImage: vi.fn(), translate: vi.fn(), scale: vi.fn() });
    vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue(sourcePhoto);
  });

  async function requestPreview(user) {
    fireEvent.load(screen.getByRole('img', { name: /face crop preview/i }));
    await user.click(screen.getByRole('button', { name: /PREVIEW MY ALIEN/i }));
  }

  it.each([
    'No face found. Center one face in brighter light and try again.',
    'More than one face was detected. Use a photo of just yourself.',
    'The local face model could not load. Please retry the scanner.',
  ])('explains a failed scan without accepting the original photograph: %s', async (message) => {
    filterMock.transform.mockRejectedValueOnce(new Error(message));
    const complete = vi.fn();
    const user = userEvent.setup();
    render(<Registration profile={legacyProfile} onComplete={complete} onCancel={vi.fn()} />);
    await requestPreview(user);
    expect((await screen.findByRole('alert')).textContent).toContain(message);
    expect(screen.queryByRole('button', { name: /CONFIRM MY ALIEN/i })).toBeNull();
    expect(complete).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: /UPLOAD PHOTO/i }).disabled).toBe(false);
    await user.click(screen.getByRole('button', { name: /PREVIEW MY ALIEN/i }));
    expect((await screen.findByTestId('alien-filter-preview')).dataset.photo).toBe(filteredPhoto);
    expect(filterMock.transform).toHaveBeenCalledTimes(2);
    expect(complete).not.toHaveBeenCalled();
  });

  it('shows landmark-processing progress and keeps confirmation unavailable while work is pending', async () => {
    filterMock.transform.mockImplementationOnce((_photo, { onProgress }) => {
      onProgress({ message: 'Mapping facial landmarks…', progress: 0.6 });
      return new Promise(() => {});
    });
    const complete = vi.fn();
    const user = userEvent.setup();
    render(<Registration profile={legacyProfile} onComplete={complete} onCancel={vi.fn()} />);
    await requestPreview(user);
    expect(screen.getByRole('status').textContent).toMatch(/Mapping facial landmarks/);
    expect(screen.getByRole('progressbar', { name: /Alien face transformation progress/i }).value).toBe(0.6);
    expect(screen.queryByRole('button', { name: /CONFIRM MY ALIEN/i })).toBeNull();
    expect(screen.getByRole('button', { name: /TRANSFORMING YOUR FACE/i }).disabled).toBe(true);
    expect(complete).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: /CANCEL TRANSFORMATION/i }));
    expect(screen.queryByRole('status')).toBeNull();
    expect(screen.getByRole('button', { name: /PREVIEW MY ALIEN/i }).disabled).toBe(false);
  });

  it('reuses an unchanged generated texture instead of detecting again before confirmation', async () => {
    const complete = vi.fn();
    const user = userEvent.setup();
    render(<Registration profile={legacyProfile} onComplete={complete} onCancel={vi.fn()} />);
    await requestPreview(user);
    await screen.findByTestId('alien-filter-preview');
    await user.click(screen.getByRole('button', { name: /ADJUST PHOTO/i }));
    await user.click(screen.getByRole('button', { name: /PREVIEW MY ALIEN/i }));
    await screen.findByTestId('alien-filter-preview');
    expect(filterMock.transform).toHaveBeenCalledOnce();
    await user.click(screen.getByRole('button', { name: /CONFIRM MY ALIEN/i }));
    expect(complete).toHaveBeenCalledWith(expect.objectContaining({ photo: filteredPhoto, faceVersion: 'landmark-alien-v2' }));
  });

  it('invalidates the old preview when a participant changes their crop', async () => {
    const secondPhoto = 'data:image/png;base64,U2Vjb25k';
    filterMock.transform.mockResolvedValueOnce(filteredResult).mockResolvedValueOnce({ ...filteredResult, photo: secondPhoto });
    const complete = vi.fn();
    const user = userEvent.setup();
    render(<Registration profile={legacyProfile} onComplete={complete} onCancel={vi.fn()} />);
    await requestPreview(user);
    await screen.findByTestId('alien-filter-preview');
    await user.click(screen.getByRole('button', { name: /ADJUST PHOTO/i }));
    fireEvent.change(screen.getByLabelText('Face zoom'), { target: { value: '1.4' } });
    expect(screen.queryByRole('button', { name: /CONFIRM MY ALIEN/i })).toBeNull();
    await user.click(screen.getByRole('button', { name: /PREVIEW MY ALIEN/i }));
    expect((await screen.findByTestId('alien-filter-preview')).dataset.photo).toBe(secondPhoto);
    expect(filterMock.transform).toHaveBeenCalledTimes(2);
    await user.click(screen.getByRole('button', { name: /CONFIRM MY ALIEN/i }));
    expect(complete).toHaveBeenCalledWith(expect.objectContaining({ photo: secondPhoto }));
  });

  it('cancels processing and ignores an older scan result after a newer crop succeeds', async () => {
    let resolveOld;
    filterMock.transform.mockImplementationOnce(() => new Promise((resolve) => { resolveOld = resolve; }));
    const complete = vi.fn();
    const user = userEvent.setup();
    render(<Registration profile={legacyProfile} onComplete={complete} onCancel={vi.fn()} />);
    await requestPreview(user);
    const signal = filterMock.transform.mock.calls[0][1].signal;
    await user.click(await screen.findByRole('button', { name: /CANCEL TRANSFORMATION/i }));
    expect(signal.aborted).toBe(true);
    fireEvent.change(screen.getByLabelText('Face zoom'), { target: { value: '1.6' } });
    await user.click(screen.getByRole('button', { name: /PREVIEW MY ALIEN/i }));
    expect((await screen.findByTestId('alien-filter-preview')).dataset.photo).toBe(filteredPhoto);
    await act(async () => { resolveOld({ ...filteredResult, photo: 'data:image/png;base64,T2xk' }); });
    expect(screen.getByTestId('alien-filter-preview').dataset.photo).toBe(filteredPhoto);
    await user.click(screen.getByRole('button', { name: /CONFIRM MY ALIEN/i }));
    expect(complete).toHaveBeenCalledWith(expect.objectContaining({ photo: filteredPhoto }));
  });

  it('aborts an unfinished scan when registration closes and never confirms a late result', async () => {
    let resolveScan;
    filterMock.transform.mockImplementationOnce(() => new Promise((resolve) => { resolveScan = resolve; }));
    const complete = vi.fn();
    const user = userEvent.setup();
    const view = render(<Registration profile={legacyProfile} onComplete={complete} onCancel={vi.fn()} />);
    await requestPreview(user);
    const signal = filterMock.transform.mock.calls[0][1].signal;
    view.unmount();
    expect(signal.aborted).toBe(true);
    await act(async () => { resolveScan(filteredResult); });
    expect(complete).not.toHaveBeenCalled();
  });

  it('previews and reuses an already transformed identity without another detector pass', async () => {
    const ready = { ...legacyProfile, ...filteredResult };
    const complete = vi.fn();
    const user = userEvent.setup();
    render(<Registration profile={ready} onComplete={complete} onCancel={vi.fn()} />);
    expect(screen.getByTestId('alien-filter-preview').dataset.photo).toBe(filteredPhoto);
    expect(filterMock.transform).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: /CONFIRM MY ALIEN/i }));
    expect(complete).toHaveBeenCalledWith(expect.objectContaining({ id: ready.id, photo: filteredPhoto, faceVersion: 'landmark-alien-v2' }));
  });

  it('transforms a captured camera frame before allowing avatar confirmation', async () => {
    const track = { stop: vi.fn() };
    Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: { getUserMedia: vi.fn().mockResolvedValue({ getTracks: () => [track] }) } });
    vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined);
    Object.defineProperty(HTMLVideoElement.prototype, 'videoWidth', { configurable: true, get: () => 1280 });
    Object.defineProperty(HTMLVideoElement.prototype, 'videoHeight', { configurable: true, get: () => 720 });
    const complete = vi.fn();
    const user = userEvent.setup();
    render(<Registration profile={{ id: 'camera-human', nickname: 'Camera Human' }} onComplete={complete} onCancel={vi.fn()} />);
    await user.click(screen.getByRole('button', { name: /USE CAMERA/i }));
    await user.click(await screen.findByRole('button', { name: /CAPTURE PHOTO/i }));
    expect(track.stop).toHaveBeenCalledOnce();
    await requestPreview(user);
    await screen.findByTestId('alien-filter-preview');
    expect(filterMock.transform).toHaveBeenCalledOnce();
    expect(complete).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: /CONFIRM MY ALIEN/i }));
    expect(complete).toHaveBeenCalledWith(expect.objectContaining({ photo: filteredPhoto, faceVersion: 'landmark-alien-v2' }));
  });
});

describe('official YouTube API lifecycle', () => {
  let options;
  let api;
  beforeEach(() => {
    options = null;
    api = {
      setVolume: vi.fn(), destroy: vi.fn(), playVideo: vi.fn(), pauseVideo: vi.fn(), seekTo: vi.fn(),
      getVideoData: () => ({ title: 'An Actual API Song' }), getIframe: () => document.createElement('iframe'),
    };
    window.YT = {
      PlayerState: { ENDED: 0, PLAYING: 1, PAUSED: 2 },
      Player: vi.fn(function Player(container, configuration) { options = configuration; return api; }),
    };
  });

  it('initializes once, exposes actual controls, reports title and ends, updates volume, and destroys playback', async () => {
    const onEnded = vi.fn(), onTitle = vi.fn(), onReady = vi.fn();
    const ref = { current: null };
    const view = render(<YouTubePlayer videoId="dQw4w9WgXcQ" playerRef={ref} onEnded={onEnded} onTitle={onTitle} onReady={onReady} volume={45} />);
    await waitFor(() => expect(options).not.toBeNull());
    expect(options.videoId).toBe('dQw4w9WgXcQ');
    expect(options.playerVars.origin).toBe(window.location.origin);
    expect(ref.current).toBe(api);
    act(() => options.events.onReady({ target: api }));
    expect(api.setVolume).toHaveBeenCalledWith(45);
    expect(onReady).toHaveBeenCalledWith(api);
    expect(onTitle).toHaveBeenCalledWith('An Actual API Song');
    act(() => options.events.onStateChange({ data: 0, target: api }));
    expect(onEnded).toHaveBeenCalledOnce();
    const latestEnded = vi.fn();
    view.rerender(<YouTubePlayer videoId="dQw4w9WgXcQ" playerRef={ref} onEnded={latestEnded} onTitle={onTitle} onReady={onReady} volume={22} />);
    expect(window.YT.Player).toHaveBeenCalledOnce();
    expect(api.setVolume).toHaveBeenLastCalledWith(22);
    act(() => options.events.onStateChange({ data: 0, target: api }));
    expect(latestEnded).toHaveBeenCalledOnce();
    expect(onEnded).toHaveBeenCalledOnce();
    view.unmount();
    expect(api.destroy).toHaveBeenCalledOnce();
    expect(ref.current).toBeNull();
  });

  it('explains owner-blocked embedding and rebuilds the player on retry', async () => {
    const onError = vi.fn();
    const user = userEvent.setup();
    render(<YouTubePlayer videoId="dQw4w9WgXcQ" onError={onError} />);
    await waitFor(() => expect(options).not.toBeNull());
    act(() => options.events.onError({ data: 150 }));
    expect(screen.getByRole('alert').textContent).toMatch(/owner has disabled embedded playback/i);
    expect(onError).toHaveBeenCalledWith(expect.stringMatching(/choose another/i));
    await user.click(screen.getByRole('button', { name: /RETRY TRANSMISSION/i }));
    await waitFor(() => expect(window.YT.Player).toHaveBeenCalledTimes(2));
    expect(api.destroy).toHaveBeenCalledOnce();
  });

  it.each([
    ['https://youtube.com/watch?v=dQw4w9WgXcQ', 'dQw4w9WgXcQ'],
    ['https://youtu.be/dQw4w9WgXcQ?t=7', 'dQw4w9WgXcQ'],
    ['youtube.com/live/dQw4w9WgXcQ', 'dQw4w9WgXcQ'],
    ['https://m.youtube.com/shorts/dQw4w9WgXcQ', 'dQw4w9WgXcQ'],
    ['https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ', 'dQw4w9WgXcQ'],
    ['https://youtube.com.evil.example/watch?v=dQw4w9WgXcQ', null],
    ['https://evil.example/youtube.com/watch?v=dQw4w9WgXcQ', null],
    ['https://youtube.com/watch?v=short', null],
    ['javascript:alert(1)', null],
    ['https://user:pass@youtube.com/watch?v=dQw4w9WgXcQ', null],
  ])('validates %s', (url, expected) => { expect(parseYouTubeUrl(url)).toBe(expected); });
});
