# Staging member Meals evidence — October 5–6, 2026 (America/Chicago)

Evidence: owner-provided authenticated browser screenshots, exported XLSX state,
and staging editor execution logs. These are not independently driven authenticated
browser tests by Codex. No claim of production acceptance or Julie commissioning.

Staging source before browser fixes: `decad1fd8ed30fadc7fa884ff4e868e35cf5e574`.
Canonical backend digest: `5c57e35a2fbf7ecd6864ff4fd1592abe0f879b0813271edbac1809a7b61170e4`.
UI isolation fix: PR #14, merge `8ac8b613cdd9e8c09c71b58c4d71a04a38fa6d06`.
Owner confirmed fixed UI in staging. Later helper: PR #15, manually installed
and executed after automated source upload failed. No Web App promotion required
for editor execution; helper execution does not verify a newer Web App artifact.

| Test | Observed | Persisted readback | Evidence / limits |
| --- | --- | --- | --- |
| Initial source agreement | Both reported SHA decad1f | Empty staging Project tables; one user/membership | Authenticated diagnostic export; numeric Apps Script version unverified |
| Principal-only diagnostics | Secondary denied | No report returned | Browser screenshot; no Julie identity |
| Read-only Meals | Seven synthetic meals, apples quantity 2 | Initial exported baseline version 7 | Synthetic fixture only |
| Grocery edit | Apples quantity 3, bought true | Version 7→8; physical row 4 updated | Two tabs in XLSX; blank row/neighbor/draft/history/rules/recipes/notes preserved |
| Meal edit | First meal became TEST Soup | Version 8→9; first recipe removed | Comparing successive XLSX exports; other tabs and fields unchanged |
| Stale version | HTTP 409 MEMBER_MEALS_CONFLICT for expectedVersion 8 | Version remained 9; content preserved | Browser result + sheet screenshot |
| Same-version contention | Concurrent qty 4/5 at expectedVersion 9: one 409, one 200 | Version 10; winner qty 5, bought true | Browser responses + physical row screenshot; not lock timing telemetry |
| Revoke active session | Workspace closed; write returned 403 MEMBERSHIP_INACTIVE_OR_MISSING | Version 10 / qty 5 unchanged | Owner screenshot and confirmation |
| Restore membership | Access returned | Same approved Meals | Owner confirmation; no new authorized save during this checkpoint |
| Missing foreign household | 403 HOUSEHOLD_INACTIVE_OR_MISSING | Neighbor v9 and target v10 unchanged | Distinct from active-household membership denial |
| Active foreign household | Helper created active neighbor, zero memberships; browser returned 403 MEMBERSHIP_INACTIVE_OR_MISSING | Neighbor v9 and target v10 unchanged | Helper fingerprint check + browser/sheet screenshots; request denied at directory boundary, not backend target-ownership test |
| UI isolation | No Transactions/Clarify dialogs; single sign-out | Read-only groceries unchanged | Owner confirmation; automated offline desktop/mobile regression checks |

The temporary empty-plan screen was explained by the owner as incorrect sheet
names and resolved. Do not classify it as a transport or mutation fault injection.
No real provider subject, email, token, service secret or invitation token is
included here. The synthetic `butler-household` ID exists in a separate staging sheet.

## Remaining evidence

- Live invalid-patch/authority rejection and physical readback.
- Independent dashboard/edit gate isolation, in staging only.
- Target ambiguity / duplicate IDs and independent backend ownership rejection.
- Grocery add/remove and restored-membership authorized write.
- Controlled response loss/reconciliation UI; real backend flush faults only if safely inducible.
- Shared legacy/member writer overlap using a carefully separated disposable setup;
  legacy Meals reads physical row 2, so do not use it against the current layout.
- Anonymous/extended-role runtime checks, full final export and reviewed retention.
- Real Julie invitation/secondary acceptance, production Clerk rotation, provider
  connections and final production member-gate policy.

`staging/check-member-rejections.js` batches six deliberately invalid requests.
It requires a signed-in staging session, reads back projected Meals after every
request, and stops on any unexpected response or changed content. It does not
handle tokens, bypass auth, change gates or prove physical-row preservation.
Finish with another XLSX comparison. All write outcomes still require reconciliation;
never automatically retry an uncertain request.

## Subsequent authenticated staging checkpoints

Owner browser screenshots and the latest XLSX establish:

| Test | Observed | Readback / limits |
| --- | --- | --- |
| Six invalid requests | Blank grocery name, numeric quantity, string bought flag, extra row authority, top-level actor, impossible calendar date each returned 400 MEMBER_SETUP_INVALID | Projected Meals identical at v10 after every attempt; later XLSX preserves blank/neighbor rows, meal plan, draft/history/rules/notes and baseline. No physical XLSX immediately before batch; previous export v9 plus contention screenshots anchor expected v10. |
| Backend edit gate disabled, Vercel edit gate enabled | 503 MEMBER_MEALS_DISABLED | Owner sheet screenshot v10 / apples 5 / bought |
| Vercel edit gate disabled, backend edit gate enabled | 503 MEMBER_MEALS_DISABLED | Same persisted state; an earlier DNS-resolution failure is excluded from gate evidence |
| Backend dashboard gate disabled, Vercel dashboard gate enabled | 503 MEMBER_DASHBOARD_DISABLED | UI removed shared data |
| Vercel dashboard gate disabled, backend dashboard gate enabled | 503 MEMBER_DASHBOARD_DISABLED | API denial; subsequent dashboard-gate restoration confirmed by owner |
| Restore read-only viewing | TEST Soup and apples 5 / bought returned; editing remained off | Owner confirmation; production settings unchanged by this staging exercise |

