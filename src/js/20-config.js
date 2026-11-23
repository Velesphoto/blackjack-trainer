/* ==========================================================================
   Menu settings: Practice (PC) and Game (GC) option sets, control builders,
   and the session config K that a launched session reads.
   ========================================================================== */
const RULE_KEYS = ['decks', 'h17', 'bj', 'sur', 'ins', 'das', 'resplit', 'peek', 'cutLeft', 'maxSplit'];
const STD = { decks: 6, h17: 1, bj: 1.5, sur: 1, ins: 1, das: 1, resplit: 0, peek: 1, cutLeft: 0.3, maxSplit: 3 };
const PC = { ...STD, ins: 0, mode: 0, sys: 'hilo', every: 3, dev: 0, tot: 0, addp: 0, maxp: 2, rand: 0, dist: 0, speed: 600, len: 20 };
const GC = { ...STD, custom: 0, tot: 0, addp: 0, maxp: 2, rand: 0 };
const OB = o => (o === 'G' ? GC : PC);
let K = null; /* session config, set by launch() */

/* slider stops and their labels */
const STOPS = { decks: [2, 4, 6, 8], bj: [1.2, 1.5, 2.5], every: [0, 1, 2, 3], speed: [1000, 600, 350], len: [10, 20, 30], maxp: [1, 2, 3, 4], maxSplit: [0, 1, 2, 3], cutLeft: [0.3, 0.5, 1, 1.5] };
const LAB = {
  decks: v => v + ' decks', bj: v => BJ_LABEL[v], every: v => (v ? 'Every ' + v : 'Off'), speed: v => v / 1000 + 's',
  len: v => v + ' cards', maxp: v => v, maxSplit: v => v, cutLeft: v => v + (v === 1 ? ' deck' : ' decks') + ' left',
};
const SYS_OPTS = [['hilo', 'Hi-Lo'], ['ko', 'KO'], ['hiopt2', 'Hi-Opt II'], ['omega2', 'Omega II']];

/* control builders: o is 'P' or 'G', k the setting key */
const sw = (o, k, label, dis) => `<label class='row2'><span>${label}</span><span class='sw'><input type='checkbox' data-o='${o}' data-k='${k}' ${!dis && OB(o)[k] ? 'checked' : ''} ${dis ? 'disabled' : ''}><i></i></span></label>`;
const sl = (o, k, label) => `<label class='row2'><span>${label}</span><input type='range' data-o='${o}' data-k='${k}' min='0' max='${STOPS[k].length - 1}' step='1' value='${STOPS[k].indexOf(OB(o)[k])}'><b class='rv'>${LAB[k](OB(o)[k])}</b></label>`;
const sg = (o, k, label, opts) => `<div class='row2' style='display:block'><span>${label}</span><div class='seg' data-o='${o}' data-k='${k}' style='margin-top:6px'>${opts.map(([v, t]) => `<button data-v='${v}' aria-pressed='${String(OB(o)[k]) === String(v)}'>${t}</button>`).join('')}</div></div>`;
const SUR_OPTS = [[0, 'Off'], [1, 'Late'], [2, 'Early']];

/* One delegated handler per control type keeps the builders above free of wiring */
document.addEventListener('click', e => {
  const b = e.target.closest('.seg[data-o] button');
  if (!b) return;
  const g = b.parentElement, v = b.dataset.v;
  OB(g.dataset.o)[g.dataset.k] = isNaN(v) ? v : +v;
  [...g.children].forEach(x => x.setAttribute('aria-pressed', x === b));
});
document.addEventListener('input', e => {
  const t = e.target, k = t.dataset && t.dataset.k;
  if (!k || !t.dataset.o) return;
  const o = OB(t.dataset.o);
  if (t.type === 'range') {
    o[k] = STOPS[k][+t.value];
    const b = t.parentElement.querySelector('.rv'); if (b) b.textContent = LAB[k](o[k]);
  } else {
    o[k] = t.checked ? 1 : 0;
    if (k === 'addp') document.querySelectorAll('#menu .ap').forEach(x => (x.hidden = !o.addp));
    if (k === 'mode') document.querySelectorAll('#menu .dr').forEach(x => (x.hidden = !o.mode));
  }
});

/* ---------- translate menu settings into what a session uses ---------- */
const rulesOf = b => ({ decks: b.decks, h17: b.h17, bj: b.bj, sur: b.sur, ins: b.ins, das: b.das, resplitAces: b.resplit, maxSplit: b.maxSplit, peek: b.peek, cutLeft: b.cutLeft });
function buildConfig(kind) {
  const g = kind === 'game', base = g ? (GC.custom ? GC : STD) : PC, extra = g ? GC : PC;
  return {
    gm: kind, rules: rulesOf(base), sys: g ? 'hilo' : PC.sys, every: g ? 0 : PC.every,
    dev: g || PC.sys !== 'hilo' ? 0 : PC.dev, tot: g ? (GC.custom ? GC.tot : 0) : PC.tot,
    players: extra.addp ? extra.maxp : 0, rand: extra.addp && extra.rand ? 1 : 0, dist: g ? 0 : PC.dist,
    burst: !g && PC.mode, speed: PC.speed, len: PC.len,
  };
}
const gameStart = () => Math.max(200, +store.get(KEYS.gmStart, 200) || 200);

/* remember menu choices between visits */
function saveSettings() { store.set(KEYS.set, { P: PC, G: GC }); }
function loadSettings() {
  const s = store.get(KEYS.set, null);
  if (!s) return;
  for (const [o, tgt] of [['P', PC], ['G', GC]]) {
    const src = s[o]; if (!src) continue;
    for (const k of Object.keys(tgt)) if (k in src && typeof src[k] === typeof tgt[k]) tgt[k] = src[k];
    for (const k of Object.keys(STOPS)) if (k in tgt && !STOPS[k].includes(tgt[k])) tgt[k] = STD[k] !== undefined ? STD[k] : PC[k];
  }
  if (!SYS_OPTS.some(x => x[0] === PC.sys)) PC.sys = 'hilo';
}
