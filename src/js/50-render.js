/* ==========================================================================
   Table rendering: one render() builds the table from G; then the dealing
   animation, staged hand totals, chips, speech bubbles and the mini player
   are updated from that same state.
   ========================================================================== */
const Anim = { p: 0, d: 0, all: 0 };   /* timestamps when the current dealing flights end (player / dealer / everyone) */
const SEEN = new Set();                /* card ids already dealt, so only new cards animate */
let STEP = 420;                        /* ms per card in the dealing hand */

const HAND_SVG = '<svg viewBox="0 0 80 100" width="64" height="80"><rect x="16" y="0" width="48" height="26" rx="5" fill="#15110f"/><rect x="16" y="24" width="48" height="9" fill="#f3efe6"/><rect x="20" y="33" width="40" height="34" rx="14" fill="#dca97d"/><g fill="#dca97d" stroke="#b98558" stroke-width="1"><rect x="21" y="56" width="9" height="40" rx="4.5"/><rect x="30.5" y="56" width="9" height="44" rx="4.5"/><rect x="40" y="56" width="9" height="43" rx="4.5"/><rect x="49.5" y="56" width="9" height="38" rx="4.5"/><rect x="9" y="42" width="12" height="30" rx="6" transform="rotate(25 15 50)"/></g></svg>';

/* A hand (no body) carries each new card from the shoe to its spot */
function flyHand(els) {
  if (reduceMotion()) return;
  STEP = K.dist ? Math.round(rand(250, 640)) : 420;
  const felt = document.querySelector('#table .felt'), fr = felt.getBoundingClientRect(), ox = felt.clientLeft, oy = felt.clientTop;
  const ctr = r => ({ x: r.left - fr.left - ox + r.width / 2, y: r.top - fr.top - oy + r.height / 2 });
  const s = ctr($('shoe').getBoundingClientRect()), n = els.length;
  const hand = el(`<div class="dhand">${HAND_SVG}</div>`); felt.append(hand);
  const T = p => `translate(${p.x - 32}px,${p.y - 78}px)`, e = 'ease-in-out', kf = [{ transform: T(s), offset: 0, easing: e }];
  els.forEach((c, k) => {
    const p = ctr(c.getBoundingClientRect()), from = `translate(${s.x - p.x}px,${s.y - p.y}px) rotate(-20deg) scale(.7)`;
    kf.push({ transform: T(p), offset: (k + .55) / n, easing: e }, { transform: T(s), offset: (k + 1) / n, easing: e });
    c.animate([{ transform: from, opacity: 0, offset: 0 }, { transform: from, opacity: 1, offset: .01 }, { transform: 'none', opacity: 1, offset: 1 }], { delay: k * STEP, duration: STEP * .55, easing: 'ease-out', fill: 'backwards' });
  });
  hand.animate(kf, { duration: n * STEP, fill: 'both' }).onfinish = () => hand.remove();
  later(() => hand.remove(), n * STEP + 400);
  const end = Date.now() + n * STEP;
  Anim.all = Math.max(Anim.all, end);
  if (els.some(x => $('player').contains(x))) Anim.p = Math.max(Anim.p, end);
  if (els.some(x => $('dealer').contains(x))) Anim.d = Math.max(Anim.d, end);
}
/* find cards whose id has not been animated yet (in dealing order) and fly them in */
function tagAnim() {
  const pairs = [], add = (els, cs) => els.forEach((e, i) => { if (cs[i]) pairs.push([e, cs[i]]); });
  add([...$('dealer').querySelectorAll('.card')], G.dealer);
  [...$('seats').children].forEach((n, i) => G.others[i] && add([...n.querySelectorAll('.card')], G.others[i].cards));
  [...$('player').querySelectorAll('.hand')].forEach((n, i) => G.hands[i] && add([...n.querySelectorAll('.card')], G.hands[i].cards));
  const fresh = pairs.filter(p => !SEEN.has(p[1].id)).sort((a, b) => a[1].id - b[1].id);
  pairs.forEach(p => SEEN.add(p[1].id));
  if (fresh.length) flyHand(fresh.map(p => p[0]));
}

