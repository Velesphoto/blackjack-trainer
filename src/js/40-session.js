/* ==========================================================================
   Table session: state, round flow, grading, other players, dealer, payouts,
   count checks, heat. One place per behaviour (no wrapper layers).
   G.phase: bet → (esur) → (insure) → play → others → dealer → wait → check → between
            (over = backed off by the pit)
   ========================================================================== */
let G = null;            /* current session state, or null */
let CID = 0;             /* running card id, used to animate only newly dealt cards */
const R = () => K.rules;

function stopSessionTimers() { clearTimeout(chatTimer); chatTimer = null; }

/* ---------- shoe and cards ---------- */
function newShoe(keepCount) {
  const old = G.rc;
  G.shoe = Core.makeShoe(R().decks, R().cutLeft);
  G.rc = keepCount ? old : Core.startCount(K.sys, R().decks);
}
function deal(up = true) {
  if (Core.cardsLeft(G.shoe) <= 0) newShoe(true);
  const c = G.shoe.cards[G.shoe.pos++];
  c.id = ++CID;
  if (up) G.rc += Core.tag(K.sys, c);
  return c;
}
function reveal() { if (!G.holeUp) { G.holeUp = true; G.rc += Core.tag(K.sys, G.dealer[1]); } }
const trueC = () => Core.trueCount(G.rc, R().decks, Core.cardsLeft(G.shoe));
const balanced = () => Core.SYSTEMS[K.sys].balanced;
const pace = (lo, hi) => (K.dist ? rand(lo * 0.6, hi * 1.5) : (lo + hi) / 2);

/* ---------- other players ---------- */
const mkSeat = () => ({ skill: 0.55 + Math.random() * 0.4, stay: 3 + Math.floor(Math.random() * 6) });
function initSeats() {
  G.seat = [null, null, null, null];
  for (let i = 0; i < K.players; i++) {
    if (K.rand) { if (Math.random() < 0.4) G.seat[i] = { ...mkSeat(), stay: 1 + Math.floor(Math.random() * 5) }; }
    else G.seat[i] = { skill: mkSeat().skill, stay: 1e9 };
  }
}
function updateSeats() {
  if (!K.rand) return '';
  const m = [];
  for (let i = 0; i < K.players; i++) {
    const s = G.seat[i];
    if (s) { s.stay--; if (s.stay <= 0 && Math.random() < 0.4) { G.seat[i] = null; m.push('A player leaves the table.'); } }
    else if (G.rounds > 0 && Math.random() < 0.25) { G.seat[i] = mkSeat(); m.push('A player sits down.'); }
  }
  return m.join(' ') + (m.length ? ' ' : '');
}
/* Other players follow basic strategy but make mistakes, more often the lower their skill */
function slip(b, h) {
  if (Math.random() < h.skill) return b;
  const t = total(h.cards).t;
  if (b === 'S') return t <= 16 ? 'H' : b;
  if (b === 'H') return t >= 12 ? 'S' : b;
  if (b === 'D') return 'H';
  return b;
}

/* ---------- starting ---------- */
function startSession() {
  const g = K.gm === 'game', st = g ? gameStart() : 0;
  G = {
    kind: 'table', gm: K.gm, rounds: 0, strat: { ok: 0, n: 0, miss: [] }, checks: [], showCount: false, hintMove: false, usedHint: false, usedCount: false,
    bank: g ? st : 1e9, start: st, peak: st, bet: g ? 25 : 10, lastBet: 25, hands: [], others: [], dealer: [], hist: [], log: [], agg: { n: 0, B: 0, D: 0 },
    heat: 0, baseBet: 0, prevBet: 0, cover: { n: 0, cost: 0 }, phase: 'bet', ins: 0, alive: true, saved: false,
  };
  streak = 0;
  $('tCount').checked = $('tHint').checked = $('popChk').checked = false;
  newShoe(); initSeats();
  $('intro').hidden = $('results').hidden = $('drill').hidden = true; $('table').hidden = false;
  $('table').className = g ? 'gm-game' : 'gm-prac';
  document.body.classList.toggle('prac', !g); document.body.classList.add('tbl'); $('chartBtn').hidden = g;
  $('heatBox').hidden = !g;
  document.querySelectorAll('.chip3d.thrown').forEach(e => e.remove());
  if (K.dist) scheduleChatter();
  nextRound(true);
}

