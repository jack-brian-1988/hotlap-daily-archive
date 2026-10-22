# Hotlap Daily — Race Archive

An English community archive for Hotlap Daily, ready to deploy on Vercel. Explore all-time points, wins, streaks, daily top-ten classifications and driver profiles.

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

Requires Node.js 22. There are no third-party runtime or build dependencies.

```sh
cp .env.example .env.local
# Set GOOGLE_SHEETS_ID in .env.local.
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
| Points | 801946561 | A:P — rank, driver, points, wins, entries, P1–P10 counts and key |
| Wins | 1479199503 | A:H — rank, driver, wins, streak, streak dates, points and entries |
| Calendar | 2076106737 | A:F — UTC date, participant count, winner, winning lap, winner key and streak |
| Daily Top 10 | 816613409 | A:G — UTC date, position, driver, lap, points, lap ID and key |

Calendar A5 contains the source update date (`Updated: YYYY-MM-DD`). Wins A3 states the driver-name count. Dates are formatted as `DD/MM/YYYY` in the Sheet. The server validates cross-tab point totals, wins, daily positions and driver counts before displaying a response.

The browser requests `/data.json`, rewritten by Vercel to the Node function at `/api/data`. Concurrent source reads share a promise, and successful results are reused in memory for at most 30 seconds per warm function instance. Google can also cache its exports. If a refresh fails, a warm instance marks its last successful data as stale; a cold instance returns a temporary error. No built-in historical snapshot is served.

Partial-period standings include top-ten finishers only, because individual participation outside the top ten is not present in the date-level exports. In that view, entries mean unique dates with a scoring result. All Time uses the source's complete participation totals. Historical point allocations and positions remain unchanged, including multiple stored finishes attributed to the same merged driver on one date. Streaks are clipped to the selected dates.

## Credits

Inspired by [Hotlap Daily](https://www.hotlapdaily.com). The car image comes from the [original repository](https://github.com/metapodder/hotlapdaily/blob/main/public/F1-car-8bit.png). The original MIT license notice is retained in `LICENSE`.

This is a community statistics project, not the original game server. It reads the externally stored history and does not call or modify the game's API.
