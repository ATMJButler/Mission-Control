# Mission Control V4

V3 is the decision-engine rebuild.

## Major improvements
- Projects are separated from Actions.
- Every project has an attention state: Needs John, Moving, Waiting, Parked, Complete.
- Last-touched aging is visible.
- Home screen is opinionated and tells you what needs you now.
- "What changed since yesterday" delta view.
- Outcome + Definition of Done on every project.
- Formal project dependencies.
- Capture Inbox for unprocessed thoughts.
- Weekly Review workflow: Continue, Needs Me, Wait, Park, Complete, Kill.
- Momentum / Wins view.
- Search + filters across area, status, priority, attention, dependencies.
- Current next action remains the most prominent project field.
- V2-style imports are migrated with sensible defaults.
- Export/import for portability.
- Local-first architecture remains ready for a future shared Google/API source.

## Use now
Double-click index.html in Chrome.

## Recommended next step
Use V3 for several days and capture real friction. The next engineering milestone should be shared live data, not more UI polish.


## V4 changes
- Shared project data through a normal Google Sheet.
- Edits in Mission Control push to the shared Projects sheet.
- Edits made in the shared Projects sheet are pulled back into Mission Control.
- Automatic refresh every 60 seconds while Mission Control is open.
- Local storage remains an offline/fallback cache.
- Mobile layout: fixed bottom navigation, larger tap targets, single-column controls, mobile sheet-style modals, and swipeable/snap area lanes.

## Turn on shared project data
1. Create a Google Sheet named **Mission Control — Shared Data**.
2. Open **Extensions → Apps Script** and paste `google_apps_script_Code.gs`.
3. Change `SYNC_TOKEN` to a long private value.
4. Run `setupSheet()` once and approve permissions.
5. Deploy → **New deployment → Web app**. Execute as **Me** and allow **Anyone**.
6. Copy the deployed `/exec` URL.
7. In Mission Control → **Settings**, paste the Web App URL and the same token.
8. Click **Sync Now**.

The `Projects` tab is a regular table on purpose, so Mission Control, manual Google Sheet edits, and connected assistant workflows can work against the same records.

**Conflict rule:** current V4 is last-write-wins. Avoid editing the same project in two places at the exact same time.

## V5 improvements
- Dashboard count cards are clickable and drill into the projects behind the number.
- New **Recently Changed** view showing the latest project state, timestamp and update source.
- Stale projects are visibly badged and can be filtered directly.
- New **Today** focus view computes what deserves attention from priority, Needs John, deadlines, milestones, follow-ups, waiting age and staleness.
- Conflict-safe shared sync adds `lastUpdatedAt` and `lastUpdatedBy` so a stale browser copy does not silently overwrite a newer Sheet edit.
- Service worker cache updated so new Mission Control versions refresh more reliably on phones.

### V5 Apps Script upgrade
Replace the Apps Script code with `google_apps_script_Code.gs`, but **keep your existing private SYNC_TOKEN value**. Save it, then update the existing Web App deployment to a new version. Do not run `setupSheet()` unless you intentionally need to repair headers.
