/**
 * Synthesised audio: every sound is generated with WebAudio nodes, so there are
 * no assets to license and the volume sliders are wired to real gain nodes.
 *
 * Music is a slow procedural drone with sparse pentatonic plucks; SFX are
 * short noise/oscillator gestures. Swapping in recorded assets later means
 * replacing the body of one `play` case at a time.
 */

import type { Settings } from '../../ui/settings';

export type SfxName =
  | 'slash' | 'slash_heavy' | 'hit' | 'hit_player' | 'arrow' | 'fire' | 'ice' | 'arcane' | 'dash' | 'nova'
  | 'pickup' | 'potion' | 'levelup' | 'enemy_death' | 'boss_death' | 'ui_click' | 'ui_open' | 'ui_close'
  | 'twin_action' | 'door' | 'boss_counter' | 'twin_down' | 'room_clear' | 'death';

const PENTATONIC = [0, 3, 5, 7, 10, 12, 15];   // minor pentatonic in semitones
const CHORDS = [[0, 7, 12], [-2, 5, 10], [-4, 3, 8], [-5, 2, 7]];

class AudioManagerImpl {
  #ctx: AudioContext | null = null;
  #master: GainNode | null = null;
  #music: GainNode | null = null;
  #sfx: GainNode | null = null;
  #noise: AudioBuffer | null = null;
  #settings: Settings | null = null;
  #musicStarted = false;
  #drones: OscillatorNode[] = [];
  #droneFilter: BiquadFilterNode | null = null;
  #chordIndex = 0;
  #pluckTimer: number | null = null;
  #chordTimer: number | null = null;
  #paused = false;
  #lastPlay = new Map<string, number>();

