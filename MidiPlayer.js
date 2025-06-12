// Improved MidiPlayer.js with better instrument mapping and sound fidelity
import * as Tone from "https://cdn.jsdelivr.net/npm/tone@latest/+esm";

export default class MidiPlayer {
  constructor() {
    this.synth = null;
    this.bpm = 120;
    this.octave = 4;
    this.instrumentNumber = 0;
    // Expanded instrument mapping for General MIDI programs with better oscillator types and effects
    this.instrumentMap = {
      0: { type: "sine", detune: 0, partials: [1, 0.5, 0.3] },         // Acoustic Grand Piano
      1: { type: "square", detune: 5, partials: [1, 0.4] },           // Bright Acoustic Piano
      2: { type: "triangle", detune: 10, partials: [1, 0.6, 0.2] },    // Electric Grand Piano
      3: { type: "sawtooth", detune: 0, partials: [1, 0.3] },          // Honky-tonk Piano
      15: { type: "triangle", detune: 15, partials: [1, 0.7, 0.1] },   // Tubular Bells
      24: { type: "square", detune: -10, partials: [1, 0.5, 0.2] },    // Nylon String Guitar (Bandoneon approximation)
      110: { type: "sawtooth", detune: 20, partials: [1, 0.8, 0.4] },  // Bagpipe
      114: { type: "sine", detune: 25, partials: [1, 0.2] },           // Agogô
      123: { type: "square", detune: -20, partials: [1, 0.3, 0.1] }     // Sea Waves
    };
    this.volumeDb = 0;
    this.reverb = null;
    this.delay = null;
  }

  async init() {
    await Tone.start();
    // Initialize effects for richer sound
    this.reverb = new Tone.Reverb({ decay: 2, wet: 0.3 }).toDestination();
    this.delay = new Tone.PingPongDelay({ delayTime: "8n", feedback: 0.2, wet: 0.1 }).toDestination();
    this.#createSynth("sine");
  }

  #createSynth(type, options = {}) {
    if (this.synth) this.synth.dispose();
    const config = this.instrumentMap[this.instrumentNumber] || { type: "sine", detune: 0, partials: [1] };
    this.synth = new Tone.PolySynth(Tone.Synth, {
      oscillator: {
        type: config.type || type,
        detune: config.detune || 0,
        partials: config.partials || [1]
      },
      envelope: {
        attack: options.attack || 0.01,
        decay: options.decay || 0.1,
        sustain: options.sustain || 0.5,
        release: options.release || 0.5
      }
    }).connect(this.reverb).connect(this.delay).toDestination();
    this.synth.volume.value = this.volumeDb;
  }

  playNote(midiNote, durationSec) {
    if (midiNote === null) return;
    // Adjust envelope based on instrument for more realistic sound
    const options = this.#getEnvelopeOptions(this.instrumentNumber);
    if (this.synth.voices.every(v => !v.active)) {
      this.#createSynth(null, options); // Recreate only if no active voices to avoid glitches
    }
    this.synth.triggerAttackRelease(Tone.Frequency(midiNote, "midi"), durationSec);
  }

  #getEnvelopeOptions(program) {
    // Customize envelope based on instrument type for varied attack/release
    switch (program) {
      case 0: // Piano-like
        return { attack: 0.005, decay: 0.1, sustain: 0.3, release: 0.2 };
      case 15: // Bells
        return { attack: 0.01, decay: 0.2, sustain: 0.1, release: 1.5 };
      case 24: // Guitar/Bandoneon
        return { attack: 0.02, decay: 0.15, sustain: 0.4, release: 0.3 };
      case 110: // Bagpipe
        return { attack: 0.1, decay: 0.2, sustain: 0.8, release: 0.5 };
      case 123: // Sea Waves
        return { attack: 0.5, decay: 0.3, sustain: 0.7, release: 2.0 };
      default:
        return { attack: 0.01, decay: 0.1, sustain: 0.5, release: 0.5 };
    }
  }

  changeInstrument(program) {
    this.instrumentNumber = program;
    const options = this.#getEnvelopeOptions(program);
    this.#createSynth(null, options);
    // Adjust effects based on instrument
    this.reverb.wet.value = program === 123 ? 0.6 : program === 15 ? 0.5 : 0.3;
    this.delay.wet.value = program === 123 ? 0.4 : program === 110 ? 0.2 : 0.1;
  }

  setVolume(lvl) {
    this.volumeDb = Tone.gainToDb(lvl / 100);
    if (this.synth) this.synth.volume.value = this.volumeDb;
  }

  setBPM(b) {
    this.bpm = b;
    Tone.Transport.bpm.value = b;
  }

  setOctave(o) {
    this.octave = o;
  }

  stopAll() {
    if (this.synth) {
      this.synth.releaseAll();
      this.synth.dispose();
      this.synth = null;
    }
    if (this.reverb) {
      this.reverb.dispose();
      this.reverb = null;
    }
    if (this.delay) {
      this.delay.dispose();
      this.delay = null;
    }
  }
}
