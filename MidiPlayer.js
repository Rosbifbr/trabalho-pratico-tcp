import * as Tone from 'https://cdn.jsdelivr.net/npm/tone@15.1.22/+esm';

export default class MidiPlayer {
  constructor() {
    this.synth = null;
    this.bpm = 120;
    this.octave = 4;
    this.instrumentNumber = 0;
    // Oscillator approximations for selected GM programs
    this.instrumentMap = {
      0: 'sine',
      1: 'square',
      2: 'triangle',
      3: 'sawtooth',
      15: 'triangle',  // Tubular Bells
      24: 'square',    // Bandoneon
      110: 'sawtooth', // Bagpipe
      114: 'sine',     // Agogô
      123: 'square'    // Sea Waves
    };
    this.volumeDb = 0;
  }

  async init() {
    await Tone.start();
    this.#createSynth('sine');
  }

  #createSynth(type) {
    if (this.synth) this.synth.dispose();
    this.synth = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type }
    }).toDestination();
    this.synth.volume.value = this.volumeDb;
  }

  playNote(midiNote, durationSec) {
    if (midiNote === null) return;
    this.synth.triggerAttackRelease(Tone.Frequency(midiNote, 'midi'), durationSec);
  }

  changeInstrument(program) {
    this.instrumentNumber = program;
    const type = this.instrumentMap[program] || 'sine';
    this.#createSynth(type);
  }

  setVolume(lvl) {
    this.volumeDb = Tone.gainToDb(lvl / 100);
    if (this.synth) this.synth.volume.value = this.volumeDb;
  }

  setBPM(b) {
    this.bpm = b;
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
  }
}
