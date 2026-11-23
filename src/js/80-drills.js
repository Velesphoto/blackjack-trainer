/* ==========================================================================
   Drills that skip the table: burst count drill, flashcards (basic / index),
   mistake review, deck estimation. All render into #drill.
   ========================================================================== */
function showDrill() {
  ['intro', 'table', 'results'].forEach(id => ($(id).hidden = true));
  $('drill').hidden = false; document.body.classList.remove('prac', 'tbl'); $('chartBtn').hidden = false;
}
const randomCard = r => ({ r, s: pick(Core.SUITS), id: ++CID });
const upCardOf = u => randomCard(u === 11 ? 'A' : u === 10 ? pick(['10', 'J', 'Q', 'K']) : String(u));

/* ---------- burst drill: cards flash one at a time, then you enter the count ---------- */
function startBurst() {
  G = { kind: 'burst', gm: 'practice', checks: [], strat: { ok: 0, n: 0, miss: [] }, rounds: 0, phase: 'idle', cm: null, usedHint: false, usedCount: false, alive: true, rc: 0, saved: false };
  G.shoe = Core.makeShoe(K.rules.decks); streak = 0;
  showDrill(); renderBurst();
}
function renderBurst() {
  const p = G.phase;
  $('dStat').textContent = `Burst ${G.rounds + (p === 'flash' ? 1 : 0)} · ${K.len} cards at ${K.speed / 1000}s · ${K.rules.decks}-deck shoe · ${Core.SYSTEMS[K.sys].name}`;
  $('dMsg').innerHTML = G.cm ? `<div class="${G.cm.ok ? 'ok' : 'no'}">${G.cm.t}</div>` : '<div class="small">Cards flash one at a time. Keep the count, then enter it.</div>';
  if (p === 'check') { $('dCtl').innerHTML = ASK_HTML; bindAsk(submitBurst); }
  else if (p === 'flash') $('dCtl').innerHTML = '';
  else { $('dCtl').innerHTML = `<div class="acts"><button class="btn" id="goB">${G.rounds ? 'Next burst' : 'Start burst'}</button></div>`; $('goB').onclick = runBurst; focusSoon('goB'); }
  if (p !== 'flash') $('dStage').innerHTML = '';
}
function runBurst() {
  const g = G;
  if (G.shoe.pos + K.len > G.shoe.cards.length) G.shoe = Core.makeShoe(K.rules.decks);
  G.rc = 0; G.phase = 'flash'; G.cm = null; renderBurst();
  let i = 0;
  const show = () => {
    if (G !== g || g.phase !== 'flash') return;
    if (i >= K.len) { g.phase = 'check'; g.rounds++; renderBurst(); startClock(); return; }
    i++; $('dStat').textContent = `Card ${i} of ${K.len}`;
    const c = g.shoe.cards[g.shoe.pos++]; c.id = ++CID; g.rc += Core.tag(K.sys, c);
    $('dStage').innerHTML = cardHTML(c);
    if (K.dist && Math.random() < 0.25) $('dMsg').innerHTML = `<div class="small">${pick(CHATTER)[1]}</div>`;
    const on = K.dist ? K.speed * rand(0.65, 1.45) : K.speed;
    later(() => { $('dStage').innerHTML = ''; later(show, K.dist ? rand(100, 380) : 140); }, on);
  };
  later(show, 700);
}
function submitBurst() {
  const v = $('cnt').value.trim(); if (!/^-?\d+$/.test(v)) return;
  const dt = stopClock(), guess = parseInt(v, 10), r = gradeCount(guess, G.rc, dt);
  G.checks.push(r);
  G.cm = r.ok ? { ok: true, t: `Count ${fmt(G.rc)} is right. ${(dt / 1000).toFixed(1)}s, ${r.pts} points.` } : { ok: false, t: `You said ${fmt(guess)}. The count is ${fmt(G.rc)}. ${(dt / 1000).toFixed(1)}s.` };
  G.phase = 'idle'; renderBurst(); pop(r.ok);
}