/* ---------- table pieces ---------- */
const FINAL = ['wait', 'check', 'between', 'over'];
function dealerTotal() {
  if (!K.tot || !G.dealer.length) return '';
  if (FINAL.includes(G.phase)) return 'Dealer ' + handLabel(G.dealer);
  return G.phase === 'dealer' ? '' : 'Dealer shows ' + upLabel(G.dealer[0]);
}
function chipList(a) { const r = []; for (const d of [500, 100, 25, 5]) while (a >= d && r.length < 12) { r.push(d); a -= d; } return r; }
/* Chip scatter for this hand: each chip sits slightly differently, and the thrown chips land on exactly these spots */
const newJitter = () => Array.from({ length: 40 }, () => ({ x: rand(-9, 9), y: rand(-3, 3), r: rand(-30, 30) }));
const jit = (hi, k) => G.jit[(hi * 7 + k) % 40];
const STACK_MAX = 7;
/* hi: which hand. G.fresh = {hand: {from, until}} marks chips still in flight, shown once they land. */
function chipStack(bet, hi) {
  const f = G.fresh && G.fresh[hi], wait = f ? Math.max(0, f.until - Date.now()) : 0;
  return `<div class="cstack">${chipList(bet).slice(0, STACK_MAX).map((d, k) => {
    const j = jit(hi, k), isNew = f && wait > 0 && k >= f.from;
    return `<i class="cs c${d}${isNew ? ' new' : ''}" style="left:calc(50% - 11px + ${j.x.toFixed(1)}px);bottom:${(k * 4 + j.y).toFixed(1)}px;transform:rotate(${j.r.toFixed(0)}deg);${isNew ? `animation-delay:${wait}ms` : ''}"></i>`;
  }).join('')}</div>`;
}

function renderStatus() {
  const left = Core.cardsLeft(G.shoe) / 52, shown = G.showCount && G.phase !== 'check';
  G.usedCount = G.usedCount || shown;
  const hand = `Hand <b>${G.rounds + (['play', 'others', 'dealer', 'insure', 'esur'].includes(G.phase) ? 1 : 0)}</b>`;
  if (G.gm === 'game') $('status').innerHTML = `Bankroll <b id="bankEl">${usd(G.bank)}</b> · ${hand}`;
  else $('status').innerHTML = `${hand} · ${left.toFixed(1)} decks left · ` + (shown ? `Running${K.sys === 'hilo' ? '' : ' (' + Core.SYSTEMS[K.sys].name + ')'} <b>${fmt(G.rc)}</b>${balanced() ? ` · True <b>${tcFmt(trueC())}</b>` : ''}` : 'Count hidden');
}

function render() {
  if (!G || G.kind !== 'table') return;
  renderStatus();
  const game = G.gm === 'game', p = G.phase, row = h => `<div class="cards">${h.cards.map(cardHTML).join('')}</div>`;
  $('dealer').innerHTML = G.dealer.length ? `<div class="cards">${G.dealer.map((c, i) => (i === 1 && !G.holeUp ? backHTML : cardHTML(c))).join('')}</div><div class="tot" data-z="d">${dealerTotal()}</div>` : '';
  $('seats').innerHTML = G.others.map(h => `<div class="hand">${row(h)}<div class="tot" data-z="o">${FINAL.includes(p) ? [K.tot ? handLabel(h.cards) : '', h.res || ''].filter(Boolean).join(' · ') : ''}</div></div>`).join('');
  if (G.hands.length) $('player').innerHTML = `<div class="hands">${G.hands.map((h, i) => `<div class="hand ${p === 'play' && G.cur === i && G.hands.length > 1 ? 'on' : ''}">${row(h)}<div class="tot" data-z="p">${[K.tot ? handLabel(h.cards) : '', game ? usd(h.bet) : ''].filter(Boolean).join(' · ')}</div>${game ? chipStack(h.bet, i) : ''}</div>`).join('')}</div>`;
  /* Game Mode betting: an empty spot with the same layout as the hand, so chips land where they will stay */
  else $('player').innerHTML = game ? `<div class="hands"><div class="hand"><div class="cards" style="min-height:calc(var(--cw)*1.4)"></div><div class="tot">&nbsp;</div><div class="cstack"></div></div></div>` : '';
  if (p !== 'bet') document.querySelectorAll('.chip3d.thrown:not(.tmp)').forEach(e => e.remove());
  $('print').innerHTML = (R().h17 ? 'Dealer hits soft 17' : 'Dealer stands on all 17s') + '<br>Blackjack pays ' + BJ_LABEL[R().bj] + ['', '<br>Late surrender offered', '<br>Early surrender offered'][R().sur] + (R().peek ? '' : '<br>No hole card: dealer does not peek');
  const il = $('insline'); il.hidden = !R().ins;
  if (R().ins) il.innerHTML = 'Insurance pays 2 to 1' + (G.ins ? `<span class="chip">${usd(G.ins)}</span>` : '');
  let m = '';
  if (G.note) m += `<div class="small">${G.note}</div>`;
  if (G.fb && !game) m += `<div class="${G.fb.ok ? 'ok' : 'no'}">${G.fb.t}</div>`;
  if (G.result && p !== 'play') m += `<div><strong>${G.result}</strong></div>`;
  if (G.cm) m += `<div class="${G.cm.ok ? 'ok' : 'no'}">${G.cm.t}</div>`;
  $('msg').innerHTML = m;
  renderControls();
  $('shoe').innerHTML = `<span>${(Core.cardsLeft(G.shoe) / 52).toFixed(1)}<small>decks</small></span>`;
  if (game) { $('accBtn').disabled = !['bet', 'between'].includes(p); $('heatBar').firstElementChild.style.width = G.heat + '%'; }
  tagAnim(); stageTotals();
  if (MINI_ON) renderMini();
}

