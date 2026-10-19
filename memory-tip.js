/* Memories tooltip: a quiet "memory saved" note that grows out of the Memories button (top left).
   It says "Saved to memories" (glass style; the chip and whisper variants are still here, via MemoryTip.choose({ style })).
   window.MemoryTip.show() plays it, and it plays by itself after a call ends (voice-transition.js), since that is when a
   memory gets saved. The tooltip and the button's own nod start together. */
(() => {
  const phone = document.getElementById('phone');
  const button = phone && phone.querySelector('.memories');
  if (!button) return;

  const STYLES = ['glass', 'chip', 'whisper'];
  const COPY = ['Memory saved', 'I’ll remember this', 'Saved to memories']; // the explored wordings
  const DETAIL = 'Package stolen · just now';
  const OUT = 'cubic-bezier(0.23, 1, 0.32, 1)';
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let style = 'glass'; // the saved-to-memories note is fixed to the glass style
  const copy = 2; // "Saved to memories"

  // the Memories glyph's own star, reused so the tooltip speaks the button's language
  const starPath = (button.querySelector('.memories-star') || {}).getAttribute ? button.querySelector('.memories-star').getAttribute('d') : '';
  function star(cls) {
    const ns = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('viewBox', '13.4 4.7 5.3 5.3');
    svg.setAttribute('class', cls);
    svg.setAttribute('aria-hidden', 'true');
    const p = document.createElementNS(ns, 'path');
    p.setAttribute('d', starPath);
    svg.appendChild(p);
    return svg;
  }

  function build() {
    const el = document.createElement('div');
    el.className = 'mt mt--' + style;
    el.setAttribute('role', 'status');
    const text = COPY[copy];
    if (style === 'glass') {
      el.append(Object.assign(document.createElement('span'), { textContent: text }));
    } else if (style === 'chip') {
      const lines = document.createElement('span');
      lines.className = 'mt-lines';
      lines.append(Object.assign(document.createElement('b'), { textContent: text }), Object.assign(document.createElement('small'), { textContent: DETAIL }));
      el.append(Object.assign(document.createElement('span'), { className: 'mt-dot' }), lines);
    } else {
      const fx = window.NameEffects ? NameEffects.render('vibe', text, { height: 12.5 }) : Object.assign(document.createElement('span'), { textContent: text });
      el.setAttribute('aria-label', text);
      el.append(fx);
    }
    return el;
  }

  // the button answers: its star turns and the glyph warms to gold for a moment
  function nod() {
    if (reduce) return;
    const s = button.querySelector('.memories-star'), icon = button.querySelector('.memories-icon');
    if (s) s.animate([{ scale: 1, rotate: '0deg' }, { scale: 1.6, rotate: '45deg', offset: 0.4 }, { scale: 1, rotate: '90deg' }], { duration: 640, easing: OUT });
    if (icon) icon.animate([{ filter: 'grayscale(1) brightness(0.95)' }, { filter: 'grayscale(0) brightness(1.1)', offset: 0.3 }, { filter: 'grayscale(1) brightness(0.95)' }], { duration: 1100, easing: 'ease-out' });
  }

  // style 3: a gold spark leaves the words and drops into the button
  function spark(from) {
    const pr = phone.getBoundingClientRect(), k = pr.width / phone.offsetWidth || 1;
    const f = from.getBoundingClientRect(), b = button.getBoundingClientRect();
    const sx = (f.right - pr.left) / k - 6, sy = (f.top + f.height / 2 - pr.top) / k - 5;
    const bx = (b.left + b.width * 0.66 - pr.left) / k - 5, by = (b.top + b.height * 0.3 - pr.top) / k - 5;
    const el = star('mt-spark');
    Object.assign(el.style, { left: sx + 'px', top: sy + 'px' });
    phone.appendChild(el);
    el.animate([
      { translate: '0 0', scale: 0.4, opacity: 0 },
      { translate: '0 -6px', scale: 1, opacity: 1, offset: 0.25 },
      { translate: (bx - sx) + 'px ' + (by - sy) + 'px', scale: 0.5, opacity: 0.9 }
    ], { duration: 620, easing: 'cubic-bezier(0.65, 0, 0.35, 1)', fill: 'forwards' }).onfinish = () => el.remove();
  }

  let cur = null, hideT = 0, expected = false, expectT = 0;
  // Something else (the agents' glow, in recap.js) waits for the tooltip to be gone: `expect()` says one is
  // coming (a call just ended); 'memorytip:done' fires once it has left, or after 6s if it never shows.
  function done() { expected = false; clearTimeout(expectT); window.dispatchEvent(new Event('memorytip:done')); }
  function expect() { expected = true; clearTimeout(expectT); expectT = setTimeout(done, 6000); }
  // Enter (with the button's nod, same instant): the tooltip is drawn out of the button's side, a clip opening
  // left to right on a strong ease-out while it settles from 97% and fades up; its words follow a beat later.
  // Exit, quicker than the way in: it folds back toward the button and fades, 200ms on the same ease-out.
  const R = { glass: 16, chip: 14, whisper: 0 };
  const clip = (right) => 'inset(0 ' + right + '% 0 0 round ' + R[style] + 'px)';
  function hide(el) {
    if (!el) return;
    const a = el.animate(reduce ? [{ opacity: 1 }, { opacity: 0 }]
      : [{ opacity: 1, clipPath: clip(0), translate: '0 0' }, { opacity: 0, clipPath: clip(55), translate: '-6px 0' }],
      { duration: reduce ? 120 : 200, easing: OUT, fill: 'forwards' });
    a.onfinish = () => { el.remove(); if (!cur) done(); };
  }
  function show() {
    clearTimeout(hideT);
    if (cur) { cur.remove(); cur = null; }
    const el = cur = build();
    phone.appendChild(el);
    if (reduce) el.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 160, easing: 'ease-out' });
    else {
      el.animate([{ clipPath: clip(100), scale: 0.97, opacity: 0.4 }, { clipPath: clip(0), scale: 1, opacity: 1 }], { duration: 320, easing: OUT });
      Array.from(el.children).forEach(c => c.animate([{ opacity: 0, translate: '-4px 0' }, { opacity: 1, translate: '0 0' }], { duration: 240, delay: 70, easing: OUT, fill: 'backwards' }));
    }
    nod(); // the button answers in the same moment the tooltip starts
    if (style === 'whisper') setTimeout(() => { if (cur === el) spark(el); }, 380);
    hideT = setTimeout(() => { if (cur === el) { hide(el); cur = null; } }, 2600);
  }
  function choose(next) {
    if (next.style && STYLES.includes(next.style)) { style = next.style; }
    if (next.show) show();
  }

  window.MemoryTip = { show, choose, expect, get pending() { return expected || !!cur; } };
})();
