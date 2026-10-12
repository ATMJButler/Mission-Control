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

## Upcoming shared draft editing

The member Meals view defaults to a populated upcoming draft when one exists,
with an Approved week / Next week draft selector. The same edit gate covers
`edit_draft_meals` and `edit_draft_groceries`. These operations edit only an
existing draft with a valid week later than the approved week. They cannot create
or approve a plan. Projection exposes meal, prep and grocery fields only.

Both weeks use the same record version and lock, including principal saves.
Draft edits preserve the approved plan, draft settings, history and rules.
Switching weeks prompts before discarding an editor; a changed shared week
cannot be reconciled into an editor for the old week.

This addition requires updated web code and an updated Apps Script web app
version. Version 87 does not expose or accept member draft edits. Before backend
promotion, the new browser continues displaying the approved week. Automated
coverage is separate from staged and production acceptance of this addition.

## Legacy Meals boundary hardening

The full-record `/api/meals` read/save/approval route is principal-only. Secondary
members edit approved or upcoming meal/grocery fields through the scoped member
API, with the existing member gates and household checks. Extended members do
not receive a full Meals record through the legacy route. Approval remains a
principal operation.

Legacy HTTP and Apps Script writes require a numeric safe-integer
`expectedVersion`. Existing records must match their loaded version under the
shared lock. Explicit zero can initialize a missing record, producing version
one; it conflicts once a record exists. The browser uses zero only after a
successful read confirms an absent record. Missing or malformed versions are
rejected without a Meals write, including queued Dot draft operations. Existing
unversioned callers must supply a verified version rather than retry blindly.

This change requires web deployment and promotion of its new immutable Apps
Script version on the existing deployment. Version 88 is the rollback backend.
The source push also updates Head used by the time-based agent trigger: valid
versioned queue writes continue, while blank/string version fields are rejected
as INVALID. Tests cover both writer orders and queued rejection; live trigger
health and post-release acceptance remain separate checks.

### Recurring snacks and staples

Weekly plans optionally include `snacksList`, separate from meal `groceryList`, with projected `{item, qty, done}` rows. Old plans without this field display an empty section. Principal Save Draft and Approve Week preserve this list. Members use `edit_snacks` / `edit_draft_snacks`; the same role gates, lock, expected-version conflict checks, and readback/review rules apply. Each operation changes only the selected plan's snacks, preserving meals, groceries, other weeks, and private metadata.

Plan Next Week copies snacks from the most recent approved/draft plan containing a list (including an intentionally empty list). Names and quantities carry forward, and bought checkmarks reset when the week changes. Regenerating the same week retains its checkmarks. Existing future drafts are not silently changed when editing an older approved week.

Release requires website deployment plus promotion of the newly created Apps Script version on the existing web-app deployment. Before promotion, new member snack writes will be rejected by the old backend; no existing data needs a migration. Verify one snack save/readback from each role after promotion, then a future-week carry-forward in isolated data. Automated contract tests do not substitute for live deployment verification.

### Living shared plans and app switching

The principal screen now exposes Save changes rather than Save Draft / Approve Week. Saved working plans are directly available to members, including a working plan for the same week as the legacy approved snapshot. Storage retains the existing draft/approved fields and compatibility approval operation; no migration or implicit approval write is required. New planning weeks remain separate from earlier snapshots. Member week labels use Shared planning week / Earlier week, and identical-week snapshots do not create duplicate choices.

Returning from another app uses the existing throttled access check rather than forcing a check every visibility event. A verified frame stays mounted through transport failures and server 5xx responses, with a nonblocking connection notice. Member transport uncertainty retains the active view, scroll, and local inputs while pausing Save. Same-version recovery re-enables Save without replacing inputs; changed versions require the existing explicit comparison. Authentication/role denial, including malformed 401/403 bodies, still removes private content. Checks have timeouts and APIs continue to authorize all reads and writes. A browser discarding a tab is distinct from an app-initiated refresh; no persisted unsaved member drafts are introduced here.

### Dinner on Agenda and My schedule

Inventory controls are removed from the principal Meals screen and conflict comparison. Historical inventory values remain in stored plans for compatibility, but the planner no longer scores meals or omits groceries using those values.

Principal Agenda and member My schedule show a read-only Dinner tonight card with the matching calendar date, shared meal, and optional prep note. A matching saved working-plan entry wins over the older snapshot; a future plan cannot replace today’s meal. Date matching uses America/Chicago for the household Agenda and the member's configured timezone for My schedule, with a Chicago fallback. This is shared household information; the card does not require a connected personal calendar.

Principal Agenda reads confirmed Meals separately from editable local meal state, so background dinner refreshes do not overwrite unsaved Meals changes. The card updates when shared content changes and refreshes its snapshot on Agenda Refresh and periodic visible Agenda checks. Member date changes invalidate the schedule's cached dinner view. Existing API authorization and sign-out/account-switch protections still apply. This is a website-only release; no Apps Script source changes or data migration.

### Groceries ordered

Both screens offer Groceries ordered with an explicit confirmation naming the selected week. The operation clears that plan's meal grocery list and resets snacks/staples bought flags, keeping item names, quantities, meals, other weeks, and private metadata. It does not advance the meal week or automatically generate another plan.

`order_groceries` / `order_draft_groceries` accept only empty rows and the loaded expected version. The backend applies both changes under the existing shared lock and records `groceriesOrderedVersion` on the selected plan. Readback must show the exact next version, its reset marker, empty groceries, and expected recurring items before success is confirmed. A lost acknowledgement can be reconciled without resending; an unrelated newer save cannot masquerade as a reset. Members use the existing comparison/retry flow on uncertainty. Principal reset preserves local unsaved meal/prep values, and uncertain reset blocks blind retry through shared-plan review.

This extends the dinner/Inventory website changes with a backend operation. After merge, promote the new Apps Script version on the existing deployment before live reset testing. Test only disposable shopping data, then verify both accounts see the same cleared groceries and unchanged recurring quantities. Existing editing actions remain supported during rollout; old backends reject the new operation safely.
