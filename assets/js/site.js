(() => {
  'use strict';

  const svgNS = 'http://www.w3.org/2000/svg';
  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
  const lerp = (a, b, amount) => a + (b - a) * amount;
  const body = document.body;

  // These figures are mathematical illustrations, never experimental recordings.
  document.querySelectorAll('.project-drawing').forEach((svg) => {
    const style = svg.dataset.drawing;
    const fragment = document.createDocumentFragment();
    const path = (points, opacity = 1, width = 1) => {
      const element = document.createElementNS(svgNS, 'path');
      element.setAttribute('d', points.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(2)},${p[1].toFixed(2)}`).join(' '));
      element.setAttribute('fill', 'none');
      element.setAttribute('stroke', 'currentColor');
      element.setAttribute('stroke-width', String(width));
      element.setAttribute('opacity', String(opacity));
      fragment.append(element);
    };
    for (let x = 30; x <= 510; x += 40) path([[x, 35], [x, 305]], .08);
    for (let y = 50; y <= 300; y += 40) path([[30, y], [510, y]], .08);
    if (style === 'traces') {
      for (let row = 0; row < 5; row++) {
        const points = [];
        for (let i = 0; i <= 480; i++) {
          const x = i / 480;
          const burst = Math.exp(-Math.pow((x - .35 - row * .045) * 12, 2));
          const y = 74 + row * 47 + Math.sin(x * 42 + row) * 7 + Math.sin(x * 130 + row * .7) * (3 + burst * 16);
          points.push([30 + i, y]);
        }
        path(points, .36 + row * .13, 1.3);
      }
    } else if (style === 'network') {
      const nodes = Array.from({length: 13}, (_, i) => {
        const angle = i * 2.39996;
        const radius = 30 + Math.sqrt(i / 12) * 108;
        return [270 + Math.cos(angle) * radius * 1.4, 170 + Math.sin(angle) * radius];
      });
      nodes.forEach((a, i) => nodes.forEach((b, j) => {
        if (j > i && (i + j) % 3 === 0) path([a, b], .22);
      }));
      nodes.forEach(([cx, cy], i) => {
        const circle = document.createElementNS(svgNS, 'circle');
        circle.setAttribute('cx', String(cx)); circle.setAttribute('cy', String(cy));
        circle.setAttribute('r', String(i === 0 ? 6 : 3.2));
        circle.setAttribute('fill', 'currentColor'); circle.setAttribute('opacity', i === 0 ? '1' : '.7');
        fragment.append(circle);
      });
    } else {
      for (let strand = 0; strand < 14; strand++) {
        const points = [];
        for (let i = 0; i <= 300; i++) {
          const t = i / 300 * Math.PI * 2;
          const r = 116 + Math.cos(t * 3 + strand * .14) * 31;
          points.push([270 + Math.cos(t) * r * 1.38, 170 + Math.sin(t) * r * .7 + Math.sin(t * 3 + strand * .16) * 30]);
        }
        path(points, .18 + strand * .035);
      }
    }
    svg.replaceChildren(fragment);
  });

  const canvas = document.querySelector('#research-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const stage = canvas.parentElement;
  const figure = canvas.closest('figure');
  const hero = document.querySelector('.hero');
  const pauseButton = figure.querySelector('.motion-button');
  const controls = figure.querySelector('.figure-controls');
  const formControl = document.querySelector('#form-control');
  const perturbButton = figure.querySelector('.perturb-button');
  const media = window.matchMedia('(prefers-reduced-motion: reduce)');
  let paused = false;
  try { paused = sessionStorage.getItem('acanal-motion-paused') === 'true'; } catch (_) { /* Storage is optional. */ }
  let inView = true;
  let width = 600;
  let height = 500;
  let time = 0;
  let lastFrame = 0;
  let raf = 0;
  let form = Number(formControl.value) / 100;
  let perturbation = 0;
  let scrollPhase = 0;
  let pointer = {x: 0, y: 0};
  let design = body.dataset.design;

  const staticMode = () => paused || media.matches;
  const canAnimate = () => !staticMode() && inView && !document.hidden;
  const line = (points, colour, lineWidth = 1) => {
    if (!points.length) return;
    ctx.beginPath();
    points.forEach((p, i) => i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]));
    ctx.strokeStyle = colour;
    ctx.lineWidth = lineWidth;
    ctx.stroke();
  };
  const dot = (x, y, radius, colour) => {
    ctx.beginPath(); ctx.arc(x, y, radius, 0, Math.PI * 2); ctx.fillStyle = colour; ctx.fill();
  };

  function drawGrid() {
    const step = width / 10;
    ctx.strokeStyle = design === 'atlas' ? 'rgba(178,169,239,.07)' : 'rgba(196,217,179,.055)';
    ctx.lineWidth = .7;
    for (let x = step; x < width; x += step) {
      ctx.beginPath(); ctx.moveTo(x, height * .08); ctx.lineTo(x, height * .9); ctx.stroke();
    }
    for (let y = height * .1; y < height * .95; y += step) {
      ctx.beginPath(); ctx.moveTo(width * .05, y); ctx.lineTo(width * .95, y); ctx.stroke();
    }
    const corners = [[.06,.1],[.94,.1],[.06,.9],[.94,.9]];
    corners.forEach(([x,y]) => {
      line([[x*width-4,y*height],[x*width+4,y*height]], 'rgba(208,228,176,.35)');
      line([[x*width,y*height-4],[x*width,y*height+4]], 'rgba(208,228,176,.35)');
    });
  }

  function drawManuscript() {
    // A family of projected parametric curves, gently deformable by the visitor.
    // Scroll affects the viewpoint, not scientific data or interpretation.
    const angle = -.36 + time * .045 + scrollPhase * .5 + pointer.x * .12;
    const ca = Math.cos(angle), sa = Math.sin(angle);
    const tilt = .38 + pointer.y * .05;
    const scale = Math.min(width * .255, height * .34);
    const strands = width < 400 ? 21 : 32;
    for (let strand = 0; strand < strands; strand++) {
      const offset = strand / (strands - 1);
      const points = [];
      for (let i = 0; i <= 240; i++) {
        const t = i / 240 * Math.PI * 2;
        const ripple = Math.sin(t * 5 - time * 1.2) * perturbation * .11;
        const r = 1.02 + Math.cos(t * 3 + offset * 1.45 + time * .1) * (.14 + form * .22) + ripple;
        const x = Math.cos(t) * r;
        const y = Math.sin(t) * r;
        const z = Math.sin(t * 3 + offset * 2.2) * (.25 + form * .44) + (offset - .5) * .72;
        const rotatedX = x * ca + z * sa;
        const rotatedZ = -x * sa + z * ca;
        points.push([width * .5 + rotatedX * scale, height * .48 + (y * tilt - rotatedZ * .72) * scale]);
      }
      const alpha = .15 + .53 * Math.sin(Math.PI * (offset * .75 + .13));
      line(points, `rgba(${strand % 6 === 0 ? '214,180,128' : '204,223,169'},${alpha})`, strand % 6 === 0 ? 1.1 : .7);
    }
    // A small reference axis anchors the abstract object.
    const ax = width * .12, ay = height * .8;
    line([[ax, ay-26],[ax,ay],[ax+27,ay]], 'rgba(220,228,204,.35)', .7);
    line([[ax,ay],[ax-13,ay+12]], 'rgba(220,228,204,.35)', .7);
    ctx.font = '9px ui-monospace, monospace'; ctx.fillStyle = 'rgba(220,228,204,.6)'; ctx.fillText('x',ax+31,ay+3); ctx.fillText('y',ax-3,ay-31);
  }

  function drawSignals() {
    const rows = 7;
    const margin = width * .1;
    for (let row = 0; row < rows; row++) {
      const baseline = height * (.17 + row * .105);
      const points = [];
      for (let i = 0; i <= 440; i++) {
        const u = i / 440;
        const x = margin + (width - margin * 2) * u;
        const t = u * 19 - time * .26 + row * .26;
        const burst = Math.exp(-Math.pow((u - (.44 + .10 * Math.sin(time * .12 + row))) * 7, 2));
        const wave = Math.sin(t * 2.1) * .35 + Math.sin(t * 6.3 + row) * (.18 + burst * form) + Math.sin(t * 12.7) * .08;
        const extra = perturbation * Math.sin(u * 40 - time * 3) * Math.exp(-Math.pow((u - .5) * 4, 2));
        points.push([x, baseline + (wave + extra) * height * .034]);
      }
      line([[margin,baseline],[width-margin,baseline]], 'rgba(168,220,203,.1)', .6);
      line(points, `rgba(164,226,201,${.4+row*.075})`, row === 3 ? 1.5 : 1);
      ctx.font = '10px ui-monospace, monospace';ctx.fillStyle = 'rgba(189,217,210,.65)';ctx.fillText(`0${row+1}`,width*.035,baseline+3);
    }
  }

  function drawAtlas() {
    const nodes = [[.28,.33],[.72,.25],[.70,.70],[.28,.76]];
    const centre = [.49,.50];
    const edges = [[nodes[0],nodes[1]],[nodes[1],nodes[2]],[nodes[2],nodes[3]],[nodes[3],nodes[0]],...nodes.map(n=>[n,centre])];
    edges.forEach(([a,b],index) => {
      const curve=[];
      for(let i=0;i<=40;i++) {
        const t=i/40;
        curve.push([lerp(a[0],b[0],t)*width, (lerp(a[1],b[1],t)+Math.sin(t*Math.PI)*.025*form)*height]);
      }
      line(curve, 'rgba(182,174,240,.24)', .8);
      const travel = (time*.05+index*.13)%1;
      dot(lerp(a[0],b[0],travel)*width,(lerp(a[1],b[1],travel)+Math.sin(travel*Math.PI)*.025*form)*height,1.8,'rgba(211,205,252,.8)');
    });
    const ring = [];
    for(let i=0;i<=120;i++) {
      const angle=i/120*Math.PI*2;
      ring.push([width*.49+Math.cos(angle)*width*.06,height*.5+Math.sin(angle)*width*.06]);
    }
    line(ring,'rgba(185,176,255,.7)');
    ctx.fillStyle='rgba(230,225,255,.8)';ctx.font='italic 25px Georgia, serif';ctx.textAlign='center';ctx.fillText('ac',width*.49,height*.5+7);ctx.textAlign='left';
  }

  function draw() {
    ctx.clearRect(0, 0, width, height);
    drawGrid();
    if (design === 'signal') drawSignals();
    else if (design === 'atlas') drawAtlas();
    else drawManuscript();
  }

  function frame(now) {
    raf = 0;
    if (!canAnimate()) return;
    if (now - lastFrame >= 1000 / 30) {
      const dt = lastFrame ? Math.min((now - lastFrame) / 1000, .1) : 0;
      time += dt;
      perturbation *= Math.exp(-dt * .85);
      lastFrame = now;
      draw();
    }
    raf = requestAnimationFrame(frame);
  }

  function schedule() {
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
    lastFrame = 0;
    if (canAnimate()) raf = requestAnimationFrame(frame);
  }

  function resize() {
    const box = stage.getBoundingClientRect();
    width = Math.max(1, box.width); height = Math.max(1, box.height);
    const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(width * pixelRatio); canvas.height = Math.round(height * pixelRatio);
    ctx.setTransform(pixelRatio,0,0,pixelRatio,0,0);
    draw();
  }

  function updateMotionControl() {
    pauseButton.disabled = media.matches;
    pauseButton.setAttribute('aria-pressed', String(staticMode()));
    pauseButton.textContent = media.matches ? 'Reduced motion' : paused ? 'Resume motion ▷' : 'Pause motion Ⅱ';
    body.dataset.motion = staticMode() ? 'paused' : 'running';
    perturbButton.disabled = staticMode();
    schedule();
  }

  pauseButton.hidden = false;
  controls.hidden = false;
  stage.classList.add('canvas-ready');
  pauseButton.addEventListener('click', () => {
    paused = !paused;
    try { sessionStorage.setItem('acanal-motion-paused', String(paused)); } catch (_) { /* Optional storage. */ }
    updateMotionControl();
  });
  media.addEventListener('change', () => { pointer = {x:0,y:0}; updateMotionControl(); draw(); });
  document.addEventListener('visibilitychange', schedule);
  new IntersectionObserver(([entry]) => { inView = entry.isIntersecting; schedule(); }, {threshold: 0}).observe(stage);
  new ResizeObserver(resize).observe(stage);
  formControl.addEventListener('input', () => { form = Number(formControl.value) / 100; draw(); });
  perturbButton.addEventListener('click', () => { if (!staticMode()) perturbation = 1.8; });
  stage.addEventListener('pointermove', event => {
    if (staticMode()) return;
    const rect = stage.getBoundingClientRect();
    pointer = {x: (event.clientX-rect.left)/rect.width-.5, y: (event.clientY-rect.top)/rect.height-.5};
  });
  stage.addEventListener('pointerleave', () => { if (!staticMode()) pointer = {x:0,y:0}; });
  window.addEventListener('scroll', () => {
    if (staticMode() || !inView) return;
    scrollPhase = clamp(-hero.getBoundingClientRect().top / Math.max(hero.offsetHeight,1), 0, 1);
  }, {passive:true});

  const captions = {
    manuscript: ['A study in neural dynamics', 'An editorial composition with an explorable, slowly evolving signal sculpture.'],
    signal: ['An illustrative signal field', 'A wide signal display, sharper typography, and an instrument-like rhythm.'],
    atlas: ['A map of this research space', 'A spatial navigation map. Each node takes you to a section of the portfolio.']
  };
  function selectDesign(next) {
    if (!Object.hasOwn(captions, next)) return;
    design = next; body.dataset.design = next;
    figure.querySelector('.figure-mode').textContent = captions[next][0];
    document.querySelectorAll('[data-set-design]').forEach(button => button.setAttribute('aria-pressed',String(button.dataset.setDesign===next)));
    const caption = document.querySelector('.design-caption');
    if (caption) caption.textContent = captions[next][1];
    figure.querySelector('.figure-hint').textContent = next === 'atlas' ? 'A navigation map, not a diagram of scientific relationships.' : 'Synthetic geometry, inspired by neural dynamics. Drag the slider to explore.';
    controls.hidden = next === 'atlas';
    resize();
  }
  document.querySelectorAll('[data-set-design]').forEach(button => button.addEventListener('click', () => selectDesign(button.dataset.setDesign)));
  selectDesign(design);
  resize();
  updateMotionControl();
})();
