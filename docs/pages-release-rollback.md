# GitHub Pages release and rollback

1. Before merging, record the current Pages deployment commit and the candidate commit. Download the modular backup as an administrator, verify that it contains both local and indexed entries, and record the time of the export.
2. Verify the candidate with admin and guest accounts on desktop and mobile. Check that opening a module and a lesson fetches only the required data, and verify saving, conflicting edits, revision restore and backup. Confirm the legacy snapshot and the active modular content have been reconciled before switching.
3. Verify the existing Pages URL after deployment. If login, content or editing fails, revert the release commit through a regular Git commit and let Pages redeploy. Keep a modular export containing any edits made after release so they can be reconciled.
4. Verify the legacy URL and accounts after rollback. Leave the database intact during a code rollback. Only restore specific database rows if verification identifies a data issue and the newer changes have been preserved.

The existing Supabase table `kf_modular.release_baseline_20261124` contains the legacy published page and snapshot from November 24. Treat it as a reference point. Capture and validate an up-to-date export before release because the baseline predates later edits.
