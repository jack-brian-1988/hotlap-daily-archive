# Hotlap Daily — controlled cutover

The private schedule runs at 00:15 UTC with Vercel's 15-minute jitter window.
No write occurs unless the deployment is Production, Vercel delivered the
named schedule event, the hour is 00 UTC, and the production-only environment
variable `HOTLAP_UPDATE_ENABLED` is exactly `true`.

1. Stage this branch with `vercel deploy --prod --skip-domain` while the
   enable variable is absent. Never promote the separate auth-probe deployment.
2. Verify the staged branch's authenticated dry-run, and verify that the
   scheduled function has no public route and the public domain has not moved.
3. Plan a supervised cutover. Ensure the old task is not running before
   letting Vercel write. Set the enable variable for Production only and deploy
   the reviewed branch. Inspect the project schedule and deployment, then
   verify the first completed daily write against the original workbook.
   Keep the old task as a fallback, but never run two writers simultaneously.
4. If Vercel fails before beginning a write, disable its schedule before
   restarting the old task. If a lock or an `updating` checkpoint exists,
   stop both writers until the affected rows and notes are reconciled.

The first write batch claims an atomic metadata lock and a distinct daily
marker. The marker prevents a stale duplicate from writing after the lock
is released. The first batch also records pending checkpoints; a separate
batch sorts complete rankings only after the formulas have recalculated.
Readback checks then precede the final checkpoint and lock release.

A failed post-write verification intentionally leaves the lock and pending
notes for manual recovery. Do not clear them and retry blindly. Review the
lock's prior and proposed dates and totals against Calendar, Daily Top 10,
Points, Wins, Full Results and Full Ratings before resuming. Schedule runs
are incremental: a gap with intact checkpoints is caught up on a future run.
