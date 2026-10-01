# P4 rerun: with the scorer fixed, the baseline skill has no headroom to measure

2026-09-29. Config `tools/skillopt/configs/beeplaw.rerun-2026-09-29.yaml`
(cosine edit budget 4 -> 1 over 12 steps, 3 epochs, 4 rollout workers, 2
analyst workers, `claude_chat` optimizer and `claude_code_exec` rollout target,
both pinned to `claude-opus-5-5`, pre-evaluation screen on, 3 baseline noise
passes). Same 8 train / 4 validation corpus as P5 and P2. The scorer is the
sandboxed one from this PR, so scores are not comparable with P5 (0.4714) or
P2 (0.5015).

## Result

```text
baseline noise   0.9583  0.9583  0.8750   spread 0.0833 (3 passes, same inputs)
loop baseline    0.9167
step 1   screen REJECT  evaluation-environment-fitting      not evaluated
step 2   gate ACCEPT    0.91666675 > 0.9166665   delta +0.00000025
step 3   screen REJECT  task-leakage                        not evaluated
step 4   screen REJECT  evaluation-environment-fitting      not evaluated
step 5   screen REJECT  evaluation-environment-fitting      not evaluated
step 6   gate ACCEPT    1.0000 > 0.91666675      delta +0.0833
stopped in step 7 by the runbook stop rule: the selection score is 1.0 and
the gate is strict-greater, so no later candidate could be accepted.
```

Wall time 18 minutes from launch to stop. 38 rollout workspaces, 37 scored
rollouts, zero scorer environment failures.

Artifacts here: `steps.jsonl`, `screen-log.jsonl`, `rescreen.jsonl`,
`baseline-noise.json`, `ledger-rows.json`, `prune-proposals.txt`,
`run-summary.log`, and `skills/skill_v0000.md`, `skill_v0002.md`,
`skill_v0006.md` (the three distinct skill versions). Raw `out/` and
`run.log` are git-ignored.

## Reading

1. **The P5 and P2 baselines measured the sandbox.** With lanes that judge
   only the agent's source, the untouched baseline skill scores 0.875 to 0.958
   on the validation items. P2's step-1 "lift" to 0.9583 is the same number the
   baseline reaches here with no edit at all. P5's finding that appended
   guidance degraded validation rested on the same floor and should not be
   cited.
2. **Neither accept is lift.** Step 2 won by 0.00000025, a gap made by
   six-decimal rounding of per-item scores. Step 6 won by 0.0833, which is
   exactly the measured baseline spread and is one item moving from 0.8333 to
   1.0. Both rows are recorded with `within_baseline_noise: true`.
3. **The corpus has no headroom for this model.** Four validation items, each
   worth 0.25 of the mean, with a baseline at 0.92: the largest measurable gain
   is one noise-width. The loop cannot show lift on this corpus with Opus 5.5
   whatever the edit budget does. The annealed budget is untested, not
   refuted.
4. **The screen did its job and saved spend.** Four of six candidates were
   rejected before evaluation (16 rollouts not spent). Step 5 proposed the same
   sandbox repair as P2 step 1 (rules `tsconfig`, `config-extends`, `scorer`,
   `tool-config`, `parent-repo`, `fixture`). The optimizer still proposes it
   because the rollout agent meets the fixture's dangling tsconfig in its own
   workspace; the scorer no longer rewards it. `rescreen.jsonl` re-ran the
   hardened screen over all six candidates and agrees with the run on each.
5. **The step-2 accept carries audit vocabulary the screen does not name.**
   Its added text says "the inventory lint flags" and "the precision audit
   checks every occurrence". That is guidance written toward a checker. The
   screen's term list has no rule for it, and a human reading the row should
   weigh it.
6. **Complexity still accumulates.** The skill grew from 6,373 to 7,810 bytes
   (+22.5%) across two accepts that carry no measurable gain.
7. **Scorer wall time.** Median 5.3 s per task (mean 5.5, range 4.4 to 7.7,
   n = 37) against roughly 2 minutes per scorer in P5. Rollout execution took
   a median of 48 s per task.
8. **Scores hold under the hardened scorer.** The review of this PR found
   three ways to hide code from the law lanes (JavaScript beside a declaration
   file, excluded path names, a file over Biome's size limit). No rollout
   workspace contains any of them, and re-scoring the twelve selection
   workspaces (baseline, step 2, step 6) with the fixed scorer reproduces every
   score exactly.
9. **Rollout isolation is incomplete.** Rollout agents wrote build-info files
   into four corpus fixture directories and at least one temp directory beside
   them. No tracked file changed and no trace names the task manifests, but the
   target can reach them. Receipt in `research/OPPORTUNITIES.md`.

## Ledger rows

Recorded through `python -m beep_skillopt.ledger --write`, which calls the
harness-ledger CLI. Row ids per step are in `ledger-rows.json`.

| Step | Proposed row | Machine disposition | Reason |
| --- | --- | --- | --- |
| 1 | `hl-20260929-5efc96ff` | `rejected` (`hl-20260929-58b6caf6`) | screen: evaluation-environment-fitting |
| 2 | `hl-20260929-df3f0899` | none, stays `proposed` | gate accepted, within noise |
| 3 | `hl-20260929-3d7c119f` | `rejected` (`hl-20260929-5ccfb1f4`) | screen: task-leakage |
| 4 | `hl-20260929-81ff6e06` | `rejected` (`hl-20260929-5ddf9e10`) | screen: evaluation-environment-fitting |
| 5 | `hl-20260929-7abfe91a` | `rejected` (`hl-20260929-672c2818`) | screen: evaluation-environment-fitting |
| 6 | `hl-20260929-f88812b2` | none, stays `proposed` | gate accepted, within noise |

This PR's own harness edits are declared the same way (D6):
`hl-20260929-2072a6f9` for the hook-pulse stamp, and `hl-20260929-475be43a`
for the `SessionStart` settings entry. The operator admitted that entry on
2026-10-01 (`hl-20261001-5faf29a0`).

Dispositions of the two `proposed` candidates, and of the two P2 rows
(`hl-20260925-873a855c`, `hl-20260925-4fc1962c`), are Benjamin's call (D2).
The evidence recommends `rejected` for all four: two are sandbox repair and
task leakage, two are inside the noise band.

## Pruning proposals

`prune-proposals.txt` is the output of
`bun run beep harness-ledger prune-proposals --window 30` under harness hash
`bb86bd309008`: 44 candidate surfaces, 0 sessions in regime, 2,182 sessions
skipped as unstamped, no proposals, nothing written. That is the correct
answer today. Every recorded session predates the stamp, and no live session
was stamped until hook-pulse ran on `SessionStart`. The operator admitted that
entry on 2026-10-01, and the window fills from that point.

## Verdict: CLOSE the rerun, do not adopt a trained skill

The annealed budget and parallel evaluation ran as designed and produced
recorded, screened, reproducible evidence. The evidence says the corpus cannot
separate a better skill from noise at this model strength. A further rerun on
this corpus would spend quota to learn the same thing. What a next loop needs,
in order: a corpus with headroom (harder tasks or more validation items),
rollouts isolated from the corpus, and a gate margin at least as wide as the
measured spread. Those belong to a new packet, not this one.
