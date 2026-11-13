# Skill Lane Probe Plan

## Status

Status: `active`

## Phases

| Phase | Status | Goal | Exit criteria |
| --- | --- | --- | --- |
| P0 Research | complete | Read the first probe's findings, rule and amendments, and its probe code. Confirm the account has plan headroom. Rerun preflight under scorer profile v3. | Preflight recorded; the code change is scoped; no blocker on the plan. |
| P1 Implement | complete | Add lane fraction as a selectable primary, the within-task permutation test, the fixed-task interval and the three-outcome verdict, schema first and with tests. Pass the first slice on the committed pilot records. | First slice passes; package verification green; coverage floors hold; the code PR is merged. |
| P2 Verify | pending | Run the 120 scored runs under the cost ceiling, score every kept directory, write the findings and the verdict. | Run records and findings are in `history/`; the verdict is stated against the Decision Rule. |
| P3 Yeet: PR to mergeable | pending | Publish through yeet and drive the PR to mergeable: required checks green, review comments answered and resolved. | `mergeStateStatus` is `CLEAN`; zero unresolved review threads. |
| P4 Close | pending | Record the verdict row, the prune proposal on a Null, and the fired gate in the exploration. Write the closeout reflection and flip packet state. | Packet status and evidence are updated; a closeout reflection exists. |

## Phase Notes

### P0

- The rule is this packet's `SPEC.md` Decision Rule, already on `main`. Do
  not restate it in another file.
- Check `bun run beep accounts status` before any run. The first probe lost
  178 runs to a weekly limit.
- Reuse the first probe's staging and preflight commands as they are. The
  bare-prompt plugin and cell A are not staged.

### P1

- Design order: the schema change first (the primary's literal domain, a
  verdict shape with Incomplete, Effect, Small effect and Null), then the
  report contract, then the implementation.
- Use `effect/Random` with the seed from `SPEC.md` for the relabelings. The
  test must give the same p-value on every run and on Node and Bun.
- Tests pin: a hand-computed `D` and interval on a small fixture; a case
  where the family-clustered interval includes zero and the permutation test
  detects; the order of the outcomes; Holm adjustment; unequal cell sizes
  after an exclusion.
- The first slice reads the first probe's committed laws-pilot records. Its
  output is pilot data: it is not committed as a finding and decides nothing.
- Land the code in its own PR before the scored run, so the run uses merged
  code.

### P2

- One with-without invocation, or several if a limit interrupts: keep what
  completed, wait, and resume the missing runs. Do not top up.
- Score from the kept directories only. Commit the run records and score
  outputs, not the kept directories.
- Run the report twice and compare the p-values before writing the findings.

### P3 and P4

- Push every commit on the final branch with `bun run beep yeet publish` so
  a publish verdict exists at the accepted head.
- Start the final PR's title with "HOLD" and say it merges only on
  `merge-ready: yes`. Three final PRs of the first probe were merged within
  minutes of their ready flip and lost the readiness receipt.
- Verdict row and prune proposal go through the harness-ledger CLI. A human
  disposes the proposal.
- Edit the exploration map for the gate the verdict fires: corpus sizing on
  an Effect; the activation probe's basis from the scored fired rate.

## Closeout Checklist

Before marking the packet closed:

1. Write a closeout reflection via the `/reflect` skill to
   `history/reflections/<YYYY-MM-DD>-<agent>.md`. Its YAML frontmatter must
   validate against `ReflectionFrontmatter`.
2. Run `bun run beep lint reflection-artifacts`.
3. Update `README.md` (status, latest evidence) and `ops/manifest.json` phase
   statuses and a typed `proposedCloseout` with status `completed-retained`
   and finalPullRequest. Keep `initiative.status` operative until completion
   evidence verifies; do not close the external execution/session ledger from a proposal.

## Execution Notes

- Preserve unrelated worktree changes.
- Keep `SPEC.md` normative and update it only when the contract changes.
- Keep this plan current; archive old run outputs under `history/`.
- Status checkpoints are `kind: checkpoint` files under `decisions/`
  (`bun run beep goals decisions add skill-lane-probe --kind checkpoint ...`),
  rendered into the Checkpoints block at the end of this plan.

## Verification Commands

```sh
test "$(wc -m < goals/skill-lane-probe/GOAL.md)" -le 4000
jq . goals/skill-lane-probe/ops/manifest.json
rg -n "skill-lane-probe|GOAL.md|agentLaunchers|packetAnchorDocument" goals/skill-lane-probe
git diff --check -- goals/skill-lane-probe
bun run beep quality package-verify @beep/repo-cli
```

## Checkpoints

<!-- beep:decisions:begin -->
_Generated from [`decisions/`](./decisions/) by `bun run beep goals decisions write --slug skill-lane-probe`; add a `kind: checkpoint` file there, never edit this block._

### P1 merged; the P2 scored run waits for Claude plan headroom, 2026-11-13

PR #3240 merged the lane report, the permutation test and their tests, so P1 is complete. Stage and preflight are done (12 of 12 pass) and the run script is ready. The scored run has not started: `bun run beep accounts status` on 2026-11-13 showed the active Claude account with 10% of its weekly quota left and 2d 18h to the reset. The first probe lost 178 runs to a weekly limit, so the run starts only when `bun run beep accounts status`, read immediately before the start, shows headroom on the account that runs it. That check applies after the weekly reset too; a reset alone is not enough. The run is not topped up. No scored run exists yet and nothing from the first probe is pooled.

Lane goals/skill-lane-probe-p2 · PR #3240

Reverse: Start the run earlier only if accounts status shows headroom for 120 Opus runs on the account the run will use.

<!-- beep:decisions:end -->
