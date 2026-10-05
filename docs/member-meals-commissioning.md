# Member Meals commissioning

Status: source/mock coverage exists; authenticated runtime acceptance is pending.
Version 87 contains the member editing backend. PR #11 changed browser access-denial
cleanup only. An unequal Git SHA does not imply unequal Apps Script content.

## Read-only preflight

Export `/diagnostics.html` while signed in as principal. In a current checkout run:

```sh
git fetch origin main
node scripts/member-readiness.mjs /path/to/mission-control-diagnostics.json
```

The checker verifies the exported backend digest against Git and compares Apps
Script content at the two reported commits. It reports age and both member gates.
It never requests secrets, changes settings, or marks commissioning complete.
A snapshot older than 15 minutes is pending, not current deployment evidence.
Do not publish exports containing additional data from other tools.

## Isolation and approval checkpoint

Recommended runtime venue: a dedicated staging Vercel deployment and separate
Apps Script test project bound to a new synthetic Shared Data sheet. This is a
new **test** Web App, not a replacement production deployment. Do not copy live
Meals, finance, invitation tokens, sync tokens, provider subjects or other users.
Use separate staging service credentials held in environment settings.

John's actual authenticated identity may be provisioned by an authorized human
in the isolated test directory. Give it a secondary membership in a clearly
named test household; no Julie identity is created or impersonated. For the
legacy-writer overlap case, use `butler-household` as the synthetic ID only
inside this isolated sheet, because legacy Meals is pinned to that ID. Label
the household STAGING in its display name; do not reuse production bindings. A secondary
role in staging tests the role boundary but does not commission Julie herself.
Keep production sheet ID, production upstream URL and production service token
out of the staging bindings. Verify these bindings with the owner before any
write. Configure the existing allowed-origin/Clerk authorized-party checks for
that exact staging origin; never bypass them.

Stop for approval of the concrete staging project, sheet, credential bindings
and identity provisioning before external provisioning or runtime writes.
Production gates remain unchanged. Do not toggle production gates for staging
isolation tests. Production Clerk rotation is a separate controlled checkpoint.

Seed one synthetic approved Meals record, a blank interior row and a neighboring
synthetic household record. Follow the canonical eight-column Meals schema;
use unique keys, matching sheet/JSON household, a positive safe integer version,
seven valid approved dates, sample groceries, and recognizable draft/history/
rules/notes sentinels. Use the current canonical source and record its digest.
No existing Butler Meals row is repurposed. Preserve before snapshots locally
under the evidence retention policy; do not commit real household contents.

## Runtime matrix

Record exact artifacts, timestamp, expected result, observed HTTP/result code,
resource before/after, version, neighbor fingerprint, legacy fingerprint and
identity/invitation counts after **every** attempt. Meals uses CAS/readback, not
the Project Operation Audit idempotency model.

| Test | Expected | Evidence required |
| --- | --- | --- |
| Anonymous / extended role | Denied, no mutation | HTTP result and sheet readback |
| Each edit and dashboard gate independently off | No mutation | Four independent staging gate cases and readback |
| Grocery add / change / remove / bought | Only approved groceries change; version +1 each | Exact list, sentinels and neighbor readback |
| Meal/prep edit | Same dates/week; old recipe cleared when meal changes | Approved plan and unrelated fields |
| Invalid types, extra authority, blank names, impossible dates | Rejected, no mutation | Both HTTP and physical sheet readback |
| Stale expectedVersion | Conflict, no mutation | Version and content unchanged |
| Two edits with same version | One success, one conflict; version +1 | Concurrent authenticated requests and persisted result |
| Interior blank row | Correct physical row only | Blank and neighboring rows unchanged |
| Foreign household / duplicate target | Denied, no arbitrary row update | All affected rows read back |
| Legacy/member writer overlap | Shared lock, one version winner | Isolated fixture only; both results and readback |
| Response lost after send | No blind resend; readback before explicit decision | Request count, UI state, persisted version/content |
| Readback unavailable | Save remains blocked | UI and no additional write requests |
| Revoke active staging membership | API denies next request; editor clears on recheck | Same session, denied write/read and no mutation |
| Restore staging membership | Access returns after fresh server check | Authenticated read and authorized disposable edit |
| Mobile, signout, account switch | Readable UI; old responses cannot restore editor | Browser observations and request trace |
| Cleanup | Only disposable records touched | Final fingerprints, counts and retained evidence |

Only induce faults through staging adapters or controlled browser interception.
A browser-aborted response is transport-loss evidence; it does not establish
backend audit/flush-failure behavior. Do not claim an unsafe/unavailable fault
was exercised; record it as mock evidence or NOT_TESTED.

## Exit criteria

Staging success permits a narrowly scoped production commissioning proposal,
not automatic activation. Before Julie's invitation: controlled production
Clerk credential migration, real secondary identity/invitation and revoke/restore
acceptance, reviewed runtime results, and an explicit member-gate policy decision.
Calendar/email OAuth and personal scheduling remain separate unfinished work.
Project-v1 webpage writes remain disconnected. Preserve legacy Projects and
John's current Meals throughout. No unattended configuration or data cleanup.
