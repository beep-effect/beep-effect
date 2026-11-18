# Effect Cluster Host Plan

## Status

Status: `pending`

## Phases

| Phase | Status | Goal | Exit criteria |
| --- | --- | --- | --- |
| P0 Research | pending | Inspect source hierarchy and confirm scope. | Required facts and blockers are recorded. |
| P1 Implement | pending | Make the smallest changes that satisfy `SPEC.md`. | Acceptance criteria are met. |
| P2 Verify | pending | Run required checks and capture evidence. | Verification is green or blockers are documented. |
| P3 Yeet: PR to mergeable | pending | Publish through yeet and drive the PR to mergeable: required checks green, review comments answered and resolved. | `mergeStateStatus` is `CLEAN`; zero unresolved review threads. |
| P4 Close | pending | Write the closeout reflection and flip packet state. | Packet status and evidence are updated; a closeout reflection exists. |

## P1 Work Breakdown

In order. Each step lands through Yeet; the packet has at most three open pull requests.

1. Bump: Alchemy to 2.0.0-beta.87 across the catalog, re-derive the existing in-memory timer patch, keep vault-sync and `@beep/alchemy-postgres` green.
2. Fixes: add `@alchemy.run/effect-cluster`, carry the fixes as root patches, write the patch ledger.
3. Conformance package: port the prototype's in-memory cases and upstream's ten, each fix with a case that fails without it.
4. Swarm recipe: the stack, the driver inside the stack's network, the one command, the baseline check, the runbook.
5. Cluster run: the full suite on the swarm, including the points not yet observed.
6. Descriptors and generated entry modules for one app pool.

## Closeout Checklist

Before marking the packet closed:

1. Write a closeout reflection via the `/reflect` skill to
   `history/reflections/<YYYY-MM-DD>-<agent>.md`. Its YAML frontmatter must
   validate against `ReflectionFrontmatter`.
2. Run `bun run beep lint reflection-artifacts`.
3. Update `README.md` (status, latest evidence) and `ops/manifest.json` phase
   statuses. Once the final PR is open, run
   `bun run beep goals set-status effect-cluster-host completed-retained`: it writes
   `closeout` naming that PR with the matching `initiative.status`, and the
   commit ships in the final PR. After the merge,
   `bun run beep goals completion refresh --slug effect-cluster-host` must print verified;
   name any red required check in a committed decision file
   (`redAttribution`).

## Execution Notes

- Preserve unrelated worktree changes.
- Keep `SPEC.md` normative and update it only when the contract changes.
- Keep this plan current; archive old run outputs under `history/`.
- Status checkpoints are `kind: checkpoint` files under `decisions/`
  (`bun run beep goals decisions add effect-cluster-host --kind checkpoint ...`),
  rendered into the Checkpoints block at the end of this plan.

## Verification Commands

```sh
test "$(wc -m < goals/effect-cluster-host/GOAL.md)" -le 4000
jq . goals/effect-cluster-host/ops/manifest.json
rg -n "effect-cluster-host|GOAL.md|agentLaunchers|packetAnchorDocument" goals/effect-cluster-host
git diff --check -- goals/effect-cluster-host
```

## Checkpoints

<!-- beep:decisions:begin -->
_Generated from [`decisions/`](./decisions/) by `bun run beep goals decisions write --slug effect-cluster-host`; add a `kind: checkpoint` file there, never edit this block._

_No checkpoint files yet._

<!-- beep:decisions:end -->
