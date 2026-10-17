/* After-chat sequence on the agent switcher.
   You come back from venting to Ride-or-Die and the home screen plays it back:
     1. a quick recap of what you vented about rises and burns off into embers,
     2. the gold "core insight" line melts into a liquid blob that flies into the insights bubble,
     3. the bubble swallows it (1s) and keeps a breathing gold core,
     4. meanwhile the other two agents light up — they've heard,
     5. tap one and it opens in its own voice ("I heard about…").
   Every step has variations, picked from the panel left of the phone (design exploration). */
(() => {
  const { phone, input, setKeyboard } = window.Lava;
  const memories = phone.querySelector('.memories');
  const memoriesIcon = memories.querySelector('.memories-icon');
  const agents = [...phone.querySelectorAll('.agent')];
  const panel = document.getElementById('seqPanel');
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  const EASE_OUT = 'cubic-bezier(0.23, 1, 0.32, 1)';
  const EASE_IN_OUT = 'cubic-bezier(0.77, 0, 0.175, 1)';
  const DEFAULT_PLACEHOLDER = 'Keep chatting on...';

  const VENTED_WITH = 1; // Ride-or-Die
  const RECAP = [
    'Today you vented about',
    'the Studio Arcade rejection.',
    'Three rounds. A whole case study.',
    'Two lines back, from a no-reply.',
    'Ride-or-Die had your back.',
  ];
  const INSIGHT = 'Their no isn’t the final word.';

  // Same story, each agent's own way of bringing it up
  const OPENERS = {
    0: {
      name: 'Roaster',
      lines: ['ok so I heard about Studio Arcade.', 'two lines?? after a whole case study?? the audacity. want me to roast them, or you first?'],
      placeholder: 'Reply to Roaster…',
    },
    2: {
      name: 'Calm Sibling',
      lines: ['Hey. I heard about the email.', 'Three rounds, then two lines back. That would sting anyone. Want to talk it through? No rush.'],
      placeholder: 'Reply to Calm Sibling…',
    },
  };

  /* ───────────── Settings (panel) ───────────── */

  const SEQ_KEY = 'lava.seq';
  const settings = { recap: 'rise', travel: 'arc', store: 'gulp', cue: 'breathe', opener: 'bubbles' };
  try { Object.assign(settings, JSON.parse(localStorage.getItem(SEQ_KEY)) || {}); } catch {}

  /* ───────────── Scene setup ───────────── */

  const el = (tag, cls, text) => {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  };

  // Text stage: the empty middle of the screen, between the names and the composer
  const stage = el('div', 'recap-stage');
  stage.setAttribute('aria-live', 'polite');
  document.getElementById('fxLabels').after(stage);

  // Embers (canvas) and the liquid layer (gooey SVG filter) sit over everything
  const canvas = el('canvas', 'recap-embers');
  const goo = el('div', 'recap-goo');
  const toast = el('div', 'insight-toast');
  toast.innerHTML = '<i></i><span>Insight saved</span>';
  phone.append(canvas, goo, toast);

  phone.insertAdjacentHTML(
    'beforeend',
    `<svg class="svg-defs" width="0" height="0" aria-hidden="true" focusable="false">
      <!-- Metaball merge: blur, then crush alpha back to a hard edge, then draw the crisp drops on top -->
      <filter id="lava-goo" color-interpolation-filters="sRGB">
        <feGaussianBlur in="SourceGraphic" stdDeviation="7" result="b"/>
        <feColorMatrix in="b" type="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 22 -9" result="g"/>
        <feComposite in="SourceGraphic" in2="g" operator="atop"/>
      </filter>
      <!-- Slow fluid wobble for an avatar with news -->
      <filter id="agent-liquify" x="-20%" y="-20%" width="140%" height="140%">
        <feTurbulence type="fractalNoise" baseFrequency="0.035" numOctaves="2" seed="4" result="n">
          <animate attributeName="baseFrequency" dur="8s" values="0.03;0.055;0.03" repeatCount="indefinite"/>
        </feTurbulence>
        <feDisplacementMap in="SourceGraphic" in2="n" scale="7" xChannelSelector="R" yChannelSelector="G"/>
      </filter>
    </svg>`
  );

  // Insights bubble: a gold core that stays, a liquid fill and a ripple ring for the "stored" moment
  const core = el('span', 'memories-core');
  const fill = el('span', 'memories-fill');
  fill.innerHTML =
    '<span class="memories-liquid"><span class="memories-wave">' +
    '<svg viewBox="0 0 120 10" preserveAspectRatio="none" aria-hidden="true"><path d="M0 5 Q 7.5 0 15 5 T 30 5 T 45 5 T 60 5 T 75 5 T 90 5 T 105 5 T 120 5 V10 H0Z"/></svg>' +
    '</span></span>';
  const ripple = el('span', 'memories-ripple');
  memories.querySelector('.memories-button').after(core, fill);
  memories.append(ripple);

  /* ───────────── Run control ───────────── */

  // Every async step checks it's still the current run, so Replay can interrupt anything
  let run = 0;
  let timers = [];
  const alive = (id) => id === run;
  const wait = (ms) => new Promise((res) => timers.push(setTimeout(res, ms)));
  const later = (fn, ms) => timers.push(setTimeout(fn, ms));

  const ease = {
    out: (t) => 1 - Math.pow(1 - t, 4),
    inOut: (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
    inOutSine: (t) => -(Math.cos(Math.PI * t) - 1) / 2,
  };

  // rAF tween; resolves when done (or never, if the run was replaced)
  function tween(id, duration, fn) {
    return new Promise((res) => {
      const start = performance.now();
      const frame = (now) => {
        if (!alive(id)) return;
        const t = Math.min(1, (now - start) / duration);
        fn(t);
        if (t < 1) requestAnimationFrame(frame);
        else res();
      };
      requestAnimationFrame(frame);
    });
  }

  // Position of an element inside the phone
  function rel(node) {
    const p = phone.getBoundingClientRect();
    const r = node.getBoundingClientRect();
    return { x: r.left - p.left, y: r.top - p.top, w: r.width, h: r.height, cx: r.left - p.left + r.width / 2, cy: r.top - p.top + r.height / 2 };
  }

  /* ───────────── Embers (particles) ───────────── */

  const embers = (() => {
    const ctx = canvas.getContext('2d');
    const PALETTES = {
      warm: ['255,224,170', '255,170,90', '255,120,48'],
      gold: ['255,244,200', '255,214,120', '255,178,60'],
    };
    // Soft round sprites per colour, drawn additively
    const sprites = {};
    Object.entries(PALETTES).forEach(([name, cols]) => {
      sprites[name] = cols.map((c) => {
        const s = document.createElement('canvas');
        s.width = s.height = 32;
        const g = s.getContext('2d');
        const grad = g.createRadialGradient(16, 16, 0, 16, 16, 16);
        grad.addColorStop(0, 'rgba(255,255,255,1)');
        grad.addColorStop(0.18, `rgba(${c},1)`);
        grad.addColorStop(0.45, `rgba(${c},0.35)`);
        grad.addColorStop(1, `rgba(${c},0)`);
        g.fillStyle = grad;
        g.fillRect(0, 0, 32, 32);
        return s;
      });
    });

    let parts = [];
    let raf = 0;
    let last = 0;
    let dpr = 1;

    function resize() {
      dpr = window.devicePixelRatio || 1;
      canvas.width = phone.clientWidth * dpr;
      canvas.height = phone.clientHeight * dpr;
    }

    function kick() {
      if (raf) return;
      last = performance.now();
      raf = requestAnimationFrame(tick);
    }

    // Rising embers from a rectangle (words burning off)
    function spawn(r, n, palette = 'warm', { rise = 26, spread = 18, life = 1.1, size = 1 } = {}) {
      for (let i = 0; i < n; i++) {
        parts.push({
          x: r.x + Math.random() * r.w,
          y: r.y + r.h * (0.25 + Math.random() * 0.6),
          vx: (Math.random() - 0.5) * spread,
          vy: -rise * (0.4 + Math.random()),
          age: 0,
          life: life * (0.6 + Math.random() * 0.8),
          r: size * (0.7 + Math.random() * 1.5),
          sprite: sprites[palette][Math.floor(Math.random() * 3)],
          flicker: Math.random() * 6,
          buoy: 18 + Math.random() * 22,
        });
      }
      kick();
    }

    // Radial burst (the bubble flaring as it stores the insight)
    function burst(cx, cy, n, palette = 'gold', speed = 70) {
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2 + Math.random() * 0.4;
        const v = speed * (0.6 + Math.random() * 0.7);
        parts.push({
          x: cx, y: cy, vx: Math.cos(a) * v, vy: Math.sin(a) * v,
          age: 0, life: 0.55 + Math.random() * 0.45, r: 0.8 + Math.random() * 1.2,
          sprite: sprites[palette][Math.floor(Math.random() * 3)], flicker: Math.random() * 6, buoy: 0, drag: 3.2,
        });
      }
      kick();
    }

    function tick(now) {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.globalCompositeOperation = 'lighter';
      parts = parts.filter((p) => (p.age += dt) < p.life);
      for (const p of parts) {
        if (p.drag) { p.vx *= 1 - p.drag * dt; p.vy *= 1 - p.drag * dt; }
        p.vy -= p.buoy * dt;                         // hot air: keeps accelerating upward
        p.vx += (Math.random() - 0.5) * 60 * dt;     // and wanders
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        const k = p.age / p.life;
        const fadeIn = Math.min(1, p.age / 0.12);
        const flick = 0.75 + 0.25 * Math.sin(p.flicker + p.age * 22);
        ctx.globalAlpha = fadeIn * (1 - k) * (1 - k) * flick;
        const s = p.r * 7 * (1 - k * 0.4);
        ctx.drawImage(p.sprite, p.x - s / 2, p.y - s / 2, s, s);
      }
      if (parts.length) raf = requestAnimationFrame(tick);
      else { raf = 0; ctx.clearRect(0, 0, canvas.width, canvas.height); }
    }

    function clear() {
      parts = [];
    }

    return { resize, spawn, burst, clear };
  })();

  // A line burning off: a few waves of embers from wherever its words are right now
  function burn(node, palette = 'warm', waves = 3, n = 12) {
    for (let w = 0; w < waves; w++) {
      later(() => {
        if (!node.isConnected) return;
        const r = rel(node);
        if (r.w) embers.spawn(r, n, palette);
      }, w * 120);
    }
  }

  /* ───────────── Liquid drops ───────────── */

  const BASE = 40; // drop element size; every drop is scaled from it
  function makeDrop(x, y, size) {
    const node = el('div', 'recap-drop');
    goo.append(node);
    const d = { node, x, y, s: size, sx: 1, sy: 1, rot: 0, o: 1 };
    renderDrop(d);
    return d;
  }
  function renderDrop(d) {
    const k = d.s / BASE;
    d.node.style.transform = `translate(${d.x.toFixed(2)}px, ${d.y.toFixed(2)}px) rotate(${d.rot.toFixed(2)}rad) scale(${(k * d.sx).toFixed(4)}, ${(k * d.sy).toFixed(4)})`;
    d.node.style.opacity = d.o.toFixed(3);
  }

  const lerp = (a, b, t) => a + (b - a) * t;
  const bez = (p0, p1, p2, t) => ({
    x: (1 - t) * (1 - t) * p0.x + 2 * (1 - t) * t * p1.x + t * t * p2.x,
    y: (1 - t) * (1 - t) * p0.y + 2 * (1 - t) * t * p1.y + t * t * p2.y,
  });

  // Squash & stretch along the direction of travel
  function stretch(d, from, to, maxStretch = 0.75) {
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const speed = Math.hypot(dx, dy);
    if (speed < 0.01) { d.sx = d.sy = 1; return; }
    d.rot = Math.atan2(dy, dx);
    d.sx = 1 + Math.min(maxStretch, speed * 0.06);
    d.sy = 1 / Math.sqrt(d.sx);
  }

  /* ───────────── 1 · Recap text ───────────── */

  function lineNode(text, cls = 'recap-line') {
    const n = el('div', cls);
    n.append(el('span', null, text));
    return n;
  }

  // The gold core insight, centred, held for a beat before it melts
  async function showInsight(id, serif = false) {
    const box = el('div', 'recap-insight');
    const label = el('div', 'recap-insight-label', 'core insight');
    const line = lineNode(INSIGHT, `recap-line recap-line--gold${serif ? ' recap-line--serif' : ''}`);
    box.append(label, line);
    stage.append(box);
    box.animate(
      [
        { opacity: 0, transform: 'translateY(18px) scale(0.96)', filter: 'blur(8px)' },
        { opacity: 1, transform: 'none', filter: 'blur(0px)' },
      ],
      { duration: 800, easing: EASE_OUT, fill: 'backwards' }
    );
    later(() => line.classList.add('is-glinting'), 500);
    await wait(1900);
    return alive(id) ? box : null;
  }

  // Star Wars crawl: tilted plane, lines drift away and burn off near the top
  async function recapCrawl(id) {
    const wrap = el('div', 'recap-crawl');
    const plane = el('div', 'recap-plane');
    wrap.append(plane);
    stage.append(wrap);
    const travel = stage.clientHeight * 1.45;
    const DUR = 5000;
    const GAP = 720;
    RECAP.forEach((text, i) => {
      const line = lineNode(text);
      plane.append(line);
      line.animate(
        [
          { transform: 'translateY(0)', opacity: 0, filter: 'blur(4px)' },
          { transform: `translateY(${-travel * 0.12}px)`, opacity: 1, filter: 'blur(0px)', offset: 0.12 },
          { transform: `translateY(${-travel * 0.56}px)`, opacity: 1, filter: 'blur(0px)', offset: 0.56 },
          { transform: `translateY(${-travel * 0.76}px)`, opacity: 0, filter: 'blur(7px)', offset: 0.76 },
          { transform: `translateY(${-travel}px)`, opacity: 0, filter: 'blur(7px)' },
        ],
        { duration: DUR, delay: i * GAP, easing: 'linear', fill: 'both' } // constant drift
      );
      later(() => burn(line.firstChild), i * GAP + DUR * 0.58);
    });
    await wait((RECAP.length - 1) * GAP + DUR * 0.62);
    if (!alive(id)) return null;
    return showInsight(id);
  }

  // Words turn to embers (the R3 reference): lines stack up, the oldest burn off the top
  async function recapRise(id) {
    const wrap = el('div', 'recap-rise');
    stage.append(wrap);
    const lines = [];
    const ROW_GAP = 10;
    const layout = () => {
      let y = 0;
      for (let i = lines.length - 1; i >= 0; i--) {
        lines[i].style.transform = `translateY(${-y}px)`;
        y += lines[i].offsetHeight + ROW_GAP;
      }
    };
    const burnOff = (line) => {
      if (line.burning) return;
      line.burning = true;
      line.firstChild.animate(
        [
          { opacity: 1, filter: 'blur(0px)', transform: 'none', letterSpacing: '-0.01em' },
          { opacity: 0, filter: 'blur(6px)', transform: 'translateY(-10px) scale(1.03)', letterSpacing: '0.03em' },
        ],
        { duration: 700, easing: EASE_OUT, fill: 'forwards' }
      );
      burn(line.firstChild);
    };
    for (const text of RECAP) {
      const line = lineNode(text);
      wrap.append(line);
      lines.push(line);
      layout();
      line.firstChild.animate(
        [
          { opacity: 0, filter: 'blur(8px)', transform: 'translateY(14px)' },
          { opacity: 1, filter: 'blur(0px)', transform: 'none' },
        ],
        { duration: 700, easing: EASE_OUT, fill: 'backwards' }
      );
      lines.forEach((l, j) => { if (lines.length - 1 - j >= 3) burnOff(l); });
      await wait(820);
      if (!alive(id)) return null;
    }
    lines.forEach((l, j) => later(() => burnOff(l), j * 110));
    await wait(350);
    if (!alive(id)) return null;
    return showInsight(id);
  }

  // Whisper: one soft serif phrase at a time, words blooming in
  async function recapWhisper(id) {
    const wrap = el('div', 'recap-whisper');
    stage.append(wrap);
    for (const text of RECAP) {
      const p = el('p', 'recap-phrase');
      const words = text.split(' ');
      words.forEach((w, k) => {
        const span = el('span', null, w);
        p.append(span, k < words.length - 1 ? ' ' : '');
        span.animate(
          [
            { opacity: 0, filter: 'blur(8px)', transform: 'translateY(6px)' },
            { opacity: 1, filter: 'blur(0px)', transform: 'none' },
          ],
          { duration: 560, delay: k * 45, easing: EASE_OUT, fill: 'backwards' }
        );
      });
      wrap.append(p);
      await wait(560 + words.length * 45 + 520);
      if (!alive(id)) return null;
      p.animate(
        [
          { opacity: 1, filter: 'blur(0px)', transform: 'none' },
          { opacity: 0, filter: 'blur(6px)', transform: 'translateY(-10px)' },
        ],
        { duration: 320, easing: EASE_OUT, fill: 'forwards' }
      );
      burn(p, 'gold', 2, 6);
      await wait(260);
      p.remove();
    }
    if (!alive(id)) return null;
    return showInsight(id, true);
  }

  const RECAPS = { crawl: recapCrawl, rise: recapRise, whisper: recapWhisper };

  /* ───────────── 2 · Melt into a blob, then travel ───────────── */

  // The gold line melts: droplets bead off its ends and run into one blob at the centre
  async function gather(id, box) {
    const text = box.querySelector('.recap-line--gold span');
    const r = rel(text);
    const c = { x: r.cx, y: r.cy };
    box.animate(
      [
        { opacity: 1, filter: 'blur(0px)', transform: 'scale(1)' },
        { opacity: 0, filter: 'blur(12px)', transform: 'scale(0.35, 0.55)' },
      ],
      { duration: 560, easing: EASE_IN_OUT, fill: 'forwards' }
    );
    embers.spawn({ x: r.x, y: r.y, w: r.w, h: r.h }, 16, 'gold', { rise: 18 });

    const main = makeDrop(c.x, c.y, 4);
    const beads = [-0.48, -0.32, -0.16, 0.16, 0.32, 0.48].map((f, i) => {
      const d = makeDrop(c.x + f * r.w, c.y + (i % 2 ? -3 : 3), 10 + Math.random() * 8);
      d.from = { x: d.x, y: d.y };
      d.s0 = d.s;
      d.delay = Math.abs(f) < 0.2 ? 0.1 : 0;
      d.o = 0;
      return d;
    });
    await tween(id, 640, (t) => {
      main.s = lerp(4, 46, ease.out(t));
      renderDrop(main);
      beads.forEach((d) => {
        const k = Math.min(1, Math.max(0, (t - d.delay) / (1 - d.delay)));
        const e = ease.inOut(k);
        const prev = { x: d.x, y: d.y };
        d.x = lerp(d.from.x, c.x, e);
        d.y = lerp(d.from.y, c.y, e);
        d.s = lerp(d.s0, 7, e);
        d.o = Math.min(1, t * 5);
        stretch(d, prev, d, 0.5);
        renderDrop(d);
      });
    });
    if (!alive(id)) return null;
    beads.forEach((d) => d.node.remove());
    box.remove();
    // a jelly wobble as it settles
    await tween(id, 420, (t) => {
      main.sx = 1 + 0.14 * Math.sin(t * Math.PI * 3) * (1 - t);
      main.sy = 1 / main.sx;
      main.rot = 0;
      renderDrop(main);
    });
    return alive(id) ? main : null;
  }

  function target() {
    const r = rel(memories);
    return { x: r.cx, y: r.cy };
  }

  // One blob, tossed in an arc with a short liquid tail
  async function travelArc(id, main, onArrive) {
    const p0 = { x: main.x, y: main.y };
    const p2 = target();
    const p1 = { x: p0.x + 50, y: p2.y - 40 };
    const tail = [makeDrop(p0.x, p0.y, 26), makeDrop(p0.x, p0.y, 17)];
    let arrived = false;
    await tween(id, 980, (t) => {
      const at = (k) => bez(p0, p1, p2, ease.inOut(Math.max(0, k)));
      const prev = { x: main.x, y: main.y };
      Object.assign(main, at(t));
      main.s = lerp(46, 14, ease.inOut(t));
      stretch(main, prev, main);
      main.o = t > 0.9 ? 1 - (t - 0.9) / 0.1 : 1;
      renderDrop(main);
      tail.forEach((d, i) => {
        const lag = 0.06 * (i + 1);
        const pp = { x: d.x, y: d.y };
        Object.assign(d, at(t - lag));
        d.s = lerp(i ? 17 : 26, 6, ease.inOut(t));
        stretch(d, pp, d);
        d.o = main.o;
        renderDrop(d);
      });
      if (!arrived && t > 0.88) { arrived = true; onArrive(); }
    });
    tail.forEach((d) => d.node.remove());
  }

  // Splits into droplets that fan out and stream in one after another
  async function travelDrops(id, main, onArrive) {
    const p0 = { x: main.x, y: main.y };
    const p2 = target();
    main.node.remove();
    const sizes = [26, 21, 17, 14, 11];
    const drops = sizes.map((s, i) => {
      const d = makeDrop(p0.x, p0.y, s);
      d.p1 = { x: p0.x - 70 + i * 45, y: p2.y - 30 + i * 26 };
      d.delay = i * 90;
      return d;
    });
    const DUR = 820;
    const total = DUR + drops[drops.length - 1].delay;
    let arrived = false;
    await tween(id, total, (t) => {
      const ms = t * total;
      drops.forEach((d, i) => {
        const k = Math.min(1, Math.max(0, (ms - d.delay) / DUR));
        const prev = { x: d.x, y: d.y };
        Object.assign(d, bez(p0, d.p1, p2, ease.inOut(k)));
        d.s = lerp(sizes[i], 6, ease.inOut(k));
        d.o = k > 0.9 ? 1 - (k - 0.9) / 0.1 : 1;
        stretch(d, prev, d, 0.6);
        renderDrop(d);
        if (!arrived && i === 0 && k > 0.9) { arrived = true; onArrive(); }
      });
    });
    drops.forEach((d) => d.node.remove());
  }

  // Lava-lamp bubble: drifts up slowly, swaying and wobbling
  async function travelFloat(id, main, onArrive) {
    const p0 = { x: main.x, y: main.y };
    const p2 = target();
    let arrived = false;
    await tween(id, 1600, (t) => {
      const e = ease.inOutSine(t);
      main.x = lerp(p0.x, p2.x, e) + Math.sin(t * Math.PI * 2.5) * 22 * (1 - t);
      main.y = lerp(p0.y, p2.y, e);
      main.s = lerp(46, 14, e);
      main.rot = 0;
      main.sx = 1 + 0.08 * Math.sin(t * Math.PI * 9);
      main.sy = 1 / main.sx;
      main.o = t > 0.92 ? 1 - (t - 0.92) / 0.08 : 1;
      renderDrop(main);
      if (!arrived && t > 0.9) { arrived = true; onArrive(); }
    });
  }

  const TRAVELS = { arc: travelArc, drops: travelDrops, float: travelFloat };

  /* ───────────── 3 · Stored in the insights bubble (1s) ───────────── */

  function store(kind) {
    const c = target();
    memories.classList.add('has-insight');
    const ring = (delay = 0, to = 1.9) =>
      ripple.animate(
        [
          { opacity: 0.95, transform: 'scale(1)' },
          { opacity: 0, transform: `scale(${to})` },
        ],
        { duration: 900, delay, easing: EASE_OUT }
      );

    if (kind === 'gulp') {
      // swallowed: a jelly squash, the core flares, one ripple
      memories.animate(
        [
          { transform: 'scale(1)' },
          { transform: 'scale(1.14, 0.84)', offset: 0.16 },
          { transform: 'scale(0.9, 1.1)', offset: 0.36 },
          { transform: 'scale(1.05, 0.96)', offset: 0.56 },
          { transform: 'scale(0.99, 1.01)', offset: 0.78 },
          { transform: 'scale(1)' },
        ],
        { duration: 1000, easing: 'ease-in-out' }
      );
      core.animate(
        [
          { opacity: 0, transform: 'scale(0.4)', filter: 'brightness(1)' },
          { opacity: 1, transform: 'scale(1.25)', filter: 'brightness(1.8)', offset: 0.3 },
          { opacity: 0.6, transform: 'scale(1)', filter: 'brightness(1)' },
        ],
        { duration: 1000, easing: EASE_OUT }
      );
      ring(120);
    } else if (kind === 'fill') {
      // poured in: gold rises inside the bubble, sloshes, then settles into the core
      const liquid = fill.firstChild;
      fill.animate([{ opacity: 1 }, { opacity: 1, offset: 0.62 }, { opacity: 0 }], { duration: 1000, easing: 'ease' });
      liquid.animate(
        [
          { transform: 'translateY(100%) rotate(-8deg)' },
          { transform: 'translateY(38%) rotate(5deg)', offset: 0.45 },
          { transform: 'translateY(30%) rotate(-2deg)', offset: 0.7 },
          { transform: 'translateY(32%) rotate(0deg)' },
        ],
        { duration: 1000, easing: EASE_OUT }
      );
      core.animate(
        [
          { opacity: 0, transform: 'scale(0.8)' },
          { opacity: 0, transform: 'scale(0.8)', offset: 0.5 },
          { opacity: 0.9, transform: 'scale(1.1)', offset: 0.8 },
          { opacity: 0.6, transform: 'scale(1)' },
        ],
        { duration: 1000, easing: EASE_OUT }
      );
      memories.animate(
        [{ transform: 'scale(1)' }, { transform: 'scale(1.06)', offset: 0.4 }, { transform: 'scale(1)' }],
        { duration: 1000, easing: EASE_OUT }
      );
    } else {
      // spark: the core flares, gold sparks burst out, the glyph pops
      core.animate(
        [
          { opacity: 0, transform: 'scale(0.5)', filter: 'brightness(1)' },
          { opacity: 1, transform: 'scale(1.5)', filter: 'brightness(2.2)', offset: 0.22 },
          { opacity: 0.6, transform: 'scale(1)', filter: 'brightness(1)' },
        ],
        { duration: 1000, easing: EASE_OUT }
      );
      memoriesIcon.animate(
        [{ transform: 'scale(1)' }, { transform: 'scale(1.28)', offset: 0.2 }, { transform: 'scale(0.96)', offset: 0.5 }, { transform: 'scale(1)' }],
        { duration: 1000, easing: EASE_OUT }
      );
      embers.burst(c.x, c.y, 24, 'gold', 80);
      ring(0, 2.1);
      ring(220, 1.6);
    }

    // a small label says what just happened, then gets out of the way
    later(() => {
      toast.classList.add('is-shown');
      later(() => toast.classList.remove('is-shown'), 2200);
    }, 650);
  }

  /* ───────────── 4 · The other agents light up ───────────── */

  function cueAgents() {
    phone.dataset.cue = settings.cue;
    agents.forEach((a, i) => {
      if (i === VENTED_WITH) return;
      later(() => a.classList.add('has-news'), 120 + (i === 2 ? 160 : 0));
    });
  }

  /* ───────────── 5 · Their opener, in their own voice ───────────── */

  let openerRun = 0;

  function clearStage() {
    stage.replaceChildren();
    delete stage.dataset.mode;
  }

  function typingDots() {
    const d = el('div', 'op-typing');
    d.innerHTML = '<i></i><i></i><i></i>';
    return d;
  }

  const appear = (node, extra = {}) =>
    node.animate(
      [
        { opacity: 0, transform: 'translateY(10px) scale(0.97)', filter: 'blur(6px)', ...extra },
        { opacity: 1, transform: 'none', filter: 'blur(0px)' },
      ],
      { duration: 480, easing: EASE_OUT, fill: 'backwards' }
    );

  async function playOpener(agent) {
    const o = OPENERS[agent];
    if (!o) return;
    const my = ++openerRun;
    const still = () => my === openerRun && stage.dataset.mode === 'opener';
    clearStage();
    stage.dataset.mode = 'opener';
    stage.dataset.agent = String(agent);
    input.placeholder = o.placeholder;
    const pause = (ms) => new Promise((res) => setTimeout(res, ms));

    if (settings.opener === 'bubbles') {
      const thread = el('div', 'op-thread');
      const name = el('div', 'op-name', o.name);
      thread.append(name);
      stage.append(thread);
      appear(name);
      for (const line of o.lines) {
        const dots = typingDots();
        thread.append(dots);
        appear(dots);
        await pause(line.length > 40 ? 1100 : 700);
        if (!still()) return;
        const bubble = el('div', 'op-bubble', line);
        dots.replaceWith(bubble);
        appear(bubble, { transform: 'translateY(8px) scale(0.96)' });
        await pause(260);
        if (!still()) return;
      }
    } else if (settings.opener === 'voice') {
      const box = el('div', 'op-voice');
      stage.append(box);
      for (const line of o.lines) {
        const p = el('p', 'op-voice-line');
        const words = line.split(' ');
        words.forEach((w, k) => {
          const span = el('span', null, w);
          p.append(span, k < words.length - 1 ? ' ' : '');
          span.animate(
            [
              { opacity: 0, filter: 'blur(10px)', transform: 'translateY(8px)' },
              { opacity: 1, filter: 'blur(0px)', transform: 'none' },
            ],
            { duration: 600, delay: k * 55, easing: EASE_OUT, fill: 'backwards' }
          );
        });
        box.append(p);
        await pause(600 + words.length * 55 + 300);
        if (!still()) return;
      }
    } else {
      const card = el('button', 'op-card');
      card.type = 'button';
      const photo = agents[agent].querySelector('.agent-photo').getAttribute('src');
      card.innerHTML =
        `<img src="${photo}" alt="" /><span class="op-card-head"><b></b><small>now</small></span>` +
        '<span class="op-card-body"></span><span class="op-card-cta">Tap to reply</span>';
      card.querySelector('b').textContent = o.name;
      const body = card.querySelector('.op-card-body');
      body.append(typingDots());
      card.addEventListener('mousedown', (e) => e.preventDefault()); // keep focus in the field
      card.addEventListener('click', () => setKeyboard(true));
      stage.append(card);
      appear(card, { transform: 'translateY(18px) scale(0.97)' });
      await pause(900);
      if (!still()) return;
      body.textContent = o.lines.join(' ');
      body.animate([{ opacity: 0, filter: 'blur(4px)' }, { opacity: 1, filter: 'blur(0px)' }], { duration: 360, easing: EASE_OUT });
    }
  }

  // Coming to the front with news plays its opener (debounced, so spinning past doesn't)
  let agentTimer = 0;
  new MutationObserver(() => {
    clearTimeout(agentTimer);
    agentTimer = setTimeout(() => {
      if (phone.dataset.screen !== 'agents') return;
      const a = Number(phone.dataset.agent);
      if (agents[a].classList.contains('has-news')) {
        agents[a].classList.remove('has-news');
        playOpener(a);
      } else if (stage.dataset.mode === 'opener' && Number(stage.dataset.agent) !== a) {
        openerRun++;
        clearStage();
        input.placeholder = DEFAULT_PLACEHOLDER;
      }
    }, 240);
  }).observe(phone, { attributes: true, attributeFilter: ['data-agent'] });

  /* ───────────── The whole sequence ───────────── */

  function reset() {
    run++;
    openerRun++;
    timers.forEach(clearTimeout);
    timers = [];
    stage.getAnimations({ subtree: true }).forEach((a) => a.cancel());
    clearStage();
    goo.replaceChildren();
    embers.clear();
    memories.classList.remove('has-insight');
    toast.classList.remove('is-shown');
    agents.forEach((a) => a.classList.remove('has-news'));
  }

  async function play() {
    reset();
    const id = run;
    if (phone.dataset.screen !== 'agents') return;
    embers.resize();
    input.placeholder = DEFAULT_PLACEHOLDER;
    if (Number(phone.dataset.agent) !== VENTED_WITH) window.Lava.selectAgent(VENTED_WITH);
    stage.dataset.mode = 'recap';
    await wait(450);
    if (!alive(id)) return;

    if (reduceMotion.matches) {
      // no travel: the insight shows, fades, and the states simply switch on
      const box = await showInsight(id);
      if (!box) return;
      box.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 300, fill: 'forwards' });
      memories.classList.add('has-insight');
      cueAgents();
      return;
    }

    const box = await RECAPS[settings.recap](id);
    if (!box) return;
    const blob = await gather(id, box);
    if (!blob) return;
    await TRAVELS[settings.travel](id, blob, () => {
      store(settings.store);
      cueAgents();
    });
    if (!alive(id)) return;
    goo.replaceChildren();
    delete stage.dataset.mode;
  }

  /* ───────────── Panel ───────────── */

  function syncPanel() {
    panel.querySelectorAll('.seq-group').forEach((g) => {
      g.querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.v === settings[g.dataset.key])));
    });
    phone.dataset.cue = settings.cue;
  }

  function showAgentScreen() {
    if (phone.dataset.screen === 'agents') return false;
    document.querySelector('#screenPicker [data-screen="agents"]').click(); // plays via lava:screen
    return true;
  }

  panel.addEventListener('mousedown', (e) => e.preventDefault()); // keep the input focused
  panel.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    if (b.id === 'seqReplay') {
      if (!showAgentScreen()) play();
      return;
    }
    const key = b.closest('.seq-group').dataset.key;
    settings[key] = b.dataset.v;
    try { localStorage.setItem(SEQ_KEY, JSON.stringify(settings)); } catch {}
    syncPanel();
    if (key === 'cue') return; // applies live to avatars that have news
    if (key === 'opener') {
      // replay the opener on screen, if there is one
      if (stage.dataset.mode === 'opener') playOpener(Number(stage.dataset.agent));
      return;
    }
    if (!showAgentScreen()) play();
  });

  phone.addEventListener('lava:screen', (e) => {
    if (e.detail === 'agents') play();
    else reset();
  });

  syncPanel();
  if (phone.dataset.screen === 'agents') play();
})();
