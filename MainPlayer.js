import TextParser from "./TextParser.js";
import MidiPlayer from "./MidiPlayer.js";

export default class MainPlayer {
  constructor(frontend) {
    this.frontend = frontend;
    this.midi = new MidiPlayer();
    this.parser = null;
    this.intervalId = null;

    // runtime state
    this.bpm = 120;
    this.defaultOctave = 4;
    this.currentOctave = 4;
    this.defaultVolume = 80;
    this.currentVolume = 80;
    this.currentInstrument = 0;
    this.instrumentList = [0, 40, 73, 25, 56]; // GM: Piano, Violin, Flute, Steel Guitar, Trumpet
    this.instrumentCycleIndex = -1;

    this.activeSequence = "";
    this.mainLoopNeedsBPMUpdate = false;

    this.noteValues = { 'A': 9, 'B': 11, 'C': 0, 'D': 2, 'E': 4, 'F': 5, 'G': 7 };
    this.lastCharWasNoteGrapheme = false;
    this.lastPitch = null;

    this.processedChars = 0;
    this.totalChars = 0;
  }

  async start(cfg) {
    if (!cfg.file) { alert("Selecione um arquivo .txt"); return; }

    this.parser = new TextParser(cfg.file);
    await this.parser.open();
    this.totalChars = this.parser.text.length;
    this.processedChars = 0;

    await this.midi.init();

    this.bpm = cfg.bpm;
    this.defaultOctave = cfg.octave;
    this.currentOctave = cfg.octave;
    this.defaultVolume = cfg.volume;
    this.currentVolume = cfg.volume;
    this.currentInstrument = cfg.instrument;

    this.instrumentCycleIndex = -1;
    this.activeSequence = "";
    this.mainLoopNeedsBPMUpdate = false;
    this.lastCharWasNoteGrapheme = false;
    this.lastPitch = null;

    this.midi.changeInstrument(this.currentInstrument);
    this.midi.setVolume(this.currentVolume);

    const initialInstrumentName = this.midi.getInstrumentName(this.currentInstrument);
    this.frontend.updateState({
      instrument: initialInstrumentName,
      volume: this.currentVolume,
      octave: this.currentOctave,
      bpm: this.bpm  // Initial BPM display
    });
    this.frontend.showRunning();

    const initialBeatMs = 60000 / this.bpm;
    this.intervalId = setInterval(() => this.processNextCharacter(), initialBeatMs);
  }

  processNextCharacter() {
    if (this.parser.isEOF()) {
      this.stop();
      return;
    }

    // Handle BPM changes before processing the next character
    if (this.mainLoopNeedsBPMUpdate) {
      clearInterval(this.intervalId);
      const newBeatMs = 60000 / this.bpm;
      this.intervalId = setInterval(() => this.processNextCharacter(), newBeatMs);
      this.mainLoopNeedsBPMUpdate = false;
      // Update BPM in UI immediately when it's processed
      this.frontend.updateState({ bpm: this.bpm });
      // The current character that might have triggered this will be processed in the *next* interval tick.
      // This is acceptable as per the subtask description.
    }

    const ch = this.parser.readNextChar();
    this.processedChars++;
    const note = this.#processChar(ch); // This might set mainLoopNeedsBPMUpdate to true

    // console.log({
    //   idx: this.processedChars,
    //   char: ch,
    //   note,
    //   instrument: this.currentInstrument,
    //   volume: this.currentVolume,
    //   octave: this.currentOctave,
    //   bpm: this.bpm
    // });

    // Use current BPM for note duration, even if a change is pending for the next interval
    const currentBeatMs = 60000 / this.bpm;
    if (note !== null) {
      this.midi.playNote(note, currentBeatMs / 1000);
    }

    this.frontend.updateNoteDisplay(ch, note ?? "-", this.processedChars, this.totalChars);

    // Regular state update, including BPM and instrument name
    const currentInstrumentName = this.midi.getInstrumentName(this.currentInstrument);
    this.frontend.updateState({
      instrument: currentInstrumentName,
      volume: this.currentVolume,
      octave: this.currentOctave,
      bpm: this.bpm
    });
  }

