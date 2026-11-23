/* ==========================================================================
   Modals and result screens: strategy charts, accuracy list, session results,
   progress (goal, charts, backup)
   ========================================================================== */
const tile = (a, b, c) => `<div class="tile"><div class="small">${a}</div><div class="n">${b}</div><div class="small">${c || ''}</div></div>`;
const gradeOf = ov => (ov === null ? '–' : ov >= 90 ? 'A' : ov >= 80 ? 'B' : ov >= 70 ? 'C' : ov >= 60 ? 'D' : 'F');

/* ---------- strategy charts ---------- */
/* Which rules the chart shows: the table's, or the menu's current choice */
function chartRules() {
  if (!$('intro').hidden) return rulesOf(GM_MENU === 'game' ? (GC.custom ? GC : STD) : PC);
  return K ? K.rules : rulesOf(PC);
}
function basicChartHTML() {
  const rules = chartRules(), ups = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
  const cell = (ranks, u, pair) => {
    const cards = Core.handFromRanks(...ranks), env = { rules, lvl: 0, tc: 0, canD: true, canS: pair, canR: rules.sur === 1 };
    let x = Core.decide(cards, u, env).play;
    if (Core.earlySurrender(cards, u, rules)) x = 'R';
    let l = x;
    if (x === 'D') l = Core.decide(cards, u, { ...env, canD: false }).play === 'S' ? 'Ds' : 'Dh';
    return `<td class="c${l[0]}">${l}</td>`;
  };
  const tbl = (title, rows, pair) => `<h3 style="margin:12px 0 4px;font-size:1rem">${title}</h3><div class="tw"><table><tr><th></th>${ups.map(u => `<th>${u === 11 ? 'A' : u}</th>`).join('')}</tr>${rows.map(([l, a, b]) => `<tr><th>${l}</th>${ups.map(u => cell([a, b], u, pair)).join('')}</tr>`).join('')}</table></div>`;
  const hard = [['8 or less', 2, 6], ['9', 2, 7], ['10', 2, 8], ['11', 2, 9], ['12', 3, 9], ['13', 3, 10], ['14', 4, 10], ['15', 5, 10], ['16', 6, 10], ['17+', 7, 10]];
  const soft = [2, 3, 4, 5, 6, 7, 8, 9].map(n => ['A,' + n, 'A', n]);
  const pairs = [2, 3, 4, 5, 6, 7, 8, 9, 10, 'A'].map(r => [r + ',' + r, r, r]);
  const sur = ['no surrender', 'late surrender (R)', 'early surrender (R)'][rules.sur];
  return `<div class="small">${rules.h17 ? 'Dealer hits soft 17' : 'Dealer stands on all 17s'} · ${rules.das ? 'double after split' : 'no double after split'} · ${sur}${rules.peek ? '' : ' · no hole card (dealer does not peek)'}. Dealer’s card runs across the top.</div>`
    + tbl('Hard totals', hard, false) + tbl('Soft totals', soft, false) + tbl('Pairs', pairs, true)
    + `<p class="small">H hit · S stand · D double · Dh double, otherwise hit · Ds double, otherwise stand · P split · R surrender (when offered).${rules.sur === 2 ? ' Early surrender cells are an approximate chart.' : ''}</p>`;
}
function devChartHTML() {
  const rules = chartRules(), dk = rules.decks, ctx = { decks: dk, h17: !!rules.h17, late: false };
  const T = { S: 'Stand', H: 'Hit', D: 'Double', P: 'Split', R: 'Surrender', I: 'Take insurance' }, L = u => (u === 11 ? 'A' : u);
  const handOf = r => Core.handFromRanks(...(r.k === 'pair' ? [10, 10] : r.k === 'soft' ? ['A', r.v - 11] : r.v >= 12 ? [10, r.v - 10] : r.v === 11 ? [5, 6] : r.v === 10 ? [4, 6] : r.v === 9 ? [4, 5] : [3, 5]));
  const bas = r => r.k === 'ins' ? 'Decline' : r.k === 'sur' ? 'Hit' : PLAY_NAME[Core.basic(handOf(r), r.u, { rules: { ...rules, peek: 1 }, canD: true, canS: r.k === 'pair' })];
  const hn = r => (r.k === 'ins' ? 'Insurance' : r.k === 'pair' ? r.v + ',' + r.v : r.k === 'soft' ? 'Soft ' + r.v + ' (A,' + (r.v - 11) + ')' : 'Hard ' + r.v);
  const lateTxt = r => (dk === 2 && r.d && typeof r.d === 'object' && 'n' in r.d) ? ' (' + fmt(r.d.late) + ' late in the shoe)' : '';
  const row = (r, i, lvl, tagTxt) => {
    const f = fmt(i), rev = r.lt || (lvl === 2 && r.lo && bas(r) === 'Double');
    const play = rev ? 'Hit' : T[r.a], tr = rev ? 'Below ' + f + '<br><span class="small">' + (r.lt ? 'stand' : 'double') + ' at ' + f + ' or higher</span>' : f + ' or higher' + (lvl === 2 ? lateTxt(r) : '');
    return `<tr><td>${hn(r)}</td><td>${L(r.u)}</td><td>${bas(r)}</td><td>${play}</td><td>${tr}${tagTxt ? '<br><span class="small">' + tagTxt + '</span>' : ''}</td></tr>`;
  };
  const th = '<tr><th>Hand</th><th>Dealer</th><th>Basic</th><th>Play</th><th>True count</th></tr>';
  const A = Core.IDX.filter(r => r.c !== undefined).map(r => {
    const rw = row(r, Core.indexValue(r, 1, ctx, true), 1);
    return (bas(r) === T[r.a] && !r.lt) ? rw.replace('</td></tr>', '<br><span class="small">Same as basic if the dealer hits soft 17</span></td></tr>') : rw;
  }).join('');
  const B = Core.IDX.map(r => {
    const i = Core.indexValue(r, 2, ctx, true), lt2 = dk === 2 && r.d && typeof r.d === 'object' && 'n' in r.d;
    if (i === null || (i === r.c && !lt2)) return '';
    return row(r, i, 2, r.c === undefined ? 'New in Advanced' : i === r.c ? 'Same number, lower late in the shoe' : 'Adjusted, Illustrious ' + fmt(r.c));
  }).join('');
  const h = 'style="margin:12px 0 4px;font-size:1rem"';
  const conv = dk === 2 ? 'half-decks left (2, 1.5, 1, 0.5)' : 'whole decks left (' + [...Array(dk)].map((_, i) => dk - i).join(', ') + ')';
  return `<div class="small">${rules.h17 ? 'Dealer hits soft 17' : 'Dealer stands on soft 17'} · ${dk} decks. True count = running count ÷ ${conv}, to the nearest. Play basic strategy until the true count reaches the number. “Below” plays are the reverse: stand (or double) at the number or higher, and make the listed play under it. Surrender comes first when the table offers it. These numbers are for Hi-Lo and assume the dealer peeks.</div>
  <h3 ${h}>Illustrious 18 (plus 8 vs 6, insurance, and the Fab 4 surrenders)</h3><div class="tw"><table class="dv">${th}${A}</table></div>
  <h3 ${h}>Advanced: new plays and adjustments for your rules</h3><div class="tw"><table class="dv">${th}${B}</table></div>
  <p class="small">Illustrious 18 uses the standard multi-deck numbers. Advanced also applies the dealer’s soft 17 rule and the double-deck changes. In games that ban double after split, split 10s at about +1 higher.</p>`;
}
function showTab(t) {
  [...$('chartTabs').children].forEach((b, i) => b.setAttribute('aria-pressed', i === t));
  $('chartM').querySelector('h2').textContent = t ? 'Count deviations' : 'Basic strategy';
  $('chartB').innerHTML = t ? devChartHTML() : basicChartHTML();
}
$('chartBtn').onclick = () => { showTab(0); $('chartM').hidden = false; $('chartX').focus(); };
$('chartX').onclick = () => ($('chartM').hidden = true);
$('chartTabs').onclick = e => { const b = e.target.closest('button'); if (b) showTab(+b.dataset.t); };
$('chartM').onclick = e => { if (e.target.id === 'chartM') e.target.hidden = true; };

