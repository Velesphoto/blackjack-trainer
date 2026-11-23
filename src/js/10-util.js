/* ==========================================================================
   Utilities: DOM helpers, formatting, popups, safe storage
   ========================================================================== */
const { val, total, fmt, PLAY_NAME, rankVal, upLabel } = Core;
const $ = id => document.getElementById(id);
const usd = x => '$' + (+x.toFixed(2));
const sgn = x => (x > 0 ? '+' : x < 0 ? '−' : '') + usd(Math.abs(x));
const tcFmt = x => fmt(+x.toFixed(1));
const reduceMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const rand = (a, b) => a + Math.random() * (b - a);
const pick = a => a[Math.floor(Math.random() * a.length)];
const BJ_LABEL = { 1.2: '6 to 5', 1.5: '3 to 2', 2.5: '5 to 2' };

/* localStorage that never throws (private mode, blocked storage, the artifact viewer) */
const store = {
  get(k, dflt) { try { const v = localStorage.getItem(k); return v === null ? dflt : JSON.parse(v); } catch (e) { return dflt; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } },
  del(k) { try { localStorage.removeItem(k); } catch (e) {} },
};

function el(html) { const t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstChild; }
/* focus a button after the current key event finishes, so the Enter/Space that triggered this screen does not also press it */
const focusSoon = id => setTimeout(() => { const e = $(id); if (e) e.focus(); }, 0);
function later(fn, ms) { return setTimeout(fn, ms); }
/* a timer tied to the current session: does nothing if that session has ended or been replaced */
function laterG(fn, ms) { const g = G; return setTimeout(() => { if (G === g && g.alive) fn(); }, ms); }

/* ---------- popups ---------- */
let streak = 0;          /* consecutive right answers, for the "in a row" tag */
let lastPress = null;    /* where the last button/key press happened, so popups appear there */
document.addEventListener('pointerdown', e => {
  const b = e.target.closest('button');
  if (b) lastPress = { r: b.getBoundingClientRect(), t: Date.now() };
}, true);
document.addEventListener('keydown', e => {
  const k = e.key.toUpperCase();
  let b = null;
  if (e.target.id === 'cnt' && e.key === 'Enter') b = $('go');
  else if (k.length === 1 && 'HSDPR'.includes(k) && e.target.tagName !== 'INPUT') b = document.querySelector(`[data-a="${k}"]`);
  if (b) lastPress = { r: b.getBoundingClientRect(), t: Date.now() };
}, true);

/* "Nice!" / "Ouch..." rhythm-game popup at the pressed button */
function pop(ok) {
  streak = ok ? streak + 1 : 0;
  if (G && G.gm === 'game' && G.kind === 'table') return;   /* Game Mode shows no per-play feedback */
  if (MINI_ON) { miniMark(ok); return; }
  const r = lastPress && Date.now() - lastPress.t < 2500 ? lastPress.r : null;
  const x = Math.min(Math.max(r ? r.left + r.width / 2 : innerWidth / 2, 90), innerWidth - 90);
  const y = Math.max(r ? r.top : innerHeight * 0.45, 110);
  const d = el(`<div class="pop ${ok ? 'good' : 'bad'}">${ok ? 'Nice!' : 'Ouch...'}${ok && streak > 1 ? `<small>${streak} in a row</small>` : ''}</div>`);
  d.style.left = x + 'px'; d.style.top = y + 'px';
  document.body.append(d); later(() => d.remove(), 2400);
}
/* "+$25!" / "-$10!" over the bankroll */
function moneyPop(p) {
  const b = $('bankEl'), r = b && b.getBoundingClientRect();
  if (!r || !p) return;
  const d = el(`<div class="pop sm ${p > 0 ? 'good' : 'bad'}">${p > 0 ? '+' : '-'}$${Math.abs(+p.toFixed(2))}!</div>`);
  d.style.left = (r.left + r.width / 2) + 'px'; d.style.top = Math.max(r.top, 110) + 'px';
  document.body.append(d); later(() => d.remove(), 2500);
}
function bigText(t) { const d = el(`<div class="bigT">${t}</div>`); document.body.append(d); later(() => d.remove(), 2500); }
function toast(t) { const d = el(`<div class="toast">${t}</div>`); document.body.append(d); later(() => d.remove(), 3700); }

/* ---------- cards ---------- */
const cardHTML = c => `<div class="card ${'♥♦'.includes(c.s) ? 'red' : ''}"><b>${c.r}</b><i>${c.s}</i></div>`;
const backHTML = '<div class="card back"></div>';
function handLabel(cs) { const { t, soft } = total(cs); return t > 21 ? `Bust (${t})` : (soft && t < 21 ? 'Soft ' : '') + t; }

/* ---------- count-entry box with + / − buttons (works on phones, no minus key needed) ---------- */
const ASK_HTML = '<div class="ask"><label for="cnt">Running count?</label><span class="sgn"><button type="button" class="btn ghost sgnb" id="sgnN" aria-label="Negative count">−</button><button type="button" class="btn ghost sgnb" id="sgnP" aria-label="Positive count">+</button></span><input id="cnt" type="text" inputmode="numeric" pattern="-?[0-9]*" autocomplete="off" enterkeyhint="done"><button class="btn" id="go">Lock in</button><span id="clock">0.0s</span></div>';
function bindAsk(onSubmit) {
  const i = $('cnt'), n = $('sgnN'), p = $('sgnP');
  const clean = () => { const v = i.value.replace(/[^0-9-]/g, ''); i.value = (v.startsWith('-') ? '-' : '') + v.replace(/-/g, ''); };
  const sync = () => { const neg = i.value.startsWith('-'); n.setAttribute('aria-pressed', neg); p.setAttribute('aria-pressed', !neg && i.value !== ''); };
  const sign = neg => { clean(); i.value = (neg ? '-' : '') + i.value.replace('-', ''); sync(); i.focus(); };
  [n, p].forEach(b => (b.onpointerdown = e => e.preventDefault()));
  n.onclick = () => sign(true); p.onclick = () => sign(false);
  i.oninput = () => { clean(); sync(); };
  i.onkeydown = e => {
    if (e.key === 'Enter') onSubmit();
    else if (e.key === '-') { e.preventDefault(); sign(!i.value.startsWith('-')); }
    else if (e.key === '+') { e.preventDefault(); sign(false); }
  };
  $('go').onclick = onSubmit; sync(); i.focus();
}
/* The answer-timer clock shared by table count checks and drills */
let clockT = null, clock0 = 0;
function startClock() {
  clearInterval(clockT); clock0 = performance.now();
  clockT = setInterval(() => { const c = $('clock'); if (c) c.textContent = ((performance.now() - clock0) / 1000).toFixed(1) + 's'; }, 100);
}
function stopClock() { clearInterval(clockT); return performance.now() - clock0; }
/* Points for a right count: 100 under 3 s, fading to 40 at 12 s */
const countPoints = ms => Math.round(ms <= 3000 ? 100 : Math.max(40, 100 - (ms - 3000) / 9000 * 60));
