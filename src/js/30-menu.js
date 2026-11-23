/* ==========================================================================
   Intro decks, Practice/Game menus, House Rules book
   ========================================================================== */
const ruleSummary = r => `${r.decks} decks · dealer ${r.h17 ? 'hits' : 'stands on'} soft 17 · blackjack pays ${BJ_LABEL[r.bj]}`;

function practiceMenu() {
  const n = mistakeCount(), goal = goalTarget(), done = dayCount(), st = currentStreak();
  return `
<div class='mcard' data-i='A♠' style='--rot:-2deg;--i:0;grid-column:1'><h3>Session</h3>
  ${sg('P', 'sys', 'Counting system', SYS_OPTS)}
  <p class='small'>KO is unbalanced and starts each shoe at −4 per deck beyond the first (−20 for six decks). Deviations and the true count use Hi-Lo.</p>
  ${sl('P', 'every', 'Count check')}${sw('P', 'mode', 'Burst drill')}
  <div class='dr' ${PC.mode ? '' : 'hidden'}>${sl('P', 'speed', 'Flash speed')}${sl('P', 'len', 'Cards per burst')}</div></div>
<div class='mcard' data-i='K♣' style='--rot:1.5deg;--i:1;grid-column:2'><h3>Play</h3>
  ${sg('P', 'dev', 'Count deviations (Hi-Lo)', [[0, 'Off'], [1, 'Illustrious 18'], [2, 'Advanced']])}
  <p class='small'>Advanced adds soft doubles and 10s vs 4, and adjusts for your dealer rule and shoe size.</p>
  ${sw('P', 'tot', 'Show hand totals')}${sw('P', 'dist', 'Distractions (chatter, uneven dealing speed)')}</div>
<div class='mcard' data-i='7♦' style='--rot:2deg;--i:2;grid-column:1'><h3>Table</h3>${sw('P', 'addp', 'Additional players')}
  <div class='ap' ${PC.addp ? '' : 'hidden'}>${sl('P', 'maxp', 'Max players')}${sw('P', 'rand', 'Randomized throughout')}</div></div>
<div class='mcard' data-i='J♥' style='--rot:-1.5deg;--i:3;grid-column:2'><h3>Drills</h3>
  <p class='small'>Quick questions that skip the table. They use the rules in Da Rules.</p>
  <div style='display:flex;flex-wrap:wrap;gap:8px'>
   <button class='btn ghost sm' data-drill='basic'>Basic flashcards</button>
   <button class='btn ghost sm' data-drill='index'>Index flashcards</button>
   <button class='btn ghost sm' data-drill='miss' ${n ? '' : 'disabled'}>Mistake review (${n})</button>
   <button class='btn ghost sm' data-drill='deck'>Deck estimation</button></div>
  <p class='small'>Index flashcards use the Count deviations setting (Illustrious 18 when it is Off).</p></div>
<div class='mcard' data-i='5♣' style='--rot:1deg;--i:4;grid-column:1'><h3>Daily goal</h3>
  <p><b>${done}</b> of <b>${goal}</b> right counts under 3 seconds today${st ? ` · ${st}-day streak` : ''}</p>
  <div class='goalbar'><i style='width:${Math.min(100, done / goal * 100)}%'></i></div>
  <button class='btn ghost sm' id='progBtn'>Progress, goal and backup</button></div>
<div class='mcard' data-i='Q♥' style='--rot:-1.5deg;--i:5;grid-column:2'><h3>Ready?</h3><button class='btn' id='goBtn'>Deal me in</button></div>`;
}

function gameMenu() {
  return `
<div class='mcard late${GC.custom ? ' in' : ''}' data-i='K♠' style='--rot:-2deg;--i:0;grid-column:1;grid-row:1 / span 3'><h3>Custom rules</h3>
  ${sl('G', 'decks', 'Shoe')}${sw('G', 'h17', 'Dealer hits soft 17')}${sl('G', 'bj', 'Blackjack pays')}${sg('G', 'sur', 'Surrender', SUR_OPTS)}${sw('G', 'ins', 'Insurance')}
  ${sw('G', 'das', 'Double after split')}${sw('G', 'peek', 'Dealer peeks for blackjack')}${sw('G', 'resplit', 'Resplit aces')}${sl('G', 'maxSplit', 'Max splits')}${sl('G', 'cutLeft', 'Cut card')}${sw('G', 'tot', 'Show hand totals')}</div>
<div class='mcard' data-i='Q♥' style='--rot:2deg;--i:1;grid-column:2;grid-row:1'><h3>Rules</h3>
  <div class='seg' id='segStd'><button data-v='0' ${GC.custom ? '' : "aria-pressed='true'"}>Standard Rules</button><button data-v='1' ${GC.custom ? "aria-pressed='true'" : ''}>Custom Rules</button></div>
  <p class='small'>6 decks · dealer hits soft 17 · blackjack pays 3 to 2 · insurance and late surrender offered · split up to 3 times (aces once)</p></div>
<div class='mcard' data-i='J♦' style='--rot:-1deg;--i:2;grid-column:2;grid-row:2'><h3>Bankroll</h3>
  <p>Start with <b>${usd(gameStart())}</b></p>
  <p class='small'>Reach $300 and your next session starts there, then every $100 after. It is saved the moment you reach it. View accuracy scores each play against basic strategy and the Advanced deviations.</p>
  ${sw('G', 'addp', 'Additional players')}<div class='ap' ${GC.addp ? '' : 'hidden'}>${sl('G', 'maxp', 'Max players')}${sw('G', 'rand', 'Randomized throughout')}</div></div>
<div class='mcard' data-i='A♣' style='--rot:1.5deg;--i:3;grid-column:2;grid-row:3'><h3>Watch the heat</h3>
  <p class='small'>Big bets at high counts and index plays draw the pit's eye. Skipping an index play, or taking insurance below the index, is a cover play: it cools the heat and costs a little edge. At 100 you are backed off.</p>
  <button class='btn' id='goBtn'>Sit down</button></div>`;
}

