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
<script src="flow.js?v=3"></script>
<i id="dc-painted" hidden></i>
</body>
</html>
'''
def build(src, out, page):
    s = (ROOT / '_src' / src).read_text()
    title = re.search(r'<title>(.*?)</title>', s).group(1)
    xdc = re.search(r'<x-dc>(.*)</x-dc>', s, re.S).group(1)
    helmet = re.search(r'<helmet>(.*?)</helmet>', xdc, re.S).group(1).strip()
    body = re.sub(r'<helmet>.*?</helmet>', '', xdc, flags=re.S).strip()
    code = re.search(r'<script type="text/x-dc"[^>]*>(.*?)</script>', s, re.S).group(1)
    fix = lambda t: t.replace('url(va/', 'url(assets/va/').replace('src="va/', 'src="assets/va/')
    (ROOT / out).write_text(SHELL.format(title=title, helmet=fix(helmet), page=page, body=fix(body), code=code))
    print('wrote', out)
build('insights.dc.html', 'insights.html', 'insights')
build('call.dc.html', 'call.html', 'call')
