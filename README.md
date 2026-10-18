# Home + Chat

A static prototype (no build step) with two stages of the Lava app:

- **Ready to vent?** — home screen: vent cloud background (WebGL), Vibe title, recent-chat cards.
- **Agent switcher** — chat: Haze background, Edge glare bubbles, Vibe agent names, Airy · Sweep text, Glass+ insights.

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

Fonts load from Google Fonts, so the page needs an internet connection to look right.
