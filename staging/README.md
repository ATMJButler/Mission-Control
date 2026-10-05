# John's isolated staging targets

Sheet: `18eft4EyxSy1lCtydd5dwuu20iMiJOBV0AAiHq4gu05Y`
Apps Script: `1dxTX6HWorvrR76H6idiNH2Q4BNsRo-U2YjtADfSjoXsPwd3OrfZLzDcV`

The manual **Stage Test Apps Script** workflow pushes current main's stamped
canonical backend plus `StagingSetup.gs` to this test project only and creates an
immutable version. It never deploys a Web App or targets the production project.
The existing production workflow does not include the staging initializer.

After workflow success, the owner opens this staging Apps Script project,
selects `initializeStagingTestData` in the function dropdown, runs it once and
accepts the Google authorization prompt. It requires the exact bound sheet and
script IDs and an empty sheet, creates synthetic fixture tabs, generates a
separate service token privately, and leaves every feature gate disabled.
Existing initialization, nonempty sheets or incorrect bindings fail before writes.
Partial initialization is not automatically repaired or deleted; inspect the
staging sheet if a run fails. Do not rerun on a populated sheet.

Do not send the generated `SYNC_TOKEN` in chat. It will be transferred directly
from staging Script Properties into the dedicated staging Vercel environment
when that environment is prepared. No production token or data is copied.
No identity is inferred from the Google account running the initializer.
Authenticated staging provisioning and test Web App deployment are later steps.
See `docs/member-meals-commissioning.md` for the runtime acceptance matrix.
