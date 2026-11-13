# Compute-Profile Gate Routing Plan

## Status

Status: `in-progress`

## Phases

| Phase | Status | Goal | Exit criteria |
| --- | --- | --- | --- |
| P0 Research | complete | Inspect source hierarchy and confirm scope. | Required facts and blockers are recorded. |
| P1 Implement | in-progress | Make the smallest changes that satisfy `SPEC.md`. | Acceptance criteria are met. |
| P2 Verify | pending | Run required checks and capture evidence. | Verification is green or blockers are documented. |
| P3 Yeet: PR to mergeable | pending | Publish through yeet and drive the PR to mergeable: required checks green, review comments answered and resolved. | `mergeStateStatus` is `CLEAN`; zero unresolved review threads. |
| P4 Close | pending | Write the closeout reflection and flip packet state. | Packet status and evidence are updated; a closeout reflection exists. |

## Closeout Checklist

Before marking the packet closed:

1. Write a closeout reflection via the `/reflect` skill to
   `history/reflections/<YYYY-MM-DD>-<agent>.md`. Its YAML frontmatter must
   validate against `ReflectionFrontmatter`.
2. Run `bun run beep lint reflection-artifacts`.
3. Update `README.md` (status, latest evidence) and `ops/manifest.json` phase
   statuses. Once the final PR is open, run
   `bun run beep goals set-status compute-profile-gate-routing completed-retained`: it writes
   `closeout` naming that PR with the matching `initiative.status`, and the
   commit ships in the final PR. After the merge,
   `bun run beep goals completion refresh --slug compute-profile-gate-routing` must print verified;
   name any red required check in a committed decision file
   (`redAttribution`).

## Execution Notes

- Preserve unrelated worktree changes.
- Keep `SPEC.md` normative and update it only when the contract changes.
- Keep this plan current; archive old run outputs under `history/`.
- Status checkpoints are `kind: checkpoint` files under `decisions/`
  (`bun run beep goals decisions add compute-profile-gate-routing --kind checkpoint ...`),
  rendered into the Checkpoints block at the end of this plan.

## Verification Commands

```sh
test "$(wc -m < goals/compute-profile-gate-routing/GOAL.md)" -le 4000
jq . goals/compute-profile-gate-routing/ops/manifest.json
rg -n "compute-profile-gate-routing|GOAL.md|agentLaunchers|packetAnchorDocument" goals/compute-profile-gate-routing
git diff --check -- goals/compute-profile-gate-routing
```

## Checkpoints

<!-- beep:decisions:begin -->
_Generated from [`decisions/`](./decisions/) by `bun run beep goals decisions write --slug compute-profile-gate-routing`; add a `kind: checkpoint` file there, never edit this block._

### P0 profile + scheduler implemented, 2026-11-08

P0 landed in the lane tree: ComputeProfile, ComputeProfileSource and ComputeProfileResolution schemas; the ComputeProfileProbe reference over process.constrainedMemory with the tighten-only BEEP_COMPUTE_PROFILE Config override; MemoryStats.ceilingGib with a ceiling-clamped availableGib; the D6 GateRoute table with gateRouteFor; the scheduler refusal (ComputeProfileRefusal inside QualitySchedulerError) for hosted-only gates on worker unless forceLocal; computeProfile on attempt, admission, termination and proof-shadow facts outside every digest; and beep compute profile with --is and --json. Probe evidence is research/2026-11-08-p0-probe-evidence.md. Next: P1 sets gateRoute from yeet final-check, records forced and auto-skipped gates in the receipt, and adds the lefthook skip.

Reverse: n/a

### P1 yeet posture + lefthook skip implemented, 2026-11-08

final-check auto-skips hosted-only gates on worker with reason compute-profile=worker (--force-local opts out, receipt records computeProfile and forceLocal). yeet ready accepts hosted green for those gates through gateHostedContextTable. yeet publish takes the open posture on worker and yeet open adds the compute-profile-worker label. Both catalog hooks skip on worker. Evidence: research/2026-11-08-p1-yeet-lefthook-evidence.md. Next: P2 hosted regeneration job and docs.

Lane goals/compute-profile-gate-routing-p1

Reverse: Revert the P1 commit; P0's probe, routing table and scheduler refusal stand alone.

<!-- beep:decisions:end -->
