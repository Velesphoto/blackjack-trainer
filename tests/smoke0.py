import sys, os; sys.path.insert(0, os.path.dirname(__file__))
from h import *
with sync_playwright() as p:
    b, pg, errs = open_page(p)
    to_menu(pg, 'practice')
    pg.screenshot(path='/tmp/s_menu.png')
    go(pg)
    pg.wait_for_timeout(500)
    print(pg.evaluate("()=>({phase:__bj.G.phase,kind:__bj.G.kind})"))
    pg.click('#dealBtn'); pg.wait_for_timeout(2500)
    print(pg.evaluate("()=>({phase:__bj.G.phase,hands:__bj.G.hands.length})"))
    pg.screenshot(path='/tmp/s_table.png')
    print('errs', errs)
    b.close()
