
export class AudioController {
  private ctx: AudioContext | null = null;
  private isPlaying = false;
  private tempo = 140; // Slightly slower for more groove
  private nextNoteTime = 0;
  private current16thNote = 0;
  private measureCount = 0;
  private schedulerTimer: number | null = null;
  private lookahead = 25.0; // ms
  private scheduleAheadTime = 0.1; // s
  private noiseBuffer: AudioBuffer | null = null;

  // Theme A: Energetic C Minor
  private melodyA = [
    523.25, 0, 523.25, 392.00, 523.25, 0, 587.33, 0, 
    622.25, 0, 622.25, 587.33, 523.25, 587.33, 392.00, 0,
    466.16, 0, 466.16, 349.23, 466.16, 0, 523.25, 0,
    587.33, 0, 587.33, 523.25, 466.16, 523.25, 349.23, 0
  ];

  // Theme B: Variation / Bridge
  private melodyB = [
    392.00, 392.00, 415.30, 0, 392.00, 0, 349.23, 0,
    311.13, 0, 311.13, 349.23, 392.00, 0, 0, 0,
    349.23, 349.23, 392.00, 0, 349.23, 0, 311.13, 0,
    293.66, 0, 261.63, 0, 196.00, 0, 0, 0
  ];
  
  private bassLine = [
    130.81, 130.81, 0, 130.81, 130.81, 0, 130.81, 130.81,
    155.56, 155.56, 0, 155.56, 155.56, 0, 155.56, 155.56,
    116.54, 116.54, 0, 116.54, 116.54, 0, 116.54, 116.54,
    98.00, 98.00, 0, 98.00, 87.31, 0, 0, 0
  ];

  constructor() {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (AudioContextClass) {
        this.ctx = new AudioContextClass();
        this.createNoiseBuffer();
    }
  }

  private createNoiseBuffer() {
      if (!this.ctx) return;
      const bufferSize = this.ctx.sampleRate * 2; // 2 seconds
      const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      let lastOut = 0;
      for (let i = 0; i < bufferSize; i++) {
          // Pink noise approximation
          const white = Math.random() * 2 - 1;
          data[i] = (lastOut + (0.02 * white)) / 1.02;
          lastOut = data[i];
          data[i] *= 3.5; // Compensate for gain loss
      }
      this.noiseBuffer = buffer;
  }

  async init() {
    if (this.ctx && this.ctx.state === 'suspended') {
        await this.ctx.resume();
    }
  }

  startMusic() {
    if (!this.ctx) return;
    if (this.isPlaying) return;
    
    this.isPlaying = true;
    this.nextNoteTime = this.ctx.currentTime + 0.1;
    this.current16thNote = 0;
    this.measureCount = 0;
    this.scheduler();
  }

  stopMusic() {
    this.isPlaying = false;
    if (this.schedulerTimer) {
        window.clearTimeout(this.schedulerTimer);
        this.schedulerTimer = null;
    }
  }

  private scheduler = () => {
    if (!this.ctx || !this.isPlaying) return;
    
    while (this.nextNoteTime < this.ctx.currentTime + this.scheduleAheadTime) {
        this.scheduleNote(this.current16thNote, this.nextNoteTime);
        this.advanceNote();
    }
    this.schedulerTimer = window.setTimeout(this.scheduler, this.lookahead);
  }

  private advanceNote() {
    const secondsPerBeat = 60.0 / this.tempo;
    this.nextNoteTime += 0.25 * secondsPerBeat; // 16th notes
    this.current16thNote++;
    if (this.current16thNote >= 32) { // Loop length
        this.current16thNote = 0;
        this.measureCount++;
    }
  }