/* ---------- accuracy list (Game Mode) ---------- */
function accHTML() {
  const L = G.log.slice().reverse();
  if (!L.length) return '<div class="small">No decisions yet.</div>';
  const lab = x => PLAY_NAME[x] || x, mk = (ok, b) => (ok ? '✓' : '✗ ' + lab(b));
  const pct = k => Math.round(L.filter(x => x[k]).length / L.length * 100);
  return `<div class="small">Your last ${L.length} decisions, newest first · Basic strategy ${pct('okB')}% · Advanced count plays ${pct('okD')}%</div><div class="tw"><table><tr><th>Hand</th><th>Dealer</th><th>You</th><th>Basic</th><th>Count play</th></tr>${L.map(x => `<tr><td>${x.d}</td><td>${x.u}</td><td>${lab(x.a)}</td><td>${mk(x.okB, x.bB)}</td><td>${mk(x.okD, x.bD)}<br><span class="small">TC ${fmt(x.tc)}</span></td></tr>`).join('')}</table></div>`;
}
$('accBtn').onclick = () => { $('accB').innerHTML = accHTML(); $('accM').hidden = false; };
$('accX').onclick = () => ($('accM').hidden = true);
$('accM').onclick = e => { if (e.target.id === 'accM') e.target.hidden = true; };
document.addEventListener('keydown', e => { if (e.key === 'Escape') { $('accM').hidden = true; $('chartM').hidden = true; $('progM').hidden = true; } });

