import sys, os; sys.path.insert(0, os.path.dirname(__file__))
from h import *
with sync_playwright() as p:
    b, pg, errs = open_page(p)
    to_menu(pg, 'practice')
    pg.click("[data-drill=run]"); pg.wait_for_timeout(300); pg.click('#runGo')
    for i in range(51): pg.keyboard.press('Space')
    st=lambda: pg.evaluate("()=>[__bj.G.phase,__bj.G.i]")
    print('after 51', st())
    pg.keyboard.press('Space'); pg.wait_for_timeout(200); print('after 52', st())
    pg.fill('#cnt','0'); print('filled', st())
    pg.press('#cnt','Enter'); pg.wait_for_timeout(500); print('after enter', st(), pg.evaluate("()=>document.activeElement.id"))
    b.close()