  private scheduleNote(beatNumber: number, time: number) {
      if (!this.ctx) return;

      // Vary melody every 2 loops (approx 8 measures)
      const currentMelody = (Math.floor(this.measureCount / 2) % 2 === 0) ? this.melodyA : this.melodyB;

      // Lead Synth (Sawtooth with Lowpass for "Synthwave" feel)
      const noteFreq = currentMelody[beatNumber % currentMelody.length];
      if (noteFreq && noteFreq > 0) {
          const osc = this.ctx.createOscillator();
          const gain = this.ctx.createGain();
          const filter = this.ctx.createBiquadFilter();

          osc.type = 'sawtooth';
          osc.frequency.value = noteFreq;
          
          filter.type = 'lowpass';
          filter.frequency.setValueAtTime(800, time);
          filter.frequency.exponentialRampToValueAtTime(3000, time + 0.05);
          filter.frequency.exponentialRampToValueAtTime(800, time + 0.2);

          gain.gain.setValueAtTime(0.05, time);
          gain.gain.exponentialRampToValueAtTime(0.001, time + 0.3);

          osc.connect(filter);
          filter.connect(gain);
          gain.connect(this.ctx.destination);
          osc.start(time);
          osc.stop(time + 0.3);
      }

      // Bass (Triangle/Square mix)
      const bassFreq = this.bassLine[beatNumber % this.bassLine.length];
      if (bassFreq && bassFreq > 0) {
          const osc = this.ctx.createOscillator();
          const gain = this.ctx.createGain();
          osc.type = 'square';
          osc.frequency.value = bassFreq;
          
          gain.gain.setValueAtTime(0.1, time);
          gain.gain.linearRampToValueAtTime(0.01, time + 0.2);

          osc.connect(gain);
          gain.connect(this.ctx.destination);
          osc.start(time);
          osc.stop(time + 0.2);
      }

      // Drums
      if (beatNumber % 4 === 0) { 
          const gain = this.ctx.createGain();
          const isSnare = (beatNumber % 8 === 4);

          if (isSnare) {
              // White Noise Snare
              if (this.noiseBuffer) {
                  const source = this.ctx.createBufferSource();
                  source.buffer = this.noiseBuffer;
                  const snareFilter = this.ctx.createBiquadFilter();
                  snareFilter.type = 'highpass';
                  snareFilter.frequency.value = 800;
                  
                  source.connect(snareFilter);
                  snareFilter.connect(gain);
                  gain.gain.setValueAtTime(0.15, time);
                  gain.gain.exponentialRampToValueAtTime(0.001, time + 0.2);
                  source.start(time);
                  source.stop(time + 0.2);
              }
          } else {
              // Deep Kick
              const osc = this.ctx.createOscillator();
              osc.frequency.setValueAtTime(120, time);
              osc.frequency.exponentialRampToValueAtTime(40, time + 0.1);
              gain.gain.setValueAtTime(0.3, time);
              gain.gain.exponentialRampToValueAtTime(0.001, time + 0.1);
              osc.connect(gain);
              osc.start(time);
              osc.stop(time + 0.1);
          }
          gain.connect(this.ctx.destination);
      }
  }