function nextRound(first) {
  if (G.gm === 'game' && G.bank < 5) { showResults(); return; }
  let note = '';
  if (!first && G.shoe.pos >= G.shoe.cutAt) {
    newShoe(); note = `Fresh shoe shuffled. The count is back to ${fmt(G.rc)}.`;
    bigText('New Shoe!');
  }
  document.querySelectorAll('.chip3d.thrown').forEach(e => e.remove());
  note += updateSeats();
  Object.assign(G, { note, fb: null, cm: null, result: '', holeUp: false, cur: -1, hands: [], others: [], dealer: [], phase: 'bet', ins: 0 });
  G.bet = Math.max(5, Math.min(G.bet, 100, Math.floor(G.bank / 5) * 5));
  G.jit = newJitter(); G.fresh = null;
  render();
}

/* ---------- helpers on hands ---------- */
const avail = () => G.bank - G.hands.reduce((a, h) => a + h.bet, 0) - (G.ins || 0);
function canDouble(h) { return h.cards.length === 2 && !h.done && !h.fromAce && (!h.split || !!R().das) && avail() >= h.bet; }
function canSplit(h) {
  return h.cards.length === 2 && !h.done && val(h.cards[0]) === val(h.cards[1]) && G.hands.length <= R().maxSplit &&
    (h.cards[0].r !== 'A' || G.hands.length === 1 || !!R().resplitAces) && avail() >= h.bet;
}
const canSurr = h => R().sur === 1 && G.phase === 'play' && G.hands.length === 1 && h.cards.length === 2 && !h.done;
const devLevel = () => (K.gm === 'game' ? 0 : K.dev);
function envFor(h, lvl) {
  return { rules: R(), lvl, tc: trueC(), late: Core.lateShoe(Core.cardsLeft(G.shoe)), canD: canDouble(h), canS: canSplit(h), canR: canSurr(h) };
}
const decideFor = (h, lvl) => Core.decide(h.cards, val(G.dealer[0]), envFor(h, lvl));
const nameOf = x => PLAY_NAME[x] || x;

/* ---------- dealing ---------- */
function dealRound() {
  if (G.phase !== 'bet') return;
  G.tc0 = trueC();
  if (G.gm === 'game') heatOnBet();
  const me = { cards: [], bet: G.bet };
  G.hands = [me]; G.cur = 0; G.ins = 0;
  G.others = G.seat.filter(Boolean).map(s => ({ cards: [], skill: s.skill }));
  const seats = [...G.others, me];
  seats.forEach(s => s.cards.push(deal())); G.dealer.push(deal());
  seats.forEach(s => s.cards.push(deal())); G.dealer.push(deal(false));
  const up = val(G.dealer[0]);
  if (R().sur === 2 && up >= 10 && !Core.isBlackjack(me.cards)) { G.phase = 'esur'; render(); return; }
  offerInsurance();
}
function offerInsurance() {
  const me = G.hands[0];
  if (R().ins && val(G.dealer[0]) === 11 && avail() >= me.bet / 2) { G.phase = 'insure'; render(); return; }
  peekStep();
}
/* The dealer peeks (when the rules say so); a blackjack on either side ends the round now. */
function peekStep() {
  const me = G.hands[0], dbj = !!R().peek && val(G.dealer[0]) >= 10 && Core.isBlackjack(G.dealer);
  if (dbj || Core.isBlackjack(me.cards)) { reveal(); settle(); endRound(); }
  else if (me.surr) afterMe();
  else { G.phase = 'play'; render(); }
}

/* ---------- recording a graded decision ---------- */
function gradeRecord(ok, miss) { G.strat.n++; if (ok) G.strat.ok++; else G.strat.miss.push(miss); }
/* Game Mode keeps the last 20 decisions plus running totals */
function logDecision(entry) {
  G.log.push(entry);
  const g = G.agg; g.n++; if (entry.okB) g.B++; if (entry.okD) g.D++;
  if (G.log.length > 20) G.log.shift();
}