Gate isolation claims rely on owner-reported staging setting changes together
with observed API behavior; no connector independently read Vercel environment
configuration. Dashboard read denials do not establish dashboard-off write
rejection while both edit gates are enabled; that remains a distinct test.

The completed invalid-request and gate-read/edit cases supersede their pending
entries above. Remaining acceptance work and production/Julie boundaries still
apply. `staging/check-readonly-member.js` captures one read-only secondary checkpoint
and verifies principal diagnostics and legacy data denial without printing payloads,
identities or tokens. It does not modify fixtures, memberships or gates.

## Read-only checkpoint and next simulated fault check

Owner screenshots at `2026-10-06T21:44:04.906Z` show all four checks passing:
secondary workspace 200, read-only member Meals 200 at version 10, principal
diagnostics 403, and legacy principal data 403. Commissioning and Julie readiness
remain false. Vercel edit gate remains disabled; both dashboard gates are enabled.

`staging/arm-response-loss.js` prepares a one-shot client simulation. After the
owner enables **staging** `MC_MEMBER_MEALS_EDIT=enabled` and redeploys, open the
member dashboard and paste that file into the browser Console. It verifies an
editable version-10 fixture, then arms for two minutes. In the normal grocery
editor change TEST apples quantity 5 to 6, keep bought checked, and Save once.
The helper discards only a successful version 10→11 response and restores fetch
before the UI readback. It sends no mutation itself and never retries a write.

Expected evidence: the UI reconciles through readback and displays quantity 6
at version 11; physical Meals row 4 agrees, with other fields and neighbor row
preserved. This runtime check subsequently passed as recorded below. Automated mocked tests verify the
helper's guards, one-shot behavior, expiry and rejection passthrough. This is a
client-discarded response simulation, not evidence of a real network outage or
backend flush failure. Disable the staging edit gate after collecting evidence.

## Completed client response-loss reconciliation

The owner first observed editable capability false at version 10; the helper
refused arming without writing. After both staging edit gates were enabled,
the read-only preflight reported capability true and version 10. The owner
armed the helper and saved the normal grocery editor once. Console evidence
confirmed that a successful version 10→11 response was deliberately discarded.
The owner confirmed the editor closed and the dashboard displayed six apples.

The physical sheet screenshot confirms row G4 version 11, TEST apples quantity
"6", bought true, and updatedAt `2026-10-06T21:56:22.919Z`. TEST Soup, the other
six meals, draft/history/rules sentinels, blank row 3, neighbor version 9 and
visible notes remain preserved. This is screenshot-based comparison, not a
full exported-workbook comparison or network request-count trace. The outcome
also demonstrates an authorized write after membership restoration. No real
transport outage or backend flush fault was injected.

The owner subsequently disabled staging Vercel `MC_MEMBER_MEALS_EDIT` and
redeployed. This configuration restoration is owner-reported; a fresh read-only
API checkpoint remains pending. Julie activation and production acceptance
remain on hold.

Next grocery add/remove acceptance, when staging editing is deliberately enabled:
use the normal UI to add TEST bananas (quantity "1", bought false) while preserving
apples (quantity "6", bought true). Save once: expected version 11→12. Confirm
dashboard and physical row before continuing. Then remove only TEST bananas and
save once: expected version 12→13. Confirm apples and all unrelated fields remain
preserved, then return staging to read-only. Any unexpected version, failure or
uncertain response requires readback and review before another write. This test
is pending and must not be run while the edit gate is disabled.

## Completed grocery add/remove acceptance

Owner dashboard and physical-sheet screenshots confirm two normal editor saves:

- Add: version 11→12, TEST apples quantity "6" / bought true preserved;
  new item **Test Banana**, quantity "2", bought false. The chosen name/quantity
  differ from the example instructions and remain valid input. Physical timestamp
  `2026-10-06T22:02:53.889Z`.
- Remove: version 12→13, only Test Banana removed; TEST apples quantity "6" /
  bought true preserved. Physical timestamp `2026-10-06T22:04:58.607Z`.

Both physical screenshots show the meal plan, draft/history/rules sentinels,
neighbor version 9, blank row and visible notes preserved. These are owner-driven
live UI saves with screenshot readback, not a full workbook export comparison.
The owner subsequently confirmed redeployment after the instruction to disable
staging Vercel `MC_MEMBER_MEALS_EDIT`. Fresh API verification of read-only status
at version 13 remains pending.

The response-loss, restored-member write, and grocery add/remove cases supersede
their pending entries above. Remaining work includes duplicate physical target
ambiguity, independent backend ownership rejection, dashboard-off write rejection
with edit gates enabled, anonymous/extended runtime checks and final workbook
export comparison. Backend faults and legacy overlap need a separate safe test
venue. None of this establishes production acceptance or Julie readiness.
