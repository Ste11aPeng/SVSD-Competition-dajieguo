/* Voice transition: "Ready to vent?" → call.
   Tap the voice button: black grows out of the button as a soft-edged circle that darkens from 0% to 100%
   as it opens, so the page shows through it before it settles to full black. The call
   page is already loaded and rendered in a hidden frame on top (see "the call, preloaded" below), so it
   comes up the moment the wash lands, with no page load in between. The disc is the same near-black as the call page, so the hand-off shows no seam.
   Transform / opacity / clip-path only, through the Web Animations API (off the main thread). */
(() => {
  const KEY = 'vt.voice';
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const OUT = 'cubic-bezier(0.23, 1, 0.32, 1)';
  const DRAWER = 'cubic-bezier(0.32, 0.72, 0, 1)';

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
    an.__vt = true;
    return an;
  }

  // A circle centred on the voice button, in the phone's own units: r0 is the button, R reaches every corner
  function circleFrom(phone, voice) {
    const W = phone.offsetWidth, H = phone.offsetHeight;
    const pr = phone.getBoundingClientRect(), vr = voice.getBoundingClientRect(), k = pr.width / W || 1;
    const cx = (vr.left - pr.left + vr.width / 2) / k, cy = (vr.top - pr.top + vr.height / 2) / k, r0 = vr.width / 2 / k;
    const R = Math.ceil(Math.hypot(Math.max(cx, W - cx), Math.max(cy, H - cy))) + 2;
    return { cx, cy, r0, R, at: (r) => 'circle(' + r + 'px at ' + cx + 'px ' + cy + 'px)' };
  }

  /* ───────────── Vent page: exit ───────────── */
  function exit() {
    const phone = document.getElementById('phone');
    if (!phone || !phone.querySelector('.voice')) return 0;
    try { sessionStorage.setItem(KEY, JSON.stringify({ at: Date.now() })); } catch (e) {}
    window.__skipVT = true; // our own choreography replaces the page crossfade

    if (reduce) { play(phone, [{ opacity: 1 }, { opacity: 0 }], { duration: 120, easing: 'ease-out' }); return 130; }

    const q = s => phone.querySelector(s);
    const voice = q('.voice');

    // black grows out of the button as a feathered circle that darkens as it spreads: its size and its darkness
    // share one curve, so it is clear at the button, half dark at half size, and full black once it covers the screen
    const { cx, cy, r0, R } = circleFrom(phone, voice);
    const disc = document.createElement('div');
    disc.className = 'vt-wash';
    disc.setAttribute('aria-hidden', 'true');
    Object.assign(disc.style, { opacity: '0' });
    disc.style.setProperty('--wash-x', cx + 'px');
    disc.style.setProperty('--wash-y', cy + 'px');
    phone.appendChild(disc);
    const GROW = 'cubic-bezier(0.65, 0, 0.35, 1)'; // ease-in-out: you see it leave the button, spread, and settle
    play(disc, [{ '--wash-r': r0 + 'px' }, { '--wash-r': (R + 100) + 'px' }], { duration: 380, easing: GROW });
    play(disc, [{ opacity: 0 }, { opacity: 1 }], { duration: 380, easing: GROW });
    // the call is already rendered underneath: bring it up as the wash lands, no page load in between
    if (callReady) {
      try { sessionStorage.removeItem(KEY); } catch (e) {}
      wash = [disc];
      setTimeout(() => {
        callFrame.style.visibility = 'visible';
        callFrame.style.pointerEvents = 'auto';
        callFrame.removeAttribute('aria-hidden');
        callFrame.contentWindow.postMessage('call-start', '*');
        callFrame.focus();
      }, 360);
      return -1; // flow.js: stay on this page
    }
    // not preloaded yet (a very quick tap): leave as the wash lands; the old page stays painted until the call is ready
    return 360;
  }

  /* ───────────── Vent page: the call, preloaded ───────────── */
  // A hidden frame holds the call page fully rendered but paused (call.html?standby), so tapping the voice
  // button reveals it with no load in between. Hanging up hands back here: the chat stage takes over
  // and the frame fades away, then quietly reloads for the next call.
  let callFrame = null, callReady = false, wash = [];
  function preloadCall() {
    const phone = document.getElementById('phone');
    if (!phone) return;
    callReady = false;
    if (!callFrame) {
      callFrame = document.createElement('iframe');
      callFrame.className = 'call-frame';
      callFrame.title = 'Voice call';
      callFrame.tabIndex = -1;
      Object.assign(callFrame.style, { position: 'absolute', inset: '0', width: '100%', height: '100%', border: '0', zIndex: '3000',
        background: 'transparent', colorScheme: 'normal' });
      phone.appendChild(callFrame);
    }
    callFrame.setAttribute('aria-hidden', 'true');
    Object.assign(callFrame.style, { visibility: 'hidden', pointerEvents: 'none', opacity: '1' });
    callFrame.src = 'call.html?standby' + (AUTO ? '&auto' : '');
  }
  // Ending the call runs the entry backwards: the chat stage is set up underneath, the call pulls back into a
  // circle that closes down onto the voice button (fast start, soft landing; exits run quicker than the 520ms way
  // in), the call fades as it lands, and the button gives a small settle as if it had taken the call back.
  function endCall() {
    if (window.MemoryTip) window.MemoryTip.expect(); // the agents' glow waits for the tooltip to finish
    const phone = document.getElementById('phone'), voice = phone.querySelector('.voice');
    try { localStorage.setItem('hc.stage', 'chat'); } catch (e) {}
    const stage = document.querySelector('#stagePicker [data-stage="chat"]');
    if (stage) stage.click();
    // undo the wash underneath so the chat is what the circle reveals
    document.getAnimations().forEach(a => { if (a.__vt) a.cancel(); });
    wash.forEach(el => el.remove()); wash = [];
    callFrame.style.pointerEvents = 'none';
    const done = () => { callFrame.getAnimations().forEach(a => a.cancel()); preloadCall(); };

    if (reduce || !voice) { play(callFrame, [{ opacity: 1 }, { opacity: 0 }], { duration: 200, easing: 'ease-out' }).onfinish = done; return; }
    const { r0, R, at } = circleFrom(phone, voice);
    const close = play(callFrame, [{ clipPath: at(R) }, { clipPath: at(r0) }], { duration: 420, easing: DRAWER });
    play(callFrame, [{ opacity: 1 }, { opacity: 1, offset: 0.55 }, { opacity: 0 }], { duration: 420, easing: 'cubic-bezier(0.4, 0, 0.2, 1)' });
    play(voice, [{ scale: 0.9 }, { scale: 1 }], { duration: 380, delay: 300, easing: spring(18, 380) }).onfinish = function () { this.cancel(); };
    close.onfinish = done;
    // what was said is now a memory: tell them, once the chat has settled
    setTimeout(() => window.MemoryTip && window.MemoryTip.show(), 900);
  }

  addEventListener('message', e => {
    if (!callFrame || e.source !== callFrame.contentWindow) return;
    if (e.data === 'call-ready') callReady = true;
    if (e.data === 'call-ended') endCall();
  });

  /* ───────────── Call page: enter ───────────── */
  function enter() {
    if (window.__standby) { addEventListener('message', e => { if (e.data === 'call-start') begin(); }); return; }
    begin();
  }
  function begin() {
    const root = document.documentElement;
    try { sessionStorage.removeItem(KEY); } catch (e) {}
    const release = () => root.classList.remove('cv-hold');
    setTimeout(release, 2500); // never leave the page held if something goes wrong

    let tries = 0;
    (function wait() {
      const main = document.querySelector('#dc-root main');
      if (main && main.querySelector('.floor') && main.querySelector('[role="toolbar"]')) return run(main);
      if (tries++ < 120) requestAnimationFrame(wait); else release();
    })();

    function run(main) {
      if (reduce) { release(); Array.from(main.children).forEach(k => play(k, { opacity: 0 }, { duration: 200, easing: 'ease-out' })); return; }
      const finish = an => { if (an) an.onfinish = () => an.cancel(); };

      // glow lifts from the floor straight away; aurora fades down from the top
      finish(play(main.querySelector('.floor'), { opacity: 0, translate: '0 60px', scale: '1 0.7' }, { duration: 420, easing: spring(16, 420) }));
      finish(play(main.querySelector('.aur'), { opacity: 0, translate: '0 -24px' }, { duration: 380, delay: 20, easing: OUT }));
      // state-driven labels, ring and reply settle in from their own resting style
      Array.from(main.children).forEach(k => {
        if (k.matches('.floor, .aur, [role="toolbar"], svg')) return;
        finish(play(k, { opacity: 0, translate: '0 6px', filter: 'blur(4px)' }, { duration: 300, delay: 20, easing: spring(22, 300) }));
      });
      // controls rise last, a beat apart
      Array.from(main.querySelectorAll('.ctl')).forEach((c, i) =>
        finish(play(c, { opacity: 0, translate: '0 16px', scale: 0.94, filter: 'blur(3px)' }, { duration: 320, delay: 40 + i * 30, easing: spring(20, 320) })));
      release(); // animations are queued with fill: both, so nothing flashes between hold and play
    }
  }

  window.VoiceTransition = { exit: exit };
  // returning with the back button should not find the page half-left
  addEventListener('pageshow', e => { if (e.persisted) document.getAnimations().forEach(a => { if (a.__vt) a.cancel(); }); });
  if (document.body && document.body.dataset.page === 'call') enter();
  else document.addEventListener('DOMContentLoaded', () => { if (document.body.dataset.page === 'call') enter(); });
  // Autoplay (?auto on this page, set by lockscreen.html): 4 seconds after the page is shown, tap the voice button;
  // the call page then ends the call by itself once the script has finished.
  const AUTO = /[?&]auto\b/.test(location.search);
  if (AUTO && document.getElementById('phone')) {
    const tap = () => setTimeout(() => { const v = document.querySelector('#phone .voice'); if (v) v.click(); }, 4000);
    let tapped = false; // other messages arrive too (call-ready), so only the first lock-play counts
    if (/[?&]hold\b/.test(location.search)) addEventListener('message', e => { if (e.data === 'lock-play' && !tapped) { tapped = true; tap(); } });
    else addEventListener('load', tap);
  }
  // on the vent page, preload the call once the page itself has settled
  if (document.getElementById('phone')) addEventListener('load', () => setTimeout(preloadCall, 1200));
})();
