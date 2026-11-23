import sys, os; sys.path.insert(0, os.path.dirname(__file__))
from h import *
with sync_playwright() as p:
    b, pg, errs = open_page(p)
    to_menu(pg, 'practice')
    pg.click("[data-drill=run]"); pg.wait_for_timeout(300); pg.click('#runGo')
    for i in range(51): pg.keyboard.press('Space')
    pg.keyboard.press('Space'); pg.wait_for_timeout(200)
    pg.fill('#cnt','0'); pg.press('#cnt','Enter'); pg.wait_for_timeout(500)
    print(repr(pg.inner_html('#dMsg')), pg.evaluate("()=>JSON.stringify(__bj.G.fbk)"), pg.evaluate("()=>__bj.G.phase"))
    pg.screenshot(path='/tmp/run.png'); print(errs); b.close()