function early(yes) {
  if (G.phase !== 'esur') return;
  const me = G.hands[0], up = val(G.dealer[0]), best = Core.earlySurrender(me.cards, up, R()), ok = !!yes === best;
  const desc = Core.describe(me.cards, false), upT = 'dealer ' + upLabel(G.dealer[0]);
  gradeRecord(ok, `${desc} vs ${upT}: ${best ? 'surrender' : 'play on'} (you chose ${yes ? 'surrender' : 'to play on'})`);
  G.fb = { ok, t: ok ? `${yes ? 'Surrendering' : 'Playing on'} ${desc} against ${upT} is right.` : `Basic strategy says ${best ? 'surrender' : 'play on'} ${desc} against ${upT}.` };
  if (G.gm === 'game') logDecision({ r: G.rounds + 1, d: 'Early surrender', u: upLabel(G.dealer[0]), a: yes ? 'R' : 'H', bB: best ? 'R' : 'H', bD: best ? 'R' : 'H', tc: +trueC().toFixed(1), okB: ok, okD: ok });
  if (yes) { me.done = me.surr = true; }
  pop(ok);
  offerInsuranceUnlessOut();
}
const offerInsuranceUnlessOut = () => (G.hands[0].surr ? peekStep() : offerInsurance());

function takeIns(y) {
  if (G.phase !== 'insure') return;
  const me = G.hands[0], tc = trueC(), ctx = { decks: R().decks, h17: !!R().h17, late: Core.lateShoe(Core.cardsLeft(G.shoe)) };
  const lvl = devLevel(), cur = Core.insuranceDecision(lvl, ctx, tc), adv = Core.insuranceDecision(2, ctx, tc);
  const ok = !!y === cur.take, at = lvl ? ` at true count ${tcFmt(tc)}` : '';
  gradeRecord(ok, `Insurance at true count ${tcFmt(tc)}: ${cur.take ? 'take it' : 'decline'} (you ${y ? 'took' : 'declined'} it)`);
  G.fb = { ok, t: ok ? `${y ? 'Taking' : 'Declining'} insurance${at} is right.` : (cur.take ? `Take insurance${at} (index ${fmt(cur.index)}).` : lvl ? `Decline insurance${at} (index ${fmt(cur.index)}).` : 'Basic strategy never takes insurance.') };
  if (G.gm === 'game') {
    logDecision({ r: G.rounds + 1, d: 'Insurance', u: 'A', a: y ? 'Take' : 'Decline', bB: 'Decline', bD: adv.take ? 'Take' : 'Decline', tc: +tc.toFixed(1), okB: !y, okD: !!y === adv.take });
    if (y && adv.take) heatAdd(4);                       /* insurance at a high count looks suspicious */
    else if (y) coverPlay(0.035 * me.bet, 8);            /* insurance below the index: a cover play */
  }
  if (y) G.ins = me.bet / 2;
  pop(ok); peekStep();
}

