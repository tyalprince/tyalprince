import { describe, expect, it } from "vitest";
import { analyzeSamples, estimateKey, fft, keyLabel } from "@/lib/music/analysis";

const SR = 22050;

/** Kick-like click every beat on top of silence. */
function clickTrack(bpm: number, seconds: number): Float32Array {
  const out = new Float32Array(SR * seconds);
  const period = Math.round((60 / bpm) * SR);
  for (let start = 0; start < out.length; start += period) {
    for (let i = 0; i < 600 && start + i < out.length; i++) {
      out[start + i] += Math.sin((2 * Math.PI * 80 * i) / SR) * Math.exp(-i / 120) * 0.8;
    }
  }
  return out;
}

/** Sustained chord made of sine partials at the given MIDI notes. */
function chord(midiNotes: number[], seconds: number, amp = 0.15): Float32Array {
  const out = new Float32Array(SR * seconds);
  for (const m of midiNotes) {
    const hz = 440 * 2 ** ((m - 69) / 12);
    for (let i = 0; i < out.length; i++) out[i] += amp * Math.sin((2 * Math.PI * hz * i) / SR);
  }
  return out;
}

describe("fft", () => {
  it("puts a pure tone in the right bin", () => {
    const n = 1024;
    const re = new Float64Array(n);
    const im = new Float64Array(n);
    for (let i = 0; i < n; i++) re[i] = Math.sin((2 * Math.PI * 32 * i) / n);
    fft(re, im);
    const mags = Array.from({ length: n / 2 }, (_, b) => Math.hypot(re[b], im[b]));
    expect(mags.indexOf(Math.max(...mags))).toBe(32);
  });
});

describe("tempo", () => {
  it.each([90, 120, 128, 150])("detects %i BPM within 3%%", (bpm) => {
    const f = analyzeSamples(clickTrack(bpm, 30), SR);
    expect(Math.abs(f.tempo - bpm) / bpm).toBeLessThan(0.03);
    expect(f.pulse).toBeGreaterThan(0.2);
  });
});

describe("key", () => {
  it("finds C major from a C–F–G progression", () => {
    const sig = new Float32Array([...chord([60, 64, 67], 4), ...chord([65, 69, 72], 4), ...chord([67, 71, 74], 4), ...chord([60, 64, 67], 4)]);
    const f = analyzeSamples(sig, SR);
    expect(keyLabel(f.key, f.mode)).toBe("C major");
  });

  it("finds A minor from an Am–Dm–E progression", () => {
    const sig = new Float32Array([...chord([57, 60, 64], 4), ...chord([62, 65, 69], 4), ...chord([64, 68, 71], 4), ...chord([57, 60, 64], 4)]);
    const f = analyzeSamples(sig, SR);
    expect(keyLabel(f.key, f.mode)).toBe("A minor");
  });

  it("is invariant to transposition of the chroma vector", () => {
    const cMajorish = [5, 0, 3, 0, 4, 3, 0, 5, 0, 3, 0, 2];
    const dMajorish = cMajorish.map((_, i) => cMajorish[(i - 2 + 12) % 12]);
    expect(estimateKey(dMajorish)).toMatchObject({ key: 2, mode: 1 });
  });
});

describe("energy & loudness", () => {
  it("rates a loud signal as more energetic than a quiet one", () => {
    const loud = analyzeSamples(chord([60, 64, 67], 10, 0.3), SR);
    const quiet = analyzeSamples(chord([60, 64, 67], 10, 0.01), SR);
    expect(loud.energy).toBeGreaterThan(quiet.energy);
    expect(loud.loudness).toBeGreaterThan(quiet.loudness);
  });
});
