# Friction ledger — boolean-creep

Receipts recorded at the moment of friction (repo law: friction is a
first-class output). Public repo: paths relative, no secrets, no session ids.

## 2026-08-17 — headless grok lane dropped an evaluated record

- **Doing:** round-1 inventory sweep, ontology-mcp lane (headless grok,
  streaming-json).
- **Evidence:** the lane's thinking stream drafted a full disqualified record
  for `ToolbarState` (`packages/ontology/ui/src/aggregates/Session/Session.document.tsx`)
  but ended its turn (`stopReason: end_turn`) without ever issuing the append
  tool call; the report file held 1 record while the stream showed 2
  decisions. Recovered by replaying the raw transcript and appending after
  orchestrator re-verification.
- **Prevention:** the lane prompt now pins append discipline — "APPEND your
  record IMMEDIATELY after deciding each suspect, BEFORE opening the next
  file; every suspect you read code for MUST produce exactly one appended
  record" (rounds 2+). Keep raw transcripts always: they are the recovery
  layer, not telemetry.

## 2026-08-17 — raw `codex exec` does not take `--effort`

- **Doing:** launching the P2 design batches on codex CLI.
- **Evidence:** all six batches failed instantly with
  `error: unexpected argument '--effort' found` (codex v0.147.0). The
  `--effort` spelling belongs to the Codex *plugin* delegation interface; the
  raw CLI takes the config override `-c model_reasoning_effort=medium`.
- **Prevention:** in scripts, pass effort as
  `codex exec -c model_reasoning_effort=<level> ...` and smoke-test one job
  before fanning out (the early transcript peek caught this within seconds).

## 2026-08-17 — block comment terminated by a glob in prose

- **Doing:** writing `ops/validate-inventory.ts`.
- **Evidence:** the JSDoc header contained `data/sweeps/round*/*.jsonl`; the
  `*/` inside the glob closed the block comment and bun failed with
  `error: Unexpected *` at the comment line.
- **Prevention:** never write `*/` inside block comments — spell globs as
  "files under data/sweeps/" or use line comments for path patterns.

## 2026-08-23 — merge commit hook assumed an installed worktree

- **Doing:** merging `origin/main` into the PR branch from a fresh isolated
  worktree before the mergeability repair loop.
- **Evidence:** the conflict-free merge paused at `commit-msg` because
  commitlint could not resolve `@commitlint/config-conventional`; installing
  the frozen lockfile allowed the unchanged merge commit to complete.
- **Prevention:** install the locked workspace dependencies before creating a
  merge commit in a fresh worktree, or make the hook report that prerequisite
  before invoking commitlint.

## 2026-08-23 — pinned Bun installation reported a different runtime

- **Doing:** regenerating `bun.lock` after removing a deleted ghost workspace.
- **Evidence:** the repo pins Bun 1.3.14, but the executable installed under
  that version reported 1.4.0; `bun install` removed 66 unrelated lock entries
  in addition to the target workspace. The unrelated churn was restored, and
  the focused lockfile passed `bun install --frozen-lockfile`.
- **Prevention:** have agent bootstrap verify the resolved Bun executable's
  reported version against `.bun-version` before any lockfile-writing command.

## 2026-08-23 — full local Yeet proof omitted hosted blocking lanes

- **Doing:** proving the repaired PR head locally before publishing it.
- **Evidence:** `bun run beep yeet verify` passed every planned lane, but the
  hosted `Property Laws` and `Coverage Regression` checks later failed; neither
  lane appeared in the local 25-lane verdict. The property failure was a
  load-sensitive mention-unmount race that passed 10 consecutive focused
  reruns locally, while coverage reported concrete uncovered units.
- **Prevention:** make the full Yeet plan include every required hosted quality
  lane, especially property tests and coverage, or report those omissions as
  explicit unproven gates before allowing publish proof reuse.

## 2026-08-23 — Yeet suggested a retired CI lane id

- **Doing:** refreshing the stale JSDoc CI inventory reported by
  `bun run beep yeet status --remote`.
- **Evidence:** Yeet prescribed `bun run beep ci lane jsdoc-inventory`, but the
  CLI rejected that id; live `CiLane.ts` shows the inventory is produced by the
  `jsdoc-ratchet` lane before its ratchet step.
- **Prevention:** derive the staleness remediation command from the registered
  CI lane descriptor, or update the gate descriptor to prescribe
  `bun run beep ci lane jsdoc-ratchet`.

