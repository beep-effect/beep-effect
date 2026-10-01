# Harness Evidence Ledger Plan

## Status

Status: `complete`. All phases are complete as of 2026-09-29.

## Phases

| Phase | Status | Goal | Exit criteria |
| --- | --- | --- | --- |
| P0 Research | complete | Map RRSI against repo packets and code; lock decisions. | D1 to D14 recorded in `SPEC.md`; sources in `research/SOURCES.md`. |
| P1 Schemas + ledger CLI + hook-pulse surface + scorer fixes | complete | Build the typed row, the writer, the observation, and the scorer fixes. | P1 acceptance checks below pass. |
| P2 Rerun | complete | Run the annealed-budget SkillOpt rerun detached; record results, first ledger rows, and pruning output. | P2 acceptance checks below pass. |
| P3 Yeet PR1 to mergeable | complete | Ship the packet, schemas, CLI, hook-pulse change, scorer fixes, and rerun config. | `merge-ready: yes` from `yeet monitor`; zero outstanding review threads. |
| P4 Closing PR: results + reflection | complete | Ship the regime gate, the rerun controls, the rerun results, the recorded rows, the pruning output, and the reflection. | Closing PR merge-ready; `lint reflection-artifacts` passes. |
| P5 Close | complete | Flip packet state and record the verdict. | Manifest and README status updated in the same PR as the final work. |

## Outcomes

- 2026-09-25, P2 first run (`history/p2-rerun/FINDINGS.md`): stopped after step
  2 with the score saturated on sandbox repair and task leakage. Two `proposed`
  rows filed. Verdict then: park until the scorer fixture copy is
  self-contained and a diff screen exists.
