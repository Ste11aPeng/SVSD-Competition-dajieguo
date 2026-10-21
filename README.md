# Final Prototype

Vent On, the final prototype for the SVSD competition.

## Run it
The pages load each other's files, so serve the folder instead of opening files directly:

```
python3 -m http.server 8000
```

Then open:
- http://localhost:8000/prototype.html for the prototype inside the iPhone frame, starting on the vent screen (Restart button bottom right)
- http://localhost:8000/vent.html for the vent screen on its own (phone-sized window)

## Pages
| File | Screen |
| --- | --- |
| `prototype.html` | iPhone frame wrapper: loads `vent.html` in a 402 × 874 screen |
| `index.html` | lock screen |
| `vent.html` | vent screen and the agent chat (Ride-or-Die, Roaster, Calm Sibling) |
| `call.html` | voice call |
| `insights.html` | Memories: Insights and Calendar |
| `letgo.html` | Let go: the card that turns over and burns |

## Where things live
- Chat scripts and timing: `recap.js` (`OPENERS` for each agent's conversation, `VOICES` for each voice's typing style, `PACE` = 0.8 for the overall speed, `summaryCard` for the shareable summary)
- Chat styles: `recap.css` (summary card and its Copy → Copied state at the end)
- Calendar day pop-up, Let go overlay and forgotten days: the `<style>` and `<script>` blocks at the end of `insights.html`
- Let go burn: `letgo.html` (WebGL card; tap the card to flip, Forget to burn; it posts `{letgo: 'done'}` to the calendar when finished)
- Screen-to-screen links: `flow.js`

## What's new in this version
- Calendar: tapping a day opens it as a centred pop-up over a dimmed, blurred calendar; the top-left button becomes a close (✕); Let go is a white button at the bottom.
- Let go opens the burn screen; a let-go day keeps its colour but no longer opens, and leaves the Recent list (resets on Restart or a new tab).
- Insights topic sheet sits flush on the bottom edge.
- Chat: after Ride-or-Die suggests the nearest CVS, ask it to update your friend ("Update this to my friend") and it replies with a summary card you can Edit or Copy.
- All three agents type and send 20% faster.
- Vent screen: first recent chip is "Stolen package from lobby".
