# 🕹️ docs/play — web game builds

Drop **HTML5 / web exports** of your games into a subfolder here, one per game:

```
docs/play/
├── the-last-grove/    # contains index.html + the game's build files
└── olivebelt-run/
```

Because this lives under `docs/` (the folder GitHub Pages serves), each game
becomes **playable directly in the browser** at:

```
https://sunstar2423.github.io/Wild-Olive-Studios/play/<game-slug>/
```

You can then link or embed it from a game card in `docs/index.html`, e.g.:

```html
<a class="btn btn--small btn--primary" href="play/the-last-grove/">Play in browser</a>
```

or embed it inline with an `<iframe src="play/the-last-grove/">`.

> Only commit **web build output** here, not game source — source lives in the
> top-level `games/` folder.
