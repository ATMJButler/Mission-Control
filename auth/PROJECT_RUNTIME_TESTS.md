# Executable Project Apps Script tests

Run `npm run test:project-runtime` with Node 24, or run `npm run test:auth`
to include the existing auth, dispatcher, and source-contract checks.
No Google credentials, service tokens, external dependencies, or network access
are required by this executable suite.

`helpers/apps-script-harness.js` evaluates the complete canonical
`google_apps_script_Code.gs` inside a Node VM. It replaces Google platform
services with isolated in-memory sheets, properties, JSON responses, digest
calculation, and a synchronous lock. Application functions are not replaced.
Each fixture has separate sheet state and buffered writes; a successful modeled
flush copies visible state to the harness's persisted readback. Fault hooks can
interrupt audit append or specific flush calls.

The 19 tests cover:

- Exact physical row updates after interior blank rows, preserved neighbors,
  unchanged legacy Projects, and audit results.
- Token/private-gate denial, foreign target households, duplicate target IDs,
  and duplicate operation audit IDs.
- Serialized stale-version conflicts, typed patch/calendar compatibility with
  Vercel validation, lifecycle flags, deletion timestamps, and review metadata.
- Successful replay, changed fingerprints, and definitive failure replay.
- Post-commit audit append/flush failure, persistent flush loss, cleanup failure,
  UNKNOWN outcome preservation, and independent lock release.
- Resource refresh preservation and sequential Dot/trusted draft updates using
  the shared lock model.
- The real Vercel upstream adapter calling executable backend source through a
  fake transport, losing the response body, reconciling persisted resource/audit
  state, then recovering with exact replay rather than a new expectedVersion.

This is offline behavioral evidence. The harness's persistence and locking are
deliberately simplified: it cannot prove actual simultaneous requests, Google
Spreadsheet buffering/durability, timeouts, triggers, Clerk identity, deployed
artifacts, or live gate configuration. In particular, sequential stale-version
tests are not runtime contention commissioning. A VM is used for execution
isolation, not as a security sandbox for untrusted source.

The existing source-pattern guards remain enabled. Auth CI now also triggers
when canonical Apps Script source changes.

During development, the suite rejected five temporary mutated copies of the
source: wrong physical row targeting, removed target/next household checks,
disabled successful replay, impossible-date acceptance, and cleanup flush
preventing lock release. These checks used temporary copies and did not change
canonical application source. This is test sensitivity evidence, not a claim
that those regressions exist in the current application.

Production source, authority policies, feature gates, and deployment workflows
are unchanged by this test-only work. Live commissioning and independent Dot
review remain separate milestones.
