# Runway Rings — a flight game

[![make.fun bounty](https://make.fun/badge/best-flight-game-20261126-0057.svg)](https://make.fun/bounty/best-flight-game-20261126-0057)
[![rank](https://make.fun/badge/best-flight-game-20261126-0057/tanglangbc/best-flight-game/rank.svg)](https://make.fun/bounty/best-flight-game-20261126-0057)
[![reward](https://make.fun/badge/best-flight-game-20261126-0057/tanglangbc/best-flight-game/reward.svg)](https://make.fun/bounty/best-flight-game-20261126-0057)

Fly a little red propeller plane through golden rings over rolling hills,
runways, farmhouses and pine trees at golden hour. Rings are worth
100 points times your combo, stars are worth 25, and every 8 rings the
course gets faster. You have 3 lives: mountains, hot-air balloons, birds
and storm clouds all end a flight the same way.

## How to play

Open `game/index.html` in a desktop browser, or serve it locally:

```sh
node serve.ts
# then open http://localhost:8080
```

| Control | Action |
| --- | --- |
| ↑ / W | Climb |
| ↓ / S | Descend |
| ← → / A D | Throttle down / up |
| Space | Boost (hold) — also starts / restarts |
| Mouse / touch | The plane chases your pointer |
| P | Pause |
| M | Mute |

The HUD shows altitude (FT), speed (KT) and heading, plus score, rings,
level, lives and distance. The two lit dials at bottom left are the
altimeter and the airspeed indicator; the strip under the top bar is the
compass. Your best score is kept in the browser.

## What is in the repo

- `game/index.html` — the page; a full-window canvas, nothing else.
- `game/src/main.js` — boot, the fixed-step game loop, the four screens.
- `game/src/world.js` — flight physics, terrain, rings, stars, hazards,
  scoring, lives and levels. Deterministic for a given `?seed=N`.
- `game/src/render.js` — all drawing: sky, parallax ridges, terrain and
  runways, the plane, the HUD and the instrument dials.
- `game/src/input.js` — keyboard, mouse and touch.
- `game/src/audio.js` — WebAudio sound, all synthesised: engine drone,
  ring chimes, star blips, crash and level-up.
- `game/src/config.js` — every tuning number and colour.
- `game/src/random.js` — seeded random source.
- `game/src/shots.js` — the staged scenes behind `?shot=start|play|end`,
  flown by a simple autopilot so screenshots are reproducible.
- `main.ts` — the make.fun entrypoint: copies `game/` and `screenshots/`
  to `/output` and writes `dossier.json`.
- `serve.ts` — a tiny local static server for playing the game.
- `screenshots/` — three real renders of the game (title, play, game over),
  taken with `?shot=…&seed=7` as listed in `shots.json`.
- `vendor/makefun-game.ts` — the kit's dossier library, unchanged.

No external assets and no network requests: the game runs fully offline.

## Screenshots

The three screenshots were staged with the game's own autopilot:

- `1-start.jpg` — `?shot=start&seed=7`
- `2-play.jpg` — `?shot=play&seed=7`
- `3-end.jpg` — `?shot=end&seed=7`

## License

MIT — see `LICENSE`.
