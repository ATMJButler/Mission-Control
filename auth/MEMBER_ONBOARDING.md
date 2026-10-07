# Member onboarding: current status

Status reviewed 2026-10-06. Implemented source, deployed backend, configured
providers and live commissioning are separate milestones. Historical release
notes are preserved in [the archive](../docs/member-onboarding-history.md);
versions 84/85/86 there are not instructions for the current release.

| Capability | Implemented | Configuration / promotion | Acceptance |
| --- | --- | --- | --- |
| Principal/secondary workspace isolation | Yes | Dedicated staging Clerk and existing staging backend | Signed-in synthetic secondary, principal denial and read-only Meals checks passed |
| Member preferences | Yes | Independent setup gates | Production/Julie preference commissioning pending |
| Shared Budget/Meals/family projections | Yes | Staging dashboard viewing enabled in recorded evidence | Bounded staged read acceptance; no blanket production verdict |
| Member Meals editing | Yes | Staging Vercel editing disabled after tests | Owner-driven writes/CAS/recovery evidence recorded; additional cases pending |
| Google/Microsoft private calendars | Yes, with review fixes | Six staging OAuth/encryption bindings missing; new backend promotion unverified; gates remain off | Mock/runtime-model and synthetic desktop/phone checks; live provider acceptance pending |
| Email suggestions / iCloud / live family calendar sharing | Unfinished | Unavailable | Not commissioned |
| Production Clerk migration and Julie invitation/activation | Pending | Production settings unchanged | On hold |

See [personal connections](../docs/personal-connections.md) for the authoritative
calendar contract, secure settings, key recovery, refresh claims and commissioning
checklist. Provider preferences are interest only. They do not connect accounts,
grant permissions or publish personal events.

Member API calls verify origin, immutable Clerk identity, active unique directory
membership and permitted role. The private backend independently rechecks member
and household authority. Personal schedules belong to their member and explicitly
selected calendars. They never use the principal's legacy agenda snapshot.
Shared Budget excludes balances/debt/transactions; Meals are approved shared data;
family resources require explicit household sharing. Sharing preferences do not
publish events. Email suggestions need separate confirmation and sharing consent.

Current evidence and its limits:

- [Staging member Meals evidence](../docs/staging-member-meals-evidence.md).
- [Meals commissioning requirements](../docs/member-meals-commissioning.md).
- [Staging automation and permissions](../docs/staging-google-automation.md).
- [Calendar review remediation](../docs/calendar-review-remediation.md).

Before calendar activation: close source-review findings, promote and verify an
exact staging backend artifact, configure staging-only clients/encryption and
callbacks, and commission consenting Google/Microsoft test accounts. Exercise
wrong-member/session/household, replay, revoked membership/consent, concurrency,
refresh, uncertain writes, disconnect, pagination, recurrence, DST and all-day
semantics. Synthetic browser tests do not establish provider acceptance.

Before production/Julie: preserve John's immutable identity binding during the
production Clerk migration; verify exact backend artifacts, installed trigger
impact and rollback; settle production gate policy; finish outstanding Meals
cases; supervise Julie invitation claim, allowed/denied operations, revoke/restore,
preferences and her own connections. Daily-use pilot approval remains separate.
