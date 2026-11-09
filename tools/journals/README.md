# Journal check and sync

`sync_journals.py` validates the three root journals (`GAME_VISION.md`,
`PROJECT_STATE.md`, `LEARNING_LOG.md`) and, when enabled, mirrors only those
files plus `sync-manifest.json` (source repository, branch, revision, commit
date, export time, SHA-256 hashes) to a separate private GitHub repository.
No source code, assets, logs or diffs are copied, and it never writes to this
repository. No AI model runs in CI.

## What runs

- `.github/workflows/journal-check.yml` (pull requests to `main`/`master`, manual):
  runs the tool's tests, checks the journals exist, are committed, contain no
  obvious secrets or local paths, and that `PROJECT_STATE.md` changed whenever
  the PR changes anything outside the journals, this tool and the paths in
  `state-exempt.txt`.
- `.github/workflows/journal-sync.yml` (push to the default branch, manual):
  repeats the check against the pushed range, does a dry run, and publishes
  only when the `JOURNAL_SYNC_ENABLED` variable is `true`. If the previous tip
  is gone (force-push) the coverage check is skipped with a warning; file
  validation still runs.

A local merge that is never pushed does not trigger anything.

## Local use

    python tools/journals/sync_journals.py check
    python tools/journals/sync_journals.py check --base <full commit sha>
    python -m unittest discover -s tests/journals -p "test_*.py"

## Activation (owner steps)

1. Create the private destination repository (proposed: `jjgp13/indie-studio-journals`)
   with a README linking the `Futbolito3D/`, `Metic99/` and `ScooterBoy/` folders.
   The tool refuses to publish to a public repository. Do not change any game
   repository's visibility.
2. Create a GitHub App with repository permissions Contents read/write and
   Metadata read, installed only on the destination repository.
3. In this repository's Actions settings add:
   - variables `JOURNAL_PROJECT` (exactly `Futbolito3D`, `Metic99` or `ScooterBoy`),
     `JOURNAL_REPOSITORY` (`owner/name` of the destination), `JOURNAL_APP_ID`;
   - secret `JOURNAL_APP_PRIVATE_KEY`.
   Leave `JOURNAL_SYNC_ENABLED` unset at first: the sync workflow then only validates.
4. Run "Journal check" and "Journal sync" manually and confirm the dry run passes.
5. Set `JOURNAL_SYNC_ENABLED` to `true`, run "Journal sync" again, then read back the
   destination's three journals and `sync-manifest.json` and compare the revision and hashes.
6. Optional: make "Journal check" a required status check (a separate repository rule).

If the destination's branch rules require pull requests, the publisher must be adapted
to open one; it does not bypass repository rules. Actions minutes on private
repositories count against the account's plan.