## 2026-08-23 — hosted property depth exceeded the local Yeet proof

- **Doing:** monitoring the first hosted run after an exact-head local Yeet
  verification.
- **Evidence:** the hosted Property Laws lane found a Tika error round-trip
  equivalence failure after 153 tests with seed `20260708` and path `152`;
  the same commit's 25-lane local Yeet plan had passed without running that
  hosted property depth.
- **Prevention:** include the hosted property command and its configured run
  count in local Yeet verification, and print the deterministic seed and path
  in the local verdict so a counterexample can be replayed exactly.

## 2026-08-23 — shared mock crossed concurrent Effect tests

- **Doing:** adding stable coverage for the desktop Tauri IPC writer.
- **Evidence:** the instrumented package suite ran four `it.effect` cases
  concurrently; their shared hoisted `invoke` mock interleaved calls, causing
  three contradictory call-count failures despite each behavior passing alone.
- **Prevention:** mark suites that mutate a shared hoisted mock sequential, or
  give each concurrent case an isolated dependency layer instead of shared
  module-level mock state.

## 2026-08-23 — detached-head Semgrep preflight lost its Git worktree

- **Doing:** running clean-head Yeet verification from an isolated worktree.
- **Evidence:** Semgrep reported `fatal: not a git repository` while trying to
  configure `safe.directory` against the original checkout's worktree metadata;
  the scan still completed with zero findings.
- **Prevention:** create detached verification worktrees from a stable Git
  common directory, or pass Semgrep a validated repository path instead of a
  worktree metadata path that can disappear during preflight cleanup.

## 2026-08-23 — captured child watchdog started after the missing event

- **Doing:** closing PR 764 after `Lint Policy` twice consumed its full hosted
  50-minute timeout.
- **Evidence:** both failed jobs logged 25 of 26 policy steps complete;
  `lint:native-runtime` never returned, and runner cleanup killed six nested
  Bun processes. `runCaptured` bounded a pipe only after the direct child's
  `exitCode`, so a wrapper whose exit signal never arrived had no deadline.
- **Prevention:** invoke repo CLI policy children without the package-script
  wrapper, ignore stdin for noninteractive capture, and bound the full child
  lifetime with explicit process-group cleanup before the workflow timeout.

## 2026-09-03 — completed design review went stale before its user gate

- **Doing:** preparing the reviewed boolean-creep designs for GATE 2
  ratification against current `main`.
- **Evidence:** `git diff --name-only ff2184e6b3..HEAD` intersects 27 of the 46
  primary inventory files and 63 source/test paths cited by the designs. The
  Tier 2 `yeet-merge-ready-verdict` design still models three criteria and
  `checksGreen`, while live `Verdict.ts` now models eight hard criteria and
  `requiredChecksGreen`; the packet's previous zero-findings claim is no
  longer current proof.
- **Prevention:** bind design-review evidence to a source commit and run an
  automatic cited-path drift check immediately before each ratification gate;
  reopen review whenever a cited path changed instead of presenting stale
  designs as gate-ready.

## 2026-09-03 — ontology public barrel topology drift

- **Doing:** reclassifying `ontology-inference-recompute-cause` against the
  current RPC request/response surface.
- **Evidence:** the live ontology package has pre-existing `/public`
  export-boundary drift that is broader than the recompute-cause model and its
  compatibility codec.
- **Prevention:** open a separate architecture opportunity for the ontology
  barrel topology. Do not turn the boolean-creep singleton into an unrelated
  public-export rewrite; migrate only the decoded consumers and wire codec
  required by this record.

## 2026-09-03 — Grok sweep max-turn exhaustion destroys the transcript

- **Doing:** running the unseeded moving-main current-corpus sweep with the
  packet's existing bounded lane runner.
- **Evidence:** several high-density lanes appended valid inventory records,
  then exited 127 at their turn ceiling and replaced their streaming transcript
  with only `run-sweep-lane.sh: line 54: max-turns: command not found`.
- **Prevention:** treat a nonzero lane as incomplete even when its report is
  schema-valid. Resume it in a named continuation lane seeded from the partial
  report, retain the report as evidence, and require a clean exit before the
  area can contribute to a dryness round. The round driver now records every
  `wait -n` result and exits nonzero if any child failed; previously its final
  successful child could mask earlier failures. The runner should eventually
  detect this Grok failure mode and preserve the prior stream separately.

