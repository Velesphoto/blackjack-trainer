"""Deterministic feature checks: drills, progress/backup/goal, special rules, milestone, heat."""
import sys, os, json; sys.path.insert(0, os.path.dirname(__file__))
from h import *
fails = []
def chk(name, cond, extra=''):
    print('PASS' if cond else 'FAIL', name, extra if not cond else '')
    if not cond: fails.append(name)
with sync_playwright() as p:
    b, pg, errs = open_page(p)
    to_menu(pg, 'practice')
    # ---- flashcards: basic, index, deck estimation
    for sub in ['basic', 'index']:
        pg.evaluate("()=>{__bj.PC.dev=2}")
        pg.click(f"[data-drill={sub}]"); pg.wait_for_timeout(400)
        for i in range(6):
            pg.click('#dCtl [data-q]'); pg.wait_for_timeout(150)
            pg.click('#qNext'); pg.wait_for_timeout(100)
        chk(f'{sub} flashcards answered', pg.evaluate("()=>__bj.G.n")==6)
        # answers are correct when we choose the engine's answer
        pg.evaluate("()=>{const G=__bj.G;G.phase='ask'}")
        ans = pg.evaluate("()=>__bj.G.q.answer")
        pg.click(f"#dCtl [data-q='{ans}']"); pg.wait_for_timeout(100)
        chk(f'{sub} right answer graded right', pg.evaluate("()=>__bj.G.fbk.ok"))
        pg.click('#dEnd'); pg.wait_for_timeout(300)
        chk(f'{sub} results shown', 'right' in pg.inner_text('#results'))
        pg.click('#again'); pg.wait_for_timeout(600)
    chk('mistakes recorded from flashcards', pg.evaluate("()=>Object.keys(JSON.parse(localStorage.getItem('bj-miss')||'{}')).length")>0)
    pg.click('#dk2') if False else None
    # mistake review (button enabled after reopening menu)
    pg.evaluate("()=>openMenu('practice')"); pg.wait_for_timeout(1500)
    n = pg.evaluate("()=>mistakeCount()")
    pg.click("[data-drill=miss]"); pg.wait_for_timeout(400)
    for i in range(3):
        ans = pg.evaluate("()=>__bj.G.q.answer")
        pg.click(f"#dCtl [data-q='{ans}']"); pg.wait_for_timeout(100)
        if pg.query_selector('#qNext'): pg.click('#qNext'); pg.wait_for_timeout(100)
    chk('review runs', pg.evaluate("()=>__bj.G.sub")=='miss')
    pg.click('#dEnd'); pg.wait_for_timeout(300); pg.click('#again'); pg.wait_for_timeout(600)
    # deck estimation
    pg.evaluate("()=>openMenu('practice')"); pg.wait_for_timeout(1500)
    pg.click("[data-drill=deck]"); pg.wait_for_timeout(400)
    left = pg.evaluate("()=>Math.round(__bj.G.d.left*2)/2")
    pg.click(f"#dCtl [data-v='{left}']"); pg.wait_for_timeout(200)
    chk('deck estimate exact right', pg.evaluate("()=>__bj.G.ok")==1)
    d = pg.evaluate("()=>({rc:__bj.G.d.rc,tc:__bj.Core.trueCount(__bj.G.d.rc,__bj.G.d.decks,__bj.G.d.left*52)})")
    pg.fill('#cnt', str(round(d['tc']))); pg.press('#cnt', 'Enter'); pg.wait_for_timeout(200)
    chk('true count graded', pg.evaluate("()=>__bj.G.tcN")==1 and pg.evaluate("()=>__bj.G.tcOk")==1, str(d))
    pg.screenshot(path='/tmp/s_deck.png')
    pg.click('#dEnd'); pg.wait_for_timeout(300); pg.click('#again'); pg.wait_for_timeout(600)
    # ---- burst drill with KO + goal counter
    pg.evaluate("()=>openMenu('practice')"); pg.wait_for_timeout(1500)
    pg.evaluate("()=>Object.assign(__bj.PC,{mode:1,len:10,speed:350,sys:'ko'})")
    go(pg); pg.click('#goB'); pg.wait_for_function("()=>__bj.G.phase==='check'", timeout=30000)
    rc = pg.evaluate("()=>__bj.G.rc"); pg.fill('#cnt', str(rc)); pg.press('#cnt', 'Enter'); pg.wait_for_timeout(200)
    chk('burst KO count graded', pg.evaluate("()=>__bj.G.checks[0].ok"))
    chk('daily goal counted', pg.evaluate("()=>dayCount()")>=1)
    pg.click('#dEnd'); pg.wait_for_timeout(300)
    chk('burst result saved to history', pg.evaluate("()=>loadHist().length")>=1)
    pg.click('#again'); pg.wait_for_timeout(600)
    # ---- progress modal, backup round-trip
    pg.evaluate("()=>openMenu('practice')"); pg.wait_for_timeout(1500)
    pg.click('#progBtn'); pg.wait_for_timeout(300)
    pg.screenshot(path='/tmp/s_prog.png')
    pg.evaluate("()=>{for(let i=0;i<8;i++)saveHist({m:'table',s:50+i*5,a:60+i,t:5-i*.3})}"); 
    pg.evaluate("()=>renderProgress()"); pg.wait_for_timeout(200)
    chk('chart svg drawn', pg.query_selector('#progB svg path') is not None)
    pg.screenshot(path='/tmp/s_prog2.png')
    bk = pg.evaluate("()=>exportBackup()")
    pg.evaluate("()=>{localStorage.clear()}")
    chk('cleared', pg.evaluate("()=>loadHist().length")==0)
    pg.fill('#bkText', bk); pg.click('#bkRestore'); pg.wait_for_timeout(200)
    chk('restore round trip', pg.evaluate("()=>loadHist().length")>=9, pg.inner_text('#bkMsg'))
    pg.fill('#bkText', '{"nope":1}'); pg.click('#bkRestore')
    chk('bad backup rejected', 'not a Shoe Room' in pg.inner_text('#bkMsg'))
    pg.click('#goalSeg button:nth-child(1)'); 
    chk('goal target change', pg.evaluate("()=>goalTarget()")==25)
    # streak logic
    pg.evaluate("""()=>{const d=new Date(),k=n=>{const x=new Date(d);x.setDate(x.getDate()-n);return todayKey(x)};
      localStorage.setItem('bj-days',JSON.stringify({[k(1)]:[30,25],[k(2)]:[30,25],[k(3)]:[5,25]}))}""")
    chk('streak counts yesterday chain', pg.evaluate("()=>currentStreak()")==2)
    pg.click('#progX'); pg.wait_for_timeout(300)
    # ---- charts modal both tabs incl. new rules
    pg.evaluate("()=>Object.assign(__bj.PC,{sur:2,das:0,peek:0,decks:8})")
    pg.evaluate("()=>document.getElementById('chartBtn').click()"); pg.wait_for_timeout(200)
    chk('basic chart has R cells (early sur)', 'cR' in pg.inner_html('#chartB'))
    pg.click('#chartTabs button:nth-child(2)'); pg.wait_for_timeout(200)
    chk('deviation chart renders', 'Illustrious 18' in pg.inner_text('#chartB'))
    pg.click('#chartX')
    # ---- Game: milestone saved mid-session
    pg.evaluate("()=>{localStorage.clear()}")
    pg.evaluate("()=>showIntro()"); pg.wait_for_timeout(500)
    pg.evaluate("()=>openMenu('game')"); pg.wait_for_timeout(1500)
    go(pg)
    pg.evaluate("()=>{const G=__bj.G;G.peak=420;G.bank=420;G.bet=25;G.tc0=0;saveMilestone()}")
    chk('milestone saved immediately', pg.evaluate("()=>JSON.parse(localStorage.getItem('bj-gm-start'))")==400)
    # heat: sudden big bets at high count back you off
    pg.evaluate("()=>{const G=__bj.G;G.baseBet=0;G.heat=0;G.bet=25;G.tc0=0;heatOnBet();G.bet=100;G.tc0=4;for(let i=0;i<8;i++)heatOnBet()}")
    chk('heat builds to back-off', pg.evaluate("()=>__bj.G.backedOff"), str(pg.evaluate("()=>__bj.G.heat")))
    pg.evaluate("()=>{const G=__bj.G;G.backedOff=false;G.heat=50;coverPlay(5,6)}")
    chk('cover play cools heat', pg.evaluate("()=>__bj.G.heat")==44 and pg.evaluate("()=>__bj.G.cover.n")==1)
    print('errs', errs)
    chk('no page errors', not errs)
    b.close()
print('FAILED:', fails if fails else 'none')