- 2026-09-26, PR1 (#1253) merged: packet, schemas, CLI, hook-pulse `surface`,
  scorer fixes, rerun config, and the stopped run's evidence.
- 2026-09-29, closing PR: the scorer runs its lanes in its own sandbox, the
  rerun tool screens candidates before evaluation and measures baseline noise,
  hook-pulse stamps the harness hash on `SessionStart`, and `prune-proposals`
  counts only sessions in the current regime and can write.
- 2026-09-29, P4 rerun (`history/p4-rerun/FINDINGS.md`): baseline 0.9167 with a
  measured spread of 0.0833; four of six candidates screened out before
  evaluation; two gate accepts, both inside the noise band; stopped at
  saturation in step 7. Eight candidate rows and two rows for this PR's own
  harness edits recorded. Verdict: close the rerun, adopt no trained skill; the
  corpus has no headroom at this model strength.
- The operator admitted hook-pulse on `SessionStart` in `.claude/settings.json`
  on 2026-10-01 (row `hl-20261001-5faf29a0` accepts `hl-20260929-475be43a`).
- The operator disposed the four candidate rows on 2026-10-01: the two P2
  rows `rejected`, the two rerun accepts `deferred` until a corpus with
  headroom.

## P0 Research (complete)

Done in the 2026-09-25 grill session. Four research lanes mapped the paper,
the prior literature, repo prose, and repo code. Maps are listed in
`research/SOURCES.md`.

Acceptance:

- D1 to D14 are locked with rejected options.
- The paper's relation to this repo is recorded: convergent prior art,
  repo packets predate it.

## P1 Schemas + ledger CLI + hook-pulse surface + scorer fixes

Order is schema, then service contract, then implementation.

1. **Schemas** in `@beep/ai-metrics`: `ContextSurface`, `MechanismClass`,
   and `LedgerDisposition` LiteralKits; `HarnessFingerprint` built from the
   config-snapshot hashes plus model id and reasoning effort; `HarnessLedgerRow`.
   Derived predicates: `isHarnessEdit`, `requiresBudget`, `isStale`,
   `isWarmRestart`, and the cosine `editBudget`.
2. **Ledger CLI** under `packages/tooling/tool/cli/src/commands/HarnessLedger/`:
   `propose`, `disposition`, `list`, `prune-proposals`. `propose` captures the
   fingerprint at creation and prints the row id for the
   `Harness-Ledger: <rowId>` trailer.
3. **Ledger surface** `harness-ledger/` with its laws README.
4. **hook-pulse** gains an optional hashed `surface` on PostToolUse rows for
   Skill calls and for Read/Edit/Write under the harness roots.
5. **Scorer fixes**: `configSnapshotId` becomes the fingerprint id;
   `evaluateLaw` runs schema-first and Biome concurrently, then tsgo.
6. **Rerun config** `tools/skillopt/configs/beeplaw.rerun-2026-09.yaml`:
   cosine 4 to 1, 3 epochs, 4 workers, Opus optimizer, `claude_code_exec` target,
   output under this packet's `history/`.

Acceptance:

- Schema round-trip and predicate tests pass. `isWarmRestart` is false for
  effort-only and harness-only changes.
- `propose` writes a row; `disposition` appends a new row that references the
  prior `rowId`; `list` shows both. No row is ever edited in place.
- Editing a skill file flips `isStale`.
- A Skill call yields a hook-pulse row with `surface` set. A product-only
  session yields none. No path appears in any row.
- `evals score` produces a `configSnapshotId` that changes with AGENTS.md and
  not with the score.
- `bun run beep quality package-verify @beep/ai-metrics` and the CLI package
  pass.

## P2 Rerun

Launch detached and overnight. Local only, never inside a Codex sandbox. Full
logs, no tail pipes on verdict-bearing commands.

Acceptance:

- The run completes all 3 epochs or stops with a recorded failure.
- Results land under `history/` with per-epoch scores, accepted and rejected
  edits, and wall time per step.
- Each evaluated candidate edit becomes one ledger row via the CLI, with its
  disposition. Rejected edits stay as negative evidence.
- Scorer wall time per task is compared with P5's roughly 2 minutes.
- Defer pruning proposal evidence until hook-pulse stamps the harness hash at
  SessionStart and the scan filters sessions by the current hash. Then save
  `bun run beep harness-ledger prune-proposals --window 30` output for P4.
- The current read-only scan is diagnostic and spans mixed harness regimes;
  it is not current-harness evidence. Writes remain blocked until the gate exists.
- Proposals have disposition `proposed`. Nothing is applied.

## P3 Yeet PR1 to mergeable

`bun run beep yeet repair`, `verify`, `publish --pr`, then
`monitor --until-ready`. Apply `ready-for-heavy` once tier 1 is green. Answer
every review thread. Do not merge; the operator merges.

Acceptance: `merge-ready: yes`; zero outstanding review threads.

## P4 Closing PR: results + reflection

One PR carries the remainder (operator instruction, 2026-09-29; see the
2026-09-29 routine calls in `SPEC.md`). It ships the current-harness session
gate described in P2, the rerun results, the recorded rows, and the pruning
output. Write the reflection with the `/reflect` skill.

Acceptance: the closing PR is merge-ready; `bun run beep lint
reflection-artifacts` passes.

## P5 Close

Flip the manifest phases and `initiative.status`, update README status and
latest evidence, in the same PR as the final work.

Acceptance: `bun run beep goals doctor` and `bun run beep lint goal-packets`
pass; the verdict is recorded in `README.md`.

## Closeout Checklist

1. Write a closeout reflection via the `/reflect` skill to
   `history/reflections/<YYYY-MM-DD>-<agent>.md`.
2. Run `bun run beep lint reflection-artifacts`.
3. Update `README.md` and `ops/manifest.json` phase statuses and
   `initiative.status`.

## Execution Notes

- Preserve unrelated worktree changes.
- Keep `SPEC.md` normative. Change it only when the contract changes.
- Record friction receipts in the evidence-loop ledger at the moment they
  happen.

## Verification Commands

```sh
test "$(wc -m < goals/harness-evidence-ledger/GOAL.md)" -le 4000
jq . goals/harness-evidence-ledger/ops/manifest.json
rg -n "harness-evidence-ledger|GOAL.md|agentLaunchers|packetAnchorDocument" goals/harness-evidence-ledger
git diff --check -- goals/harness-evidence-ledger harness-ledger
bun run beep lint goal-packets
bun run beep lint reflection-artifacts
```
