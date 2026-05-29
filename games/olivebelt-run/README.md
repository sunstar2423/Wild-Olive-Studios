# 🛸 Olivebelt Run

A tiny neon arcade demo — pilot a salvage ship through an asteroid belt, dodge
the rocks, and scoop up olives for points. Built as the studio's first
end-to-end **playable web demo** and as a template for shipping future games.

## Tech

- **Single-file HTML5 game** — vanilla JavaScript + Canvas 2D, no engine, no
  build step, no dependencies.
- Keyboard (arrows / WASD), mouse, and touch controls.
- Saves your best score in `localStorage`.

## Where the playable build lives

Because this is a single self-contained file, the **source and the build are
the same file**, and it lives in the published site folder so it's playable
online:

```
docs/play/olivebelt-run/index.html
```

- **Play locally:** open that file in a browser, or run
  `python3 -m http.server 8000 --directory docs` and visit
  `http://localhost:8000/play/olivebelt-run/`.
- **Play live:** `https://sunstar2423.github.io/Wild-Olive-Studios/play/olivebelt-run/`
- **Linked from:** the *Olivebelt Run* card on the home page (`docs/index.html`).

> For larger games built in an engine (Godot, Unity, Phaser, …), keep the
> editable **project** here in `games/<slug>/` and export the **web build** into
> `docs/play/<slug>/`. This demo is small enough that the one file does both.

## Ideas to grow it

- [ ] Power-ups (shields, magnet for olives, slow-mo)
- [ ] Boss asteroid every N points
- [ ] Sound effects + a chiptune loop
- [ ] Combo multiplier for olives grabbed without getting hit
