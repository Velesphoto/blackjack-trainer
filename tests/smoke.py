"""Auto-plays many rounds under different rule sets and checks nothing throws and state stays sane."""
import sys, os, json; sys.path.insert(0, os.path.dirname(__file__))
from h import *
DRV = """()=>{window.drv=setInterval(()=>{const G=__bj.G;if(!G||G.kind!=='table'||!G.alive)return;const p=G.phase,d=id=>document.getElementById(id);
 if(p==='bet'){if(G.gm==='game'){const b=d('betGo');if(b&&!b.disabled)b.click()}else{const b=d('dealBtn');b&&b.click()}}
 else if(p==='esur'){Math.random()<.5?__bj.act('R'):__bj.early(false)}
 else if(p==='insure'){__bj.takeIns(Math.random()<.5?1:0)}
 else if(p==='play'){__bj.act('HSDPR'[Math.floor(Math.random()*5)])}
 else if(p==='check'){__bj.submitCountValue(Math.random()<.7?G.rc:G.rc+1)}
 else if(p==='between'){__bj.nextRound()}},60)}"""
CASES = [
 ('practice default', 'practice', {}),
 ('H17 off, early sur, ENHC, no DAS, 8 decks, ins', 'practice', dict(h17=0, sur=2, peek=0, das=0, decks=8, ins=1, every=1)),
 ('resplit aces, maxSplit 3, late sur, KO, 2 players', 'practice', dict(resplit=1, maxSplit=3, sys='ko', addp=1, maxp=2, ins=1, every=2)),
 ('deviations adv + random players + distractions + totals', 'practice', dict(dev=2, addp=1, maxp=4, rand=1, dist=1, tot=1, ins=1, every=1)),
 ('Omega II 2 decks cut 1.5', 'practice', dict(sys='omega2', decks=2, cutLeft=1.5, every=1)),
 ('game standard', 'game', {}),
 ('game + players', 'game', dict(addp=1, maxp=3, rand=1)),
]
N = int(sys.argv[1]) if len(sys.argv) > 1 else 12
with sync_playwright() as p:
    for name, kind, mods in CASES:
        b, pg, errs = open_page(p)
        to_menu(pg, kind)
        target = 'GC' if kind == 'game' else 'PC'
        pg.evaluate("([t,m])=>Object.assign(__bj[t],m)", [target, mods])
        go(pg)
        pg.evaluate(DRV)
        pg.wait_for_function(f"()=>__bj.G&&(__bj.G.rounds>={N}||!__bj.G.alive)", timeout=240000)
        st = pg.evaluate("()=>{const G=__bj.G;return {rounds:G.rounds,bank:G.bank,rc:G.rc,pos:G.shoe.pos,left:G.shoe.cards.length-G.shoe.pos,strat:G.strat,heat:G.heat,checks:G.checks.length,phase:G.phase}}")
        pg.evaluate("()=>{clearInterval(window.drv);__bj.showResults()}")
        pg.wait_for_timeout(300)
        res = pg.evaluate("()=>document.getElementById('results').innerText.slice(0,120)")
        ok = not errs and st['bank'] == st['bank'] and st['left'] >= 0
        print('PASS' if ok else 'FAIL', name, json.dumps(st), '|', res.replace('\n', ' '))
        if errs: print('   errs:', errs[:3])
        b.close()
