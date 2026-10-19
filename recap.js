/* After-chat sequence on the agent switcher.
   You come back from the voice chat where you vented to Ride-or-Die, and the home screen carries on:
     1. the messages you sent are already there, and Ride-or-Die starts replying like a friend,
     2. the conversation is stored in the insights bubble (it glows, the star turns, then it cools),
     3. the other two agents light up — they've heard; bring one forward and it replies in its own
        voice (Roaster rants, Calm Sibling asks how you feel). Some wait for you to answer first.
   The panel left of the phone replays it (design exploration). */
(() => {
  const { phone, input } = window.Lava;
  const memories = phone.querySelector('.memories');
  const memoriesIcon = memories.querySelector('.memories-icon');
  const star = memories.querySelector('.memories-star');
  const agents = [...phone.querySelectorAll('.agent')];
  const panel = document.getElementById('seqPanel');
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  const EASE_OUT = 'cubic-bezier(0.23, 1, 0.32, 1)';
  const EASE_IN_OUT = 'cubic-bezier(0.77, 0, 0.175, 1)';
  const DEFAULT_PLACEHOLDER = 'Reply to Ride-or-Die…';

  const VENTED_WITH = 1; // Ride-or-Die
  // What you already said about it, in the voice chat you just left. Every agent's conversation
  // starts from these, so whoever you bring forward already knows the story.
  // `loud` lines are shouted (bigger, brighter); `tilt` ones lean, like they were typed in a temper.
  // *Stars* mark key words, here and in the agents' lines: they flare in colour (see chat styles).
  const HISTORY = [
    { text: 'my package got *stolen* 😭' },
    { text: 'I’m so *MADDDD*', loud: true, tilt: true },
    { text: 'it says delivered and there’s literally a *photo* of it in my lobby' },
    { text: 'I went down and it *WASN’T THERE!!!!!*', loud: true },
    { text: 'this is like the *third time* this month' },
    { emoji: '💀', size: 30, turn: -8 }, // sent one by one, each a little different
    { emoji: '💀', size: 38, turn: 6 },
    { emoji: '💀', size: 46, turn: -3 },
    { text: 'the seller’s not gonna do anything' },
    { text: 'I just want to know *WHO DID THIS*', loud: true },
  ];

  // Each agent picks the story up in its own way, like a friend would. Ride-or-Die (who you vented
  // to) replies straight away; the others speak when you bring them forward. { wait: 'reply' } waits for you
  // to send something back; { chips } offers quick replies that fill the field; { react } sticks an
  // emoji on one of your messages (a history index, 'last' of the history, or 'reply' for your latest);
  // { act, ms } is the agent doing something for you, shown in place of its name ("Drafting…").
  // { draft } shows an email it wrote for you; nothing is sent until you tap Send on it (agents never
  // contact the building or a seller without your okay). { stopIf, say } ends the script with that line
  // when your last reply matches ("not yet", "just the building").
  // How each one types: the motion of its words, how fast it types and how long it pauses after.
  // Shouted words (ALL CAPS, or carrying !! / ??) count as key words and flare.
  const VOICES = {
    // Ride-or-Die: the "Vibe" name style's wide face; words arrive with a light smear that settles
    // (a hint of the Vibe streak, kept soft so it never reads as blur)
    ride: {
      word: [
        { opacity: 0, filter: 'blur(2px)', transform: 'translateX(-5px) scaleX(1.12)' },
        { opacity: 1, filter: 'blur(0px)', transform: 'none' },
      ],
      duration: 520,
      step: 75,
      easing: EASE_OUT,
      typing: (n) => Math.min(11000, 800 + n * 110), // about a friend's thumb-typing pace
      after: 900,
    },
    // Roaster: loud and fast, words slam in from big and blurry (and stay put once they land)
    roast: {
      word: [
        { opacity: 0, transform: 'scale(1.8)', filter: 'blur(6px)' },
        { opacity: 1, transform: 'scale(0.94)', filter: 'blur(0px)', offset: 0.55 },
        { opacity: 1, transform: 'none', filter: 'blur(0px)' },
      ],
      duration: 300,
      step: 55,
      easing: 'cubic-bezier(0.2, 0, 0, 1)',
      typing: (n) => Math.min(9000, 600 + n * 85), // types fast when fired up
      after: 700,
    },
    // Calm Sibling: unhurried, words come slowly into focus
    calm: {
      word: [
        { opacity: 0, filter: 'blur(8px)', transform: 'translateY(3px)' },
        { opacity: 1, filter: 'blur(0px)', transform: 'none' },
      ],
      duration: 1000,
      step: 120,
      easing: 'ease',
      typing: (n) => Math.min(12000, 1200 + n * 130), // unhurried
      after: 1300,
    },
  };
  const SHOUT = /^[^a-z]*[A-Z]{2,}[^a-z]*$|!!|\?\?/; // ALL CAPS, or !! / ??

  const OPENERS = {
    1: {
      name: 'Ride-or-Die',
      voice: 'ride',
      placeholder: 'Reply to Ride-or-Die…',
      script: [
        { react: 1, emoji: '🫂' }, // a hug on "I'm so MADDDD"
        { say: 'nooo, *not again* 😩' },
        { say: 'a photo of it in your lobby and then it’s just *gone??* that’s so *messed up.*' },
        { say: 'you shouldn’t have to *guard your own mail.*' },
        { say: 'want to figure out who’s doing this *together?*' },
        { wait: 'reply' },
        { react: 'reply', emoji: '🤝' },
        { say: 'ok, I’m with you. first stop: the *lobby camera.* let me find who runs your building.' },
        { act: 'Searching…', ms: 2200 },
        { act: 'Drafting…', ms: 2400 },
        { say: 'found the building office. here’s what I’d send, *check it first* 👇' },
        { draft: {
          to: 'Maple Court Management <office@maplecourtliving.com>',
          subject: 'Package taken from the lobby today: camera footage?',
          body: [
            'Hi,',
            'A package of mine was marked delivered today, with a photo of it in our lobby, but it was gone when I went down to get it. This is the third time this month.',
            'Could you check today’s lobby camera footage and let me know what you find? I’m happy to share the delivery photo and time.',
            'Thanks,\nCherry, Unit 4B',
          ],
        } },
        { act: 'Sending…', ms: 1400 },
        { say: 'sent ✉️ I’ll tell you the second they reply.' },
        { say: 'want me to go after the *seller* too?' },
        { chips: ['Contact the seller'] },
        // only once you ask for the seller does the second email come up
        { wait: 'reply' },
        { say: 'I located the *seller’s email,* drafting an email right now' },
        { act: 'Drafting…', ms: 2400 },
        { say: 'here’s what I’d send, *check it first* 👇' },
        { draft: {
          to: 'Northline Home Support <support@northlinehome.com>',
          subject: 'Order marked delivered but never arrived: resend or refund?',
          body: [
            'Hi,',
            'My order was marked delivered today, with a photo of it in my building lobby, but it was gone when I went down to get it. This is the third time this month.',
            'Could you open a delivery claim and either resend the order or refund it? I’m happy to share the delivery photo and time.',
            'Thanks,\nCherry, Unit 4B',
          ],
        } },
        { act: 'Sending…', ms: 1400 },
        { say: 'sent ✉️ I’ll *let you know* the second they respond.' },
        { say: 'and if you need it *today,* the nearest CVS has the same item in stock 👇' },
        { place: {
          name: 'CVS Pharmacy',
          dist: '0.4 mi · 8 min walk',
          address: '212 Maple Ave',
          hours: 'Open until 10 PM',
          aisle: 'Aisle 17',
          stock: 'In stock',
        } },
        // then, whatever you say next: if it is about letting your friend know (any wording), a text for her
        { wait: 'reply' },
        { ifReply: 'friend|update|tell (her|him|them)|let (her|him|them) know|text (her|him|them)|message (her|him|them)|send (it )?to|pick up', say: 'good call, she should know. here’s a *text* you can send her 👇' },
        { ifReply: 'friend|update|tell (her|him|them)|let (her|him|them) know|text (her|him|them)|message (her|him|them)|send (it )?to|pick up', act: 'Drafting…', ms: 2000 },
        { ifReply: 'friend|update|tell (her|him|them)|let (her|him|them) know|text (her|him|them)|message (her|him|them)|send (it )?to|pick up', draft: {
          to: 'Maya (text message)',
          body: [
            'hey! heads up: packages keep disappearing from our lobby. mine was gone within 10 min of the “delivered” photo, 3rd time this month. I’ve asked the building for the camera footage.',
            'can you grab yours the minute it shows delivered? don’t let it sit 🙏',
          ],
        } },
        { ifReply: 'friend|update|tell (her|him|them)|let (her|him|them) know|text (her|him|them)|message (her|him|them)|send (it )?to|pick up', act: 'Sending…', ms: 1100 },
        { ifReply: 'friend|update|tell (her|him|them)|let (her|him|them) know|text (her|him|them)|message (her|him|them)|send (it )?to|pick up', say: 'sent 💬 she’ll see it right away.' },
        { unlessReply: 'friend|update|tell (her|him|them)|let (her|him|them) know|text (her|him|them)|message (her|him|them)|send (it )?to|pick up', say: 'got it. I’ll keep watching for the building and the seller, and tell you the second either one replies.' },
      ],
    },
    0: {
      name: 'Roaster',
      voice: 'roast',
      placeholder: 'Reply to Roaster…',
      script: [
        { react: 'last', emoji: '😤', look: 'thought' }, // fuming right along with "WHO DID THIS"
        { say: 'WAIT. what??' },
        { say: 'marked delivered, WITH a photo, in YOUR lobby… and then just gone??' },
        { say: 'third time this month?!' },
        { say: 'why are people taking stuff that isn’t THEIRS!!! genuinely EVIL behavior. who raised them' },
        { wait: 'reply' },
        { say: 'like imagine strolling through SOMEONE ELSE’S lobby and going “mine now” 💀' },
        { say: 'the AUDACITY. the confidence. they probably didn’t even need it' },
        { say: 'I feel so bad, this happened to me too. someone took my air fryer and I STILL think about it' },
        { wait: 'reply' },
        { say: 'and the courier taking a PHOTO of it just sitting there?? like a trophy for the thief' },
        { say: 'honestly your lobby needs a bouncer. a big one. named Gary' },
        { wait: 'reply' },
        { say: 'ok real talk. want me to write the building a note asking for the lobby footage? I won’t send ANYTHING without your ok' },
        { chips: ['Yeah, draft it', 'Not yet, just be mad with me'] },
        { wait: 'reply' },
        { stopIf: 'not yet|just be mad|^no|nah|later', say: 'fine. we stay mad. I’m right here whenever you want to do something about it 🔥' },
        { act: 'Searching…', ms: 1800 },
        { act: 'Drafting…', ms: 2000 },
        { say: 'here. VERY polite 😇 against my will. read it before anything goes out' },
        { draft: {
          to: 'Maple Court Management <office@maplecourtliving.com>',
          subject: 'Third stolen package this month: please check the lobby camera',
          body: [
            'Hello,',
            'Today a package was marked delivered with a photo of it in the lobby, and it was taken before I could pick it up. This has now happened three times this month.',
            'Please review today’s lobby camera footage and let me know what it shows. I’d also like to know what the building can do to stop this from happening again.',
            'Thank you,\nCherry, Unit 4B',
          ],
        } },
        { act: 'Sending…', ms: 1100 },
        { say: 'SENT. now we wait. and judge.' },
      ],
    },
    2: {
      name: 'Calm Sibling',
      voice: 'calm',
      placeholder: 'Reply to Calm Sibling…',
      script: [
        { react: 0, emoji: '🫶' }, // on "my package got stolen 😭"
        { say: 'Hey. I heard about the package.' },
        { say: '*How are you feeling* about it right now?' },
        { wait: 'reply' },
        { say: 'That makes sense. Three times would *wear anyone down.*' },
        { say: 'The building office is closed today. I can *draft a note to them* for you, so you don’t have to deal with it on a Sunday. Nothing gets sent without your okay. Want me to?' },
        { chips: ['Yes, please', 'Show me first'] },
        { wait: 'reply' },
        { act: 'Drafting…', ms: 2800 },
        { say: 'Here’s the note to the building. Nothing goes out until you say so.' },
        { draft: {
          to: 'Maple Court Management <office@maplecourtliving.com>',
          subject: 'Missing package from the lobby today',
          body: [
            'Hi there,',
            'A package was delivered to the lobby for me today (the courier left a photo), but it wasn’t there when I came down. It’s the third time this month, so I wanted to let you know.',
            'When the office opens, could someone look at today’s lobby camera footage? Thank you for your help.',
            'Best,\nCherry, Unit 4B',
          ],
        } },
        { act: 'Sending…', ms: 1300 },
        { say: 'Sent to the building.' },
        { say: 'Do you want me to *write to the seller* too, so they can refund or resend it? Only if you’d like.' },
        { chips: ['Yes, draft it', 'Just the building'] },
        { wait: 'reply' },
        { stopIf: 'just the building|^no|not now|later', say: 'Okay, just the building for now. *I’ll keep you posted.* Rest a little.' },
        { act: 'Drafting…', ms: 2200 },
        { say: 'Here’s the note to the seller. It only goes out if you send it.' },
        { draft: {
          to: 'Northwind Goods Support <help@northwindgoods.com>',
          subject: 'Order #48213: delivered but stolen from my lobby',
          body: [
            'Hi,',
            'My order #48213 was marked delivered today, with a photo of it in my building’s lobby, but it was taken before I could collect it. I’ve asked the building to check their camera.',
            'Could you refund or resend the order? I can share the delivery photo if that helps.',
            'Thank you,\nCherry',
          ],
        } },
        { act: 'Sending…', ms: 1300 },
        { say: 'Sent. *I’ll keep you posted.* Rest a little.' },
      ],
    },
  };

  /* ───────────── Scene setup ───────────── */

  const el = (tag, cls, text) => {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  };

  // The space between the names and the composer, where the conversation lives
  const stage = el('div', 'recap-stage');
  stage.setAttribute('aria-live', 'polite');
  document.getElementById('fxLabels').after(stage);

  // Insights bubble: a glass glow with gold liquid inside, for the moment an insight is stored
  const core = el('span', 'memories-core');
  const pool = el('span', 'memories-pool');
  core.append(pool);
  memories.querySelector('.memories-button').after(core);

  /* ───────────── Run control ───────────── */

  // Every async step checks it's still the current run, so Replay can interrupt anything
  let run = 0;
  let timers = [];
  const alive = (id) => id === run;
  const wait = (ms) => new Promise((res) => timers.push(setTimeout(res, ms)));
  const later = (fn, ms) => timers.push(setTimeout(fn, ms));

  /* ───────────── 1 · Stored in the insights bubble ───────────── */

  // Stored in the insights bubble. Every version stays inside the bubble and shares the same beats:
  // a gold light gathers while the glyph warms to gold, its bubbles swell in a wave (foam) and its
  // star turns once around; when the turn ends, the light and the glyph's gold fade out together.
  // What differs is the light itself (panel: "Stored in insights").
  const GATHER = 750; // the light gathers slowly and softly
  const PLAY = 1500; // how long it plays before everything cools
  const SOFT = 'cubic-bezier(0.37, 0, 0.63, 1)'; // gentle sine in-out: no hard start, no hard landing

  // Each version's light, drawn inside the bubble (the core clips it to the circle)
  const LIGHTS = {
    // Glass+: the glass glow, brighter: a lit rim, and gold liquid swaying up through the bubble
    glass() {
      pool.animate(
        [
          { transform: 'translate(0, 60%) scale(0.9)', easing: SOFT },
          { transform: 'translate(-6%, 4%) scale(1.05)', offset: 0.35, easing: SOFT },
          { transform: 'translate(6%, -4%) scale(1.1)', offset: 0.62, easing: SOFT },
          { transform: 'translate(-2%, 2%) scale(1.05)' },
        ],
        { duration: PLAY, fill: 'forwards' }
      );
      core.animate(
        [
          { boxShadow: 'inset 0 0 6px 1px rgba(255, 214, 130, 0.2)' },
          { boxShadow: 'inset 0 0 12px 3px rgba(255, 214, 130, 0.75)', offset: 0.5 },
          { boxShadow: 'inset 0 0 9px 2px rgba(255, 214, 130, 0.5)' },
        ],
        { duration: PLAY, easing: SOFT, fill: 'forwards' }
      );
    },
    // Caustics: light refracting through water, gold patches drifting and turning inside the glass
    caustic() {
      fx('caustic').animate(
        [
          { transform: 'translate(-8%, 6%) rotate(0deg) scale(0.95)' },
          { transform: 'translate(8%, -6%) rotate(80deg) scale(1.15)' },
        ],
        { duration: PLAY + 700, easing: SOFT, fill: 'forwards' }
      );
    },
    // Lava lamp: three soft gold blobs float up through the bubble at their own pace, meeting and parting
    lamp() {
      const lamp = fx('lamp');
      [
        { x: 30, size: 46, dur: 1500, delay: 0, sway: 8 },
        { x: 62, size: 36, dur: 1300, delay: 160, sway: -10 },
        { x: 45, size: 28, dur: 1150, delay: 340, sway: 6 },
      ].forEach((b) => {
        const blob = el('span', 'memories-blob');
        blob.style.left = `${b.x - b.size / 2}%`;
        blob.style.width = blob.style.height = `${b.size}%`;
        lamp.append(blob);
        blob.animate(
          [
            { transform: 'translate(0, 260%)', easing: SOFT },
            { transform: `translate(${b.sway}%, 60%)`, offset: 0.5, easing: SOFT },
            { transform: `translate(${-b.sway}%, -150%)` },
          ],
          { duration: b.dur, delay: b.delay, fill: 'both' }
        );
      });
    },
    // Swirl: a vortex of gold turns inside the glass while the star turns the other way
    swirl() {
      fx('swirl').animate(
        [
          { transform: 'rotate(0deg) scale(0.8)', opacity: 0 },
          { transform: 'rotate(260deg) scale(1.05)', opacity: 1, offset: 0.45 },
          { transform: 'rotate(540deg) scale(1.15)', opacity: 0.8 },
        ],
        { duration: PLAY, easing: 'cubic-bezier(0.23, 1, 0.32, 1)', fill: 'forwards' }
      );
    },
    // Starlight: the star swells and shines, throwing slow-turning rays across the bubble
    starlight() {
      fx('rays').animate(
        [
          { transform: 'rotate(-20deg)', opacity: 0 },
          { transform: 'rotate(10deg)', opacity: 1, offset: 0.45 },
          { transform: 'rotate(40deg)', opacity: 0.7 },
        ],
        { duration: PLAY, easing: SOFT, fill: 'forwards' }
      );
    },
  };

  function fx(kind) {
    const node = el('span', `memories-fx memories-fx--${kind}`);
    core.append(node);
    return node;
  }

  function clearLights() {
    core.querySelectorAll('.memories-fx').forEach((n) => n.remove());
  }

  function store(kind = storeKind) {
    clearLights();
    core.dataset.v = kind;
    memories.classList.add('has-insight');
    const peak = GATHER / PLAY;
    memories.animate(
      [
        { transform: 'scale(1)', easing: SOFT },
        { transform: 'scale(1.04)', offset: peak, easing: SOFT },
        { transform: 'scale(1)' },
      ],
      { duration: PLAY }
    );
    // the light gathers and holds until the fade
    core.animate(
      [
        { opacity: 0, easing: SOFT },
        { opacity: 1, offset: peak, easing: 'ease' },
        { opacity: 0.85 },
      ],
      { duration: PLAY, fill: 'forwards' }
    );
    memoriesIcon.animate(
      [
        { filter: 'grayscale(1) brightness(0.95)', easing: SOFT },
        { filter: 'grayscale(0) brightness(1.45)', offset: peak, easing: 'ease' },
        { filter: 'grayscale(0) brightness(1.15)' },
      ],
      { duration: PLAY }
    );
    if (reduceMotion.matches) return fadeInsight(PLAY);
    LIGHTS[kind]();
    // the star turns once; it lifts (and in Starlight it swells and shines), and in Swirl it turns
    // against the current
    const turn = kind === 'swirl' ? -360 : 360;
    const lift = kind === 'starlight' ? 1.7 : 1.35;
    const shine = kind === 'starlight' ? 'drop-shadow(0 0 2px #ffd36b) brightness(1.3)' : 'drop-shadow(0 0 1px #ffd36b)';
    star.animate(
      [
        { transform: 'rotate(0deg) scale(1)', filter: 'drop-shadow(0 0 0 transparent)' },
        { transform: `rotate(${turn / 2}deg) scale(${lift})`, filter: shine, offset: 0.5 },
        { transform: `rotate(${turn}deg) scale(1)`, filter: 'drop-shadow(0 0 0 transparent)' },
      ],
      { duration: PLAY, easing: SOFT }
    );
    foam();
    fadeInsight(PLAY);
  }

  // Foam: each bubble (a hole in the glyph's outline) swells and settles in turn, always evenly,
  // never stretched, in a wave round the cluster; meanwhile a soft displacement makes the outline
  // flow, so neighbouring bubbles seem to blob into each other and part again
  const holes = [...memories.querySelectorAll('.foam-hole')];
  const WAVE = ['bottom-left', 'middle', 'tiny', 'big', 'dot', 'top-left'];
  const liquidMap = memories.querySelector('#foam-liquid feDisplacementMap');
  const liquidNoise = memories.querySelector('#foam-liquid feTurbulence');
  let liquidRaf = 0;

  function foam() {
    holes.forEach((h) => {
      const amp = h.dataset.bubble === 'big' ? 0.07 : 0.18; // the big bubble moves least
      h.animate(
        [
          { transform: 'scale(1)' },
          { transform: `scale(${1 + amp})`, offset: 0.35 },
          { transform: `scale(${1 - amp * 0.4})`, offset: 0.65 },
          { transform: `scale(${1 + amp * 0.12})`, offset: 0.85 },
          { transform: 'scale(1)' },
        ],
        { duration: PLAY - 400, delay: WAVE.indexOf(h.dataset.bubble) * 80, easing: 'ease-in-out' }
      );
    });
    cancelAnimationFrame(liquidRaf);
    const t0 = performance.now();
    const frame = (now) => {
      const t = Math.min(1, (now - t0) / PLAY);
      liquidMap.setAttribute('scale', (0.9 * Math.sin(Math.PI * t)).toFixed(3)); // in, peak, out
      liquidNoise.setAttribute('baseFrequency', (0.1 + 0.04 * t).toFixed(4)); // and it drifts
      if (t < 1) liquidRaf = requestAnimationFrame(frame);
      else liquidMap.setAttribute('scale', '0');
    };
    liquidRaf = requestAnimationFrame(frame);
  }

  function stopFoam() {
    cancelAnimationFrame(liquidRaf);
    liquidMap.setAttribute('scale', '0');
  }

  // The gold cools back to the resting bubble: whatever light is left fades, the glyph eases back to grey
  let fadeTimer = 0;
  function fadeInsight(after) {
    clearTimeout(fadeTimer);
    fadeTimer = setTimeout(() => {
      // the light and the glyph's gold fade out together, on one curve
      const out = { duration: 700, easing: 'ease', fill: 'forwards' };
      const fade = core.animate([{ opacity: getComputedStyle(core).opacity }, { opacity: 0 }], out);
      const cool = memoriesIcon.animate([{ filter: getComputedStyle(memoriesIcon).filter }, { filter: 'grayscale(1) brightness(0.95)' }], out);
      fade.finished
        .then(() => {
          memories.classList.remove('has-insight');
          core.getAnimations({ subtree: true }).forEach((a) => a.cancel()); // the liquid too
          clearLights();
          cool.cancel();
        })
        .catch(() => {});
    }, after);
  }

  /* ───────────── 2 · The other agents light up ───────────── */

  function cueAgents() {
    const light = () => agents.forEach((a, i) => {
      if (i === VENTED_WITH) return;
      later(() => a.classList.add('has-news'), 120 + (i === 2 ? 160 : 0));
    });
    // after a call, the "Saved to memories" tooltip has the stage first; the glow and zoom follow a beat after it's gone
    const tip = window.MemoryTip;
    if (tip && tip.pending) {
      const id = run;
      window.addEventListener('memorytip:done', () => { if (alive(id)) later(light, 350); }, { once: true });
    } else light();
  }

  /* ───────────── 3 · Each agent replies, in its own voice ───────────── */

  // One conversation per agent, kept while you spin between them. Not bubbles: one column of text,
  // the agent's words in its own colour (appearing word by word, as if typed), yours in soft white.
  const composer = document.getElementById('composer');
  const convos = {}; // agent -> { node, list, waiting, answered, history, replies }
  let convoRun = 0;

  function land(node) {
    node.animate(
      [
        { opacity: 0, transform: 'translateY(6px)', filter: 'blur(3px)' },
        { opacity: 1, transform: 'none', filter: 'blur(0px)' },
      ],
      { duration: 380, easing: EASE_OUT, fill: 'backwards' }
    );
  }

  // Whatever you send goes into the conversation in front straight away. If that agent is waiting
  // for your answer it carries on; if it's still typing, your answer is kept for when it asks.
  composer.addEventListener('submit', () => {
    const c = convos[Number(phone.dataset.agent)];
    const text = input.value.trim();
    if (!c || !text) return;
    const mine = el('p', 'op-msg op-msg--me', text);
    push(c.list, mine);
    c.replies.push(mine);
    land(mine);
    c.node.scrollTo({ top: c.node.scrollHeight, behavior: reduceMotion.matches ? 'auto' : 'smooth' });
    input.value = '';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    if (c.waiting) {
      c.waiting();
      c.waiting = null;
    } else {
      c.answered++;
    }
  });

  // Splits a line into words, marking key words: *starred* phrases, and (for agents) shouted words
  function wordsOf(text, shout) {
    let inKw = false;
    return text.split(' ').map((tok) => {
      const opens = tok.startsWith('*');
      const t = opens ? tok.slice(1) : tok;
      const closes = t.endsWith('*');
      const w = closes ? t.slice(0, -1) : t;
      const kw = inKw || opens || (shout && SHOUT.test(w));
      if (opens && !closes) inKw = true;
      if (closes) inKw = false;
      return { w, kw };
    });
  }

  // A place the agent found: where it is, how far, when it closes and which aisle, with two actions
  function copyText(text) {
    const done = () => true;
    if (navigator.clipboard && navigator.clipboard.writeText) return navigator.clipboard.writeText(text).then(done, () => legacyCopy(text));
    return Promise.resolve(legacyCopy(text));
  }
  function legacyCopy(text) {
    const t = document.createElement('textarea');
    t.value = text; t.setAttribute('readonly', ''); t.style.cssText = 'position:fixed;opacity:0;top:0;left:0';
    document.body.appendChild(t); t.select();
    let ok = false;
    try { ok = document.execCommand('copy'); } catch (e) {}
    t.remove();
    return ok;
  }
  function placeCard(p) {
    const card = el('div', 'op-draft op-place');
    const label = el('p', 'op-draft-label', 'Nearby · ' + p.stock);
    const top = el('div', 'op-place-top');
    top.append(el('span', 'op-place-name', p.name), el('span', 'op-place-dist', p.dist));
    const addr = el('p', 'op-place-addr', p.address);
    const meta = el('p', 'op-place-meta', p.hours + ' · ' + p.aisle);
    const actions = el('div', 'op-draft-actions');
    const copy = el('button', 'op-draft-btn', 'Copy address');
    copy.type = 'button';
    copy.addEventListener('click', () => {
      Promise.resolve(copyText(p.name + ', ' + p.address)).then((ok) => {
        if (!ok) return;
        copy.textContent = 'Copied ✓';
        setTimeout(() => { copy.textContent = 'Copy address'; }, 1600);
      });
    });
    const go = el('a', 'op-draft-btn op-draft-btn--send', 'Navigate');
    go.href = 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(p.name + ' ' + p.address);
    go.target = '_blank';
    go.rel = 'noopener';
    actions.append(copy, go);
    card.append(label, top, addr, meta, actions);
    return card;
  }

  // An email the agent drafted for you, shown in the chat before anything is sent.
  // Edit makes the message editable in place; Send is the only way it goes out.
  function draftCard(d) {
    const card = el('div', 'op-draft');
    const label = el('p', 'op-draft-label', 'Draft · not sent');
    const head = el('div', 'op-draft-head');
    [['To', d.to], ['Subject', d.subject]].filter(([, v]) => v).forEach(([k, v]) => { // a text message has no subject
      const row = el('p', 'op-draft-row');
      row.append(el('span', 'op-draft-key', k), el('span', 'op-draft-val', v));
      head.append(row);
    });
    const body = el('div', 'op-draft-body');
    d.body.forEach((t) => body.append(el('p', null, t)));
    const actions = el('div', 'op-draft-actions');
    const edit = el('button', 'op-draft-btn', 'Edit');
    const send = el('button', 'op-draft-btn op-draft-btn--send', 'Send');
    edit.type = 'button';
    send.type = 'button';
    edit.addEventListener('click', () => {
      const editing = !card.classList.contains('is-editing');
      card.classList.toggle('is-editing', editing);
      body.contentEditable = editing ? 'true' : 'false';
      edit.textContent = editing ? 'Done' : 'Edit';
      if (editing) {
        window.Lava.setKeyboard(false);
        body.focus();
      }
    });
    send.addEventListener('click', () => {
      body.contentEditable = 'false';
      card.classList.remove('is-editing');
      card.classList.add('is-sent');
      label.textContent = 'Sending…';
      actions.remove();
      setTimeout(() => { label.textContent = 'Sent ✓'; }, 1300);
      card.dispatchEvent(new Event('draft:send'));
    });
    actions.append(edit, send);
    card.append(label, head, body, actions);
    return card;
  }

  // A line of words; key words get the flare (static ones just rest in their flared colour)
  function lineOf(cls, text, { shout = false, still = false } = {}) {
    const p = el('p', cls);
    const words = wordsOf(text, shout);
    words.forEach(({ w, kw }, k) => {
      p.append(el('span', kw ? `kw${still ? ' is-static' : ''}` : null, w), k < words.length - 1 ? ' ' : '');
    });
    return p;
  }

  // Appends to a conversation, noting where it changes hands (some chat styles leave more room there)
  function push(list, node) {
    const mine = node.classList.contains('op-msg--me') || node.classList.contains('op-chips');
    const prev = list.lastElementChild;
    if (prev) {
      const prevMine = prev.classList.contains('op-msg--me') || prev.classList.contains('op-chips');
      node.classList.toggle('is-turn', mine !== prevMine);
    }
    list.append(node);
  }

  // A reaction sticker on one of your messages, like a tapback: a round badge tucked under its
  // corner, or (look: 'thought') a little thought bubble floating above it. It pops on with a spring.
  function react(msg, emoji, look) {
    const sticker = el('span', `op-react${look === 'thought' ? ' op-react--thought' : ''}`);
    sticker.append(el('span', 'op-react-emoji', emoji));
    if (look === 'thought') sticker.append(el('i', 'op-react-dot'), el('i', 'op-react-dot op-react-dot--small'));
    msg.classList.add('has-react');
    if (look === 'thought') msg.classList.add('has-react--thought');
    msg.append(sticker);
    if (reduceMotion.matches) return;
    sticker.animate(
      [
        { opacity: 0, transform: 'scale(0.5) rotate(-18deg)' },
        { opacity: 1, transform: 'scale(1.18) rotate(6deg)', offset: 0.55 },
        { opacity: 1, transform: 'scale(0.96) rotate(-2deg)', offset: 0.8 },
        { opacity: 1, transform: 'none' },
      ],
      { duration: 520, easing: EASE_OUT }
    );
  }

  // Resolves once you've answered (at once, if you already did while it was typing)
  function nextReply(c) {
    if (c.answered > 0) {
      c.answered--;
      return Promise.resolve();
    }
    return new Promise((res) => (c.waiting = res));
  }

  // The conversation with the agent in front is the only one showing
  function showConvo(agent) {
    Object.entries(convos).forEach(([a, c]) => c.node.classList.toggle('is-away', Number(a) !== agent));
    stage.dataset.agent = String(agent);
    input.placeholder = (OPENERS[agent] && OPENERS[agent].placeholder) || DEFAULT_PLACEHOLDER;
    paintStatus();
  }

  // When the keyboard opens or closes the space changes size; keep the newest lines in view
  new ResizeObserver(() => {
    stage.querySelectorAll('.op-thread:not(.is-away)').forEach((t) => (t.scrollTop = t.scrollHeight));
  }).observe(stage);

  // What each agent is up to ("Typing…", "Searching…"), shown in place of its name while it lasts,
  // like a friend's status at the top of a chat. Only the agent in front shows its status.
  const statusLine = el('div', 'agent-status');
  statusLine.setAttribute('aria-live', 'polite');
  stage.before(statusLine);
  const statuses = {}; // agent -> text

  function setStatus(agent, text) {
    if (text) statuses[agent] = text;
    else delete statuses[agent];
    paintStatus();
  }

  function paintStatus() {
    const agent = Number(phone.dataset.agent);
    const text = statuses[agent];
    if (text) {
      const key = `${text}|${agent}|${phone.dataset.name}`;
      if (statusLine.dataset.key !== key) {
        statusLine.dataset.key = key;
        // drawn just like the agent's name: the same name style, size and colours
        const svg = window.Lava.nameGraphic(text, agent);
        statusLine.classList.toggle('is-fx', !!svg);
        if (svg) {
          svg.setAttribute('role', 'img');
          svg.setAttribute('aria-label', text);
          svg.removeAttribute('aria-hidden');
          statusLine.replaceChildren(svg);
        } else {
          statusLine.textContent = text;
          statusLine.style.color = window.Lava.nameColor(agent);
        }
        statusLine.animate(
          [
            { opacity: 0, filter: 'blur(2px)', transform: 'translateY(2px)' },
            { opacity: 1, filter: 'blur(0px)', transform: 'none' },
          ],
          { duration: 200, easing: EASE_OUT }
        );
      }
      phone.dataset.status = 'on';
    } else {
      delete phone.dataset.status;
      delete statusLine.dataset.key;
      statusLine.replaceChildren();
    }
  }

  function closeConvos() {
    convoRun++;
    Object.keys(statuses).forEach((k) => delete statuses[k]);
    paintStatus();
    Object.values(convos).forEach((c) => c.node.remove());
    Object.keys(convos).forEach((k) => delete convos[k]);
  }

  // `arriving`: you've just come back from the voice chat, so give it a moment before they reply
  async function playOpener(agent, arriving = false) {
    const o = OPENERS[agent];
    if (!o || convos[agent]) return;
    const run = convoRun;
    const still = () => run === convoRun;
    const pause = (ms) => new Promise((res) => setTimeout(res, ms));
    const node = el('div', 'op-thread');
    node.dataset.agent = String(agent);
    const list = el('div', 'op-list');
    node.append(list);
    stage.append(node);
    const c = { node, list, waiting: null, answered: 0, history: [], replies: [] };
    convos[agent] = c;
    showConvo(agent);
    const follow = () => node.scrollTo({ top: node.scrollHeight, behavior: reduceMotion.matches ? 'auto' : 'smooth' });
    // what you already said in the voice chat: already sent, so it's simply there, no animation
    HISTORY.forEach((m) => {
      if (m.emoji) {
        const e = el('p', 'op-msg op-msg--me is-emoji', m.emoji);
        e.style.fontSize = `${m.size}px`;
        e.style.transform = `rotate(${m.turn}deg)`;
        push(list, e);
        c.history.push(e);
        return;
      }
      const mine = lineOf(`op-msg op-msg--me${m.loud ? ' is-loud' : ''}${m.tilt ? ' is-tilted' : ''}`, m.text, { still: true });
      push(list, mine);
      c.history.push(mine);
    });
    node.scrollTop = node.scrollHeight;
    await pause(arriving ? 1600 : 900); // a beat before they start typing
    if (!still()) return;

    for (const m of o.script) {
      if (m.wait) {
        await nextReply(c);
        if (!still()) return;
        await pause(600);
        if (!still()) return;
        continue;
      }
      // { ifReply / unlessReply: pattern } on any step: only when your last reply does (or doesn't) match it
      if (m.ifReply || m.unlessReply) {
        const last = c.replies[c.replies.length - 1];
        const said = last ? last.textContent.trim() : '';
        if (m.ifReply && !new RegExp(m.ifReply, 'i').test(said)) continue;
        if (m.unlessReply && new RegExp(m.unlessReply, 'i').test(said)) continue;
      }
      if (m.act) {
        setStatus(agent, m.act);
        await pause(m.ms);
        if (!still()) return;
        continue;
      }
      if (m.react != null) continue; // emoji reactions on your messages are switched off
      // { stopIf, say }: if your last reply matches (e.g. you said "not yet"), say this and end here
      let lastLine = false;
      if (m.stopIf) {
        const last = c.replies[c.replies.length - 1];
        if (!last || !new RegExp(m.stopIf, 'i').test(last.textContent.trim())) continue;
        lastLine = true;
      }
      if (m.draft) {
        // nothing is sent on its own: the draft waits in the chat until you tap Send
        setStatus(agent, null);
        const card = draftCard(m.draft);
        push(list, card);
        follow();
        await new Promise((res) => card.addEventListener('draft:send', res, { once: true }));
        if (!still()) return;
        continue;
      }
      if (m.place) {
        setStatus(agent, null);
        const card = placeCard(m.place);
        push(list, card);
        land(card);
        follow();
        await pause(900);
        if (!still()) return;
        continue;
      }
      if (m.chips) {
        const row = el('div', 'op-chips');
        m.chips.forEach((t) => {
          const b = el('button', 'op-chip', t);
          b.type = 'button';
          b.addEventListener('mousedown', (e) => e.preventDefault()); // keep focus in the field
          b.addEventListener('click', () => {
            input.value = t;
            input.dispatchEvent(new Event('input', { bubbles: true }));
            window.Lava.setKeyboard(true);
            // chosen: the quick replies have done their job, so the row steps aside (quick, soft, collapsing so the chat settles)
            if (row.dataset.gone) return;
            row.dataset.gone = '1';
            row.style.pointerEvents = 'none';
            const h = row.offsetHeight;
            const out = row.animate(reduceMotion.matches
              ? [{ opacity: 1 }, { opacity: 0 }]
              : [{ opacity: 1, transform: 'translateY(0)', filter: 'blur(0px)', height: h + 'px' }, { opacity: 0, transform: 'translateY(6px)', filter: 'blur(3px)', height: '0px' }],
              { duration: reduceMotion.matches ? 120 : 220, easing: EASE_OUT, fill: 'forwards' });
            out.onfinish = () => row.remove();
          });
          row.append(b);
        });
        push(list, row);
        land(row);
        follow();
        continue;
      }
      // "Typing…" where its name is, then the words come in one after another, in its own way
      const v = VOICES[o.voice];
      setStatus(agent, 'Typing…');
      await pause(v.typing(m.say.length));
      if (!still()) return;
      const msg = lineOf('op-msg', m.say, { shout: true });
      const words = [...msg.children];
      words.forEach((span, k) => {
        span.animate(v.word, { duration: v.duration, delay: k * v.step, easing: v.easing, fill: 'backwards' });
        if (span.classList.contains('kw')) span.style.animationDelay = `${k * v.step}ms`; // flare as it appears
      });
      setStatus(agent, null);
      push(list, msg);
      follow();
      const landed = words.length * v.step + v.duration;
      await pause(landed + v.after); // and a pause before the next message
      if (!still()) return;
      if (lastLine) return;
    }
  }

  // Bringing an agent forward shows its conversation (playing its opener the first time, which
  // also ends its light-up); debounced, so spinning past doesn't count
  let agentTimer = 0;
  new MutationObserver(() => {
    clearTimeout(agentTimer);
    agentTimer = setTimeout(() => {
      if (phone.dataset.screen !== 'agents' || stage.dataset.mode === 'arriving') return;
      const a = Number(phone.dataset.agent);
      if (agents[a].classList.contains('has-news')) {
        agents[a].classList.remove('has-news');
        playOpener(a);
      } else if (!convos[a] && a === VENTED_WITH) {
        playOpener(a);
      } else {
        showConvo(a);
      }
    }, 240);
  }).observe(phone, { attributes: true, attributeFilter: ['data-agent'] });

  /* ───────────── The whole sequence ───────────── */

  function clearStage() {
    closeConvos();
    stage.replaceChildren();
    delete stage.dataset.mode;
  }

  function reset() {
    run++;
    timers.forEach(clearTimeout);
    clearTimeout(fadeTimer);
    stopFoam();
    clearLights();
    timers = [];
    stage.getAnimations({ subtree: true }).forEach((a) => a.cancel());
    clearStage();
    memories.classList.remove('has-insight');
    agents.forEach((a) => a.classList.remove('has-news'));
  }

  async function play() {
    reset();
    const id = run;
    if (phone.dataset.screen !== 'agents') return;
    input.placeholder = DEFAULT_PLACEHOLDER;
    if (Number(phone.dataset.agent) !== VENTED_WITH) window.Lava.selectAgent(VENTED_WITH);
    stage.dataset.mode = 'arriving';
    await wait(350);
    if (!alive(id)) return;
    // your messages are there, and Ride-or-Die starts replying; meanwhile the conversation is
    // stored in the insights bubble and the other two agents light up
    playOpener(VENTED_WITH, true);
    await wait(900);
    if (!alive(id)) return;
    if (reduceMotion.matches) {
      memories.classList.add('has-insight');
      fadeInsight(2000);
    } else {
      store();
    }
    cueAgents();
    delete stage.dataset.mode;
  }

  /* ───────────── Panel ───────────── */

  // Which stored-in-insights version plays, compared from the panel
  const STORE_KEY = 'lava.store';
  let storeKind = 'glass';
  function setStore(v) {
    storeKind = v;
    panel.querySelectorAll('[data-store]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.store === v)));
    try { localStorage.setItem(STORE_KEY, v); } catch {}
  }
  let savedStore = null;
  try { savedStore = localStorage.getItem(STORE_KEY); } catch {}
  setStore(LIGHTS[savedStore] ? savedStore : 'glass');

  // Just the stored moment, on its own: start the bubble from rest and play it
  function previewStore() {
    clearTimeout(fadeTimer);
    stopFoam();
    clearLights();
    memories.getAnimations({ subtree: true }).forEach((a) => a.cancel());
    memories.classList.remove('has-insight');
    memories.offsetWidth;
    store();
  }

  // Chat text styles (spacing and how key words flare), compared from the panel
  const CHAT_KEY = 'lava.chat';
  function setChat(v) {
    phone.dataset.chat = v;
    panel.querySelectorAll('[data-chat]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.chat === v)));
    try { localStorage.setItem(CHAT_KEY, v); } catch {}
  }
  let savedChat = null;
  try { savedChat = localStorage.getItem(CHAT_KEY); } catch {}
  setChat(panel.querySelector(`[data-chat="${savedChat}"]`) ? savedChat : '1');

  function showAgentScreen() {
    if (phone.dataset.screen === 'agents') return false;
    document.querySelector('#screenPicker [data-screen="agents"]').click(); // plays via lava:screen
    return true;
  }

  panel.addEventListener('mousedown', (e) => e.preventDefault()); // keep the input focused
  panel.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    if (b.dataset.preview === 'store') {
      previewStore();
      return;
    }
    if (b.dataset.store) {
      setStore(b.dataset.store);
      previewStore();
      return;
    }
    if (b.dataset.chat) {
      setChat(b.dataset.chat);
      // replay the key-word flares on screen so the new style shows straight away
      stage.querySelectorAll('.kw:not(.is-static)').forEach((k) => {
        k.style.animationDelay = '0ms';
        k.style.animation = 'none';
        k.offsetWidth;
        k.style.animation = '';
      });
      return;
    }
    if (b.id === 'seqReplay' && !showAgentScreen()) play();
  });

  phone.addEventListener('lava:screen', (e) => {
    if (e.detail === 'agents') play();
    else reset();
  });

  if (phone.dataset.screen === 'agents') play();
})();
