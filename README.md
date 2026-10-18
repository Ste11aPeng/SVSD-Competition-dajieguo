# Home + Chat

A static prototype (no build step) with two stages of the Lava app:

- **Ready to vent?** — home screen: vent cloud background (WebGL), Vibe title, recent-chat cards.
- **Agent switcher** — chat: Haze background, Edge glare bubbles, Vibe agent names, Airy · Sweep text, Glass+ insights.
- **Insights** (`insights.html`) — open it with the Memories button (top left); the chat button brings you back.
- **Voice call** (`call.html`) — tap the voice orb with an empty field; hanging up lands on the Agent switcher.
  With microphone access it listens for real: your loudness drives the glow, pauses get a murmur,
  and a longer pause brings a reply matched to what you said.

Switch stages with the panel to the right of the phone (shown on screens wider than 900px).

## Run it

Serve the folder with any static server, for example:

    python3 -m http.server 8000

then open http://localhost:8000. (Opening index.html straight from disk can block the
vent background image from loading into WebGL, so use a server.)

## Files

- `index.html` — page markup
- `style.css`, `recap.css`, `bubbles.css` — styles
- `script.js` — phone, keyboard, agents, backgrounds, name styles
- `vent.js` — the animated vent cloud (WebGL shader over `assets/vent.jpg`)
- `name-effects.js` — the Vibe (and other) text effects
- `recap.js` — the after-chat sequence and the agents' conversations
- `bubbles.js` — chat bubble layout (grouping, fit-to-text, gradients)
- `home-chat.js` — the two-stage switcher and the fixed choices for this prototype
- `assets/` — images and icons
- `insights.html`, `call.html` — built from the design-canvas screens in `_src/` (`python3 _src/build.py`)
- `dc-lite.js` + `vendor/` — runs those screens (React)
- `flow.js`, `flow.css`, `vt.css`, `ios-chrome.css` — links the pages, page crossfades, iOS status bar

Fonts load from Google Fonts, so the page needs an internet connection to look right.