/* ---------- flashcards and mistake review ---------- */
const QRULES = () => K.rules;
function qEnv(cards, lvl, tc) {
  const two = cards.length === 2, pair = two && val(cards[0]) === val(cards[1]);
  return { rules: QRULES(), lvl, tc, late: false, canD: two, canS: pair, canR: two && QRULES().sur === 1 };
}
function genBasic() {
  const kind = pick(['hard', 'hard', 'soft', 'pair']), up = pick([2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
  let ranks;
  if (kind === 'pair') ranks = (r => [r, r])(pick(['2', '3', '4', '5', '6', '7', '8', '9', '10', 'A']));
  else if (kind === 'soft') ranks = ['A', String(pick([2, 3, 4, 5, 6, 7, 8, 9]))];
  else { const t = pick([8, 9, 10, 11, 12, 13, 14, 15, 16, 17]), a = pick([...Array(9).keys()].map(i => i + 2).filter(a => t - a >= 2 && t - a <= 10 && a !== t - a)); ranks = [String(a), String(t - a)]; }
  const cards = ranks.map(randomCard), env = qEnv(cards, 0, 0);
  return { cards, up, upCard: upCardOf(up), tc: null, lvl: 0, env, answer: Core.decide(cards, up, env).play, note: '' };
}
function genIndex() {
  const lvl = K.dev || 1, ctx = { decks: K.rules.decks, h17: !!K.rules.h17, late: false };
  const rows = Core.IDX.filter(r => Core.indexValue(r, lvl, ctx) !== null && !(r.k === 'sur' && K.rules.sur !== 1) && !(!K.rules.peek && r.u >= 10 && r.k !== 'ins'));
  const r = pick(rows), i = Core.indexValue(r, lvl, ctx);
  const tc = pick([Math.floor(i) - 1, Math.floor(i), Math.ceil(i), Math.ceil(i) + 1]);
  if (r.k === 'ins') {
    const cards = ['10', '6'].map(randomCard);
    return { type: 'ins', cards, up: 11, upCard: upCardOf(11), tc, lvl, answer: Core.insuranceDecision(lvl, ctx, tc).take ? 'Take' : 'Decline', index: i, note: '' };
  }
  const ranks = r.k === 'pair' ? ['10', '10'] : r.k === 'soft' ? ['A', String(r.v - 11)] : r.v >= 12 ? ['10', String(r.v - 10)] : r.v === 11 ? ['5', '6'] : r.v === 10 ? ['4', '6'] : r.v === 9 ? ['4', '5'] : ['3', '5'];
  const cards = ranks.map(randomCard), env = qEnv(cards, lvl, tc), d = Core.decide(cards, r.u, env);
  return { cards, up: r.u, upCard: upCardOf(r.u), tc, lvl, env, answer: d.play, note: d.note };
}
function genMiss() {
  const e = pickMistake(); if (!e) return null;
  const cards = e.c.map(randomCard), env = qEnv(cards, e.lvl, e.tc), d = Core.decide(cards, e.u, env);
  return { cards, up: e.u, upCard: upCardOf(e.u), tc: e.lvl ? e.tc : null, lvl: e.lvl, env, answer: d.play, note: d.note, key: e.key };
}

/* two cards at once: report their net count (+1 and −1 cancel). Answers are strings so 0 and negatives compare cleanly. */
const maxTag = () => Math.max(...Object.values(Core.SYSTEMS[K.sys].tags).map(Math.abs));
function genPair() {
  const cards = [randomCard(pick(Core.RANKS)), randomCard(pick(Core.RANKS))];
  return { type: 'pair', cards, answer: String(Core.tag(K.sys, cards[0]) + Core.tag(K.sys, cards[1])), note: '', env: {}, tc: null };
}

function startQuiz(sub) {
  if (sub === 'run') { startDeckRun(); return; }
  G = { kind: 'quiz', gm: 'practice', sub, n: 0, ok: 0, times: [], miss: [], alive: true, phase: 'ask', q: null, saved: false, checks: [], strat: { ok: 0, n: 0, miss: [] } };
  streak = 0;
  if (sub === 'deck') { G.kind = 'deck'; G.close = 0; G.tcOk = 0; G.tcN = 0; showDrill(); nextDeck(); return; }
  if (sub === 'miss' && !mistakeCount()) { showIntro(); return; }
  showDrill(); nextQ();
}
const QTITLE = { basic: 'Basic strategy flashcards', index: 'Index flashcards', miss: 'Mistake review', pairs: 'Pair counting' };
function nextQ() {
  const q = G.sub === 'basic' ? genBasic() : G.sub === 'index' ? genIndex() : G.sub === 'pairs' ? genPair() : genMiss();
  if (!q) { endDrill(); return; }
  G.q = q; G.phase = 'ask'; G.fbk = null; renderQ(); startClock();
}
function renderQ() {
  const q = G.q;
  if (q.type === 'pair') return renderPair();
  $('dStat').textContent = `${QTITLE[G.sub]} · ${G.ok} right of ${G.n}${G.sub === 'miss' ? ' · ' + mistakeCount() + ' left in review' : ''}`;
  $('dStage').innerHTML = `<div class="q"><div class="small">Dealer shows</div><div class="cards">${cardHTML(q.upCard)}</div>
    <div class="small">${q.type === 'ins' ? 'Your hand (the dealer shows an ace)' : 'Your hand'}</div><div class="cards">${q.cards.map(cardHTML).join('')}</div>
    ${q.tc !== null ? `<div class="qtc">True count ${tcFmt(q.tc)}</div>` : ''}
    <div class="small">${QRULES().h17 ? 'Dealer hits soft 17' : 'Dealer stands on soft 17'}${QRULES().sur === 1 ? ' · late surrender' : ''}</div></div>`;
  $('dMsg').innerHTML = G.fbk ? `<div class="${G.fbk.ok ? 'ok' : 'no'}">${G.fbk.t}</div>` : '';
  if (G.phase === 'ask') {
    const b = q.type === 'ins' ? [['Take', 'Take insurance (Y)'], ['Decline', 'No insurance (N)']] : [['H', 'Hit'], ['S', 'Stand'], ...(q.env.canD ? [['D', 'Double']] : []), ...(q.env.canS ? [['P', 'Split']] : []), ...(q.env.canR ? [['R', 'Surrender']] : [])];
    $('dCtl').innerHTML = `<div class="acts">${b.map(([k, t]) => `<button class="btn" data-q="${k}">${t}</button>`).join('')}</div>`;
    $('dCtl').querySelectorAll('[data-q]').forEach(x => (x.onclick = () => answerQ(x.dataset.q)));
  } else { $('dCtl').innerHTML = '<div class="acts"><button class="btn" id="qNext">Next</button></div>'; $('qNext').onclick = nextQ; focusSoon('qNext'); }
}
function renderPair() {
  const q = G.q, m = maxTag();
  $('dStat').textContent = `Pair counting · ${Core.SYSTEMS[K.sys].name} · ${G.ok} right of ${G.n}`;
  $('dStage').innerHTML = `<div class="q"><div class="small">Net count of the pair</div><div class="cards">${q.cards.map(cardHTML).join('')}</div></div>`;
  $('dMsg').innerHTML = G.fbk ? `<div class="${G.fbk.ok ? 'ok' : 'no'}">${G.fbk.t}</div>` : '<div class="small">Keys: a number, with − first for a negative.</div>';
  if (G.phase === 'ask') {
    const vals = []; for (let v = -2 * m; v <= 2 * m; v++) vals.push(v);
    $('dCtl').innerHTML = `<div class="acts">${vals.map(v => `<button class="btn ghost" data-q="${v}">${fmt(v)}</button>`).join('')}</div>`;
    $('dCtl').querySelectorAll('[data-q]').forEach(x => (x.onclick = () => answerQ(x.dataset.q)));
  } else { $('dCtl').innerHTML = '<div class="acts"><button class="btn" id="qNext">Next</button></div>'; $('qNext').onclick = nextQ; focusSoon('qNext'); }
}
function answerQ(a) {
  if (G.phase !== 'ask') return;
  const q = G.q, dt = stopClock(), ok = a === q.answer, nm = x => PLAY_NAME[x] || x;
  if (q.type === 'pair') {
    G.n++; if (ok) G.ok++; G.times.push(dt); G.phase = 'done'; G.neg = false;
    if (!ok) G.miss.push(`${q.cards.map(c => c.r).join(' + ')} = ${fmt(+q.answer)} (you said ${fmt(+a)})`);
    G.fbk = { ok, t: ok ? `Net ${fmt(+q.answer)} is right. ${(dt / 1000).toFixed(1)}s.` : `The pair nets ${fmt(+q.answer)}.` };
    renderQ(); pop(ok); return;
  }
  G.n++; if (ok) G.ok++; G.times.push(dt); G.phase = 'done';
  if (!ok) G.miss.push(`${q.type === 'ins' ? 'Insurance' : Core.describe(q.cards, q.env.canS)} vs ${upLabel(q.upCard)}${q.tc !== null ? ' at ' + tcFmt(q.tc) : ''}: ${nm(q.answer).toLowerCase()}`);
  G.fbk = { ok, t: ok ? `${nm(q.answer)} is right.${q.note}` : `${nm(q.answer)} is the play.${q.note}${q.type === 'ins' ? ` Index ${fmt(q.index)}.` : ''}` };
  if (G.sub === 'miss') reviewResult(q.key, ok);
  else if (!ok && q.type !== 'ins') recordMistake(q.cards, q.up, q.lvl, q.tc || 0);
  renderQ(); pop(ok);
}

/* ---------- deck estimation ---------- */
function nextDeck() {
  const decks = K.rules.decks, left = Math.round(rand(0.5, decks) * 4) / 4, rc = Math.round(rand(-10, 18));
  G.d = { decks, left, rc, guess: null }; G.phase = 'est'; G.fbk = null; renderDeck(); startClock();
}
function trayHTML(decks, left) {
  const W = 300, H = 130, tot = decks, dealt = (tot - left) / tot, ref = 1 / tot;
  const bh = H - 20, full = bh * dealt, refh = bh * ref;
  return `<svg class="tray" viewBox="0 0 ${W} ${H}" role="img" aria-label="Discard tray showing the cards already played">
   <rect x="20" y="10" width="120" height="${bh}" rx="6" fill="#0007" stroke="#d6ad5266"/>
   <rect x="22" y="${10 + bh - full}" width="116" height="${full}" rx="4" fill="#f7f2e5"/>
   ${[...Array(Math.max(0, Math.floor(full / 6)))].map((_, i) => `<line x1="22" x2="138" y1="${10 + bh - 6 * (i + 1)}" y2="${10 + bh - 6 * (i + 1)}" stroke="#bbb" stroke-width=".6"/>`).join('')}
   <text x="80" y="${H - 2}" text-anchor="middle" fill="#a7b8ab" font-size="11">Discard tray</text>
   <rect x="190" y="${10 + bh - refh}" width="40" height="${refh}" fill="#f7f2e5" stroke="#d6ad52"/>
   <text x="210" y="${H - 2}" text-anchor="middle" fill="#a7b8ab" font-size="11">1 deck</text>
   <text x="260" y="${H / 2}" text-anchor="middle" fill="#d6ad52" font-size="12">${tot}-deck</text><text x="260" y="${H / 2 + 14}" text-anchor="middle" fill="#d6ad52" font-size="12">shoe</text></svg>`;
}
function renderDeck() {
  const d = G.d;
  $('dStat').textContent = `Deck estimation · ${G.ok} of ${G.n} decks right · ${G.tcOk} of ${G.tcN} true counts right`;
  $('dStage').innerHTML = `<div style="width:100%">${trayHTML(d.decks, d.left)}<div class="small" style="margin-top:6px">${G.phase === 'tc' || G.phase === 'done' ? `<b style="color:var(--brass)">${d.left.toFixed(2).replace(/\.?0+$/, '')} decks left.</b> ` : ''}${G.phase === 'est' ? 'How many decks are left in the shoe?' : `The running count is <b style="color:var(--brass)">${fmt(d.rc)}</b>.`}</div></div>`;
  $('dMsg').innerHTML = G.fbk ? `<div class="${G.fbk.ok ? 'ok' : 'no'}">${G.fbk.t}</div>` : '';
  if (G.phase === 'est') {
    const opts = []; for (let v = 0.5; v <= d.decks; v += 0.5) opts.push(v);
    $('dCtl').innerHTML = `<div class="acts" style="max-width:520px">${opts.map(v => `<button class="btn ghost" data-v="${v}">${v}</button>`).join('')}</div>`;
    $('dCtl').querySelectorAll('[data-v]').forEach(b => (b.onclick = () => answerDeck(+b.dataset.v)));
  } else if (G.phase === 'tc') {
    $('dCtl').innerHTML = ASK_HTML.replace('Running count?', 'True count?'); bindAsk(answerTC); startClock();
  } else { $('dCtl').innerHTML = '<div class="acts"><button class="btn" id="qNext">Next</button></div>'; $('qNext').onclick = nextDeck; focusSoon('qNext'); }
}
function answerDeck(g) {
  if (G.phase !== 'est') return;
  const d = G.d, exact = Math.round(d.left * 2) / 2, ok = g === exact, close = Math.abs(g - d.left) <= 0.5;
  G.n++; if (ok) G.ok++; else if (close) G.close++;
  G.fbk = { ok: ok || close, t: ok ? 'Right: the nearest half deck.' : close ? `Close: about ${exact} decks (you said ${g}).` : `Not quite: about ${exact} decks left (you said ${g}).` };
  G.phase = 'tc'; renderDeck(); pop(ok || close);
}
function answerTC() {
  const v = $('cnt').value.trim(); if (!/^-?\d+$/.test(v) || G.phase !== 'tc') return;
  stopClock();
  const d = G.d, tc = Core.trueCount(d.rc, d.decks, d.left * 52), div = Core.divisor(d.decks, d.left * 52), g = parseInt(v, 10), ok = Math.abs(g - tc) <= 0.5;
  G.tcN++; if (ok) G.tcOk++;
  G.fbk = { ok, t: `${ok ? 'Right' : 'Not quite'}: ${fmt(d.rc)} ÷ ${div} = ${tcFmt(tc)}${ok ? '' : ` (you said ${fmt(g)})`}. ${d.decks === 2 ? 'Two-deck shoes divide by half decks.' : 'Divide by whole decks, to the nearest.'}` };
  G.phase = 'done'; renderDeck(); pop(ok);
}

/* ---------- ending a drill ---------- */
const endDrill = () => showResults();
$('dEnd').onclick = () => showResults();
function quizResults() {
  const deck = G.kind === 'deck', n = deck ? G.n + G.tcN : G.n, ok = deck ? G.ok + G.close + G.tcOk : G.ok, pct = n ? Math.round(ok / n * 100) : null;
  const avg = G.times.length ? G.times.reduce((a, b) => a + b, 0) / G.times.length / 1000 : null;
  if (pct !== null && !G.saved) { G.saved = true; saveHist({ m: deck ? 'deck' : 'flash', s: pct, t: avg ? +avg.toFixed(1) : null }); }
  $('results').innerHTML = pct === null ? '<div class="grade"><div><h2>No answers yet</h2></div></div><p><button class="btn" id="again">Back to menu</button></p>' :
    `<div class="grade"><div class="g">${gradeOf(pct)}</div><div><h2>${pct}% right</h2><div class="small">${deck ? 'Deck estimation' : QTITLE[G.sub]} · ${ok} of ${n} answers</div></div></div>
    <div class="grid">${deck ? tile('Decks left', `${G.ok + G.close} of ${G.n}`, `${G.ok} exact, ${G.close} within half a deck`) + tile('True counts', `${G.tcOk} of ${G.tcN}`, 'Within half a point') : tile('Average time', avg ? avg.toFixed(1) + 's' : '–', '') + tile('Mistakes left in review', mistakeCount(), 'Three right answers in review clears one')}</div>
    ${G.miss.length ? miniTitle('Missed') + `<ul class="miss">${G.miss.slice(-10).map(x => `<li>${x}</li>`).join('')}</ul>` : ''}
    <p style="margin-top:16px"><button class="btn" id="again">Back to menu</button> ${!deck && mistakeCount() && G.sub !== 'miss' ? '<button class="btn ghost" id="revBtn">Review mistakes</button>' : ''}</p>`;
  $('again').onclick = showIntro;
  if ($('revBtn')) $('revBtn').onclick = () => startQuiz('miss');
}

/* ---------- full-deck run: flip through one deck at your own pace; aim for under 25 seconds with the right count ---------- */
const RUN_GOAL_MS = 25000;
function startDeckRun() {
  G = { kind: 'deckrun', gm: 'practice', alive: true, phase: 'ready', runs: [], i: 0, rc: 0, saved: false, checks: [], strat: { ok: 0, n: 0, miss: [] } };
  streak = 0; showDrill(); renderRun();
}
function renderRun() {
  const best = store.get(KEYS.run, { best: null, runs: 0 }), p = G.phase, sys = Core.SYSTEMS[K.sys].name;
  $('dStat').textContent = p === 'flip' ? `Card ${G.i} of 52` : `Full-deck run · ${sys} · best ${best.best ? (best.best / 1000).toFixed(1) + 's' : '–'}`;
  if (p === 'ready') {
    $('dStage').innerHTML = '<div class="small" style="max-width:360px">One shuffled deck, one card at a time. Press Space, Enter or Next for each card as fast as you can keep the count. The clock starts on the first card.</div>';
    $('dMsg').innerHTML = G.fbk ? `<div class="${G.fbk.ok ? 'ok' : 'no'}">${G.fbk.t}</div>` : `<div class="small">Goal: under 25 seconds with the right final count${Core.SYSTEMS[K.sys].balanced ? ' (0 for a full deck)' : ''}.</div>`;
    $('dCtl').innerHTML = `<div class="acts"><button class="btn" id="runGo">${G.runs.length ? 'Another run' : 'Start'}</button></div>`; $('runGo').onclick = runStart; focusSoon('runGo');
  } else if (p === 'flip') {
    $('dCtl').innerHTML = '<div class="acts"><button class="btn" id="runNext">Next card</button><span id="clock">0.0s</span></div>'; $('runNext').onclick = runNext; focusSoon('runNext');
  } else if (p === 'check') {
    $('dStage').innerHTML = '<div class="small">Deck finished.</div>'; $('dMsg').innerHTML = '';
    $('dCtl').innerHTML = ASK_HTML.replace('Running count?', 'Final count?').replace('<span id="clock">0.0s</span>', ''); bindAsk(submitRun);
  }
}
function runStart() {
  G.shoe = Core.makeShoe(1, 0); G.rc = 0; G.i = 0; G.fbk = null; G.phase = 'flip';
  renderRun(); showRunCard(); startClock();
}
function showRunCard() { const c = G.shoe.cards[G.i++]; G.rc += Core.tag(K.sys, c); $('dStage').innerHTML = cardHTML(c); $('dStat').textContent = `Card ${G.i} of 52`; $('dMsg').innerHTML = ''; }
function runNext() {
  if (G.phase !== 'flip') return;
  if (G.i < 52) { showRunCard(); return; }
  G.dt = stopClock(); G.phase = 'check'; renderRun();
}
function submitRun() {
  const v = $('cnt').value.trim(); if (!/^-?\d+$/.test(v) || G.phase !== 'check') return;
  const guess = parseInt(v, 10), ok = guess === G.rc, fast = G.dt <= RUN_GOAL_MS, sec = (G.dt / 1000).toFixed(1);
  const rec = store.get(KEYS.run, { best: null, runs: 0 }); rec.runs++;
  if (ok && (rec.best === null || G.dt < rec.best)) rec.best = Math.round(G.dt);
  store.set(KEYS.run, rec);
  G.runs.push({ dt: G.dt, ok });
  G.fbk = { ok: ok && fast, t: ok ? (fast ? `Count ${fmt(G.rc)} is right in ${sec}s. Under 25 seconds: that is table-ready speed.` : `Count ${fmt(G.rc)} is right, but ${sec}s is over the 25 second goal.`) : `You said ${fmt(guess)}. The count was ${fmt(G.rc)}. ${sec}s.` };
  G.phase = 'ready'; renderRun(); pop(ok && fast);
}
function deckRunResults() {
  const r = G.runs, okR = r.filter(x => x.ok), best = okR.length ? Math.min(...okR.map(x => x.dt)) : null;
  $('results').innerHTML = !r.length ? '<div class="grade"><div><h2>No runs yet</h2></div></div><p><button class="btn" id="again">Back to menu</button></p>' :
    `<div class="grade"><div class="g">${okR.length}/${r.length}</div><div><h2>Full-deck runs</h2><div class="small">Right counts out of ${r.length} runs · goal under 25 seconds</div></div></div>
    <div class="grid">${tile('Best right run', best ? (best / 1000).toFixed(1) + 's' : '–', 'Saved best: ' + ((store.get(KEYS.run, {}).best || 0) / 1000 || '–') + (store.get(KEYS.run, {}).best ? 's' : ''))}${tile('Under 25 seconds', okR.filter(x => x.dt <= RUN_GOAL_MS).length + ' of ' + r.length, 'With the right count')}</div>
    <div class="log">${r.map((x, i) => `<div><span>Run ${i + 1}</span><span style="color:var(--${x.ok ? 'good' : 'bad'})">${x.ok ? 'Right' : 'Off'} · ${(x.dt / 1000).toFixed(1)}s</span></div>`).join('')}</div>
    <p style="margin-top:16px"><button class="btn" id="again">Back to menu</button></p>`;
  $('again').onclick = showIntro;
}
