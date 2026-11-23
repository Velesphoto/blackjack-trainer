import sys, os; sys.path.insert(0, os.path.dirname(__file__))
from h import *
with sync_playwright() as p:
    b, pg, errs = open_page(p)
    to_menu(pg, 'practice')
    # pair counting, answered by keys, correct answers
    pg.click("[data-drill=pairs]"); pg.wait_for_timeout(300)
    for i in range(5):
        ans = int(pg.evaluate("()=>__bj.G.q.answer"))
        if ans < 0: pg.keyboard.press('-')
        pg.keyboard.press(str(abs(ans))); pg.wait_for_timeout(120)
        pg.keyboard.press('Enter') if False else pg.click('#qNext'); pg.wait_for_timeout(80)
    print('pairs', pg.evaluate("()=>[__bj.G.n,__bj.G.ok]"))
    pg.click('#dEnd'); pg.wait_for_timeout(300); print('res', pg.inner_text('#results')[:60].replace('\n',' '))
    pg.click('#again'); pg.wait_for_timeout(600)
    # KO pair range
    pg.evaluate("()=>{openMenu('practice');__bj.PC.sys='omega2'}"); pg.wait_for_timeout(1500)
    pg.click("[data-drill=pairs]"); pg.wait_for_timeout(300)
    print('omega buttons', pg.evaluate("()=>document.querySelectorAll('#dCtl [data-q]').length"))
    pg.click('#dEnd'); pg.wait_for_timeout(300); pg.click('#again'); pg.wait_for_timeout(600)
    pg.evaluate("()=>{openMenu('practice');__bj.PC.sys='hilo'}"); pg.wait_for_timeout(1500)
    # full deck run via keyboard, space focus on button
    pg.click("[data-drill=run]"); pg.wait_for_timeout(300); pg.click('#runGo'); pg.wait_for_timeout(200)
    for i in range(51):
        pg.keyboard.press('Space'); pg.wait_for_timeout(15)
    print('card idx after 51 presses', pg.evaluate("()=>__bj.G.i"), pg.evaluate("()=>__bj.G.phase"))
    pg.keyboard.press('Space'); pg.wait_for_timeout(200)
    print('phase', pg.evaluate("()=>__bj.G.phase"), 'rc', pg.evaluate("()=>__bj.G.rc"))
    pg.fill('#cnt', '0'); pg.press('#cnt', 'Enter'); pg.wait_for_timeout(300)
    print(pg.inner_text('#dMsg'))
    print('best saved', pg.evaluate("()=>JSON.parse(localStorage.getItem('bj-deckrun'))"))
    pg.click('#dEnd'); pg.wait_for_timeout(300); print(pg.inner_text('#results')[:80].replace('\n',' '))
    print('errs', errs); b.close()
