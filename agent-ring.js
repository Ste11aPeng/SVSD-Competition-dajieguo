/* The agent switcher from the chat screen (script.js › Agents + name style), as a mountable component:
   AgentRing.mount(host, { active, onChange }). Same ring, spring, drag-to-spin and Vibe names.
   Needs name-effects.js. Keep in step with script.js if the ring changes there. */
window.AgentRing = (() => {
  const AGENTS = [
    { name: 'Roaster', photo: 'assets/agent1.png', glow: 'assets/image170.png', glowClass: '' },
    { name: 'Ride-or-Die', photo: 'assets/agent2.png', glow: 'assets/image171.png', glowClass: 'agent-glow--wide' },
    { name: 'Calm Sibling', photo: 'assets/agent3.png', glow: 'assets/image33.png', glowClass: 'agent-glow--round' }
  ];
  // Theme colours on the chat stage (Haze background), from style.css
  const THEMES = [[80, 120, 235], [255, 106, 31], [150, 230, 90]];

  const SMALL = 32, LARGE = 44, SIDE_OFFSET = 54, COUNT = AGENTS.length;
  const STEP = 360 / COUNT, RADIUS = SIDE_OFFSET / Math.sin((STEP * Math.PI) / 180), DEG_PER_PX = STEP / SIDE_OFFSET;
  const STIFFNESS = 158, DAMPING = 21.4;
  const lerp = (a, b, t) => a + (b - a) * t;
  const clamp01 = (t) => Math.min(1, Math.max(0, t));
  const mod = (n, m) => ((n % m) + m) % m;
  const shortestDelta = (deg) => mod(deg + 180, 360) - 180;

  // Name colours, as on the chat screen: theme-tinted ink that keeps 7:1 on the dark top
  const WHITE = [255, 255, 255], LABEL_BG = [8, 8, 9];
  const mixRgb = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
  const toHex = (c) => '#' + c.map((v) => Math.round(Math.min(255, Math.max(0, v))).toString(16).padStart(2, '0')).join('');
  const lum = (c) => { const [r, g, b] = c.map((v) => { const x = v / 255; return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4); }); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
  const contrast = (a, b) => { const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x); return (hi + 0.05) / (lo + 0.05); };
  function nameInk(theme) { let t = 0.34, ink = mixRgb(WHITE, theme, t); while (t > 0 && contrast(mixRgb(LABEL_BG, ink, 0.9), LABEL_BG) < 7) { t -= 0.02; ink = mixRgb(WHITE, theme, t); } return ink; }
  const vibePalette = (theme) => ({
    core: toHex(mixRgb(WHITE, theme, 0.12)),
    ghosts: [toHex(mixRgb(WHITE, theme, 0.1)), toHex(mixRgb(WHITE, theme, 0.42)), toHex(theme), toHex(mixRgb(theme, [0, 0, 0], 0.5))],
    haze: [toHex(theme), toHex(mixRgb(theme, [0, 0, 0], 0.2)), toHex(mixRgb(WHITE, theme, 0.55)), toHex(theme)]
  });
  const fontsReady = Promise.all(['430 100px Archivo', '500 100px Archivo', '800 100px Archivo', '900 100px Archivo', '650 100px Inter'].map((f) => document.fonts.load(f))).catch(() => {});

  function mount(host, opts = {}) {
    host.classList.add('ring-host');
    host.innerHTML = '<nav class="agents" aria-label="Who you are talking to">' + AGENTS.map((a, i) =>
      `<button class="agent" type="button" data-index="${i}" aria-label="${a.name}"><span class="agent-press">` +
      `<img class="agent-photo" src="${a.photo}" alt="" width="44" height="44" /><span class="agent-chrome"><span class="agent-button"></span>` +
      `<img class="agent-ring" src="assets/mic-ring-1.svg" alt="" /><img class="agent-glow ${a.glowClass}" src="${a.glow}" alt="" /></span></span></button>`
    ).join('') + '</nav><div class="agent-labels" aria-live="polite"></div>';
    const agentsEl = host.querySelector('.agents'), labels = host.querySelector('.agent-labels');
    const buttons = [...host.querySelectorAll('.agent')];
    const parts = buttons.map((el) => ({ el, photo: el.querySelector('.agent-photo'), chrome: el.querySelector('.agent-chrome'), glow: el.querySelector('.agent-glow') }));
    const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');
    let active = opts.active ?? 1, rotation = active * STEP, velocity = 0, target = rotation, raf = 0, lastTime = 0;

    function renderRing() {
      parts.forEach(({ el, photo, chrome, glow }, i) => {
        const theta = ((i * STEP - rotation) * Math.PI) / 180, x = RADIUS * Math.sin(theta), depth = Math.cos(theta);
        const front = clamp01((depth + 0.5) / 1.5), back = clamp01((-0.5 - depth) / 0.5);
        const scale = lerp(SMALL / LARGE, 1, front) * lerp(1, 0.82, back);
        const lit = 1 - (1 - clamp01((depth + 0.5) / 1.2)) ** 2;
        el.style.transform = `translate3d(${x.toFixed(2)}px, 0, 0) scale(${scale.toFixed(4)})`;
        el.style.zIndex = String(Math.round((depth + 1) * 50));
        photo.style.opacity = (lerp(0.2, 1, lit) * lerp(1, 0.5, back)).toFixed(3);
        chrome.style.opacity = (lerp(0.4, 1, lit) * lerp(1, 0.5, back)).toFixed(3);
        glow.style.opacity = lerp(0.4, 1, lit).toFixed(3);
      });
    }
    function step(now) {
      const dt = Math.min(1, (now - lastTime) / 1000 || 1 / 60); lastTime = now;
      const n = Math.ceil(dt / 0.004), h = dt / n;
      for (let k = 0; k < n; k++) { const force = -STIFFNESS * (rotation - target) - DAMPING * velocity; velocity += force * h; rotation += velocity * h; }
      if (Math.abs(rotation - target) < 0.02 && Math.abs(velocity) < 0.5) { rotation = target; velocity = 0; raf = 0; renderRing(); return; }
      renderRing(); raf = requestAnimationFrame(step);
    }
    function animateTo(t) {
      target = t;
      if (reduceMotion.matches) { cancelAnimationFrame(raf); raf = 0; rotation = target; velocity = 0; renderRing(); return; }
      if (!raf) { lastTime = performance.now(); raf = requestAnimationFrame(step); }
    }
    function setActive(index, force) {
      if (index === active && !force) return;
      active = index;
      buttons.forEach((el, i) => { el.classList.toggle('is-active', i === index); el.setAttribute('aria-pressed', String(i === index)); });
      labels.querySelectorAll('.agent-label').forEach((el) => el.classList.toggle('is-active', Number(el.dataset.for) === index));
      if (opts.onChange) opts.onChange(index, AGENTS[index]);
    }
    let drag = null, suppressClick = false;
    agentsEl.addEventListener('pointerdown', (e) => { if (drag) return; drag = { id: e.pointerId, startX: e.clientX, startRotation: rotation, moving: false, samples: [{ t: e.timeStamp, r: rotation }] }; });
    agentsEl.addEventListener('pointermove', (e) => {
      if (!drag || e.pointerId !== drag.id) return;
      const dx = e.clientX - drag.startX;
      if (!drag.moving) {
        if (Math.abs(dx) < 5) return;
        drag.moving = true; drag.startX = e.clientX; drag.startRotation = rotation;
        cancelAnimationFrame(raf); raf = 0;
        try { agentsEl.setPointerCapture(e.pointerId); } catch (err) {}
        agentsEl.classList.add('is-dragging');
      }
      rotation = drag.startRotation - (e.clientX - drag.startX) * DEG_PER_PX;
      drag.samples.push({ t: e.timeStamp, r: rotation }); if (drag.samples.length > 6) drag.samples.shift();
      renderRing(); setActive(mod(Math.round(rotation / STEP), COUNT));
    });
    function endDrag(e) {
      if (!drag || e.pointerId !== drag.id) return;
      const { moving, samples } = drag; drag = null; agentsEl.classList.remove('is-dragging');
      if (!moving) return;
      suppressClick = true; setTimeout(() => (suppressClick = false), 0);
      const first = samples[0], last = samples[samples.length - 1], dt = (last.t - first.t) / 1000;
      velocity = dt > 0 ? (last.r - first.r) / dt : 0;
      const snapped = Math.round((rotation + velocity * 0.12) / STEP) * STEP;
      setActive(mod(Math.round(snapped / STEP), COUNT)); animateTo(snapped);
    }
    agentsEl.addEventListener('pointerup', endDrag);
    agentsEl.addEventListener('pointercancel', endDrag);
    buttons.forEach((el) => el.addEventListener('click', () => { if (suppressClick) return; const i = Number(el.dataset.index); setActive(i); animateTo(rotation + shortestDelta(i * STEP - rotation)); }));

    // Vibe names, drawn the way the chat screen draws them
    fontsReady.then(() => {
      AGENTS.forEach((a, i) => {
        const theme = THEMES[i], ink = nameInk(theme);
        const svg = window.NameEffects ? NameEffects.render('vibe', a.name, { ink: toHex(ink), height: 13.5, palette: vibePalette(theme) }) : Object.assign(document.createElement('span'), { textContent: a.name });
        svg.classList.add('agent-label'); svg.dataset.for = String(i);
        labels.appendChild(svg);
      });
      setActive(active, true);
    });
    renderRing(); setActive(active, true);
    return { get active() { return active; } };
  }
  return { mount };
})();
