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
