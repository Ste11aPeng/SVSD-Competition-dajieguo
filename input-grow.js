/* Growing input: the message field wraps long text onto more lines and grows upward with it, like Claude's or
   ChatGPT's box. Height is measured from the text, then eased (strong ease-out, 220ms, set in style.css),
   up to 6 lines, after which the text scrolls inside. Shrinks the same way when text is sent or deleted.
   Return sends (as before); Shift+Return starts a new line. */
(() => {
  const input = document.getElementById('message');
  const field = document.getElementById('field');
  const phone = document.getElementById('phone');
  const composer = document.getElementById('composer');
  if (!input || !field || !phone || input.tagName !== 'TEXTAREA') return;
  const ONE = 52, LINE = 22, PAD = 30, MAX = PAD + LINE * 6;

  function fit() {
    // measure the text's own height: let the box collapse for a moment, read, put it back
    const keep = input.style.cssText;
    input.style.bottom = 'auto';
    input.style.height = '0px';
    const need = input.scrollHeight;
    input.style.cssText = keep;
    const h = Math.max(ONE, Math.min(MAX, need));
    field.style.height = h + 'px';
    phone.style.setProperty('--field-extra', (h - ONE) + 'px');
    input.style.overflowY = need > MAX ? 'auto' : 'hidden';
    // keep the caret line in view when the text scrolls inside
    if (need > MAX) input.scrollTop = input.scrollHeight;
  }

  // every way the text can change: typing, the on-screen keys (they dispatch input), and code setting .value
  input.addEventListener('input', fit);
  const d = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value');
  Object.defineProperty(input, 'value', {
    configurable: true,
    get() { return d.get.call(this); },
    set(v) { d.set.call(this, v); fit(); },
  });
  composer.addEventListener('submit', () => setTimeout(fit, 0));
  addEventListener('resize', fit);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(fit);

  // a physical keyboard: Return sends, Shift+Return is a new line
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
      e.preventDefault();
      if (input.value.trim()) composer.requestSubmit();
    }
  });
  fit();
})();
