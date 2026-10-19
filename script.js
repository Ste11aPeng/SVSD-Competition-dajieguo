(() => {
  let namesReady = false; // set once the name-style code below has initialised
  const phone = document.getElementById('phone');
  const input = document.getElementById('message');
  const field = document.getElementById('field');
  const keyboard = document.getElementById('keyboard');
  const composer = document.getElementById('composer');

  /* ───────────── Agents: a looping ring with fake 3D depth ───────────── */

  const SMALL = 32;
  const LARGE = 44;
  const SIDE_OFFSET = 54; // centre-to-centre distance of the side avatars in the design

  const agentsEl = document.querySelector('.agents');
  const agentButtons = [...document.querySelectorAll('.agent')];
  // Each background style is its own set of per-agent layers; all sets switch hue together
  const bgSets = [...document.querySelectorAll('.bg')].map((el) => ({
    layers: [...el.querySelectorAll('.bg-layer')],
    top: 1,
  }));

  const COUNT = agentButtons.length;
  const STEP = 360 / COUNT;                                    // 120° between avatars
  const RADIUS = SIDE_OFFSET / Math.sin((STEP * Math.PI) / 180); // so the sides land 54px out
  const DEG_PER_PX = STEP / SIDE_OFFSET;                        // dragging one slot = one step

  const parts = agentButtons.map((el) => ({
    el,
    photo: el.querySelector('.agent-photo'),
    chrome: el.querySelector('.agent-chrome'),
    glow: el.querySelector('.agent-glow'),
  }));

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const lerp = (a, b, t) => a + (b - a) * t;
  const clamp01 = (t) => Math.min(1, Math.max(0, t));
  const mod = (n, m) => ((n % m) + m) % m;
  const shortestDelta = (deg) => mod(deg + 180, 360) - 180;

  let active = Number(phone.dataset.agent) || 0;

  // Ring rotation in degrees: avatar i is in front when rotation === i * STEP.
  let rotation = active * STEP;
  let velocity = 0; // deg/s, kept across interruptions so the spring never restarts from rest
  let target = rotation;

  // Every avatar is a 44px box; position, size and depth all come from its
  // angle on the ring, so moving between slots traces an orbit (the avatar
  // that wraps around travels behind the other two instead of through them).
  function renderRing() {
    parts.forEach(({ el, photo, chrome, glow }, i) => {
      const theta = ((i * STEP - rotation) * Math.PI) / 180;
      const x = RADIUS * Math.sin(theta);
      const depth = Math.cos(theta); // 1 front · -0.5 sides · -1 back

      // front ↔ side follows the design exactly (44px/100% ↔ 32px/20%·40%);
      // side ↔ back keeps shrinking and dimming to sell the depth.
      const front = clamp01((depth + 0.5) / 1.5);
      const back = clamp01((-0.5 - depth) / 0.5);
      const scale = lerp(SMALL / LARGE, 1, front) * lerp(1, 0.82, back);
      // Opacity runs ahead of the motion: fully lit once the avatar is ~45° from
      // the front, so a tapped photo is at full strength ~130ms into the spin.
      const lit = 1 - (1 - clamp01((depth + 0.5) / 1.2)) ** 2;

      el.style.transform = `translate3d(${x.toFixed(2)}px, 0, 0) scale(${scale.toFixed(4)})`;
      el.style.zIndex = String(Math.round((depth + 1) * 50));
      photo.style.opacity = (lerp(0.2, 1, lit) * lerp(1, 0.5, back)).toFixed(3);
      chrome.style.opacity = (lerp(0.4, 1, lit) * lerp(1, 0.5, back)).toFixed(3);
      glow.style.opacity = lerp(0.4, 1, lit).toFixed(3);
    });
  }

  // Spring (≈ Apple's duration 0.5s, bounce 0.15). Interruptible: a new target
  // keeps the current velocity.
  const STIFFNESS = 158;
  const DAMPING = 21.4;
  let raf = 0;
  let lastTime = 0;

  function step(now) {
    // Real elapsed time (sub-stepped), so dropped frames never slow the spring down
    const dt = Math.min(1, (now - lastTime) / 1000 || 1 / 60);
    lastTime = now;
    const n = Math.ceil(dt / 0.004);
    const h = dt / n;
    for (let k = 0; k < n; k++) {
      const force = -STIFFNESS * (rotation - target) - DAMPING * velocity;
      velocity += force * h;
      rotation += velocity * h;
    }
    if (Math.abs(rotation - target) < 0.02 && Math.abs(velocity) < 0.5) {
      rotation = target;
      velocity = 0;
      raf = 0;
      renderRing();
      return;
    }
    renderRing();
    raf = requestAnimationFrame(step);
  }

  function animateTo(newTarget) {
    target = newTarget;
    if (reduceMotion.matches) {
      cancelAnimationFrame(raf);
      raf = 0;
      rotation = target;
      velocity = 0;
      renderRing();
      return;
    }
    if (!raf) {
      lastTime = performance.now();
      raf = requestAnimationFrame(step);
    }
  }

  function stopSpring() {
    cancelAnimationFrame(raf);
    raf = 0;
  }

  // Crossfade the incoming hue on top of whatever is showing, so there is never
  // a dip in brightness mid-transition (interruptible: a fast re-tap just stacks
  // the next layer above the partially faded one).
  function showBackground(index, instant) {
    bgSets.forEach((set) => showLayer(set, index, instant));
  }

  function showLayer(set, index, instant) {
    const layer = set.layers[index];
    const wasTop = Number(layer.style.zIndex) === set.top;
    layer.style.zIndex = String(++set.top);
    if (instant || !wasTop) {
      layer.style.transition = 'none';
      layer.classList.remove('is-visible');
      if (instant) layer.classList.add('is-visible');
      layer.offsetWidth; // commit before restoring the transition
      layer.style.transition = '';
    }
    layer.classList.add('is-visible');
    const onDone = (e) => {
      if (e && e.propertyName !== 'opacity') return;
      layer.removeEventListener('transitionend', onDone);
      if (Number(phone.dataset.agent) !== index) return;
      set.layers.forEach((other) => {
        if (other === layer) return;
        other.style.transition = 'none';
        other.classList.remove('is-visible');
        other.offsetWidth;
        other.style.transition = '';
      });
    };
    if (instant) onDone();
    else layer.addEventListener('transitionend', onDone);
  }

  // Label, hue and accessibility state follow whichever avatar is in front
  function setActive(index, instant = false) {
    if (index === active && !instant) return;
    active = index;
    phone.dataset.agent = String(index);
    agentButtons.forEach((el, i) => {
      el.classList.toggle('is-active', i === index);
      el.setAttribute('aria-pressed', String(i === index));
    });
    document.querySelectorAll('.agent-label').forEach((el) => el.classList.toggle('is-active', Number(el.dataset.for) === index));
    showBackground(index, instant);
  }

  function selectAgent(index) {
    setActive(index);
    animateTo(rotation + shortestDelta(index * STEP - rotation));
  }

  /* Drag the row to spin the ring; a quick flick is enough to move a slot */

  let drag = null;
  let suppressClick = false;

  agentsEl.addEventListener('pointerdown', (e) => {
    if (drag) return; // ignore extra fingers once a drag has started
    drag = {
      id: e.pointerId,
      startX: e.clientX,
      startRotation: rotation,
      moving: false,
      samples: [{ t: e.timeStamp, r: rotation }],
    };
  });

  agentsEl.addEventListener('pointermove', (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    const dx = e.clientX - drag.startX;
    if (!drag.moving) {
      if (Math.abs(dx) < 5) return;
      drag.moving = true;
      drag.startX = e.clientX;
      drag.startRotation = rotation;
      stopSpring();
      try { agentsEl.setPointerCapture(e.pointerId); } catch {} // keep tracking outside the row
      agentsEl.classList.add('is-dragging');
      agentButtons.forEach((el) => el.classList.remove('is-down'));
    }
    rotation = drag.startRotation - (e.clientX - drag.startX) * DEG_PER_PX;
    drag.samples.push({ t: e.timeStamp, r: rotation });
    if (drag.samples.length > 6) drag.samples.shift();
    renderRing();
    setActive(mod(Math.round(rotation / STEP), COUNT));
  });

  function endDrag(e) {
    if (!drag || e.pointerId !== drag.id) return;
    const { moving, samples } = drag;
    drag = null;
    agentsEl.classList.remove('is-dragging');
    if (!moving) return;

    suppressClick = true;
    setTimeout(() => (suppressClick = false), 0);

    const first = samples[0];
    const last = samples[samples.length - 1];
    const dt = (last.t - first.t) / 1000;
    velocity = dt > 0 ? (last.r - first.r) / dt : 0;

    // Project where the flick would coast to, then settle on the nearest slot
    const projected = rotation + velocity * 0.12;
    const snapped = Math.round(projected / STEP) * STEP;
    setActive(mod(Math.round(snapped / STEP), COUNT));
    animateTo(snapped);
  }

  agentsEl.addEventListener('pointerup', endDrag);
  agentsEl.addEventListener('pointercancel', endDrag);

  agentButtons.forEach((el) => {
    el.addEventListener('click', () => {
      if (suppressClick) return;
      selectAgent(Number(el.dataset.index));
    });
  });

  /* ───────────── Keyboard open / close ───────────── */

  function setKeyboard(open) {
    phone.dataset.keyboard = open ? 'open' : 'closed';
    if (open) {
      if (document.activeElement !== input) input.focus({ preventScroll: true });
    } else {
      input.blur();
    }
  }

  input.addEventListener('focus', () => setKeyboard(true));

  // Tapping the field anywhere (not just the text) focuses the input
  field.addEventListener('pointerdown', (e) => {
    if (e.target.closest('button')) return;
    if (e.target !== input) {
      e.preventDefault();
      setKeyboard(true);
    }
  });

  // Tap on empty space dismisses the keyboard (not a chat bubble, not a card, not Send)
  phone.addEventListener('pointerdown', (e) => {
    if (phone.dataset.keyboard !== 'open') return;
    // the keyboard, the field, and anything in the conversation (bubbles, the email draft and its buttons, the
    // quick replies, the place card) leave it up; only empty space puts it away
    if (e.target.closest('.keyboard, .composer, .agents, .memories, .pre-hit, .op-msg, .op-chips, .op-draft, .cb')) {
      if (e.target.closest('.op-draft-btn, .op-chip')) e.preventDefault(); // pressing a button keeps focus in the field
      return;
    }
    e.preventDefault();
    setKeyboard(false);
  });

  // With something typed, the voice button is the send button
  const voiceButton = composer.querySelector('.voice');
  voiceButton.addEventListener('click', () => {
    if (input.value.trim()) composer.requestSubmit();
  });
  input.addEventListener('input', () => {
    voiceButton.setAttribute('aria-label', input.value.trim() ? 'Send' : 'Talk');
  });

  // Sending keeps the keyboard up so you can keep typing; return on an empty field puts it away
  composer.addEventListener('submit', (e) => {
    e.preventDefault();
    if (!input.value.trim()) setKeyboard(false);
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && phone.dataset.keyboard === 'open') setKeyboard(false);
  });

  /* ───────────── On-screen keyboard typing ───────────── */

  function insertText(text) {
    const start = input.selectionStart ?? input.value.length;
    const end = input.selectionEnd ?? start;
    input.setRangeText(text, start, end, 'end');
    input.dispatchEvent(new Event('input', { bubbles: true }));
  }

  function deleteBackward() {
    const start = input.selectionStart ?? input.value.length;
    const end = input.selectionEnd ?? start;
    if (start !== end) input.setRangeText('', start, end, 'end');
    else if (start > 0) input.setRangeText('', start - 1, start, 'end');
    input.dispatchEvent(new Event('input', { bubbles: true }));
  }

  function replaceCurrentWord(word) {
    const caret = input.selectionStart ?? input.value.length;
    const before = input.value.slice(0, caret);
    const wordStart = before.search(/\S*$/);
    input.setRangeText(`${word} `, wordStart, caret, 'end');
    input.dispatchEvent(new Event('input', { bubbles: true }));
  }

  let shift = false;
  function setShift(on) {
    shift = on;
    phone.dataset.shift = on ? 'on' : 'off';
  }

  let repeatTimer = null;
  let repeatInterval = null;
  function stopRepeat() {
    clearTimeout(repeatTimer);
    clearInterval(repeatInterval);
    repeatTimer = repeatInterval = null;
  }

  let downEl = null;
  function release() {
    if (downEl) downEl.classList.remove('is-down');
    downEl = null;
    stopRepeat();
  }

  // Keep focus in the input while the keyboard is used
  keyboard.addEventListener('mousedown', (e) => e.preventDefault());

  keyboard.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    const target = e.target.closest('.key, .kb-suggestion');
    if (!target) return;
    release();
    downEl = target;
    target.classList.add('is-down');
    if (document.activeElement !== input) input.focus({ preventScroll: true });

    if (target.dataset.action === 'delete') {
      deleteBackward();
      repeatTimer = setTimeout(() => {
        repeatInterval = setInterval(deleteBackward, 70);
      }, 420);
    }
  });

  keyboard.addEventListener('pointerup', (e) => {
    const target = downEl;
    release();
    if (!target || !target.contains(e.target)) return;

    if (target.classList.contains('kb-suggestion')) {
      replaceCurrentWord(target.dataset.insert);
      return;
    }

    const char = target.dataset.char;
    if (char !== undefined) {
      insertText(shift ? char.toUpperCase() : char);
      if (shift) setShift(false);
      return;
    }

    switch (target.dataset.action) {
      case 'shift':
        setShift(!shift);
        break;
      case 'return':
        composer.requestSubmit(); // sends, like a real keyboard's return
        break;
      default:
        break;
    }
  });

  keyboard.addEventListener('pointercancel', release);
  keyboard.addEventListener('pointerleave', release);

  /* ───────────── Press states for touch (":active" is unreliable on iOS) ───────────── */

  document.querySelectorAll('.pressable, .agent').forEach((el) => {
    el.addEventListener('mousedown', (e) => e.preventDefault()); // don't steal focus from the input
    el.addEventListener('pointerdown', () => el.classList.add('is-down'));
    ['pointerup', 'pointerleave', 'pointercancel'].forEach((type) =>
      el.addEventListener(type, () => el.classList.remove('is-down'))
    );
  });

  /* ───────────── Background style picker (design exploration) ───────────── */

  const bgPicker = document.getElementById('bgPicker');
  const BG_KEY = 'lava.bgStyle.v2';

  function setBgStyle(name) {
    phone.dataset.bg = name;
    bgPicker.querySelectorAll('button').forEach((b) =>
      b.setAttribute('aria-checked', String(b.dataset.bg === name))
    );
    try { localStorage.setItem(BG_KEY, name); } catch {}
    if (namesReady) refreshNames(); // background style changes the theme colours
  }

  bgPicker.addEventListener('mousedown', (e) => e.preventDefault()); // keep the input focused
  bgPicker.addEventListener('click', (e) => {
    const b = e.target.closest('button[data-bg]');
    if (b) setBgStyle(b.dataset.bg);
  });

  let savedBg = null;
  try { savedBg = localStorage.getItem(BG_KEY); } catch {}
  setBgStyle(bgPicker.querySelector(`[data-bg="${savedBg}"]`) ? savedBg : phone.dataset.bg);

  /* ───────────── Agent name style (design exploration) ───────────── */

  const namePicker = document.getElementById('namePicker');
  const fxLabels = document.getElementById('fxLabels');
  const NAME_KEY = 'lava.nameStyle';
  const agentNames = agentButtons.map((b) => b.getAttribute('aria-label'));
  const NAME_HEIGHT = 13.5; // same size as the original label (≈11.5px type)
  // per-style size tweaks, in px of type size (the glyph box is ~1.21× the type size)
  const NAME_SIZE_BUMP = { zoom: 2 };
  // per-agent variants of a style: Roaster is set crisp (no streak), Calm Sibling breathes softly
  const NAME_VARIANTS = { zoom: { 0: 'plain', 2: 'calm' } };
  // the calm italic serif has a small x-height, so it's set a touch larger to read at the same size
  const NAME_VARIANT_BUMP = { calm: 1.5 };
  // per-agent faces for a style: Roaster gets a sassy retro italic. `scale` evens out its apparent
  // size against the style's own font, since it sits smaller in its em box.
  const NAME_FONTS = {
    zoom: { 0: { font: { family: "'Shrikhand', cursive", weight: 400, stretch: '100%', tracking: 1 }, scale: 1.12 } },
  };

  /* Theme-tinted name colours. Each agent's theme colour (which depends on the background
     style) is read from the stylesheet through a hidden probe, mixed into white, and pulled
     back toward white until it clears 7:1 against the near-black top of the screen —
     including the label's 90% opacity. */
  const themeProbe = document.createElement('div');
  themeProbe.className = 'phone';
  themeProbe.hidden = true;
  document.body.appendChild(themeProbe);

  const WHITE = [255, 255, 255];
  const LABEL_BG = [8, 8, 9];
  const MIN_CONTRAST = 7;
  const mixRgb = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
  const toHex = (c) => '#' + c.map((v) => Math.round(Math.min(255, Math.max(0, v))).toString(16).padStart(2, '0')).join('');
  const luminance = (c) => {
    const [r, g, b] = c.map((v) => {
      const x = v / 255;
      return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const contrast = (a, b) => {
    const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
    return (hi + 0.05) / (lo + 0.05);
  };

  function themeRgb(agent) {
    themeProbe.dataset.agent = String(agent);
    themeProbe.dataset.bg = phone.dataset.bg;
    const v = getComputedStyle(themeProbe).getPropertyValue('--theme');
    return (v.match(/[\d.]+/g) || ['255', '255', '255']).slice(0, 3).map(Number);
  }

  // Light, theme-tinted ink that still reads (start at 34% theme, back off until ≥ 7:1)
  function nameInk(theme) {
    let t = 0.34;
    let ink = mixRgb(WHITE, theme, t);
    while (t > 0 && contrast(mixRgb(LABEL_BG, ink, 0.9), LABEL_BG) < MIN_CONTRAST) {
      t -= 0.02;
      ink = mixRgb(WHITE, theme, t);
    }
    return ink;
  }

  function namePalette(style, theme, ink) {
    if (style === 'zoom') {
      // light core; the streak cools from a pale tint to a deeper shade of the theme
      return {
        core: toHex(ink),
        ghosts: [toHex(mixRgb(ink, theme, 0.25)), toHex(mixRgb(theme, [150, 160, 170], 0.45)), toHex(mixRgb(theme, [20, 24, 30], 0.55))],
      };
    }
    if (style === 'vibe') {
      // white-hot core → pale tint → theme → deep theme, with the haze in the theme colour
      return {
        core: toHex(mixRgb(WHITE, theme, 0.12)),
        ghosts: [toHex(mixRgb(WHITE, theme, 0.1)), toHex(mixRgb(WHITE, theme, 0.42)), toHex(theme), toHex(mixRgb(theme, [0, 0, 0], 0.5))],
        haze: [toHex(theme), toHex(mixRgb(theme, [0, 0, 0], 0.2)), toHex(mixRgb(WHITE, theme, 0.55)), toHex(theme)],
      };
    }
    return null;
  }

  // The original (Figma) text labels get the same tint
  function tintOriginalLabels() {
    document.querySelectorAll('.agent-labels--original .agent-label').forEach((el) => {
      el.style.color = toHex(nameInk(themeRgb(Number(el.dataset.for))));
    });
  }

  // The effect fonts are only used inside SVG, so ask for them explicitly before measuring
  const nameFonts = Promise.all(
    ['430 100px Archivo', '500 100px Archivo', '800 100px Archivo', '900 100px Archivo', '650 100px Inter', '1000 100px Nunito', 'italic 500 100px "EB Garamond"', '100px Shrikhand'].map((f) => document.fonts.load(f))
  ).catch(() => {});

  // Any text drawn the way agent i's name is in `style` (sizes, per-agent faces, theme colours)
  function nameGraphic(text, i, style, base = NAME_HEIGHT) {
    const theme = themeRgb(i);
    const ink = nameInk(theme);
    const variant = (NAME_VARIANTS[style] || {})[i] || null;
    const swap = (NAME_FONTS[style] || {})[i] || null;
    const height = (base + ((NAME_SIZE_BUMP[style] || 0) + (NAME_VARIANT_BUMP[variant] || 0)) * 1.21) * (swap ? swap.scale : 1);
    return NameEffects.render(style, text, { ink: toHex(ink), height, palette: namePalette(style, theme, ink), variant, font: swap && swap.font });
  }

  // "Ready to vent?" on the first screen wears the same name style (in the lava brand colour)
  const ventTitle = document.querySelector('.vent-title');
  const VENT_TITLE = ventTitle ? ventTitle.textContent : '';
  function renderVentTitle(style) {
    if (!ventTitle) return;
    ventTitle.classList.toggle('is-fx', style !== 'original');
    ventTitle.replaceChildren();
    if (style === 'original') { ventTitle.textContent = VENT_TITLE; return; }
    const svg = nameGraphic(VENT_TITLE, 1, style, 22 * 1.21);
    svg.setAttribute('role', 'img');
    svg.setAttribute('aria-label', VENT_TITLE);
    // the trail behind the word (everything before the core) sinks back so it melts into the cloud
    const trail = svg.querySelector(':scope > defs + g');
    if (trail && trail.nextElementSibling) trail.classList.add('vent-title-trail');
    ventTitle.append(svg);
  }

  async function renderNameLabels(style) {
    fxLabels.replaceChildren();
    if (style === 'original') { renderVentTitle(style); return; }
    await nameFonts;
    if (phone.dataset.name !== style) return; // picked something else while fonts loaded
    renderVentTitle(style);
    agentNames.forEach((name, i) => {
      const svg = nameGraphic(name, i, style);
      svg.classList.add('agent-label');
      svg.dataset.for = String(i);
      svg.classList.toggle('is-active', i === active);
      fxLabels.appendChild(svg);
    });
  }

  function setNameStyle(name) {
    phone.dataset.name = name;
    tintOriginalLabels();
    namePicker.querySelectorAll('button').forEach((b) =>
      b.setAttribute('aria-checked', String(b.dataset.name === name))
    );
    try { localStorage.setItem(NAME_KEY, name); } catch {}
    renderNameLabels(name);
  }

  function refreshNames() {
    tintOriginalLabels();
    renderNameLabels(phone.dataset.name);
  }

  namePicker.addEventListener('mousedown', (e) => e.preventDefault()); // keep the input focused
  namePicker.addEventListener('click', (e) => {
    const b = e.target.closest('button[data-name]');
    if (b) setNameStyle(b.dataset.name);
  });

  let savedName = null;
  try { savedName = localStorage.getItem(NAME_KEY); } catch {}
  setNameStyle(namePicker.querySelector(`[data-name="${savedName}"]`) ? savedName : phone.dataset.name);
  namesReady = true;

  /* ───────────── Pre-screen: first visit, no agent picked (design exploration) ───────────── */

  const pre = document.getElementById('pre');
  const screenPicker = document.getElementById('screenPicker');
  const SCREEN_KEY = 'lava.firstScreen.v2';
  const DEFAULT_PLACEHOLDER = input.placeholder;

  // Timers belong to the variant on screen; switching clears them all
  let screenTimers = [];
  const later = (fn, ms) => screenTimers.push(setTimeout(fn, ms));

  // Starters hide while there's text in the field
  input.addEventListener('input', () => {
    phone.dataset.typing = input.value.trim() ? 'on' : 'off';
  });

  // A starter drops a casual opener into the field, ready to keep typing
  function fill(text) {
    input.value = text;
    input.dispatchEvent(new Event('input', { bubbles: true }));
    setKeyboard(true);
    input.setSelectionRange(text.length, text.length);
  }

  pre.addEventListener('mousedown', (e) => {
    if (e.target.closest('.pre-hit')) e.preventDefault(); // keep focus in the field
  });
  pre.addEventListener('click', (e) => {
    const t = e.target.closest('[data-fill]');
    if (t) fill(t.dataset.fill);
  });

  /* 2 · Remember… — the name cycles through people and threads from recent chats */

  const rotator = document.getElementById('rotator');
  const rotatorText = rotator.querySelector('em');
  const REMEMBER = ['Kevin?', 'Leo from the gym?', 'that email?', 'your landlord?', 'Priya’s new guy?'];

  function startRotator() {
    let i = 0;
    rotator.classList.remove('is-out', 'is-in');
    rotatorText.textContent = REMEMBER[0];
    if (reduceMotion.matches) return;
    const tick = () => {
      rotator.classList.add('is-out');
      later(() => {
        i = (i + 1) % REMEMBER.length;
        rotatorText.textContent = REMEMBER[i];
        rotator.classList.replace('is-out', 'is-in');
        rotator.offsetWidth; // commit the start position before easing in
        rotator.classList.remove('is-in');
        later(tick, 2200);
      }, 240);
    };
    later(tick, 2400);
  }

  /* 4 · Lava texts first — typing dots, then the messages land one by one */

  const thread = document.getElementById('thread');
  const typingDots = thread.querySelector('.pre-typing');
  const bubbles = [...thread.querySelectorAll('.pre-bubble')];
  const replies = document.getElementById('replies');

  function playThread() {
    bubbles.forEach((b) => b.classList.remove('is-shown'));
    typingDots.classList.remove('is-shown');
    replies.classList.remove('is-shown');
    if (reduceMotion.matches) {
      bubbles.forEach((b) => b.classList.add('is-shown'));
      replies.classList.add('is-shown');
      return;
    }
    let t = 350;
    bubbles.forEach((b) => {
      later(() => typingDots.classList.add('is-shown'), t);
      t += Number(b.dataset.delay);
      later(() => {
        typingDots.classList.remove('is-shown');
        b.classList.add('is-shown');
      }, t);
      t += 280;
    });
    later(() => replies.classList.add('is-shown'), t + 150);
  }

  /* Switching screens */

  function setScreen(value) {
    screenTimers.forEach(clearTimeout);
    screenTimers = [];
    const isPre = value !== 'agents';
    phone.dataset.screen = isPre ? 'pre' : 'agents';
    if (isPre) phone.dataset.pre = value;
    screenPicker.querySelectorAll('button').forEach((b) =>
      b.setAttribute('aria-checked', String(b.dataset.screen === value))
    );
    try { localStorage.setItem(SCREEN_KEY, value); } catch {}
    phone.dispatchEvent(new CustomEvent('lava:screen', { detail: value })); // recap.js listens

    input.value = '';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    const variant = isPre ? pre.querySelector(`.pre-variant[data-v="${value}"]`) : null;
    input.placeholder = variant ? variant.dataset.placeholder : DEFAULT_PLACEHOLDER;
    if (!variant) return;

    if (value === '5' && phone.dataset.bg !== 'vent') setBgStyle('vent');
    selectAgent(1); // no agent picked yet: start from the lava brand colour
    variant.classList.remove('is-entering');
    variant.offsetWidth; // restart the entry animation
    variant.classList.add('is-entering');
    if (value === '2') startRotator();
    if (value === '4') playThread();
  }

  screenPicker.addEventListener('mousedown', (e) => e.preventDefault()); // keep the input focused
  screenPicker.addEventListener('click', (e) => {
    const b = e.target.closest('button[data-screen]');
    if (b) setScreen(b.dataset.screen);
  });

  // ←/→ cycle through the screens while comparing
  document.addEventListener('keydown', (e) => {
    if (!e.altKey || (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight')) return;
    const values = [...screenPicker.querySelectorAll('button')].map((b) => b.dataset.screen);
    const current = phone.dataset.screen === 'pre' ? phone.dataset.pre : 'agents';
    setScreen(values[mod(values.indexOf(current) + (e.key === 'ArrowRight' ? 1 : -1), values.length)]);
  });

  let savedScreen = null;
  try { savedScreen = localStorage.getItem(SCREEN_KEY); } catch {}
  setScreen(screenPicker.querySelector(`[data-screen="${savedScreen}"]`) ? savedScreen : '5');

  /* ───────────── Init ───────────── */

  setShift(false);
  setActive(active, true);
  renderRing();
  input.focus({ preventScroll: true });

  // The voice glyph listens for 2 seconds when the screen is shown. Then each pill finishes its current
  // cycle (keyframes end at rest), so the glyph eases back into its default shape with no jump.
  // Restartable: lockscreen.html reveals this page later than it loads, so it calls Lava.listen() on reveal.
  const voiceBtn = document.querySelector('.voice');
  const reduceListen = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let listenTimer = 0;
  function listen() {
    if (!voiceBtn || reduceListen) return;
    const pills = [...voiceBtn.querySelectorAll('.voice-pill')];
    clearTimeout(listenTimer);
    pills.forEach((pill) => pill.classList.remove('is-settled'));
    voiceBtn.classList.remove('is-listening');
    void voiceBtn.offsetWidth; // restart the pills' animations from their first frame
    voiceBtn.classList.add('is-listening');
    listenTimer = setTimeout(() => {
      let left = pills.length;
      pills.forEach((pill) => {
        pill.addEventListener('animationiteration', () => {
          pill.classList.add('is-settled');
          if (--left === 0) voiceBtn.classList.remove('is-listening');
        }, { once: true });
      });
    }, 2000);
  }
  // held dark behind the lock screen (?hold): wait to be revealed instead of playing unseen
  if (!document.documentElement.classList.contains('lock-hold')) listen();

  // Small surface for recap.js (the after-chat sequence on the agent switcher)
  window.Lava = {
    phone,
    input,
    setKeyboard,
    selectAgent,
    listen,
    get active() { return active; },
    // agent i's name treatment for other text (its status): an SVG in the current name style,
    // or null for the plain "Original" labels, whose colour is nameColor(i)
    nameGraphic: (text, i) => (phone.dataset.name === 'original' ? null : nameGraphic(text, i, phone.dataset.name)),
    nameColor: (i) => toHex(nameInk(themeRgb(i))),
  };
})();
