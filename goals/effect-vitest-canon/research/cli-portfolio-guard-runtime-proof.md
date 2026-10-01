# Portfolio index guard runtime and fixture proof

Nine native test callbacks now return Effects through the public instrumented
runner and a serial shared platform fixture. The four plain disposition tests
remain plain. Scoped filesystem acquisition replaces three callback wrappers;
seeded repositories retain the same Git setup, and the two symlink cases retain
their sibling outside-directory sentinels. No production behavior changes.

Each Effect callback receives a fresh console and live clock. The inspected
publish guard calls runGitPathList, whose structured capture reaches StepExec
capturePipeDeadline and its drain/reap sleeps. Live clocks preserve those native
process cleanup deadlines. Native filesystem provenance remains an open review.

Applied evidence:

- Node and Bun each pass all 13 tests with matching full-name multiplicities.
  All 32 assertion trees match, normalizing only trailing commas added by the
  formatter. The initial punctuation-sensitive comparison failed on that
  formatting change; no assertion was excluded from the corrected comparison.
- Actual package test-type diagnostics have empty output and exitCode 0.
- Body failure and interruption each produce nine intended failures and four
  passes on each runtime. Seeded-repository setup failure produces eight
  intended failures and five passes; outside-directory setup failure produces
  two intended failures and eleven passes.
- Every probe checks original cwd and the absence of every acquired directory
  after each test. All isolated temporary directories are empty after each run.
- Console probes pass 14 tests and observe nine distinct services. Clock probes
  pass 14 tests and observe nine advancing clocks through real Effect sleeps.
- All twelve phase/runtime runs reject unexpected assertion failures. The
  mutation harness restores the exact source bytes in its finalizer.

Whole-command observations are Node 5.675 -> 4.721 seconds and Bun
3.272 -> 2.668 seconds. Private receipts retain hashes, versions, load and
pressure. Baseline timing overlapped sync-data package verification; these
observations do not establish a causal performance improvement.

Nine historical runtime findings match original line/evidence and callback
identity. The original directory wrapper has one detector row; the other two
wrapper definitions do not justify additional row closures. Native-platform
review remains open. Root Oxlint passes; the root ratchet scans 1,217 files
and reports 2,899 findings, zero introduced and 2,123 resolved against the
unchanged baseline. The remaining native-platform occurrence is unchanged.

Source commit: `9d96c2670eb4fa55f58513279e9a7451ce1d4c54`.
Reconciliation closes exactly ten historical rows, adds none, and preserves
all unrelated rows. Strict validation passes for 3,495 CLI and 687 schema rows.
CLI totals are 1,946 fixed, 12 exceptions and 1,537 open. Full CLI package
verification passed: audit 666.8 seconds and docgen 20.5 seconds. This is not
goal-wide or hosted acceptance.
