# Calendar independent review remediation

Reviewed baseline: `857db7f15b27a2fbd09fc07080d8c8c83eef8055`.
Both independent reviews identified the stale calendar-selection race and CI
coverage gaps. One independently reproduced unsaved-choice loss. The other
highlighted external refresh-token concurrency and shared clasp credentials.

| Finding | Source remediation | Evidence / remaining work |
| --- | --- | --- |
| Selection overwrites newer intent/account | Selection passes the exact checked snapshot into readiness/refresh. CAS never adopts an unrelated newer record. | Deterministic selection/selection and selection/reconnect regressions |
| Rotating refresh token races | Durable encrypted refresh-pending CAS claim before external exchange; completion CAS against claim; uncertain/crashed claims require reconnect | Concurrent rotating-token and unknown-claim regressions; real provider acceptance pending |
| UI-only changes skip tests | Auth/Chromium workflow runs on every PR and main push | Static workflow regression; real UI-only PR verifies dispatch |
| Unsaved chooser loss | Background membership revalidation preserves chooser DOM/draft, blocks stale saves, clears on access/account loss | Timer/visibility browser checks on desktop and phone |
| Mobile coverage | Phone viewport/touch context plus overflow, label tap size, focus and existing privacy/recovery checks | Synthetic Chromium only; real devices/assistive technology pending |
| Shared clasp credentials | Staging workflow requires STAGING_CLASPRC_JSON and staging-apps-script Environment; no production credential fallback; fixed target guard | Separate staging-only Google credential still must be supplied; actual IAM/Environment protections must be verified |
| Key loss prevents disconnect | Owner status/recovery and CAS disconnect no longer require decrypting ciphertext | Key-loss regression; recovery/rotation procedure documented |
| Provider invalid_grant hides recovery | Known token rejection codes map to reconnect-required | Provider-adapter regression; live consent revocation pending |
| Contradictory onboarding docs | Current capability matrix with explicitly superseded historical archive | Current operational calendar contract is docs/personal-connections.md |

This work does not configure OAuth, promote Apps Script, activate gates or invite
Julie. Six personal OAuth/encryption bindings and live provider consent remain
missing. Staging deployment must not be restored using production's shared clasp
credential. Supply a dedicated staging-only Google identity credential securely,
configure GitHub Environment protections for main and owner review, and verify
that identity has no production Apps Script access before a staging release.

Further acceptance gaps from the reviews remain tracked: formula-bearing Meals
cells (current fixtures do not establish their preservation), installed
production trigger behavior under source updates, actual IAM/repository approval
settings, outstanding Meals fault/ownership/role tests, and real provider
recurrence/DST/pagination/revoke/refresh behavior. These are not closed by mock
or synthetic browser checks. Production/Julie commissioning remains separate.

GitHub Environment creation through the installed integration returned HTTP 403
(Resource not accessible by integration). No protection or credential mutation
succeeded. An owner must create `staging-apps-script`, require reviewer
`ATMJButler`, use custom deployment policies allowing only branch `main`, and
store `STAGING_CLASPRC_JSON` there from a Google identity limited to the staging
script. The workflow verifies these rules before credential use; an automatically
created unprotected Environment is insufficient. Owner self-review is permitted
for this small project's manually dispatched releases; GitHub protection still
requires a deliberate review. Production's existing secret is not a fallback.
