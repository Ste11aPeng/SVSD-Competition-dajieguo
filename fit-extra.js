/* Home-screen app on iPhone: the app runs from the top edge to the bottom edge of the screen, but iOS
   reports a layout height (100dvh / innerHeight) that stops short of the bottom, which left a black
   strip there. This works out how much is missing and exposes it as
   --fx, so the frames can run all the way down. Elsewhere --fx stays 0.
   Triple-tap the top of the screen to show the numbers the phone reports (for tuning). */
window.FitExtra = (() => {
  const standalone = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
  function safe(side) {
    const p = document.createElement('div');
    p.style.cssText = `position:fixed;left:0;top:0;visibility:hidden;pointer-events:none;padding-top:env(safe-area-inset-${side})`;
    document.documentElement.appendChild(p); const v = p.offsetHeight; p.remove(); return v;
  }
  function cssHeight(unit) {
    const p = document.createElement('div');
    p.style.cssText = `position:fixed;left:0;top:0;width:1px;visibility:hidden;pointer-events:none;height:100${unit}`;
    document.documentElement.appendChild(p); const v = p.getBoundingClientRect().height; p.remove(); return v;
  }
  function extra() {
    if (window !== window.top || !standalone()) return 0;
    // Measured on an iPhone 16 Pro home-screen app: screen 874pt tall, but dvh / innerHeight 798:
    // iOS sizes the page as if the status bar (62) and home indicator area were cut off, while the app
    // really runs from the top edge to the bottom edge. So the missing strip is screen minus dvh.
    const sh = Math.max(screen.height, screen.width);
    return Math.max(0, Math.min(140, Math.round(sh - cssHeight('dvh'))));
  }
  function apply() {
    const fx = extra();
    document.documentElement.style.setProperty('--fx', fx + 'px');
    const tag = document.getElementById('fit-debug');
    if (tag) tag.textContent =
      `screen ${screen.width}x${screen.height}\ninner ${innerWidth}x${innerHeight}\nclient ${document.documentElement.clientWidth}x${document.documentElement.clientHeight}\n` +
      `dvh ${cssHeight('dvh').toFixed(1)} lvh ${cssHeight('lvh').toFixed(1)} svh ${cssHeight('svh').toFixed(1)}\n` +
      `safe top ${safe('top')} bottom ${safe('bottom')}\nstandalone ${standalone()}  --fx ${fx}`;
    return fx;
  }
  // triple-tap the top 70px to toggle the numbers
  let taps = [];
  addEventListener('pointerdown', e => {
    if (e.clientY > 70) return;
    const now = performance.now(); taps = taps.filter(t => now - t < 700); taps.push(now);
    if (taps.length < 3) return;
    taps = [];
    let tag = document.getElementById('fit-debug');
    if (tag) { tag.remove(); return; }
    tag = document.createElement('div'); tag.id = 'fit-debug';
    tag.style.cssText = 'position:fixed;left:8px;top:80px;z-index:99999;font:11px/1.35 ui-monospace,monospace;color:#0f0;background:rgba(0,0,0,.8);padding:8px;border-radius:8px;pointer-events:none;white-space:pre';
    document.body.appendChild(tag); apply();
  }, true);
  addEventListener('resize', apply); addEventListener('orientationchange', apply); addEventListener('pageshow', apply);
  apply();
  return { apply };
})();
