# Daily update: read-only validation

This branch adds a planner for all six workbook tabs and a read-only Vercel
function. It does not enable a schedule, write to the workbook, or replace
the existing task. It uses the existing Google Sheets project variable and
production-only Vercel OIDC federation. The Google access token is restricted
to the Sheets read-only scope; neither credentials nor workbook rows are
returned in the HTTP response.

From a separate checkout of this branch, link the existing project and verify
that it is `dcarracedopais/hotlap-daily-archive`:

```powershell
npx --yes vercel@65.14.0 link --scope dcarracedopais --project hotlap-daily-archive --yes
npx --yes vercel@65.14.0 project inspect --non-interactive
npx --yes vercel@65.14.0 deploy --prod --skip-domain
```

Do not omit `--skip-domain` and do not promote this deployment. Report the
new unique deployment URL (not the public domain) so the read-only endpoint
at `/api/update-dry-run` can be tested over the authenticated connection.
The public project alias and Preview do not serve this endpoint.

Expected JSON: `ok: true`, `readOnly: true`, the intended UTC closure,
the three source checkpoints, candidate dates, and aggregate counts.
If yesterday is already closed everywhere, the classification API is not
called. A date already stored in Full Results is reused to plan missing
standings or ratings. An incomplete or interrupted checkpoint is rejected.

Run `npm ci` and `npm test` locally to verify fixtures, pagination, error
handling and the existing public site tests. A separate write path and
verification of its writes are required before enabling Vercel Schedules.
