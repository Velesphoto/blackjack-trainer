/* ==========================================================================
   Core: pure blackjack logic. No DOM, no globals, no randomness except in
   makeShoe (which takes an optional rng). Everything the UI needs to decide
   "what is the right play" or "what is the count" lives here so it can be
   unit tested in Node (see tests/core.test.js).
   ========================================================================== */
const Core = (() => {
  const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
  const SUITS = ['♠', '♥', '♦', '♣'];
  const PLAY_NAME = { H: 'Hit', S: 'Stand', D: 'Double', P: 'Split', R: 'Surrender' };

  /* ---------- cards and hands ---------- */
  const rankVal = r => (r === 'A' ? 11 : '10JQK'.includes(r) ? 10 : +r);
  const val = c => rankVal(c.r);
  function total(cards) {
    let t = 0, aces = 0;
    for (const c of cards) { t += val(c); if (c.r === 'A') aces++; }
    while (t > 21 && aces) { t -= 10; aces--; }
    return { t, soft: aces > 0 };
  }
  const isBlackjack = cards => cards.length === 2 && total(cards).t === 21;
  const upLabel = c => (c.r === 'A' ? 'A' : val(c));
  const fmt = n => (n > 0 ? '+' + n : n < 0 ? '−' + Math.abs(n) : '0');

  /* ---------- counting systems ---------- */
  const tagRow = (a, two, three, four, five, six, seven, eight, nine, ten) =>
    ({ A: a, 2: two, 3: three, 4: four, 5: five, 6: six, 7: seven, 8: eight, 9: nine, 10: ten, J: ten, Q: ten, K: ten });
  const SYSTEMS = {
    hilo:  { name: 'Hi-Lo',     balanced: true,  tags: tagRow(-1, 1, 1, 1, 1, 1, 0, 0, 0, -1) },
    ko:    { name: 'KO',        balanced: false, tags: tagRow(-1, 1, 1, 1, 1, 1, 1, 0, 0, -1) },
    hiopt2:{ name: 'Hi-Opt II', balanced: true,  tags: tagRow(0, 1, 1, 2, 2, 1, 1, 0, 0, -2) },
    omega2:{ name: 'Omega II',  balanced: true,  tags: tagRow(0, 1, 1, 2, 2, 2, 1, 0, -1, -2) },
  };
  const tag = (sys, c) => SYSTEMS[sys].tags[c.r];
  /* KO is unbalanced, so it starts below zero: -4 per deck beyond the first. */
  const startCount = (sys, decks) => (SYSTEMS[sys].balanced ? 0 : -4 * (decks - 1));

  /* True count per the deviations guide: 2 decks divide by half-decks left
     (nearest 0.5, min 0.5); 4+ decks divide by whole decks left (nearest, min 1). */
  function divisor(decks, cardsLeft) {
    const left = cardsLeft / 52;
    return decks === 2 ? Math.max(0.5, Math.round(left * 2) / 2) : Math.max(1, Math.round(left));
  }
  const trueCount = (rc, decks, cardsLeft) => rc / divisor(decks, cardsLeft);

  /* ---------- shoe ---------- */
  function makeShoe(decks, cutLeftDecks = 0.3, rng = Math.random) {
    const cards = [];
    for (let d = 0; d < decks; d++) for (const s of SUITS) for (const r of RANKS) cards.push({ r, s });
    for (let i = cards.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [cards[i], cards[j]] = [cards[j], cards[i]];
    }
    return { cards, pos: 0, decks, cutAt: cards.length - Math.round(cutLeftDecks * 52) };
  }
  const cardsLeft = shoe => shoe.cards.length - shoe.pos;

  /* ---------- rules ---------- */
  const DEFAULT_RULES = {
    decks: 6, h17: 1, bj: 1.5, sur: 1 /* 0 none, 1 late, 2 early */, ins: 0,
    das: 1, resplitAces: 0, maxSplit: 3 /* max hands = maxSplit + 1 */, peek: 1, cutLeft: 0.3,
  };

  /* ---------- basic strategy ---------- */
  /* env: { rules, canD (double allowed right now), canS (a legal split) , afterSplit } */
  function basic(cards, up, env) {
    const { rules } = env, { t, soft } = total(cards), H = !!rules.h17, cd = env.canD;
    const dbl = alt => (cd ? 'D' : alt);
    const pair = env.canS && cards.length === 2 && val(cards[0]) === val(cards[1]);
    const das = !!rules.das, noPeek = !rules.peek;
    if (pair) {
      const p = val(cards[0]);
      if (noPeek && ((p === 11 && up === 11) || (p === 8 && (up === 11 || up === 10)))) return 'H';
      if (p === 11 || p === 8) return 'P';
      if (p === 9) return (up === 7 || up >= 10) ? 'S' : 'P';
      if (p === 7) return up <= 7 ? 'P' : 'H';
      if (p === 6) return (das ? up >= 2 : up >= 3) && up <= 6 ? 'P' : 'H';
      if (p === 4) return das && (up === 5 || up === 6) ? 'P' : 'H';
      if ((p === 3 || p === 2) && (das ? up <= 7 : (up >= 4 && up <= 7))) return 'P';
    }
    if (soft) {
      if (t >= 20) return 'S';
      if (t === 19) return (H && up === 6) ? dbl('S') : 'S';
      if (t === 18) return ((up >= 3 && up <= 6) || (H && up === 2)) ? dbl('S') : (up <= 8 ? 'S' : 'H');
      if (t === 17) return (up >= 3 && up <= 6) ? dbl('H') : 'H';
      if (t >= 15) return (up >= 4 && up <= 6) ? dbl('H') : 'H';
      return (up >= 5 && up <= 6) ? dbl('H') : 'H';
    }
    if (t >= 17) return 'S';
    if (t >= 13) return up <= 6 ? 'S' : 'H';
    if (t === 12) return (up >= 4 && up <= 6) ? 'S' : 'H';
    if (t === 11) return (up === 11 && noPeek) ? 'H' : (up <= 10 || H) ? dbl('H') : 'H';
    if (t === 10) return up <= 9 ? dbl('H') : 'H';
    if (t === 9) return (up >= 3 && up <= 6) ? dbl('H') : 'H';
    return 'H';
  }

  /* Early surrender is chosen before the dealer peeks. Approximate chart:
     vs A hard 5-7 and 12-16 (and 17 when the dealer hits soft 17), vs 10 hard 14-16, plus 8,8 vs A. */
  function earlySurrender(cards, up, rules) {
    if (rules.sur !== 2 || cards.length !== 2) return false;
    const { t, soft } = total(cards), eights = val(cards[0]) === 8 && val(cards[1]) === 8;
    if (up === 11) return eights || (!soft && ((t >= 5 && t <= 7) || (t >= 12 && t <= 16) || (t === 17 && !!rules.h17)));
    if (up === 10) return !soft && !eights && t >= 14 && t <= 16;
    return false;
  }

  /* ---------- count deviations (Hi-Lo) ---------- */
  /* lvl 0 off, 1 Illustrious 18 (standard multi-deck numbers), 2 Advanced (guide numbers adjusted for H17 / 2 decks).
     Row: k kind, v hand value, u dealer card, a play at or above the index, c Illustrious number,
     m multi-deck number, d 2-deck number, lt = play a when BELOW the index (stand at or above it),
     lo = play when the index is not reached (Advanced only). An object value is {s,h} (S17/H17) or {n,late}. */
  const S17 = (s, h) => ({ s, h });
  const IDX = [
    { k: 'ins', u: 11, a: 'I', c: 3, m: 3, d: { n: 2.5, late: 2 } },
    { k: 'pair', v: 10, u: 4, a: 'P', m: 6 },
    { k: 'pair', v: 10, u: 5, a: 'P', c: 5, m: 5, d: 4 },
    { k: 'pair', v: 10, u: 6, a: 'P', c: 4, m: 4, d: { n: 4, late: 3 } },
    { k: 'hard', v: 16, u: 9, a: 'S', c: 5, m: 5 },
    { k: 'hard', v: 16, u: 10, a: 'S', c: 0, m: 0 },
    { k: 'hard', v: 15, u: 10, a: 'S', c: 4, m: 4 },
    { k: 'hard', v: 13, u: 2, a: 'H', lt: 1, c: -1, m: -1 },
    { k: 'hard', v: 13, u: 3, a: 'H', lt: 1, c: -2, m: -2 },
    { k: 'hard', v: 12, u: 2, a: 'S', c: 3, m: 3 },
    { k: 'hard', v: 12, u: 3, a: 'S', c: 2, m: 2 },
    { k: 'hard', v: 12, u: 4, a: 'H', lt: 1, c: 0, m: 0 },
    { k: 'hard', v: 12, u: 5, a: 'H', lt: 1, c: -2, m: -2 },
    { k: 'hard', v: 12, u: 6, a: 'H', lt: 1, c: -1, m: S17(-1, -3) },
    { k: 'hard', v: 11, u: 11, a: 'D', lo: 'H', c: 1, m: S17(1, -1), d: S17(0, -2) },
    { k: 'hard', v: 10, u: 10, a: 'D', c: 4, m: 4 },
    { k: 'hard', v: 10, u: 11, a: 'D', c: 4, m: S17(4, 3), d: S17(3, 2) },
    { k: 'hard', v: 9, u: 2, a: 'D', c: 1, m: 1, d: S17(1, 0) },
    { k: 'hard', v: 9, u: 7, a: 'D', c: 3, m: 3 },
    { k: 'hard', v: 8, u: 6, a: 'D', c: 2, m: 2, d: 1 },
    { k: 'hard', v: 8, u: 5, a: 'D', d: 3 },
    { k: 'soft', v: 20, u: 4, a: 'D', m: 6 },
    { k: 'soft', v: 20, u: 5, a: 'D', m: 5 },
    { k: 'soft', v: 20, u: 6, a: 'D', m: 4 },
    { k: 'soft', v: 19, u: 5, a: 'D', m: 1 },
    { k: 'soft', v: 19, u: 6, a: 'D', m: S17(1, null), d: S17(0, null) },
    { k: 'soft', v: 17, u: 2, a: 'D', m: 1 },
    { k: 'sur', v: 14, u: 10, a: 'R', c: 3, m: 3 },
    { k: 'sur', v: 15, u: 9, a: 'R', c: 2, m: 2 },
    { k: 'sur', v: 15, u: 10, a: 'R', c: 0, m: 0 },
    { k: 'sur', v: 15, u: 11, a: 'R', c: 1, m: S17(1, -1), d: S17(2, 0) },
  ];

  /* The index number for a row at a given level. ctx: {decks, h17, late}. `chart` ignores the late-shoe change. */
  function indexValue(r, lvl, ctx, chart) {
    if (!lvl) return null;
    let v = lvl === 1 ? r.c : (ctx.decks === 2 && r.d !== undefined ? r.d : r.m);
    if (v === undefined || v === null) return null;
    if (typeof v === 'object') v = 'n' in v ? ((!chart && ctx.late) ? v.late : v.n) : (ctx.h17 ? v.h : v.s);
    return v;
  }
  const insuranceIndex = (lvl, ctx, chart) => indexValue(IDX[0], lvl, ctx, chart);
  const lateShoe = (cardsLeftNow) => cardsLeftNow / 52 <= 1;

  /* env: { rules, lvl, tc, late, canD, canS, canR } -> { play, note } */
  function decide(cards, up, env) {
    const rules = env.rules, lvl = env.lvl || 0, tc = env.tc || 0;
    const { t, soft } = total(cards);
    const b = basic(cards, up, env);
    const ctx = { decks: rules.decks, h17: !!rules.h17, late: !!env.late };
    const why = i => ` Index play: true count ${fmt(+tc.toFixed(1))} vs index ${fmt(i)}.`;

    /* late surrender (and its count-based variants) comes first */
    if (env.canR && rules.sur === 1 && cards.length === 2 && !soft && b !== 'P') {
      if (t === 16 && up >= 9) return { play: 'R', note: '' };
      if (t === 17 && up === 11) return { play: rules.h17 ? 'R' : b, note: '' };
      const row = lvl ? IDX.find(x => x.k === 'sur' && x.v === t && x.u === up) : null;
      const i = row ? indexValue(row, lvl, ctx) : null;
      if (i !== null) { if (tc >= i) return { play: 'R', note: why(i) }; }
      else if (t === 15 && (up === 10 || (up === 11 && rules.h17))) return { play: 'R', note: '' };
    }
    if (!lvl) return { play: b, note: '' };

    for (const r of IDX) {
      if (r.u !== up || r.k === 'ins' || r.k === 'sur') continue;
      if (!rules.peek && up >= 10) continue; /* index numbers assume the dealer has peeked */
      if (r.k === 'pair') { if (!(env.canS && cards.length === 2 && val(cards[0]) === r.v && val(cards[1]) === r.v)) continue; }
      else if (b === 'P' || t !== r.v || soft !== (r.k === 'soft')) continue;
      const i = indexValue(r, lvl, ctx);
      if (i === null) continue;
      if (r.lt ? tc >= i : tc < i) {
        const o = (lvl === 2 && r.lo) || b;
        return { play: o, note: o !== b ? why(i) : '' };
      }
      if ((r.a === 'D' && !env.canD) || (r.a === 'P' && !env.canS)) return { play: b, note: '' };
      return { play: r.a, note: r.a !== b ? why(i) : '' };
    }
    return { play: b, note: '' };
  }

  /* Insurance: take it at or above the index. lvl 0 means basic strategy: never. */
  function insuranceDecision(lvl, ctx, tc) {
    const i = insuranceIndex(lvl, ctx);
    return { index: i, take: lvl > 0 && i !== null && tc >= i };
  }

  /* ---------- describing a hand ---------- */
  function describe(cards, canPair) {
    const { t, soft } = total(cards);
    if (canPair && cards.length === 2 && val(cards[0]) === val(cards[1])) {
      const p = val(cards[0]);
      return 'a pair of ' + (p === 11 ? 'aces' : p + 's');
    }
    return (soft ? 'soft ' : '') + t;
  }
  const handFromRanks = (...ranks) => ranks.map(r => ({ r: String(r), s: '♠' }));

  /* ---------- rough economics (bet-spread feedback) ---------- */
  /* Player edge estimate in percent at a true count: base house edge from the rules, +0.5% per true count. */
  function edgePct(rules, tc) {
    let base = -0.45 - (rules.h17 ? 0.2 : 0) + (rules.bj - 1.5) * 4.75;
    if (rules.decks === 2) base += 0.35; else if (rules.decks === 4) base += 0.1; else if (rules.decks === 8) base -= 0.05;
    if (!rules.das) base -= 0.15;
    if (rules.sur) base += 0.08;
    return base + 0.5 * tc;
  }
  const rampUnits = tc => Math.max(1, Math.min(8, Math.floor(tc)));
  /* Compare actual bets with a standard 1–8 unit ramp. hist: [{tc, bet}] */
  function spreadReport(hist, rules, maxBet = 500) {
    if (!hist.length) return null;
    const low = hist.filter(h => h.tc < 1).map(h => h.bet);
    const unit = low.length ? low.reduce((a, b) => a + b, 0) / low.length : Math.min(...hist.map(h => h.bet));
    let actual = 0, ideal = 0;
    for (const h of hist) {
      const e = edgePct(rules, h.tc) / 100;
      actual += h.bet * e;
      ideal += Math.min(maxBet, unit * rampUnits(h.tc)) * e;
    }
    const hi = hist.filter(h => h.tc >= 2).map(h => h.bet), lo = hist.filter(h => h.tc <= 0).map(h => h.bet);
    const avg = a => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0);
    return { unit, actual, ideal, left: Math.max(0, ideal - actual), avgHigh: avg(hi), avgLow: avg(lo), nHigh: hi.length, nLow: lo.length };
  }

  return {
    RANKS, SUITS, PLAY_NAME, SYSTEMS, IDX, DEFAULT_RULES,
    rankVal, val, total, isBlackjack, upLabel, fmt, tag, startCount, trueCount, divisor, makeShoe, cardsLeft,
    basic, earlySurrender, decide, indexValue, insuranceIndex, insuranceDecision, lateShoe,
    describe, handFromRanks, edgePct, rampUnits, spreadReport,
  };
})();
if (typeof module !== 'undefined') module.exports = Core;
