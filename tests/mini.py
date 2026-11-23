import sys, os; sys.path.insert(0, os.path.dirname(__file__))
from h import *
with sync_playwright() as p:
    b, pg, errs = open_page(p)
    to_menu(pg, 'practice'); pg.evaluate("()=>Object.assign(__bj.PC,{every:1,sur:2})"); go(pg)
    pg.evaluate("()=>{document.getElementById('popChk').click()}"); pg.wait_for_timeout(300)
    print('table hidden', pg.evaluate("()=>document.getElementById('table').hidden"), 'mini', pg.evaluate("()=>!!document.getElementById('mini')"))
    pg.keyboard.press('Enter'); pg.wait_for_timeout(2500)
    for i in range(30):
        ph = pg.evaluate("()=>__bj.G.phase")
        if ph == 'esur': pg.keyboard.press('n')
        elif ph == 'insure': pg.keyboard.press('n')
        elif ph == 'play': pg.keyboard.press('s')
        elif ph == 'check':
            rc = pg.evaluate("()=>__bj.G.rc")
            for ch in str(rc): pg.keyboard.press(ch)
            pg.keyboard.press('Enter')
        elif ph == 'between': break
        pg.wait_for_timeout(700)
    print('phase', pg.evaluate("()=>__bj.G.phase"), 'checks', pg.evaluate("()=>__bj.G.checks.map(c=>c.ok)"))
    pg.screenshot(path='/tmp/s_mini.png')
    pg.evaluate("()=>{document.getElementById('popChk').click()}"); pg.wait_for_timeout(300)
    print('table restored', not pg.evaluate("()=>document.getElementById('table').hidden"))
    print(errs); b.close()
