/*
 * KuramotoLab: a deterministic illustration of phase synchronization.
 *
 * Model:
 *   d theta_i / dt = omega_i + K/N sum_j sin(theta_j - theta_i)
 *                    + A e(t) sin(phi_i(t) - theta_i).
 * The last term is an illustrative, finite, phase-sensitive input. Four
 * subgroups receive different target phases. It changes the dynamics; it
 * never displaces a plotted point directly. Coupling remains on throughout.
 * This phase-only model has no single-oscillator amplitude Hopf bifurcation
 * and is not a fitted seizure model or a claim of therapeutic efficacy.
 *
 * Kuramoto, Y. (1975), Self-entrainment of a population of coupled non-linear
 * oscillators, Lecture Notes in Physics 39, 420-422.
 * https://doi.org/10.1007/BFb0013365
 *
 * Six observation functions are evaluated from the integrated phases. Their
 * time delays, not the hidden phases, feed a fixed three-component PCA view.
 * The plotted projection is not a claim of complete state reconstruction.
 * See Deyle & Sugihara (2011) for multivariate delay reconstruction:
 * https://doi.org/10.1371/journal.pone.0018295
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.KuramotoLab = factory();
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const TAU = Math.PI * 2;
  const N = 16;
  const CHANNELS = 6;
  const HZ = 120;
  const DT = 1 / HZ;
  const SAMPLE_HZ = 30;
  const SAMPLE_TICKS = HZ / SAMPLE_HZ;
  const LAG_SAMPLES = 4;
  const LAGS = 4;
  const DIMENSION = CHANNELS * LAGS;
  const LAG_SPAN = (LAGS - 1) * LAG_SAMPLES;
  const MAX_HISTORY = 800;
  const COUPLING = 2.4;
  const MEAN_HZ = 1.35;
  const STIMULUS_SECONDS = 1.6;
  const STIMULUS_STRENGTH = 13;
  const COOLDOWN_SECONDS = 6;
  const WARMUP_SECONDS = 32;
  const VISIBLE_SECONDS = 24;
  const DEFAULT_SEED = 20261113;
  const referenceCache = new Map();

  function randomSource(seed) {
    let state = seed >>> 0;
    return function () {
      state += 0x6D2B79F5;
      let value = state;
      value = Math.imul(value ^ value >>> 15, value | 1);
      value ^= value + Math.imul(value ^ value >>> 7, value | 61);
      return ((value ^ value >>> 14) >>> 0) / 4294967296;
    };
  }

  function wrap(angle) {
    return angle - TAU * Math.floor((angle + Math.PI) / TAU);
  }

  function freezeTree(value) {
    if (value && typeof value === 'object' && !Object.isFrozen(value)) {
      Object.values(value).forEach(freezeTree);
      Object.freeze(value);
    }
    return value;
  }

  function parameters(seed) {
    const random = randomSource(seed);
    const offsets = [-0.48, -0.32, -0.25, -0.20, -0.15, -0.10, -0.06, -0.02,
      0.02, 0.06, 0.10, 0.15, 0.20, 0.25, 0.32, 0.48];
    const frequencies = offsets.map(offset => MEAN_HZ + offset + (random() - 0.5) * 0.025);
    const mean = frequencies.reduce((sum, f) => sum + f, 0) / N;
    frequencies.forEach((f, i) => { frequencies[i] = f + MEAN_HZ - mean; });
    const initialPhases = Array.from({ length: N }, () => random() * TAU - Math.PI);
    const weights = Array.from({ length: CHANNELS }, (_, channel) => {
      const centre = channel * N / CHANNELS;
      const row = Array.from({ length: N }, (_, i) => {
        const distance = Math.min(Math.abs(i - centre), N - Math.abs(i - centre));
        return Math.exp(-0.5 * Math.pow(distance / 1.9, 2)) + 0.035 * random();
      });
      const total = row.reduce((sum, value) => sum + value, 0);
      return row.map(value => value / total);
    });
    return { seed, frequencies, omega: frequencies.map(f => f * TAU), initialPhases, weights };
  }

  function order(phases) {
    let real = 0;
    let imaginary = 0;
    for (let i = 0; i < N; i++) {
      real += Math.cos(phases[i]);
      imaginary += Math.sin(phases[i]);
    }
    return { coherence: Math.hypot(real, imaginary) / N, phase: Math.atan2(imaginary, real) };
  }

  function observations(phases, config) {
    const values = phases.map(phase => Math.sin(phase) + 0.18 * Math.sin(2 * phase));
    return config.weights.map(row => row.reduce((sum, weight, i) => sum + weight * values[i], 0));
  }

  function createEngine(config, timeOffset) {
    const phases = config.initialPhases.slice();
    const k1 = new Array(N), k2 = new Array(N), k3 = new Array(N), k4 = new Array(N);
    const temporary = new Array(N), sines = new Array(N), cosines = new Array(N);
    let ticks = 0;
    let pulse = null;

    function now() { return ticks * DT + timeOffset; }

    function active(at) {
      return pulse !== null && at >= pulse.start && at < pulse.start + STIMULUS_SECONDS;
    }

    function envelope(at) {
      return active(at) ? Math.pow(Math.sin(Math.PI * (at - pulse.start) / STIMULUS_SECONDS), 2) : 0;
    }

    function derivative(input, at, output) {
      let meanSin = 0;
      let meanCos = 0;
      for (let i = 0; i < N; i++) {
        sines[i] = Math.sin(input[i]);
        cosines[i] = Math.cos(input[i]);
        meanSin += sines[i] / N;
        meanCos += cosines[i] / N;
      }
      const amplitude = STIMULUS_STRENGTH * envelope(at);
      const reference = amplitude ? pulse.phase + MEAN_HZ * TAU * (at - pulse.start) : 0;
      for (let i = 0; i < N; i++) {
        const coupling = COUPLING * (meanSin * cosines[i] - meanCos * sines[i]);
        const drive = amplitude * Math.sin(reference + (i % 4) * TAU / 4 - input[i]);
        output[i] = config.omega[i] + coupling + drive;
      }
    }

    function tick() {
      const t = now();
      derivative(phases, t, k1);
      for (let i = 0; i < N; i++) temporary[i] = phases[i] + DT * k1[i] / 2;
      derivative(temporary, t + DT / 2, k2);
      for (let i = 0; i < N; i++) temporary[i] = phases[i] + DT * k2[i] / 2;
      derivative(temporary, t + DT / 2, k3);
      for (let i = 0; i < N; i++) temporary[i] = phases[i] + DT * k3[i];
      derivative(temporary, t + DT, k4);
      for (let i = 0; i < N; i++) {
        phases[i] = wrap(phases[i] + DT * (k1[i] + 2 * k2[i] + 2 * k3[i] + k4[i]) / 6);
      }
      ticks++;
      return ticks % SAMPLE_TICKS === 0;
    }

    function cooldownRemaining() {
      return pulse === null ? 0 : Math.max(0, pulse.start + STIMULUS_SECONDS + COOLDOWN_SECONDS - now());
    }

    function stimulate() {
      if (cooldownRemaining() > 1e-10) return false;
      pulse = { start: now(), phase: order(phases).phase };
      return true;
    }

    return {
      tick,
      stimulate,
      get t() { return now(); },
      sample() {
        return {
          t: now(),
          channels: observations(phases, config),
          coherence: order(phases).coherence,
          stimulated: active(now())
        };
      },
      state() {
        const remaining = cooldownRemaining();
        return {
          t: now(),
          coherence: order(phases).coherence,
          stimulated: active(now()),
          stimulusEnvelope: envelope(now()),
          canStimulate: remaining < 1e-10,
          cooldownRemaining: remaining,
          phases: phases.slice()
        };
      }
    };
  }

  // Lag-major order: all six current channels, then all six at t-tau, etc.
  function embed(history, index) {
    const last = index === undefined ? history.length - 1 : index;
    if (last < LAG_SPAN) return null;
    const vector = new Array(DIMENSION);
    for (let lag = 0; lag < LAGS; lag++) {
      const sample = history[last - lag * LAG_SAMPLES];
      const channels = Array.isArray(sample) ? sample : sample.channels;
      for (let channel = 0; channel < CHANNELS; channel++) {
        vector[lag * CHANNELS + channel] = channels[channel];
      }
    }
    return vector;
  }

  // Symmetric Jacobi eigensolver. The covariance is only 24 by 24 and is
  // decomposed once for a reference dataset, never during animation or input.
  function eigensystem(matrix) {
    const a = matrix.map(row => row.slice());
    const vectors = Array.from({ length: DIMENSION }, (_, i) =>
      Array.from({ length: DIMENSION }, (_, j) => Number(i === j)));
    for (let sweep = 0; sweep < 60; sweep++) {
      let largest = 0;
      for (let p = 0; p < DIMENSION - 1; p++) {
        for (let q = p + 1; q < DIMENSION; q++) {
          largest = Math.max(largest, Math.abs(a[p][q]));
          if (Math.abs(a[p][q]) < 1e-11) continue;
          const angle = 0.5 * Math.atan2(2 * a[p][q], a[q][q] - a[p][p]);
          const c = Math.cos(angle), s = Math.sin(angle);
          const app = a[p][p], aqq = a[q][q], apq = a[p][q];
          for (let k = 0; k < DIMENSION; k++) {
            if (k === p || k === q) continue;
            const akp = a[k][p], akq = a[k][q];
            a[k][p] = a[p][k] = c * akp - s * akq;
            a[k][q] = a[q][k] = s * akp + c * akq;
          }
          a[p][p] = c * c * app - 2 * s * c * apq + s * s * aqq;
          a[q][q] = s * s * app + 2 * s * c * apq + c * c * aqq;
          a[p][q] = a[q][p] = 0;
          for (let k = 0; k < DIMENSION; k++) {
            const vkp = vectors[k][p], vkq = vectors[k][q];
            vectors[k][p] = c * vkp - s * vkq;
            vectors[k][q] = s * vkp + c * vkq;
          }
        }
      }
      if (largest < 1e-10) break;
    }
    const indices = Array.from({ length: DIMENSION }, (_, i) => i).sort((i, j) => a[j][j] - a[i][i]);
    return {
      eigenvalues: indices.map(i => Math.max(0, a[i][i])),
      components: indices.slice(0, 3).map(i => {
        const component = vectors.map(row => row[i]);
        const pivot = component.reduce((best, value, j) => Math.abs(value) > Math.abs(component[best]) ? j : best, 0);
        return component[pivot] < 0 ? component.map(value => -value) : component;
      })
    };
  }

  function fitProjection(config) {
    const engine = createEngine(config, 0);
    const recent = [];
    const vectors = [];
    // Twelve seconds to settle, then 48 seconds spanning baseline, three
    // identical finite inputs, and their recoveries. Sample weighting is fixed.
    for (let tick = 0; tick < 60 * HZ; tick++) {
      if (tick === 20 * HZ || tick === 36 * HZ || tick === 48 * HZ) engine.stimulate();
      if (!engine.tick()) continue;
      recent.push(engine.sample());
      if (recent.length > LAG_SPAN + 1) recent.shift();
      if (engine.t >= 12 && recent.length === LAG_SPAN + 1) vectors.push(embed(recent));
    }
    const mean = new Array(DIMENSION).fill(0);
    vectors.forEach(row => row.forEach((value, j) => { mean[j] += value / vectors.length; }));
    const scale = new Array(DIMENSION).fill(0);
    vectors.forEach(row => row.forEach((value, j) => { scale[j] += Math.pow(value - mean[j], 2) / (vectors.length - 1); }));
    scale.forEach((value, j) => { scale[j] = Math.sqrt(Math.max(value, 1e-12)); });
    const covariance = Array.from({ length: DIMENSION }, () => new Array(DIMENSION).fill(0));
    vectors.forEach(row => {
      const standardized = row.map((value, j) => (value - mean[j]) / scale[j]);
      for (let i = 0; i < DIMENSION; i++) {
        for (let j = i; j < DIMENSION; j++) covariance[i][j] += standardized[i] * standardized[j] / (vectors.length - 1);
      }
    });
    for (let i = 0; i < DIMENSION; i++) {
      for (let j = 0; j < i; j++) covariance[i][j] = covariance[j][i];
    }
    const decomposition = eigensystem(covariance);
    const total = decomposition.eigenvalues.reduce((sum, value) => sum + value, 0);
    let calibrationMaximum = 0;
    let calibrationRadius = 0;
    vectors.forEach(row => {
      const standardized = row.map((value, j) => (value - mean[j]) / scale[j]);
      const point = decomposition.components.map(component =>
        component.reduce((sum, weight, j) => sum + weight * standardized[j], 0));
      calibrationMaximum = Math.max(calibrationMaximum, ...point.map(Math.abs));
      calibrationRadius = Math.max(calibrationRadius, Math.hypot(...point));
    });
    // One isotropic scale for the whole reference dataset, including input and
    // recovery. Rendering must retain this scale when a visitor stimulates.
    const displayScale = 0.92 / calibrationMaximum;
    return freezeTree({
      mean,
      scale,
      components: decomposition.components,
      eigenvalues: decomposition.eigenvalues.slice(0, 3),
      explainedVarianceRatio: decomposition.eigenvalues.slice(0, 3).map(value => value / total),
      displayScale,
      displayExtent: 1.15,
      calibrationExtent: 0.92,
      calibrationRadius: calibrationRadius * displayScale,
      referenceSamples: vectors.length,
      referenceSeconds: 48,
      referenceStimulusTimes: [20, 36, 48]
    });
  }

  function project(vector, projection) {
    if (vector === null) return null;
    const values = vector.map((value, i) => (value - projection.mean[i]) / projection.scale[i]);
    return projection.components.map(component =>
      component.reduce((sum, weight, i) => sum + weight * values[i], 0) * projection.displayScale);
  }

  function createExperiment(options) {
    const inputSeed = options && options.seed !== undefined ? options.seed : DEFAULT_SEED;
    if (!Number.isInteger(inputSeed) || inputSeed < 0 || inputSeed > 4294967295) {
      throw new RangeError('seed must be an unsigned 32-bit integer');
    }
    if (!referenceCache.has(inputSeed)) {
      const config = parameters(inputSeed);
      referenceCache.set(inputSeed, { config: freezeTree(config), projection: fitProjection(config) });
    }
    const { config, projection } = referenceCache.get(inputSeed);
    const history = [];
    const delayedSamples = [];
    let engine;
    let remainder = 0;

    const metadata = freezeTree({
      model: 'Kuramoto phase oscillator network',
      provenance: 'Model-generated illustration, not an experimental recording or validated seizure model.',
      seed: inputSeed,
      oscillatorCount: N,
      channelCount: CHANNELS,
      frequenciesHz: config.frequencies,
      coupling: COUPLING,
      integrationHz: HZ,
      integrator: 'RK4',
      sampleHz: SAMPLE_HZ,
      historyLimit: MAX_HISTORY,
      observation: { weights: config.weights, secondHarmonic: 0.18 },
      embedding: { lagSamples: LAG_SAMPLES, lagSeconds: LAG_SAMPLES / SAMPLE_HZ, lagCount: LAGS, dimension: DIMENSION, order: 'lag-major' },
      projection,
      stimulus: { duration: STIMULUS_SECONDS, strength: STIMULUS_STRENGTH, groups: 4, cooldown: COOLDOWN_SECONDS, envelope: 'sin-squared', phaseResponse: 'sin(targetPhase - phase)' },
      source: 'https://doi.org/10.1007/BFb0013365'
    });

    function record(visible) {
      const sample = engine.sample();
      delayedSamples.push(sample);
      if (delayedSamples.length > LAG_SPAN + 1) delayedSamples.shift();
      sample.point = project(embed(delayedSamples), projection);
      if (visible) {
        history.push(sample);
        if (history.length > MAX_HISTORY) history.shift();
      }
      return sample;
    }

    function reset() {
      engine = createEngine(config, -WARMUP_SECONDS);
      history.length = 0;
      delayedSamples.length = 0;
      remainder = 0;
      for (let i = 0; i < WARMUP_SECONDS * HZ; i++) {
        if (engine.tick()) record(engine.t >= -VISIBLE_SECONDS);
      }
      return history[history.length - 1];
    }

    function step(seconds) {
      if (!Number.isFinite(seconds) || seconds < 0) throw new RangeError('step requires finite, non-negative seconds');
      remainder += seconds;
      const ticks = Math.floor((remainder + 1e-10) / DT);
      remainder = Math.max(0, remainder - ticks * DT);
      for (let i = 0; i < ticks; i++) if (engine.tick()) record(true);
      return history[history.length - 1];
    }

    reset();
    return {
      history,
      metadata,
      step,
      reset,
      stimulate() { return engine.stimulate(); },
      embed,
      project(vector) { return project(vector, projection); },
      projectSample(samples, index) { return project(embed(samples, index), projection); },
      get state() { return engine.state(); }
    };
  }

  return Object.freeze({ createExperiment });
});
