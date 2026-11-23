/* ==========================================================================
   Saved data: history, personal best, mistakes, daily goal + streak, backup
   All keys start with "bj-". Everything goes through `store` so storage
   failures never break the app.
   ========================================================================== */
const KEYS = { hist: 'bj-hist', best: 'bj-best', gmStart: 'bj-gm-start', miss: 'bj-miss', days: 'bj-days', goal: 'bj-goal', set: 'bj-set', run: 'bj-deckrun' };

/* ---------- session history ---------- */
const loadHist = () => store.get(KEYS.hist, []);
function saveHist(entry) {
  const a = loadHist(); a.push({ d: Date.now(), ...entry });
  store.set(KEYS.hist, a.slice(-120));
}
const getBest = () => +store.get(KEYS.best, 0) || 0;

/* ---------- mistakes (weights the review drill) ---------- */
/* entry: { c: [ranks], u: dealer value, lvl, tc, n: times missed, ok: right answers in review since the last miss } */
const mistakeKey = (cards, up, lvl) => `${cards.map(c => c.r).join(',')}|${up}|${lvl}`;
function recordMistake(cards, up, lvl, tc) {
  const m = store.get(KEYS.miss, {}), k = mistakeKey(cards, up, lvl);
  const e = m[k] || { c: cards.map(c => c.r), u: up, lvl, tc: Math.round(tc), n: 0, ok: 0 };
  e.n++; e.ok = 0; e.tc = Math.round(tc); e.t = Date.now(); m[k] = e;
  const keys = Object.keys(m);
  if (keys.length > 80) { keys.sort((a, b) => m[a].t - m[b].t).slice(0, keys.length - 80).forEach(x => delete m[x]); }
  store.set(KEYS.miss, m);
}
function reviewResult(key, ok) {
  const m = store.get(KEYS.miss, {}), e = m[key];
  if (!e) return;
  if (ok) { e.ok++; if (e.ok >= 3) delete m[key]; } else { e.n++; e.ok = 0; }
  store.set(KEYS.miss, m);
}
const mistakeCount = () => Object.keys(store.get(KEYS.miss, {})).length;
/* weighted pick: more misses and fewer recent right answers weigh more */
function pickMistake() {
  const m = store.get(KEYS.miss, {}), ks = Object.keys(m);
  if (!ks.length) return null;
  const w = ks.map(k => Math.max(0.5, 1 + 2 * m[k].n - 1.5 * m[k].ok));
  let r = Math.random() * w.reduce((a, b) => a + b, 0);
  for (let i = 0; i < ks.length; i++) { r -= w[i]; if (r <= 0) return { key: ks[i], ...m[ks[i]] }; }
  return { key: ks[0], ...m[ks[0]] };
}

/* ---------- daily goal and streak ---------- */
const GOAL_FAST_MS = 3000;
const todayKey = (d = new Date()) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
const goalTarget = () => store.get(KEYS.goal, { target: 50 }).target;
function setGoalTarget(t) { store.set(KEYS.goal, { target: t }); }
/* days: { 'YYYY-MM-DD': [fastCorrectCounts, targetThatDay] } */
function dayCount() { const d = store.get(KEYS.days, {}); return (d[todayKey()] || [0, 0])[0]; }
function bumpGoal() {
  const days = store.get(KEYS.days, {}), k = todayKey(), t = goalTarget(), cur = days[k] || [0, t];
  const was = cur[0] >= t;
  cur[0]++; cur[1] = t; days[k] = cur;
  const keep = Object.keys(days).sort().slice(-90), out = {}; keep.forEach(x => (out[x] = days[x]));
  store.set(KEYS.days, out);
  if (!was && cur[0] >= t) toast(`Daily goal reached: ${t} right counts under 3 seconds.${currentStreak() > 1 ? ' ' + currentStreak() + '-day streak!' : ''}`);
}
/* consecutive days meeting that day's goal, ending today (or yesterday if today isn't done yet) */
function currentStreak() {
  const days = store.get(KEYS.days, {});
  const met = k => days[k] && days[k][0] >= days[k][1];
  let d = new Date(), n = 0;
  if (!met(todayKey(d))) d.setDate(d.getDate() - 1);
  while (met(todayKey(d))) { n++; d.setDate(d.getDate() - 1); }
  return n;
}

/* ---------- backup and restore ---------- */
function exportBackup() {
  return JSON.stringify({
    app: 'shoe-room', v: 1, saved: new Date().toISOString(),
    hist: loadHist(), best: getBest(), gmStart: store.get(KEYS.gmStart, 200),
    miss: store.get(KEYS.miss, {}), days: store.get(KEYS.days, {}), goal: store.get(KEYS.goal, { target: 50 }), set: store.get(KEYS.set, null), run: store.get(KEYS.run, { best: null, runs: 0 }),
  });
}
/* Returns { ok, msg }. Replaces saved data only after the whole file validates. */
function importBackup(text) {
  let o;
  try { o = JSON.parse(text); } catch (e) { return { ok: false, msg: 'That does not look like a backup (it is not valid JSON).' }; }
  if (!o || o.app !== 'shoe-room' || !Array.isArray(o.hist)) return { ok: false, msg: 'That is not a Shoe Room backup.' };
  const num = x => typeof x === 'number' && isFinite(x);
  const hist = o.hist.filter(h => h && num(h.d) && num(h.s)).slice(-120);
  store.set(KEYS.hist, hist);
  store.set(KEYS.best, num(o.best) ? o.best : 0);
  store.set(KEYS.gmStart, num(o.gmStart) ? Math.max(200, o.gmStart) : 200);
  store.set(KEYS.miss, o.miss && typeof o.miss === 'object' ? o.miss : {});
  store.set(KEYS.days, o.days && typeof o.days === 'object' ? o.days : {});
  store.set(KEYS.goal, o.goal && num(o.goal.target) ? o.goal : { target: 50 });
  if (o.set && typeof o.set === 'object') store.set(KEYS.set, o.set);
  if (o.run && typeof o.run === 'object') store.set(KEYS.run, o.run);
  return { ok: true, msg: `Restored ${hist.length} sessions.` };
}
async function copyText(t) {
  try { await navigator.clipboard.writeText(t); return true; } catch (e) {}
  const ta = document.createElement('textarea'); ta.value = t; ta.style.cssText = 'position:fixed;opacity:0'; document.body.append(ta); ta.select();
  let ok = false; try { ok = document.execCommand('copy'); } catch (e) {} ta.remove(); return ok;
}
