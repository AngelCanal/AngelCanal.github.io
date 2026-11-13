'use strict';

// Regenerate the JavaScript-free figure from the same numerical module as the
// live canvas: node scripts/export-kuramoto-figure.cjs
// No geometry in the traces or trajectory is fabricated for this export.
const fs = require('node:fs');
const path = require('node:path');
const { createExperiment } = require('../assets/js/kuramoto.js');

const width = 600;
const height = 500;
const experiment = createExperiment();
const latest = experiment.history.at(-1).t;
const sage = [203, 225, 172];
const channelColours = [[203,225,172],[154,198,181],[182,208,189],[222,191,144],[165,189,167],[214,220,186]];
const number = value => Number(value.toFixed(3));
const colour = rgb => `rgb(${rgb.join(',')})`;
const elements = [];

function line(points, rgb, opacity, strokeWidth) {
  if (points.length < 2) return;
  const d = points.map((point, index) => `${index ? 'L' : 'M'}${number(point[0])} ${number(point[1])}`).join(' ');
  elements.push(`<path d="${d}" fill="none" stroke="${colour(rgb)}" stroke-opacity="${number(opacity)}" stroke-width="${strokeWidth}" stroke-linecap="round" stroke-linejoin="round"/>`);
}

function text(value, x, y, opacity, size = 12) {
  elements.push(`<text x="${number(x)}" y="${number(y)}" fill="${colour(sage)}" fill-opacity="${opacity}" font-family="ui-monospace,monospace" font-size="${size}">${value}</text>`);
}

function dot(point, radius, opacity) {
  elements.push(`<circle cx="${number(point[0])}" cy="${number(point[1])}" r="${radius}" fill="${colour(sage)}" fill-opacity="${opacity}"/>`);
}

// Identical to the live renderer at its neutral pointer position and fully
// reconstructed stage. The view uses the module's fixed PCA data coordinates.
function projected(point) {
  const angle = -0.47;
  const x = point[0] * Math.cos(angle) + point[2] * Math.sin(angle);
  const depth = -point[0] * Math.sin(angle) + point[2] * Math.cos(angle);
  const elevation = 0.55;
  const y = point[1] * Math.sin(elevation) - depth * Math.cos(elevation);
  const scale = Math.min(width * 0.36, height * 0.32);
  return [width * 0.53 + x * scale, height * 0.65 - y * scale];
}

function signalPoint(sample, channel) {
  const x = 43 + (width - 67) * (1 - (latest - sample.t) / 7.5);
  const gap = (height * 0.27 - 43) / 5;
  return [x, 43 + channel * gap - sample.channels[channel] * gap * 0.35];
}

const visible = experiment.history.filter(sample => sample.t >= latest - 7.5);
const recent = visible.filter(sample => sample.t >= latest - 0.8);
const highlightX = signalPoint({ t: latest - 0.8, channels: [0] }, 0)[0];
elements.push(`<rect x="${number(highlightX)}" y="30" width="${number(width - 24 - highlightX)}" height="120" fill="url(#recent-window)"/>`);
for (let channel = 0; channel < 6; channel++) {
  const baseline = signalPoint({ t: latest, channels: [0,0,0,0,0,0] }, channel)[1];
  line([[43, baseline], [width - 24, baseline]], sage, 0.075, 0.6);
  line(visible.map(sample => signalPoint(sample, channel)), channelColours[channel], 0.42, 0.8);
  line(recent.map(sample => signalPoint(sample, channel)), channelColours[channel], 0.95, 1.2);
}
text('SAME SIX CHANNELS', 43, 16, 0.75);
text('RECENT SAMPLES', width - 130, height * 0.30 + 14, 0.75);

const trajectory = experiment.history.filter(sample => sample.point && sample.t >= latest - 13);
for (let n = -4; n <= 4; n++) {
  const v = n * 0.3;
  line([projected([-1.2, -0.65, v]), projected([1.2, -0.65, v])], sage, 0.055, 0.6);
  line([projected([v, -0.65, -1.2]), projected([v, -0.65, 1.2])], sage, 0.055, 0.6);
}
const origin = projected([0, 0, 0]);
[[0.95,0,0],[0,0.95,0],[0,0,0.95]].forEach(point => line([origin, projected(point)], sage, 0.13, 0.7));
for (let i = 1; i < trajectory.length; i++) {
  const age = latest - trajectory[i].t;
  const opacity = 0.12 + 0.43 * Math.pow(1 - age / 13, 1.7);
  line([projected(trajectory[i - 1].point), projected(trajectory[i].point)], sage, opacity, age < 0.8 ? 1.8 : 1);
}
line(trajectory.filter(sample => sample.t >= latest - 0.8).map(sample => projected(sample.point)), sage, 0.92, 1.7);
const last = trajectory.at(-1);
const endpoint = projected(last.point);
dot(endpoint, 9, 0.06);
dot(endpoint, 4.5, 0.15);
dot(endpoint, 2.1, 0.95);
const traceEndpoint = signalPoint(last, 2);
elements.push('<g stroke-dasharray="2 5">');
line([traceEndpoint, [width - 17, traceEndpoint[1] + 18], [width - 17, endpoint[1]], endpoint], sage, 0.16, 0.65);
elements.push('</g>');
text('3D VIEW', 24, height - 21, 0.75);

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="500" viewBox="0 0 600 500" role="img" aria-labelledby="kuramoto-title kuramoto-description">
  <title id="kuramoto-title">Six simulated signals and their reconstructed trajectory</title>
  <desc id="kuramoto-description">Six weighted observations of sixteen heterogeneous coupled Kuramoto phase oscillators appear above a fixed three-dimensional PCA projection of their multivariate delay coordinates. The traces show 7.5 seconds and the trajectory shows 13 seconds. The same latest 0.8 seconds are highlighted in both views. These are model-generated signals, not experimental recordings. No stimulation has been applied in this still. Generated reproducibly with seed ${experiment.metadata.seed}.</desc>
  <defs>
    <linearGradient id="recent-window" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="rgb(208,228,176)" stop-opacity="0.025"/>
      <stop offset="1" stop-color="rgb(208,228,176)" stop-opacity="0.10"/>
    </linearGradient>
  </defs>
  ${elements.join('\n  ')}
</svg>
`;

const destination = path.join(__dirname, '../assets/figures/kuramoto-static.svg');
fs.mkdirSync(path.dirname(destination), { recursive: true });
fs.writeFileSync(destination, svg, 'utf8');
console.log(`Exported ${visible.length} observed samples and ${trajectory.length} reconstructed samples to ${destination}`);
