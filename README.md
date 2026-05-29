# 🌿 Wild Olive Studios

> _We grow wild worlds from small, stubborn seeds._

The official website for **Wild Olive Studios**, an independent game studio
crafting bold, heartfelt worlds. This is a fast, dependency-free static site
built to be hosted for free on **GitHub Pages**.

🔗 **Live site:** `https://sunstar2423.github.io/wild-olive-studios/`
_(enable GitHub Pages — see below — for this URL to go live)_

---

## ✨ Features

- **Single-page landing site** with smooth-scrolling sections: Hero, Games, Studio, Craft, and Follow.
- **Animated, self-contained visuals** — no video files or heavy assets:
  - An animated olive-branch hero scene that "grows" on load (pure SVG + CSS).
  - A live particle/pollen field rendered on a `<canvas>` background.
  - Floating sprites, a scrolling marquee, animated stat counters, hover-reactive game cards, and scroll-reveal transitions.
- **Game showcase grid** ready to fill in as real games ship (3 concept titles + a "coming soon" slot).
- **Links to indie platforms** — itch.io, Steam, plus Bluesky, Discord, YouTube and GitHub.
- **Fully responsive** with a mobile nav menu.
- **Accessible & considerate** — semantic HTML, alt text, and full `prefers-reduced-motion` support (all animation is disabled for users who ask for it).
- **Social share card** + favicon, all as crisp SVG.

---

## 📁 Project structure

```
.
├── index.html          # main landing page
├── 404.html            # custom not-found page
├── css/
│   └── style.css       # all styling + animations
├── js/
│   └── main.js         # canvas background, scroll reveals, counters, form
├── assets/
│   ├── logo.svg         # studio logo
│   ├── favicon.svg      # browser tab icon
│   └── social-card.svg  # Open Graph / social share image
├── .nojekyll           # tells GitHub Pages to serve files as-is
└── README.md
```

---

## 🚀 Hosting on GitHub Pages (free)

1. Push this repo to GitHub (the `wild-olive-studios` repo).
2. Go to **Settings → Pages**.
3. Under **Build and deployment → Source**, choose **Deploy from a branch**.
4. Select the branch (e.g. `main`) and the `/ (root)` folder, then **Save**.
5. Wait a minute, then visit `https://<your-username>.github.io/wild-olive-studios/`.

> The included `.nojekyll` file ensures GitHub serves the site exactly as written.

### Want a custom domain later?
Add a `CNAME` file containing your domain (e.g. `wildolive.studio`) and point your DNS at GitHub Pages. See [GitHub's custom domain docs](https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site).

---

## 🛠️ Local development

No build step, no dependencies. Just open `index.html` in a browser, or serve
it locally for nicer routing:

```bash
# Python 3
python3 -m http.server 8000
# then visit http://localhost:8000
```

---

## 🎮 Adding a new game

When you ship (or announce) a game, drop a new card into the games grid in
`index.html`. Copy an existing `<article class="game-card">` block and update:

- `--accent` / `--accent2` CSS variables on the element for its color theme
- the cover `emoji`, the `badge` (e.g. _Released_, _Demo available_), tags, title, and description
- the link `href`s to point at the game's itch.io / Steam / store page

The "coming soon" ghost card can stay at the end of the grid.

---

## 🌱 Roadmap ideas

- [ ] Dedicated press kit page (`/presskit`)
- [ ] Individual game detail pages with screenshots & trailers
- [ ] Embed real gameplay trailers once available
- [ ] Wire the newsletter form to a real provider (Buttondown, Mailchimp, etc.)
- [ ] Blog / devlog section

---

## 📄 License

The site code is free to reuse and adapt. **Wild Olive Studios** branding,
name, logo, and game concepts are © Wild Olive Studios.

---

Made with 🫒 &amp; imagination.
