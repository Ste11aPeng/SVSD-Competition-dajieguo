/* Page transition: chat ⇄ Memories (insights / calendar), with no black frame in between.
   The chat page never unloads. Memories is loaded quietly in a frame on top of it (insights.html?standby),
   fully rendered and waiting, so opening it is a pure dissolve: the whole frame, content and all, fades in while it
   rises 16px into place (the frame is never empty, so the screen never dips darker than either page); the chat's state
   (the conversation, the field) is untouched, so coming back finds it exactly where you left it. Going back is the
   same in reverse.
   The corner button sits in the same spot (24, 60) on both pages, so it never moves: only its glyph swaps.
   ~240ms for the dissolve, under 600ms for everything to settle; transform / opacity / a touch of blur through the
   Web Animations API. Opened on its own (no chat behind it), Memories falls back to a normal page change with the
   same choreography, holding the next page dark until its animations are queued. */
(() => {
  const KEY = 'pt.dir';
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const OUT = 'cubic-bezier(0.23, 1, 0.32, 1)';
  const DRAWER = 'cubic-bezier(0.32, 0.72, 0, 1)';
  const onChat = !!document.getElementById('phone');
  const standby = !onChat && /[?&]standby\b/.test(location.search) && parent !== window; // Memories, preloaded under the chat

  // Critically damped spring sampled into a CSS linear() easing
  function spring(omega, ms, n) {
    n = n || 40;
    const pts = [];
    for (let i = 0; i <= n; i++) { const t = (i / n) * ms / 1000; pts.push((1 - (1 + omega * t) * Math.exp(-omega * t)).toFixed(4)); }
    pts[0] = '0'; pts[n] = '1';
    return 'linear(' + pts.join(', ') + ')';
  }
  function play(el, frames, opt) {
    if (!el) return null;
    // a lone keyframe is the END state in WAAPI, so a 'from' keyframe is paired with an empty one (= the element's own style)
    const an = el.animate(Array.isArray(frames) ? frames : [frames, {}], Object.assign({ fill: 'both' }, opt));
    an.__pt = true;
    return an;
  }
  const all = (sel) => Array.from(document.querySelectorAll(sel));
  const one = (sel) => document.querySelector(sel);
  const fade = (d) => [{ opacity: 1, translate: '0 0', filter: 'blur(0px)' }, { opacity: 0, translate: '0 ' + d + 'px', filter: 'blur(4px)' }];
  const finish = (an) => { if (an) an.onfinish = () => an.cancel(); };
  const clearAnims = () => document.getAnimations().forEach((a) => { if (a.__pt) a.cancel(); });

  /* ───────────── Motion for each page ───────────── */

  // the chat's content settles down and dims (the background stays: it is what the dissolve happens over)
  function chatLeaves() {
    play(one('.memories .memories-icon'), [{ opacity: 1, scale: 1 }, { opacity: 0, scale: 0.7 }], { duration: 130, easing: OUT });
    play(one('.keyboard'), [{ translate: '0 0' }, { translate: '0 100%' }], { duration: 240, easing: DRAWER });
    all('.kb-material').forEach((el) => play(el, [{ opacity: 1 }, { opacity: 0 }], { duration: 140, easing: 'ease-out' }));
    play(one('.composer'), fade(12), { duration: 180, delay: 10, easing: OUT });
    all('.recap-stage, .pre').forEach((el) => play(el, fade(12), { duration: 190, delay: 25, easing: OUT }));
    all('.agents, .agent-labels, #fxLabels').forEach((el) => play(el, fade(8), { duration: 170, delay: 45, easing: OUT }));
  }
  function chatArrives(withBackground) {
    finish(play(one('.memories .memories-icon'), { opacity: 0, scale: 0.7 }, { duration: 340, delay: 90, easing: spring(18, 340) }));
    all('.agents, .agent-labels, #fxLabels').forEach((el) => finish(play(el, { opacity: 0, translate: '0 -8px', filter: 'blur(4px)' }, { duration: 380, delay: 40, easing: spring(16, 380) })));
    all('.recap-stage, .pre').forEach((el) => finish(play(el, { opacity: 0, translate: '0 14px', filter: 'blur(4px)' }, { duration: 400, delay: 90, easing: spring(16, 400) })));
    finish(play(one('.composer'), { opacity: 0, translate: '0 16px', filter: 'blur(3px)' }, { duration: 400, delay: 130, easing: spring(16, 400) }));
    finish(play(one('.keyboard'), { translate: '0 100%' }, { duration: 420, delay: 60, easing: DRAWER }));
    all('.kb-material').forEach((el) => finish(play(el, { opacity: 0 }, { duration: 300, delay: 180, easing: 'ease-out' })));
    if (withBackground) all('.bg, .bg-kbtint').forEach((el) => finish(play(el, { opacity: 0 }, { duration: 520, delay: 40, easing: 'ease-out' })));
  }
  function memoriesLeaves() {
    play(one('.chatbtn svg'), [{ opacity: 1, scale: 1 }, { opacity: 0, scale: 0.7 }], { duration: 130, easing: OUT });
    play(one('.seg2'), [{ opacity: 1, translate: '0 0' }, { opacity: 0, translate: '10px 0' }], { duration: 150, easing: OUT });
    play(one('.scroller'), fade(14), { duration: 190, delay: 15, easing: OUT });
    play(one('.sticky'), [{ opacity: 1 }, { opacity: 0 }], { duration: 170, easing: 'ease-out' });
    all('.sb').forEach((el) => play(el, [{ opacity: 1 }, { opacity: 0 }], { duration: 200, easing: 'ease-out' }));
  }
  function memoriesArrives() {
    finish(play(one('.chatbtn svg'), { opacity: 0, scale: 0.7 }, { duration: 340, delay: 90, easing: spring(18, 340) }));
    finish(play(one('.scroller'), { opacity: 0, translate: '0 22px', filter: 'blur(6px)' }, { duration: 480, delay: 60, easing: spring(14, 480) }));
    finish(play(one('.seg2'), { opacity: 0, translate: '14px 0' }, { duration: 380, delay: 120, easing: spring(16, 380) }));
    finish(play(one('.sticky'), { opacity: 0 }, { duration: 300, delay: 80, easing: 'ease-out' }));
    all('.sb').forEach((el) => finish(play(el, { opacity: 0 }, { duration: 520, delay: 60, easing: 'ease-out' })));
  }

  /* ───────────── Chat page: Memories waits in a frame on top ───────────── */
  let memFrame = null, memReady = false, memOpen = false;
  function preloadMemories() {
    const phone = document.getElementById('phone');
    if (!phone) return;
    memReady = false; memOpen = false;
    if (memFrame) memFrame.remove();
    memFrame = document.createElement('iframe');
    memFrame.className = 'mem-frame';
    memFrame.title = 'Memories';
    memFrame.tabIndex = -1;
    memFrame.setAttribute('aria-hidden', 'true');
    Object.assign(memFrame.style, { position: 'absolute', inset: '0', width: '100%', height: '100%', border: '0', zIndex: '3100',
      background: 'transparent', colorScheme: 'normal', visibility: 'hidden', pointerEvents: 'none' });
    phone.appendChild(memFrame);
    memFrame.src = 'insights.html?standby';
  }
  function openMemories() {
    memOpen = true;
    memFrame.style.visibility = 'visible';
    memFrame.style.pointerEvents = 'auto';
    memFrame.removeAttribute('aria-hidden');
    if (reduce) play(memFrame, [{ opacity: 0 }, { opacity: 1 }], { duration: 160, easing: 'ease-out' }).onfinish = function () { this.cancel(); };
    else {
      // the frame rises in as one piece; the chat underneath eases down (its keyboard drops) and stays opaque until covered
      finish(play(memFrame, [{ opacity: 0, translate: '0 16px' }, { opacity: 1, translate: '0 0' }], { duration: 260, easing: OUT }));
      play(one('.keyboard'), [{ translate: '0 0' }, { translate: '0 100%' }], { duration: 260, easing: DRAWER });
      all('.recap-stage, .pre, .composer').forEach((el) => play(el, [{ translate: '0 0' }, { translate: '0 10px' }], { duration: 260, easing: OUT }));
    }
    memFrame.contentWindow.postMessage('pt-start', '*');
    memFrame.focus();
  }
  function closeMemories() {
    if (!memOpen) return;
    memOpen = false;
    clearAnims();                       // the chat is back to rest under the frame, ready to be revealed
    if (!reduce) {
      // ...and eases up into place as the frame lets go (the keyboard rises on its drawer curve)
      finish(play(one('.keyboard'), { translate: '0 100%' }, { duration: 320, easing: DRAWER }));
      all('.recap-stage, .pre, .composer').forEach((el) => finish(play(el, { translate: '0 10px' }, { duration: 320, easing: OUT })));
    }
    memFrame.style.pointerEvents = 'none';
    const out = play(memFrame, reduce ? [{ opacity: 1 }, { opacity: 0 }] : [{ opacity: 1, translate: '0 0' }, { opacity: 0, translate: '0 12px' }],
      { duration: reduce ? 160 : 240, easing: OUT });
    out.onfinish = () => { out.cancel(); preloadMemories(); }; // a fresh one, back at the top, ready for next time
  }
  if (onChat) {
    addEventListener('message', (e) => {
      if (!memFrame || e.source !== memFrame.contentWindow) return;
      if (e.data === 'mem-ready') memReady = true;
      if (e.data === 'pt-back') closeMemories();
    });
    addEventListener('load', () => setTimeout(preloadMemories, 1800));
  }

  /* ───────────── Called by flow.js when you tap Memories / the chat button ───────────── */
  function exit() {
    // ready behind the chat: a dissolve, no page change (-1 tells flow.js to stay put)
    if (onChat && memReady && memFrame) { openMemories(); return -1; }
    // Memories embedded in the chat: tell the chat to take over (the dissolve is the chat's to play)
    if (standby) { parent.postMessage('pt-back', '*'); return -1; }

    // otherwise a real page change, with the same motion on each side
    try { sessionStorage.setItem(KEY, JSON.stringify({ dir: onChat ? 'toMemories' : 'toChat', at: Date.now() })); } catch (e) {}
    window.__skipVT = true; // this choreography replaces the browser's page crossfade
    if (reduce) { play(document.body, [{ opacity: 1 }, { opacity: 0 }], { duration: 120, easing: 'ease-out' }); return 130; }
    if (onChat) {
      chatLeaves();
      // no dissolve to hide it: the coloured background settles to black with the content, so the dark page takes over without a cut
      all('.bg, .bg-kbtint').forEach((el) => play(el, [{}, { opacity: 0 }], { duration: 230, easing: 'cubic-bezier(0.4, 0, 0.2, 1)' }));
      return 230;
    }
    memoriesLeaves();
    return 220;
  }

  /* ───────────── Arriving on a freshly loaded page ───────────── */
  function enter() {
    const root = document.documentElement;
    const release = () => root.classList.remove('pt-hold');
    const ready = () => (onChat ? one('.composer') && one('.keyboard') : one('#dc-root main .scroller') && one('.chatbtn'));
    const whenReady = (cb) => { let tries = 0; (function wait() { if (ready()) return cb(); if (tries++ < 120) requestAnimationFrame(wait); else release(); })(); };

    if (standby) {
      // preloaded under the chat: say when rendered, then wait to be shown
      whenReady(() => parent.postMessage('mem-ready', '*'));
      addEventListener('message', (e) => {
        if (e.data !== 'pt-start') return;
        // nothing is held back here: the frame itself is dissolving in, so only the corner glyph gets its swap
        if (!reduce) finish(play(one('.chatbtn svg'), { opacity: 0, scale: 0.7 }, { duration: 340, delay: 60, easing: spring(18, 340) }));
      });
      return;
    }

    let seen = null;
    try { seen = JSON.parse(sessionStorage.getItem(KEY) || 'null'); sessionStorage.removeItem(KEY); } catch (e) {}
    if (!seen || seen.dir !== (onChat ? 'toChat' : 'toMemories') || Date.now() - seen.at > 5000) { release(); return; }
    setTimeout(release, 2500); // never leave the page held if something goes wrong
    whenReady(() => {
      if (reduce) { release(); play(document.body, { opacity: 0 }, { duration: 200, easing: 'ease-out' }); return; }
      if (onChat) chatArrives(true); else memoriesArrives();
      release(); // animations are queued with fill: both, so nothing flashes between hold and play
    });
  }

  window.PageTransition = { exit };
  // returning with the back button should not find the page half-left
  addEventListener('pageshow', (e) => { if (e.persisted) clearAnims(); });
  const go = () => { if (onChat || document.body.dataset.page === 'insights') enter(); };
  if (document.body && (onChat || document.body.dataset.page === 'insights')) go();
  else document.addEventListener('DOMContentLoaded', go);
})();
