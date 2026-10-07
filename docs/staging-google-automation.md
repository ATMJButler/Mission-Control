# Staging Google automation

`staging-google-check.yml` is manually dispatched on main. GitHub OIDC exchanges
for a ten-minute service-account token scoped to `spreadsheets.readonly`.
No key JSON or stored Google refresh token is used. The workflow reads only the
fixed staging spreadsheet and reports minimized fixture checks, not raw rows.
It cannot edit records, change Apps Script properties or authenticate a member.

Google project: `mission-control-staging-tests`, number `280033790691`.
Pool: `mc-staging-github`; OIDC provider: `github-actions`.
Service account:
`mission-control-staging-tests@mission-control-staging-tests.iam.gserviceaccount.com`.

Provider mappings: google.subject=assertion.sub,
attribute.repository_id=assertion.repository_id,
attribute.repository_owner_id=assertion.repository_owner_id.
Provider condition:

```text
assertion.repository_owner_id == '315165841' &&
assertion.repository_id == '1335188517' &&
assertion.ref == 'refs/heads/main' &&
assertion.workflow_ref == 'ATMJButler/Mission-Control/.github/workflows/staging-google-check.yml@refs/heads/main' &&
assertion.event_name == 'workflow_dispatch'
```

The service account's IAM policy grants `roles/iam.workloadIdentityUser` to:

```text
principalSet://iam.googleapis.com/projects/280033790691/locations/global/workloadIdentityPools/mc-staging-github/attribute.repository_id/1335188517
```

Share only staging spreadsheet `18eft4EyxSy1lCtydd5dwuu20iMiJOBV0AAiHq4gu05Y`
with the service account. Editor sharing prepares for separately reviewed future
fixture automation; this workflow still requests only read-only token scope.
Enable Google Sheets, IAM Service Account Credentials, and Security Token Service
APIs in the project when required. A successful workflow is the connectivity
evidence; setup screenshots or saved IAM bindings alone do not prove access.

No production spreadsheet, Julie identity, deployment change or gate flip is
part of this workflow. Separate authorization flows are needed for browser
test identity, Vercel gates, and any Apps Script management. Future mutation
automation must preserve staging guards and reconcile uncertain writes.

## Verified connection and Clerk preflight

The second live Google workflow run, `37542846660`, succeeded on October 6, 2026:
OIDC authentication and all physical fixture checks passed with no writes.
The first run authenticated successfully but failed the Sheets read before the
owner enabled the Sheets API. Detailed first-run logs were inaccessible here,
so the precise original Sheets error was not independently read.

The workflow now accepts `check=google` (default) or `check=clerk`. The Clerk job
requires GitHub secrets `STAGING_CLERK_SECRET_KEY` and
`STAGING_CLERK_PUBLISHABLE_KEY`, from the dedicated development application. It
uses only GET requests to compare frontend/backend public signing keys and read
a user count. It never prints API keys, raw user data, or frontend domain.
Clerk preflight does not provision an account or change Vercel keys. Browser
automation and staging directory migration remain separate pending work.

## Clerk verified and Vercel preflight

Live Clerk run `37543695169` passed: development keys match, user count zero,
no writes requested. The isolated account is ready for later test provisioning;
no Vercel keys or directory records have been migrated.

`check=vercel` requires `STAGING_VERCEL_TOKEN`. It verifies only project
`prj_ZHEWWlU4WHHQRrvhHAXg4rGKcglf`, name `mission-control-staging`. If necessary
it reads accessible team IDs to locate that exact project; it never lists or
reads other projects. It reports the verified team ID without environment values
or credentials. This preflight does not establish write permissions or deploy.
The token itself may cover other team projects; the script's project allowlist
is an application guard, not a claim of a project-scoped Vercel credential.

## Synthetic identity preparation

Live Vercel preflight `37545273598` verified the exact staging project and team
`team_NCKrXGb6YeagAIddLKKnPuxo` without writes.

`check=prepare-identity` deliberately uses a temporary Sheets read/write scope
to provision one synthetic member in the isolated Clerk development instance
and add one active secondary binding in the fixed staging workbook. It requires
the version-13 Meals fixture, matching Clerk development keys, and an instance
containing either zero users or only the marked automation user. It preserves
existing owner rows and does not migrate their provider subjects. It does not
invite Julie, create principals, change gates, or deploy Vercel.

Existing matching automation records are read back rather than duplicated.
Uncertain mutations are never automatically retried; a later explicit run reads
existing state first. Directory preparation is not a ScriptLock transaction.
Run only while the disposable staging directory is idle; GitHub runs share the
existing staging-sheet concurrency group. Successful readback is required before
Vercel key migration. No raw identity, email or credential data is logged.

## Provisioning verified; migration and browser checks

Run `37545753234` successfully created and read back the isolated synthetic
secondary. Existing owner directory rows were preserved; Meals remained at v13.

`check=migrate-clerk` changes only CLERK_SECRET_KEY and CLERK_PUBLISHABLE_KEY
in the allowlisted staging project's Production environment. It requires current
read-only gate policy and snapshots prior values in runner memory. Updates are
read back before deployment; a failed key update attempts restoration and
verification without requesting deployment. Snapshots and keys are never logged
or retained as artifacts. It deploys exact workflow SHA from the fixed GitHub
repository, waits for READY, and verifies the staging alias publishable key.
Deployment or alias uncertainty stops without resending. This migration leaves
existing owner's old Clerk subject unchanged; the automated secondary is the
prepared account in the new application. A new human staging identity would
need its own explicit directory binding. Production project keys are untouched.