/* ---------- results ---------- */
function showResults() {
  if (!G) return;
  stopClock(); stopSessionTimers(); G.alive = false;
  if (MINI_ON) closeMini(false);
  ['table', 'drill'].forEach(id => ($(id).hidden = true));
  $('results').hidden = false; document.body.classList.remove('prac', 'tbl');
  if (G.kind === 'table' && G.gm === 'game') gameResults();
  else if (G.kind === 'deckrun') deckRunResults();
  else if (G.kind === 'quiz' || G.kind === 'deck') quizResults();
  else practiceResults();
}
const miniTitle = t => `<h2 style="font-size:1.2rem;margin:14px 0 6px">${t}</h2>`;

function practiceResults() {
  const ch = G.checks, n = ch.length, okc = ch.filter(c => c.ok).length, avg = n ? ch.reduce((a, c) => a + c.dt, 0) / n / 1000 : 0, okT = ch.filter(c => c.ok).map(c => c.dt / 1000);
  const cs = n ? Math.round(ch.reduce((a, c) => a + c.pts, 0) / n) : null, ss = G.strat.n ? Math.round(G.strat.ok / G.strat.n * 100) : null;
  const parts = [[cs, .6], [ss, .4]].filter(p => p[0] !== null), w = parts.reduce((a, p) => a + p[1], 0);
  const ov = parts.length ? Math.round(parts.reduce((a, p) => a + p[0] * p[1], 0) / w) : null;
  const burst = G.kind === 'burst', sysName = Core.SYSTEMS[K.sys].name;
  if (ov !== null && !G.usedHint && !G.usedCount && ov > getBest()) store.set(KEYS.best, ov);
  if (ov !== null && !G.saved) { G.saved = true; saveHist({ m: burst ? 'drill' : 'table', s: ov, a: n ? Math.round(okc / n * 100) : null, t: n ? +avg.toFixed(1) : null, sys: K.sys }); }
  const meta = burst ? `${K.len} cards at ${K.speed / 1000}s · ${G.rounds} bursts` : `${G.rounds} hands · ${K.rules.h17 ? 'dealer hits soft 17' : 'dealer stands on 17'} · ${K.players} other players · count checks ${K.every ? 'every ' + K.every : 'off'}`;
  $('results').innerHTML = ov === null ? '<div class="grade"><div><h2>No scored answers yet</h2><p class="small">Play a hand or finish a burst to get a score.</p></div></div><p><button class="btn" id="again">Back to menu</button></p>' :
    `<div class="grade"><div class="g">${gradeOf(ov)}</div><div><h2>Session score ${ov}</h2><div class="small">${K.rules.decks}-deck shoe · ${sysName} · ${meta}${G.usedHint || G.usedCount ? '<br>Hints or a visible count were used, so this score won’t count as a personal best.' : ''}</div></div></div>
    <div class="grid">${tile('Count accuracy', n ? Math.round(okc / n * 100) + '%' : '–', okc + ' of ' + n + ' checks')}${tile('Average answer time', n ? avg.toFixed(1) + 's' : '–', okT.length ? 'Fastest right: ' + Math.min(...okT).toFixed(1) + 's' : '')}
    ${tile('Count score', cs === null ? '–' : cs, 'Right answers earn 100 points under 3s, fading to 40 at 12s')}${ss === null ? '' : tile('Strategy score', ss, G.strat.ok + ' of ' + G.strat.n + ' decisions')}</div>
    <p class="small">Overall is count 60%, strategy 40%. Burst drills score the count only.</p>
    ${G.strat.miss.length ? miniTitle('Strategy slips') + `<ul class="miss">${G.strat.miss.slice(-8).map(x => `<li>${x}</li>`).join('')}</ul>` : ''}
    ${n ? miniTitle('Count checks') + `<div class="log">${ch.map((c, i) => `<div><span>#${i + 1} · said ${fmt(c.guess)}, actual ${fmt(c.actual)}</span><span style="color:var(--${c.ok ? 'good' : 'bad'})">${c.ok ? 'Right' : 'Off'} · ${(c.dt / 1000).toFixed(1)}s</span></div>`).join('')}</div>` : ''}
    <p style="margin-top:16px"><button class="btn" id="again">New session</button> ${mistakeCount() ? '<button class="btn ghost" id="revBtn">Drill my mistakes</button>' : ''}</p>`;
  $('again').onclick = showIntro;
  if ($('revBtn')) $('revBtn').onclick = () => launchDrill('miss');
}

