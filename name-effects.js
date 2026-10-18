/* Text effects for the agent name, drawn as SVG so the filters can work on real glyphs.
   Everything is designed at a font size of 100 user units (cap height ≈ 70) and scaled by
   the viewBox, so an effect keeps its proportions — particle size, fade length — at any size.
   Each effect's numbers were measured off its reference image relative to the cap height. */
window.NameEffects = (() => {
  const NS = 'http://www.w3.org/2000/svg';
  const SIZE = 100;
  let uid = 0;

  const svgUri = (markup) => 'data:image/svg+xml,' + encodeURIComponent(markup);

  // Fractal noise clusters around 0.5; stretch its red channel into a usable alpha
  const noiseAlpha = (gain, offset) => `0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  ${gain} 0 0 0 ${offset}`;
  // Grey (luminance) noise with full alpha, for mottling ink colour
  const noiseGrey = (gain, offset) =>
    `${gain} 0 0 0 ${offset}  ${gain} 0 0 0 ${offset}  ${gain} 0 0 0 ${offset}  0 0 0 0 1`;

  // Round dot that fills its cell at full brightness — the halftone screen
  // (drawn on a 100×100 canvas and scaled into the feImage cell, so it rasterises at any size)
  const dotCell = () =>
    svgUri(
      `<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100">` +
        `<defs><radialGradient id="g"><stop offset="0" stop-color="#fff"/><stop offset="1" stop-color="#000"/></radialGradient></defs>` +
        `<rect width="100" height="100" fill="#000"/><circle cx="50" cy="50" r="66" fill="url(#g)"/></svg>`
    );

  // Soft round spot in filter-region space (for directional, partial-letter effects)
  const spot = (vb, cx, cy, r) =>
    svgUri(
      `<svg xmlns="http://www.w3.org/2000/svg" width="${vb.w}" height="${vb.h}" viewBox="${vb.x} ${vb.y} ${vb.w} ${vb.h}" preserveAspectRatio="none">` +
        `<defs><radialGradient id="s" gradientUnits="userSpaceOnUse" cx="${cx}" cy="${cy}" r="${r}">` +
        `<stop offset="0" stop-color="#fff"/><stop offset="0.45" stop-color="#fff" stop-opacity="0.75"/><stop offset="1" stop-color="#fff" stop-opacity="0"/>` +
        `</radialGradient></defs><rect x="${vb.x}" y="${vb.y}" width="${vb.w}" height="${vb.h}" fill="url(#s)"/></svg>`
    );

  const feImage = (href, vb, result) =>
    `<feImage href="${href}" x="${vb.x}" y="${vb.y}" width="${vb.w}" height="${vb.h}" preserveAspectRatio="none" result="${result}"/>`;

  const EFFECTS = {
    /* Distressed — photocopied bold grotesk. Edges bled round and nibbled with fine bumps
       (~2% of cap), ink mottled with paper grain rather than punched through. */
    distressed: {
      label: 'Distressed',
      font: { family: "'Archivo', sans-serif", weight: 800, stretch: '100%', tracking: -6 },
      pad: [0.1, 0.32],
      filter: ({ id, ink }) => `
        <filter id="${id}" color-interpolation-filters="sRGB">
          <!-- ink bleed: letters swell and fuse where they nearly touch -->
          <feMorphology in="SourceAlpha" operator="dilate" radius="0.9" result="fat"/>
          <feGaussianBlur in="fat" stdDeviation="2" result="bleed"/>
          <!-- melt: slow warp (≈30% of cap wavelength, ≈5% of cap amplitude) -->
          <feTurbulence type="fractalNoise" baseFrequency="0.045" numOctaves="2" seed="4" result="melt"/>
          <feDisplacementMap in="bleed" in2="melt" scale="9" xChannelSelector="R" yChannelSelector="G" result="melted"/>
          <!-- nibbled edge roughness (≈1.5% of cap) -->
          <feTurbulence type="fractalNoise" baseFrequency="0.3" numOctaves="2" seed="12" result="rough"/>
          <feDisplacementMap in="melted" in2="rough" scale="2.8" xChannelSelector="R" yChannelSelector="G" result="nibbled0"/>
          <feGaussianBlur in="nibbled0" stdDeviation="0.8" result="nibbled"/>
          <feComponentTransfer in="nibbled" result="shape0"><feFuncA type="linear" slope="14" intercept="-6.6"/></feComponentTransfer>
          <!-- pinholes -->
          <feTurbulence type="fractalNoise" baseFrequency="1.2" numOctaves="1" seed="21" result="pin"/>
          <feColorMatrix in="pin" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  -11 0 0 0 9.2" result="pinA"/>
          <feComposite in="shape0" in2="pinA" operator="in" result="shape"/>
          <!-- paper grain in the ink + faint horizontal scan lines -->
          <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="5" result="g"/>
          <feColorMatrix in="g" type="matrix" values="${noiseGrey(1.6, -0.3)}" result="grey"/>
          <feFlood flood-color="${ink}" result="inkF"/>
          <feComposite in="inkF" in2="grey" operator="arithmetic" k1="-0.2" k2="1.08" result="mottled"/>
          <feTurbulence type="turbulence" baseFrequency="0.0005 0.5" numOctaves="1" seed="31" result="scan"/>
          <feColorMatrix in="scan" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  14 0 0 0 -5.3" result="scanA"/>
          <feFlood flood-color="#000" flood-opacity="0.16"/>
          <feComposite in2="scanA" operator="in" result="scanLines"/>
          <feMerge result="inked"><feMergeNode in="mottled"/><feMergeNode in="scanLines"/></feMerge>
          <feComposite in="inked" in2="shape" operator="in"/>
        </filter>`,
    },

    /* Dissolve — spray-fuzzy edges on every letter (fringe ≈ 8% of cap, specks ≈ 2.5%),
       and the word actually breaking apart in two directions: the first letter up-left,
       the last letter trailing down-right. */
    dissolve: {
      label: 'Dissolve',
      font: { family: "'Archivo', sans-serif", weight: 900, stretch: '112%', tracking: -2, upper: true },
      pad: [0.16, 0.6],
      filter: ({ id, ink, vb, box }) => {
        const left = spot(vb, box.x + box.w * 0.01, box.y + box.h * 0.12, box.w * 0.15);
        const right = spot(vb, box.x + box.w * 1.02, box.y + box.h * 1.08, box.w * 0.24);
        return `
        <filter id="${id}" color-interpolation-filters="sRGB">
          <feTurbulence type="fractalNoise" baseFrequency="0.55" numOctaves="2" seed="9" result="n"/>
          <feColorMatrix in="n" type="matrix" values="${noiseAlpha(3.2, -1.1)}" result="nA"/>
          ${feImage(left, vb, 'dL')}
          ${feImage(right, vb, 'dR')}
          <feMerge result="dBoth"><feMergeNode in="dL"/><feMergeNode in="dR"/></feMerge>

          <feGaussianBlur in="SourceAlpha" stdDeviation="3.8" result="edge"/>
          <feComposite in="edge" in2="dBoth" operator="arithmetic" k2="1" k3="-0.5" result="eroded"/>
          <feComposite in="eroded" in2="nA" operator="arithmetic" k2="1.55" k3="0.75" k4="-1.02" result="cv"/>
          <feComponentTransfer in="cv" result="letters"><feFuncA type="linear" slope="30" intercept="0"/></feComponentTransfer>

          <feGaussianBlur in="SourceAlpha" stdDeviation="12 9" result="wide"/>
          <feOffset in="wide" dx="-28" dy="-18" result="wideL"/>
          <feComposite in="wideL" in2="dL" operator="in" result="cloudL"/>
          <feOffset in="wide" dx="38" dy="28" result="wideR"/>
          <feComposite in="wideR" in2="dR" operator="in" result="cloudR"/>
          <feMerge result="clouds"><feMergeNode in="cloudL"/><feMergeNode in="cloudR"/></feMerge>
          <feComponentTransfer in="clouds" result="cloudsUp"><feFuncA type="linear" slope="2" intercept="0"/></feComponentTransfer>
          <feTurbulence type="fractalNoise" baseFrequency="0.38" numOctaves="2" seed="15" result="nc"/>
          <feColorMatrix in="nc" type="matrix" values="${noiseAlpha(3.6, -1.3)}" result="ncA"/>
          <feComposite in="cloudsUp" in2="ncA" operator="arithmetic" k2="0.7" k3="1" k4="-1.42" result="sv"/>
          <feComponentTransfer in="sv" result="spray"><feFuncA type="linear" slope="30" intercept="0"/></feComponentTransfer>

          <feMerge result="all"><feMergeNode in="spray"/><feMergeNode in="letters"/></feMerge>
          <feFlood flood-color="${ink}"/>
          <feComposite in2="all" operator="in"/>
        </filter>`;
      },
    },

    /* Zoom blur — a continuous radial streak from the word's centre. The streak grows with
       distance (the end letters are mostly streak) and is a lighter, cooler teal than the core. */
    zoom: {
      label: 'Zoom blur',
      font: { family: "'Inter', sans-serif", weight: 650, stretch: '100%', tracking: -4 },
      pad: [0.4, 0.3],
      ghosts: {
        count: 48,
        scaleX: 0.5,
        scaleY: 0.05,
        rotate: 0,
        colors: ['#1b4152', '#3b6b7a', '#6f97a3'],
        opacity: (t) => 0.1 * Math.pow(1 - t, 0.8),
        blur: 1.4,
        grain: 0,
      },
      core: { colors: '#0f2836', blur: 0.5, fade: [0.02, 0.2, 0.82, 0.98], fadeFloor: 0.5 },
    },

    /* Halftone — the letters are soft white blobs, readable and solid inside (with paper
       grain); a fine dot screen (pitch ≈ stroke / 7) only appears where they fade, and the
       glow is smeared upward. */
    halftone: {
      label: 'Halftone',
      font: { family: "'Nunito', sans-serif", weight: 1000, stretch: '100%', tracking: 3 },
      rotate: -7,
      pad: [0.24, 0.7],
      filter: ({ id, ink }) => `
        <filter id="${id}" color-interpolation-filters="sRGB">
          <feMorphology in="SourceAlpha" operator="dilate" radius="0.9" result="heavy0"/>
          <feGaussianBlur in="heavy0" stdDeviation="1.6" result="heavy1"/>
          <feComponentTransfer in="heavy1" result="heavy"><feFuncA type="linear" slope="3" intercept="-1"/></feComponentTransfer>
          <feGaussianBlur in="heavy" stdDeviation="2.1" result="blob"/>
          <feGaussianBlur in="heavy" stdDeviation="11 13" result="glow"/>
          <feOffset in="glow" dx="6" dy="-26" result="glowUp"/>
          <feOffset in="glow" dx="-2" dy="17" result="glowDown"/>
          <feComposite in="glowUp" in2="glowDown" operator="arithmetic" k2="0.7" k3="0.3" result="halo"/>
          <feComposite in="blob" in2="halo" operator="arithmetic" k2="1.15" k3="1" result="field"/>
          <feImage data-cell="1" href="${dotCell()}" x="0" y="0" width="3.3" height="3.3" preserveAspectRatio="none" result="cell"/>
          <feTile in="cell" result="dots"/>
          <feColorMatrix in="dots" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  1 0 0 0 0" result="dotsA"/>
          <feComposite in="field" in2="dotsA" operator="arithmetic" k2="1" k3="1" k4="-1" result="v"/>
          <feComponentTransfer in="v" result="screen"><feFuncA type="linear" slope="60" intercept="0"/></feComponentTransfer>
          <feTurbulence type="fractalNoise" baseFrequency="1.6" numOctaves="2" seed="7" result="g"/>
          <feColorMatrix in="g" type="matrix" values="${noiseGrey(1.6, -0.3)}" result="grey"/>
          <feFlood flood-color="${ink}" result="inkF"/>
          <feComposite in="inkF" in2="grey" operator="arithmetic" k1="-0.22" k2="1.11" result="mottled"/>
          <feComposite in="mottled" in2="screen" operator="in"/>
        </filter>`,
    },

    /* Soft blur — out of focus only at the outer edges of the word (left of the first letter,
       right of the last), crisp through the middle; charcoal ink mottled by paper grain with
       sparse light flecks. */
    blur: {
      label: 'Soft blur',
      font: { family: "'Archivo', sans-serif", weight: 900, stretch: '100%', tracking: -1, upper: true },
      pad: [0.14, 0.3],
      filter: ({ id, ink, vb, box }) => {
        // focus weight: 1 = fully defocused (outer edge of the first and last letter), 0 = crisp
        const ramp = svgUri(
          `<svg xmlns="http://www.w3.org/2000/svg" width="${vb.w}" height="${vb.h}" viewBox="${vb.x} ${vb.y} ${vb.w} ${vb.h}" preserveAspectRatio="none">` +
            `<defs><linearGradient id="r" gradientUnits="userSpaceOnUse" x1="${box.x}" x2="${box.x + box.w}" y1="0" y2="0">` +
            `<stop offset="0" stop-color="#fff"/><stop offset="0.22" stop-color="#fff" stop-opacity="0"/>` +
            `<stop offset="0.72" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#fff"/>` +
            `</linearGradient></defs><rect x="${vb.x}" y="${vb.y}" width="${vb.w}" height="${vb.h}" fill="url(#r)"/></svg>`
        );
        return `
        <filter id="${id}" color-interpolation-filters="sRGB">
          ${feImage(ramp, vb, 'w')}
          <feGaussianBlur in="SourceAlpha" stdDeviation="0.6" result="crisp"/>
          <feGaussianBlur in="SourceAlpha" stdDeviation="5.5" result="soft"/>
          <feComposite in="crisp" in2="w" operator="arithmetic" k1="-1" k2="1" result="crispPart"/>
          <feComposite in="soft" in2="w" operator="arithmetic" k1="1" result="softPart"/>
          <feComposite in="crispPart" in2="softPart" operator="arithmetic" k2="1" k3="1" result="shape"/>
          <feTurbulence type="fractalNoise" baseFrequency="1.4" numOctaves="2" seed="3" result="g"/>
          <feColorMatrix in="g" type="matrix" values="${noiseGrey(1.6, -0.3)}" result="grey"/>
          <feFlood flood-color="${ink}" result="inkF"/>
          <feComposite in="inkF" in2="grey" operator="arithmetic" k2="1" k3="0.1" k4="-0.05" result="mottled"/>
          <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="1" seed="17" result="f"/>
          <feColorMatrix in="f" type="matrix" values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  9 0 0 0 -6.4" result="fleck"/>
          <feMerge result="inked"><feMergeNode in="mottled"/><feMergeNode in="fleck"/></feMerge>
          <feComposite in="inked" in2="shape" operator="in"/>
        </filter>`;
      },
    },

    /* Vibe — a smeared, glowing streak: white core → pink → blue as it trails away. The smear
       tilts up on the left and down on the right; everything is finely dithered (grain ≈ 1% cap). */
    vibe: {
      label: 'Vibe',
      font: { family: "'Archivo', sans-serif", weight: 430, stretch: '125%', tracking: 2 },
      pad: [0.22, 0.6],
      ghosts: {
        count: 32,
        scaleX: 0.14,
        scaleY: 0.46,
        rotate: 0,
        colors: ['#ffe9fb', '#f2b8ea', '#4d9cc9', '#1d5578'],
        opacity: (t) => 0.2 * Math.pow(1 - t, 1.4), // Home + Chat: a lighter trail
        blur: 2.5,
        grain: 0.6,
        grainLevel: [2.2, -0.25],
        // directional haze: [dx, dy] as a fraction of the word box, blur, colour, opacity, which side
        haze: [
          { dx: -0.03, dy: -0.36, blur: 12, color: '#3b97c6', opacity: 0.6, side: 'left' },
          { dx: -0.05, dy: -0.12, blur: 9, color: '#2f86b4', opacity: 0.45, side: 'left' },
          { dx: 0.02, dy: -0.18, blur: 7, color: '#e7b3ea', opacity: 0.32, side: 'left' },
          { dx: 0.04, dy: 0.22, blur: 9, color: '#4a9ccb', opacity: 0.6, side: 'right' },
        ],
      },
      core: { colors: '#fffaff', blur: 1.4 },
    },
  };

  let measurer = null;

  function el(name, attrs = {}) {
    const node = document.createElementNS(NS, name);
    for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
    return node;
  }

  function textNode(effect, text, fill = '#fff', k = 1) {
    const f = effect.font;
    const t = el('text', {
      x: 0,
      y: 0,
      'font-size': SIZE * k,
      'font-family': f.family,
      'font-weight': f.weight,
      'letter-spacing': f.tracking * k,
      fill,
    });
    if (f.style) t.setAttribute('font-style', f.style);
    t.style.fontStretch = f.stretch;
    t.textContent = f.upper ? text.toUpperCase() : text;
    return t;
  }

  function measure(effect, text, k) {
    if (!measurer) {
      measurer = el('svg', { width: 0, height: 0 });
      measurer.style.cssText = 'position:absolute;left:-9999px;top:0;visibility:hidden';
      document.body.appendChild(measurer);
    }
    const t = textNode(effect, text, '#fff', k);
    measurer.appendChild(t);
    const b = t.getBBox();
    // first/last glyph extents, for effects that only touch the ends of the word
    const n = t.getNumberOfChars();
    const first = n ? t.getExtentOfChar(0) : b;
    const last = n ? t.getExtentOfChar(n - 1) : b;
    measurer.removeChild(t);
    return { x: b.x, y: b.y, w: b.width, h: b.height, firstEnd: first.x + first.width, lastStart: last.x, charW: first.width };
  }

  const lerpColor = (stops, t) => {
    const hex = (c) => [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16));
    const seg = Math.min(stops.length - 2, Math.floor(t * (stops.length - 1)));
    const local = t * (stops.length - 1) - seg;
    const a = hex(stops[seg]);
    const b = hex(stops[seg + 1]);
    return `rgb(${a.map((v, i) => Math.round(v + (b[i] - v) * local)).join(',')})`;
  };

  /* Filters rasterise at ~1px per user unit and are then stretched to the display size, so
     the design (written at a 100-unit font) is rescaled to the real device-pixel size before
     drawing: every length is multiplied by k and every noise frequency divided by it. */
  const scaleNums = (str, k) => str.trim().split(/[\s,]+/).map((n) => (parseFloat(n) * k).toFixed(4)).join(' ');
  function rescaleFilters(svg, k) {
    svg.querySelectorAll('feGaussianBlur').forEach((n) => n.setAttribute('stdDeviation', scaleNums(n.getAttribute('stdDeviation'), k)));
    svg.querySelectorAll('feOffset').forEach((n) => {
      ['dx', 'dy'].forEach((a) => n.hasAttribute(a) && n.setAttribute(a, (parseFloat(n.getAttribute(a)) * k).toFixed(4)));
    });
    svg.querySelectorAll('feMorphology').forEach((n) => n.setAttribute('radius', scaleNums(n.getAttribute('radius'), k)));
    svg.querySelectorAll('feDisplacementMap').forEach((n) => n.setAttribute('scale', (parseFloat(n.getAttribute('scale')) * k).toFixed(4)));
    svg.querySelectorAll('feTurbulence').forEach((n) => n.setAttribute('baseFrequency', scaleNums(n.getAttribute('baseFrequency'), 1 / k)));
    // a dot screen under ~4 device px fails to rasterise (the browser drops the filter), so small labels
    // get a slightly coarser screen than the reference
    svg.querySelectorAll('feImage[data-cell]').forEach((n) => {
      ['width', 'height'].forEach((a) => n.setAttribute(a, Math.max(4, parseFloat(n.getAttribute(a)) * k).toFixed(4)));
    });
  }

  const region = (vb) => `filterUnits="userSpaceOnUse" x="${vb.x}" y="${vb.y}" width="${vb.w}" height="${vb.h}"`;

  const grainFilter = (fid, vb, freq, [gain, offset] = [2.6, -0.5]) => `
    <filter id="${fid}" ${region(vb)} color-interpolation-filters="sRGB">
      <feTurbulence type="fractalNoise" baseFrequency="${freq}" numOctaves="1" seed="6" result="n"/>
      <feColorMatrix in="n" type="matrix" values="${noiseAlpha(gain, offset)}" result="nA"/>
      <feComposite in="SourceGraphic" in2="nA" operator="in"/>
    </filter>`;

  /* Ghost stack: many copies scaled/rotated about the centre, coloured and faded by distance.
     Used for the zoom-style effects, where the streak has to be continuous. */
  function ghostStack(svg, defs, effect, text, vb, box, id, k) {
    const g = effect.ghosts;
    const cx = box.x + box.w / 2;
    const cy = box.y + box.h / 2;
    let html = `<filter id="${id}-gb" ${region(vb)}><feGaussianBlur stdDeviation="${g.blur}"/></filter>`;
    if (g.grain) html += grainFilter(`${id}-gg`, vb, g.grain, g.grainLevel);
    defs.insertAdjacentHTML('beforeend', html);

    const ghosts = el('g', { filter: `url(#${id}-gb)` });
    (g.haze || []).forEach((h, n) => {
      const fid = `${id}-h${n}`;
      const ramp = h.side === 'left' ? [1, 1, 0, 0] : h.side === 'right' ? [0, 0, 1, 1] : [1, 1, 1, 1];
      defs.insertAdjacentHTML(
        'beforeend',
        `<filter id="${fid}" ${region(vb)}><feGaussianBlur stdDeviation="${h.blur}"/></filter>
         <linearGradient id="${fid}g" gradientUnits="userSpaceOnUse" x1="${box.x}" x2="${box.x + box.w}" y1="0" y2="0">
           <stop offset="0" stop-color="#fff" stop-opacity="${ramp[0]}"/><stop offset="0.35" stop-color="#fff" stop-opacity="${ramp[1]}"/>
           <stop offset="0.65" stop-color="#fff" stop-opacity="${ramp[2]}"/><stop offset="1" stop-color="#fff" stop-opacity="${ramp[3]}"/>
         </linearGradient>
         <mask id="${fid}m" style="mask-type:alpha" maskUnits="userSpaceOnUse" x="${vb.x}" y="${vb.y}" width="${vb.w}" height="${vb.h}">
           <rect x="${vb.x}" y="${vb.y}" width="${vb.w}" height="${vb.h}" fill="url(#${fid}g)"/>
         </mask>`
      );
      const node = textNode(effect, text, h.color, k);
      node.setAttribute('opacity', h.opacity);
      node.setAttribute('transform', `translate(${(h.dx * box.w).toFixed(2)} ${(h.dy * box.h).toFixed(2)})`);
      node.setAttribute('filter', `url(#${fid})`);
      const wrap = el('g', { mask: `url(#${fid}m)` });
      wrap.appendChild(node);
      ghosts.appendChild(wrap);
    });
    for (let i = g.count; i >= 1; i--) {
      const t = i / g.count;
      const node = textNode(effect, text, lerpColor(g.colors, t), k);
      node.setAttribute('opacity', g.opacity(t).toFixed(4));
      node.setAttribute(
        'transform',
        `translate(${cx} ${cy}) rotate(${(g.rotate * t).toFixed(3)}) scale(${(1 + g.scaleX * t).toFixed(4)} ${(1 + g.scaleY * t).toFixed(4)}) translate(${-cx} ${-cy})`
      );
      ghosts.appendChild(node);
    }
    const ghostWrap = g.grain ? el('g', { filter: `url(#${id}-gg)` }) : el('g');
    ghostWrap.appendChild(ghosts);
    svg.appendChild(ghostWrap);

    // Core word on top; for the zoom it fades out toward the ends so the end letters read as streak
    const c = effect.core;
    let coreHtml = `<filter id="${id}-cb" ${region(vb)}><feGaussianBlur stdDeviation="${c.blur}"/></filter>`;
    if (c.grain) coreHtml += grainFilter(`${id}-cg`, vb, c.grain);
    if (c.fade) {
      const [a, b, d, e] = c.fade;
      const f = c.fadeFloor;
      coreHtml += `
        <linearGradient id="${id}-cf" gradientUnits="userSpaceOnUse" x1="${box.x}" x2="${box.x + box.w}" y1="0" y2="0">
          <stop offset="${a}" stop-color="#fff" stop-opacity="${f}"/><stop offset="${b}" stop-color="#fff"/>
          <stop offset="${d}" stop-color="#fff"/><stop offset="${e}" stop-color="#fff" stop-opacity="${f}"/>
        </linearGradient>
        <mask id="${id}-cm" maskUnits="userSpaceOnUse" x="${vb.x}" y="${vb.y}" width="${vb.w}" height="${vb.h}">
          <rect x="${vb.x}" y="${vb.y}" width="${vb.w}" height="${vb.h}" fill="url(#${id}-cf)"/>
        </mask>`;
    }
    defs.insertAdjacentHTML('beforeend', coreHtml);
    const core = textNode(effect, text, c.colors, k);
    core.setAttribute('filter', `url(#${id}-cb)`);
    let coreWrap = core;
    if (c.fade) {
      coreWrap = el('g', { mask: `url(#${id}-cm)` });
      coreWrap.appendChild(core);
    }
    if (c.grain) {
      const gw = el('g', { filter: `url(#${id}-cg)` });
      gw.appendChild(coreWrap);
      coreWrap = gw;
    }
    svg.appendChild(coreWrap);
  }

  /* Zoom-blur variant: only the first and last letters streak, diagonally — the first up-left,
     the last down-right — while the middle of the word stays crisp. */
  function diagonalStack(svg, defs, effect, text, vb, box, id, k) {
    const g = effect.ghosts;
    // a short trail at ~27°, fading fast, so it reads as motion rather than smear
    const dx = box.charW * 0.62;
    const dy = box.charW * 0.32;
    const edge = box.charW * 0.35;
    const fx = (v) => ((v - box.x) / box.w).toFixed(4);
    defs.insertAdjacentHTML(
      'beforeend',
      `<filter id="${id}-gb" ${region(vb)}><feGaussianBlur stdDeviation="${g.blur * 0.7}"/></filter>
       <filter id="${id}-cb" ${region(vb)}><feGaussianBlur stdDeviation="0.35"/></filter>
       <linearGradient id="${id}-lg" gradientUnits="userSpaceOnUse" x1="${box.x}" x2="${box.x + box.w}" y1="0" y2="0">
         <stop offset="0" stop-color="#fff"/><stop offset="${fx(box.firstEnd)}" stop-color="#fff"/>
         <stop offset="${fx(box.firstEnd + edge)}" stop-color="#fff" stop-opacity="0"/>
       </linearGradient>
       <linearGradient id="${id}-rg" gradientUnits="userSpaceOnUse" x1="${box.x}" x2="${box.x + box.w}" y1="0" y2="0">
         <stop offset="${fx(box.lastStart - edge)}" stop-color="#fff" stop-opacity="0"/>
         <stop offset="${fx(box.lastStart)}" stop-color="#fff"/><stop offset="1" stop-color="#fff"/>
       </linearGradient>
       ${['lg', 'rg']
         .map(
           (m) => `<mask id="${id}-${m}m" style="mask-type:alpha" maskUnits="userSpaceOnUse" x="${vb.x}" y="${vb.y}" width="${vb.w}" height="${vb.h}">
             <rect x="${vb.x}" y="${vb.y}" width="${vb.w}" height="${vb.h}" fill="url(#${id}-${m})"/></mask>`
         )
         .join('')}`
    );

    const ghosts = el('g', { filter: `url(#${id}-gb)` });
    [['lg', -1], ['rg', 1]].forEach(([m, dir]) => {
      const side = el('g', { mask: `url(#${id}-${m}m)` });
      for (let i = g.count; i >= 1; i--) {
        const t = i / g.count;
        const node = textNode(effect, text, lerpColor(g.colors, t), k);
        // nearest copies strongest, falling off steeply toward the tip of the trail
        node.setAttribute('opacity', (0.2 * Math.pow(1 - t, 1.7)).toFixed(4));
        node.setAttribute('transform', `translate(${(dir * dx * t).toFixed(2)} ${(dir * dy * t).toFixed(2)})`);
        side.appendChild(node);
      }
      ghosts.appendChild(side);
    });
    svg.appendChild(ghosts);

    // the letters themselves stay whole and crisp, so the word stays clear
    const core = textNode(effect, text, effect.core.colors, k);
    core.setAttribute('filter', `url(#${id}-cb)`);
    svg.appendChild(core);
  }

  /* Calm variant: no motion at all — a soft, bookish italic serif (a handwritten-letter kind of
     voice: trustworthy, unhurried) in gentle focus, wrapped in a faint glow that slowly breathes
     (see .ne-breathe in style.css). */
  const CALM_FONT = { family: "'EB Garamond', 'Cormorant Garamond', Georgia, serif", weight: 500, style: 'italic', stretch: '100%', tracking: 1 };

  function calmStack(svg, defs, effect, text, vb, box, id, k) {
    const calm = effect; // already given the italic serif by render()
    // thin serif hairlines go muddy under much blur, so the core is only just softened
    defs.insertAdjacentHTML(
      'beforeend',
      `<filter id="${id}-halo" ${region(vb)}><feGaussianBlur stdDeviation="6"/></filter>
       <filter id="${id}-soft" ${region(vb)}><feGaussianBlur stdDeviation="0.25"/></filter>`
    );
    const halo = textNode(calm, text, effect.core.colors, k);
    halo.setAttribute('filter', `url(#${id}-halo)`);
    const haloWrap = el('g', { class: 'ne-breathe' });
    haloWrap.appendChild(halo);
    svg.appendChild(haloWrap);
    const core = textNode(calm, text, effect.core.colors, k);
    core.setAttribute('filter', `url(#${id}-soft)`);
    core.setAttribute('opacity', '0.94');
    svg.appendChild(core);
  }

  /* Build the SVG for `text` in `effectName`. `ink` is the text colour (zoom/vibe carry their own
     palettes); `height` is the CSS px height of the glyph box — the SVG is taller so the effect
     has room to bleed. */
  function render(effectName, text, { ink = '#fff', height = 24, palette = null, variant = null, font = null } = {}) {
    let effect = EFFECTS[effectName];
    // zoom/vibe carry their own colours; a palette swaps them (e.g. light-on-dark in the app)
    if (palette && effect.ghosts) {
      const haze = (effect.ghosts.haze || []).map((h, i) => ({ ...h, color: (palette.haze && palette.haze[i]) || h.color }));
      effect = { ...effect, ghosts: { ...effect.ghosts, colors: palette.ghosts, haze }, core: { ...effect.core, colors: palette.core } };
    }
    // the calm variant is set in a soft italic serif — measure it that way so nothing clips
    if (variant === 'calm') effect = { ...effect, font: CALM_FONT };
    // a font override (e.g. trying playful faces for Roaster) keeps the effect, swaps the letters
    if (font) effect = { ...effect, font };
    // Work in device pixels: one user unit ≈ one physical pixel at the requested size
    const dpr = window.devicePixelRatio || 1;
    const k = Math.max(0.25, (height / 1.21) * dpr / SIZE);
    const box = measure(effect, text, k);
    const padX = box.w * effect.pad[0] + SIZE * k * 0.1;
    const padY = box.h * effect.pad[1];
    const vb = { x: box.x - padX, y: box.y - padY, w: box.w + padX * 2, h: box.h + padY * 2 };
    const cx = box.x + box.w / 2;
    const cy = box.y + box.h / 2;
    const scale = height / box.h;
    const id = `ne-${effectName}-${++uid}`;

    const svg = el('svg', {
      viewBox: `${vb.x} ${vb.y} ${vb.w} ${vb.h}`,
      width: (vb.w * scale).toFixed(2),
      height: (vb.h * scale).toFixed(2),
      class: `name-effect name-effect--${effectName}`,
      'aria-hidden': 'true',
    });
    const defs = el('defs');
    svg.appendChild(defs);

    if (effect.ghosts && variant === 'plain') {
      // no effect: just the word, crisp, in the effect's font and core colour
      svg.appendChild(textNode(effect, text, effect.core.colors, k));
      return svg;
    }

    if (effect.ghosts && variant === 'calm') {
      calmStack(svg, defs, effect, text, vb, box, id, k);
      rescaleFilters(svg, k);
      return svg;
    }

    if (effect.ghosts && variant === 'diagonal') {
      diagonalStack(svg, defs, effect, text, vb, box, id, k);
      rescaleFilters(svg, k);
      return svg;
    }

    if (effect.ghosts) {
      ghostStack(svg, defs, effect, text, vb, box, id, k);
      rescaleFilters(svg, k);
      return svg;
    }

    defs.innerHTML = effect.filter({ id, ink, vb, box });
    const filter = defs.querySelector('filter');
    filter.setAttribute('filterUnits', 'userSpaceOnUse');
    filter.setAttribute('x', vb.x);
    filter.setAttribute('y', vb.y);
    filter.setAttribute('width', vb.w);
    filter.setAttribute('height', vb.h);
    const root = el('g', { filter: `url(#${id})` });

    if (effect.focus) {
      // Blend a crisp and a defocused copy with complementary horizontal masks
      const [s0, s1, s2, s3] = effect.focus.stops;
      // Alpha masks (not luminance) so the crisp and soft copies always add up to full coverage
      const grad = (gid, outer, inner) => `
        <linearGradient id="${gid}" gradientUnits="userSpaceOnUse" x1="${box.x}" x2="${box.x + box.w}" y1="0" y2="0">
          <stop offset="${s0}" stop-color="#fff" stop-opacity="${outer}"/><stop offset="${s1}" stop-color="#fff" stop-opacity="${inner}"/>
          <stop offset="${s2}" stop-color="#fff" stop-opacity="${inner}"/><stop offset="${s3}" stop-color="#fff" stop-opacity="${outer}"/>
        </linearGradient>`;
      const mask = (mid, gid) => `
        <mask id="${mid}" style="mask-type:alpha" maskUnits="userSpaceOnUse" x="${vb.x}" y="${vb.y}" width="${vb.w}" height="${vb.h}">
          <rect x="${vb.x}" y="${vb.y}" width="${vb.w}" height="${vb.h}" fill="url(#${gid})"/>
        </mask>`;
      defs.insertAdjacentHTML(
        'beforeend',
        grad(`${id}-gs`, 0, 1) + grad(`${id}-gb`, 1, 0) +
          mask(`${id}-ms`, `${id}-gs`) + mask(`${id}-mb`, `${id}-gb`) +
          `<filter id="${id}-fs" ${region(vb)}><feGaussianBlur stdDeviation="${effect.focus.sharp}"/></filter>` +
          `<filter id="${id}-fb" ${region(vb)}><feGaussianBlur stdDeviation="${effect.focus.soft}"/></filter>`
      );
      const soft = textNode(effect, text, ink, k);
      soft.setAttribute('filter', `url(#${id}-fb)`);
      const sharp = textNode(effect, text, ink, k);
      sharp.setAttribute('filter', `url(#${id}-fs)`);
      const softWrap = el('g', { mask: `url(#${id}-mb)` });
      softWrap.appendChild(soft);
      const sharpWrap = el('g', { mask: `url(#${id}-ms)` });
      sharpWrap.appendChild(sharp);
      root.appendChild(softWrap);
      root.appendChild(sharpWrap);
      svg.appendChild(root);
      rescaleFilters(svg, k);
      return svg;
    }

    const t = textNode(effect, text, '#fff', k);
    if (effect.rotate) t.setAttribute('transform', `rotate(${effect.rotate} ${cx} ${cy})`);
    root.appendChild(t);
    svg.appendChild(root);
    rescaleFilters(svg, k);
    return svg;
  }

  return { EFFECTS, render };
})();
