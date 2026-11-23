import sys, os; sys.path.insert(0, os.path.dirname(__file__))
from h import *
with sync_playwright() as p:
    b, pg, errs = open_page(p)
    to_menu(pg, 'game'); go(pg)
    pg.evaluate("()=>document.getElementById('popChk').click()"); pg.wait_for_timeout(500)
    print(pg.evaluate("()=>[typeof MINI_ON!=='undefined'?MINI_ON:'x', document.getElementById('popChk').checked, document.getElementById('table').hidden, document.body.lastElementChild.id, !!document.getElementById('mini')]"), errs)
    b.close()
