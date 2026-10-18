/* Vent background: warm air venting up from the bottom edge and leaning up-left.
   A domain-warped noise field shaped by a plume mask, run through a black → red → orange → gold ramp. */
(() => {
  const phone = document.getElementById('phone');
  const canvas = document.getElementById('ventCanvas');
  if (!phone || !canvas) return;
  const gl = canvas.getContext('webgl', { antialias: false, alpha: false, premultipliedAlpha: false });
  if (!gl) { canvas.hidden = true; return; }

  const vs = 'attribute vec2 a;void main(){gl_Position=vec4(a,0.,1.);}';
  const fs = `
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
uniform vec2 r; uniform float t; uniform float k; uniform sampler2D img;
float hash(vec2 p){ p=fract(p*vec2(123.34,456.21)); p+=dot(p,p+45.32); return fract(p.x*p.y); }
float noise(vec2 p){
  vec2 i=floor(p), f=fract(p); f=f*f*(3.-2.*f);
  return mix(mix(hash(i),hash(i+vec2(1,0)),f.x), mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x), f.y);
}
float fbm(vec2 p){ float v=0., a=.5; for(int i=0;i<4;i++){ v+=a*noise(p); p=p*2.03+vec2(7.1,3.7); a*=.5; } return v; }
// where the reference art sits on the phone (px, y down): the plume leans up-left and peaks about a quarter down
const vec2 ORIGIN=vec2(-95.,150.);
const vec2 SIZE=vec2(634.,610.);
// tap() trims the source image's light edge pixels
vec3 tap(vec2 uv){ vec2 m=step(vec2(.012),uv)*step(uv,vec2(.988)); return texture2D(img,uv).rgb*m.x*m.y; }
void main(){
  vec2 px=vec2(gl_FragCoord.x, r.y-gl_FragCoord.y)/r*vec2(402.,874.);
  vec2 p=px/vec2(402.,874.);
  // warm air pushes the cloud upward and sideways: noise slides up, the whole plume breathes from the floor
  // the cloud keeps its own lumpy outline; it only swells, drifts up and wobbles a little, like a puff of vented air
  vec2 q=vec2(fbm(p*1.6+vec2(0.,t*.12)), fbm(p*1.6+vec2(4.7,t*.15+1.3)));
  vec2 centre=ORIGIN+SIZE*vec2(.5,.55);
  float swell=1.+.035*sin(t*.6)+.015*sin(t*1.7);
  vec2 pp=centre+(px-centre)/swell;
  pp.y+=9.*sin(t*.6+1.);
  pp+=(q-.5)*vec2(26.,22.);
  vec2 uv=(pp-ORIGIN)/SIZE;
  // rising heat shimmer: fine, fast noise that tears the outline into wisps
  vec2 h=vec2(fbm(p*7.+vec2(0.,t*.55)), fbm(p*7.+vec2(9.1,t*.6+2.)));
  uv+=(h-.5)*vec2(.012,.016);
  vec3 sharp=tap(uv);
  vec3 soft=vec3(0.);
  for(int i=0;i<8;i++){
    float a=float(i)*.7854;
    soft+=tap(uv+vec2(cos(a),sin(a))*.014)*.125;
  }
  // unsharp mask puts the lobes' edges back, then a contrast curve and moving billows add depth
  vec3 c=sharp+(sharp-soft)*.4;
  c=max(c,0.);
  float billow=.8+.5*fbm(p*4.5+vec2(0.,t*.3));
  c=pow(c,vec3(1.12))*1.02*mix(1.,billow,.3);
  // the vent keeps feeding red from the floor
  float fl=smoothstep(.58,.92,p.y);
  c=max(c, vec3(.55,.03,.05)*fl*(.8+.4*fbm(p*3.+vec2(0.,t*.2))));
  // the lower body of the cloud runs paler and warmer, down to the keyboard edge
  float lo=smoothstep(.42,.58,p.y)*(1.-smoothstep(.6+.3*k,.67+.3*k,p.y));
  float lm=dot(c,vec3(.3,.5,.2));
  c+=vec3(1.,.72,.62)*lo*(.06+.22*smoothstep(.08,.55,lm));
  // behind the keyboard the field is one flat deep red, so the keys sit on a clean colour
  c=mix(c,vec3(.54,.03,.066),smoothstep(.6+.3*k,.68+.3*k,p.y));
  // film grain, strongest where the cloud is bright
  float g=hash(mod(gl_FragCoord.xy,251.)*.01+fract(t*7.)*3.7)-.5;
  float lum=dot(c,vec3(.3,.5,.2));
  c+=g*(.015+.04*smoothstep(0.,.8,lum))*(1.-smoothstep(.55+.3*k,.63+.3*k,p.y)*.7);
  gl_FragColor=vec4(max(c,0.),1.);
}`;

  function shader(type, src) {
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    return s;
  }
  const prog = gl.createProgram();
  gl.attachShader(prog, shader(gl.VERTEX_SHADER, vs));
  gl.attachShader(prog, shader(gl.FRAGMENT_SHADER, fs));
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) { canvas.hidden = true; return; }
  gl.useProgram(prog);
  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(prog, 'a');
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
  const uR = gl.getUniformLocation(prog, 'r');
  const uT = gl.getUniformLocation(prog, 't');
  const uK = gl.getUniformLocation(prog, 'k');
  let k = 0, kTarget = 0; // 0 keyboard up, 1 folded: the flat red behind the keys slides down with it
  const tex = gl.createTexture();
  let ready = false;
  const image = new Image();
  image.onload = () => {
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, image);
    for (const [k, v] of [[gl.TEXTURE_MIN_FILTER, gl.LINEAR], [gl.TEXTURE_MAG_FILTER, gl.LINEAR], [gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE], [gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE]]) gl.texParameteri(gl.TEXTURE_2D, k, v);
    ready = true;
    draw(performance.now());
  };
  image.src = 'assets/vent.jpg';

  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const SCALE = 0.75; // high enough that the grain and wisps stay crisp
  let raf = 0;
  const t0 = performance.now();

  function size() {
    const w = Math.max(2, Math.round(phone.clientWidth * SCALE));
    const h = Math.max(2, Math.round(phone.clientHeight * SCALE));
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
      gl.viewport(0, 0, w, h);
    }
  }
  function draw(now) {
    if (!ready) return;
    size();
    gl.uniform2f(uR, canvas.width, canvas.height);
    k += (kTarget - k) * (reduceMotion.matches ? 1 : 0.1);
    gl.uniform1f(uK, k);
    gl.uniform1f(uT, reduceMotion.matches ? 4 : (now - t0) / 1000);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }
  function loop(now) {
    draw(now);
    raf = reduceMotion.matches ? 0 : requestAnimationFrame(loop);
  }
  function sync() {
    const on = phone.dataset.bg === 'vent' && !document.hidden;
    if (on && !raf) raf = requestAnimationFrame(loop);
    if (!on && raf) { cancelAnimationFrame(raf); raf = 0; }
  }
  new MutationObserver(() => {
    kTarget = phone.dataset.keyboard === 'closed' ? 1 : 0;
    sync();
    if (!raf) draw(performance.now());
  }).observe(phone, { attributes: true, attributeFilter: ['data-bg', 'data-keyboard'] });
  document.addEventListener('visibilitychange', sync);
  addEventListener('resize', () => { if (!raf) draw(performance.now()); });
  sync();
})();
