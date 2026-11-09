/** Original arcade sound engine. It makes no network requests beyond our bundled WAV files. */
const ASSETS = ['menu-loop', 'club-loop', 'click', 'shutter', 'teleport', 'ufo', 'chatter', 'reveal', 'victory'];
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const midi = note => 440 * Math.pow(2, (note - 69) / 12);
class AlienAudio {
  constructor() {
    this.context = null;
    this.master = null;
    this.musicGain = null;
    this.muted = true;
    this.volume = 0.45;
    this.scene = 'menu';
    this.levelRef = { current: 0 };
    this.buffers = new Map();
    this.nodes = new Set();
    this.musicNodes = new Set();
    this.stream = null;
    this.micSource = null;
    this.micAnalyser = null;
    this.micFrame = null;
    this.micPromise = null;
    this.musicTimer = null;
    this.ambientTimer = null;
    this.musicSource = null;
    this.unlocked = false;
    this.generation = 0;
    this.loading = null;
    this.disposed = false;
  }
  get micStream() { return this.stream; }
  async unlock() {
    this.disposed = false;
    if (!this.context || this.context.state === 'closed') {
      const Context = globalThis.AudioContext || globalThis.webkitAudioContext;
      if (!Context) return false;
      this.context = new Context();
      this.master = this.context.createGain();
      this.musicGain = this.context.createGain();
      this.musicGain.gain.value = 0.32;
      this.musicGain.connect(this.master);
      this.master.connect(this.context.destination);
      this._applyVolume();
    }
    if (this.context.state === 'suspended') await this.context.resume();
    this.unlocked = this.context.state === 'running';
    if (this.unlocked && !this.musicSource && !this.musicTimer) this._startMusic();
    if (!this.loading) this.loading = this._loadAssets();
    return this.unlocked;
  }
  _applyVolume() {
    if (!this.master || !this.context) return;
    const time = this.context.currentTime;
    this.master.gain.cancelScheduledValues(time);
    this.master.gain.setTargetAtTime(this.muted ? 0 : this.volume * 0.52, time, 0.035);
  }
  setVolume(value) { this.volume = clamp(Number(value) || 0, 0, 1); this._applyVolume(); }
  setMuted(value) { this.muted = Boolean(value); this._applyVolume(); }
  setScene(scene) {
    if (scene === this.scene) return;
    this.scene = scene;
    this._stopMusic();
    if (this.unlocked) this._startMusic();
  }
  async _loadAssets() {
    const context = this.context;
    await Promise.allSettled(ASSETS.map(async name => {
      const response = await fetch(`${import.meta.env?.BASE_URL || '/'}audio/${name}.wav`);
      if (!response.ok) return;
      const decoded = await context.decodeAudioData(await response.arrayBuffer());
      if (!this.disposed && this.context === context) this.buffers.set(name, decoded);
    }));
    if (!this.disposed && this.unlocked && !['performance', 'abduction'].includes(this.scene)) {
      this._stopMusic();
      this._startMusic();
    }
  }
  _startMusic() {
    if (!this.context || !this.unlocked || ['performance', 'abduction'].includes(this.scene)) return;
    const club = ['club', 'results'].includes(this.scene);
    const name = club ? 'club-loop' : 'menu-loop';
    const buffer = this.buffers.get(name);
    if (buffer) {
      const source = this.context.createBufferSource();
      source.buffer = buffer;
      source.loop = true;
      source.connect(this.musicGain);
      source.start();
      this.musicSource = source;
    } else {
      let step = 0;
      const interval = club ? 125 : 150;
      const notes = club ? [38, 38, 50, 41, 38, 45, 43, 50] : [50, 57, 62, 65, 57, 62, 69, 65];
      this.musicTimer = setInterval(() => {
        if (this.context.state !== 'running') return;
        const now = this.context.currentTime;
        this._tone(midi(notes[step % notes.length]), now, 0.11, club ? 'sawtooth' : 'square', club ? 0.09 : 0.045, this.musicGain, true);
        if (step % 4 === 0) this._kick(now, this.musicGain, 0.3);
        if (club && step % 2 === 1) this._noise(now, 0.035, 0.05, this.musicGain, true);
        step++;
      }, interval);
    }
    this._scheduleAmbient();
  }
  _scheduleAmbient() {
    clearTimeout(this.ambientTimer);
    this.ambientTimer = setTimeout(() => {
      if (!['performance', 'abduction'].includes(this.scene) && !this.muted) this.effect('chatter');
      if (!this.disposed) this._scheduleAmbient();
    }, 14000 + Math.random() * 14000);
  }
  _stopMusic() {
    clearInterval(this.musicTimer); this.musicTimer = null;
    clearTimeout(this.ambientTimer); this.ambientTimer = null;
    if (this.musicSource) { try { this.musicSource.stop(); this.musicSource.disconnect(); } catch {} this.musicSource = null; }
    for (const node of this.musicNodes) { try { node.stop(); node.disconnect(); } catch {} }
    this.musicNodes.clear();
  }
  _tone(frequency, when, duration, type = 'sine', amplitude = 0.15, destination = this.master, music = false, endFrequency = null) {
    if (!this.context || !destination) return;
    const oscillator = this.context.createOscillator();
    const gain = this.context.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(Math.max(20, frequency), when);
    if (endFrequency) oscillator.frequency.exponentialRampToValueAtTime(Math.max(20, endFrequency), when + duration);
    gain.gain.setValueAtTime(0.0001, when);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, amplitude), when + Math.min(0.015, duration / 4));
    gain.gain.exponentialRampToValueAtTime(0.0001, when + duration);
    oscillator.connect(gain); gain.connect(destination);
    const collection = music ? this.musicNodes : this.nodes;
    collection.add(oscillator);
    oscillator.onended = () => { collection.delete(oscillator); oscillator.disconnect(); gain.disconnect(); };
    oscillator.start(when); oscillator.stop(when + duration + 0.03);
  }
  _noise(when, duration, amplitude, destination = this.master, music = false) {
    if (!this.context) return;
    const buffer = this.context.createBuffer(1, Math.ceil(this.context.sampleRate * duration), this.context.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    const source = this.context.createBufferSource(); source.buffer = buffer;
    const filter = this.context.createBiquadFilter(); filter.type = 'highpass'; filter.frequency.value = 1800;
    const gain = this.context.createGain(); gain.gain.setValueAtTime(amplitude, when); gain.gain.exponentialRampToValueAtTime(0.0001, when + duration);
    source.connect(filter); filter.connect(gain); gain.connect(destination);
    const collection = music ? this.musicNodes : this.nodes; collection.add(source);
    source.onended = () => { collection.delete(source); source.disconnect(); filter.disconnect(); gain.disconnect(); };
    source.start(when); source.stop(when + duration + 0.01);
  }
  _kick(when, destination = this.master, amplitude = 0.4) { this._tone(145, when, 0.15, 'sine', amplitude, destination, true, 34); }
  effect(name) {
    if (!this.context || !this.unlocked || this.muted || this.context.state !== 'running') return;
    const aliases = { button: 'click', confirm: 'teleport', camera: 'shutter', photo: 'shutter', abduction: 'ufo', transition: 'ufo', score: 'reveal', success: 'victory', alien: 'chatter' };
    const effect = aliases[name] || name;
    const buffer = this.buffers.get(effect);
    if (buffer) {
      const source = this.context.createBufferSource(); source.buffer = buffer;
      const gain = this.context.createGain(); gain.gain.value = effect === 'chatter' ? 0.36 : 0.65;
      source.connect(gain); gain.connect(this.master); this.nodes.add(source);
      source.onended = () => { this.nodes.delete(source); source.disconnect(); gain.disconnect(); };
      source.start(); return;
    }
    const now = this.context.currentTime;
    if (effect === 'click') { this._tone(850, now, 0.07, 'square', 0.13, this.master, false, 1400); }
    else if (effect === 'shutter') { this._noise(now, 0.085, 0.35); this._tone(900, now + 0.035, 0.04, 'square', 0.15); }
    else if (effect === 'teleport') {
      this._tone(110, now, 1.7, 'sawtooth', 0.2, this.master, false, 1800);
      for (let i = 0; i < 12; i++) this._tone(400 + i * 115, now + i * 0.12, 0.17, 'sine', 0.1);
    } else if (effect === 'ufo') {
      this._tone(65, now, 2, 'sawtooth', 0.18, this.master, false, 350);
      this._tone(69, now, 2, 'sine', 0.12, this.master, false, 355);
    } else if (effect === 'chatter' || effect === 'burp') {
      for (let i = 0; i < 5; i++) this._tone(120 + Math.random() * 250, now + i * 0.11, 0.12, 'triangle', 0.08, this.master, false, 70 + Math.random() * 100);
    } else if (effect === 'victory') {
      [62, 66, 69, 74, 69, 74, 78, 81].forEach((note, i) => this._tone(midi(note), now + i * 0.14, i === 7 ? 0.9 : 0.25, 'square', 0.12));
    } else if (effect === 'reveal') {
      for (let i = 0; i < 8; i++) this._tone(220 + i * 85, now + i * 0.09, 0.1, 'square', 0.09);
      this._tone(1046, now + 0.8, 0.8, 'triangle', 0.2);
    } else if (effect === 'error') { this._tone(180, now, 0.2, 'sawtooth', 0.16, this.master, false, 80); }
  }
  async startMicrophone() {
    if (this.stream?.active) return true;
    if (this.micPromise) return this.micPromise;
    this.micPromise = this._startMicrophone();
    try { return await this.micPromise; } finally { this.micPromise = null; }
  }
  async _startMicrophone() {
    if (!globalThis.navigator?.mediaDevices?.getUserMedia) throw new Error('Microphone access needs HTTPS or localhost and a browser that supports it. You can still sing without visual reactions.');
    await this.unlock();
    if (!this.context) throw new Error('Audio analysis is unavailable in this browser. Karaoke playback still works.');
    const generation = this.generation;
    let stream;
    try { stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }, video: false }); }
    catch (error) {
      const messages = { NotAllowedError: 'Microphone permission was declined. Enable it in browser settings to activate voice reactions.', NotFoundError: 'No microphone was found. Connect one and try again.', NotReadableError: 'Your microphone is busy. Close other apps using it and try again.', SecurityError: 'Microphone access needs a secure HTTPS connection or localhost.' };
      throw new Error(messages[error.name] || 'The microphone could not start. You can still sing along without voice reactions.');
    }
    if (generation !== this.generation || this.disposed) { stream.getTracks().forEach(track => track.stop()); return false; }
    this.stream = stream;
    this.micSource = this.context.createMediaStreamSource(stream);
    this.micAnalyser = this.context.createAnalyser();
    this.micAnalyser.fftSize = 512;
    this.micAnalyser.smoothingTimeConstant = 0.75;
    this.micSource.connect(this.micAnalyser); // Deliberately never connected to speakers: no echo or feedback.
    const samples = new Float32Array(this.micAnalyser.fftSize);
    const tick = () => {
      if (!this.micAnalyser || !this.stream?.active) { this.levelRef.current = 0; return; }
      this.micAnalyser.getFloatTimeDomainData(samples);
      let power = 0; for (const sample of samples) power += sample * sample;
      const level = clamp(Math.sqrt(power / samples.length) * 5.5, 0, 1);
      this.levelRef.current += (level - this.levelRef.current) * (level > this.levelRef.current ? 0.4 : 0.12);
      this.micFrame = requestAnimationFrame(tick);
    };
    tick();
    return true;
  }
  stopMicrophone() {
    this.generation++;
    if (this.micFrame) cancelAnimationFrame(this.micFrame);
    this.micFrame = null;
    this.stream?.getTracks().forEach(track => track.stop()); this.stream = null;
    try { this.micSource?.disconnect(); this.micAnalyser?.disconnect(); } catch {}
    this.micSource = null; this.micAnalyser = null; this.levelRef.current = 0;
  }
  dispose() {
    this.disposed = true;
    this.stopMicrophone(); this._stopMusic();
    for (const node of this.nodes) { try { node.stop(); node.disconnect(); } catch {} }
    this.nodes.clear(); this.buffers.clear();
    this.context?.close().catch(() => {});
    this.context = null; this.master = null; this.musicGain = null; this.loading = null; this.unlocked = false;
  }
}
const audio = new AlienAudio();
export { AlienAudio };
export default audio;
