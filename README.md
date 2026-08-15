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