function gameResults() {
  const net = G.bank - G.start, L = G.agg, n = L.n, pct = k => (n ? Math.round(L[k] / n * 100) + '%' : '–');
  const pos = G.hist.filter(h => h.tc >= 1), neg = G.hist.filter(h => h.tc <= -1), av = (a, f) => (a.length ? a.reduce((s, x) => s + f(x), 0) / a.length : 0);
  const tl = (t, a) => tile(t, a.length + ' hands', `Avg bet ${usd(av(a, x => x.bet))} · avg result ${sgn(av(a, x => x.prof))}`);
  const sp = Core.spreadReport(G.hist, K.rules), next = gameStart();
  if (!G.saved) { G.saved = true; saveHist({ m: 'game', s: n ? Math.round(L.B / n * 100) : 0, b: Math.round(G.bank), net: Math.round(net) }); }
  const spread = sp ? tile('Edge left on the table', usd(sp.left), `Estimated. Your bets earned about ${sgn(sp.actual)}; a 1 to 8 spread from your ${usd(sp.unit)} base bet would earn about ${sgn(sp.ideal)}.`)
    + tile('Bet spread', sp.nHigh && sp.nLow ? (sp.avgHigh / sp.avgLow).toFixed(1) + ' to 1' : '–', `Avg ${sp.nHigh ? usd(sp.avgHigh) : '–'} at +2 or higher (${sp.nHigh} hands) vs ${sp.nLow ? usd(sp.avgLow) : '–'} at 0 or lower (${sp.nLow} hands)`) : '';
  $('results').innerHTML = `<div class="grade"><div class="g" style="font-size:3rem">${sgn(net)}</div><div><h2>${G.backedOff ? 'Backed off' : 'Session over'}</h2><div class="small">${G.rounds} hands · started ${usd(G.start)}, finished ${usd(G.bank)} · next session starts at ${usd(next)}</div></div></div>
  <div class="grid">${tile('Basic strategy accuracy', pct('B'), n + ' decisions')}${tile('Accuracy with Advanced count plays', pct('D'))}
  ${spread}${tile('Heat at the end', Math.round(G.heat) + ' of 100', `${G.cover.n} cover plays, about ${usd(G.cover.cost)} of edge given up (estimate)`)}
  ${tl('Hands at a positive count (+1 or higher)', pos)}${tl('Hands at a negative count (−1 or lower)', neg)}</div>
  <p><button class="btn" id="again">Back to menu</button> ${mistakeCount() ? '<button class="btn ghost" id="revBtn">Drill my mistakes</button>' : ''}</p>`;
  $('again').onclick = showIntro;
  if ($('revBtn')) $('revBtn').onclick = () => { K = buildConfig('practice'); startQuiz('miss'); };
}

