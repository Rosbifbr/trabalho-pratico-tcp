import TextParser from "./TextParser.js";
import MidiPlayer from "./MidiPlayer.js";

export default class MainPlayer {
  constructor(frontend) {
    this.frontend = frontend;
    this.midi = new MidiPlayer();
    this.parser = null;
    this.intervalId = null;

    // runtime state
    this.defaultOctave = 4;
    this.currentOctave = 4;
    this.currentInstrument = 0;
    this.currentVolume = 100;
    this.lastPitch = null;      // absolute MIDI value of last played note
    this.prevWasNote = false;
  }

  async start(cfg) {
    if (!cfg.file) { alert("Selecione um arquivo .txt"); return; }

    this.parser = new TextParser(cfg.file);
    await this.parser.open();
    const total = this.parser.text.length;
    let processed = 0;

    await this.midi.init();

    this.defaultOctave = cfg.octave;
    this.currentOctave = cfg.octave;
    this.currentInstrument = cfg.instrument;
    this.currentVolume = cfg.volume;

    this.midi.changeInstrument(this.currentInstrument);
    this.midi.setVolume(this.currentVolume);
    this.midi.setBPM(cfg.bpm);

    this.frontend.updateState({ instrument: this.currentInstrument, volume: this.currentVolume, octave: this.currentOctave });
    this.frontend.showRunning();

    const beatMs = 60000 / cfg.bpm;

    this.intervalId = setInterval(() => {
      if (this.parser.isEOF()) return this.stop();

      const ch = this.parser.readNextChar();
      const note = this.#processChar(ch);

      console.log({ idx: ++processed, char: ch, note, instrument: this.currentInstrument, volume: this.currentVolume, octave: this.currentOctave });

      this.midi.playNote(note, beatMs / 1000);
      this.frontend.updateNoteDisplay(ch, note ?? "-", processed, total);
      this.frontend.updateState({ instrument: this.currentInstrument, volume: this.currentVolume, octave: this.currentOctave });
    }, beatMs);
  }

  stop() {
    clearInterval(this.intervalId);
    this.intervalId = null;
    this.parser?.close();
    this.midi.stopAll();
    this.lastPitch = null;
    this.frontend.showStart();
  }

  /* ---------- mapping logic ---------- */
  #processChar(ch) {
    let pitch = null;
    const isDigit = (c) => c >= "0" && c <= "9";

    const noteMap = { A: 9, B: 11, C: 0, D: 2, E: 4, F: 5, G: 7, H: 10 }; // semitones from C - Major + Minor 7th
    const upper = ch.toUpperCase();

    // Upper-case letters A-H → notes
    if ("ABCDEFGH".includes(upper) && ch === upper) {
      pitch = 12 * this.currentOctave + noteMap[upper];

      // keep strictly ascending ─ raise an octave when needed
      if (this.lastPitch !== null && pitch <= this.lastPitch) {
        pitch += 12;
        this.currentOctave = Math.floor(pitch / 12);
      }

      this.lastPitch = pitch;
      this.prevWasNote = true;
      return pitch;
    }

    // lower-case a-h → silence
    if ("abcdefgh".includes(ch)) { this.prevWasNote = false; return null; }

    // space → double volume (cap at 100)
    if (ch === " ") {
      this.currentVolume = Math.min(this.currentVolume * 2, 100);
      this.midi.setVolume(this.currentVolume);
      this.prevWasNote = false;
      return null;
    }

    // ! → Bandoneon #24
    if (ch === "!") return this.#setInstrument(24);

    // vowels O/o I/i U/u → Bagpipe #110
    if ("OIUoiu".includes(ch)) return this.#setInstrument(110);

    // even digit → add digit to current GM program
    if (isDigit(ch) && Number(ch) % 2 === 0) return this.#setInstrument((this.currentInstrument + Number(ch)) % 128);

    // ? or . → raise one octave (wrap to default)
    if (ch === "?" || ch === ".") {
      this.currentOctave = this.currentOctave < 8 ? this.currentOctave + 1 : this.defaultOctave;
      this.prevWasNote = false;
      return null;
    }

    // newline → Sea Waves #123
    if (ch === "\n" || ch === "\r") return this.#setInstrument(123);

    // ; or odd digit → Tubular Bells #15
    if (ch === ";" || (isDigit(ch) && Number(ch) % 2 === 1)) return this.#setInstrument(15);

    // , → Agogô #114
    if (ch === ",") return this.#setInstrument(114);

    // other consonants
    if (this.prevWasNote && this.lastPitch !== null) {
      pitch = this.lastPitch;
    } else {
      this.prevWasNote = false;
    }
    return pitch;
  }

  #setInstrument(program) {
    if (program !== this.currentInstrument) {
      this.currentInstrument = program;
      this.midi.changeInstrument(program);
    }
    this.prevWasNote = false;
    return null;
  }
}