/* The House Rules book. Practice: editable. Game: shows the table's rules. */
function fillBook(kind) {
  const P = kind === 'practice', E = GC.custom ? GC : STD;
  const surTxt = ['not offered', 'late', 'early'][E.sur];
  $('bkL').innerHTML = '<h2>The Shoe</h2><p class="small">Cards, dealer and payouts</p>' + (P
    ? sl('P', 'decks', 'Shoe') + sl('P', 'bj', 'Blackjack pays') + sl('P', 'cutLeft', 'Cut card') + sw('P', 'h17', 'Dealer hits soft 17') + sw('P', 'peek', 'Dealer peeks for blackjack')
    : `<p>${E.decks} decks<br>Dealer ${E.h17 ? 'hits' : 'stands on'} soft 17<br>Blackjack pays ${BJ_LABEL[E.bj]}<br>Dealer ${E.peek ? 'peeks' : 'does not peek'}<br>Cut card at ${E.cutLeft} deck${E.cutLeft === 1 ? '' : 's'} left</p>`);
  $('bkR').innerHTML = '<h2>The Table</h2><p class="small">Dealer rules and side options</p>' + (P
    ? sg('P', 'sur', 'Surrender', SUR_OPTS) + sw('P', 'ins', 'Insurance') + sw('P', 'das', 'Double after split') + sw('P', 'resplit', 'Resplit aces') + sl('P', 'maxSplit', 'Max splits')
    : `<p>Surrender ${surTxt}<br>Insurance ${E.ins ? 'offered' : 'not offered'}<br>Double after split ${E.das ? 'allowed' : 'not allowed'}<br>Resplit aces ${E.resplit ? 'allowed' : 'no'}<br>Split up to ${E.maxSplit} times</p>`)
    + '<button class="btn" id="bkDone" style="background:#6b1f2a;color:#f7f2e5">Done</button>';
  $('bkDone').onclick = closeBook;
}
function openBook() { const b = $('book'); b.style.opacity = ''; b.hidden = false; void b.offsetWidth; b.classList.add('open'); $('bkDone').focus(); }
function closeBook() { const b = $('book'); b.style.opacity = '0'; later(() => { b.hidden = true; b.classList.remove('open'); b.style.opacity = ''; }, 400); }

function openMenu(kind) {
  const I = $('intro'), m = $('menu');
  I.hidden = false; I.className = 'm ' + kind; GM_MENU = kind;
  $('dk2').hidden = false; $('dkt1').textContent = 'Game Mode';
  $('dk1').classList.toggle('sel', kind === 'game'); $('dk2').classList.toggle('sel', kind === 'practice');
  m.hidden = false; m.innerHTML = kind === 'game' ? gameMenu() : practiceMenu();
  $('goBtn').onclick = () => launch(kind);
  if (kind === 'game') {
    $('segStd').onclick = e => {
      const b = e.target.closest('button'); if (!b) return;
      GC.custom = +b.dataset.v;
      [...$('segStd').children].forEach(x => x.setAttribute('aria-pressed', x === b));
      const c = m.querySelector('.late'); c.classList.remove('in'); void c.offsetWidth; if (GC.custom) c.classList.add('in');
    };
  } else {
    m.querySelectorAll('[data-drill]').forEach(b => (b.onclick = () => launchDrill(b.dataset.drill)));
    $('progBtn').onclick = openProgress;
  }
  fillBook(kind);
}
let GM_MENU = 'practice';
const introT0 = Date.now();
$('dk1').onclick = () => {
  const I = $('intro');
  if (I.classList.contains('s0')) { if (Date.now() - introT0 < 2200) return; I.className = 's1'; $('dkt1').textContent = 'Game Mode'; $('dk2').hidden = false; }
  else if (I.classList.contains('s1')) openMenu('game');
};
$('dk2').onclick = () => { if ($('intro').classList.contains('s1')) openMenu('practice'); };
$('backDecks').onclick = () => { $('intro').className = 's1'; $('menu').hidden = true; $('dk1').classList.remove('sel'); $('dk2').classList.remove('sel'); };
$('bookBtn').onclick = openBook;
$('book').onclick = e => { if (e.target.id === 'book') closeBook(); };
document.addEventListener('keydown', e => { if (e.key === 'Escape' && !$('book').hidden) closeBook(); });

/* Back to the menu from any screen */
function showIntro() {
  stopClock(); stopSessionTimers();
  ['results', 'table', 'drill'].forEach(id => ($(id).hidden = true));
  document.body.classList.remove('prac'); $('chartBtn').hidden = false;
  openMenu(GM_MENU);
}

/* Start whatever the menu is set up for */
function launch(kind) {
  K = buildConfig(kind); saveSettings();
  K.burst ? startBurst() : startSession();
}
function launchDrill(kind) {
  K = buildConfig('practice'); saveSettings();
  startQuiz(kind);
}
