"""Scripted-shoe checks for the new rules: early surrender, no hole card, double after split, resplit aces, chip stacks."""
import sys, os, json; sys.path.insert(0, os.path.dirname(__file__))
from h import *
fails = []
def chk(name, cond, extra=''):
    print('PASS' if cond else 'FAIL', name, extra if not cond else '')
    if not cond: fails.append(name)
with sync_playwright() as p:
    b, pg, errs = open_page(p)
    to_menu(pg, 'game')
    def setup(mods, bet=100, cards=()):
        pg.evaluate("""([m,bet,cards])=>{Object.assign(__bj.GC,{custom:1,tot:0,addp:0},m);launch('game');
          const G=__bj.G;G.bet=bet;G.lastBet=bet;
          G.shoe.cards.splice(G.shoe.pos,0,...cards.map(r=>({r:String(r),s:'♠'})))}""", [mods, bet, list(cards)])
        pg.wait_for_timeout(200)
    bank = lambda: pg.evaluate("()=>__bj.G.bank")
    phase = lambda: pg.evaluate("()=>__bj.G.phase")
    base = dict(sur=2, peek=1, das=1, resplit=0, ins=0, maxSplit=3, h17=1, decks=6, cutLeft=.3, bj=1.5)
    # 1. early surrender vs dealer blackjack: lose only half
    setup(base, 100, [10, 10, 6, 'A'])
    pg.evaluate("()=>__bj.dealRound()"); chk('ES offered', phase()=='esur', phase())
    pg.evaluate("()=>__bj.act('R')"); pg.wait_for_timeout(300)
    chk('ES surrender vs BJ loses half', bank()==150, str(bank()))
    chk('ES graded right', pg.evaluate("()=>__bj.G.strat.ok")==1)
    # 2. decline ES, dealer has BJ: lose all
    setup(base, 100, [10, 10, 6, 'A'])
    pg.evaluate("()=>__bj.dealRound()"); pg.evaluate("()=>__bj.early(false)"); pg.wait_for_timeout(300)
    chk('ES declined then dealer BJ loses full', bank()==100, str(bank()))
    # 3. no hole card: dealer blackjack revealed after you stand
    setup(dict(base, sur=0, peek=0), 100, [10, 10, 9, 'A'])
    pg.evaluate("()=>__bj.dealRound()"); chk('ENHC play continues', phase()=='play', phase())
    pg.evaluate("()=>__bj.act('S')"); pg.wait_for_timeout(1800)
    chk('ENHC stand vs hidden BJ loses', bank()==100, str(bank()))
    # 4. ENHC: doubled bet is lost to dealer blackjack (all of it)
    setup(dict(base, sur=0, peek=0), 100, [5, 10, 6, 'A', 4])
    pg.evaluate("()=>__bj.dealRound()"); pg.evaluate("()=>__bj.act('D')"); pg.wait_for_timeout(1800)
    chk('ENHC double lost in full', bank()==0, str(bank()))
    # 5. no double after split
    for das, exp in [(0, False), (1, True)]:
        setup(dict(base, sur=0, das=das), 25, [8, 6, 8, 10, 3, 2])
        pg.evaluate("()=>__bj.dealRound()"); pg.evaluate("()=>__bj.act('P')"); pg.wait_for_timeout(200)
        can = pg.evaluate("()=>canDouble(__bj.G.hands[0])")
        chk(f'DAS={das} double after split', can==exp, str(can))
    # 6. resplit aces
    for rs, exp in [(0, 2), (1, 3)]:
        setup(dict(base, sur=0, resplit=rs), 25, ['A', 6, 'A', 10, 'A', 5, 'A', 4])
        pg.evaluate("()=>__bj.dealRound()"); pg.evaluate("()=>__bj.act('P')"); pg.wait_for_timeout(200)
        pg.evaluate("()=>{const G=__bj.G; if(G.phase==='play'&&canSplit(G.hands[G.cur])) __bj.act('P')}"); pg.wait_for_timeout(300)
        n = pg.evaluate("()=>__bj.G.hands.length")
        chk(f'resplit aces={rs} hands', n==exp, str(n))
    # 7. chip stacks update on double and split
    setup(dict(base, sur=0), 25, [5, 6, 6, 10, 4])
    pg.evaluate("()=>__bj.dealRound()"); pg.wait_for_timeout(1500)
    c1 = pg.evaluate("()=>document.querySelectorAll('#player .cs').length")
    pg.evaluate("()=>__bj.act('D')"); pg.wait_for_timeout(300)
    c2 = pg.evaluate("()=>document.querySelectorAll('#player .cs').length")
    chk('chip stack grows on double', c2 > c1, f'{c1}->{c2}')
    pg.screenshot(path='/tmp/s_chips.png')
    # 8. spread/results tile and heat meter exist
    pg.evaluate("()=>{const G=__bj.G;G.hist=[{tc:0,bet:25,prof:25},{tc:4,bet:25,prof:25},{tc:5,bet:100,prof:100}];showResults()}")
    chk('edge left tile in results', 'Edge left on the table' in pg.inner_text('#results'))
    chk('no page errors', not errs, str(errs))
    b.close()
print('FAILED:', fails if fails else 'none')
