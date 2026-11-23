/* ==========================================================================
   Pop-up mini player: a tiny keyboard-only table in a Document
   Picture-in-Picture window (or a floating box when the browser has none).
   ========================================================================== */
const MINI = el('<div id="mini"></div>');
let MINI_ON = false, PIPW = null, MB = '', MK = null;
const miniCard = c => `<span class="mc ${'♥♦'.includes(c.s) ? 'r' : ''}">${c.r}</span>`;

function renderMini() {
  if (!MINI_ON || !G || G.kind !== 'table') return;
  const grp = h => `<span class="mg">${h.cards.map(miniCard).join('')}</span>`, p = G.phase;
  const dl = G.dealer.map((c, i) => (i === 1 && !G.holeUp ? '<span class="mc b"></span>' : miniCard(c))).join('');
  const os = G.others.map(grp);
  if (p !== 'check') MB = '';
  const mk = MK && Date.now() - MK.t < 1600 ? `<div class="mk ${MK.ok ? 'y' : 'n'}">${MK.ok ? '✓' : '✗'}</div>` : '';
  MINI.innerHTML = `<div class="mr">${dl}</div><div class="two"><div class="mside">${os.filter((_, i) => i % 2 === 0).join('')}</div><div class="mme">${G.hands.map(grp).join('')}</div><div class="mside">${os.filter((_, i) => i % 2 === 1).join('')}</div></div><div class="mi">${p === 'check' ? (MB || '_') : ''}</div><div class="mkey">H hit · S stand · D double · P split · R surrender · Y/N insurance · Enter bet or next · digits count · Esc end</div>${mk}`;
}
function miniMark(ok) { MK = { ok, t: Date.now() }; renderMini(); later(renderMini, 1700); }

function miniKey(e) {
  if (!MINI_ON || !G || G.kind !== 'table' || e.ctrlKey || e.metaKey) return;
  const k = e.key, K_ = k.toUpperCase(), p = G.phase;
  if (k === 'Escape') { e.preventDefault(); showResults(); return; }
  if (p === 'bet') {
    const mx = Math.max(5, Math.min(100, Math.floor(G.bank / 5) * 5));
    if (k === 'ArrowUp' || k === '+' || k === '=') G.bet = Math.min(mx, G.bet + 5);
    else if (k === 'ArrowDown' || k === '-') G.bet = Math.max(5, G.bet - 5);
    else if (k === 'Enter' || k === ' ') { e.preventDefault(); dealRound(); return; }
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
      const w = await documentPictureInPicture.requestWindow({ width: 330, height: 290 });
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
