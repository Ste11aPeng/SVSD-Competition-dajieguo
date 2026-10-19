# V2 Prototype

The current prototype on `main`. If you already cloned an earlier version, `git pull` to use this one.

## Run it
    python3 -m http.server 8000      # from this folder, then open http://localhost:8000/lockscreen.html

- Entry page: `lockscreen.html` (tap the vector blob). It loads the vent page, `index.html`, underneath.
- Add `?auto=1` for the timed demo (blob tapped after 3s, voice button 4s after the vent page shows).
- No build step to run it. `insights.html` and `call.html` are generated from `_src/*.dc.html`:
  `python3 _src/build.py` after editing a source file.

## What is in it
- Lock screen (Figma 237:5962) with the spring slide-out → vent page ("Ready to vent?")
- Voice call (`call.html`, `call-fx.js`, WebGL floor in the call page) timed to `assets/audio/call.mp3`
- After-call chat with the Ride-or-Die agent (`recap.js`, `recap.css`), auto-growing input (`input-grow.js`)
- "Saved to memories" tooltip (`memory-tip.js`) and the redesigned Memories/insights page
- Page transitions: `voice-transition.js`, `page-transition.js`, `flow.js`
