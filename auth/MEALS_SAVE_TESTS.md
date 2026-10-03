# Meals draft-save version regression

`app-v5.html` previously omitted `expectedVersion` from Save Draft, although
approval supplied it and the API already forwarded it. Draft saves now send the
version of the shared Meals snapshot the browser loaded. The backend's existing
version check rejects a stale draft instead of overwriting a newer snapshot.
The browser retains local edits and its original version after rejection; it
does not automatically retry or proceed to approval.

Run `npm run test:meals-runtime` or `npm run test:auth` with Node 24.
Six executable tests run the actual browser payload/save/approval functions,
the actual Meals route handler logic, the real authorization/origin checks, and
the canonical Apps Script backend through the in-memory Google service harness.
Identity and directory adapters are mock fixtures. The test loader removes route
imports and injects those dependencies; it does not validate Clerk SDK setup or
real authentication. No production requests or credentials are used.

Coverage includes loaded-version propagation, stale-save rejection, preservation
of local edits and previously approved meals, save→approve version advancement,
approval cancellation after a save conflict, server-derived actor and top-level
household envelope, and extended-role denial before an upstream mutation.

This is a narrow browser propagation fix. Backend expectedVersion remains
optional, initial/unloaded Meals behavior is unchanged, and Meals does not yet
have a common ScriptLock around its version check/write. These tests are
sequential and do not establish live atomic contention safety or complete Meals
payload validation. Production deployment and runtime confirmation are pending.

Auth CI now also runs when the browser file changes. Restoring the old omitted
version request in a temporary copy makes the regression suite fail.
