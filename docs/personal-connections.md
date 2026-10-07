# Personal calendar and email connections

The next app milestone is a private personal schedule from explicitly selected
calendars. Google and Microsoft are the initial OAuth providers. iCloud Calendar
is a useful later option, but its CalDAV/app-specific-password authentication is
separate from OAuth. Apple Mail connects to an underlying email provider.

Calendar consent and email consent are separate actions. Initial permissions are
read-only. Email scheduling suggestions must be reviewed before adding them to
a schedule, and confirmed separately before sharing them with the household.
No email sending, calendar writing, or automatic family publication is included.

## Implemented foundation

`auth/personal-schedule.js` projects provider events into a small private schedule
contract. It normalizes explicit timed offsets, preserves exclusive all-day
dates, removes cancellations, rejects ambiguous/invalid time data and duplicate
IDs, and excludes bodies, attendees, credentials and other provider fields.
Microsoft timed events must be read with UTC requested. All-day dates require a
calendar-local read; an offset-converted all-day result fails closed rather than
silently moving the event to another date.

`auth/personal-oauth.js` builds separate provider consent URLs using PKCE and
encrypted callback state. It binds callbacks to a verified member, household,
session and configured HTTPS callback URL, with a ten-minute expiry. AES-GCM
secret envelopes use owner-specific authenticated context. Encryption keys must
be securely configured as 32 random bytes represented in hex.

## Implemented calendar flow

`POST /api/v1/member` now handles private connection status, calendar consent,
callback completion, calendar listing/selection, personal schedule reads and
local disconnect. It verifies origin and Clerk identity, derives the actor and
household, and restricts access to active principal/secondary members. The
verified Clerk session ID survives the identity boundary for consent binding.

Apps Script independently rechecks membership under ScriptLock. Its `Personal
Connections` table stores only ciphertext plus single-use consent metadata;
reads do not create the table. Records are unique by member, household, provider
and purpose, retain their physical row, and use CAS. A callback durably consumes
its nonce before any provider exchange. An uncertain consume stops the exchange.
Tokens and chosen calendars are encrypted with owner-specific authenticated
context. Stale/ambiguous records fail closed. A reconnect resets calendar choices
so a different provider account never inherits an earlier account's selection.

Google reads recurring calendar instances. Microsoft reads timed events in UTC
and retrieves all-day events in their original timezone. Pagination remains on
fixed provider origins and paths, with bounded pages/events. Provider errors,
limits and malformed data are unavailable rather than empty schedules. Refresh
rechecks the immutable provider account and persists updated tokens with CAS.
Concurrent refresh failures require reconnect/recovery; no uncertain token
exchange or storage mutation is automatically retried. Membership and record
versions are rechecked after schedule reads to prevent returning a disconnected
connection's stale response.

`personal-connect.html` manages accounts and up to five selected calendars per
provider. Callback parameters are removed from the address bar before auth
initialization, use a no-referrer policy and never go into browser storage.
`My schedule` displays the private provider projection in the member timezone.
Sign-out/account changes and refresh invalidate pending responses and clear old
material. Local disconnect erases saved tokens and selections and prevents new
reads; provider-side consent can also be revoked in provider account settings.
No events are automatically shared. Email consent URLs are prepared separately,
but public email connection/suggestion actions remain unavailable pending the
email milestone.

## Staging configuration still required

Keep gates off until the staging Apps Script version containing this store has
been promoted and exact source verified. Production settings and Julie's
activation remain untouched.

Configure these securely on the staging Vercel project only:

- `MC_PERSONAL_CALLBACK_ORIGIN=https://mission-control-staging.vercel.app`
- `MC_PERSONAL_ENCRYPTION_KEY`: a securely generated random 32-byte key as hex.
- `MC_GOOGLE_CLIENT_ID` and `MC_GOOGLE_CLIENT_SECRET` for a Google Web application.
- `MC_MICROSOFT_CLIENT_ID` and `MC_MICROSOFT_CLIENT_SECRET` for a Microsoft Web app
  that supports the intended work/school and personal Microsoft accounts.
- Both providers' exact registered callback:
  `https://mission-control-staging.vercel.app/personal-connect.html`.
- Google Calendar API enabled in the OAuth application's project; consent test
  users allowed for an app in testing. Request `openid email` and
  `https://www.googleapis.com/auth/calendar.readonly`.
- Microsoft delegated `User.Read` and `Calendars.Read`, with OIDC/offline consent.
  Client secret means the secret **value**, not its identifier.

Enable `MC_PERSONAL_CONNECTIONS=enabled` on staging Vercel and
`PERSONAL_CONNECTIONS=enabled` on staging Apps Script only for commissioning.
The dashboard advertises calendar availability only when both gates are enabled;
older backends report it unavailable. Existing Sheets test credentials do not
provide personal calendar consent. Keys must never be entered into chat,
committed to Git, or stored as plaintext in the Sheet. Keep the encryption key
stable while connections exist; rotation needs an explicit re-encryption plan.

## Evidence and remaining acceptance

Run `npm run test:personal-schedule` and the existing complete auth suite. CI also
runs `scripts/check-personal-browser.mjs` in Chromium using synthetic HTTP
responses only: it is offline UI evidence, not live provider acceptance.

Before live readiness, commission Google and Microsoft consenting test accounts
through the normal browser flow; verify selection, timezone/DST/all-day and
recurrence behavior, refresh, revoked provider consent, replay, wrong member,
revoked membership, unknown save recovery and disconnect. Publish the staging
backend version manually if Apps Script deployment authentication is unavailable.
Email suggestions, iCloud support, household event sharing and production
commissioning are later work and are not claimed by calendar tests.
