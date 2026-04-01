export class AudioLevelMonitor {
  private analyser: AnalyserNode;
  private dataArray: Uint8Array;
  private animationFrameId: number | null = null;
  private onLevel: (level: number) => void;
  private currentLevel = 0;

  constructor(
    audioContext: AudioContext,
    source: MediaStreamAudioSourceNode,
    onLevel: (level: number) => void,
  ) {
    this.onLevel = onLevel;
    this.analyser = audioContext.createAnalyser();
    this.analyser.fftSize = 256;
    this.dataArray = new Uint8Array(this.analyser.frequencyBinCount);
    source.connect(this.analyser);
  }

  start(): void {
    const update = () => {
      this.analyser.getByteFrequencyData(this.dataArray);

      // Calculate RMS of frequency data
      let sumSquares = 0;
      for (let i = 0; i < this.dataArray.length; i++) {
        const normalised = this.dataArray[i]! / 255;
        sumSquares += normalised * normalised;
      }
      this.currentLevel = Math.sqrt(sumSquares / this.dataArray.length);
      this.onLevel(this.currentLevel);

      this.animationFrameId = requestAnimationFrame(update);
    };
    this.animationFrameId = requestAnimationFrame(update);
  }

  stop(): void {
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }

  getLevel(): number {
    return this.currentLevel;
  }
}