  playSfx(type: 'JUMP' | 'ATTACK' | 'HIT' | 'WIN' | 'LOSE' | 'MEOW' | 'GRUNT' | 'LASER' | 'MUMBLE') {
      if (!this.ctx) return;
      const t = this.ctx.currentTime;
      const gain = this.ctx.createGain();
      gain.connect(this.ctx.destination);

      switch (type) {
        case 'JUMP': {
          const osc = this.ctx.createOscillator();
          osc.connect(gain);
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(150, t);
          osc.frequency.linearRampToValueAtTime(300, t + 0.1);
          gain.gain.setValueAtTime(0.1, t);
          gain.gain.linearRampToValueAtTime(0.01, t + 0.1);
          osc.start(t);
          osc.stop(t + 0.1);
          break;
        }
        case 'ATTACK': {
          // Swoosh sound (Noise + Filter)
           if (this.noiseBuffer) {
                const source = this.ctx.createBufferSource();
                source.buffer = this.noiseBuffer;
                const filter = this.ctx.createBiquadFilter();
                filter.type = 'lowpass';
                filter.frequency.setValueAtTime(400, t);
                filter.frequency.linearRampToValueAtTime(1200, t + 0.1);
                
                source.connect(filter);
                filter.connect(gain);
                
                gain.gain.setValueAtTime(0.1, t);
                gain.gain.linearRampToValueAtTime(0, t + 0.15);
                source.start(t);
                source.stop(t + 0.15);
           }
          break;
        }
        case 'HIT': {
           // Impact
          const osc = this.ctx.createOscillator();
          osc.connect(gain);
          osc.type = 'square';
          osc.frequency.setValueAtTime(80, t);
          osc.frequency.exponentialRampToValueAtTime(20, t + 0.1);
          gain.gain.setValueAtTime(0.3, t);
          gain.gain.exponentialRampToValueAtTime(0.01, t + 0.1);
          osc.start(t);
          osc.stop(t + 0.1);
          break;
        }
        case 'WIN': {
          const osc = this.ctx.createOscillator();
          osc.connect(gain);
          osc.type = 'sawtooth';
          // Fanfare
          osc.frequency.setValueAtTime(523.25, t);
          osc.frequency.setValueAtTime(659.25, t + 0.1);
          osc.frequency.setValueAtTime(783.99, t + 0.2);
          osc.frequency.setValueAtTime(1046.50, t + 0.3);
          gain.gain.setValueAtTime(0.2, t);
          gain.gain.linearRampToValueAtTime(0, t + 1.5);
          osc.start(t);
          osc.stop(t + 1.5);
          break;
        }
        case 'LOSE': {
          const osc = this.ctx.createOscillator();
          osc.connect(gain);
          osc.type = 'sawtooth';
          osc.frequency.setValueAtTime(100, t);
          osc.frequency.linearRampToValueAtTime(30, t + 1.0);
          gain.gain.setValueAtTime(0.2, t);
          gain.gain.linearRampToValueAtTime(0, t + 1.0);
          osc.start(t);
          osc.stop(t + 1.0);
          break;
        }
        case 'LASER': {
          // Sci-fi Laser: FM Synthesis
          const osc1 = this.ctx.createOscillator(); // Carrier
          const osc2 = this.ctx.createOscillator(); // Modulator
          const modGain = this.ctx.createGain();

          osc2.connect(modGain);
          modGain.connect(osc1.frequency);
          osc1.connect(gain);
          
          osc1.type = 'sawtooth';
          osc2.type = 'square';
          
          osc1.frequency.setValueAtTime(1200, t);
          osc1.frequency.exponentialRampToValueAtTime(200, t + 0.4);
          
          osc2.frequency.setValueAtTime(50, t); // Modulation speed
          modGain.gain.setValueAtTime(500, t); // Modulation depth
          
          gain.gain.setValueAtTime(0.2, t);
          gain.gain.exponentialRampToValueAtTime(0.01, t + 0.4);
          
          osc1.start(t);
          osc1.stop(t + 0.4);
          osc2.start(t);
          osc2.stop(t + 0.4);
          break;
        }
        case 'MEOW': {
            // Realistic Cat Meow: Formant Filter Sweep + Noise Breath
            const duration = 0.6;
            
            // 1. Tonal Component (Vocal Folds)
            const osc = this.ctx.createOscillator();
            const filter = this.ctx.createBiquadFilter();
            
            osc.type = 'sawtooth';
            // Pitch inflection: Mid -> High -> Low
            osc.frequency.setValueAtTime(350, t);
            osc.frequency.linearRampToValueAtTime(600, t + 0.2);
            osc.frequency.linearRampToValueAtTime(300, t + duration);
            
            // Filter mimics mouth opening (Me-ow)
            filter.type = 'bandpass';
            filter.Q.value = 2;
            filter.frequency.setValueAtTime(600, t);
            filter.frequency.linearRampToValueAtTime(1500, t + 0.2);
            filter.frequency.linearRampToValueAtTime(500, t + duration);
            
            osc.connect(filter);
            filter.connect(gain);
            
            // 2. Breath Component (Pink Noise)
            if (this.noiseBuffer) {
                const noise = this.ctx.createBufferSource();
                noise.buffer = this.noiseBuffer;
                const noiseFilter = this.ctx.createBiquadFilter();
                const noiseGain = this.ctx.createGain();
                
                noiseFilter.type = 'bandpass';
                noiseFilter.frequency.setValueAtTime(1000, t);
                noiseFilter.Q.value = 1;
                
                noiseGain.gain.setValueAtTime(0.05, t);
                noiseGain.gain.linearRampToValueAtTime(0, t + duration);
                
                noise.connect(noiseFilter);
                noiseFilter.connect(noiseGain);
                noiseGain.connect(this.ctx.destination);
                noise.start(t);
                noise.stop(t + duration);
            }

            gain.gain.setValueAtTime(0, t);
            gain.gain.linearRampToValueAtTime(0.15, t + 0.1); // Attack
            gain.gain.linearRampToValueAtTime(0, t + duration); // Decay
            
            osc.start(t);
            osc.stop(t + duration);
            break;
        }
        case 'GRUNT': {
            // Low thud/grunt
            const osc = this.ctx.createOscillator();
            osc.connect(gain);
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(150, t);
            osc.frequency.exponentialRampToValueAtTime(80, t + 0.1);
            gain.gain.setValueAtTime(0.3, t);
            gain.gain.exponentialRampToValueAtTime(0.01, t + 0.15);
            osc.start(t);
            osc.stop(t + 0.15);
            break;
        }
        case 'MUMBLE': {
            // Realistic Mumble: Formant filtered pulse train with random modulation
            const duration = 1.5 + Math.random(); // Random length
            
            const carrier = this.ctx.createOscillator();
            const filter = this.ctx.createBiquadFilter();
            const lfo = this.ctx.createOscillator();
            const lfoGainNode = this.ctx.createGain();
            
            // Raspy voice
            carrier.type = 'sawtooth';
            carrier.frequency.setValueAtTime(80 + Math.random() * 20, t); 
            carrier.frequency.linearRampToValueAtTime(60, t + duration);
            
            // Vocal Tract simulation
            filter.type = 'lowpass';
            filter.Q.value = 4;
            
            // LFO modulates the filter cutoff to simulate syllables/vowels
            lfo.type = 'sine';
            lfo.frequency.value = 6 + Math.random() * 2; // Speaking rate
            
            lfoGainNode.gain.value = 600; // Modulation depth (Hz)
            filter.frequency.value = 800; // Base cutoff
            
            lfo.connect(lfoGainNode);
            lfoGainNode.connect(filter.frequency);
            
            carrier.connect(filter);
            filter.connect(gain);
            
            gain.gain.setValueAtTime(0, t);
            gain.gain.linearRampToValueAtTime(0.2, t + 0.1);
            // Slight jitter in volume
            gain.gain.setValueAtTime(0.15, t + duration/2);
            gain.gain.linearRampToValueAtTime(0, t + duration);
            
            carrier.start(t);
            carrier.stop(t + duration);
            lfo.start(t);
            lfo.stop(t + duration);
            break;
        }
      }
  }
}

export const audioController = new AudioController();
