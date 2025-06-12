export default class Frontend {
  constructor() {
    this.screenStart = document.getElementById("screen_start");
    this.screenRun = document.getElementById("screen_running");
    this.form = document.getElementById("configForm");
    this.btnStop = document.getElementById("btnStop");

    this.sInstrument = document.getElementById("statusInstrument");
    this.sVolume = document.getElementById("statusVolume");
    this.sBpm = document.getElementById("statusBpm"); // Added BPM status element
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
      // await Tone.start(); // Removed as soundfont-player uses standard AudioContext
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
    if (st.instrument !== undefined) this.sInstrument.textContent = st.instrument;
    if (st.volume !== undefined) this.sVolume.textContent = st.volume;
    if (st.octave !== undefined) this.sOctave.textContent = st.octave;
    if (st.bpm !== undefined) this.sBpm.textContent = st.bpm; // Update BPM display
  }

  updateNoteDisplay(ch, note, idx, total) {
    this.sNote.textContent = `${ch} (${note})`;
    this.sProgress.textContent = `${idx}/${total}`;
  }
}
