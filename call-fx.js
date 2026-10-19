/* Call page extras:
   - "LISTENING" / "MUTED" drawn in the Vibe text effect at the agent names' size, on the very line the
     agent's name takes when they join, following the status line's own text and fade
   - the heat floor's gradient run through the vent shader's effect (see vent.js): warp, swell, shimmer,
     billows and grain. It lives inside .floor, so it still swells and dims with your voice.
   - the scripted call's captions: each spoken chunk rises in, and floats up and away as the next one arrives */
(() => {
  let tries = 0;
  (function wait() {
    const main = document.querySelector('#dc-root main');
    const status = main && main.querySelector('.status'), floor = main && main.querySelector('.floor');
    if (status && floor) { vibeStatus(main, status); ventFloor(floor); captions(main); return; }
    if (tries++ < 120) requestAnimationFrame(wait);
  })();

  /* ───────────── Captions ───────────── */
  // Your words: each sentence breaks into 3–4 word pieces that surface in turn, left then right, and float up
  // and away as the next arrives, the way the murmurs always did (heard, half-caught, rising). Ride-or-Die's words: one line, centred, large,
  // word by word at speaking pace; it floats up and fades when the next line arrives.
  // Opacity always leads the blur, so nothing leaving ever smears into a grey block.
  function captions(main) {
    const script = window.__callScript;
    if (!script || window.__callLive) return;
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const OUT = 'cubic-bezier(0.23, 1, 0.32, 1)';      // strong ease-out: in fast, long soft landing
    const LEAVE = 'cubic-bezier(0.25, 1, 0.5, 1)';     // ease-out quart: away at once, no drag at the end
    const layer = document.createElement('div');
    layer.className = 'captions';
    layer.setAttribute('aria-live', 'polite');
    main.appendChild(layer);

    function line(chunk) {
      const p = document.createElement('p');
      p.className = 'cap cap--' + chunk.k;
      const words = chunk.text.split(' ');
      words.forEach((w, j) => {
        const m = w.match(/^\*(.+)\*(.*)$/);
        const span = document.createElement('span');
        span.className = 'cw' + (m ? ' em' : '');
        span.textContent = m ? m[1] + m[2] : w;
        p.appendChild(span);
        if (j < words.length - 1) p.appendChild(document.createTextNode(' '));
      });
      return p;
    }
    function enter(p, chunk) {
      if (reduce) { p.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 200, easing: 'ease-out', fill: 'both' }); return; }
      const ws = Array.from(p.querySelectorAll('.cw'));
      // spoken: each word arrives as it's said, spread over ~85% of the recorded chunk
      const step = Math.min(0.32, ((chunk.e - chunk.s) * 0.85) / ws.length) * 1000;
      p.animate([{ translate: '0 10px' }, { translate: '0 0' }], { duration: 600, easing: OUT, fill: 'both' });
      ws.forEach((w, j) => w.animate([{ opacity: 0, translate: '0 6px', filter: 'blur(3px)' }, { opacity: 1, translate: '0 0', filter: 'blur(0px)' }],
        { duration: 380, delay: j * step, easing: OUT, fill: 'both' }));
    }
    // pieces of 3–4 words: a sentence of up to 5 words stays whole; a longer one splits into even pieces of
    // about 4, so each reads as a short phrase
    function pieces(text) {
      const w = text.match(/\*[^*]+\*\S*|\S+/g); // an emphasised phrase counts as one unit
      if (w.length <= 5) return [text];
      const n = Math.ceil(w.length / 4), out = [];
      for (let k = 0, i = 0; k < n; k++) { const size = Math.round((w.length - i) / (n - k)); out.push(w.slice(i, i + size).join(' ')); i += size; }
      return out;
    }
    // Pieces take turns left, right, left, right on one line, so the eye can follow the sentence. The newest sits
    // on the line; the one before it steps up and dims; anything older floats up and fades away. Moves are CSS
    // transitions (data-lv in the call page's styles) on transform and opacity only (no blur, which is what made
    // the motion heavy), so each picks up smoothly from wherever the last left off. In 300ms on a strong
    // ease-out, the step up 400ms on the iOS drawer curve. Leaving, the whole line drifts straight up
    // and fades quickly (400ms) while the rise carries on for 800ms: no sideways motion, no tilt.
    // Each step is 48px, so a newer piece always sits at least that far below the one before it.
    const live = [];
    const EM_STEPS = [4, 2, 6, 3];
    let side = 0, emN = 0;
    function retire(el) { el.dataset.lv = '2'; setTimeout(() => el.remove(), 900); }
    function push(text) {
      for (let k = live.length - 1; k >= 0; k--) {
        const lv = +live[k].dataset.lv + 1;
        if (lv >= 2) { retire(live[k]); live.splice(k, 1); } else live[k].dataset.lv = String(lv);
      }
      const el = document.createElement('span');
      el.className = 'mur-fx';
      // the leaned-on word comes up a touch larger: four sizes in rotation, +2 to +6px over the 19px line
      // the leaned-on word comes up a touch larger: four sizes in rotation, +2 to +6px over the 19px line
      text.split(/(\*[^*]+\*)/).forEach(part => {
        if (!part) return;
        if (part[0] !== '*') { el.appendChild(document.createTextNode(part)); return; }
        const em = document.createElement('span');
        em.className = 'mur-em';
        em.textContent = part.slice(1, -1);
        em.style.fontSize = (19 + EM_STEPS[emN++ % EM_STEPS.length]) + 'px';
        el.appendChild(em);
      });
      el.dataset.side = side++ % 2 ? 'r' : 'l';
      el.dataset.lv = 'in';
      main.appendChild(el); // placed on the screen itself, not inside the centred caption box
      live.push(el);
      requestAnimationFrame(() => requestAnimationFrame(() => { if (el.dataset.lv === 'in') el.dataset.lv = '0'; }));
    }
    function clearPieces() { live.splice(0).forEach(retire); }
    // each piece lands when its first word is said in the recording: the chunk's time shared out by word count
    function drift(chunk) {
      const ps = pieces(chunk.text), counts = ps.map(p => p.split(' ').length), total = counts.reduce((x, y) => x + y, 0), span = (chunk.e - chunk.s) * 900;
      let before = 0;
      ps.forEach((text, k) => {
        setTimeout(() => { if (!window.__callLive) push(text); }, before / total * span);
        before += counts[k];
      });
    }
    function leave(p) {
      if (!p) return;
      const frames = reduce ? [{ opacity: 1 }, { opacity: 0 }]
        : [{ opacity: 1, translate: '0 0', filter: 'blur(0px)' }, { opacity: 0, offset: 0.7 }, { opacity: 0, translate: '0 -28px', filter: 'blur(2px)' }];
      p.animate(frames, { duration: reduce ? 160 : 420, easing: LEAVE, fill: 'forwards' }).onfinish = () => p.remove();
    }

    // a timer, not animation frames, keeps the script on time even when frames are slow
    // Ride-or-Die's words follow their glow by 340ms when they cut in, so that turn starts 340ms ahead of the voice
    const lead = n => script[n].k === 'a' && (n === 0 || script[n - 1].k === 'u') ? 0.34 : 0;
    let i = 0, cur = null, done = false;
    const iv = setInterval(tick, 40);
    function tick() {
      if (window.__callLive) { clearInterval(iv); layer.remove(); return; }
      if (!window.__callT0) return; // preloaded and waiting for the voice button
      const t = (performance.now() - window.__callT0) / 1000;
      while (i < script.length && t >= script[i].s - lead(i)) {
        leave(cur); cur = null;
        const chunk = script[i++];
        if (chunk.k === 'u') { drift(chunk); continue; }
        clearPieces();
        // when Ride-or-Die cuts in, the glow comes up first and the words follow 340ms later
        const opens = i < 2 || script[i - 2].k === 'u';
        const show = () => { cur = line(chunk); layer.appendChild(cur); enter(cur, chunk); };
        if (opens) setTimeout(show, 340); else show();
      }
      // the last line leaves as the call ends
      if (!done && i === script.length && t >= script[i - 1].e + 0.9) { done = true; clearInterval(iv); leave(cur); cur = null; clearPieces(); }
    }
    tick();
  }

  /* ───────────── Vibe status ───────────── */
  function vibeStatus(main, status) {
    if (!window.NameEffects) return;
    const fx = document.createElement('div');
    fx.className = 'status-fx';
    fx.setAttribute('aria-hidden', 'true');
    main.appendChild(fx);
    const ring = main.querySelector('.ring-slot');
    // the line the agent's name sits on, at rest (the ring slot nudges up 6px while hidden)
    function nameLine() {
      const lbl = ring && (ring.querySelector('.agent-label.is-active') || ring.querySelector('.agent-label'));
      if (!lbl) return status.offsetTop + status.offsetHeight / 2;
      const m = main.getBoundingClientRect(), r = lbl.getBoundingClientRect(), k = m.width / main.offsetWidth || 1;
      const ty = new DOMMatrixReadOnly(getComputedStyle(ring).transform).m42;
      return (r.top + r.height / 2 - m.top) / k - ty;
    }
    let text = '';
    document.fonts.load('430 100px Archivo').catch(() => {}).then(() => {
      main.classList.add('has-status-fx');
      (function sync() {
        const t = status.textContent.trim();
        // same height as the agent names (agent-ring.js renders them at 13.5)
        if (t !== text) { text = t; fx.replaceChildren(NameEffects.render('vibe', t, { height: 13.5 })); }
        fx.style.top = nameLine() + 'px';
        fx.style.opacity = getComputedStyle(status).opacity;
        requestAnimationFrame(sync);
      })();
    });
  }

  /* ───────────── Heat floor, through the vent shader ───────────── */
  // The floor's own four glows (same boxes and colours as the .floor blobs, softened as by its 30px blur),
  // redrawn in WebGL and moved by vent.js's effect: domain warp, breathing swell, heat shimmer, billows, grain.
  function ventFloor(floor) {
    const canvas = document.createElement('canvas');
    canvas.className = 'floor-cloud';
    floor.appendChild(canvas);
    const gl = canvas.getContext('webgl', { antialias: false, alpha: true, premultipliedAlpha: true });
    if (!gl) { canvas.remove(); return; }

    const vs = 'attribute vec2 a;void main(){gl_Position=vec4(a,0.,1.);}';
    const fs = `
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
uniform vec2 r; uniform float t;
float hash(vec2 p){ p=fract(p*vec2(123.34,456.21)); p+=dot(p,p+45.32); return fract(p.x*p.y); }
float noise(vec2 p){
  vec2 i=floor(p), f=fract(p); f=f*f*(3.-2.*f);
  return mix(mix(hash(i),hash(i+vec2(1,0)),f.x), mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x), f.y);
}
float fbm(vec2 p){ float v=0., a=.5; for(int i=0;i<4;i++){ v+=a*noise(p); p=p*2.03+vec2(7.1,3.7); a*=.5; } return v; }
const vec2 BOX=vec2(622.,441.6); // the .floor box, px, y down
// one soft elliptical glow (left/top/size as in the markup), premultiplied
vec4 glow(vec2 px, vec2 pos, vec2 size, vec3 col, float a){
  vec2 rad=size*.5;
  float edge=(length((px-pos-rad)/rad)-1.)*min(rad.x,rad.y);
  float k=a*(1.-smoothstep(-55.,55.,edge));
  return vec4(col*k,k);
}
vec4 over(vec4 top, vec4 under){ return top+under*(1.-top.a); }
void main(){
  vec2 px=vec2(gl_FragCoord.x, r.y-gl_FragCoord.y)/r*BOX;
  vec2 p=px/BOX;
  // the vent's motion: slow domain warp, a breathing swell from the middle, a little bob
  vec2 q=vec2(fbm(p*1.6+vec2(0.,t*.12)), fbm(p*1.6+vec2(4.7,t*.15+1.3)));
  vec2 centre=BOX*vec2(.5,.6);
  float swell=1.+.035*sin(t*.6)+.015*sin(t*1.7);
  vec2 pp=centre+(px-centre)/swell;
  pp.y+=9.*sin(t*.6+1.);
  pp+=(q-.5)*vec2(40.,34.);
  // rising heat shimmer
  vec2 h=vec2(fbm(p*7.+vec2(0.,t*.55)), fbm(p*7.+vec2(9.1,t*.6+2.)));
  pp+=(h-.5)*vec2(8.,10.);
  // the floor's glows, in markup order (later ones on top)
  vec4 c=glow(pp, vec2(0.,115.2), vec2(420.,307.2), vec3(.910,.263,.165), 1.);      // #E8432A
  c=over(glow(pp, vec2(210.,163.2), vec2(300.,249.6), vec3(1.,.541,.235), 1.), c);  // #FF8A3C
  c=over(glow(pp, vec2(140.,240.), vec2(260.,192.), vec3(1.,.890,.690), 1.), c);    // #FFE3B0
  c=over(glow(pp, vec2(-60.,76.8), vec2(220.,211.2), vec3(.184,.231,1.), .45), c);  // rgba(47,59,255,.45)
  // moving billows and film grain, as on the vent
  float billow=.8+.5*fbm(p*4.5+vec2(0.,t*.3));
  c.rgb*=mix(1.,billow,.3);
  float g=hash(mod(gl_FragCoord.xy,251.)*.01+fract(t*7.)*3.7)-.5;
  float lum=dot(c.rgb,vec3(.3,.5,.2));
  c.rgb+=g*(.015+.04*smoothstep(0.,.8,lum))*c.a;
  gl_FragColor=vec4(clamp(c.rgb,0.,c.a),c.a);
}`;
    const shader = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); return s; };
    const prog = gl.createProgram();
    gl.attachShader(prog, shader(gl.VERTEX_SHADER, vs));
    gl.attachShader(prog, shader(gl.FRAGMENT_SHADER, fs));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) { canvas.remove(); return; }
    gl.useProgram(prog);
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, 'a');
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    const uR = gl.getUniformLocation(prog, 'r'), uT = gl.getUniformLocation(prog, 't');

    const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');
    const SCALE = 0.75;
    const t0 = performance.now();
    let raf = 0;
    function draw(now) {
      const w = Math.max(2, Math.round(floor.offsetWidth * SCALE)), h = Math.max(2, Math.round(floor.offsetHeight * SCALE));
      if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; gl.viewport(0, 0, w, h); }
      gl.uniform2f(uR, w, h);
      gl.uniform1f(uT, reduceMotion.matches ? 4 : (now - t0) / 1000);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    }
    function loop(now) { draw(now); raf = reduceMotion.matches ? 0 : requestAnimationFrame(loop); }
    function sync() {
      const on = !document.hidden && !(window.__standby && !window.__callT0); // still while preloaded and waiting
      if (on && !raf) raf = requestAnimationFrame(loop);
      if (!on && raf) { cancelAnimationFrame(raf); raf = 0; }
    }
    addEventListener('message', e => { if (e.data === 'call-start') setTimeout(sync, 0); });
    floor.classList.add('has-cloud'); // hides the CSS blobs and their blur; the shader draws them now
    draw(performance.now());
    sync();
    document.addEventListener('visibilitychange', sync);
  }
})();
