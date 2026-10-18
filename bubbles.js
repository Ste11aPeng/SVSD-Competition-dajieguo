/* Chat bubble explorations: a short thread on screen 6, restyled by the "Chat bubble" picker.
   Every style change (or opening the screen) replays the thread so each style's entrance shows. */
(() => {
  const phone = document.getElementById('phone');
  const chat = document.getElementById('chat');
  const picker = document.getElementById('bubblePicker');
  if (!phone || !chat || !picker) return;

  const KEY = 'lava.bubbleStyle.v3';
  const bubbles = [...chat.querySelectorAll('.cb')];
  let timers = [];

  // Runs of messages from the same person: first / mid / last / solo, so their corners can tuck together
  bubbles.forEach((b, i) => {
    const same = (o) => o && o.dataset.from === b.dataset.from;
    const prev = same(bubbles[i - 1]);
    const next = same(bubbles[i + 1]);
    b.dataset.group = prev && next ? 'mid' : prev ? 'last' : next ? 'first' : 'solo';
  });

  // Shrink-wrap: a wrapped bubble is as wide as its longest line, with no empty band on the side.
  // Measured from layout (offsets), so words still animating in don't throw it off.
  function fit(bubble, words) {
    if (phone.dataset.bubble !== 'thread') { bubble.style.width = ''; return; }
    bubble.style.width = '';
    const cs = getComputedStyle(bubble);
    const padL = parseFloat(cs.paddingLeft);
    const padR = parseFloat(cs.paddingRight);
    // where the text starts, in the coordinates the words are measured in: the bubble itself,
    // a text box inside it (which starts at the content edge), or the parent the bubble shares
    const op = words[0] && words[0].offsetParent;
    const left = op === bubble ? padL : op && bubble.contains(op) ? 0 : bubble.offsetLeft + padL;
    // measure, shrink to the longest line, and repeat once more in case the lines re-flowed
    for (let pass = 0; pass < 3; pass++) {
      let right = 0;
      words.forEach((w) => { right = Math.max(right, w.offsetLeft + w.offsetWidth); });
      if (!right) return;
      const width = Math.ceil(right - left + padL + padR + 1);
      if (width >= bubble.offsetWidth - 1) return;
      bubble.style.width = `${width}px`;
    }
  }
  function fitChat() {
    bubbles.forEach((b) => fit(b, [...b.querySelectorAll('.w')]));
  }

  // Thread: each bubble shows the slice of one thread-tall gradient where it sits
  function placeGradient() {
    const h = chat.clientHeight;
    bubbles.forEach((b) => {
      b.style.setProperty('--gh', `${h}px`);
      b.style.setProperty('--gy', `${b.offsetTop - chat.offsetTop}px`);
    });
  }
  addEventListener('resize', placeGradient);
  // the thread changes height when the keyboard folds or opens
  new MutationObserver(() => setTimeout(placeGradient, 420))
    .observe(phone, { attributes: true, attributeFilter: ['data-keyboard'] });

  // Wrap each word so styles can reveal text word by word (--wi is the word's index in its bubble)
  bubbles.forEach((b) => {
    const text = b.querySelector('.cb-text');
    let i = 0;
    const wrap = (node) => {
      [...node.childNodes].forEach((n) => {
        if (n.nodeType === Node.TEXT_NODE) {
          const frag = document.createDocumentFragment();
          n.textContent.split(/(\s+)/).forEach((part) => {
            if (!part) return;
            if (/^\s+$/.test(part)) { frag.append(part); return; }
            const w = document.createElement('span');
            w.className = 'w';
            w.style.setProperty('--wi', i++);
            w.textContent = part;
            frag.append(w);
          });
          n.replaceWith(frag);
        } else if (n.nodeType === Node.ELEMENT_NODE) {
          wrap(n);
        }
      });
    };
    wrap(text);
  });

  function play() {
    fitChat();
    placeGradient();
    timers.forEach(clearTimeout);
    timers = [];
    bubbles.forEach((b) => b.classList.remove('is-in'));
    chat.offsetWidth; // restart the entrances
    let t = 120;
    bubbles.forEach((b) => {
      timers.push(setTimeout(() => b.classList.add('is-in'), t));
      t += b.dataset.from === 'me' ? 380 : 520;
    });
  }

  // Both options are the thread bubbles; Edge glare adds the faint glass + corner glow on the agent's side
  function setStyle(name) {
    phone.dataset.bubble = 'thread';
    phone.dataset.glare = name === 'glare' ? 'on' : 'off';
    picker.querySelectorAll('button').forEach((b) =>
      b.setAttribute('aria-checked', String(b.dataset.bubble === name))
    );
    try { localStorage.setItem(KEY, name); } catch {}
    fitChat();
    placeGradient();
    if (typeof schedule === 'function') schedule(true);
  }

  picker.addEventListener('mousedown', (e) => e.preventDefault()); // keep the input focused
  picker.addEventListener('click', (e) => {
    const b = e.target.closest('button[data-bubble]');
    if (!b) return;
    setStyle(b.dataset.bubble);
    if (phone.dataset.screen === 'pre' && phone.dataset.pre === '6') play();
    else document.querySelector('#screenPicker [data-screen="6"]').click(); // replays via lava:screen
  });

  phone.addEventListener('lava:screen', (e) => { if (e.detail === '6') play(); });

  // The agent switcher's conversations (built by recap.js) get the same treatment: runs of
  // messages tuck together, and the gradients stay pinned to each thread's visible area
  const stage = phone.querySelector('.recap-stage');
  let raf = 0;
  let refit = false;
  function layoutThreads() {
    raf = 0;
    const all = refit;
    refit = false;
    stage.querySelectorAll('.op-thread').forEach((thread) => {
      const msgs = [...thread.querySelectorAll('.op-list > *')];
      const h = thread.clientHeight;
      const top = thread.scrollTop;
      msgs.forEach((m, i) => {
        if (!m.classList.contains('op-msg')) return;
        const side = (n) => n && n.classList.contains('op-msg') && !n.classList.contains('is-emoji')
          ? (n.classList.contains('op-msg--me') ? 'me' : 'agent') : null;
        const s = side(m);
        if (!s) return;
        const prev = side(msgs[i - 1]) === s;
        const next = side(msgs[i + 1]) === s;
        m.dataset.group = prev && next ? 'mid' : prev ? 'last' : next ? 'first' : 'solo';
        if (all || !m.dataset.fit) {
          m.dataset.fit = '1';
          fit(m, [...m.children].filter((n) => n.tagName === 'SPAN' && !n.classList.contains('op-react')));
        }
        m.style.setProperty('--gh', `${h}px`);
        m.style.setProperty('--gy', `${m.offsetTop - top}px`);
      });
    });
  }
  function schedule(all) {
    if (all === true) refit = true;
    if (!raf) raf = requestAnimationFrame(layoutThreads);
  }
  // an agent's new message is sent out whole: the bubble arrives with its text already in it
  // (the per-word typing motion is cancelled), growing out of its corner
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');
  function grow(node) {
    if (reduceMotion.matches || phone.dataset.bubble !== 'thread') return;
    if (!node.classList) return;
    const agentMsg = node.classList.contains('op-msg') && !node.classList.contains('op-msg--me') && !node.classList.contains('is-emoji');
    if (!agentMsg && !node.classList.contains('op-draft')) return;
    node.querySelectorAll('span').forEach((s) => s.getAnimations().forEach((a) => a.cancel()));
    node.style.transformOrigin = '0 100%';
    node.animate(
      [
        { opacity: 0, transform: 'translateY(8px) scale(0.9)' },
        { opacity: 1, transform: 'none' },
      ],
      { duration: 360, easing: 'cubic-bezier(0.23, 1, 0.32, 1)' }
    );
  }
  if (stage) {
    new MutationObserver((records) => {
      records.forEach((r) => r.addedNodes.forEach(grow));
      schedule();
    }).observe(stage, { childList: true, subtree: true });
    stage.addEventListener('scroll', schedule, true); // scroll doesn't bubble; capture catches each thread
    addEventListener('resize', () => { fitChat(); schedule(true); });
  }

  let saved = null;
  try { saved = localStorage.getItem(KEY); } catch {}
  setStyle(picker.querySelector(`[data-bubble="${saved}"]`) ? saved : 'thread');
  if (phone.dataset.screen === 'pre' && phone.dataset.pre === '6') play();
})();
