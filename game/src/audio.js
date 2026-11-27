// All sound is synthesised with WebAudio: no audio files, nothing fetched.
// The engine is a low drone whose pitch follows the plane's speed; rings,
// stars, crashes and level-ups are short blips and sweeps.

/** @returns {{ resume: () => void, setMuted: (muted: boolean) => boolean, setSpeed: (ratio: number) => void, ring: () => void, star: () => void, crash: () => void, levelUp: () => void, click: () => void }} */
export function createAudio() {
  let context = null;
  let muted = false;
  let engineOsc = null;
  let engineGain = null;

  function ensure() {
    if (context) return context;
    const AudioContext = window.AudioContext ?? window.webkitAudioContext;
    if (!AudioContext) return null;
    context = new AudioContext();
    // Engine drone: a sawtooth through a low-pass filter, gain kept low.
    engineOsc = context.createOscillator();
    engineOsc.type = 'sawtooth';
    engineOsc.frequency.value = 62;
    const filter = context.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 320;
    engineGain = context.createGain();
    engineGain.gain.value = 0.0;
    engineOsc.connect(filter);
    filter.connect(engineGain);
    engineGain.connect(context.destination);
    engineOsc.start();
    return context;
  }

  function tone(freq, duration, type, volume, when = 0, slideTo = null) {
    if (!context || muted) return;
    const t0 = context.currentTime + when;
    const osc = context.createOscillator();
    const gain = context.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (slideTo !== null) osc.frequency.exponentialRampToValueAtTime(slideTo, t0 + duration);
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(volume, t0 + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
    osc.connect(gain);
    gain.connect(context.destination);
    osc.start(t0);
    osc.stop(t0 + duration + 0.05);
  }

  return {
    resume() {
      const ctx = ensure();
      if (ctx && ctx.state === 'suspended') void ctx.resume();
      if (engineGain && !muted) engineGain.gain.setTargetAtTime(0.035, context.currentTime, 0.2);
    },
    setMuted(value) {
      muted = value;
      if (engineGain && context) {
        engineGain.gain.setTargetAtTime(muted ? 0.0 : 0.035, context.currentTime, 0.05);
      }
      return muted;
    },
    setSpeed(ratio) {
      if (engineOsc && context && !muted) {
        engineOsc.frequency.setTargetAtTime(58 + ratio * 90, context.currentTime, 0.1);
      }
    },
    ring() {
      tone(880, 0.16, 'sine', 0.22);
      tone(1318, 0.24, 'sine', 0.18, 0.07);
    },
    star() {
      tone(1568, 0.1, 'triangle', 0.16);
    },
    crash() {
      tone(160, 0.35, 'sawtooth', 0.28, 0, 55);
      tone(90, 0.4, 'square', 0.14, 0.02, 40);
    },
    levelUp() {
      tone(523, 0.12, 'triangle', 0.2);
      tone(659, 0.12, 'triangle', 0.2, 0.09);
      tone(784, 0.2, 'triangle', 0.22, 0.18);
    },
    click() {
      tone(660, 0.06, 'sine', 0.12);
    },
  };
}
