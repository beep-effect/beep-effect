# Opportunities — practice-kg-mcp

Friction receipts, recorded when they happened.

## 2026-10-06 — P9 working-files bundle

- **Salvage hash reads files whole.** `beep corpus salvage` on a folder with an
  857 MB zip took the process past 12 GB and was OOM-killed three times (a
  5.5 GB zip passed 48 GB); two runs raised memory pressure for the whole
  desktop slice. Evidence: `Failed with result 'oom-kill'`, `48G memory peak`.
  Prevention: a streaming file hash; run heavy corpus stages outside the
  desktop's cgroup slice from the start.
- **Salvage and extract cannot resume.** Provenance and `sources.jsonl` are
  written only at the end; every retry started from zero and a killed salvage
  needs its partial output deleted first. Prevention: per-file completion
  records.
- **`corpus extract --source` filters by label across runs.** Two runs sharing
  `source-a` cannot be extracted separately. Prevention: a `--run-label` filter.
- **No extraction engine for `.eml` / `.msg`.** 1,890 saved emails came back as
  "No file-processing engine is available". Prevention: route both to Tika.
- **A shared landing folder was edited.** Moving oversize files out of the
  landing area broke another workstream reading the same tree. Prevention:
  treat landing areas as read-only; build a hard-link view for a subset.
- **Register-first attribution removed existing matters.** Caught only by
  diffing the old and new `matters` tables. Prevention: make that diff a step of
  `verify.ts` (`--compare-to <old bundle>`). Landed as D-25.
- **Cheap gates do not run the JSDoc lint.** A wrapped code span passed
  `yeet publish` and failed hosted Lint Policy 40 minutes later. Prevention: run
  the package `lint:jsdoc` on changed packages in cheap gates.
- **A fuller bundle dropped a membership nobody diffed.** `-03` withdrew one
  application from a matter's 9 dockets; my old-versus-new diff compared matter
  and docket keys only, so a consumer found it. Prevention: have `verify.ts
  --compare-to <old bundle>` report changed application and patent numbers per
  docket. Landed as D-25.

## 2026-10-07 — P11 mail archives

- **A bundle zip without empty directories does not open.** Zipping a bundle
  file by file dropped the 14 empty directories of `kg.pglite`; on the PC the
  self-check answered `could not be opened` / `PgliteClient: Failed to
  connect`. Caught only because the staged copy was self-checked before the
  switch. Prevention: package with directory entries, then extract the zip
  and run `--self-check` on the extracted copy before sending it; make that a
  packaging command of the app instead of a hand-written script.
- **Section order in JSDoc reaches hosted CI unseen.** A `**Details**`
  paragraph placed after an `**Example**` passed the package `lint:jsdoc` and
  the cheap gates, and failed the hosted JSDoc Ratchet
  (`section-after-example: 1 > 0`). Prevention: run the ratchet's totals
  check in the cheap gates for changed packages.
- **A merged PR left its own coverage red on main.** The P11 change merged
  with the Coverage Regression lane red on its own new file. Prevention: run
  the scoped coverage of new and changed files before calling a PR final.

## 2026-10-09 sitting closeout

- The worker brief referenced a Mechanics section and handoff filename but
  supplied neither. Its private inputs were read-only and work was restricted
  to the lane. Evidence: `practice-kg-sitting-closeout.md`, Report section.
  Prevention: validate the named sections and writable handoff/private-map
  destinations before dispatch. The private answer log retains the identifying
  IDs and their order; the orchestrator must archive the explicit alias map.
- `beep-heavy` could not reach the user manager without the runtime bus
  environment. Evidence: `Failed to connect to user scope bus` on the first
  package-verification launch. Setting the existing runtime directory and bus
  address let the approved wrapper run. Prevention: carry those settings into
  worker launches that use user-systemd scopes.
- The findings summary did not distinguish manifest-only provenance from a
  database lookup. The successful 01:06Z call had no reference; the failed call
  that followed used a document digest. Prevention: record query stage and
  input shape alongside the outcome. The lane stopped its first publication
  before push to correct the diagnosis.
- Yeet refused publication on inherited schema-first findings in Accounts and
  M365 and an inherited Effect-Vitest finding in the projection tests. All
  affected source files and inventories are unchanged against origin/main.
  The new Host test fixture initially added one Effect-Vitest finding; moving
  its resource setup into `it.layer` removed it without refreshing the baseline.
  Full host package audit/docgen passed after that repair. Evidence:
  `yeet publish`, `lint effect-vitest`, and the final package-verification log.
  Prevention: keep inherited policy repairs with the consolidated base owner
  and use suite-layer fixture setup for new tests.
