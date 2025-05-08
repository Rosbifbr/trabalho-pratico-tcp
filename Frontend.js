import * as Tone from 'https://cdn.jsdelivr.net/npm/tone@15.1.22/+esm';

export default class Frontend {
  constructor() {
    this.screenStart = document.getElementById("screen_start");
    this.screenRun = document.getElementById("screen_running");
    this.form = document.getElementById("configForm");
    this.btnStop = document.getElementById("btnStop");

    this.sInstrument = document.getElementById("statusInstrument");
    this.sVolume = document.getElementById("statusVolume");
    this.sNote = document.getElementById("statusNote");
    this.sOctave = document.getElementById("statusOctave");
    this.sProgress = document.getElementById("statusProgress");

    this.cbStart = null;
    this.cbStop = null;
  }

  initUI() {
    this.form.addEventListener("submit", async (e) => {
      e.preventDefault();
      // Unlock AudioContext while still inside the user-gesture event stack
      await Tone.start();
      this.cbStart?.(this.#collectConfig());
    });
    this.btnStop.addEventListener("click", () => this.cbStop?.());
  }

  #collectConfig() {
    return {
      file: document.getElementById("textFile").files[0] || null,
      instrument: +document.getElementById("instrument").value,
      volume: +document.getElementById("volume").value,
      bpm: +document.getElementById("bpm").value,
      octave: +document.getElementById("octave").value,
    };
  }

  onStart(cb) {
    this.cbStart = cb;
  }
  onStop(cb) {
    this.cbStop = cb;
  }

  showRunning() {
    this.screenStart.classList.remove("visible");
    this.screenRun.classList.add("visible");
  }

  showStart() {
    this.screenRun.classList.remove("visible");
    this.screenStart.classList.add("visible");
  }

  updateState(st) {
    this.sInstrument.textContent = st.instrument;
    this.sVolume.textContent = st.volume;
    this.sOctave.textContent = st.octave;
  }

  updateNoteDisplay(ch, note, idx, total) {
    this.sNote.textContent = `${ch} (${note})`;
    this.sProgress.textContent = `${idx}/${total}`;
  }
}
