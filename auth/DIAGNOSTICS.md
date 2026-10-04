# Read-only commissioning diagnostics

Open `/diagnostics.html`, sign in with the existing Clerk account, select the household ID and run checks. Only an active, uniquely resolved principal can retrieve `/api/v1/diagnostics`. POST is used for an origin-checked read request, not a mutation. The only browser field is `householdId`; actor and authority are derived from the verified directory. The private backend independently checks active principal membership under the shared ScriptLock.

The report includes Vercel's deployment-provided full source SHA (or unverified), both independent dispatcher gate booleans, Clerk key modes without key values, Apps Script release stamps, household-scoped resource/identity counts, resource fingerprints, and bounded disposable-fixture version/lifecycle/audit evidence. Legacy Projects is Butler-only because its existing schema lacks a household column; it is not returned for another household. Foreign content, names, emails, provider subjects, invitation token hashes, credentials, spreadsheet/deployment URLs and audit notes/results are omitted.

Diagnostics never creates sheets, repairs headers, initializes resources, refreshes Projects, writes audits or changes gates. Missing/invalid schemas remain missing/invalid. The existing identity-directory resolver may audit an authorization denial, as it already does on protected requests; successful diagnostics does not write anything. Readback takes the shared ScriptLock, but legacy Project writers do not participate in that lock. Counts/fingerprints cannot prove absence of an intervening legacy write or full identity/invitation state equivalence.

## Release identity and evidence limits

`scripts/stage-apps-script.mjs` stamps the full Actions source SHA and SHA-256 of canonical `google_apps_script_Code.gs` into the staged source only. A local/editor copy reports `unversioned`. The canonical file remains the source of truth. The stamps identify the CI release artifact; they are release metadata, not tamper-proof attestation against later manual edits. The historical buildId is retained for compatibility and explicitly labeled legacy.

The workflow records the immutable version plus full source SHA in its summary and a GitHub check annotation so automation can read them without downloading signed log archives. Promotion still requires selecting that version on the existing Web App. Apps Script runtime does not provide its executing immutable version through this reader; `immutableVersion` remains null and `immutableVersionVerified` remains false. A source SHA match is separate evidence from the numeric deployment version and from comparison against current GitHub main.

The report never declares commissioning complete or webpage cutover approved. Counts, schema checks, fingerprints and fixture metadata are read-only runtime evidence; they do not establish real contention, service durability, identity commissioning, replay recovery or any missing cutover gate. Match deployment metadata/source stamps and compare snapshots before performing any separately authorized disposable-fixture mutations.

## Access and retention

This adds no machine credential or Clerk bypass. Codex can inspect CI release metadata independently but cannot call the protected endpoint without a legitimate principal session already available through approved tooling. Do not copy session cookies, bearer tokens, service secrets or OAuth files into chat. The signed-in principal can download the minimized JSON report and upload it for review. Any later unattended read identity is a separate security decision.

The page stores a report only in memory, clears it on session/household changes, ignores late responses after sign-out or account changes, and requests no-store responses. A downloaded report is deliberately retained by the user and should be treated as private household operational metadata.

## Verification

`npm run test:diagnostics` executes canonical Apps Script with in-memory Google services, the real private adapter and route logic with a fake verified identity. It checks no-write behavior, missing headers/tabs, tenant separation, principal revocation, duplicate targets, response minimization, gate isolation observations, canonical release stamps and safe upstream failures. These tests do not verify real Clerk, Google or Vercel runtime behavior.

Rollback: promote the previous immutable Apps Script version on the existing Web App. The diagnostics route then fails unavailable rather than treating an older backend as a successful report. No schema migration or fixture cleanup is required.
