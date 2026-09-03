# P2 Professional Desktop measurement bundle

This directory is the tracked, redacted raw-sample bundle for the Professional
Desktop P2 import pilot measured on 2026-09-03. The paired source state was
commit `a1652c1923eee0c33d9015da7fbf30449fa8269f`; dependencies and tool versions
were held fixed between states.

The valid sample sets are:

- 15 source-program tsgo runs per state after the one permitted symmetric
  extension, including wall time, maximum RSS, and full extended-diagnostic
  counters;
- 7 scripts-program tsgo runs per state;
- 7 cold canonical-route readiness runs per state;
- 15 cold single-file Vitest runs per state after the same symmetric
  extension;
- 5 cold Vite builds and deterministic bundle-byte rows per state; and
- one complete package check and one filtered, all-miss Turbo check per state.

Every source-program run reports exactly 10,257 files before and 10,256 files
after. The machine-local `.beep` evidence also preserves rejected diagnostic
attempts, including the attributable missed-pipeable errors and an invalid
extension from a sibling worktree whose compiler graph contained 10,325 files.
Those attempts are not part of the tracked valid sample set or its summaries.

See [`../p2-pilot-verdict.md`](../p2-pilot-verdict.md) for the threshold math,
correctness results, and the normative `inconclusive — stop` decision.