/* ---------- the player's actions ---------- */
function act(a) {
  if (G.phase === 'esur') { if (a === 'R') early(true); return; }
  if (G.phase !== 'play') return;
  const h = G.hands[G.cur]; if (!h) return;
  if ((a === 'D' && !canDouble(h)) || (a === 'P' && !canSplit(h)) || (a === 'R' && !canSurr(h)) || (h.fromAce && (a === 'H' || a === 'D'))) return;
  const hi = G.cur, bet0 = h.bet, up = val(G.dealer[0]), env = envFor(h, devLevel()), d = Core.decide(h.cards, up, env), b = d.play;
  const desc = Core.describe(h.cards, env.canS), upT = 'dealer ' + upLabel(G.dealer[0]), ok = a === b;
  gradeRecord(ok, `${desc} vs ${upT}: ${nameOf(b).toLowerCase()} (you chose ${nameOf(a).toLowerCase()})`);
  G.fb = { ok, t: ok ? `${nameOf(b)} on ${desc} against ${upT} is right.${d.note}` : `${d.note ? 'The count play is' : 'Basic strategy says'} ${nameOf(b).toLowerCase()} on ${desc} against ${upT}.${d.note}` };
  if (G.gm === 'game') gameDecision(h, a);
  else if (!ok) recordMistake(h.cards, up, devLevel(), trueC());

  if (a === 'H') h.cards.push(deal());
  else if (a === 'S') h.done = true;
  else if (a === 'D') { G.fresh = { [hi]: { from: chipList(bet0).length, until: Date.now() + 800 } }; h.bet *= 2; h.cards.push(deal()); h.done = true; }
  else if (a === 'R') { h.done = h.surr = true; }
  else if (a === 'P') { splitHand(h); G.fresh = { [hi + 1]: { from: 0, until: Date.now() + 800 } }; }
  advance();
  if (a === 'D') throwChips(bet0, hi, chipList(bet0).length, true);
  if (a === 'P') throwChips(bet0, hi + 1, 0, true);
  pop(ok);
}
function splitHand(h) {
  const c = h.cards, aces = c[0].r === 'A', R_ = R();
  const mk = card => {
    const n = { cards: [card, deal()], bet: h.bet, split: true };
    if (aces) { n.fromAce = true; if (!(R_.resplitAces && n.cards[1].r === 'A')) n.done = true; }
    return n;
  };
  const h1 = mk(c[0]), h2 = mk(c[1]);
  G.hands.splice(G.cur, 1, h1, h2);
}
/* mark finished hands, move to the next live hand, or on to the other players */
function advance() {
  for (const x of G.hands) {
    if (total(x.cards).t >= 21) x.done = true;
    if (x.fromAce && !x.done && x.cards.length === 2 && !canSplit(x)) x.done = true;
  }
  while (G.cur < G.hands.length && G.hands[G.cur].done) G.cur++;
  if (G.cur >= G.hands.length) afterMe(); else render();
}
function afterMe() {
  G.cur = -1;
  if (!G.others.length) return dealerTurn();
  G.phase = 'others'; G.oi = 0; render(); laterG(othersStep, pace(350, 750));
}
function othersStep() {
  if (G.phase !== 'others') return;
  const h = G.others[G.oi];
  if (!h) return dealerTurn();
  if (h.done || total(h.cards).t >= 21) { h.done = true; G.oi++; return othersStep(); }
  const env = { rules: R(), lvl: 0, tc: 0, canD: h.cards.length === 2, canS: false, canR: false };
  const b = slip(Core.decide(h.cards, val(G.dealer[0]), env).play, h);
  if (b === 'S') h.done = true; else { h.cards.push(deal()); if (b === 'D') h.done = true; }
  render(); laterG(othersStep, pace(350, 750));
}
function dealerTurn() {
  G.phase = 'dealer'; G.cur = -1; reveal(); render();
  const live = [...G.hands, ...G.others].some(h => !h.surr && total(h.cards).t <= 21);
  const more = () => { const d = total(G.dealer); return live && (d.t < 17 || (R().h17 && d.t === 17 && d.soft)); };
  const step = () => { if (more()) { G.dealer.push(deal()); render(); laterG(step, pace(450, 850)); } else { settle(); endRound(); } };
  laterG(step, pace(450, 850));
}

/* ---------- payouts ---------- */
function settle() {
  const dt = total(G.dealer).t, dbj = Core.isBlackjack(G.dealer);
  const out = (h, single) => {
    const t = total(h.cards).t;
    if (h.surr) return ['Surrender', -0.5];
    if (single && Core.isBlackjack(h.cards)) return dbj ? ['Push', 0] : ['Blackjack', R().bj];
    if (t > 21) return ['Bust', -1];
    if (dbj) return ['Dealer blackjack', -1];
    if (dt > 21 || t > dt) return ['Win', 1];
    if (t < dt) return ['Lose', -1];
    return ['Push', 0];
  };
  let prof = 0, ins = '';
  const res = G.hands.map(h => { const [l, m] = out(h, G.hands.length === 1); prof += m * h.bet; return l; });
  G.others.forEach(h => (h.res = out(h, true)[0]));
  if (G.ins) { const w = dbj ? G.ins * 2 : -G.ins; prof += w; ins = ` · Insurance ${dbj ? 'paid ' + usd(w) : 'lost ' + usd(G.ins)}`; }
  const text = G.hands.length > 1 ? res.map((r, i) => `Hand ${i + 1}: ${r}`).join(' · ') : res[0];
  if (G.gm === 'game') {
    G.bank += prof; G.result = text + ins + ` (${sgn(prof)})`;
    G.hist.push({ tc: G.tc0, bet: G.bet, prof });
    G.peak = Math.max(G.peak, G.bank); saveMilestone(); moneyPop(prof);
    if (G.bank - G.start >= 5 * G.start) G.backedOff = true;   /* a big winner gets noticed too */
  } else G.result = text;
}
/* Game Mode: the next session's bankroll is saved the moment a milestone ($300, then every $100) is reached */
function saveMilestone() {
  const m = Math.floor(G.peak / 100) * 100;
  if (m >= 300 && m > gameStart()) { store.set(KEYS.gmStart, m); toast(`Milestone: your next session starts at ${usd(m)}.`); }
}

