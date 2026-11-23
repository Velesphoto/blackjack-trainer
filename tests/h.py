"""Browser test helpers (headless Chrome via Playwright). Pages are opened from ../index.html."""
from playwright.sync_api import sync_playwright
import os
PATH = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'index.html'))
def open_page(p, w=1100, h=800, mobile=False):
    b = p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox'])
    ctx = b.new_context(viewport={'width': w, 'height': h}, has_touch=mobile, is_mobile=mobile, device_scale_factor=2 if mobile else 1)
    pg = ctx.new_page(); errs = []
    pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.on('console', lambda m: errs.append(m.text) if m.type == 'error' and 'ERR_TUNNEL' not in m.text and 'Failed to load resource' not in m.text else None)
    pg.goto('file://' + PATH)
    return b, pg, errs
def to_menu(pg, kind='practice'):
    pg.wait_for_timeout(2400); pg.click('#dk1'); pg.wait_for_timeout(2200)
    pg.click('#dk2' if kind == 'practice' else '#dk1'); pg.wait_for_timeout(1600)
def go(pg):
    pg.click('#goBtn'); pg.wait_for_timeout(700)
