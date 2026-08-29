# Opportunities

## 2026-08-27 — repair continued into full docgen after cheap-gate blockers

- **Work:** Running `bun run beep yeet repair` after implementing the typed
  patent-document vertical slice.
- **Evidence:** The cheap-gates tier reported goal-manifest and generated-alias
  drift, but repair continued into a full 130-package docgen rerun before those
  blocking inputs could be corrected.
- **Prevention:** Short-circuit expensive feedback work while cheap-gate
  blockers remain, or defer full docgen until the repaired cheap gates pass.

## 2026-08-27 — scheduler status documentation omits a required flag

- **Work:** Checking machine-wide admission state before a focused coverage
  run, following the command in the Yeet skill.
- **Evidence:** `bun run beep quality scheduler status` exited with
  `Missing required flag: --json`, although the skill documents that command
  without the flag.
- **Prevention:** Either make human-readable output the default for `scheduler
  status` or update the skill to include `--json`.

## 2026-08-28 — review-fix proof omitted two full-proof cheap gates

- **Work:** Publishing the reviewed patent-document fixes after the
  scheduler-controlled review-fix tier passed its repository-wide lanes.
- **Evidence:** The next full proof stopped at `effect-imports` and
  `schema-first`: two changed imports needed the canonical migration, and the
  expanded schema test file needed schema-derived property coverage.
- **Prevention:** Run the full proof's import-governance and schema-first cheap
  gates before the review-fix tier starts its expensive repository-wide test
  and docgen lanes.
