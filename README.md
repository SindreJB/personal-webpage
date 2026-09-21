# 💾 personal-site

Playful Y2K personal site: landing, projects, wishlist (with auto-scraping + claim-bought feature), *krystallkulen* (Fantasy Premier League decision support), apartment moodboard, CV, socials.

**Stack:** Next.js 15 (App Router) · TypeScript · Tailwind · Supabase · Vercel

---

## quickstart

```bash
pnpm install     # or npm/yarn
cp .env.local.example .env.local   # then fill in the values
pnpm dev
```

## supabase setup (5 min)

1. Create a project at [supabase.com](https://supabase.com).
2. In **SQL Editor**, paste `supabase/schema.sql` and run it. For `/fpl`, also run `supabase/fpl_schema.sql` (optional — the page works without it, it just can't grade its own forecasts afterwards).
3. In **Settings → API**, grab:
   - `Project URL` → `NEXT_PUBLIC_SUPABASE_URL`
   - `anon public` key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role` key → `SUPABASE_SERVICE_ROLE_KEY` (keep secret!)
4. Make up a long random string for `WISHLIST_ADMIN_KEY`. You type this whenever you add a wishlist item — it stops randos from adding to your list.

## deploy to vercel

1. Push to GitHub.
2. Import the repo on Vercel.
3. Add the env vars from `.env.local` to the Vercel project settings.
4. Deploy. `vercel.json` registers two daily cron runs against `/api/fpl/snapshot`; set `CRON_SECRET` in the project so they authenticate.

---

## how the wishlist works

**Adding items** (you only):
- Open `/wishlist`, click `＋ add item`, paste a product URL, enter your `WISHLIST_ADMIN_KEY`.
- Server fetches the page and parses OG/Twitter/JSON-LD tags for title, image, price, currency.
- Category is inferred from keywords; you can override before submitting.

**Visitors claiming items**:
- Anyone can hit `I'll get this →`, type their name, confirm.
- One claim per item (DB unique constraint) — duplicates are blocked at the source.
- Cards turn grayscale + show "claimed by X".

**Filters** (live, client-side):
- search · category · status (available/claimed) · max price · sort

## tweaking

- **Category list / keywords:** `src/lib/scrape.ts` → `CATEGORY_KEYWORDS`.
- **Aesthetic palette:** `tailwind.config.ts` → `colors`.
- **Marquee text, landing tiles:** `src/app/page.tsx`.
- **Multiple claims per item?** Drop the `unique (item_id)` line in `schema.sql`.

## known limits

- Some retailers (Amazon, big ones) block server-side fetches or return empty pages. Manual override is fallback: just edit the row in Supabase directly, or extend the form to allow manual entry.
- The scraper has an 8s ceiling to stay under Vercel's function timeout.

---

## how krystallkulen (`/fpl`) works

Paste an FPL team ID or any FPL URL containing one into `/fpl?lag=…`. Everything is read live from the
official (undocumented, unguaranteed) FPL API — no login, no stored team.

**The pipeline**, all under `src/lib/fpl/`:

| file | job |
|---|---|
| `api.ts` | fetch adapter: timeouts, one retry, per-endpoint `revalidate`, URL → entry-id parsing |
| `fixtures.ts` | team strength from season xG → expected goals per fixture; blanks and doubles |
| `projection.ts` | minutes model, per-90 rates, Poisson clean sheets/DefCon → expected points per gameweek |
| `squad.ts` | best XI over every legal formation, captain, bench order, selling prices |
| `transfers.ts` | single and greedy double transfer search, scored on the starting XI over the horizon |
| `review.ts` | post-gameweek: actual vs. forecast, bench regret, captaincy cost |
| `store.ts` | optional Supabase snapshots so forecasts can be graded later |

**Two things worth knowing about the data:**

- FPL stopped populating `strength_attack_*` / `strength_defence_*` — every team reads `0`. Team strength is
  therefore derived from season xG (players' `expected_goals` for attack, goalkeepers' `expected_goals_conceded`
  for defence), regressed toward the league mean and nudged by the per-fixture FDR.
- FPL *does* publish `price_change_projections` with a −5…5 likelihood per player. Krystallkulen passes that
  through as a risk level rather than inventing a percentage it hasn't backtested.

**Grading the model.** The FPL API only shows *now*. Unless a forecast is frozen before the deadline, there is no
way to reconstruct afterwards what the model believed. That's what `/api/fpl/snapshot` is for — call it with
`?key=$FPL_CRON_KEY` (or let Vercel Cron send `CRON_SECRET`). It always writes a price/ownership snapshot, and
if `FPL_ENTRY_ID` is set it also freezes that team's projections. The "Etter runden" tab then shows expected vs.
actual per player; without the snapshot it says so plainly instead of inventing a comparison.

**Tuning.** Horizon length is `DEFAULT_HORIZON` in `entry.ts`. The hold/hit thresholds and the gameweek decay are
constants at the top of `transfers.ts`. Position priors and the regression weight live at the top of
`projection.ts`.
