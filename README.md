# Study Valley

A pixel-art study tracker. Log study time per module, earn gold and XP, and spend them on seeds, pots and decor for a garden that grows as you study. Works on desktop, iPhone and Android as an installable PWA, with data synced through Supabase.

## One-time setup

1. **Database:** in Supabase open SQL Editor, paste [supabase/schema.sql](supabase/schema.sql) and click Run.
2. **Keys:** copy `.env.example` to `.env.local` and fill in your Supabase project URL and *publishable* key. Never use the secret key.
3. **Auth redirect URLs:** Supabase → Authentication → URL Configuration. Add `http://localhost:5173` and, later, your live site URL to Site URL / Redirect URLs.
4. **Optional Google login:** Authentication → Providers → Google (Client ID and Secret from Google Cloud; callback `https://<project-ref>.supabase.co/auth/v1/callback`).

## Run

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # production build in dist/
```

`http://localhost:5173/?demo` (dev only) skips login and sync so you can try the game offline.

## Put it on your phone

Deploy `dist/` to Vercel or Netlify (set the two `VITE_SUPABASE_*` environment variables there), add the live URL to the Supabase redirect list (and the Google client's JavaScript origins), then:

- **iPhone:** open the URL in Safari → Share → Add to Home Screen.
- **Android:** open it in Chrome → menu → Install app.

## Features

- **Study:** modules with weekly goals and any number of exams, tests or quizzes each, a free or focus timer (25/50/90 min), manual logging at half rewards, and timed breaks (20-45 min) that pay half the gold, XP and plant growth. Breaks stay out of study stats and earn for up to 2 hours a day. A dashboard on the Study tab shows time studied today, this week or ever, split by module, plus the last 7 days. "Recent sessions" opens into a full history, grouped by day and filterable by module. Turn on notifications to get pinged when a focus session or break ends (the app has to still be running; on iPhone, install it to the Home Screen first).
- **Economy:** gold, XP and levels, gems, streak multipliers, and lucky drops after sessions.
- **Garden:** five zones (Meadow, Mossy Grove, Greenhouse, Crystal Cave, Sky Garden) and a day/night cycle. Every tile has a plant plot, four small decor corners, a centre and a floor, so plants and decor mix. Plants and decor can be moved (or swapped) between tiles and gardens. Animals live in a garden and roam all of it, chosen from the Animals list rather than placed on a tile. On desktop the tile menu sits beside the garden.
- **Character:** skin, 21 hairstyles you can also mix yourself (cut, fringe, length, extras), any hair colour with optional dyed tips, plus hats and outfits from the Style shop. Your character walks around the garden.
- **Quests:** daily quests and a chest, a weekly boss fought with your study minutes, an exam/test raid for each one with a daily pace target, and weekly module goals.
- **Journal:** per-module stats (total time, sessions, averages, last 8 weeks, exam progress), 20 achievements that unlock wearable titles, a heatmap, a collection book, and backup and restore.

## How it works

- `src/game/calc.ts`: all rules (XP, levels, streaks, plant growth, quests).
- `src/game/store.ts`: state and actions. Everything is saved locally first, then merged with Supabase (`sync.ts`), so it works offline.
- `src/game/sprites.ts`: the pixel-art engine. It slices the sprite sheets, recolours the character with the chosen skin, hair and outfit, and hand-paints the pots, lantern, bench, fairy lights, pond, fence and magic flowers.

## Art credits

Pixel art from [CraftPix.net](https://craftpix.net) free packs (Main Character's Home, Plants for Farm, Base 4-Direction Female Character, Forest Objects, Rocks and Stones, Farm Animals, Hunt Animals, Path and Road), used under the CraftPix free licence. The source zips live in `assets-src/` (git-ignored, because the licence doesn't allow redistributing the raw files). `node scripts/import-assets.mjs` copies the sheets the game uses into `public/sprites/`. Keep the repository private if it includes `public/sprites/`.
- Balance, plants, pots and decor live in `src/game/data.ts`.
