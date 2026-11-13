'use strict';

// Run: node scripts/check-kuramoto.cjs
// These checks target the scientific data path and the visible intervention.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { performance } = require('node:perf_hooks');
const file = path.join(__dirname, '../assets/js/kuramoto.js');
const { createExperiment } = require(file);
const mean = values => values.reduce((sum, value) => sum + value, 0) / values.length;
const distance = (a, b) => Math.hypot(...a.map((value, i) => value - b[i]));
const close = (a, b, tolerance = 1e-11) => assert.ok(Math.abs(a - b) <= tolerance, `${a} != ${b}`);
const start = performance.now();
const experiment = createExperiment();
const initializationMs = performance.now() - start;
const metadata = experiment.metadata;
const projection = metadata.projection;
const initialHistory = JSON.stringify(experiment.history);
const projectionSnapshot = JSON.stringify(projection);

assert.equal(metadata.oscillatorCount, 16);
assert.equal(metadata.channelCount, 6);
assert.ok(experiment.history.length >= 12 * metadata.sampleHz);
assert.ok(experiment.history[0].t <= -12);
assert.equal(experiment.history.at(-1).t, 0);
assert.ok(new Set(metadata.frequenciesHz).size > 1, 'oscillators must be heterogeneous');

// Reconstruct every displayed point independently from displayed channels.
// Nothing in this calculation uses the hidden oscillator phases.
let maximumProjectionError = 0;
for (let sampleIndex = 12; sampleIndex < experiment.history.length; sampleIndex++) {
  const delayVector = [];
  for (let lag = 0; lag < metadata.embedding.lagCount; lag++) {
    delayVector.push(...experiment.history[sampleIndex - lag * metadata.embedding.lagSamples].channels);
  }
  const independentlyProjected = projection.components.map(component => {
    let coordinate = 0;
    for (let dimension = 0; dimension < delayVector.length; dimension++) {
      coordinate += component[dimension] * (delayVector[dimension] - projection.mean[dimension]) / projection.scale[dimension];
    }
    return coordinate * projection.displayScale;
  });
  maximumProjectionError = Math.max(maximumProjectionError, distance(independentlyProjected, experiment.history[sampleIndex].point));
}
assert.ok(maximumProjectionError < 1e-12);
assert.equal(experiment.embed(experiment.history, 11), null);
assert.equal(experiment.projectSample(experiment.history, 11), null);
assert.deepEqual(experiment.projectSample(experiment.history), experiment.history.at(-1).point);

// Check the observation functions against the integrated state, not a drawing.
const initialPhases = experiment.state.phases;
const independentlyObserved = metadata.observation.weights.map(weights => weights.reduce((sum, weight, i) =>
  sum + weight * (Math.sin(initialPhases[i]) + metadata.observation.secondHarmonic * Math.sin(2 * initialPhases[i])), 0));
assert.deepEqual(independentlyObserved, experiment.history.at(-1).channels);

// PCA is an orthogonal view and keeps one shared scale for all three axes.
for (let i = 0; i < 3; i++) {
  for (let j = 0; j < 3; j++) {
    close(projection.components[i].reduce((sum, value, k) => sum + value * projection.components[j][k], 0), Number(i === j));
  }
}
assert.ok(projection.explainedVarianceRatio.every(value => value > 0 && value < 1));
assert.ok(projection.explainedVarianceRatio.reduce((sum, value) => sum + value, 0) <= 1);
assert.ok(projection.explainedVarianceRatio[2] > 0.03, 'third component must contain real variation');
assert.ok(Object.isFrozen(projection) && Object.isFrozen(projection.components[0]));

// A fixed internal clock makes wall-frame batching irrelevant.
const batched = createExperiment();
const framed = createExperiment();
batched.step(2.4);
for (let i = 0; i < 144; i++) framed.step(1 / 60);
assert.deepEqual(framed.history, batched.history);
assert.deepEqual(framed.state.phases, batched.state.phases);

// In the unforced all-to-all model, pairwise coupling cancels in the mean
// angular velocity. This is a model identity, independent of the renderer.
const before = experiment.state.phases;
experiment.step(0.1);
const phaseIncrements = experiment.state.phases.map((phase, i) => {
  const difference = phase - before[i];
  return difference - 2 * Math.PI * Math.floor((difference + Math.PI) / (2 * Math.PI));
});
close(mean(phaseIncrements) / 0.1, mean(metadata.frequenciesHz) * 2 * Math.PI, 1e-10);
experiment.reset();
assert.equal(JSON.stringify(experiment.history), initialHistory);

