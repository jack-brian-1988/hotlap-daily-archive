# Hotlap Daily â€” Race Archive

An English community archive for Hotlap Daily, ready to deploy on Vercel. Explore all-time points, wins, streaks, complete daily classifications and TrueSkill ratings and driver profiles.

## Features

- Reads the external Google Sheet once when a page is opened or reloaded; no browser polling or scheduled synchronization.
- All-time rankings and inclusive UTC date filters, with Last 7 Days, This Month and This Year shortcuts.
- Collapsible custom dates and English month names regardless of browser language.
- A race calendar, record book, searchable standings and driver dossiers.
- Responsive layout, pixel-style typography and a persistent dark-mode switch.

## Deploy to Vercel

1. Import this repository at [Vercel New Project](https://vercel.com/new).
2. Keep the repository root as the Root Directory. The included `vercel.json` selects **Other**, builds with `npm run build` and publishes `dist`.
3. Add the environment variable **`GOOGLE_SHEETS_ID`**. Its value is the ID between `/d/` and `/edit` in your Google Sheet URL. Add it to Production and Preview as needed.
4. Deploy. No database, Google API key or scheduled job is required.

The spreadsheet must be readable by anyone with its link. The identifier is used only by the server and is not included in the browser bundle. The site does not edit the spreadsheet or change its sharing permissions. Do not put the variable in client-side code.

The deployment has a public visitor-facing UI and does not depend on ChatGPT sign-in or Sites hosting.

## Run locally

Requires Node.js 22. Install the pinned runtime dependencies with `npm ci`. TrueSkill history uses ts-trueskill, a validated port of the Python model.

```sh
cp .env.example .env.local
# Set GOOGLE_SHEETS_ID in .env.local.
npm ci
npm run build
npm run dev
```

Open [localhost:4174](http://localhost:4174). For development after changing assets, run `npm run build` and restart the preview server.

```sh
npm test
```

## Source data contract

The existing Google workbook is the data source, with seven header rows followed by records:

| Tab | Sheet ID | Columns used |
| --- | --- | --- |
| Points | 801946561 | A:P â€” rank, driver, points, wins, entries, P1â€“P10 counts and key |
| Wins | 1479199503 | A:H â€” rank, driver, wins, streak, streak dates, points and entries |
| Calendar | 2076106737 | A:F â€” UTC date, participant count, winner, winning lap, winner key and streak |
| Daily Top 10 | 816613409 | A:G â€” UTC date, position, driver, lap, points, lap ID and key |

Calendar A5 contains the source update date (`Updated: YYYY-MM-DD`). Wins A3 states the driver-name count. Dates are formatted as `DD/MM/YYYY` in the Sheet. The server validates cross-tab point totals, wins, daily positions and driver counts before displaying a response.

The browser requests `/data.json`, rewritten by Vercel to the Node function at `/api/data`. Concurrent source reads share a promise, and successful results are reused in memory for at most 30 seconds per warm function instance. Google can also cache its exports. If a refresh fails, a warm instance marks its last successful data as stale; a cold instance returns a temporary error. No built-in historical snapshot is served.

Partial-period standings include top-ten finishers only, to preserve the existing period-scoring convention; complete participation is now available separately in Race Calendar. In that view, entries mean unique dates with a scoring result. All Time uses the source's complete participation totals. Historical point allocations and positions remain unchanged, including multiple stored finishes attributed to the same merged driver on one date. Streaks are clipped to the selected dates.

## Credits

Inspired by [Hotlap Daily](https://www.hotlapdaily.com). The car image comes from the [original repository](https://github.com/metapodder/hotlapdaily/blob/main/public/F1-car-8bit.png). The original MIT license notice is retained in `LICENSE`.

This is a community statistics project, not the original game server. It reads the externally stored history and does not call or modify the game's API.



## TrueSkill and full race calendar

The third navigation tab is TrueSkill. Ratings are read from the original workbook's Full Ratings tab (gid 924913483). The server uses unrounded numeric values from Google Visualization, not rounded display strings. Ranking uses Î¼ âˆ’ 3Ïƒ. Active ranking requires at least ten recorded races and fewer than 30 complete UTC days since the last recorded race. Inactive and provisional drivers keep their ratings and are available in separate views. Activity is recalculated on page open; stored activity/rank columns are ignored. Missing days do not reduce rating. Names are not authenticated account IDs.

Full Results (gid 1751763858) stores every accepted daily classification: ISO UTC date, API position, raw driver name, best valid lap seconds, race ID, normalized name. Its first row is a header. `/api/race?date=YYYY-MM-DD` queries only the selected date from the stored sheet. The calendar supports search and pagination across the full field, without calling the game API. Keep the separate `daily` top-ten data used for points to preserve historical point conventions.

`/trueskill.json` is rewritten to `/api/trueskill`. Both new functions support GET/HEAD, validate source responses, coalesce concurrent reads and cache for 30 seconds per warm instance with bounded cache entries. Source failures produce explicit errors. Optional server variables `FULL_RESULTS_SHEET_GID` and `FULL_RATINGS_SHEET_GID` override the defaults when copying the workbook. The spreadsheet ID stays server-side in `GOOGLE_SHEETS_ID`.

The workbook must continue to be populated by its separate import process. These read-only website endpoints do not fetch new game results or recalculate ratings. The initial full-field import covers completed races through 2026-11-03; stale rating coverage is shown to visitors. Updating the older four tabs alone does not update Full Results or Full Ratings.

## Driver TrueSkill history

Every driver profile loads `/api/trueskill-history?driver=...` on demand. The server reads Full Results and Full Ratings from the existing configured workbook. It replays completed full-field races chronologically with the same parameters as the cloud updater, including the confirmed Hoozah alias merge, and validates every final rating, appearance count and first/last date against Full Ratings. Inconsistent or partially updated snapshots return 503 rather than an invented curve. No calls to the game API or spreadsheet writes are made.

Concurrent histories share a replay; a validated replay is cached for up to five minutes per warm function and invalidated when the saved ratings change. Only the requested driver's history is sent to the browser. A cold request can take several seconds. Each point represents the rating after one recorded race. The step line preserves the rating between appearances; inactivity adds no numerical penalty. Search, status and Standings date filters do not truncate the chart. The slider provides keyboard and touch exploration.

The TypeScript port is checked against the existing Python 0.4.5 full-history experiment. `mathjs` is pinned via override to its patched 15.2.0 version; this model does not use its expression parser.
