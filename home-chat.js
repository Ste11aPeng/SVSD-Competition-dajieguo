/* Home + Chat: switches between the two stages and holds each one's fixed look.
   It drives the (hidden) exploration pickers, so the prototype's own code does the work. */
(() => {
  const phone = document.getElementById('phone');
  const picker = document.getElementById('stagePicker');
  const click = (sel) => { const b = document.querySelector(sel); if (b) b.click(); };

  // looks shared by both stages (in case storage was unavailable for the seeding)
  if (phone.dataset.name !== 'vibe') click('#namePicker [data-name="vibe"]');
  phone.dataset.bubble = 'thread';
  phone.dataset.glare = 'on';
  phone.dataset.chat = '1';

  function show(stage) {
    picker.querySelectorAll('button').forEach((b) =>
      b.setAttribute('aria-checked', String(b.dataset.stage === stage))
    );
    try { localStorage.setItem('hc.stage', stage); } catch {}
    if (stage === 'chat') {
      click('#bgPicker [data-bg="haze"]');
      if (phone.dataset.screen !== 'agents') click('#screenPicker [data-screen="agents"]');
    } else {
      click('#bgPicker [data-bg="vent"]');
      click('#screenPicker [data-screen="5"]');
    }
  }

  picker.addEventListener('mousedown', (e) => e.preventDefault()); // keep the input focused
  picker.addEventListener('click', (e) => {
    const b = e.target.closest('button[data-stage]');
    if (b) show(b.dataset.stage);
  });

  let saved = null;
  try { saved = localStorage.getItem('hc.stage'); } catch {}
  show(saved === 'chat' ? 'chat' : 'home');
})();
