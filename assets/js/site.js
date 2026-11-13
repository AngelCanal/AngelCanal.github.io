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
  if (!canvas || !window.KuramotoLab) return;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const experiment = window.KuramotoLab.createExperiment();
  const stage = canvas.parentElement;
  const figure = canvas.closest('figure');
  const controls = figure.querySelector('.journey-controls');
  const stageButtons = Array.from(controls.querySelectorAll('button'));
  const steps = Array.from(document.querySelectorAll('[data-journey-step]'));
  const description = figure.querySelector('.figure-description');
  const pulseControls = figure.querySelector('.stimulation-controls');
  const pulseButton = figure.querySelector('.stimulate-button');
  const resetButton = figure.querySelector('.reset-button');
  const status = figure.querySelector('.stimulus-status');
  const pauseButton = figure.querySelector('.motion-button');
  const media = window.matchMedia('(prefers-reduced-motion: reduce)');
  let paused = false;
  try { paused = sessionStorage.getItem('acanal-motion-paused') === 'true'; } catch (_) { /* Storage is optional. */ }
  let width = 600, height = 500;
  let currentStage = 0, blend = 0;
  let inView = true, raf = 0, lastFrame = 0;
  let manualScrollY = null;
  let pointer = {x: 0, y: 0};
  let beforePulse = [];
  let pulseAt = null, pulseEnded = false, readyAnnounced = false, pulseBaseline = null;
  const sage = [203, 225, 172];
  const warm = [226, 178, 119];
  const channelColours = [[203,225,172],[154,198,181],[182,208,189],[222,191,144],[165,189,167],[214,220,186]];
  const text = [
    'Six signals from one interacting network. The highlighted window contains the samples we will follow into a reconstructed space.',
    'The same samples, reorganized by their recent history. A fixed three-dimensional view reveals the structure of their trajectory.',
    'Apply a brief phase-dependent input. Watch its effect in both the original signals and the reconstructed trajectory.'
  ];
  const labels = ['Six channels. One system.', 'The same activity, reconstructed.', 'A brief input. An evolving response.'];
  const staticMode = () => paused || media.matches;
  const canAnimate = () => !staticMode() && inView && !document.hidden;
  const rgba = (colour, alpha) => `rgba(${colour.join(',')},${alpha})`;
  const smooth = t => t * t * (3 - 2 * t);

  function line(points, colour, lineWidth = 1) {
    if (!points.length) return;
    ctx.beginPath();
    points.forEach((p, i) => i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]));
    ctx.strokeStyle = colour; ctx.lineWidth = lineWidth; ctx.stroke();
  }
  function dot(x, y, radius, colour) {
    ctx.beginPath(); ctx.arc(x, y, radius, 0, Math.PI * 2); ctx.fillStyle = colour; ctx.fill();
  }
  function type(value, x, y, colour = 'rgba(190,204,184,.57)', size = 9) {
    ctx.font = `${size}px ui-monospace, monospace`; ctx.fillStyle = colour; ctx.fillText(value, x, y);
  }
  function projected(point) {
    // Only the view rotates slightly. Data coordinates and their scale stay fixed.
    const angle = -.47 + pointer.x * .055;
    const ca = Math.cos(angle), sa = Math.sin(angle);
    const x = point[0] * ca + point[2] * sa;
    const depth = -point[0] * sa + point[2] * ca;
    const elevation = .55 + pointer.y * .025;
    const y = point[1] * Math.sin(elevation) - depth * Math.cos(elevation);
    const scale = Math.min(width * .36, height * .32);
    return [width * .53 + x * scale, height * .65 - y * scale];
  }
  function signalPoint(sample, channel, latest, compact) {
    const duration = 7.5;
    const x = 43 + (width - 67) * (1 - (latest - sample.t) / duration);
    const top = lerp(74, 43, compact);
    const bottom = lerp(height - 62, height * .27, compact);
    const gap = (bottom - top) / 5;
    return [x, top + channel * gap - sample.channels[channel] * gap * .35];
  }

  function drawSignals(history, latest, compact) {
    const visible = history.filter(sample => sample.t >= latest - 7.5);
    const highlightAt = latest - .8;
    const x0 = signalPoint({t:highlightAt,channels:[0]}, 0, latest, compact)[0];
    const top = lerp(52, 30, compact);
    const bottom = lerp(height - 42, height * .3, compact);
    const gradient = ctx.createLinearGradient(x0,0,width-24,0);
    gradient.addColorStop(0, 'rgba(208,228,176,.025)');
    gradient.addColorStop(1, 'rgba(208,228,176,.10)');
    ctx.fillStyle = gradient; ctx.fillRect(x0, top, width-24-x0, bottom-top);
    line([[width-24,top],[width-24,bottom]],rgba(sage,.28),.7);
    // The golden interval is recorded in the actual stimulated samples.
    visible.filter(sample => sample.stimulated).forEach(sample => {
      const x = signalPoint(sample,0,latest,compact)[0];
      ctx.fillStyle = rgba(warm,.11); ctx.fillRect(x,top,(width-67)/225+1,bottom-top);
    });
    for (let channel = 0; channel < 6; channel++) {
      const baseline = signalPoint({t:latest,channels:[0,0,0,0,0,0]},channel,latest,compact)[1];
      line([[43,baseline],[width-24,baseline]],rgba(sage,.075),.6);
      const colour = channelColours[channel];
      line(visible.map(sample=>signalPoint(sample,channel,latest,compact)),rgba(colour,lerp(.55,.42,compact)),compact>.8?.8:1.05);
      line(visible.filter(sample=>sample.t>=highlightAt).map(sample=>signalPoint(sample,channel,latest,compact)),rgba(colour,.95),1.2);
      if(compact < .8) type(`0${channel+1}`,13,baseline+3,rgba(colour,.65),9);
    }
    if (compact < .5) {
      type('MODEL-GENERATED ACTIVITY',43,32);
      type('RECENT SAMPLES',Math.max(43,width-141),height-24,rgba(sage,.65),8);
    } else {
      type('SAME SIX CHANNELS',43,16,rgba(sage,.48),8);
      type('RECENT SAMPLES',Math.max(43,width-130),height*.30+14,rgba(sage,.55),8);
    }
  }

  function drawTrajectory(history, latest, amount) {
    if(amount < .005) return;
    const trail = history.filter(sample=>sample.point && sample.t >= latest-13);
    const compact = smooth(amount);
    const axisOrigin = projected([0,0,0]);
    ctx.save(); ctx.globalAlpha = amount;
    // Quiet coordinate plane and reference axes, using the same fixed projection.
    for(let n=-4;n<=4;n++) {
      const v=n*.3;
      line([projected([-1.2,-.65,v]),projected([1.2,-.65,v])],rgba(sage,.055),.6);
      line([projected([v,-.65,-1.2]),projected([v,-.65,1.2])],rgba(sage,.055),.6);
    }
    [[.95,0,0],[0,.95,0],[0,0,.95]].forEach(point=>line([axisOrigin,projected(point)],rgba(sage,.13),.7));
    // A captured baseline gives a still comparison during and after a pulse.
    if(beforePulse.length) line(beforePulse.map(projected),'rgba(192,208,183,.12)',.8);
    const morphPoint = (sample, channel=2) => {
      const start = signalPoint(sample,channel,latest,compact);
      const end = projected(sample.point);
      return [lerp(start[0],end[0],compact),lerp(start[1],end[1],compact)];
    };
    // During the transition, six traces of the same sample indices meet at
    // their one multivariate reconstructed point. No synthetic geometry is added.
    if(amount < .97) {
      const joining = trail.filter(sample=>sample.t>=latest-7.5);
      for(let c=0;c<6;c++) line(joining.map(sample=>morphPoint(sample,c)),rgba(channelColours[c],.14*(1-amount)),.7);
    }
    for(let i=1;i<trail.length;i++) {
      const a=trail[i-1], b=trail[i];
      const age=latest-b.t;
      const active=b.stimulated || a.stimulated;
      const alpha=active?.88:(.12+.43*Math.pow(1-age/13,1.7));
      line([morphPoint(a),morphPoint(b)],rgba(active?warm:sage,alpha),age<.8?1.8:1);
    }
    const recent=trail.filter(sample=>sample.t>=latest-.8);
    line(recent.map(sample=>morphPoint(sample)),rgba(sage,.92),1.7);
    if(trail.length) {
      const last=trail[trail.length-1];
      const p=morphPoint(last);
      const colour=last.stimulated?warm:sage;
      dot(p[0],p[1],9,rgba(colour,.06));
      dot(p[0],p[1],4.5,rgba(colour,.15));
      dot(p[0],p[1],2.1,rgba(colour,.95));
      if(currentStage===1) {
        const traceEnd=signalPoint(last,2,latest,compact);
        ctx.setLineDash([2,5]); line([traceEnd,[width-17,traceEnd[1]+18],[width-17,p[1]],p],rgba(sage,.16),.65); ctx.setLineDash([]);
      }
    }
    type('A FIXED VIEW OF THE RECONSTRUCTION',24,height-21,rgba(sage,.54),width<400?7:8);
    ctx.restore();
  }

  function draw() {
    ctx.clearRect(0,0,width,height);
    const history=experiment.history;
    const latest=history[history.length-1].t;
    const compact=smooth(blend);
    drawSignals(history,latest,compact);
    drawTrajectory(history,latest,blend);
    if(currentStage===2) {
      const state=experiment.state;
      const x=width-105,y=height-36;
      line([[x,y],[x+80,y]],rgba(sage,.15),2);
      line([[x,y],[x+80*state.coherence,y]],rgba(sage,.7),2);
      type('PHASE COHERENCE',x,y-10,rgba(sage,.52),7);
    }
  }

  function updatePulseState() {
    const state=experiment.state;
    pulseButton.disabled=!state.canStimulate;
    if(pulseAt!==null && !state.stimulated && !pulseEnded && !staticMode()) {
      pulseEnded=true;
      status.textContent=`The pulse has ended. Phase coherence is ${state.coherence.toFixed(2)}; the original coupling remains active.`;
    }
    if(pulseAt!==null && state.canStimulate && !readyAnnounced) {
      readyAnnounced=true;
      status.textContent='The network has continued evolving. You can apply another pulse or reset.';
    }
  }
  function frame(now) {
    raf=0;
    if(!canAnimate()) return;
    if(!lastFrame || now-lastFrame>=1000/30) {
      const dt=lastFrame?Math.min((now-lastFrame)/1000,.075):0;
      lastFrame=now;
      // The model runs at half real-time speed to make sample correspondence legible.
      experiment.step(dt*.5);
      const target=currentStage===0?0:1;
      blend=lerp(blend,target,Math.min(1,dt*4.5));
      if(Math.abs(blend-target)<.002) blend=target;
      updatePulseState(); draw();
    }
    raf=requestAnimationFrame(frame);
  }
  function schedule() {
    if(raf) cancelAnimationFrame(raf);
    raf=0; lastFrame=0;
    if(canAnimate()) raf=requestAnimationFrame(frame);
  }
  function chooseStage(next,manual=false) {
    currentStage=next;
    if(manual) manualScrollY=window.scrollY;
    stageButtons.forEach((button,index)=>button.setAttribute('aria-pressed',String(index===next)));
    steps.forEach((step,index)=>step.classList.toggle('is-current',index===next));
    description.textContent=text[next];
    figure.querySelector('.figure-state-label').textContent=labels[next];
    figure.querySelector('.figure-state-number').textContent=`0${next+1} / 03`;
    pulseControls.hidden=next!==2;
    figure.dataset.stage=String(next);
    if(staticMode()) blend=next===0?0:1;
    draw(); schedule();
  }
  function onScroll() {
    if(window.innerWidth<=900 || window.innerHeight<=690 || !inView) return;
    if(manualScrollY!==null && Math.abs(window.scrollY-manualScrollY)<80) return;
    manualScrollY=null;
    let next=0;
    steps.forEach((step,index)=>{if(step.getBoundingClientRect().top<window.innerHeight*.58) next=index;});
    if(next!==currentStage) chooseStage(next);
  }
  function resize() {
    const box=stage.getBoundingClientRect();
    width=Math.max(1,box.width);height=Math.max(1,box.height);
    const ratio=Math.min(window.devicePixelRatio||1,2);
    canvas.width=Math.round(width*ratio);canvas.height=Math.round(height*ratio);
    ctx.setTransform(ratio,0,0,ratio,0,0);
    draw();onScroll();
  }
  function updateMotion() {
    pauseButton.disabled=media.matches;
    pauseButton.setAttribute('aria-pressed',String(staticMode()));
    pauseButton.textContent=media.matches?'Reduced motion':paused?'Resume motion ▷':'Pause motion Ⅱ';
    body.dataset.motion=staticMode()?'paused':'running';
    document.documentElement.style.scrollBehavior=staticMode()?'auto':'';
    document.dispatchEvent(new CustomEvent('acanal:motion',{detail:{paused:staticMode()}}));
    if(staticMode()) blend=currentStage===0?0:1;
    draw();schedule();
  }

  stageButtons.forEach(button=>button.addEventListener('click',()=>chooseStage(Number(button.dataset.journey),true)));
  pulseButton.addEventListener('click',()=>{
    if(!experiment.stimulate()) return;
    pulseBaseline=experiment.state.coherence;
    beforePulse=experiment.history.slice(-330).filter(sample=>sample.point).map(sample=>sample.point.slice());
    pulseAt=experiment.state.t; pulseEnded=false;readyAnnounced=false;
    if(staticMode()) {
      experiment.step(1.2);
      status.textContent=`Snapshot at 1.2 model seconds after the input begins. Phase coherence: ${pulseBaseline.toFixed(2)} before, ${experiment.state.coherence.toFixed(2)} now. Reset to compare.`;
    } else {
      status.textContent='A brief phase-dependent pulse is being applied. Gold marks the affected samples.';
    }
    updatePulseState();draw();schedule();
  });
  resetButton.addEventListener('click',()=>{
    experiment.reset(); beforePulse=[]; pulseAt=null;pulseEnded=false;readyAnnounced=false;
    status.textContent='Initial activity restored. Apply a pulse to explore the response.';
    updatePulseState();draw();schedule();
  });
  pauseButton.addEventListener('click',()=>{
    paused=!paused;
    try { sessionStorage.setItem('acanal-motion-paused',String(paused)); } catch (_) { /* Optional storage. */ }
    updateMotion();
  });
  media.addEventListener('change',()=>{pointer={x:0,y:0};updateMotion();});
  stage.addEventListener('pointermove',event=>{
    if(staticMode() || event.pointerType!=='mouse') return;
    const box=stage.getBoundingClientRect();
    pointer={x:(event.clientX-box.left)/box.width-.5,y:(event.clientY-box.top)/box.height-.5};
  });
  stage.addEventListener('pointerleave',()=>{pointer={x:0,y:0};});
  document.addEventListener('visibilitychange',schedule);
  window.addEventListener('scroll',onScroll,{passive:true});
  new IntersectionObserver(([entry])=>{inView=entry.isIntersecting;onScroll();schedule();},{threshold:0}).observe(stage);
  new ResizeObserver(resize).observe(stage);
  controls.hidden=false;pauseButton.hidden=false;
  stage.classList.add('canvas-ready');
  chooseStage(0);resize();updateMotion();
})();
