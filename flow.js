/* Links the screens into one flow:
   chat (index.html) ─ Memories ─▶ insights.html ─ chat button ─▶ back
   chat (index.html) ─ voice orb ─▶ call.html ─ end call ─▶ chat stage of index.html */
(function () {
  // [selector, page, when (optional), before leaving (optional)]
  const ROUTES = [
    // each plays its leaving choreography (page-transition.js) and returns how long to wait before changing page
    ['.memories', 'insights.html', null, () => (window.PageTransition ? window.PageTransition.exit() : 0)],
    // the orb is Talk only while the field is empty; with text in it, it sends
    // ... and its before-hook plays the exit choreography (voice-transition.js) and returns how long to wait
    ['.voice', 'call.html', () => { const i = document.getElementById('message'); return !(i && i.value.trim()); },
      () => (window.VoiceTransition ? window.VoiceTransition.exit() : 0)],
    ['.chatbtn', 'index.html', null, () => (window.PageTransition ? window.PageTransition.exit() : 0)],
    // hanging up lands on the chat stage, where the after-call conversation picks up
    // (a call preloaded inside the vent page hands back to it instead; -1 means "don't navigate")
    ['[aria-label="End call"]', 'index.html', null, () => {
      if (window.__standby && parent !== window) { parent.postMessage('call-ended', '*'); return -1; }
      try { localStorage.setItem('hc.stage', 'chat'); } catch (e) {}
    }]
  ];
  let leaving = false;
  const crossfades = 'onpagereveal' in window;
  function go(href, wait) {
    if (leaving || wait < 0) return;
    leaving = true;
    if (wait) { setTimeout(() => { location.href = href; }, wait); return; }
    if (crossfades) { location.href = href; return; }
    document.body.style.transition = 'opacity .12s ease';
    document.body.style.opacity = '0';
    setTimeout(() => { location.href = href; }, 120);
  }
  document.addEventListener('click', e => {
    for (const [sel, href, when, before] of ROUTES) {
      if (!e.target.closest(sel) || (when && !when())) continue;
      e.preventDefault(); e.stopPropagation();
      go(href, before ? before() : 0); return;
    }
  }, true);
  // The voice move has its own choreography, so the browser's page crossfade steps aside
  addEventListener('pageswap', e => { if (window.__skipVT && e.viewTransition) e.viewTransition.skipTransition(); });
  // Records whether the browser crossfaded into this page (handy when checking the flow)
  addEventListener('pagereveal', e => { window.__crossfaded = !!e.viewTransition; });
  // Coming back with the browser's back button should not leave the page faded out
  window.addEventListener('pageshow', () => { leaving = false; document.body.style.opacity = ''; });
  // Small phones: scale the fixed 402×874 frame to fit
  const standalone = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
  function safeTop() {
    const probe = document.createElement('div');
    probe.style.cssText = 'position:fixed;top:0;left:0;visibility:hidden;pointer-events:none;padding-top:env(safe-area-inset-top)';
    document.documentElement.appendChild(probe);
    const v = probe.offsetHeight; probe.remove(); return v;
  }
  // The screen the page really gets. iOS can report a layout viewport shorter than the screen when the
  // page runs under the status bar (home-screen app), so take the largest honest measure, never more than the screen.
  function viewport() {
    const de = document.documentElement, vv = window.visualViewport;
    const vw = de.clientWidth;
    let vh = Math.max(de.clientHeight, window.innerHeight || 0, vv ? vv.height : 0);
    if (standalone() && screen.height > screen.width) vh = Math.max(vh, screen.height);
    return [vw, Math.min(vh, Math.max(screen.height, screen.width))];
  }
  function fit() {
    const [vw, vh] = viewport();
    const root = document.documentElement.style;
    if (matchMedia('(pointer: coarse)').matches) {
      // phone: fill the width; the frame's height becomes whatever the screen has room for
      const s = vw / 402;
      // Both ways of opening put the content at the same place: just under the phone's status bar,
      // with the design's 54px status strip trimmed to 10px of air.
      // Safari: the page already starts under the status bar, so lift 44px of the strip off.
      // Home-screen app: the page starts at the very top, behind the status bar, so first push it
      // down by the status bar's height (the safe-area inset; 54 if the phone does not report one).
      // Inside the lock screen's frame: as is.
      let fy = 0;
      if (window === window.top) {
        const safe = safeTop(), underBar = safe > 0 || standalone();
        fy = (underBar ? (safe > 0 ? safe : 54) : 0) - 44 * s;
      }
      root.setProperty('--fit', s); root.setProperty('--fh', ((vh - fy) / s) + 'px'); root.setProperty('--fy', fy + 'px');
      // ?debug shows what the phone reported, for tuning on a real device
      if (/[?&]debug\b/.test(location.search)) {
        let tag = document.getElementById('fit-debug');
        if (!tag) { tag = document.createElement('div'); tag.id = 'fit-debug'; tag.style.cssText = 'position:fixed;left:8px;bottom:8px;z-index:99999;font:11px/1.3 monospace;color:#0f0;background:rgba(0,0,0,.7);padding:6px;border-radius:6px;pointer-events:none;white-space:pre'; document.body.appendChild(tag); }
        tag.textContent = `client ${document.documentElement.clientWidth}x${document.documentElement.clientHeight}\ninner ${innerWidth}x${innerHeight}\nscreen ${screen.width}x${screen.height}\nsafeTop ${safeTop()} standalone ${standalone()}\nfit ${s.toFixed(3)} fy ${fy.toFixed(1)} vh ${vh}`;
      }
    } else {
      root.setProperty('--fit', Math.min(1, vw / 402, vh / 874));
    }
  }
  addEventListener('resize', fit); addEventListener('orientationchange', fit); addEventListener('pageshow', fit); fit();
  if (window.visualViewport) visualViewport.addEventListener('resize', fit);

  // iOS status bar and home indicator, drawn inside the phone frame on every screen
  (function chrome() {
    const frame = document.querySelector('.phone') || document.querySelector('#dc-root > main');
    if (!frame || frame.querySelector('.ios-status')) return;
    if (!document.querySelector('link[href="ios-chrome.css"]')) {
      const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = 'ios-chrome.css'; document.head.appendChild(l);
    }
    const bar = document.createElement('div');
    bar.className = 'ios-status';
    bar.setAttribute('aria-hidden', 'true');
    bar.innerHTML = '<span class="ios-time">9:41</span><i class="ios-island"></i><span class="ios-icons">' +
      '<svg width="19" height="12" viewBox="0 0 19 12"><rect x="0" y="7.5" width="3.2" height="4.5" rx="1" fill="#fff"/><rect x="5.1" y="5" width="3.2" height="7" rx="1" fill="#fff"/><rect x="10.2" y="2.5" width="3.2" height="9.5" rx="1" fill="#fff"/><rect x="15.3" y="0" width="3.2" height="12" rx="1" fill="#fff"/></svg>' +
      '<svg width="17" height="12" viewBox="0 0 17 12"><path d="M8.5 2.4c2.3 0 4.4.9 6 2.4l1.2-1.2C13.8 1.7 11.3.7 8.5.7S3.2 1.7 1.3 3.6l1.2 1.2c1.6-1.5 3.7-2.4 6-2.4Z" fill="#fff"/><path d="M8.5 5.7c1.4 0 2.6.5 3.6 1.4l1.2-1.2C12 4.7 10.3 4 8.5 4S5 4.7 3.7 5.9l1.2 1.2c1-.9 2.2-1.4 3.6-1.4Z" fill="#fff"/><path d="M8.5 9c.6 0 1.1.2 1.5.6L8.5 11.2 7 9.6c.4-.4.9-.6 1.5-.6Z" fill="#fff"/></svg>' +
      '<svg width="27" height="13" viewBox="0 0 27 13"><rect x=".5" y=".5" width="23" height="12" rx="3.8" fill="none" stroke="#fff" stroke-opacity=".38"/><rect x="2" y="2" width="20" height="9" rx="2.5" fill="#fff"/><path d="M25 4.3v4.4c.9-.3 1.5-1.2 1.5-2.2s-.6-1.9-1.5-2.2Z" fill="#fff" fill-opacity=".45"/></svg>' +
      '</span>';
    const home = document.createElement('i');
    home.className = 'ios-home';
    home.setAttribute('aria-hidden', 'true');
    // no status bar and no home indicator on any screen
    void bar; void home;
  })();
})();
