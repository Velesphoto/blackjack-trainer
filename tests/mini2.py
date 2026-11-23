import sys, os; sys.path.insert(0, os.path.dirname(__file__))
from h import *
def T(sel):
    return pg.evaluate("s=>{const w=window.documentPictureInPicture&&documentPictureInPicture.window;const d=w?w.document:document;const e=d.querySelector('#mini '+s);return e?e.innerText:null}", sel)
with sync_playwright() as p:
    b, pg, errs = open_page(p); globals()['pg']=pg
    to_menu(pg, 'game'); go(pg)
    pg.evaluate("()=>document.getElementById('popChk').click()"); pg.wait_for_timeout(400)
    print('toggle visible in game', pg.evaluate("()=>getComputedStyle(document.getElementById('popTog')).display"))
    print('in PiP window:', pg.evaluate("()=>!!(window.documentPictureInPicture&&documentPictureInPicture.window)"))
    for ch in '60': pg.keyboard.press(ch)
    pg.wait_for_timeout(100); print('box', T('.mbx'))
    pg.keyboard.press('Enter'); pg.wait_for_timeout(2500)
    print('bet', pg.evaluate("()=>[__bj.G.bet,__bj.G.phase]"))
    for i in range(20):
        ph = pg.evaluate("()=>__bj.G.phase")
        if ph == 'play': print('hint', T('.mh')); pg.keyboard.press('s')
        elif ph in ('esur','insure'): pg.keyboard.press('n')
        elif ph == 'between': break
        pg.wait_for_timeout(700)
    print('phase', pg.evaluate("()=>__bj.G.phase"), 'bank', pg.evaluate("()=>__bj.G.bank"))
    
    pg.keyboard.press('Enter'); pg.wait_for_timeout(300)
    print('next hand phase', pg.evaluate("()=>__bj.G.phase"), '| box default', T('.mbx'))
    pg.evaluate("()=>document.getElementById('popChk').click()"); pg.wait_for_timeout(300)
    print('table back', not pg.evaluate("()=>document.getElementById('table').hidden"), errs); b.close()