function endRound() {
  G.rounds++; G.cur = -1;
  if (G.gm === 'game') heatAdd(-1);
  if (G.backedOff) { G.phase = 'over'; render(); later(() => heatOutScreen(G), 1600); return; }
  if (!(K.every && G.rounds % K.every === 0)) { G.phase = 'between'; render(); return; }
  G.phase = 'wait'; render();
  const g = G;   /* the check prompt waits a full second after the dealing finishes */
  later(() => { if (G !== g || !g.alive || g.phase !== 'wait') return; g.phase = 'check'; render(); startClock(); }, Math.max(Anim.all - Date.now(), 0) + 1000);
}

/* ---------- count check ---------- */
function submitCount() {
  const i = $('cnt'), v = i ? i.value.trim() : '';
  if (/^-?\d+$/.test(v)) submitCountValue(parseInt(v, 10));
}
function submitCountValue(guess) {
  if (!G || G.phase !== 'check') return;
  const dt = stopClock(), r = gradeCount(guess, G.rc, dt);
  G.checks.push(r);
  G.cm = r.ok ? { ok: true, t: `Count ${fmt(G.rc)} is right. ${(dt / 1000).toFixed(1)}s, ${r.pts} points.` } : { ok: false, t: `You said ${fmt(guess)}. The count is ${fmt(G.rc)}. ${(dt / 1000).toFixed(1)}s.` };
  G.phase = 'between'; render(); pop(r.ok);
}
/* shared with the burst drill */
function gradeCount(guess, actual, dt) {
  const ok = guess === actual, pts = ok ? countPoints(dt) : 0;
  if (ok && dt < GOAL_FAST_MS) bumpGoal();
  return { guess, actual, ok, dt, pts };
}

/* ---------- Game Mode: accuracy log, heat and cover plays ---------- */
function gameDecision(h, a) {
  const up = val(G.dealer[0]), tc = trueC();
  const bB = decideFor(h, 0).play, bD = decideFor(h, 2).play;
  const { t, soft } = total(h.cards), pair = canSplit(h);
  logDecision({ r: G.rounds + 1, d: pair ? 'Pair of ' + (val(h.cards[0]) === 11 ? 'aces' : val(h.cards[0]) + 's') : (soft ? 'Soft ' : 'Hard ') + t, u: upLabel(G.dealer[0]), a, bB, bD, tc: +tc.toFixed(1), okB: a === bB, okD: a === bD });
  if (a !== bD) recordMistake(h.cards, up, 2, tc);
  if (bD !== bB) { if (a === bD) heatAdd(4); else if (a === bB) coverPlay(0.005 * h.bet, 6); }  /* an index play heats; skipping it is cover */
}
function coverPlay(cost, cool) { G.cover.n++; G.cover.cost += cost; heatAdd(-cool); toast('Cover play: the pit relaxes a little.'); }
function heatAdd(x) { G.heat = Math.max(0, Math.min(100, G.heat + x)); if (G.heat >= 100) G.backedOff = true; }
/* A bet far above your usual one draws heat, more so at a high count, and more for a sudden jump. */
function heatOnBet() {
  const bet = G.bet, tc = G.tc0;
  if (!G.baseBet) G.baseBet = bet;
  const ratio = bet / G.baseBet;
  let add = ratio >= 2 ? Math.min(14, 3 * ratio) + (tc >= 2 ? 3 : 0) : -4;
  if (G.prevBet && bet >= G.prevBet * 3) add += 6;
  if (tc < 1) G.baseBet = Math.max(5, Math.round((G.baseBet * 2 + bet) / 15) * 5);
  G.prevBet = bet; heatAdd(add);
}
function heatOutScreen(g) {
  if (G !== g) return;
  const d = el('<div class="heat">too much heat, you’ve been backed off!</div>');
  document.body.append(d); later(() => { d.remove(); if (G === g) showResults(); }, 3200);
}
