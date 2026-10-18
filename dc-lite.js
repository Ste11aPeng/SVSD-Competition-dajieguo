/* dc-lite: runs a Design-canvas screen (template + `class Component extends DCLogic`) as a plain page.
   The page holds the template in <template id="dc-tpl"> and the logic in <script type="text/x-dc">.
   Supports {{holes}}, <sc-for list as>, <sc-if value>, on* handlers and inline style strings. */
(function () {
  const { createElement: h, Component } = React;
  const HOLE = /\{\{\s*([^}]+?)\s*\}\}/g;
  const ONE = /^\{\{\s*([^}]+?)\s*\}\}$/;

  function lookup(path, scope) {
    path = path.trim();
    if (path === 'true') return true;
    if (path === 'false') return false;
    if (/^-?\d+(\.\d+)?$/.test(path)) return Number(path);
    let v = scope;
    for (const k of path.split('.')) { if (v == null) return undefined; v = v[k]; }
    return v;
  }
  const str = v => (v == null || v === false ? '' : String(v));
  function interp(text, scope) {
    const m = ONE.exec(text);
    if (m) return lookup(m[1], scope);
    return text.replace(HOLE, (_, p) => str(lookup(p, scope)));
  }
  function styleObj(css) {
    const o = {};
    css.split(';').forEach(decl => {
      const i = decl.indexOf(':');
      if (i < 0) return;
      const k = decl.slice(0, i).trim(), v = decl.slice(i + 1).trim();
      if (!k) return;
      o[k.startsWith('--') ? k : k.replace(/-([a-z])/g, (_, c) => c.toUpperCase())] = v;
    });
    return o;
  }
  const RENAME = { class: 'className', for: 'htmlFor', tabindex: 'tabIndex', readonly: 'readOnly', maxlength: 'maxLength', colspan: 'colSpan', rowspan: 'rowSpan', autocomplete: 'autoComplete' };
  const EVENTS = { onclick: 'onClick', oninput: 'onInput', onchange: 'onChange', onpointerdown: 'onPointerDown', onpointerup: 'onPointerUp', onpointermove: 'onPointerMove', onkeydown: 'onKeyDown', onscroll: 'onScroll', onmouseenter: 'onMouseEnter', onmouseleave: 'onMouseLeave', onfocus: 'onFocus', onblur: 'onBlur' };
  const SKIP = /^hint-/;

  function children(node, scope) {
    const out = [];
    node.childNodes.forEach((c, i) => {
      const r = convert(c, scope, i);
      if (r == null) return;
      if (Array.isArray(r)) out.push(...r); else out.push(r);
    });
    return out;
  }
  function convert(node, scope, key) {
    if (node.nodeType === 3) {
      const t = node.nodeValue;
      if (!t.includes('{{')) return t;
      const v = interp(t, scope);
      return v == null || v === false ? null : (typeof v === 'object' ? null : String(v));
    }
    if (node.nodeType !== 1) return null;
    const tag = node.localName;
    if (tag === 'sc-for') {
      const list = interp(node.getAttribute('list') || '', scope) || [];
      const as = node.getAttribute('as') || 'item';
      return list.map((item, i) => h(React.Fragment, { key: i }, children(node, Object.assign(Object.create(scope), { [as]: item, $index: i }))));
    }
    if (tag === 'sc-if') {
      return interp(node.getAttribute('value') || '', scope) ? h(React.Fragment, { key }, children(node, scope)) : null;
    }
    const props = { key };
    for (const a of node.attributes) {
      const n = a.name;
      if (SKIP.test(n)) continue;
      const v = interp(a.value, scope);
      if (EVENTS[n]) { if (typeof v === 'function') props[EVENTS[n]] = v; continue; }
      if (n === 'style') { props.style = styleObj(str(v)); continue; }
      props[RENAME[n] || n] = typeof v === 'boolean' && (n.startsWith('aria-') || n.startsWith('data-')) ? String(v) : v;
    }
    const kids = children(node, scope);
    return h(tag, props, ...kids);
  }

  window.DCLogic = class DCLogic extends Component {
    render() { return children(window.__dcTpl, this.renderVals() || {}); }
  };

  function boot() {
    const tpl = document.getElementById('dc-tpl');
    window.__dcTpl = tpl.content;
    const code = document.querySelector('script[type="text/x-dc"]').textContent;
    const Comp = new Function(code + '\n;return Component;')();
    const root = document.getElementById('dc-root');
    const r = ReactDOM.createRoot(root);
    ReactDOM.flushSync(() => r.render(h(Comp, {})));
    document.dispatchEvent(new CustomEvent('dc:ready'));
  }
  boot(); // scripts sit at the end of <body>, so the template is already parsed
})();