// Matched trajectories diverge through a finite, subgroup-specific input.
// The pulse cannot alter phases instantaneously or restart while cooling down.
const control = createExperiment();
const treated = createExperiment();
const baselineCoherence = mean(treated.history.filter(sample => sample.t >= -12).map(sample => sample.coherence));
const preInputPhases = treated.state.phases;
assert.equal(treated.stimulate(), true);
assert.deepEqual(treated.state.phases, preInputPhases);
assert.equal(treated.state.stimulusEnvelope, 0);
assert.equal(treated.stimulate(), false);
const response = [];
let largestChannelDifference = 0;
for (let i = 0; i < 30 * metadata.sampleHz; i++) {
  const stimulated = treated.step(1 / metadata.sampleHz);
  const untreated = control.step(1 / metadata.sampleHz);
  response.push(stimulated);
  largestChannelDifference = Math.max(largestChannelDifference, distance(stimulated.channels, untreated.channels));
  if (stimulated.t > metadata.stimulus.duration) {
    assert.equal(stimulated.stimulated, false);
    assert.equal(treated.state.stimulusEnvelope, 0);
  }
}
const meanCoherence = (from, to) => mean(response.filter(sample => sample.t >= from && sample.t < to).map(sample => sample.coherence));
const pulseCoherence = meanCoherence(0.8, 1.6);
const earlyCoherence = meanCoherence(1.6, 4);
const recoveredCoherence = meanCoherence(8, 20);
assert.ok(largestChannelDifference > 0.2, 'input must change observed channels');
assert.ok(pulseCoherence < baselineCoherence * 0.5, 'chosen illustrative pulse should reduce phase alignment');
assert.ok(recoveredCoherence > earlyCoherence + 0.15, 'unforced coupling should restore the baseline trend');
assert.ok(Math.abs(recoveredCoherence - baselineCoherence) < 0.1);
// Recovery is a statistical trend. Autonomous phase symmetry does not require
// the stimulated trajectory to rejoin the exact unperturbed phase trajectory.
assert.equal(treated.state.canStimulate, true);
assert.equal(treated.metadata.projection, projection);
assert.equal(JSON.stringify(treated.metadata.projection), projectionSnapshot);

// Verify reproducibility of the full action schedule, not just the seed label.
const reproduced = createExperiment();
reproduced.stimulate();
reproduced.step(30);
assert.deepEqual(reproduced.history, treated.history);
assert.deepEqual(reproduced.state.phases, treated.state.phases);
treated.reset();
assert.equal(JSON.stringify(treated.history), initialHistory);
assert.equal(JSON.stringify(treated.metadata.projection), projectionSnapshot);
assert.equal(treated.state.canStimulate, true);

// Long continuous operation and repeated interventions remain finite, bounded,
// and within the fixed calibrated view for this deterministic demonstration.
let maximumCoordinate = 0;
for (let cycle = 0; cycle < 30; cycle++) {
  assert.equal(treated.stimulate(), true);
  for (let frame = 0; frame < 10 * metadata.sampleHz; frame++) {
    const sample = treated.step(1 / metadata.sampleHz);
    assert.ok(Number.isFinite(sample.t));
    assert.ok(sample.channels.every(value => Number.isFinite(value) && Math.abs(value) <= 1.18));
    assert.ok(sample.point.every(Number.isFinite));
    assert.ok(sample.coherence >= 0 && sample.coherence <= 1 + 1e-12);
    maximumCoordinate = Math.max(maximumCoordinate, ...sample.point.map(Math.abs));
    assert.ok(treated.history.length <= metadata.historyLimit);
  }
}
assert.ok(maximumCoordinate < projection.displayExtent);
assert.ok(treated.state.phases.every(phase => phase >= -Math.PI && phase <= Math.PI));
assert.equal(JSON.stringify(treated.metadata.projection), projectionSnapshot);
assert.throws(() => treated.step(-1), RangeError);
assert.throws(() => treated.step(Infinity), RangeError);
assert.throws(() => createExperiment({ seed: NaN }), RangeError);

// Browser-global loading uses exactly the same numerical implementation.
const browser = vm.createContext({});
vm.runInContext(fs.readFileSync(file, 'utf8'), browser);
assert.equal(typeof browser.KuramotoLab.createExperiment, 'function');
const browserExperiment = browser.KuramotoLab.createExperiment();
assert.equal(JSON.stringify(browserExperiment.history), initialHistory);

console.log(JSON.stringify({
  result: 'PASS',
  checks: [
    'phase-derived observations', 'displayed channels to delay vector to PCA point',
    'fixed orthogonal projection', 'frame-batching invariance', 'mean-frequency identity',
    'finite phase-sensitive input', 'observable divergence and coherence recovery',
    'seed and reset reproducibility', '300 seconds of repeated inputs', 'CommonJS and browser-global parity'
  ],
  initializationMs: Number(initializationMs.toFixed(1)),
  maximumProjectionError,
  baselineCoherence,
  pulseCoherence,
  earlyCoherence,
  recoveredCoherence,
  largestChannelDifference,
  maximumCoordinate,
  fixedViewExtent: projection.displayExtent,
  explainedVarianceRatio: projection.explainedVarianceRatio,
  elapsedMs: Number((performance.now() - start).toFixed(1))
}, null, 2));
