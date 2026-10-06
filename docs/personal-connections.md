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

These modules are not wired to public routes, and do not establish live OAuth
support. They contain no credentials and change no current workspace capability.

## Integration still required

1. Durable per-member connection storage with encrypted tokens and atomic
   one-use consent nonces. A callback must consume its nonce before exchanging
   the code; encrypted state alone does not prevent replay. Reads never create
   connections. Every operation rechecks active membership and exact ownership.
2. Provider application registration and securely stored client credentials.
   Configure callback origins explicitly; never derive redirect destinations
   from browser input. Existing Sheets test credentials are not personal OAuth.
3. Consolidated member API actions for consent, callback, calendar selection,
   schedule read, refresh and disconnect, keeping within the Vercel function
   limit. Provider paging must stay on fixed provider origins and respect limits;
   partial/error responses must not masquerade as an empty schedule.
4. Normal member UI with account/calendar selection, connection status, skip,
   reconnect and disconnect, plus account-change/revocation clearing. Display
   selected-calendar events privately using the member's saved timezone.
5. Staging OAuth commissioning with dedicated consenting test accounts,
   refresh/revoke/replay/wrong-member checks and signed-in browser acceptance.
   Production configuration and Julie's activation remain separate.

Run foundation tests with `npm run test:personal-schedule`.
