# V2 Prototype

`main` is the V2 prototype. If you already cloned this repo, run `git pull` to get this version.

Lock screen, then vent, voice call, chat, and Memories. No build step to run it.

## Run it

    python3 -m http.server 8000

From this folder, then open http://localhost:8000/lockscreen.html.

- Entry page: `lockscreen.html` (tap the vector blob). It loads the vent page, `index.html`, underneath.
- Add `?auto=1` for the timed demo (blob tapped after 3s, voice button 4s after the vent page shows).
- `insights.html` and `call.html` are generated from `_src/*.dc.html`. After editing a source file, run `python3 _src/build.py`.

## What is in it

- Lock screen (Figma 237:5962) with the spring slide-out into the vent page ("Ready to vent?")
- Voice call (`call.html`, `call-fx.js`, WebGL floor in the call page) timed to `assets/audio/call.mp3`
- After-call chat with the Ride-or-Die agent (`recap.js`, `recap.css`), auto-growing input (`input-grow.js`)
- "Saved to memories" tooltip (`memory-tip.js`) and the redesigned Memories/insights page
- Page transitions: `voice-transition.js`, `page-transition.js`, `flow.js`

Fonts load from Google Fonts, so the page needs an internet connection to look right.
