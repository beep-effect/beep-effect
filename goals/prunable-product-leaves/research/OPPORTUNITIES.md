# Prunable product leaves: friction receipts

Receipts recorded while the work happened. Secrets, home paths and machine
identifiers are redacted.

## 2026-11-18: a goals doctor fixture passed locally only because the temp root had a stray `.git`

- **Doing:** seam 1b, the goals doctor test "skips a back-link into a pruned
  exploration, and reports an undeclared or kept one" (#3392).
- **Evidence:** hosted `Test Unit (repo-cli-3)` failed on two heads at
  `declared.exit.pipe(Exit.isSuccess, assertTrue)` while every local run
  passed, under Bun and Node and with the CI shard (`--shard=3/9`). The doctor
  failed with `NoSuchFileError` "Could not find repository root (looked for
  .git, bun.lock)": the exploration back-link check resolves the exploration
  from `findRepoRoot()`, and the fixture had no root marker. Locally the
  session temp root (`~/.cache/...`) held an empty `.git` directory left by
  some earlier run, so `findRepoRoot()` stopped there. The runner's `/tmp` has
  none. A fresh temp root without a marker reproduced the failure every time.
- **Would have prevented it:** temp-directory test fixtures that write the
  root marker a checkout has (here `bun.lock`) whenever the code under test
  locates the repository root. Running a doctor test with `TMPDIR` set to a
  fresh empty directory reproduces the hosted condition locally.
