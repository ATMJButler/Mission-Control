# Member onboarding release plan

The existing Julie preview is illustrative. Its selections are not persisted and its provider buttons are not OAuth connections. Do not invite Julie to treat it as a finished setup experience.

## Workspace boundary delivered first

`/api/v1/workspace` verifies the existing Clerk identity and active, unique User/Household/Membership chain before returning a minimized routing decision. The household selector is only a request selector, never authority. The default can be configured through `MC_DEFAULT_HOUSEHOLD_ID`; the Butler fallback preserves the currently commissioned household.

Only the principal opens the existing legacy iframe. Secondary/extended members see an honest preparation screen. Unprovisioned identities get a link to the existing invitation-claim page. The server also denies non-principal legacy sync reads/writes and legacy write-check authorization; changing client routing cannot bypass that boundary. Generic Project-v1 secondary authorization policies remain unchanged, and the trusted human dispatcher remains principal-only commissioning infrastructure.

Routing uses an origin-checked POST read so older GET-caching service workers cannot replay a principal routing decision. The controller clears older origin caches before opening a workspace, discards late responses after sign-out/account changes, and revalidates on return to the page and periodically. API access is checked on every request; displayed material from a previously authorized session is not retroactively erased from a user's possession. The service worker bypasses API and cross-origin requests and changes cache generation. No new service-worker registration is introduced.

This is source/offline evidence until real secondary commissioning occurs. It does not prove secondary privacy across every resource, existing browser copies, external shared links or connected providers.

## Scope decision pending

John must choose whether Julie initially receives shared Budget/Meals/explicitly shared family items only, or also household account balances/debt details. Do not infer this choice from hidden tabs or publish raw financeData while the decision is pending. Do not infer shared family scope from a Project name, area or the existing John agenda snapshot.

## Remaining implementation

1. Add a durable, versioned self-owned member setup resource. Derive its user/household from verified server context, recheck membership privately, preserve physical row identity and CAS under the shared ScriptLock. Reads must not initialize records. Save choices with readback and explicit recovery after uncertain writes. Keep activation behind a commissioning gate until reviewed.
2. Build the real walkthrough: verify account/household, collect preferred starting screen, timezone/day boundaries, household responsibilities and notification preferences. Show a summary, let the member revise it and save only their own preferences. Preferences must not grant permissions.
3. Add field-projected member reads for the approved shared resources. Use exact household/user scope; do not return the principal's full Project, finance or agenda snapshots. Unsupported or absent data gets an honest empty state, not sample household evidence.
4. Implement optional provider connections individually, with real OAuth, permitted scopes, connection tests, skip/disconnect/recovery and explicit sharing choices. Provider interest is not connection success. Avoid presenting unavailable connectors as completed setup steps.
5. Commission production Clerk credentials through a migration plan that preserves John's immutable identity binding and existing access. Do this before Julie's permanent identity setup.
6. Complete offline security/accessibility/mobile checks and a pinned independent review. Then run a supervised session with Julie's real identity: invitation claim, allowed operations, principal-only denial, wrong-household denial, revoke active membership/immediate API denial, restore/access recovery, preferences and connection readback.
7. Begin a small daily-use pilot only after those checks pass. Project-v1 webpage cutover is separately gated.

## Current rollout

The workspace-boundary change is Vercel-only and uses the existing Apps Script directory operation. It needs no new Sheet tab, production data mutation, gate toggle or Apps Script promotion. Apps Script canonical digest remains unchanged; its version 84 source stamp stays separate from later frontend release SHAs. Independent live secondary acceptance is still pending.
