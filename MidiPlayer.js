export default class MidiPlayer {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.bpm = 120;
    this.instrument = 0;
    this.octave = 4;
  }

  init() {
    this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.8;
    this.master.connect(this.ctx.destination);
  }

  deinit() {
    this.ctx?.close();
    this.ctx = null;
  }

  playNote(note, duration) {
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();

    osc.type = "sine"; // placeholder timbre
    osc.frequency.value = 440 * Math.pow(2, (note - 69) / 12);

    g.gain.setValueAtTime(this.master.gain.value, this.ctx.currentTime);
    g.gain.linearRampToValueAtTime(0, this.ctx.currentTime + duration);

    osc.connect(g);
    g.connect(this.master);

    osc.start();
    osc.stop(this.ctx.currentTime + duration + 0.05);
  }

  changeInstrument(n) {
    this.instrument = n; // stub
  }

  setVolume(lvl) {
    if (this.master) this.master.gain.value = lvl / 100;
  }

  setBPM(b) {
    this.bpm = b;
  }

  setOctave(o) {
    this.octave = o;
  }

  stopAll() {
    this.deinit();
    this.init();
  }
}
