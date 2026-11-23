/* ==========================================================================
   Pop-up mini player: a tiny keyboard-only table in a Document
   Picture-in-Picture window (or a floating box when the browser has none).
   ========================================================================== */
const MINI = el('<div id="mini"></div>');
let MINI_ON = false, PIPW = null, MB = '', MBET = '', MK = null;
const miniCard = c => `<span class="mc ${'♥♦'.includes(c.s) ? 'r' : ''}">${c.r}</span>`;
const maxBet = () => Math.max(5, Math.min(500, Math.floor(G.bank / 5) * 5));

/* Faint shortcut reminder shown under your first card */
function miniHint() {
  const p = G.phase, h = G.hands[G.cur];
  if (p === 'bet') return (G.gm === 'game' ? '\u21b5 bet' : '\u21b5 deal') + ' \u00b7 Esc end';
  if (p === 'esur') return 'R sur \u00b7 N play';
  if (p === 'insure') return 'Y ins \u00b7 N no';
  if (p === 'play' && h) return ['H', 'S', canDouble(h) ? 'D' : '', canSplit(h) ? 'P' : '', canSurr(h) ? 'R' : ''].filter(Boolean).join(' ');
  if (p === 'check') return '\u2212 digits \u21b5';
  if (p === 'between') return '\u21b5 next';
  return '';
}

function renderMini() {
  if (!MINI_ON || !G || G.kind !== 'table') return;
  const grp = h => `<span class="mg">${h.cards.map(miniCard).join('')}</span>`, p = G.phase, game = G.gm === 'game';
  const dl = G.dealer.map((c, i) => (i === 1 && !G.holeUp ? '<span class="mc b"></span>' : miniCard(c))).join('');
  if (p !== 'check') MB = '';
  if (p !== 'bet') MBET = '';
  const mk = MK && Date.now() - MK.t < 1600 ? `<span class="mk ${MK.ok ? 'y' : 'n'}">${MK.ok ? '\u2713' : '\u2717'}</span>` : '';
  const entry = p === 'check' ? `<span class="mbx">${MB || '_'}</span>` : p === 'bet' && game ? `<span class="mbx">$${MBET || G.lastBet}</span>` : '';
  MINI.innerHTML = `<div class="mrow">${dl ? `<span class="mg">${dl}</span>` : ''}${G.others.map(grp).join('')}</div>
    <div class="mrow"><div class="mme">${G.hands.length ? G.hands.map(grp).join('') : '<span class="mg"><span class="mc e"></span></span>'}<div class="mh">${miniHint()}</div></div>${entry}${mk}</div>`;
}
function miniMark(ok) { MK = { ok, t: Date.now() }; renderMini(); later(renderMini, 1700); }

function miniKey(e) {
  if (!MINI_ON || !G || G.kind !== 'table' || e.ctrlKey || e.metaKey) return;
  const k = e.key, K_ = k.toUpperCase(), p = G.phase;
  if (k === 'Escape') { e.preventDefault(); showResults(); return; }
  if (p === 'bet') {
    if (G.gm === 'game' && /^[0-9]$/.test(k)) MBET = (MBET + k).slice(0, 3);
    else if (k === 'Backspace') MBET = MBET.slice(0, -1);
    else if (k === 'Enter' || k === ' ') {
      e.preventDefault();
      if (G.gm === 'game') { const a = Math.max(5, Math.min(maxBet(), Math.round((parseInt(MBET, 10) || G.lastBet) / 5) * 5)); G.bet = G.lastBet = a; }
      MBET = ''; dealRound(); return;
    }
    e.preventDefault(); renderMini();
  } else if (p === 'play') { if (K_.length === 1 && 'HSDPR'.includes(K_)) act(K_); }
  else if (p === 'esur') { if (K_ === 'R') act('R'); else if (K_ === 'N' || k === 'Enter') early(false); }
  else if (p === 'insure') { if (K_ === 'Y') takeIns(1); else if (K_ === 'N') takeIns(0); }
  else if (p === 'check') {
    if (/^[0-9]$/.test(k)) MB += k;
    else if (k === '-') MB = MB.startsWith('-') ? MB.slice(1) : '-' + MB;
    else if (k === '+') MB = MB.replace('-', '');
    else if (k === 'Backspace') MB = MB.slice(0, -1);
    else if (k === 'Enter' && /^-?\d+$/.test(MB)) { const v = parseInt(MB, 10); MB = ''; submitCountValue(v); return; }
    e.preventDefault(); renderMini();
  } else if (p === 'between' && (k === 'Enter' || k === ' ')) { e.preventDefault(); nextRound(); }
}

async function openMini() {
  MINI_ON = true; MB = ''; $('table').hidden = true; $('miniHold').hidden = false;
  let ok = false;
  if (window.documentPictureInPicture) {
    try {
      const w = await documentPictureInPicture.requestWindow({ width: 240, height: 120 });
      document.querySelectorAll('link[rel=stylesheet]').forEach(l => w.document.head.append(l.cloneNode(true)));
      [...document.styleSheets].forEach(ss => { try { const s = w.document.createElement('style'); s.textContent = [...ss.cssRules].map(r => r.cssText).join('\n'); w.document.head.append(s); } catch (e) {} });
      w.document.body.style.margin = '0'; w.document.body.append(MINI);
      w.addEventListener('keydown', miniKey);
      w.addEventListener('pagehide', () => { if (PIPW === w) { PIPW = null; closeMini(true); } });
      PIPW = w; ok = true;
    } catch (e) {}
  }
  if (!ok) { MINI.classList.add('float'); document.body.append(MINI); }
  renderMini();
}
/* restore: put the table back (window closed or toggle switched off) */
function closeMini(restore) {
  MINI_ON = false;
  if (PIPW) { const w = PIPW; PIPW = null; try { w.close(); } catch (e) {} }
  MINI.remove(); MINI.classList.remove('float'); $('miniHold').hidden = true; $('popChk').checked = false;
  if (restore && G && G.kind === 'table' && G.alive && $('results').hidden && $('intro').hidden) { $('table').hidden = false; render(); }
}
document.addEventListener('keydown', e => { if (MINI_ON) { miniKey(e); e.stopPropagation(); } }, true);
$('popChk').onchange = e => (e.target.checked ? openMini() : closeMini(true));
