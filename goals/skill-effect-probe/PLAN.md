# Skill Effect Probe Plan

## Status

Status: `in-progress`

## Phases

| Phase | Status | Goal | Exit criteria |
| --- | --- | --- | --- |
| P0 Research | complete | Prove the pipeline on one task: seed the fixture, run three cells twice each, keep the directories, score them. Read the paired-difference, clustering and power sections of the Miller paper. | Six runs scored and tied to case, cell and run; the three-cell workaround is chosen; the analysis rule is drafted. |
| P1 Implement | in-progress | Build the full suite and the reusable code: 12 cases in two prompt variants, the plugin wrapper, kept-directory scoring, paired-difference arithmetic. Run preflight on all 12 tasks. Commit the analysis rule. | Preflight recorded; package verification green; the rule is committed. |
| P2 Verify | pending | Run the scored cells under the cost ceiling, score every kept directory, write the findings and the verdict. | About 180 scored runs recorded; findings state the verdict against the decision rule. |
| P3 Yeet: PR to mergeable | pending | Publish through yeet and drive the PR to mergeable: required checks green, review comments answered and resolved. | `mergeStateStatus` is `CLEAN`; zero unresolved review threads. |
| P4 Close | pending | Record the verdict row, the prune proposal on a null, and any fired gate in the exploration. Write the closeout reflection and flip packet state. | Packet status and evidence are updated; a closeout reflection exists. |

## Phase Notes

### P0

- Fetch the archived corpus at the commit named in `SPEC.md`. Start with
  `sfv4-normalization-003`: it varied most in the P4 rerun.
- Unknowns to settle, in order:
  1. Does `--keep-temp` output or the JSON result tie a directory to a case,
     arm and run? If not, run one case and one arm per invocation.
  2. Cell A needs "no skill" on the bare prompt and cells B and C need both
     arms on the laws prompt. Try an empty plugin with the ablation off for
     cell A before accepting a fourth cell.
  3. Does the scaffold script see enough environment to seed the fixture, and
     does the scorer accept the kept directory as its fixture copy?
- Record how many turns and seconds one run takes, and set `max_turns`,
  `timeout_seconds` and the cost ceiling from that.
- The six slice runs are not scored evidence. They may precede the rule.

### P1

- Design order: schemas for a run record, a cell summary and a probe report;
  then the service contract; then the implementation. Extend the existing
  trial comparison where it fits instead of adding a parallel shape.
- The analysis rule is one file in this packet's `research/`. It names the
  primary and secondary measures, the interval method and how it treats the
  four families, the exclusion rule for errored runs, and the thresholds from
  `SPEC.md`.
- One PR may carry P0 and P1. The scored run and findings may ride the same
  PR or a second one. The packet stays within two.

### P2

- Run with a concurrency the plan limit tolerates. If a limit interrupts the
  run, keep what completed, wait, and resume the missing runs. Do not top up.
- Score from the kept directories only. Keep the raw JSON results and the
  score outputs; do not commit the kept directories themselves.

### P4

- Verdict row and prune proposal go through the harness-ledger CLI. A human
  disposes the proposal.
- On an effect, or a fired rate below 0.8, edit the exploration map to mark
  the gate fired and reopen the exploration at `decompose`.

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
  (`bun run beep goals decisions add skill-effect-probe --kind checkpoint ...`),
  rendered into the Checkpoints block at the end of this plan.

## Verification Commands

```sh
test "$(wc -m < goals/skill-effect-probe/GOAL.md)" -le 4000
jq . goals/skill-effect-probe/ops/manifest.json
rg -n "skill-effect-probe|GOAL.md|agentLaunchers|packetAnchorDocument" goals/skill-effect-probe
git diff --check -- goals/skill-effect-probe
bun run beep quality package-verify @beep/repo-cli
```

## Checkpoints

<!-- beep:decisions:begin -->
_Generated from [`decisions/`](./decisions/) by `bun run beep goals decisions write --slug skill-effect-probe`; add a `kind: checkpoint` file there, never edit this block._

_No checkpoint files yet._

<!-- beep:decisions:end -->