  /** Must be called from a user gesture (browsers gate audio on one). */
  unlock(): void {
    if (this.#ctx) {
      if (this.#ctx.state === 'suspended') void this.#ctx.resume();
      return;
    }
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    this.#ctx = ctx;
    this.#master = ctx.createGain();
    this.#music = ctx.createGain();
    this.#sfx = ctx.createGain();
    this.#music.connect(this.#master);
    this.#sfx.connect(this.#master);
    this.#master.connect(ctx.destination);
    this.#noise = this.#makeNoise(ctx);
    if (this.#settings) this.applySettings(this.#settings);
    this.#startMusic();
  }

  get ready(): boolean {
    return this.#ctx !== null;
  }

  applySettings(settings: Settings): void {
    this.#settings = settings;
    if (!this.#ctx || !this.#master || !this.#music || !this.#sfx) return;
    const t = this.#ctx.currentTime;
    this.#master.gain.setTargetAtTime(settings.masterVolume, t, 0.05);
    this.#music.gain.setTargetAtTime(settings.musicVolume * (this.#paused ? 0.45 : 1) * 0.5, t, 0.1);
    this.#sfx.gain.setTargetAtTime(settings.sfxVolume, t, 0.05);
  }

  setPaused(paused: boolean): void {
    this.#paused = paused;
    if (this.#settings) this.applySettings(this.#settings);
    if (this.#droneFilter && this.#ctx) {
      this.#droneFilter.frequency.setTargetAtTime(paused ? 320 : 900, this.#ctx.currentTime, 0.4);
    }
  }

  #makeNoise(ctx: AudioContext): AudioBuffer {
    const buffer = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    return buffer;
  }

  // --- music -------------------------------------------------------------------

  #startMusic(): void {
    const ctx = this.#ctx;
    const music = this.#music;
    if (!ctx || !music || this.#musicStarted) return;
    this.#musicStarted = true;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 900;
    filter.Q.value = 0.7;
    filter.connect(music);
    this.#droneFilter = filter;
    const base = 55; // A1
    for (const semis of CHORDS[0] ?? [0, 7, 12]) {
      for (const detune of [-4, 4]) {
        const osc = ctx.createOscillator();
        osc.type = semis === 0 ? 'sawtooth' : 'triangle';
        osc.frequency.value = base * 2 ** (semis / 12);
        osc.detune.value = detune;
        const g = ctx.createGain();
        g.gain.value = semis === 0 ? 0.08 : 0.05;
        osc.connect(g);
        g.connect(filter);
        osc.start();
        this.#drones.push(osc);
      }
    }
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.07;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 260;
    lfo.connect(lfoGain);
    lfoGain.connect(filter.frequency);
    lfo.start();
    this.#chordTimer = window.setInterval(() => this.#nextChord(), 14000);
    this.#schedulePluck();
  }

  #nextChord(): void {
    const ctx = this.#ctx;
    if (!ctx) return;
    this.#chordIndex = (this.#chordIndex + 1) % CHORDS.length;
    const chord = CHORDS[this.#chordIndex] ?? [0, 7, 12];
    const base = 55;
    this.#drones.forEach((osc, i) => {
      const semis = chord[Math.floor(i / 2)] ?? 0;
      osc.frequency.setTargetAtTime(base * 2 ** (semis / 12), ctx.currentTime, 1.5);
    });
  }

  #schedulePluck(): void {
    this.#pluckTimer = window.setTimeout(() => {
      this.#pluck();
      this.#schedulePluck();
    }, 1800 + Math.random() * 3600);
  }

  #pluck(): void {
    const ctx = this.#ctx;
    const music = this.#music;
    if (!ctx || !music || this.#paused) return;
    const chord = CHORDS[this.#chordIndex] ?? [0, 7, 12];
    const root = chord[0] ?? 0;
    const step = PENTATONIC[Math.floor(Math.random() * PENTATONIC.length)] ?? 0;
    const freq = 220 * 2 ** ((root + step) / 12);
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.09, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 2.4);
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 1800;
    osc.connect(filter);
    filter.connect(g);
    g.connect(music);
    osc.start(t);
    osc.stop(t + 2.6);
  }

  // --- sfx -----------------------------------------------------------------------

  play(name: SfxName, opts: { volume?: number; pitch?: number } = {}): void {
    const ctx = this.#ctx;
    const out = this.#sfx;
    if (!ctx || !out || !this.#noise) return;
    // Rate-limit identical sounds so a burst of hits doesn't clip.
    const now = performance.now();
    const last = this.#lastPlay.get(name) ?? 0;
    if (now - last < 45) return;
    this.#lastPlay.set(name, now);
    const t = ctx.currentTime;
    const vol = opts.volume ?? 1;
    const pitch = opts.pitch ?? 1;

    const noise = (duration: number, filterType: BiquadFilterType, f0: number, f1: number, gain: number, q = 1) => {
      const src = ctx.createBufferSource();
      src.buffer = this.#noise;
      const filter = ctx.createBiquadFilter();
      filter.type = filterType;
      filter.Q.value = q;
      filter.frequency.setValueAtTime(f0 * pitch, t);
      filter.frequency.exponentialRampToValueAtTime(Math.max(40, f1 * pitch), t + duration);
      const g = ctx.createGain();
      g.gain.setValueAtTime(gain * vol, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + duration);
      src.connect(filter);
      filter.connect(g);
      g.connect(out);
      src.start(t);
      src.stop(t + duration + 0.05);
    };
    const tone = (type: OscillatorType, f0: number, f1: number, duration: number, gain: number, delay = 0) => {
      const osc = ctx.createOscillator();
      osc.type = type;
      osc.frequency.setValueAtTime(f0 * pitch, t + delay);
      osc.frequency.exponentialRampToValueAtTime(Math.max(30, f1 * pitch), t + delay + duration);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t + delay);
      g.gain.exponentialRampToValueAtTime(gain * vol, t + delay + 0.012);
      g.gain.exponentialRampToValueAtTime(0.0001, t + delay + duration);
      osc.connect(g);
      g.connect(out);
      osc.start(t + delay);
      osc.stop(t + delay + duration + 0.05);
    };

    switch (name) {
      case 'slash': noise(0.16, 'bandpass', 2400, 600, 0.5, 0.8); tone('sine', 520, 180, 0.12, 0.08); break;
      case 'slash_heavy': noise(0.26, 'bandpass', 1800, 300, 0.7, 0.8); tone('sine', 300, 90, 0.2, 0.16); break;
      case 'hit': tone('sine', 190, 60, 0.14, 0.3); noise(0.09, 'lowpass', 1400, 300, 0.35); break;
      case 'hit_player': tone('sine', 140, 40, 0.24, 0.45); noise(0.18, 'lowpass', 900, 200, 0.5); tone('square', 420, 380, 0.08, 0.05); break;
      case 'arrow': noise(0.22, 'highpass', 900, 3200, 0.3, 0.6); break;
      case 'fire': noise(0.45, 'lowpass', 2200, 400, 0.55); tone('sawtooth', 160, 60, 0.35, 0.12); break;
      case 'ice': tone('sine', 1400, 2200, 0.25, 0.12); tone('sine', 1760, 2600, 0.22, 0.08, 0.04); noise(0.2, 'highpass', 3000, 6000, 0.12); break;
      case 'arcane': tone('triangle', 420, 1400, 0.22, 0.16); tone('sine', 840, 1800, 0.18, 0.08, 0.03); break;
      case 'dash': noise(0.24, 'bandpass', 500, 2600, 0.4, 0.7); tone('sine', 200, 700, 0.18, 0.06); break;
      case 'nova': tone('sine', 80, 40, 0.6, 0.5); tone('triangle', 300, 1200, 0.5, 0.14); noise(0.5, 'lowpass', 3000, 200, 0.35); break;
      case 'pickup': tone('sine', 880, 880, 0.09, 0.12); tone('sine', 1320, 1320, 0.14, 0.12, 0.07); break;
      case 'potion': tone('sine', 300, 600, 0.12, 0.12); tone('sine', 450, 900, 0.14, 0.1, 0.09); tone('sine', 600, 1200, 0.18, 0.08, 0.18); break;
      case 'levelup': [0, 4, 7, 12].forEach((s, i) => tone('triangle', 440 * 2 ** (s / 12), 440 * 2 ** (s / 12), 0.35, 0.14, i * 0.09)); break;
      case 'enemy_death': noise(0.35, 'lowpass', 1800, 150, 0.5); tone('sawtooth', 220, 50, 0.32, 0.12); break;
      case 'boss_death': noise(1.2, 'lowpass', 2400, 80, 0.8); tone('sine', 110, 30, 1.1, 0.5); [0, 7, 12, 19].forEach((s, i) => tone('triangle', 220 * 2 ** (s / 12), 220 * 2 ** (s / 12), 0.8, 0.12, 0.3 + i * 0.12)); break;
      case 'ui_click': tone('square', 1200, 900, 0.04, 0.05); break;
      case 'ui_open': tone('sine', 520, 780, 0.12, 0.08); break;
      case 'ui_close': tone('sine', 780, 520, 0.12, 0.08); break;
      case 'twin_action': tone('sine', 660, 990, 0.08, 0.05); break;
      case 'door': noise(0.7, 'lowpass', 400, 120, 0.45); tone('sine', 70, 45, 0.6, 0.25); break;
      case 'boss_counter': tone('sawtooth', 220, 110, 0.3, 0.12); tone('sine', 880, 440, 0.25, 0.08, 0.05); break;
      case 'twin_down': tone('sine', 400, 120, 0.5, 0.2); break;
      case 'room_clear': [0, 5, 9].forEach((s, i) => tone('triangle', 330 * 2 ** (s / 12), 330 * 2 ** (s / 12), 0.5, 0.1, i * 0.12)); break;
      case 'death': tone('sine', 220, 40, 1.2, 0.35); noise(0.8, 'lowpass', 1200, 100, 0.4); break;
      default: break;
    }
  }

  destroy(): void {
    if (this.#pluckTimer) window.clearTimeout(this.#pluckTimer);
    if (this.#chordTimer) window.clearInterval(this.#chordTimer);
    for (const d of this.#drones) d.stop();
    this.#drones = [];
    void this.#ctx?.close();
    this.#ctx = null;
    this.#musicStarted = false;
  }
}

export const audio = new AudioManagerImpl();
