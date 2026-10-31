// Proseduraaliset äänet Web Audiolla: ei äänitiedostoja.

export class Sfx {
  private ctx: AudioContext | null = null;
  private master!: GainNode;
  private drone: { gain: GainNode; oscs: OscillatorNode[] } | null = null;

  start() {
    if (this.ctx) return;
    this.ctx = new AudioContext();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.5;
    this.master.connect(this.ctx.destination);
    this.ambience();
  }

  private noise(dur: number) {
    const ctx = this.ctx!;
    const buf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * dur), ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    return src;
  }

  private env(g: GainNode, peak: number, attack: number, decay: number) {
    const t = this.ctx!.currentTime;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
  }

  /** Tuulen humina taustalla. */
  private ambience() {
    const ctx = this.ctx!;
    const src = this.noise(4);
    src.loop = true;
    const f = ctx.createBiquadFilter();
    f.type = "lowpass";
    f.frequency.value = 400;
    const g = ctx.createGain();
    g.gain.value = 0.05;
    src.connect(f).connect(g).connect(this.master);
    src.start();
  }

  swing() {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const src = this.noise(0.25);
    const f = ctx.createBiquadFilter();
    f.type = "bandpass";
    f.Q.value = 1.5;
    f.frequency.setValueAtTime(600, ctx.currentTime);
    f.frequency.exponentialRampToValueAtTime(2200, ctx.currentTime + 0.18);
    const g = ctx.createGain();
    this.env(g, 0.35, 0.03, 0.2);
    src.connect(f).connect(g).connect(this.master);
    src.start();
  }

  /** Pronssi pronssia vasten. parry = kirkkaampi ja pidempi. */
  clang(parry: boolean) {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const base = parry ? 1320 : 880;
    for (const mult of [1, 2.76, 5.4]) {
      const o = ctx.createOscillator();
      o.type = "sine";
      o.frequency.value = base * mult * (0.98 + Math.random() * 0.04);
      const g = ctx.createGain();
      this.env(g, (parry ? 0.25 : 0.18) / mult, 0.002, parry ? 0.9 : 0.4);
      o.connect(g).connect(this.master);
      o.start();
      o.stop(ctx.currentTime + 1);
    }
    const n = this.noise(0.05);
    const g = ctx.createGain();
    this.env(g, 0.3, 0.001, 0.05);
    n.connect(g).connect(this.master);
    n.start();
  }

  hit() {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const o = ctx.createOscillator();
    o.type = "triangle";
    o.frequency.setValueAtTime(160, ctx.currentTime);
    o.frequency.exponentialRampToValueAtTime(50, ctx.currentTime + 0.2);
    const g = ctx.createGain();
    this.env(g, 0.6, 0.005, 0.25);
    o.connect(g).connect(this.master);
    o.start();
    o.stop(ctx.currentTime + 0.3);
    const n = this.noise(0.1);
    const f = ctx.createBiquadFilter();
    f.type = "lowpass";
    f.frequency.value = 900;
    const g2 = ctx.createGain();
    this.env(g2, 0.4, 0.002, 0.1);
    n.connect(f).connect(g2).connect(this.master);
    n.start();
  }

  /** Laulun pohjalla soiva bordun (perussävel ja kvintti, kantelemainen). */
  startDrone() {
    if (!this.ctx || this.drone) return;
    const ctx = this.ctx;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.18, ctx.currentTime + 0.5);
    const f = ctx.createBiquadFilter();
    f.type = "lowpass";
    f.frequency.value = 900;
    const oscs = [110, 165, 220.5].map((hz, i) => {
      const o = ctx.createOscillator();
      o.type = i === 0 ? "sawtooth" : "triangle";
      o.frequency.value = hz;
      o.connect(f);
      o.start();
      return o;
    });
    f.connect(gain).connect(this.master);
    this.drone = { gain, oscs };
  }

  stopDrone() {
    if (!this.ctx || !this.drone) return;
    const { gain, oscs } = this.drone;
    const t = this.ctx.currentTime;
    gain.gain.cancelScheduledValues(t);
    gain.gain.setValueAtTime(gain.gain.value, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.8);
    oscs.forEach((o) => o.stop(t + 0.9));
    this.drone = null;
  }

  /** Kanteleen näppäys: soi tahdissa. Sävel valitaan pentatonisesta asteikosta. */
  pluck(step: number, good: boolean) {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const scale = [220, 247.5, 275, 330, 366.7, 440];
    const o = ctx.createOscillator();
    o.type = good ? "triangle" : "square";
    o.frequency.value = good ? scale[step % scale.length] * 2 : 180;
    const g = ctx.createGain();
    this.env(g, good ? 0.35 : 0.12, 0.003, good ? 0.9 : 0.15);
    o.connect(g).connect(this.master);
    o.start();
    o.stop(ctx.currentTime + 1);
  }

  /** Tick, joka kertoo tahdin lähestyvän. */
  tick() {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const o = ctx.createOscillator();
    o.frequency.value = 1800;
    const g = ctx.createGain();
    this.env(g, 0.05, 0.001, 0.04);
    o.connect(g).connect(this.master);
    o.start();
    o.stop(ctx.currentTime + 0.06);
  }

  swamp() {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const n = this.noise(1.2);
    const f = ctx.createBiquadFilter();
    f.type = "lowpass";
    f.frequency.setValueAtTime(300, ctx.currentTime);
    f.frequency.linearRampToValueAtTime(80, ctx.currentTime + 1.2);
    const g = ctx.createGain();
    this.env(g, 0.7, 0.05, 1.1);
    n.connect(f).connect(g).connect(this.master);
    n.start();
  }
}
