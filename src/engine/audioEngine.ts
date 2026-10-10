class AudioEngine {
  private ctx: AudioContext | null = null;
  private continuityOsc: OscillatorNode | null = null;
  private continuityGain: GainNode | null = null;
  private speakerOsc: OscillatorNode | null = null;
  private speakerGain: GainNode | null = null;
  private isMuted: boolean = false;

  private initContext() {
    if (!this.ctx && typeof window !== 'undefined') {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  // Continuity Beeper (Multimeter 2.4kHz Piezo Buzz)
  public setContinuityBeep(active: boolean) {
    if (this.isMuted) return;
    this.initContext();
    if (!this.ctx) return;

    if (active) {
      if (!this.continuityOsc) {
        this.continuityOsc = this.ctx.createOscillator();
        this.continuityGain = this.ctx.createGain();

        this.continuityOsc.type = 'sine';
        this.continuityOsc.frequency.setValueAtTime(2400, this.ctx.currentTime); // 2.4kHz standard multimeter tone

        this.continuityGain.gain.setValueAtTime(0.15, this.ctx.currentTime);
        this.continuityOsc.connect(this.continuityGain);
        this.continuityGain.connect(this.ctx.destination);
        this.continuityOsc.start();
      }
    } else {
      if (this.continuityOsc) {
        try {
          this.continuityOsc.stop();
          this.continuityOsc.disconnect();
        } catch {}
        this.continuityOsc = null;
        this.continuityGain = null;
      }
    }
  }

  // Speaker Sound (Voltage-driven acoustic synthesis)
  public updateSpeaker(voltage: number, frequency: number = 440) {
    if (this.isMuted) return;
    this.initContext();
    if (!this.ctx) return;

    if (Math.abs(voltage) > 0.05) {
      if (!this.speakerOsc) {
        this.speakerOsc = this.ctx.createOscillator();
        this.speakerGain = this.ctx.createGain();
        this.speakerOsc.type = 'sawtooth';
        this.speakerOsc.connect(this.speakerGain);
        this.speakerGain.connect(this.ctx.destination);
        this.speakerOsc.start();
      }

      const gain = Math.min(0.25, Math.abs(voltage) / 12 * 0.2);
      this.speakerGain?.gain.setTargetAtTime(gain, this.ctx.currentTime, 0.05);
      this.speakerOsc.frequency.setTargetAtTime(frequency, this.ctx.currentTime, 0.05);
    } else {
      if (this.speakerGain) {
        this.speakerGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.05);
      }
    }
  }

  public toggleMute(): boolean {
    this.isMuted = !this.isMuted;
    if (this.isMuted) {
      this.setContinuityBeep(false);
      if (this.speakerGain && this.ctx) {
        this.speakerGain.gain.setValueAtTime(0, this.ctx.currentTime);
      }
    }
    return this.isMuted;
  }
}

export const audioEngine = new AudioEngine();
