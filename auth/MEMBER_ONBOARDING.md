# Member onboarding release plan

The existing Julie preview is illustrative. Its selections are not persisted and its provider buttons are not OAuth connections. Do not invite Julie to treat it as a finished setup experience.

## Workspace boundary delivered first

`/api/v1/workspace` verifies the existing Clerk identity and active, unique User/Household/Membership chain before returning a minimized routing decision. The household selector is only a request selector, never authority. The default can be configured through `MC_DEFAULT_HOUSEHOLD_ID`; the Butler fallback preserves the currently commissioned household.

Only the principal opens the existing legacy iframe. Secondary members see the preparation screen unless the setup gate is enabled, in which case they open the isolated member walkthrough. Extended members remain on the preparation screen. Unprovisioned identities get a link to the existing invitation-claim page. The server also denies non-principal legacy sync reads/writes and legacy write-check authorization; changing client routing cannot bypass that boundary. Generic Project-v1 secondary authorization policies remain unchanged, and the trusted human dispatcher remains principal-only commissioning infrastructure.

Routing uses an origin-checked POST read so older GET-caching service workers cannot replay a principal routing decision. The controller clears older origin caches before opening a workspace, discards late responses after sign-out/account changes, and revalidates on return to the page and periodically. API access is checked on every request; displayed material from a previously authorized session is not retroactively erased from a user's possession. The service worker bypasses API and cross-origin requests and changes cache generation. No new service-worker registration is introduced.

This is source/offline evidence until real secondary commissioning occurs. It does not prove secondary privacy across every resource, existing browser copies, external shared links or connected providers.

## Approved initial scope

John selected shared Budget, Meals and explicitly shared family items only. Account balances, debt details, transaction descriptions and private work are excluded. Do not infer shared family scope from a Project name, area or the existing John agenda snapshot.

`auth/member-projection.js` defines a tested, allowlisted output contract for future member reads: budget category aggregates (unavailable reconciliation remains unknown), approved meal days and grocery items, and active Project Resources with exact household and `household:shared` scope. Duplicate resource IDs in the selected household fail closed. This module is not an authorization layer: the API and private backend must independently verify active membership and household before invoking it. Legacy finance snapshots must never be treated as belonging to arbitrary households; the future reader must establish the Butler source ownership and reject ambiguous snapshots.

The projection is not yet connected to a public member API or dashboard. No production sharing, gate activation, data mutation or Apps Script promotion is part of this change. Field projection tests are offline evidence, not secondary runtime acceptance.

## Remaining implementation

1. Add a durable, versioned self-owned member setup resource. Derive its user/household from verified server context, recheck membership privately, preserve physical row identity and CAS under the shared ScriptLock. Reads must not initialize records. Save choices with readback and explicit recovery after uncertain writes. Keep activation behind a commissioning gate until reviewed.
2. Build the real walkthrough: verify account/household, collect preferred starting screen, timezone/day boundaries, household responsibilities and notification preferences. Show a summary, let the member revise it and save only their own preferences. Preferences must not grant permissions.
3. Add field-projected member reads for the approved shared resources. Use exact household/user scope; do not return the principal's full Project, finance or agenda snapshots. Unsupported or absent data gets an honest empty state, not sample household evidence.
4. Implement optional provider connections individually, with real OAuth, permitted scopes, connection tests, skip/disconnect/recovery and explicit sharing choices. Provider interest is not connection success. Avoid presenting unavailable connectors as completed setup steps.
5. Commission production Clerk credentials through a migration plan that preserves John's immutable identity binding and existing access. Do this before Julie's permanent identity setup.
6. Complete offline security/accessibility/mobile checks and a pinned independent review. Then run a supervised session with Julie's real identity: invitation claim, allowed operations, principal-only denial, wrong-household denial, revoke active membership/immediate API denial, restore/access recovery, preferences and connection readback.
7. Begin a small daily-use pilot only after those checks pass. Project-v1 webpage cutover is separately gated.

## Current rollout

The earlier workspace-boundary release was Vercel-only. The new durable walkthrough changes Apps Script and requires a separately versioned/promoted backend before activation. Version 84 does not contain member setup. Independent live secondary acceptance is still pending.

## Personal connections and Family Calendar

Julie needs her own calendar and email connections, selected individually, with her personal schedule private by default. Provider OAuth consent, account/calendar selection, token storage, revoke/disconnect and verified refresh are still unimplemented. The existing John agenda snapshot does not establish these capabilities for members.

The family compiler (`auth/family-calendar.js`) accepts only trusted stored sharing records after independent membership authorization. It excludes foreign households, revoked owners, private events, cancelled events and unconfirmed email suggestions. Sharing modes are `details` or `busy`; Busy suppresses source calendar names, titles, provider IDs and all extra payload fields. `shareId` must be a random opaque sharing-record key, never a provider ID. Source labels on detailed events must be explicitly approved for sharing. Participants come from the trusted sharing record, not browser assertions. Duplicate shared IDs fail closed. Provider adapters must collapse updates into one current record and propagate deletions before compilation.

Conflicts mean overlapping commitments involving at least one common active participant. Adjacent events are not conflicts. Timed events require explicit offsets and normalize to UTC; all-day end dates are exclusive. Mixed all-day/timed conflicts require timezone-aware provider normalization and are deliberately not inferred yet. Reminders and provider writeback are not delivered by this compiler.

