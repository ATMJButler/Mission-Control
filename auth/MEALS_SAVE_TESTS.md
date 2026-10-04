# Meals draft-save version regression

`app-v5.html` previously omitted `expectedVersion` from Save Draft, although
approval supplied it and the API already forwarded it. Draft saves now send the
version of the shared Meals snapshot the browser loaded. The backend's existing
version check rejects a stale draft instead of overwriting a newer snapshot.
The browser retains local edits and its original version after rejection; it
does not automatically retry or proceed to approval.

Run `npm run test:meals-runtime` or `npm run test:auth` with Node 24.
Eight executable browser/API tests run the actual payload/save/approval functions,
the actual Meals route handler logic, the real authorization/origin checks, and
the canonical Apps Script backend through the in-memory Google service harness.
Identity and directory adapters are mock fixtures. The test loader removes route
imports and injects those dependencies; it does not validate Clerk SDK setup or
real authentication. No production requests or credentials are used.

Coverage includes loaded-version propagation, stale-save rejection, preservation
of local edits and previously approved meals, save→approve version advancement,
approval cancellation after a save conflict, server-derived actor and top-level
household envelope, extended-role denial before an upstream mutation, and clear
feedback when a save or approval cannot be confirmed despite committed readback.

Human Meals writes now acquire the same ScriptLock held by the Dot processor.
The inner writer does not reacquire it, avoiding nested acquisition in the queue.
Version check, row write, and meaningful flush occur before release. Cleanup
flush is guarded and cannot prevent independent lock release. Indeterminate
sheet/flush failures return UNKNOWN; cleanup cannot turn that into success or
replace a definitive conflict. Browser feedback retains local edits and asks
users to check shared Meals before retrying an uncertain save or approval.

Eleven additional backend tests cover lock ownership/order, sequential version
conflicts, both Dot/human write orders, write/flush/cleanup faults, lock timeout,
and unchanged unversioned and empty-sheet initialization behavior. A successful
response is now backed by the modeled meaningful flush, not by a flush performed
by the test transport.

Backend expectedVersion remains optional for compatibility. The historical
empty-sheet first version remains 2. These tests are sequential and do not prove
actual Google lock contention, durability, full payload validation, or live
runtime safety. Meals has no durable operationId replay/recovery mechanism yet.
Production deployment and runtime confirmation are pending. The Apps Script
source change must be reviewed, versioned by the existing workflow, and promoted
manually by John on the existing Web App; do not deploy through clasp.

Auth CI now also runs when the browser file changes. Restoring the old omitted
version request in a temporary copy makes the regression suite fail.

## Conflict review

After a conflict or UNKNOWN result, the browser offers **Review latest shared
plan**. Loading the comparison is read-only and does not update the local draft
or its write baseline. Both plans show meal choices, recipe details, groceries,
inventory, and settings; dynamic content is escaped. The comparison uses two
columns on desktop and stacks on small screens.

Users can keep editing, explicitly load the shared plan on this device, or save
their draft against the version they reviewed. Loading shared data requires
confirmation and retains one earlier local draft for restoration. Recovery data
stays inside the existing user-scoped state, so the normal sign-out clearing
also removes it. Restoring a draft requires a fresh review before saving.

The pending-review marker is persisted with local edits. Initial/reload fetches
do not overwrite a pending draft, including an initial read already in flight.
Closing or superseding a review ignores late responses. Changed local edits
are shown again before saving. A reviewed save that conflicts again or returns
an unconfirmed outcome requires another readback; no automatic retry or new
approval occurs.

Twelve review tests cover read-only comparisons, failed and late reads, escaped
content, confirmation and restoration, reviewed-version propagation, new shared
conflicts, edits after comparison, reload preservation, and uncertain responses.
Transport/body loss, server errors, and invalid success versions require
readback instead of allowing a blind resend. Desktop/mobile
Chromium smoke checks also exercised the actual page controls with mocked APIs,
including no mobile horizontal overflow, conflict→review→reload→load shared→
restore local draft→reviewed save. These are offline browser evidence, not
production commissioning. The feature does not merge individual changed fields
automatically and does not establish durable operation replay for Meals.