## 2026-09-03 — live lane scripts were mutable beneath Bash

- **Doing:** tightening the sweep runner's default scratch location while five
  residue lanes were still executing that same script.
- **Evidence:** after one Grok child returned, its long-lived Bash wrapper
  reported `syntax error near unexpected token '&'` even though the current
  file parses cleanly; the script had been replaced on disk while Bash still
  had later source to read. The lane transcript and partial report survived,
  but its wrapper exit was not valid completion evidence.
- **Prevention:** treat an active runner as immutable. Finish or interrupt all
  processes before patching it, or launch lanes from a content-addressed copy
  so later packet edits cannot alter the executable beneath a live shell.

## 2026-09-03 — broad residue lane exhausted the model output budget

- **Doing:** running the round-3 drivers, architecture-lab, ecosystem, and
  internal-package residue lane against exact `main` after earlier census
  admissions were seeded.
- **Evidence:** the lane accumulated 3,083,330 model tokens across 25 turns,
  entered an exact-repetition loop while enumerating remaining package
  families, and exited nonzero with `response truncated by max_tokens`; its
  report was empty, so the otherwise-complete four-lane round is inadmissible.
- **Prevention:** partition high-cardinality source families into bounded lanes
  before launch, preserve the failed transcript as evidence, and require every
  replacement partition to exit zero at the same source SHA before treating
  the parent area or round as complete.

## 2026-09-03 — concurrent Grok lanes stranded after inference-idle startup

- **Doing:** running five round-2 residue lanes concurrently against exact
  source SHA `58e063757b2440ae1a358cb410ed6a14acfcaf33`.
- **Evidence:** the domain lane completed with exit zero and no records, while
  the other four transcripts stopped after `inference idle timeout after 300s
  with no chunks` during title generation and emitted no further bytes for
  nine minutes. A serial resumed Apps retry reached five tool-using turns, then
  exited with `The model is currently at capacity due to high demand`; its
  report remained empty and is not credited.
- **Prevention:** preserve the completed lane and raw failed transcripts, stop
  the non-evidentiary holders, and replay only the missing lanes serially at
  the same source SHA. Add bounded startup-idle detection to the runner so
  a stranded lane fails explicitly and can enter the continuation path.

## 2026-09-03 — serial exact-main Grok retry also hit provider capacity

- **Doing:** restarting the required residue census serially after merging the
  latest `origin/main` into the packet branch.
- **Evidence:** the first tooling lane at source SHA
  `a1652c1923eee0c33d9015da7fbf30449fa8269f` made one tool-using model turn,
  then exited nonzero with `The model is currently at capacity due to high
  demand` before it could create its report. The lane is not credited.
- **Prevention:** make the runner's model/service tier configurable, bound
  provider retries independently of scan turns, and support small resumable
  source partitions so a transient terminal failure does not discard a full
  high-density lane attempt.

## 2026-09-03 — desktop continuation terminated a live sweep subprocess

- **Doing:** running the bounded repo-CLI command-family partition of the
  exact-main residue census in a persistent unified terminal session.
- **Evidence:** after the thread continued, the terminal handle was unknown,
  no matching Grok or lane-runner process remained, and the saved transcript
  ended mid-read without an `end` event; the zero-line report therefore cannot
  count as a dry result.
- **Prevention:** keep each partition independently restartable from its named
  Grok session and report, and teach the desktop continuation path to preserve
  unified terminal subprocesses or deliver an explicit terminal interruption
  result. Never infer a dry lane from an empty report without exit-zero proof.

## 2026-09-03 — broad exact-main lanes exhausted output and provider budgets

- **Doing:** completing the second post-admission residue sweep before the
  independent GATE 2 design review.
- **Evidence:** the drivers/architecture and foundation lanes exited nonzero
  with `response truncated by max_tokens` after 26 and 32 turns and produced
  empty reports. A fresh replacement lane then failed before analysis with
  HTTP 402, `Grok Build usage balance exhausted`. None of those lanes is
  credited toward convergence.
- **Prevention:** split foundation and drivers/architecture into smaller
  source-family partitions before launch, retain nonzero transcripts under
  distinct retry names, and preflight provider balance before starting a
  multi-lane gate. A round becomes admissible only after every replacement
  partition exits zero at the same source SHA.
