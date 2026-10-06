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
