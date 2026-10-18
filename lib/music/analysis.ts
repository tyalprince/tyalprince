// Lightweight audio analysis, run in the browser during import (Web Audio
// decodes the file; this module does the maths on the raw samples). It
// extracts the handful of features the similarity engine needs — tempo,
// musical key, energy, loudness, brightness, beat strength — without any
// server-side audio processing. Pure and deterministic so it's unit tested.

export type AudioFeatures = {
  tempo: number; // BPM
  pulse: number; // 0..1, how clear/steady the beat is
  key: number; // 0 = C … 11 = B
  mode: number; // 1 = major, 0 = minor
  keyConfidence: number; // 0..1
  loudness: number; // dBFS (mean frame RMS)
  energy: number; // 0..1
  dynamics: number; // 0..1, spread between quiet and loud passages
  brightness: number; // spectral centroid, Hz
  flatness: number; // 0..1, noisy (1) vs tonal (0)
  zcr: number; // zero-crossing rate per sample
};

export const KEY_NAMES = ["C", "C♯", "D", "E♭", "E", "F", "F♯", "G", "A♭", "A", "B♭", "B"];

export function keyLabel(key: number, mode: number): string {
  return `${KEY_NAMES[((key % 12) + 12) % 12]} ${mode === 1 ? "major" : "minor"}`;
}

const FRAME = 2048;
const HOP = 512;

/** In-place iterative radix-2 FFT. `re`/`im` length must be a power of two. */
export function fft(re: Float64Array, im: Float64Array): void {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      [re[i], re[j]] = [re[j], re[i]];
      [im[i], im[j]] = [im[j], im[i]];
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = (-2 * Math.PI) / len;
    const wr = Math.cos(ang);
    const wi = Math.sin(ang);
    for (let i = 0; i < n; i += len) {
      let cr = 1;
      let ci = 0;
      for (let k = 0; k < len / 2; k++) {
        const a = i + k;
        const b = a + len / 2;
        const tr = re[b] * cr - im[b] * ci;
        const ti = re[b] * ci + im[b] * cr;
        re[b] = re[a] - tr;
        im[b] = im[a] - ti;
        re[a] += tr;
        im[a] += ti;
        const ncr = cr * wr - ci * wi;
        ci = cr * wi + ci * wr;
        cr = ncr;
      }
    }
  }
}

// Krumhansl–Kessler key profiles (C major / C minor).
const MAJOR = [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88];
const MINOR = [6.33, 2.68, 3.52, 5.38, 2.6, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17];

function pearson(a: number[], b: number[]): number {
  const n = a.length;
  const ma = a.reduce((s, v) => s + v, 0) / n;
  const mb = b.reduce((s, v) => s + v, 0) / n;
  let num = 0;
  let da = 0;
  let db = 0;
  for (let i = 0; i < n; i++) {
    num += (a[i] - ma) * (b[i] - mb);
    da += (a[i] - ma) ** 2;
    db += (b[i] - mb) ** 2;
  }
  return da && db ? num / Math.sqrt(da * db) : 0;
}

export function estimateKey(chroma: number[]): { key: number; mode: number; confidence: number } {
  let best = { key: 0, mode: 1, r: -Infinity };
  let second = -Infinity;
  for (let k = 0; k < 12; k++) {
    for (const [mode, profile] of [
      [1, MAJOR],
      [0, MINOR],
    ] as const) {
      const rotated = profile.map((_, i) => profile[(i - k + 12) % 12]);
      const r = pearson(chroma, rotated);
      if (r > best.r) {
        second = best.r;
        best = { key: k, mode, r };
      } else if (r > second) {
        second = r;
      }
    }
  }
  return { key: best.key, mode: best.mode, confidence: Math.max(0, Math.min(1, (best.r - second) * 5)) };
}

/** Tempo from the onset-strength envelope via autocorrelation, biased toward 80–160 BPM. */
export function estimateTempo(onsets: number[], frameRate: number): { tempo: number; pulse: number } {
  const n = onsets.length;
  if (n < 16) return { tempo: 0, pulse: 0 };
  const mean = onsets.reduce((s, v) => s + v, 0) / n;
  const x = onsets.map((v) => v - mean);
  const ac0 = x.reduce((s, v) => s + v * v, 0) || 1;
  const minLag = Math.max(1, Math.floor((60 / 200) * frameRate));
  const maxLag = Math.min(n - 1, Math.ceil((60 / 60) * frameRate));

  let bestLag = 0;
  let bestScore = -Infinity;
  let bestRaw = 0;
  for (let lag = minLag; lag <= maxLag; lag++) {
    let s = 0;
    for (let i = 0; i + lag < n; i++) s += x[i] * x[i + lag];
    const raw = s / ac0;
    const bpm = (60 * frameRate) / lag;
    // Log-Gaussian prior centred on 120 BPM resolves half/double-tempo ambiguity.
    const prior = Math.exp(-0.5 * (Math.log2(bpm / 120) / 0.9) ** 2);
    const score = raw * prior;
    if (score > bestScore) {
      bestScore = score;
      bestLag = lag;
      bestRaw = raw;
    }
  }
  if (!bestLag) return { tempo: 0, pulse: 0 };
  const acAt = (lag: number) => {
    let s = 0;
    for (let i = 0; i + lag < n; i++) s += x[i] * x[i + lag];
    return s / ac0;
  };
  // Half-time check: a slow pick whose half-period is nearly as periodic is
  // really the faster tempo (a 150 BPM beat also repeats every 2 beats).
  if ((60 * frameRate) / bestLag < 95) {
    const half = bestLag / 2;
    const halfStrength = Math.max(acAt(Math.floor(half)), acAt(Math.ceil(half)));
    if (Math.floor(half) >= minLag && halfStrength > 0.6 * bestRaw) {
      bestLag = Math.round(half);
      bestRaw = halfStrength;
    }
  }
  // Parabolic interpolation around the peak for sub-frame precision.
  const at = (lag: number) => {
    let s = 0;
    for (let i = 0; i + lag < n; i++) s += x[i] * x[i + lag];
    return s;
  };
  const y0 = at(bestLag - 1);
  const y1 = at(bestLag);
  const y2 = at(bestLag + 1);
  const denom = y0 - 2 * y1 + y2;
  const offset = denom ? (0.5 * (y0 - y2)) / denom : 0;
  const lag = bestLag + Math.max(-0.5, Math.min(0.5, offset));
  return { tempo: Math.round(((60 * frameRate) / lag) * 10) / 10, pulse: Math.max(0, Math.min(1, bestRaw)) };
}

