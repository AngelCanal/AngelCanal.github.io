(() => {
  'use strict';

  const clamp = (value, lower, upper) => Math.min(upper, Math.max(lower, value));
  const mix = (a, b, amount) => a + (b - a) * amount;
  const defaultCamera = {yaw: -.48, elevation: .64, panX: 0, panY: 0};

  function createProjector(camera, width, height) {
    const scale = Math.min(width / 7.9, height / 4.8);
    const cosYaw = Math.cos(camera.yaw), sinYaw = Math.sin(camera.yaw);
    const cosElevation = Math.cos(camera.elevation), sinElevation = Math.sin(camera.elevation);
    return vertex => {
      const x = vertex.x * cosYaw - vertex.z * sinYaw;
      const z = vertex.x * sinYaw + vertex.z * cosYaw;
      const depth = z * cosElevation + vertex.y * sinElevation;
      const perspective = 9.5 / (9.5 - depth);
      return {
        x: width * .5 + camera.panX * scale + x * scale * perspective,
        y: height * .43 + camera.panY * scale + (z * sinElevation - vertex.y * cosElevation) * scale * perspective,
        depth
      };
    };
  }

  // This is an authored scalar field for navigation, not a fitted loss function.
  // Each publication sits at a local minimum found near its editorial seed.
  function createSurface(papers) {
    const seeds = Object.entries(papers).map(([id, paper]) => ({id, ...paper}));
    function heightAt(x, z) {
      let height = .28 + .10 * Math.sin(x * 1.1 + z * .75) + .08 * Math.cos(x * .65 - z * 1.55);
      height += .40 * Math.exp(-((x + .8) ** 2 / .95 + (z + 1.65) ** 2 / .55));
      height += .43 * Math.exp(-((x - 2.1) ** 2 / .62 + (z + 1.3) ** 2 / .9));
      height += .27 * Math.exp(-((x + 2.2) ** 2 / .8 + (z - 1.45) ** 2 / .65));
      for (const seed of seeds) {
        const radiusSquared = (x - seed.x) ** 2 + (z - seed.z) ** 2;
        height -= seed.depth * Math.exp(-radiusSquared / (2 * seed.width ** 2));
      }
      return height;
    }
    const nodes = seeds.map(seed => {
      let x = seed.x, z = seed.z;
      // Descend locally, with backtracking, so the marker is at the basin bottom
      // rather than merely at the centre of a Gaussian added to a sloping field.
      for (let iteration = 0; iteration < 70; iteration++) {
        const epsilon = .001;
        const dx = (heightAt(x + epsilon, z) - heightAt(x - epsilon, z)) / (2 * epsilon);
        const dz = (heightAt(x, z + epsilon) - heightAt(x, z - epsilon)) / (2 * epsilon);
        if (Math.hypot(dx, dz) < .0001) break;
        let step = .045;
        const current = heightAt(x, z);
        while (step > .00001 && heightAt(x - dx * step, z - dz * step) >= current) step *= .5;
        if (step <= .00001) break;
        x -= dx * step;
        z -= dz * step;
      }
      return {...seed, x, z, y: heightAt(x, z)};
    });
    const columns = 60, rows = 48;
    const vertices = [];
    const faces = [];
    const x0 = -2.9, x1 = 2.9, z0 = -2.3, z1 = 2.3;
    for (let row = 0; row <= rows; row++) {
      for (let column = 0; column <= columns; column++) {
        const x = mix(x0, x1, column / columns);
        const z = mix(z0, z1, row / rows);
        vertices.push({x, y: heightAt(x, z), z});
      }
    }
    const levels = Array.from({length: 13}, (_, index) => -.9 + index * .12);
    for (let row = 0; row < rows; row++) {
      for (let column = 0; column < columns; column++) {
        const offset = row * (columns + 1) + column;
        const indices = [offset, offset + 1, offset + columns + 2, offset + columns + 1];
        const corners = indices.map(index => vertices[index]);
        const x = (corners[0].x + corners[2].x) / 2;
        const z = (corners[0].z + corners[2].z) / 2;
        const y = corners.reduce((sum, vertex) => sum + vertex.y, 0) / 4;
        const dx = (heightAt(x + .02, z) - heightAt(x - .02, z)) / .04;
        const dz = (heightAt(x, z + .02) - heightAt(x, z - .02)) / .04;
        const light = clamp((dx * .3 + .88 + dz * .36) / Math.hypot(dx, 1, dz), .12, 1);
        const contours = [];
        levels.forEach((level, index) => {
          const crossings = [];
          for (let edge = 0; edge < 4; edge++) {
            const a = corners[edge], b = corners[(edge + 1) % 4];
            if ((a.y < level && b.y >= level) || (b.y < level && a.y >= level)) {
              const amount = (level - a.y) / (b.y - a.y);
              crossings.push({x: mix(a.x, b.x, amount), y: level + .001, z: mix(a.z, b.z, amount)});
            }
          }
          for (let pair = 0; pair + 1 < crossings.length; pair += 2) contours.push({a: crossings[pair], b: crossings[pair + 1], major: index % 3 === 0});
        });
        faces.push({indices, x, y, z, light, contours});
      }
    }
    const perimeter = [];
    for (let column = 0; column <= columns; column++) perimeter.push(vertices[column]);
    for (let row = 1; row <= rows; row++) perimeter.push(vertices[row * (columns + 1) + columns]);
    for (let column = columns - 1; column >= 0; column--) perimeter.push(vertices[rows * (columns + 1) + column]);
    for (let row = rows - 1; row > 0; row--) perimeter.push(vertices[row * (columns + 1)]);
    return {heightAt, nodes, vertices, faces, perimeter, columns, rows};
  }

  function initialise(root) {
    const canvas = root.querySelector('[data-landscape-canvas]');
    const stage = root.querySelector('[data-landscape-stage]');
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    let config;
    try { config = JSON.parse(root.querySelector('[data-landscape-config]').textContent); }
    catch (_) { return; }
    const markerElements = [...root.querySelectorAll('[data-landscape-marker]')];
    if (!markerElements.length) return;
    const displayedPapers = Object.fromEntries(markerElements.map(element => [element.dataset.landscapeMarker, config.papers[element.dataset.landscapeMarker]]));
    const surface = createSurface(displayedPapers);
    const nodes = new Map(surface.nodes.map(node => [node.id, node]));
    const markers = markerElements.map(element => ({element, label: element.querySelector('.landscape-marker-label'), node: nodes.get(element.dataset.landscapeMarker)}));
    const details = [...root.querySelectorAll('[data-landscape-detail], [data-landscape-region-detail]')];
    const regions = [...root.querySelectorAll('[data-landscape-region]')];
    const regionLinks = [...root.querySelectorAll('[data-landscape-region-select]')];
    const resetButton = root.querySelector('[data-landscape-reset]');
    const status = root.querySelector('[data-landscape-status]');
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)');
    const baseCamera = {...defaultCamera};
    let camera = {...baseCamera};
    let target = {...baseCamera};
    let pointer = {x: 0, y: 0};
    const initialId = nodes.has(config.initial_paper) ? config.initial_paper : markers[0].node.id;
    let activeId = initialId;
    let activeRegion = nodes.get(initialId).region;
    let width = 900, height = 600;
    let paused = document.body.dataset.motion === 'paused';
    let inView = false, entered = false;
    let frameId = 0, lastFrame = 0, transitionEnds = 0;
    let lastManualSelection = 0;
    let project = createProjector(camera, width, height);
    const motionOff = () => paused || reducedMotion.matches || document.body.dataset.motion === 'paused';

    function stroke(points, colour, lineWidth = 1) {
      ctx.beginPath();
      points.forEach((point, index) => index ? ctx.lineTo(point.x, point.y) : ctx.moveTo(point.x, point.y));
      ctx.strokeStyle = colour;
      ctx.lineWidth = lineWidth;
      ctx.stroke();
    }
    function polygon(points, colour) {
      ctx.beginPath();
      points.forEach((point, index) => index ? ctx.lineTo(point.x, point.y) : ctx.moveTo(point.x, point.y));
      ctx.closePath();
      ctx.fillStyle = colour;
      ctx.fill();
    }

    function drawTerrain() {
      const shadow = ctx.createRadialGradient(width * .52, height * .61, 0, width * .52, height * .61, width * .46);
      shadow.addColorStop(0, 'rgba(94,117,70,.12)');
      shadow.addColorStop(.65, 'rgba(54,75,45,.045)');
      shadow.addColorStop(1, 'rgba(16,19,18,0)');
      ctx.fillStyle = shadow;
      ctx.fillRect(0, 0, width, height);

      // The dim vertical edge makes the oblique relief readable without a box.
      const floor = -1.12;
      surface.perimeter.forEach((a, index) => {
        const b = surface.perimeter[(index + 1) % surface.perimeter.length];
        const points = [project(a), project(b), project({...b, y: floor}), project({...a, y: floor})];
        polygon(points, 'rgba(22,30,23,.48)');
        if (index % 3 === 0) stroke([points[0], points[3]], 'rgba(145,169,127,.10)', .5);
      });
      stroke([...surface.perimeter, surface.perimeter[0]].map(vertex => project({...vertex, y: floor})), 'rgba(145,169,127,.13)', .7);

      const projected = surface.vertices.map(project);
      const active = nodes.get(activeId);
      const faces = surface.faces.map(face => ({face, depth: project(face).depth})).sort((a, b) => a.depth - b.depth);
      for (const {face} of faces) {
        const points = face.indices.map(index => projected[index]);
        const focus = active ? Math.exp(-((face.x - active.x) ** 2 + (face.z - active.z) ** 2) / .52) : 0;
        const altitude = clamp((face.y + .95) / 1.75, 0, 1);
        const red = Math.round(17 + face.light * 15 + altitude * 8 + focus * 5);
        const green = Math.round(24 + face.light * 20 + altitude * 8 + focus * 8);
        const blue = Math.round(19 + face.light * 13 + altitude * 5 + focus * 3);
        polygon(points, `rgb(${red},${green},${blue})`);
        ctx.strokeStyle = `rgba(174,198,150,${.075 + face.light * .11 + focus * .07})`;
        ctx.lineWidth = .48;
        ctx.stroke();
        for (const contour of face.contours) {
          stroke([project(contour.a), project(contour.b)], contour.major ? 'rgba(206,214,177,.38)' : 'rgba(164,187,146,.22)', contour.major ? .8 : .6);
        }
      }
      stroke([...surface.perimeter, surface.perimeter[0]].map(project), 'rgba(185,205,163,.34)', .75);
    }

    function drawConnections() {
      if (!activeId) return;
      ctx.setLineDash([2, 5]);
      config.connections.forEach(connection => {
        if (connection.a !== activeId && connection.b !== activeId) return;
        const a = nodes.get(connection.a), b = nodes.get(connection.b);
        if (!a || !b) return;
        const points = [];
        for (let index = 0; index <= 44; index++) {
          const amount = index / 44;
          const x = mix(a.x, b.x, amount), z = mix(a.z, b.z, amount);
          const arch = mix(a.y, b.y, amount) + Math.sin(Math.PI * amount) * .62 + .04;
          points.push(project({x, y: Math.max(surface.heightAt(x, z) + .035, arch), z}));
        }
        stroke(points, a.region !== b.region ? 'rgba(198,173,145,.46)' : 'rgba(208,228,176,.42)', .85);
      });
      ctx.setLineDash([]);
      const node = nodes.get(activeId);
      const ring = [];
      for (let index = 0; index <= 64; index++) {
        const angle = index / 64 * Math.PI * 2;
        const x = node.x + Math.cos(angle) * .24, z = node.z + Math.sin(angle) * .24;
        ring.push(project({x, y: surface.heightAt(x, z) + .02, z}));
      }
      stroke(ring, 'rgba(208,228,176,.60)', 1);
    }

    function placeLabels() {
      const occupied = [];
      const regionBoxes = [];
      const points = new Map(markers.map(marker => [marker.node.id, project(marker.node)]));
      const ordered = [...markers].sort((a, b) => Number(b.node.id === activeId) - Number(a.node.id === activeId));
      const leaders = [];
      // Adapt to the terrain's own width, including narrow columns on tablets.
      stage.classList.toggle('is-compact', width < 550);
      for (const marker of markers) {
        const point = points.get(marker.node.id);
        marker.element.style.left = `${point.x.toFixed(1)}px`;
        marker.element.style.top = `${point.y.toFixed(1)}px`;
      }
      regions.forEach(element => {
        const region = config.regions[element.dataset.landscapeRegion];
        const point = project({x: region.x, y: surface.heightAt(region.x, region.z) + .22, z: region.z});
        const x = clamp(point.x, 43, width - 43), y = clamp(point.y - 16, 18, height - 36);
        element.style.left = `${x.toFixed(1)}px`;
        element.style.top = `${y.toFixed(1)}px`;
        if (element.offsetWidth) regionBoxes.push({left: x - element.offsetWidth / 2 - 7, right: x + element.offsetWidth / 2 + 7, top: y - element.offsetHeight / 2 - 7, bottom: y + element.offsetHeight / 2 + 7});
      });
      const pinBoxes = [...points.values()].map(point => ({left: point.x - 17, right: point.x + 17, top: point.y - 17, bottom: point.y + 17}));
      const overlapArea = (a, b) => Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left)) * Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
      for (const marker of ordered) {
        const point = points.get(marker.node.id);
        const labelScale = Number.parseFloat(getComputedStyle(marker.element).getPropertyValue('--label-scale')) || 1;
        const labelWidth = marker.label.offsetWidth * labelScale;
        const labelHeight = marker.label.offsetHeight * labelScale;
        const multiplier = clamp(width / 850, .65, 1);
        const preferred = [marker.node.label_dx * multiplier, marker.node.label_dy > 0 ? labelHeight + 28 : Math.min(-27, marker.node.label_dy * multiplier)];
        const candidates = [preferred, [0, -30], [0, labelHeight + 30], [45, -30], [-45, -30], [labelWidth / 2 + 28, labelHeight / 2], [-labelWidth / 2 - 28, labelHeight / 2], [65, labelHeight + 28], [-65, labelHeight + 28], [0, -labelHeight - 48], [0, 2 * labelHeight + 48]];
        let best = null;
        for (const [dx, dy] of candidates) {
          const centreX = clamp(point.x + dx, labelWidth / 2 + 14, width - labelWidth / 2 - 14);
          const bottom = clamp(point.y + dy, labelHeight + 16, height - 38);
          const box = {left: centreX - labelWidth / 2 - 6, right: centreX + labelWidth / 2 + 6, top: bottom - labelHeight - 6, bottom: bottom + 6};
          let score = Math.hypot(centreX - point.x - preferred[0], bottom - point.y - preferred[1]);
          for (const other of occupied) score += overlapArea(box, other) * 120;
          for (const pin of pinBoxes) score += overlapArea(box, pin) * 180;
          for (const region of regionBoxes) score += overlapArea(box, region) * 30;
          if (!best || score < best.score) best = {score, box, centreX, bottom};
        }
        marker.element.style.setProperty('--label-x', `${(best.centreX - point.x).toFixed(1)}px`);
        marker.element.style.setProperty('--label-y', `${(best.bottom - point.y).toFixed(1)}px`);
        occupied.push(best.box);
        const end = {x: clamp(point.x, best.centreX - labelWidth / 2, best.centreX + labelWidth / 2), y: clamp(point.y, best.bottom - labelHeight, best.bottom)};
        leaders.push({a: point, b: end, active: marker.node.id === activeId});
      }
      for (const leader of leaders) {
        const distance = Math.hypot(leader.a.x - leader.b.x, leader.a.y - leader.b.y);
        if (distance > 12) stroke([leader.a, leader.b], leader.active ? 'rgba(208,228,176,.55)' : 'rgba(177,196,159,.27)', .7);
      }
    }

    function draw() {
      project = createProjector(camera, width, height);
      ctx.clearRect(0, 0, width, height);
      drawTerrain();
      drawConnections();
      placeLabels();
      root.classList.add('is-rendered');
    }
    function cancelFrame() {
      if (frameId) cancelAnimationFrame(frameId);
      frameId = 0;
      lastFrame = 0;
    }
    function frame(now) {
      frameId = 0;
      if (!inView || document.hidden || motionOff()) return;
      if (lastFrame && now - lastFrame < 1000 / 30) {
        frameId = requestAnimationFrame(frame);
        return;
      }
      const dt = lastFrame ? Math.min(now - lastFrame, 70) : 33;
      const amount = 1 - Math.exp(-dt / 130);
      let difference = 0;
      for (const key of Object.keys(camera)) {
        camera[key] = mix(camera[key], target[key], amount);
        difference += Math.abs(camera[key] - target[key]);
      }
      if (now >= transitionEnds || difference < .00015) camera = {...target};
      lastFrame = now;
      draw();
      if (now < transitionEnds && difference >= .00015) frameId = requestAnimationFrame(frame);
      else lastFrame = 0;
    }
    function requestDraw(animate = true) {
      if (motionOff() || !animate) {
        cancelFrame();
        draw();
        return;
      }
      transitionEnds = performance.now() + 950;
      if (!inView || document.hidden) return;
      if (!frameId) frameId = requestAnimationFrame(frame);
    }
    function targetCamera() {
      if (motionOff()) return;
      const node = activeId ? nodes.get(activeId) : config.regions[activeRegion];
      target = {
        yaw: baseCamera.yaw + node.x * .015 + pointer.x * .07,
        elevation: baseCamera.elevation + node.z * .012 + pointer.y * .04,
        panX: -node.x * .035,
        panY: -node.z * .015
      };
    }
    function updateRegionLinks() {
      root.dataset.landscapeRegion = activeRegion;
      regionLinks.forEach(link => {
        const active = link.dataset.landscapeRegionSelect === activeRegion;
        link.classList.toggle('is-active', active);
        if (active) link.setAttribute('aria-current', 'true');
        else link.removeAttribute('aria-current');
      });
    }
    function selectPaper(id, source = 'external') {
      if (!nodes.has(id) || !markers.some(marker => marker.node.id === id)) return;
      if ((source === 'hover' || source === 'scroll') && details.some(detail => detail.contains(document.activeElement))) return;
      const changed = id !== activeId;
      activeId = id;
      activeRegion = nodes.get(id).region;
      root.dataset.landscapeActive = id;
      if (source === 'activate' || source === 'focus' || source === 'hover') lastManualSelection = performance.now();
      markers.forEach(marker => {
        const active = marker.node.id === id;
        marker.element.classList.toggle('is-active', active);
        if (active) marker.element.setAttribute('aria-current', 'true');
        else marker.element.removeAttribute('aria-current');
      });
      details.forEach(detail => {
        const active = detail.dataset.landscapeDetail === id;
        detail.hidden = !active;
        detail.classList.toggle('is-active', active);
      });
      updateRegionLinks();
      if (source === 'activate' && changed) status.textContent = `Selected study: ${nodes.get(id).label}. Details follow the research map.`;
      targetCamera();
      requestDraw(changed);
    }
    function selectRegion(id) {
      const region = config.regions[id];
      if (!region) return;
      if (region.entry) { selectPaper(region.entry, 'activate'); return; }
      // A research direction has its own panel, never a fabricated paper or well.
      activeId = null;
      activeRegion = id;
      root.dataset.landscapeActive = '';
      lastManualSelection = performance.now();
      markers.forEach(marker => {
        marker.element.classList.remove('is-active');
        marker.element.removeAttribute('aria-current');
      });
      details.forEach(detail => {
        const active = detail.dataset.landscapeRegionDetail === id;
        detail.hidden = !active;
        detail.classList.toggle('is-active', active);
      });
      updateRegionLinks();
      status.textContent = `${region.label}. ${region.status}. Research direction details follow the map.`;
      targetCamera();
      requestDraw();
    }
    function resize() {
      const box = stage.getBoundingClientRect();
      width = Math.max(1, box.width);
      height = Math.max(1, box.height);
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(width * ratio);
      canvas.height = Math.round(height * ratio);
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
      draw();
    }

    markerElements.forEach((element, index) => {
      const id = element.dataset.landscapeMarker;
      element.addEventListener('click', event => { event.preventDefault(); selectPaper(id, 'activate'); });
      element.addEventListener('focus', () => selectPaper(id, 'focus'));
      element.addEventListener('pointerenter', event => { if (event.pointerType === 'mouse' && finePointer.matches) selectPaper(id, 'hover'); });
      element.addEventListener('keydown', event => {
        let next = index;
        if (event.key === 'ArrowRight' || event.key === 'ArrowDown') next = (index + 1) % markers.length;
        else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') next = (index + markers.length - 1) % markers.length;
        else if (event.key === 'Home') next = 0;
        else if (event.key === 'End') next = markers.length - 1;
        else return;
        event.preventDefault();
        markerElements[next].focus({preventScroll: true});
      });
    });
    root.querySelectorAll('[data-landscape-related]').forEach(element => element.addEventListener('click', event => {
      event.preventDefault();
      const id = element.dataset.landscapeRelated;
      selectPaper(id, 'activate');
      // The link just used is in the panel being hidden. Keep focus on a visible control.
      markers.find(marker => marker.node.id === id).element.focus({preventScroll: true});
    }));
    regionLinks.forEach(element => element.addEventListener('click', event => {
      event.preventDefault();
      const fromPanel = element.closest('[data-landscape-region-detail]');
      selectRegion(element.dataset.landscapeRegionSelect);
      if (fromPanel && fromPanel.hidden && activeId) markers.find(marker => marker.node.id === activeId).element.focus({preventScroll: true});
    }));
    resetButton.addEventListener('click', () => {
      pointer = {x: 0, y: 0};
      selectPaper(initialId, 'activate');
      target = {...baseCamera};
      if (motionOff()) camera = {...target};
      requestDraw();
    });
    stage.addEventListener('pointermove', event => {
      if (motionOff() || event.pointerType !== 'mouse' || !finePointer.matches) return;
      const box = stage.getBoundingClientRect();
      pointer = {x: clamp((event.clientX - box.left) / box.width - .5, -.5, .5), y: clamp((event.clientY - box.top) / box.height - .5, -.5, .5)};
      targetCamera();
      requestDraw();
    });
    stage.addEventListener('pointerleave', () => {
      pointer = {x: 0, y: 0};
      targetCamera();
      requestDraw();
    });

    function updateMotion(event) {
      if (event && event.detail && typeof event.detail.paused === 'boolean') paused = event.detail.paused;
      else paused = document.body.dataset.motion === 'paused';
      pointer = {x: 0, y: 0};
      cancelFrame();
      if (motionOff()) target = {...camera};
      else targetCamera();
      requestDraw();
    }
    document.addEventListener('acanal:motion', updateMotion);
    reducedMotion.addEventListener('change', updateMotion);
    document.addEventListener('acanal:landscape-select', event => {
      if (event.detail && typeof event.detail.region === 'string') selectRegion(event.detail.region);
      else if (event.detail && typeof event.detail.id === 'string') selectPaper(event.detail.id);
    });
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) cancelFrame();
      else if (inView) requestDraw();
    });

    if ('IntersectionObserver' in window) {
      new IntersectionObserver(([entry]) => {
        inView = entry.isIntersecting;
        if (!inView) { cancelFrame(); return; }
        if (!entered && entry.intersectionRatio >= .12) {
          entered = true;
          if (!motionOff()) {
            camera = {...baseCamera, yaw: baseCamera.yaw - .13, elevation: baseCamera.elevation + .065};
            targetCamera();
          }
        }
        requestDraw();
      }, {threshold: [0, .12, .45]}).observe(stage);

      const visibleStudies = new Map();
      const studyObserver = new IntersectionObserver(entries => {
        for (const entry of entries) {
          if (entry.isIntersecting) visibleStudies.set(entry.target, entry);
          else visibleStudies.delete(entry.target);
        }
        if (performance.now() - lastManualSelection < 1500 || !visibleStudies.size) return;
        const readingLine = window.innerHeight * .4;
        const nearest = [...visibleStudies.keys()].sort((a, b) => Math.abs(a.getBoundingClientRect().top - readingLine) - Math.abs(b.getBoundingClientRect().top - readingLine))[0];
        selectPaper(nearest.dataset.landscapePaper, 'scroll');
      }, {rootMargin: '-18% 0px -40% 0px', threshold: [0, .15, .5]});
      document.querySelectorAll('[data-landscape-paper]').forEach(element => {
        if (!root.contains(element) && nodes.has(element.dataset.landscapePaper)) studyObserver.observe(element);
      });
    } else {
      inView = true;
      entered = true;
    }
    if ('ResizeObserver' in window) new ResizeObserver(resize).observe(stage);
    else window.addEventListener('resize', resize, {passive: true});

    root.classList.add('is-enhanced');
    resetButton.hidden = false;
    selectPaper(activeId, 'initial');
    resize();
    root.dataset.landscapeReady = 'true';
  }

  // The figure exporter reuses the same field and projection without a browser.
  if (typeof module !== 'undefined' && module.exports) module.exports = {createSurface, createProjector, defaultCamera};
  else document.querySelectorAll('[data-research-landscape]').forEach(initialise);
})();