  stop() {
    clearInterval(this.intervalId);
    this.intervalId = null;
    this.parser?.close();
    this.midi.stopAll();
    this.lastPitch = null;
    this.frontend.showStart();
    this.activeSequence = "";
    this.mainLoopNeedsBPMUpdate = false;
    this.lastCharWasNoteGrapheme = false;
    this.processedChars = 0; // Reset for next run
    this.totalChars = 0;
  }

  #processChar(ch) {
    let pitch = null;
    const charUpper = ch.toUpperCase();
    const storedLastCharWasNoteGrapheme = this.lastCharWasNoteGrapheme;
    this.lastCharWasNoteGrapheme = false;

    if (this.activeSequence === "" && charUpper === 'R') {
      this.activeSequence = "R";
      return null;
    }
    if (this.activeSequence === "R") {
      this.activeSequence = "";
      if (ch === '+') {
        this.currentOctave = Math.min(8, this.currentOctave + 1);
      } else if (ch === '-') {
        this.currentOctave = Math.max(1, this.currentOctave - 1);
      } else {
        return this.#processChar(ch);
      }
      return null;
    }

    if (this.activeSequence === "" && charUpper === 'B') {
      this.activeSequence = "B";
      return null;
    }
    if (this.activeSequence === "B") {
      if (charUpper === 'P') {
        this.activeSequence = "BP";
      } else {
        this.activeSequence = "";
        return this.#processChar(ch);
      }
      return null;
    }
    if (this.activeSequence === "BP") {
      if (charUpper === 'M') {
        this.activeSequence = "BPM";
      } else {
        this.activeSequence = "";
        return this.#processChar(ch);
      }
      return null;
    }
    if (this.activeSequence === "BPM") {
      this.activeSequence = "";
      if (ch === '+') {
        this.bpm += 80;
        this.bpm = Math.max(30, this.bpm);
        this.mainLoopNeedsBPMUpdate = true;
      } else {
        return this.#processChar(ch);
      }
      return null;
    }
    this.activeSequence = "";

    if (charUpper in this.noteValues) {
      pitch = 12 * this.currentOctave + this.noteValues[charUpper];
      this.lastPitch = pitch;
      this.lastCharWasNoteGrapheme = true;
    } else if (ch === ' ') {
      // Silence
    } else if (ch === '+') {
      this.currentVolume = Math.min(100, this.currentVolume * 2);
      this.midi.setVolume(this.currentVolume);
    } else if (ch === '-') {
      this.currentVolume = this.defaultVolume;
      this.midi.setVolume(this.currentVolume);
    } else if (['O', 'I', 'U'].includes(charUpper)) {
      if (storedLastCharWasNoteGrapheme && this.lastPitch !== null) {
        pitch = this.lastPitch;
        this.lastCharWasNoteGrapheme = true;
      } else {
        this.currentInstrument = 125;
        this.midi.changeInstrument(this.currentInstrument);
        pitch = 72; // C5
      }
    } else if (ch === '?') {
      const noteKeys = Object.keys(this.noteValues);
      const randomNoteKey = noteKeys[Math.floor(Math.random() * noteKeys.length)];
      pitch = 12 * this.currentOctave + this.noteValues[randomNoteKey];
      this.lastPitch = pitch;
    } else if (ch === '\n' || ch === '\r') {
      let currentDefaultListIndex = this.instrumentList.indexOf(this.currentInstrument);
      if (this.instrumentCycleIndex === -1 && currentDefaultListIndex !== -1) {
         this.instrumentCycleIndex = currentDefaultListIndex;
      }
      this.instrumentCycleIndex = (this.instrumentCycleIndex + 1) % this.instrumentList.length;
      this.currentInstrument = this.instrumentList[this.instrumentCycleIndex];
      this.midi.changeInstrument(this.currentInstrument);
    } else if (ch === ';') {
      this.bpm = Math.floor(Math.random() * (180 - 60 + 1)) + 60;
      this.mainLoopNeedsBPMUpdate = true;
    } else {
      // NOP
    }
    return pitch;
  }
}
