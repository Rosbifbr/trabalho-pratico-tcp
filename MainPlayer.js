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

    let ch = this.parser.readNextChar();
    if (ch === null) { // Should only happen if parser was EOF from the start or became EOF
      this.stop();
      return;
    }
    // Initial increment for the first character read in this beat processing cycle.
    // This accounts for the character 'ch' that was just read from the parser.
    this.processedChars++;

    let result;
    // This loop processes an initial character and then, if indicated by
    // result.needsImmediateReprocess, fetches and processes subsequent characters immediately.
    // This is crucial for handling multi-character control sequences (e.g., "BPM+", "R+", "R-")
    // and ensuring that any character immediately following such a sequence is processed
    // without waiting for the next beat interval, making the sequence and its
    // subsequent character appear as part of a single continuous operation.
    do {
      result = this.#processChar(ch);

      console.log({
        idx: this.processedChars, // Log current total processed
        char: ch, // The character just processed
        pitch: result.pitch,
        needsReprocess: result.needsImmediateReprocess,
        instrument: this.currentInstrument,
        volume: this.currentVolume,
        octave: this.currentOctave,
        bpm: this.bpm
      });

      const currentBeatMs = 60000 / this.bpm;
      if (result.pitch !== null) {
        this.midi.playNote(result.pitch, currentBeatMs / 1000);
      }

      // Update note display for the character that was just processed
      this.frontend.updateNoteDisplay(ch, result.pitch ?? "-", this.processedChars, this.totalChars);

      if (result.needsImmediateReprocess && !this.parser.isEOF()) {
        ch = this.parser.readNextChar();
        if (ch === null) { // EOF reached during immediate reprocessing
          result.needsImmediateReprocess = false; // Ensure loop termination
        } else {
          // Increment for the new character that was just consumed from the parser
          // for immediate reprocessing within the same beat cycle.
          this.processedChars++;
        }
      } else {
        result.needsImmediateReprocess = false; // Ensure loop termination if EOF or no reprocessing needed
      }

    } while (result.needsImmediateReprocess);

    // Regular state update, including BPM and instrument name.
    // This happens once per beat, after all immediate characters for this beat are processed.
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

  /**
   * Processes a single character from the input stream and determines its musical effect.
   * @param {string} ch The character to process.
   * @returns {{pitch: number|null, needsImmediateReprocess: boolean}}
   *          An object containing:
   *          - `pitch`: The MIDI pitch value if the character represents a note, otherwise null.
   *          - `needsImmediateReprocess`: A boolean indicating whether `processNextCharacter`
   *            should immediately fetch and process the next character from the stream. This
   *            is true for completed multi-character control sequences like "BPM+", "R+", "R-",
   *            allowing the character immediately following them to be processed in the same beat.
   */
  #processChar(ch) {
    let pitch = null;
    let needsImmediateReprocess = false;
    const charUpper = ch.toUpperCase();
    const storedLastCharWasNoteGrapheme = this.lastCharWasNoteGrapheme;
    this.lastCharWasNoteGrapheme = false;

    // Refactored BPM+ sequence detection using peeking
    if (charUpper === 'B') {
      const p_char_peek = this.parser.peekCharAt(0);
      const m_char_peek = this.parser.peekCharAt(1);
      const plus_char_peek = this.parser.peekCharAt(2);

      // Explicitly check if all peeked characters are non-null before further checks
      if (p_char_peek !== null && m_char_peek !== null && plus_char_peek !== null) {
        if (p_char_peek.toUpperCase() === 'P' &&
            m_char_peek.toUpperCase() === 'M' &&
            plus_char_peek === '+') {

          // Full "BPM+" sequence detected. Consume ch ('B'), P, M, +
          // 'ch' (which is 'B') was already consumed by processNextCharacter.
          // Here, we consume the 'P', 'M', and '+' characters from the parser stream.
          this.parser.readNextChar(); // Consume P
          this.parser.readNextChar(); // Consume M
          this.parser.readNextChar(); // Consume +

          // Account for the 3 characters (P, M, +) just consumed from the parser.
          this.processedChars += 3;

          // Perform BPM change action
          this.bpm += 80;
          this.bpm = Math.max(30, this.bpm);
          this.mainLoopNeedsBPMUpdate = true;

          this.activeSequence = "";
          // Signal to immediately process the character following "BPM+".
          return { pitch: null, needsImmediateReprocess: true };
        }
      }
      // If not a full "BPM+" sequence, 'B' will fall through to normal note processing.
    }

    // Handling 'R' for octave changes (R+ or R-).
    // Rule 1: When 'R' is encountered (and no other sequence is active).
    if (this.activeSequence === "" && charUpper === 'R') {
      this.activeSequence = "R";
      // No note is played for 'R' itself.
      // Return needsImmediateReprocess: true to make processNextCharacter immediately
      // fetch the next character from the stream. This next character is expected
      // to be '+', '-', or another character that would break the R-sequence.
      // This allows for rapid processing of "R+", "R-", or "RX" (where X breaks sequence).
      return { pitch: null, needsImmediateReprocess: true };
    }

    // Rule 2: Processing the character *after* 'R' was just processed.
    if (this.activeSequence === "R") {
      // The current 'ch' is the character immediately following 'R'.
      const charAfterR = ch;
      // Reset activeSequence immediately, as 'R' has now been "consumed" conceptually
      // by leading to this point, regardless of whether ch forms R+ or R-.
      this.activeSequence = "";

      if (charAfterR === '+') {
        this.currentOctave = Math.min(8, this.currentOctave + 1);
        // "R+" sequence completed. Octave changed.
        // Return needsImmediateReprocess: true to immediately process the character
        // *following* the '+', e.g., a note in "R+C" or another command.
        return { pitch: null, needsImmediateReprocess: true };
      } else if (charAfterR === '-') {
        this.currentOctave = Math.max(1, this.currentOctave - 1);
        // "R-" sequence completed. Octave changed.
        // Return needsImmediateReprocess: true to immediately process the character
        // *following* the '-', e.g., a note in "R-C" or another command.
        return { pitch: null, needsImmediateReprocess: true };
      } else {
        // Active sequence was "R", but charAfterR is neither '+' nor '-'.
        // The R-sequence is broken.
        // `activeSequence` has already been reset to "".
        // We now re-process charAfterR as if 'R' was never there.
        // The charAfterR was already consumed by processNextCharacter in the loop.
        // The result of this reprocessing (which is an object {pitch, needsImmediateReprocess})
        // will be returned directly.
        return this.#processChar(charAfterR);
      }
    }

    // Note: The general `this.activeSequence = "";` line that was here previously
    // has been removed because the 'R' sequence logic now fully manages its state,
    // and other sequences (like "BPM+") also manage their own state or don't use activeSequence.

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
        // This case should ideally not happen with proper OIU handling
        // but as a fallback, change instrument and play a default note.
        this.currentInstrument = 125; // Placeholder for 'unknown' or 'default'
        this.midi.changeInstrument(this.currentInstrument);
        pitch = 72; // C5, as a fallback
      }
    } else if (ch === '?') {
      const noteKeys = Object.keys(this.noteValues);
      const randomNoteKey = noteKeys[Math.floor(Math.random() * noteKeys.length)];
      pitch = 12 * this.currentOctave + this.noteValues[randomNoteKey];
      this.lastPitch = pitch;
      this.lastCharWasNoteGrapheme = true;
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
      // ";" itself doesn't produce a note or need immediate reprocessing of the *next* char.
      // The BPM update is handled by the main loop schedulling.
    } else {
      // NOP for unrecognized characters
    }
    return { pitch: pitch, needsImmediateReprocess: needsImmediateReprocess };
  }
}