`family-calendar.html` is a clearly labeled standalone design preview with opt-in synthetic events, timezone display, Busy blocks and conflict warnings. It fetches no household data, persists no personal data, and is not linked into the normal workspace. The compiler and preview are source/offline evidence only. Before live activation: add an authorized private sharing store with CAS, confirm/share/unshare controls, provider adapters, a projected member API, revoke/refresh tests and real identity commissioning. Do not use the principal-only legacy agenda endpoint as a shortcut.

## Durable one-step walkthrough

`member-setup.html` uses the existing Clerk sign-in and an origin-checked POST `/api/v1/member`. It walks through verified membership, desired calendar services, desired email services, privacy preference, starting screen/timezone, and review. Every Continue saves the next position to the user's own versioned profile. Reload resumes the saved position; Back/revise edits are kept in memory until Continue. No invitation token, account credentials, email content or personal event data goes into this profile or browser storage.

Choosing Google or Microsoft is provider interest only. The UI explicitly says no accounts are connected. The final state is `preferences_saved`, not completed account commissioning. Sharing preferences do not publish events or grant permission. Existing John workspace routing stays principal-only and unchanged.

The private backend independently rechecks the unique active directory chain under the shared ScriptLock. `Member Setup` is created only on the first explicit save, never by a read. Writes are exact user/household CAS and retain physical row identity; duplicate profiles/invalid schemas fail closed. Uncertain writes return `MEMBER_SETUP_OUTCOME_UNKNOWN`. The browser blocks further saves and offers a readback; it never automatically retries. Confirmation requires next version and matching submitted preferences. Account changes/sign-out discard pending responses and clear displayed setup state. Access revalidation runs on return and every minute while visible; every API operation verifies access independently.

Release gates default off: Vercel `MC_MEMBER_SETUP=enabled` and Apps Script `MEMBER_SETUP=enabled`. The Vercel routing gate only opens the walkthrough; the member API still checks the backend gate. Do not toggle them as part of source release. This uses the twelfth current Vercel API function; keep future member operations consolidated rather than exceeding the project function allowance.

Release sequence: merge exact reviewed source with passing CI; run the existing Apps Script source/version action on current main; manually select the new immutable version on the existing Web App (same URL/settings); verify source SHA/digest; perform a separately authorized disposable-identity setup commissioning; then explicitly approve gate activation. Julie's real sign-in/invitation, production Clerk migration, revoke/restore checks and live OAuth connections remain separate prerequisites before inviting her for daily use.

OAuth follow-up needs provider application configuration (Google and/or Microsoft), approved consent scopes, registered callback URLs and an encrypted token store with per-member ownership. Provider credentials belong in secure deployment settings, never chat or the preference sheet. No usable provider application configuration has been verified in this repository/session. Existing cloud service credential bindings do not establish personal calendar/mail OAuth access. Begin with read-only scopes and per-calendar selection; email-derived scheduling suggestions require confirmation before family sharing. Do not request mail sending/calendar write permissions for this milestone.

## Scoped member dashboard release

`member.html` now has a read-only scoped Budget, approved Meals/grocery list and explicitly shared family-item view. `POST /api/v1/member` operation `dashboard` is consolidated into the existing twelfth function. The API verifies origin, identity and active membership, derives actor/household, and calls private `member_dashboard/read`. Apps Script rechecks the unique active directory under ScriptLock and reads existing tables directly. It never repairs headers, initializes tabs or calls legacy Projects/Meals read helpers.

Both backend and Vercel project fields independently. Butler's unscoped legacy finance snapshot is used only for `butler-household`, and only when there is exactly one finance snapshot. Only category plans/reconciled spending/asOf are returned; optional `budgetData.reconciliation` is read by its actual additional column. No account balances, debt, transaction records, raw finance/agenda JSON or private Project content reaches the member response. Missing reconciliation remains unknown. Meals require matching sheet and JSON households, and return only approved meal names/dates/prep plus grocery items. Family items require exact `household:shared` scope and active lifecycle; global resource ID collisions fail the section closed. Unsupported/missing/ambiguous sections have explicit unavailable/missing states.

The member page uses no browser persistence, does not call legacy sync, and clears old panels before refresh. It discards late account/session responses, rechecks every visible minute and on return, and clears state after access failures/sign-out. Preferred starting screen is applied once per load; subsequent refreshes preserve the selected tab. The current meal and family views are read-only. Personal schedule, live family calendar and account connections remain explicitly unavailable.

Release gates default off: `MC_MEMBER_DASHBOARD=enabled` on Vercel, `MEMBER_DASHBOARD=enabled` in Apps Script. Secondary routing prefers the dashboard when the Vercel gate is enabled; otherwise it follows the independently gated setup route. Principal routing is unchanged and extended members remain excluded. Diagnostics now report both member gates; older backends report new gate values as null/unverified rather than false. No gate is toggled by source release.

Version 85 contains the earlier setup resource but not this dashboard reader. A new immutable Apps Script release/promotion is required. Source/mock/mobile tests do not prove live Clerk, Google permissions, secondary authorization or production data correctness. Do not invite Julie for daily use until the separate commissioning gates are met.
