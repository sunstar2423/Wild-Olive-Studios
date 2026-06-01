# World Cup 2026

A browser football-management sim built around the **real 2026 FIFA World Cup**
— the first 48-team tournament, co-hosted by the USA, Mexico and Canada.

You take charge of one of the 48 qualified nations and try to win the whole
thing: build your team, steer every match, weather the news cycle, and survive
the group stage and a five-round knockout bracket to lift the trophy at MetLife
Stadium on 19 July 2026.

## Gameplay loop

1. **Choose a nation** — all 48 teams from the actual final draw (Groups A–L),
   each with a strength rating. Pick a powerhouse for an easier ride or a
   minnow for a fairy-tale.
2. **Build your team** — pick a formation (4-3-3, 4-4-2, 3-5-2, 5-3-2), select
   your starting XI from a procedurally generated 23-man squad, name a captain,
   and set your tactical approach (Attacking / Balanced / Defensive).
3. **Manage the noise** — a periodic news event fires before every match
   (injuries, press conferences, transfer rumours, heatwaves, players-only
   meetings…). Many give you a decision that swings squad morale and fitness.
4. **Steer the match** — a live, minute-by-minute engine with running
   commentary. You make big-moment calls (one-on-ones, free-kicks, counters,
   penalties), a half-time team talk, up to three substitutions, and can switch
   tactics on the fly. Squad fitness drains during play, so rotation matters in
   later rounds.
5. **Progress** — three group matches, then the top two of each group plus the
   eight best third-placed teams advance to a 32-team knockout bracket:
   Round of 32 → Round of 16 → Quarter-final → Semi-final → Final. Knockout
   ties level after 90 minutes go to extra time and an **interactive penalty
   shootout**.

## Authenticity

- **Groups A–L** match the real 2026 draw.
- **16 host stadiums** are the real venues (Estadio Banorte/Azteca, SoFi, AT&T,
  Mercedes-Benz, MetLife, BMO Field, BC Place, and more).
- The tournament **opens at the Azteca** and the **final is at MetLife Stadium**;
  the semi-finals are staged in Dallas and Atlanta.

## Tech

- Single self-contained `index.html` — vanilla HTML/CSS/JS, no dependencies, no
  build step.
- Styled to match the Wild Olive Studios site (Fraunces + Space Grotesk,
  forest/olive/gold palette).
- Progress auto-saves to `localStorage` (Continue from the title screen).
- Full `prefers-reduced-motion` support; works on touch and desktop.

## Where it lives

- Playable build: `docs/play/world-cup-2026/index.html`
- Live: `https://sunstar2423.github.io/Wild-Olive-Studios/play/world-cup-2026/`