/* ---------- progress, goal and backup ---------- */
function lineChart(pts, { unit = '', min, max, dec = 0 }) {
  if (pts.length < 2) return '<div class="small">Play a few more sessions to see a trend.</div>';
  const W = 560, H = 190, L = 40, B = 24, T = 10, Rr = 10, n = pts.length;
  const lo = min ?? Math.min(...pts), hi = max ?? Math.max(...pts), span = hi - lo || 1;
  const x = i => L + (W - L - Rr) * i / (n - 1), y = v => T + (H - T - B) * (1 - (v - lo) / span);
  const ma = pts.map((_, i) => { const s = pts.slice(Math.max(0, i - 4), i + 1); return s.reduce((a, b) => a + b, 0) / s.length; });
  const line = a => a.map((v, i) => (i ? 'L' : 'M') + x(i).toFixed(1) + ' ' + y(v).toFixed(1)).join(' ');
  const grid = [0, .5, 1].map(f => { const v = lo + span * f, yy = y(v); return `<line x1="${L}" x2="${W - Rr}" y1="${yy}" y2="${yy}" stroke="#ffffff1a"/><text x="${L - 6}" y="${yy + 4}" text-anchor="end">${v.toFixed(dec)}${unit}</text>`; }).join('');
  const dots = pts.map((v, i) => `<circle cx="${x(i)}" cy="${y(v)}" r="3.5" fill="#d6ad52" stroke="#17110d" stroke-width="2"><title>Session ${i + 1}: ${v.toFixed(dec)}${unit}</title></circle>`).join('');
  return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Trend over your last ${n} sessions">${grid}<path d="${line(ma)}" fill="none" stroke="#86dc9f" stroke-width="2" stroke-dasharray="5 4"/><path d="${line(pts)}" fill="none" stroke="#d6ad52" stroke-width="2"/>${dots}<text x="${L}" y="${H - 6}">older</text><text x="${W - Rr}" y="${H - 6}" text-anchor="end">latest</text></svg>
  <div class="small">Solid line: each session. Dashed green: average of the last 5. Showing the latest ${n}.</div>`;
}
const SERIES = {
  score: { t: 'Score', f: h => (h.m === 'table' || h.m === 'drill') && h.s, o: { min: 0, max: 100 } },
  acc: { t: 'Count accuracy', f: h => h.a != null && h.a, o: { unit: '%', min: 0, max: 100 } },
  time: { t: 'Answer time', f: h => h.t != null && h.t, o: { unit: 's', dec: 1, min: 0 } },
  bank: { t: 'Bankroll', f: h => h.m === 'game' && h.b, o: { dec: 0 } },
  flash: { t: 'Flashcards', f: h => (h.m === 'flash' || h.m === 'deck') && h.s, o: { unit: '%', min: 0, max: 100 } },
};
let progTab = 'score';
function openProgress() { $('progM').hidden = false; renderProgress(); }
function renderProgress(msg) {
  const hist = loadHist(), tgt = goalTarget(), done = dayCount(), st = currentStreak(), S = SERIES[progTab];
  const pts = hist.map(h => S.f(h)).filter(v => v !== false && v !== undefined && v !== null).slice(-40);
  $('progB').innerHTML = `
  <h3 style="font-size:1rem">Daily goal</h3>
  <div class="small">Right counts under 3 seconds today: <b style="color:var(--brass)">${done}</b> of ${tgt}${st ? ` · ${st}-day streak` : ''}</div>
  <div class="goalbar"><i style="width:${Math.min(100, done / tgt * 100)}%"></i></div>
  <div class="seg" id="goalSeg">${[25, 50, 100, 200].map(v => `<button data-v="${v}" aria-pressed="${v === tgt}">${v} a day</button>`).join('')}</div>
  <h3 style="font-size:1rem;margin-top:16px">Trends</h3>
  <div class="seg" id="serSeg" style="margin:6px 0">${Object.entries(SERIES).map(([k, s]) => `<button data-v="${k}" aria-pressed="${k === progTab}">${s.t}</button>`).join('')}</div>
  <div class="chart">${lineChart(pts, S.o)}</div>
  <div class="small">${hist.length} session${hist.length === 1 ? '' : 's'} saved · personal best ${getBest() || '–'}</div>
  <h3 style="font-size:1rem;margin-top:16px">Backup</h3>
  <div class="small">Progress lives in this browser only. Copy a backup somewhere safe, then paste it here to restore on another device.</div>
  <div style="display:flex;gap:8px;flex-wrap:wrap;margin:8px 0"><button class="btn ghost sm" id="bkCopy">Copy backup</button><button class="btn ghost sm" id="bkFile">Download file</button><label class="btn ghost sm" style="cursor:pointer">Open file<input type="file" id="bkPick" accept=".json,application/json" hidden></label></div>
  <textarea id="bkText" placeholder="Paste a backup here, then press Restore"></textarea>
  <div style="display:flex;gap:8px;align-items:center;margin-top:8px"><button class="btn sm" id="bkRestore">Restore</button><span class="small" id="bkMsg">${msg || ''}</span></div>`;
  $('goalSeg').onclick = e => { const b = e.target.closest('button'); if (b) { setGoalTarget(+b.dataset.v); renderProgress(); } };
  $('serSeg').onclick = e => { const b = e.target.closest('button'); if (b) { progTab = b.dataset.v; renderProgress(); } };
  $('bkCopy').onclick = async () => { const ok = await copyText(exportBackup()); $('bkMsg').textContent = ok ? 'Backup copied.' : 'Could not copy. Use Download file instead.'; };
  $('bkFile').onclick = () => {
    try { const a = el(`<a download="shoe-room-backup.json" href="${URL.createObjectURL(new Blob([exportBackup()], { type: 'application/json' }))}"></a>`); document.body.append(a); a.click(); a.remove(); $('bkMsg').textContent = 'Download started.'; }
    catch (e) { $('bkMsg').textContent = 'Download is blocked here. Use Copy backup.'; }
  };
  $('bkPick').onchange = e => { const f = e.target.files[0]; if (f) f.text().then(t => { $('bkText').value = t; $('bkMsg').textContent = 'File loaded. Press Restore.'; }); };
  $('bkRestore').onclick = () => {
    const r = importBackup($('bkText').value.trim());
    if (r.ok) { loadSettings(); renderProgress(r.msg); } else $('bkMsg').textContent = r.msg;
  };
}
$('progX').onclick = () => { $('progM').hidden = true; if (!$('intro').hidden && GM_MENU === 'practice') openMenu('practice'); };
$('progM').onclick = e => { if (e.target.id === 'progM') $('progX').onclick(); };
