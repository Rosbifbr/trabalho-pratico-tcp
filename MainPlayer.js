import TextParser from "./TextParser.js";
import MidiPlayer from "./MidiPlayer.js";

export default class MainPlayer {
  constructor(frontend) {
    this.frontend = frontend;
    this.midi = new MidiPlayer();
    this.parser = null;
    this.intervalId = null;
    this.total = 0;
    this.processed = 0;
  }

  async start(cfg) {
    if (!cfg.file) {
      alert("Selecione um arquivo .txt");
      return;
    }

    this.parser = new TextParser(cfg.file);
    await this.parser.open();
    this.total = this.parser.text.length;
    this.processed = 0;

    this.midi.init();
    this.midi.changeInstrument(cfg.instrument);
    this.midi.setVolume(cfg.volume);
    this.midi.setBPM(cfg.bpm);
    this.midi.setOctave(cfg.octave);

    this.frontend.updateState(cfg);
    this.frontend.showRunning();

    const beatMs = 60000 / cfg.bpm;

    this.intervalId = setInterval(() => {
      if (this.parser.isEOF()) return this.stop();
      const ch = this.parser.readNextChar();
      const note = this.#charToMidi(ch, cfg.octave);
      this.midi.playNote(note, beatMs / 1000);

      this.processed++;
      this.frontend.updateNoteDisplay(ch, note, this.processed, this.total);
    }, beatMs);
  }

  stop() {
    clearInterval(this.intervalId);
    this.intervalId = null;
    this.parser?.close();
    this.midi.stopAll();
    this.frontend.showStart();
  }

  #charToMidi(ch, oct) {
    const scale = [0, 2, 4, 5, 7, 9, 11]; // C-major degrees
    const u = ch.toUpperCase();
    if (u < "A" || u > "Z") return 0; // rest
    const idx = (u.charCodeAt(0) - 65) % scale.length;
    return 12 * oct + scale[idx];
  }
}
