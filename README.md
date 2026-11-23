# The Shoe Room

Blackjack basic-strategy and card-counting trainer. A static website (no build step needed to run).

- `index.html` is the built page that GitHub Pages serves. Do not edit it by hand.
- Source lives in `src/` (`css/*.css`, `js/*.js`, `template.html`). Run `python3 build.py` to rebuild `index.html`.
- `src/js/00-core.js` is the pure rules/strategy/counting engine. Tests: `node tests/core.test.js`.
- Browser tests (Playwright + Chrome): `python3 tests/smoke.py`, `tests/features.py`, `tests/rules.py`.
- `manifest.json`, `sw.js`, `icons/` make it installable and usable offline.
- `assets/` is where hand-drawn art and animations will go.
