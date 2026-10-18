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
<script src="flow.js?v=3"></script>
<i id="dc-painted" hidden></i>
</body>
</html>
'''
RING_SLOT = '<div class="ring-slot" style="opacity: {{agO}}; transform: translateY({{agY}}px)"></div>'
RING_HEAD = ('<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Archivo:wdth,wght@62..125,100..900&family=Inter:wght@400..900&display=swap">\n'
             '<link rel="stylesheet" href="agent-ring.css?v=3">\n'
             '<style>.status{top:68px!important}.ring-slot{position:absolute;left:0;right:0;top:14px;height:140px;z-index:5;transition:opacity 1s ease,transform 1.1s cubic-bezier(.2,.8,.2,1)}</style>')
RING_BOOT = ('<script src="name-effects.js?v=3"></script>\n<script src="agent-ring.js?v=3"></script>\n'
             '<script>AgentRing.mount(document.querySelector(".ring-slot"), { active: 1 });</script>')

def build(src, out, page):
    s = (ROOT / '_src' / src).read_text()
    title = re.search(r'<title>(.*?)</title>', s).group(1)
    xdc = re.search(r'<x-dc>(.*)</x-dc>', s, re.S).group(1)
    helmet = re.search(r'<helmet>(.*?)</helmet>', xdc, re.S).group(1).strip()
    body = re.sub(r'<helmet>.*?</helmet>', '', xdc, flags=re.S).strip()
    code = re.search(r'<script type="text/x-dc"[^>]*>(.*?)</script>', s, re.S).group(1)
    fix = lambda t: t.replace('url(va/', 'url(assets/va/').replace('src="va/', 'src="assets/va/')
    extra_head = extra_boot = ''
    if page == 'call':
        body = re.sub(r'<div class="agents".*?</div>\s*<img class="name"[^>]*>', RING_SLOT, body, flags=re.S)
        assert 'ring-slot' in body
        extra_head, extra_boot = RING_HEAD, RING_BOOT
    (ROOT / out).write_text(SHELL.format(title=title, helmet=fix(helmet) + ('\n' + extra_head if extra_head else ''), page=page, body=fix(body), code=code, boot=extra_boot))
    print('wrote', out)
build('insights.dc.html', 'insights.html', 'insights')
build('call.dc.html', 'call.html', 'call')
