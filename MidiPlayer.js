// MidiPlayer.js using soundfont-player
export default class MidiPlayer {
  constructor() {
    this.audioContext = null;
    this.instrumentPlayer = null;
    this.gainValue = 1.0; // Default volume 100%
    this.instrumentNumber = 0; // Default to Acoustic Grand Piano

    this.midiToSoundfontName = {
      0: 'acoustic_grand_piano',
      15: 'tubular_bells',
      24: 'acoustic_guitar_nylon', // Placeholder for Bandoneon
      110: 'bagpipe',
      114: 'agogo',
      123: 'seashore', // Placeholder for Sea Waves
      125: 'telephone_ring',
      // Add more mappings as needed
    };
  }

  init() {
    if (!this.audioContext) {
      this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }
    this.gainValue = 1.0; // Reset gain value on init
    // Ensure an instrument is loaded by default, e.g., piano
    if (!this.instrumentPlayer) {
      this.changeInstrument(this.instrumentNumber);
    }
  }

  changeInstrument(midiProgramNumber) {
    if (!this.audioContext) {
      this.init(); // Ensure AudioContext is initialized
    }

    const instrumentName = this.midiToSoundfontName[midiProgramNumber] || this.midiToSoundfontName[0];

    // Before loading a new instrument, stop any existing player to free up resources
    if (this.instrumentPlayer) {
        this.instrumentPlayer.stop();
    }

    Soundfont.instrument(this.audioContext, instrumentName, { soundfont: 'FluidR3_GM', gain: this.gainValue })
      .then(player => {
        this.instrumentPlayer = player;
        // console.log(`Instrument ${instrumentName} loaded.`);
      })
      .catch(err => {
        console.error('Failed to load instrument:', instrumentName, err);
        // Fallback to default instrument if loading fails
        if (midiProgramNumber !== 0) { // Avoid infinite loop if default also fails
            this.changeInstrument(0);
        }
      });
    this.instrumentNumber = midiProgramNumber; // Keep track of the current MIDI program number
  }

  playNote(midiNote, durationSec) {
    // Log the received midiNote and other relevant parameters
    console.log(`MidiPlayer.playNote: midiNote=${midiNote}, durationSec=${durationSec}, instrumentGain=${this.gainValue}, audioContextState=${this.audioContext?.state}`);

    if (this.instrumentPlayer && midiNote !== null) {
      // Ensure audio context is running (e.g., after user interaction)
      if (this.audioContext.state === 'suspended') {
        this.audioContext.resume();
      }
      this.instrumentPlayer.play(midiNote, this.audioContext.currentTime, { duration: durationSec, gain: this.gainValue });
    } else if (!this.instrumentPlayer) {
      console.warn(`MidiPlayer.playNote: Instrument not loaded. Note ${midiNote} not played.`);
    } else if (midiNote === null) {
      // This case should ideally not happen if MainPlayer filters null notes, but log if it does.
      console.log("MidiPlayer.playNote: Received null midiNote. No note played.");
    }
  }

  setVolume(volumePercentage) {
    this.gainValue = Math.max(0, Math.min(1, volumePercentage / 100));
    // The gain is applied when loading the instrument or playing a note.
    // If an instrument is already loaded and we want to change its volume for currently playing/future notes,
    // we might need to either reload it or use a GainNode.
    // For simplicity, this new volume will primarily affect notes played after this setting is changed,
    // and instruments loaded after this change.
    // If dynamic volume change for already loaded instrument is critical,
    // a GainNode approach would be better:
    // 1. In init(): Create a masterGain node, connect it to audioContext.destination.
    //    this.masterGain = this.audioContext.createGain();
    //    this.masterGain.gain.value = this.gainValue;
    //    this.masterGain.connect(this.audioContext.destination);
    // 2. In changeInstrument(): Connect the loaded player to this.masterGain instead of audioContext.destination.
    //    Soundfont.instrument(..., { destination: this.masterGain })
    // 3. In setVolume(): Update this.masterGain.gain.value.
    //    this.masterGain.gain.setValueAtTime(this.gainValue, this.audioContext.currentTime);
    // This current implementation applies gain at play() time, which is simpler.
    if (this.instrumentPlayer) {
        // To make volume changes more immediate for future notes without reloading the instrument,
        // we can update the gain property if the player supports it directly,
        // or rely on the gain parameter in play() method.
        // Soundfont-player's play() takes a gain option, so this.gainValue will be used.
    }
  }

  // setBPM method is removed as BPM is handled by MainPlayer.js

  setOctave(o) {
    // This method might be relevant for adjusting midiNote values before playing,
    // if octave adjustments are not handled by the note generation logic itself.
    // For now, assuming MainPlayer.js or TextParser.js handles octave logic.
    // If MidiPlayer needs to adjust notes based on an octave setting, implement here.
    // Example: this.octave = o; // Store octave if needed for note adjustment.
  }

  stopAll() {
    if (this.instrumentPlayer) {
      this.instrumentPlayer.stop(); // Stops all currently playing notes on this instrument
    }
    // If using a masterGain node that might hold onto resources, consider disconnecting.
    // if (this.masterGain) {
    //   this.masterGain.disconnect();
    // }
    // To truly stop and release all audio resources, the AudioContext might need to be closed.
    // However, this is usually managed by the lifecycle of the application, not just stopping notes.
    // if (this.audioContext) {
    //   this.audioContext.close().then(() => {
    //     this.audioContext = null;
    //   });
    // }
  }

  getInstrumentName(midiProgramNumber) {
    // Replace underscores with spaces and capitalize words for better display
    const rawName = this.midiToSoundfontName[midiProgramNumber];
    if (rawName) {
      return rawName.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
    }
    // Fallback for unknown instruments or if default is needed
    const defaultRawName = this.midiToSoundfontName[0]; // Default to acoustic_grand_piano if number not found
    if (defaultRawName) {
        return defaultRawName.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ') + ` (GM#${midiProgramNumber})`;
    }
    return `GM#${midiProgramNumber}`; // Absolute fallback
  }
}