`check=browser` installs pinned Playwright and Chromium on the ephemeral runner,
creates a sixty-second single-use sign-in ticket for only the marked synthetic
user, signs in, and verifies the normal secondary iframe UI, read-only Meals v13,
and principal diagnostics/legacy denial. It saves no browser profile, screenshots,
trace, cookies or ticket artifacts and requests no Meals writes. Session creation
is an authentication mutation, separate from read-only application operations.
Successful provisioning alone does not prove browser or migration acceptance.

### Sensitive-key compatibility

Migration run `37546118353` stopped before writes because Vercel omitted the
value of a sensitive key. The migration now preserves a non-readable original
Clerk binding server-side as `MC_STAGING_PRIOR_CLERK_SECRET_KEY` (and the analogous
publishable-key backup if needed), retaining its sensitivity and original value.
It creates a separately marked replacement, reads back that value, and deploys
only after both keys are ready. Failed creation is reconciled by reading metadata
and the known replacement value before deleting only that marked replacement
and restoring the original name. Original sensitive values are never downloaded.
Backup bindings remain for recovery; they are not production-project changes.
Gate values must still be readable and match the read-only policy, or migration
stops before writing. No claim of successful live migration yet.

The second attempt (`37546431078`) also stopped before writes: staging gate
values were sensitive. The migration now backs up any non-readable selected
binding server-side and explicitly creates enabled MEMBER_DASHBOARD, disabled
MEMBER_MEALS_EDIT, and disabled setup/project dispatch bindings if those optional
bindings already exist. Missing optional off-gates stay absent. Readable gates
that contradict the agreed read-only policy still stop migration. This enforces
the authorized read-only state instead of claiming hidden settings were read.
New binding values are verified before requesting deployment; originals remain
under staging backup names for recovery.

### Current recovery approach (supersedes backup-name attempts)

Runs `37546626353` and `37546810268` rejected sensitive binding rename with HTTP
400 BAD_REQUEST; original bindings were verified restored and no deployment
was requested. The migration now updates values directly and records the
current exact staging alias/deployment as the recovery reference. It never
claims hidden old values were retrieved or restored. Readable prior values can
be restored on update failure; hidden-value uncertainty stops with the prior
live deployment retained and requires environment readback before another deploy.

Successful API updates preserve sensitive types; hidden-value writes are finally
verified through deployed key configuration and the authenticated browser test.
The read-only desired gates are explicitly enforced. If the new public alias
fails the key check, Vercel rollback to the recorded previous deployment is
requested; this restores live deployment routing, not prior project environment
values. The project environment keeps the intended new keys. No deployment
rollback or credential restoration is claimed without observed evidence.

### Explicit alias routing

The first direct-update attempt (`37547110243`) produced an unreadable success
response; handling now accepts empty successful operations. The corrected attempt
(`37547718788`) encountered HTTP 422 on recovery, and the public alias check
`37547517225` did not confirm the new key. Browser `37547574524` stopped during
isolated sign-in before requesting Meals mutations. These runs do not prove
completed migration.

Migration now explicitly assigns only `mission-control-staging.vercel.app` using
the deployment alias API, checks the alias's project and deployment IDs, and
verifies the public Clerk key. Recovery uses the same narrow alias assignment
back to the recorded previous deployment, avoiding assumptions about project
rollback eligibility. This changes only the verified staging address.

## Live automation acceptance — October 6, 2026

The migration run [37548047535](https://github.com/ATMJButler/Mission-Control/actions/runs/37548047535)
passed after explicit staging alias assignment. READY deployment and exact
public alias use the isolated Clerk development keys; editing remains disabled.
Earlier unsuccessful attempts and their limitations remain recorded above.

The authenticated browser run [37548147691](https://github.com/ATMJButler/Mission-Control/actions/runs/37548147691)
passed using pinned Playwright 1.58.2, Chromium, and the synthetic secondary's
short-lived ticket. It verified normal secondary workspace routing, read-only
Meals v13, visible six apples, absence of the grocery edit action, and expected
principal diagnostics/legacy API denial. No browser profile or credentials were
retained, and no Meals mutations were requested.

These live checks are driven by GitHub automation rather than owner Console
screenshots. They establish the authenticated staging browser capability; they
do not complete remaining commissioning cases. Original owner directory rows
remain unchanged, but their old Clerk subject is not a login in the new isolated
instance. The runner uses only the synthetic secondary account. Production
project keys and Julie identity/invitation remain outside this work.

The final post-browser Sheets run [37548293865](https://github.com/ATMJButler/Mission-Control/actions/runs/37548293865)
also passed every physical fixture check: version 13, six bought apples, TEST Soup
and seven days, preserved draft/history/rules/notes, neighbor version 9, and blank
row. It requested zero writes.

## Apps Script release credential boundary after calendar review

Sheets WIF/browser automation does not authorize Apps Script promotion. The
staging Apps Script workflow now requires its own `STAGING_CLASPRC_JSON` and a
protected `staging-apps-script` Environment. It never falls back to production's
`CLASPRC_JSON`. Owner review and main-only rules are verified before credential
use. Integration Environment creation was denied (HTTP 403); an owner must
configure it and supply a credential whose Google identity has access only to
the staging script. See [review remediation](calendar-review-remediation.md).
