# 💾 personal-site

Playful Y2K personal site: landing, projects, wishlist (with auto-scraping + claim-bought feature), apartment moodboard, CV, socials.

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
2. In **SQL Editor**, paste `supabase/schema.sql` and run it.
3. In **Settings → API**, grab:
   - `Project URL` → `NEXT_PUBLIC_SUPABASE_URL`
   - `anon public` key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role` key → `SUPABASE_SERVICE_ROLE_KEY` (keep secret!)
4. Make up a long random string for `WISHLIST_ADMIN_KEY`. You type this whenever you add a wishlist item — it stops randos from adding to your list.

## deploy to vercel

1. Push to GitHub.
2. Import the repo on Vercel.
3. Add the four env vars from `.env.local` to the Vercel project settings.
4. Deploy. Done.

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
