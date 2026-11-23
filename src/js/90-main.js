/* ==========================================================================
   Wiring and start-up
   ========================================================================== */
$('controls').addEventListener('click', e => { const b = e.target.closest('[data-a]'); if (b) act(b.dataset.a); });

/* keyboard: table plays, insurance, flashcards */
document.addEventListener('keydown', e => {
  if (!G || e.metaKey || e.ctrlKey || e.altKey || e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
  const k = e.key.toUpperCase(), one = k.length === 1;
  if (G.kind === 'table') {
    if ((G.phase === 'play' || G.phase === 'esur') && one && 'HSDPR'.includes(k)) act(k);
    else if (G.phase === 'esur' && k === 'N') early(false);
    else if (G.phase === 'insure') { if (k === 'Y') takeIns(1); else if (k === 'N') takeIns(0); }
  } else if (G.kind === 'deckrun') {
    if (G.phase === 'flip' && (e.key === ' ' || e.key === 'Enter' || e.key === 'ArrowRight')) { e.preventDefault(); runNext(); }
  } else if (G.kind === 'quiz') {
    if (G.phase === 'ask') {
      const q = G.q;
      if (q.type === 'pair') {
        if (e.key === '-') G.neg = true; else if (e.key === '+') G.neg = false;
        else if (/^[0-8]$/.test(e.key) && +e.key <= 2 * maxTag()) { const n = (G.neg ? -1 : 1) * +e.key; answerQ(String(n)); }
      } else if (q.type === 'ins') { if (k === 'Y') answerQ('Take'); else if (k === 'N') answerQ('Decline'); }
      else if (one && 'HSDPR'.includes(k) && (k !== 'D' || q.env.canD) && (k !== 'P' || q.env.canS) && (k !== 'R' || q.env.canR)) answerQ(k);
    }
  }
});

$('tCount').onchange = e => { G.showCount = e.target.checked; renderStatus(); };
$('tHint').onchange = e => { G.hintMove = e.target.checked; if (G.hintMove) G.usedHint = true; if (['play', 'esur'].includes(G.phase)) render(); };
$('end').onclick = showResults;

/* test hook (read-only view of internals for the browser tests) */
window.__bj = { runNext, get G() { return G; }, get K() { return K; }, Core, PC, GC, STD, act, dealRound, nextRound, submitCountValue, launch, showResults, takeIns, early, trueC };

/* start: restore menu choices, show the intro decks */
loadSettings();
openMenu('practice');
$('intro').className = 's0'; $('menu').hidden = true; $('dk1').classList.remove('sel'); $('dk2').classList.remove('sel'); $('dk2').hidden = true; $('dkt1').textContent = 'The Shoe Room';

/* installable app: works offline once loaded. Skipped where service workers are unavailable (file://, preview viewers). */
try { if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) navigator.serviceWorker.register('sw.js').catch(() => {}); } catch (e) {}
