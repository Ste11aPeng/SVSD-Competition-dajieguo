"""Turns the design-canvas screens in _src/ into plain pages at the repo root.
Run: python3 _src/build.py"""
import re, pathlib
ROOT = pathlib.Path(__file__).resolve().parent.parent
SHELL = '''<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="theme-color" content="#000000">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<meta name="apple-mobile-web-app-title" content="Lava">
<link rel="manifest" href="manifest.webmanifest">
<link rel="apple-touch-icon" href="assets/apple-touch-icon.png">
<link rel="stylesheet" href="mobile.css?v=4">
<title>{title}</title>
{helmet}
<link rel="stylesheet" href="flow.css?v=3">
<link rel="stylesheet" href="vt.css?v=3">
<link rel="stylesheet" href="ios-chrome.css?v=3">
<link rel="expect" href="#dc-painted" blocking="render">
<script>addEventListener('pagereveal', e => {{ window.__crossfaded = !!e.viewTransition; }});</script>
</head>
<body class="flow-page" data-page="{page}">
<div id="dc-root" class="flow-frame"></div>
<template id="dc-tpl">{body}</template>
<script src="vendor/react.production.min.js"></script>
<script src="vendor/react-dom.production.min.js"></script>
<script type="text/x-dc">{code}</script>
<script src="dc-lite.js?v=3"></script>
{boot}
<script src="flow.js?v=7"></script>
<i id="dc-painted" hidden></i>
</body>
</html>
'''
RING_SLOT = '<div class="ring-slot" style="opacity: {{agO}}; transform: translateY({{agY}}px)"></div>'
RING_HEAD = ('<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Archivo:wdth,wght@62..125,100..900&family=Inter:wght@400..900&display=swap">\n'
             '<link rel="stylesheet" href="agent-ring.css?v=3">\n'
             '<style>@media (pointer: coarse){[aria-label="Call controls"]{top:auto!important;bottom:52px!important}}.status{top:68px!important}.ring-slot{position:absolute;left:0;right:0;top:14px;height:140px;z-index:5;transition:opacity 1s ease,transform 1.1s cubic-bezier(.2,.8,.2,1)}</style>')
HOLD = ('<style>html.cv-hold #dc-root main > * { opacity: 0 !important; } html.cv-hold { background: #050304; }</style>\n'
        '<script>try { if (sessionStorage.getItem("vt.voice") || /[?&]standby\\b/.test(location.search)) { document.documentElement.classList.add("cv-hold"); window.__fromVoice = true; window.__standby = /[?&]standby\\b/.test(location.search); } } catch (e) {}\n'
        'window.__auto = /[?&]auto\\b/.test(location.search);\n'
        'addEventListener("pagereveal", e => { if (document.documentElement.classList.contains("cv-hold") && e.viewTransition) e.viewTransition.skipTransition(); });</script>')
FX_CSS = ('<style>.floor.has-cloud{filter:none!important}.floor.has-cloud i{display:none}'
          '.floor-cloud{position:absolute;inset:0;width:100%;height:100%;display:block}'
          '.has-status-fx .status{color:transparent!important}'
          'svg.name-effect{overflow:visible}'
          '.captions{position:absolute;left:24px;right:24px;top:300px;height:230px;pointer-events:none;z-index:4}'
          '.cap{position:absolute;left:0;right:0;top:50%;transform:translateY(-50%);margin:0;text-align:center;font-weight:300;text-wrap:balance}'
          '.mur-fx{position:absolute;top:492px;z-index:4;white-space:nowrap;font-size:19px;font-weight:400;color:#FFF8EE;pointer-events:none;will-change:transform,opacity}'
          '.mur-fx[data-side=l]{left:44px;transform-origin:left center}.mur-fx[data-side=r]{right:44px;transform-origin:right center}'
          '.mur-em{font-weight:500;color:#fff;line-height:1}'
          '.mur-fx[data-lv=in]{opacity:0;transform:translateY(12px) scale(.96)}'
          '.mur-fx[data-lv="0"]{opacity:.92;transform:none;transition:transform .3s cubic-bezier(.23,1,.32,1),opacity .25s cubic-bezier(.23,1,.32,1)}'
          '.mur-fx[data-lv="1"]{opacity:.36;transform:translateY(-48px);transition:transform .4s cubic-bezier(.32,.72,0,1),opacity .32s cubic-bezier(.23,1,.32,1)}'
          '.mur-fx[data-lv="2"]{opacity:0;transform:translateY(-108px);transition:transform .8s cubic-bezier(.25,.46,.45,.94),opacity .4s cubic-bezier(.25,.46,.45,.94)}'
          '@media (prefers-reduced-motion:reduce){.mur-fx,.mur-fx[data-lv]{transform:none!important}}'
          '.cap--a{font-size:34px;line-height:1.16;letter-spacing:-.85px;color:#FFF8EE}'
          '.cap .cw{display:inline-block}.cap .em{color:#fff;font-weight:420}'
          '.status-fx{position:absolute;left:0;right:0;display:flex;justify-content:center;transform:translateY(-50%);pointer-events:none;z-index:6}</style>')
