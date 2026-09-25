# Harness Evidence Ledger Plan

## Status

Status: `in-progress`. P0 is complete. P1 is next.

## Phases

| Phase | Status | Goal | Exit criteria |
| --- | --- | --- | --- |
| P0 Research | complete | Map RRSI against repo packets and code; lock decisions. | D1 to D14 recorded in `SPEC.md`; sources in `research/SOURCES.md`. |
| P1 Schemas + ledger CLI + hook-pulse surface + scorer fixes | pending | Build the typed row, the writer, the observation, and the scorer fixes. | P1 acceptance checks below pass. |
| P2 Rerun | pending | Run the annealed-budget SkillOpt rerun detached overnight; record results, first ledger rows, and pruning proposals. | P2 acceptance checks below pass. |
| P3 Yeet PR1 to mergeable | pending | Ship the packet, schemas, CLI, hook-pulse change, scorer fixes, and rerun config. | `merge-ready: yes` from `yeet monitor`; zero outstanding review threads. |
| P4 PR2 results + reflection | pending | Ship rerun results, first rows, pruning proposal output, and the reflection. | PR2 merge-ready; `lint reflection-artifacts` passes. |
| P5 Close | pending | Flip packet state and record the verdict. | Manifest and README status updated in the same PR as the final work. |
- Scorer sandbox floor: no lift claim until the fixture copy is self-contained (see `research/OPPORTUNITIES.md`, 2026-09-25); the step-1 accept at 0.9583 is leakage evidence, not lift.
- 2026-09-25 outcome: run stopped after step 2 (score saturated at 1.0 on sandbox repair + task leakage); two `proposed` ledger rows filed; verdict PARK the rerun until the scorer fixture copy is self-contained and a diff screen exists (`history/p2-rerun/FINDINGS.md`).

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

## P4 PR2 results + reflection

Ship the rerun results and the first rows. Include pruning proposal output only
after the current-harness session gate described in P2 is implemented.
Write the reflection with the `/reflect` skill.

Acceptance: PR2 merge-ready; `bun run beep lint reflection-artifacts` passes.

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
