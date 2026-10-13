# Kid workspace and household requests — staged first release

This introduces a distinct `child` membership role. It does not reuse `extended`, grant project read access, or change principal/secondary permissions. Invitations remain principal-only, single-use and identity-bound. Each kid needs their own verified sign-in; no account is created or invited by deploying this code.

## Views and requests

`/kid.html` shows only explicitly shared household events, projected shared meals/groceries/snacks, the kid's own requests and the budget categories the principal elects to share. Budget starts private: the category selection is empty. The backend filters before returning data; no bank accounts, income, debt administration, transactions, private calendar/provider IDs or sibling requests are sent to a kid.

`/household-requests.html` is the shared adult inbox. Both active principal and secondary may review requests, approve/decline and publish/remove explicit household schedule events. Only the principal can change kid budget visibility. Navigation is shown only when enabled. The inbox shows pending requests first and offers recent history. Kids see pending requests and their latest history.

Grocery approval appends the requested item/quantity to the selected existing week, unchecked. An existing matching item is shown during review; approval does not merge or change its quantity. Meal approval replaces the selected existing date's meal and prep note, dropping the old recipe only when the meal changes. Adults see the current meal/list before approving. The rest of the plan, other week, history, rules, snacks and metadata are retained.

Calendar requests record an activity/date/timing/note. Adult approval means **approved for follow-up**, not event creation or a ride assignment. Adults may separately share a household event manually. The schedule is a dedicated shared list, not a projection of the principal's private Agenda or either adult's personal calendar. Personal calendar automation remains a later integration.

## Staging commissioning

Keep production gates off until staging acceptance is complete. Enable **both**:

- Staging Vercel environment variable `MC_CHILD_WORKSPACE=enabled`, then redeploy the staging site.
- Isolated staging Apps Script property `CHILD_WORKSPACE=enabled`, on the matching staged source/deployment.

The feature is off when either gate is absent. No new serverless function, bank/calendar OAuth credential or manually created Requests sheet is needed. Existing staging identity/invitation directory tables must already be commissioned, as for adult invitations. New writes initialize **Household Requests** under lock. Do not point staging at the real household spreadsheet or change either real adult's membership.

Acceptance sequence: principal invites a synthetic kid; kid claims/signs in and sees the kid frame; no Budget categories initially; kid submits a grocery request; secondary approves and both views show one added item; primary declines a meal request with a response; calendar approval creates no event; adult explicitly shares a sample event; primary shares only a sample category; kid sees that category alone; primary clears visibility; revoked kid loses access. Existing meal edits, Budget, sign-in recovery and app-return tests remain required. Real-phone usability can follow with an invited beta tester after these isolated checks.

## Storage and uncertainty

Every mutation uses a household document version and a command ID. Backend and API authorize roles separately. The backend rechecks exact active directory bindings under ScriptLock and isolates physical household rows. Kids may only read their view and submit requests; guessing an adult operation or putting actor/role fields in the body does not elevate access.

Approval requires the currently reviewed Meals version. Before writing Meals, the request is durably marked `applying`. The Meals commit records the request ID in `appliedHouseholdRequests` along with the changed plan and next version. Final request status is then saved. A lost result leaves saving disabled and inputs visible. Readback checks the journal; an adult explicitly reconciles an applying request. A recorded application marker finalizes the existing approval without another list change. No automatic resend occurs. Revocation stops new approvals from that kid; a valid adult can decline old pending requests or reconcile an already committed change.

Requests and explicit events use a separate household-keyed sheet with eight JSON segments. Initial bounds are 500 stored requests, 50 pending requests per kid, 200 shared events and 300,000 serialized characters (whichever limit is reached first); no automatic archival is implemented. Meals retains at most 500 application markers. Any schema duplication/corruption fails closed. Limits/retention should be revisited before a broader beta.

## Tests

`npm run test:auth` includes the real Apps Script source under the offline Sheet harness: role restrictions, read-only behavior, invitation identity/retry, household isolation, sibling privacy, budget filtering/revocation, draft/approved preservation, adult conflicts, stale versions, and faults before/after the Meals commit.

`node scripts/check-kid-browser.mjs` exercises kid and secondary/principal screens at 390px and 1366px against that harness: lost-submit recovery, approval, decline, calendar follow-up, explicit events, budget selection, forged actor rejection, access denial and routing without private principal modules. CI runs this with the existing calendar, member and budget browser checks. These tests do not use live identities, send messages, or modify household Sheets.
