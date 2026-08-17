// Web Audio API Synthesizer for Paranormal EMF Tracker
// Generates real-time sound effects: EMF hum, Geiger clicks, EVP static, alarms, and UI sweeps.

class AudioController {
  private ctx: AudioContext | null = null;
  
  // Oscillators and nodes for the EMF hum
  private humOsc: OscillatorNode | null = null;
  private humGain: GainNode | null = null;
  private humFilter: BiquadFilterNode | null = null;
  
  // EVP Static sound
  private staticGain: GainNode | null = null;
  private staticFilter: BiquadFilterNode | null = null;
  private staticBufferSource: AudioBufferSourceNode | null = null;

  // Geiger Click interval timer
  private geigerInterval: NodeJS.Timeout | null = null;
  private currentEMF = 0;
  private isMuted = false;
  private volume = 0.5;

  // Alarm sound
  private alarmOsc: OscillatorNode | null = null;
  private alarmGain: GainNode | null = null;
  private alarmInterval: NodeJS.Timeout | null = null;
  private isAlarmPlaying = false;

  constructor() {
    // AudioContext will be initialized on user interaction
  }

  init() {
    if (this.ctx) return;
    
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      this.ctx = new AudioCtx();
      
      this.setupEMFHum();
      this.setupEVPStatic();
      this.startGeigerClicks();
    } catch (e) {
      console.error("Web Audio API is not supported in this browser", e);
    }
  }

  private setupEMFHum() {
    if (!this.ctx) return;

    // Create low hum for ambient EMF
    this.humOsc = this.ctx.createOscillator();
    this.humGain = this.ctx.createGain();
    this.humFilter = this.ctx.createBiquadFilter();

    this.humOsc.type = 'sawtooth';
    this.humOsc.frequency.setValueAtTime(55, this.ctx.currentTime); // A1 note (55Hz)

    this.humFilter.type = 'lowpass';
    this.humFilter.frequency.setValueAtTime(120, this.ctx.currentTime);
    this.humFilter.Q.setValueAtTime(5, this.ctx.currentTime);

    this.humGain.gain.setValueAtTime(0.02, this.ctx.currentTime); // Quiet background hum

    // Connect: Osc -> Filter -> Gain -> Destination
    this.humOsc.connect(this.humFilter);
    this.humFilter.connect(this.humGain);
    this.humGain.connect(this.ctx.destination);

    this.humOsc.start();
  }

  private setupEVPStatic() {
    if (!this.ctx) return;

    // Generate white noise buffer
    const bufferSize = 2 * this.ctx.sampleRate;
    const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      output[i] = Math.random() * 2 - 1;
    }

    this.staticBufferSource = this.ctx.createBufferSource();
    this.staticBufferSource.buffer = noiseBuffer;
    this.staticBufferSource.loop = true;

    this.staticFilter = this.ctx.createBiquadFilter();
    this.staticFilter.type = 'bandpass';
    this.staticFilter.frequency.setValueAtTime(1000, this.ctx.currentTime);
    this.staticFilter.Q.setValueAtTime(1.0, this.ctx.currentTime);

    this.staticGain = this.ctx.createGain();
    this.staticGain.gain.setValueAtTime(0.005, this.ctx.currentTime); // Very quiet default static

    this.staticBufferSource.connect(this.staticFilter);
    this.staticFilter.connect(this.staticGain);
    this.staticGain.connect(this.ctx.destination);

    this.staticBufferSource.start();
  }

  private startGeigerClicks() {
    const clickLoop = () => {
      if (this.isMuted || !this.ctx || this.ctx.state === 'suspended') {
        this.geigerInterval = setTimeout(clickLoop, 1000);
        return;
      }

      // Play click
      this.playClickSound();

      // Determine next click interval based on EMF levels
      // EMF range: 0 to 100 mG.
      // 0 mG -> click every 1.5 - 2.5 seconds (background radiation)
      // 100 mG -> click every 15-30ms (rapid crackle)
      let interval = 2000;
      if (this.currentEMF > 0.5) {
        const factor = Math.min(this.currentEMF / 50, 1); // Cap at 50mG for max speed
        interval = 2000 - factor * 1970; // Map down to 30ms
        // Add jitter
        interval = interval * (0.8 + Math.random() * 0.4);
      } else {
        // Occasional background click
        interval = 1000 + Math.random() * 3000;
      }

      this.geigerInterval = setTimeout(clickLoop, interval);
    };

    clickLoop();
  }

  private playClickSound() {
    if (!this.ctx || this.isMuted) return;

    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const filter = this.ctx.createBiquadFilter();

      osc.type = 'triangle';
      // Pitch goes up slightly with higher EMF
      const baseFreq = 800 + Math.min(this.currentEMF * 10, 1000);
      osc.frequency.setValueAtTime(baseFreq, this.ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(100, this.ctx.currentTime + 0.015);

      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(1500, this.ctx.currentTime);

      // Gain envelope
      const clickVol = 0.08 * this.volume * (0.6 + Math.random() * 0.4);
      gain.gain.setValueAtTime(clickVol, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + 0.015);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start();
      osc.stop(this.ctx.currentTime + 0.02);
    } catch (e) {
      // Ignore audio glitches
    }
  }

  setEMFLevel(level: number) {
    this.currentEMF = level;
    if (!this.ctx || this.isMuted) return;

    const time = this.ctx.currentTime;

    // Adjust EMF Hum pitch and volume based on level
    if (this.humOsc && this.humGain && this.humFilter) {
      // Base frequency 55Hz (A1) ramps up to 110Hz (A2) with higher EMF
      const targetFreq = 55 + Math.min(level * 1.5, 110);
      this.humOsc.frequency.setTargetAtTime(targetFreq, time, 0.1);

      // Filter opens up (sounds brighter/harsher)
      const targetFilterFreq = 120 + Math.min(level * 8, 800);
      this.humFilter.frequency.setTargetAtTime(targetFilterFreq, time, 0.1);

      // Volume increases slightly with EMF
      const targetVol = (0.015 + Math.min(level / 200, 0.06)) * this.volume;
      this.humGain.gain.setTargetAtTime(targetVol, time, 0.1);
    }

    // Adjust background static crackle
    if (this.staticGain && this.staticFilter) {
      // Static becomes louder and higher pitched with EMF
      const targetStaticVol = (0.003 + Math.min(level / 500, 0.025)) * this.volume;
      this.staticGain.gain.setTargetAtTime(targetStaticVol, time, 0.2);

      const targetStaticFreq = 800 + Math.min(level * 20, 3000);
      this.staticFilter.frequency.setTargetAtTime(targetStaticFreq, time, 0.2);
    }

    // Alarm management
    if (level >= 15.0) {
      this.startAlarm();
    } else {
      this.stopAlarm();
    }
  }

  setEVPActive(active: boolean) {
    if (!this.ctx || this.isMuted) return;
    const time = this.ctx.currentTime;

    if (this.staticGain && this.staticFilter) {
      if (active) {
        // Loud, sweepy, bandpassed radio static
        this.staticGain.gain.setTargetAtTime(0.12 * this.volume, time, 0.1);
        this.staticFilter.frequency.setTargetAtTime(1200, time, 0.1);
        this.staticFilter.Q.setTargetAtTime(12.0, time, 0.1); // Narrow bandpass for "tuning" sound
      } else {
        // Return to normal
        const normalVol = (0.003 + Math.min(this.currentEMF / 500, 0.025)) * this.volume;
        this.staticGain.gain.setTargetAtTime(normalVol, time, 0.3);
        this.staticFilter.frequency.setTargetAtTime(1000, time, 0.3);
        this.staticFilter.Q.setTargetAtTime(1.0, time, 0.3);
      }
    }
  }

  private startAlarm() {
    if (this.isAlarmPlaying || !this.ctx || this.isMuted) return;
    this.isAlarmPlaying = true;

    const playBeep = () => {
      if (!this.isAlarmPlaying || !this.ctx || this.isMuted) return;

      try {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'sine';
        // Pitch rises with intensity of EMF
        const pitch = 1200 + Math.min((this.currentEMF - 15) * 15, 800);
        osc.frequency.setValueAtTime(pitch, this.ctx.currentTime);

        gain.gain.setValueAtTime(0.08 * this.volume, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + 0.15);

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        osc.start();
        osc.stop(this.ctx.currentTime + 0.18);
      } catch (e) {
        // Ignore audio errors
      }

      // Faster alarm intervals for higher EMF
      const alarmSpeed = Math.max(150, 450 - (this.currentEMF - 15) * 5);
      this.alarmInterval = setTimeout(playBeep, alarmSpeed);
    };

    playBeep();
  }

  private stopAlarm() {
    if (!this.isAlarmPlaying) return;
    this.isAlarmPlaying = false;
    if (this.alarmInterval) {
      clearTimeout(this.alarmInterval);
      this.alarmInterval = null;
    }
  }

  // Plays a dramatic power up sound effect
  playPowerUp() {
    if (!this.ctx || this.isMuted) return;

    const time = this.ctx.currentTime;
    try {
      // 1. A deep low frequency sweep rising up
      const osc1 = this.ctx.createOscillator();
      const gain1 = this.ctx.createGain();
      osc1.type = 'sawtooth';
      osc1.frequency.setValueAtTime(30, time);
      osc1.frequency.exponentialRampToValueAtTime(220, time + 1.2);

      const filter1 = this.ctx.createBiquadFilter();
      filter1.type = 'lowpass';
      filter1.frequency.setValueAtTime(80, time);
      filter1.frequency.exponentialRampToValueAtTime(800, time + 1.2);

      gain1.gain.setValueAtTime(0.001, time);
      gain1.gain.exponentialRampToValueAtTime(0.12 * this.volume, time + 0.4);
      gain1.gain.exponentialRampToValueAtTime(0.0001, time + 1.5);

      osc1.connect(filter1);
      filter1.connect(gain1);
      gain1.connect(this.ctx.destination);

      // 2. High frequency diagnostic tones
      const osc2 = this.ctx.createOscillator();
      const gain2 = this.ctx.createGain();
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(1000, time + 0.3);
      osc2.frequency.setValueAtTime(1500, time + 0.5);
      osc2.frequency.setValueAtTime(2000, time + 0.7);

      gain2.gain.setValueAtTime(0.0001, time);
      gain2.gain.setValueAtTime(0.03 * this.volume, time + 0.3);
      gain2.gain.setValueAtTime(0.0001, time + 0.45);
      gain2.gain.setValueAtTime(0.03 * this.volume, time + 0.5);
      gain2.gain.setValueAtTime(0.0001, time + 0.65);
      gain2.gain.setValueAtTime(0.03 * this.volume, time + 0.7);
      gain2.gain.exponentialRampToValueAtTime(0.0001, time + 1.2);

      osc2.connect(gain2);
      gain2.connect(this.ctx.destination);

      osc1.start(time);
      osc1.stop(time + 1.6);
      osc2.start(time + 0.3);
      osc2.stop(time + 1.3);
    } catch (e) {
      console.error(e);
    }
  }

  // Plays a cinematic winding-down sound
  playPowerDown() {
    if (!this.ctx || this.isMuted) return;

    const time = this.ctx.currentTime;
    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(110, time);
      osc.frequency.exponentialRampToValueAtTime(20, time + 0.8);

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(300, time);
      filter.frequency.exponentialRampToValueAtTime(40, time + 0.8);

      gain.gain.setValueAtTime(0.1 * this.volume, time);
      gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.85);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(time);
      osc.stop(time + 0.9);
    } catch (e) {
      console.error(e);
    }
  }

  // Plays simple diagnostic tick
  playDiagnosticBeep(success = true) {
    if (!this.ctx || this.isMuted) return;
    const time = this.ctx.currentTime;
    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(success ? 1800 : 400, time);
      if (!success) {
        osc.frequency.linearRampToValueAtTime(250, time + 0.25);
      }
      gain.gain.setValueAtTime(0.05 * this.volume, time);
      gain.gain.exponentialRampToValueAtTime(0.0001, time + (success ? 0.08 : 0.3));

      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(time);
      osc.stop(time + (success ? 0.1 : 0.35));
    } catch (e) {}
  }

  // Trigger scary ghost ambient sound during simulate haunting
  playHauntingScream() {
    if (!this.ctx || this.isMuted) return;
    const time = this.ctx.currentTime;
    try {
      // Create a complex eerie sound
      const baseOsc = this.ctx.createOscillator();
      const modOsc = this.ctx.createOscillator();
      const modGain = this.ctx.createGain();
      const mainGain = this.ctx.createGain();
      const filter = this.ctx.createBiquadFilter();

      baseOsc.type = 'sawtooth';
      baseOsc.frequency.setValueAtTime(120, time);
      baseOsc.frequency.linearRampToValueAtTime(80, time + 1.5);
      baseOsc.frequency.exponentialRampToValueAtTime(40, time + 3.0);

      modOsc.type = 'sine';
      modOsc.frequency.setValueAtTime(8, time); // LFO at 8Hz for wobble
      modOsc.frequency.linearRampToValueAtTime(25, time + 2.0);

      modGain.gain.setValueAtTime(50, time); // Wobble depth (FM synthesis)

      filter.type = 'peaking';
      filter.frequency.setValueAtTime(500, time);
      filter.frequency.exponentialRampToValueAtTime(2000, time + 1.5);
      filter.frequency.exponentialRampToValueAtTime(300, time + 3.0);
      filter.Q.setValueAtTime(8.0, time);

      mainGain.gain.setValueAtTime(0.001, time);
      mainGain.gain.exponentialRampToValueAtTime(0.12 * this.volume, time + 0.5);
      mainGain.gain.exponentialRampToValueAtTime(0.08 * this.volume, time + 1.8);
      mainGain.gain.exponentialRampToValueAtTime(0.0001, time + 3.5);

      // Connect FM synthesis: modOsc -> modGain -> baseOsc.frequency
      modOsc.connect(modGain);
      modGain.connect(baseOsc.frequency);

      baseOsc.connect(filter);
      filter.connect(mainGain);
      mainGain.connect(this.ctx.destination);

      modOsc.start(time);
      baseOsc.start(time);

      modOsc.stop(time + 3.6);
      baseOsc.stop(time + 3.6);
    } catch (e) {}
  }

  setVolume(vol: number) {
    this.volume = vol;
    // Apply immediately to hum and static
    if (this.ctx) {
      const time = this.ctx.currentTime;
      if (this.humGain) {
        const humVol = (0.015 + Math.min(this.currentEMF / 200, 0.06)) * vol;
        this.humGain.gain.setTargetAtTime(humVol, time, 0.1);
      }
      if (this.staticGain) {
        const staticVol = (0.003 + Math.min(this.currentEMF / 500, 0.025)) * vol;
        this.staticGain.gain.setTargetAtTime(staticVol, time, 0.1);
      }
    }
  }

  setMute(muted: boolean) {
    this.isMuted = muted;
    if (muted) {
      this.stopAlarm();
      if (this.humGain) this.humGain.gain.setValueAtTime(0, this.ctx?.currentTime || 0);
      if (this.staticGain) this.staticGain.gain.setValueAtTime(0, this.ctx?.currentTime || 0);
    } else {
      this.setEMFLevel(this.currentEMF);
    }
  }

  getIsMuted() {
    return this.isMuted;
  }
}

export const audioService = new AudioController();
