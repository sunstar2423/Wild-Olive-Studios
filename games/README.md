# 🎮 Games — source projects

This folder holds the **source code and project files** for every Wild Olive
Studios game. One subfolder per game.

```
games/
├── the-last-grove/     # one folder per game project
├── olivebelt-run/
└── emberkeep/
```

## Starting a new game

1. Create a folder: `games/<game-slug>/` (lowercase, hyphenated).
2. Put the full engine project inside (Godot, Unity, PhaserJS, raw HTML5, etc.).
3. Add a short `README.md` in the game folder describing it and how to run/build it.
4. Add a `.gitignore` for your engine's build/temp files (e.g. Godot's `.godot/`,
   Unity's `Library/`, `Temp/`, `Obj/`). Don't commit generated build output.

## Where builds go

- **Web (HTML5) builds** → export into `docs/play/<game-slug>/` so they're
  **playable directly on the website**, then link them from a game card in
  `docs/index.html`.
- **Downloadable builds** (Windows/Mac/Linux binaries, `.exe`, etc.) → publish
  via **GitHub Releases** or **itch.io**. Do *not* commit binaries into git.

## Large assets

Big art, audio, and 3D files are tracked with **Git LFS** — see `.gitattributes`
in the repo root. Run `git lfs install` once before committing those files.

> Tip: if a single game's assets start bloating the repo, that's the signal to
> split that game into its own repository.