PT_HOLD = ('<style>html.pt-hold #dc-root main > .scroller, html.pt-hold #dc-root main > .sticky, html.pt-hold #dc-root main > .seg2, '
           'html.pt-hold #dc-root main > .sb, html.pt-hold .chatbtn svg { opacity: 0 !important; } html.pt-hold { background: #0a090e; }</style>\n'
           '<script>try { var r = JSON.parse(sessionStorage.getItem("pt.dir") || "null"); if ((r && r.dir === "toMemories" && Date.now() - r.at < 5000)) document.documentElement.classList.add("pt-hold"); } catch (e) {}\n'
           'addEventListener("pagereveal", function (e) { if (document.documentElement.classList.contains("pt-hold") && e.viewTransition) e.viewTransition.skipTransition(); });</script>')
RING_BOOT = ('<script src="name-effects.js?v=3"></script>\n<script src="agent-ring.js?v=3"></script>\n'
             '<script>AgentRing.mount(document.querySelector(".ring-slot"), { active: 0 });</script>\n'
             '<script src="call-fx.js?v=2"></script>\n'
             '<script src="voice-transition.js?v=1"></script>')

def build(src, out, page):
    s = (ROOT / '_src' / src).read_text()
    title = re.search(r'<title>(.*?)</title>', s).group(1)
    xdc = re.search(r'<x-dc>(.*)</x-dc>', s, re.S).group(1)
    helmet = re.search(r'<helmet>(.*?)</helmet>', xdc, re.S).group(1).strip()
    body = re.sub(r'<helmet>.*?</helmet>', '', xdc, flags=re.S).strip()
    code = re.search(r'<script type="text/x-dc"[^>]*>(.*?)</script>', s, re.S).group(1)
    fix = lambda t: t.replace('url(va/', 'url(assets/va/').replace('src="va/', 'src="assets/va/')
    extra_head = extra_boot = ''
    if page == 'insights':
        extra_head, extra_boot = PT_HOLD + '\n<link rel="prefetch" href="index.html"><link rel="prefetch" href="style.css"><link rel="prefetch" href="recap.css"><link rel="prefetch" href="bubbles.css"><link rel="prefetch" href="script.js"><link rel="prefetch" href="recap.js"><link rel="prefetch" href="bubbles.js"><link rel="prefetch" href="home-chat.js"><link rel="prefetch" href="name-effects.js"><link rel="prefetch" href="vent.js"><link rel="prefetch" href="input-grow.js"><link rel="prefetch" href="memory-tip.js"><link rel="prefetch" href="voice-transition.js"><link rel="prefetch" href="assets/vent.jpg">', '<script src="page-transition.js?v=1"></script>'
    if page == 'call':
        body = re.sub(r'<div class="agents".*?</div>\s*<img class="name"[^>]*>', RING_SLOT, body, flags=re.S)
        assert 'ring-slot' in body
        extra_head, extra_boot = RING_HEAD + '\n' + HOLD + '\n' + FX_CSS, RING_BOOT
    (ROOT / out).write_text(SHELL.format(title=title, helmet=fix(helmet) + ('\n' + extra_head if extra_head else ''), page=page, body=fix(body), code=code, boot=extra_boot))
    print('wrote', out)
build('insights.dc.html', 'insights.html', 'insights')
build('call.dc.html', 'call.html', 'call')
