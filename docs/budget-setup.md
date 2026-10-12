# Manual household budget setup

The principal's Budget tab links to `/budget.html`. Six steps cover method, take-home income, bills and due days, spending targets, savings/irregular expenses, and review. Each Continue/Back saves the draft with a version check. Save progress saves without advancing. Nothing replaces the existing finance view until the principal selects Use this budget on a saved review step.

This release supports manual entry only. Bank connections are visibly marked as coming next. No bank authorization or account access is implied. The old finance workbook/snapshot and Money view are retained. After activation the principal Budget tab and the member's category summary use the same active manual plan and recorded transactions. Income, descriptions, transaction IDs, and setup administration remain principal-only.

Amounts use integer USD cents. Weekly, every-two-weeks, twice-monthly, quarterly and yearly amounts are converted to rounded monthly averages. Bills and savings are separate allocations; allocation names must be unique across all three groups. Due days are reminders for cash planning, not automatic payments or calendar events. A due day beyond a short month's length means that month's last day. Shortfalls remain visible and do not silently change the plan.

Spending and refunds affect category totals; income and transfers do not. Unassigned spending is shown as its own category. Transaction dates select the month (America/Chicago for household summaries). Corrections and deletions require the latest record version. Twenty recent entries are shown initially; more can be requested. The first release stores at most 500 transactions and 100 named allocations per household; it has no automatic archival. This limit is shown in the UI.

## Backend/release

Deploy web changes and promote the matching Apps Script immutable version. No new OAuth credentials, script property, or manual Sheet creation is required. The principal's first save creates a **Budget Setup** sheet with household ID, version, eight JSON segments, update timestamp and actor. Reads never create or repair tables. All writes recheck active principal authority under ScriptLock and update a single household row. Duplicate household rows or malformed headers fail closed. The existing Projects, Meals, and directory rows are not rewritten.

Every mutation includes expectedVersion and a requestId. The latest exact request can be replayed without a second write; reuse with different content conflicts. The browser does not retry uncertain writes automatically. It retains local inputs, disables saving, and offers a readback. Confirming requestId and next version restores the normal screen; other readbacks require local review. Identity changes or authoritative access denial erase the private screen. Background focus checks update the principal's category view without replacing an open setup/transaction editor.

Setup changes after activation stay in the draft until Use this budget is selected again. Recorded transactions remain intact. Removing or renaming a category makes old transactions unassigned until the principal corrects their categorization.

## Validation and remaining work

`npm run test:auth` includes real Apps Script source under the offline Sheets harness: principal/secondary boundaries, household isolation, cents/frequency calculations, refunds, transfers, draft/active separation, version conflicts, response-loss replay, unknown writes, and malformed storage. `node scripts/check-budget-browser.mjs` exercises six steps, reload/resume, activation, lost acknowledgement/readback, corrections, local draft revisions and access denial at 390px and 1366px. Existing calendar/member browser checks remain required.

A follow-up bank integration needs a provider selection, secure connection/token storage, consent/revocation handling, transaction identity and explicit manual/import reconciliation, plus production configuration. This release does not connect accounts or automatically import old finance transactions.

Budget requests share `/api/v1/member` with an explicit `resource: "budget_setup"` discriminator and separate principal-only policy. This keeps the deployment at its existing 12 serverless functions. Existing member request schemas and permissions are unchanged.