function percentile(sorted: number[], p: number): number {
  if (!sorted.length) return 0;
  return sorted[Math.min(sorted.length - 1, Math.max(0, Math.floor(p * (sorted.length - 1))))];
}

/**
 * Analyses mono PCM samples. Only the middle `maxSeconds` are used — intros
 * and outros are less representative and it keeps big libraries fast.
 */
export function analyzeSamples(input: Float32Array, sampleRate: number, maxSeconds = 60): AudioFeatures {
  const maxLen = Math.floor(maxSeconds * sampleRate);
  const start = input.length > maxLen ? Math.floor((input.length - maxLen) / 2) : 0;
  const samples = input.subarray(start, start + Math.min(maxLen, input.length));

  const window = new Float64Array(FRAME);
  for (let i = 0; i < FRAME; i++) window[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (FRAME - 1));
  const binHz = sampleRate / FRAME;
  const pitchClassOfBin = new Int8Array(FRAME / 2).fill(-1);
  for (let b = 1; b < FRAME / 2; b++) {
    const hz = b * binHz;
    if (hz >= 55 && hz <= 2000) pitchClassOfBin[b] = (((Math.round(12 * Math.log2(hz / 261.6256)) % 12) + 12) % 12);
  }

  const re = new Float64Array(FRAME);
  const im = new Float64Array(FRAME);
  let prevLogMag: Float64Array | null = null;
  const rmsList: number[] = [];
  const onsets: number[] = [];
  const chroma = new Array(12).fill(0);
  let centroidSum = 0;
  let centroidWeight = 0;
  let flatnessSum = 0;
  let crossings = 0;

  for (let i = 1; i < samples.length; i++) {
    if ((samples[i - 1] >= 0) !== (samples[i] >= 0)) crossings += 1;
  }

  for (let pos = 0; pos + FRAME <= samples.length; pos += HOP) {
    let sumSq = 0;
    for (let i = 0; i < FRAME; i++) {
      const v = samples[pos + i];
      sumSq += v * v;
      re[i] = v * window[i];
      im[i] = 0;
    }
    const rms = Math.sqrt(sumSq / FRAME);
    rmsList.push(rms);
    fft(re, im);

    const logMag = new Float64Array(FRAME / 2);
    let magSum = 0;
    let weighted = 0;
    let logSum = 0;
    let flux = 0;
    for (let b = 1; b < FRAME / 2; b++) {
      const mag = Math.hypot(re[b], im[b]);
      magSum += mag;
      weighted += mag * b * binHz;
      logSum += Math.log(mag + 1e-12);
      logMag[b] = Math.log1p(mag);
      if (prevLogMag) flux += Math.max(0, logMag[b] - prevLogMag[b]);
      const pc = pitchClassOfBin[b];
      if (pc >= 0) chroma[pc] += mag * mag;
    }
    prevLogMag = logMag;
    onsets.push(flux);
    if (magSum > 0) {
      centroidSum += weighted;
      centroidWeight += magSum;
      const arith = magSum / (FRAME / 2 - 1);
      flatnessSum += Math.exp(logSum / (FRAME / 2 - 1)) / arith;
    }
  }

  const frames = rmsList.length || 1;
  const meanRms = rmsList.reduce((s, v) => s + v, 0) / frames;
  const db = (v: number) => 20 * Math.log10(v + 1e-9);
  const sortedDb = rmsList.map(db).sort((a, b) => a - b);
  const { tempo, pulse } = estimateTempo(onsets, sampleRate / HOP);
  const { key, mode, confidence } = estimateKey(chroma);

  return {
    tempo,
    pulse: round(pulse, 3),
    key,
    mode,
    keyConfidence: round(confidence, 3),
    loudness: round(db(meanRms), 2),
    // ~-30 dBFS (very quiet) → 0, ~-6 dBFS (heavily mastered) → 1
    energy: round(clamp01((db(meanRms) + 30) / 24), 3),
    dynamics: round(clamp01((percentile(sortedDb, 0.95) - percentile(sortedDb, 0.1)) / 30), 3),
    brightness: Math.round(centroidWeight ? centroidSum / centroidWeight : 0),
    flatness: round(flatnessSum / frames, 4),
    zcr: round(samples.length > 1 ? crossings / (samples.length - 1) : 0, 4),
  };
}

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
const round = (v: number, places: number) => Math.round(v * 10 ** places) / 10 ** places;