/* hand totals stay hidden until the cards for that spot have landed */
function stageTotals() {
  const now = Date.now(), until = { d: FINAL.includes(G.phase) ? Anim.all : Anim.d, p: Anim.p, o: Anim.all };
  document.querySelectorAll('#table .tot[data-z]').forEach(e => {
    const u = until[e.dataset.z];
    if (u > now) { e.style.visibility = 'hidden'; later(() => (e.style.visibility = ''), u - now); }
  });
}

function renderControls() {
  const c = $('controls'), p = G.phase, game = G.gm === 'game';
  if (p === 'bet') {
    if (game) return chipUI();
    c.innerHTML = '<div class="acts"><button class="btn" id="dealBtn">Deal</button></div>'; $('dealBtn').onclick = dealRound; $('dealBtn').focus();
  } else if (p === 'esur') {
    const best = G.hintMove && Core.earlySurrender(G.hands[0].cards, val(G.dealer[0]), R());
    c.innerHTML = `<div class="acts"><button class="btn ${best ? 'hint' : ''}" data-a="R">Surrender</button><button class="btn ghost ${G.hintMove && !best ? 'hint' : ''}" id="esN">Play on</button></div><div class="small" style="text-align:center;margin-top:6px">Early surrender: the dealer has not checked for blackjack yet.</div>`;
    $('esN').onclick = () => early(false);
  } else if (p === 'insure') {
    const me = G.hands[0], bj = Core.isBlackjack(me.cards);
    c.innerHTML = `<div class="acts"><button class="btn" id="insY">${bj ? 'Even money' : 'Take insurance (' + usd(me.bet / 2) + ')'}</button><button class="btn ghost" id="insN">${bj ? 'Play it out' : 'No insurance'}</button></div><div class="small" style="text-align:center;margin-top:6px">Dealer shows an ace.</div>`;
    $('insY').onclick = () => takeIns(1); $('insN').onclick = () => takeIns(0);
  } else if (p === 'play') {
    const h = G.hands[G.cur], best = G.hintMove ? decideFor(h, devLevel()).play : '';
    const btn = [['H', 'Hit', !h.fromAce], ['S', 'Stand', true], ['D', 'Double', canDouble(h)], ['P', 'Split', canSplit(h)], ['R', 'Surrender', canSurr(h)]].filter(b => b[0] !== 'R' || b[2]);
    c.innerHTML = `<div class="acts">${btn.map(([k, n, on]) => `<button class="btn ${best === k ? 'hint' : ''}" data-a="${k}" ${on ? '' : 'disabled'}>${n}</button>`).join('')}</div><div class="small" style="text-align:center;margin-top:6px">Keys: H, S, D, P${canSurr(h) ? ', R' : ''}</div>`;
  } else if (p === 'others' || p === 'dealer') c.innerHTML = `<div class="acts small">${p === 'others' ? 'Other players act…' : 'Dealer plays…'}</div>`;
  else if (p === 'check') { c.innerHTML = ASK_HTML; bindAsk(submitCount); }
  else if (p === 'between') { c.innerHTML = '<div class="acts"><button class="btn" id="next">Next hand</button></div>'; $('next').onclick = () => nextRound(); $('next').focus(); }
  else c.innerHTML = '<div class="acts"></div>';   /* wait, over */
}

/* ---------- betting chips (Game Mode) ---------- */
/* Throw chips from the controls onto hand `hi`'s stack, starting at chip slot `from`.
   Chips for the opening bet stay put (the hand's own stack replaces them in the same spot);
   chips for a double or split are removed once the real stack shows them. */
function throwChips(amount, hi, from, temp) {
  if (G.gm !== 'game' || reduceMotion()) return;
  const stack = $('player').querySelectorAll('.hand')[hi] && $('player').querySelectorAll('.hand')[hi].querySelector('.cstack');
  if (!stack) return;
  const felt = document.querySelector('#table .felt'), fr = felt.getBoundingClientRect(), ox = felt.clientLeft, oy = felt.clientTop;
  const sr = stack.getBoundingClientRect(), cr = $('controls').getBoundingClientRect();
  const sx = cr.left - fr.left - ox + cr.width / 2, sy = cr.top - fr.top - oy + cr.height / 2;
  chipList(amount).forEach((d, k) => {
    const slot = from + k; if (slot >= STACK_MAX) return;
    const j = jit(hi, slot), tx = sr.left - fr.left - ox + sr.width / 2 + j.x, ty = sr.bottom - fr.top - oy - 11 - (slot * 4 + j.y);
    const e = el(`<div class="chip3d thrown${temp ? ' tmp' : ''} c${d}">${d}</div>`); felt.append(e);
    e.style.left = (tx - 16) + 'px'; e.style.top = (ty - 16) + 'px';
    const end = `scale(.6875) rotate(${j.r}deg)`;
    e.animate([{ transform: `translate(${sx - tx}px,${sy - ty}px) rotate(0) scale(1.3)` }, { transform: `translate(${(sx - tx) * .35}px,${(sy - ty) * .35 - 70}px) rotate(360deg) scale(1.1)`, offset: .55 }, { transform: end }], { duration: 650, delay: k * 70, easing: 'cubic-bezier(.2,.7,.3,1)', fill: 'both' });
    e.style.transform = end;
    if (temp) later(() => e.remove(), 650 + k * 70 + 80);
  });
}
function chipUI() {
  const mx = Math.min(500, Math.floor(G.bank / 5) * 5), c = $('controls');
  c.innerHTML = `<div class='chips'>${[5, 25, 100, 500].map(d => `<button class='chipb c${d}' data-c='${d}' ${d > mx ? 'disabled' : ''}>${d}</button>`).join('')}</div><div class='ask'><label for='betIn'>Bet $</label><input id='betIn' type='text' inputmode='numeric' autocomplete='off' value='${Math.min(G.lastBet, mx)}'><button class='btn' id='betGo'>Bet</button><button class='btn ghost' id='betClr'>Clear</button></div>`;
  const inp = $('betIn'), cur = () => parseInt(inp.value.replace(/\D/g, ''), 10) || 0;
  c.querySelectorAll('.chipb').forEach(b => (b.onclick = () => { inp.value = Math.min(mx, cur() + +b.dataset.c); }));
  $('betClr').onclick = () => { inp.value = ''; inp.focus(); };
  const place = () => {
    if ($('betGo').disabled) return;
    let a = Math.round(cur() / 5) * 5; a = Math.max(5, Math.min(mx, a)); inp.value = a;
    G.bet = G.lastBet = a; $('betGo').disabled = true; throwChips(a, 0, 0, false);
    const g = G; later(() => { if (G === g && g.alive && g.phase === 'bet') dealRound(); }, 800 + chipList(a).length * 70);
  };
  $('betGo').onclick = place; inp.onkeydown = e => { if (e.key === 'Enter') place(); }; inp.select();
}

/* ---------- distractions: table chatter ---------- */
let chatTimer = null;
const CHATTER = [
  ['d', 'Anyone need a drink?'], ['d', 'Cocktails, ladies and gentlemen!'], ['d', 'Place your bets, please.'], ['s', 'Hit me!'], ['s', 'Come on, dealer busts!'],
  ['s', 'Third hand in a row, wow.'], ['s', 'Did you see the game last night?'], ['d', 'Checking! Checking...'], ['s', 'I always split tens. Always.'], ['d', 'Shuffle up in a few hands.'], ['s', 'Table is cold today.'],
];
function scheduleChatter() {
  chatTimer = setTimeout(() => {
    if (!G || !G.alive || !K.dist) return;
    if (!$('table').hidden) chatter();
    scheduleChatter();
  }, rand(5000, 11000));
}
function chatter() {
  const [who, text] = pick(CHATTER), felt = document.querySelector('#table .felt'), fr = felt.getBoundingClientRect();
  const seats = [...$('seats').children], target = who === 'd' || !seats.length ? $('dealer') : pick(seats);
  const r = target.getBoundingClientRect();
  const b = el(`<div class="bubble">${text}</div>`);
  b.style.left = Math.max(6, Math.min(fr.width - 200, r.left - fr.left + r.width / 2 - 90)) + 'px';
  b.style.top = Math.max(4, r.top - fr.top - 8) + 'px';
  felt.append(b); later(() => b.remove(), 3300);
}
