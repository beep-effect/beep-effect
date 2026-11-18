# Prunable product leaves Plan

## Status

Status: `in-progress` (P0 research done 2026-11-17; seam 1 next)

## Phases

| Phase | Status | Goal | Exit criteria |
| --- | --- | --- | --- |
| P0 Research | done | Inspect source hierarchy and confirm scope. | Required facts and blockers are recorded. |
| P1 Implement | in-progress | Make the smallest changes that satisfy `SPEC.md`. | Acceptance criteria are met. |
| P2 Verify | pending | Run required checks and capture evidence. | Verification is green or blockers are documented. |
| P3 Yeet: PR to mergeable | pending | Publish through yeet and drive the PR to mergeable: required checks green, review comments answered and resolved. | `mergeStateStatus` is `CLEAN`; zero unresolved review threads. |
| P4 Close | pending | Write the closeout reflection and flip packet state. | Packet status and evidence are updated; a closeout reflection exists. |

## Seams

P1 Implement and P3 Yeet run once per seam; a seam is a PR. Payoff order: each
seam removes the largest remaining class of edits a pruned checkout would need,
starting with the one that touches only tests and laws. At most three of this
packet's PRs are open at once.

| Seam | Status | First step | Done when |
| --- | --- | --- | --- |
| 1, tooling fixtures tolerate absent product paths | next | Search for an existing repo-path presence helper; design the subject schema; then the census, shard-plan, `PrivateHomePaths`, `runner-burst` and ontology surfaces, plus the `packages/tooling/**` sweep. | Each surface skips and reports an absent subject, keeps a present one strict, and has both tests; `package-verify` passes for `@beep/repo-cli` and `@beep/ontology`. |
| 2, legal CLI command groups become their own package | pending | Map the command-group registry (`commands/Root.ts`, `internal/dispatch/Dispatch.manifest.ts`) and how a package registers commands into the CLI. | `@beep/repo-cli` has no product-leaf manifest edge; the import-boundary rule is green with the seam 3 and 4 rows allowlisted. |
| 3, party is provider-neutral | pending | Design the party-owned contact-evidence schema `ContactEvidence.model.ts` reads instead of `GraphContact`. | `@beep/party-server` and `@beep/scratchpad` have no product-leaf edge; the seam 3 allowlist rows are deleted. |
| 4, generated aggregation, re-homed proof, agents thread model | pending | Design the db-admin generator over present slices (the tsconfig-sync pattern), and the doctrine text. | db-admin's barrel and registry are generated; the accepted-proof manifest leaves repo-cli; agents has no `workspace` edge; the allowlist is empty; the doctrine amendment and `DECISIONS.md` entry are merged. |

P2 Verify runs the prune rehearsal (`SPEC.md` "Definitions") after seam 4 and
records the transcript under `history/`. Facts per seam:
[`research/2026-11-17-product-leaf-couplings.md`](research/2026-11-17-product-leaf-couplings.md).

## Closeout Checklist

Before marking the packet closed:

1. Write a closeout reflection via the `/reflect` skill to
   `history/reflections/<YYYY-MM-DD>-<agent>.md`. Its YAML frontmatter must
   validate against `ReflectionFrontmatter`.
2. Run `bun run beep lint reflection-artifacts`.
3. Update `README.md` (status, latest evidence) and `ops/manifest.json` phase
   statuses. Once the final PR is open, run
   `bun run beep goals set-status prunable-product-leaves completed-retained`: it writes
   `closeout` naming that PR with the matching `initiative.status`, and the
   commit ships in the final PR. After the merge,
   `bun run beep goals completion refresh --slug prunable-product-leaves` must print verified;
   name any red required check in a committed decision file
   (`redAttribution`).

## Execution Notes

- Preserve unrelated worktree changes.
- Keep `SPEC.md` normative and update it only when the contract changes.
- Keep this plan current; archive old run outputs under `history/`.
- Status checkpoints are `kind: checkpoint` files under `decisions/`
  (`bun run beep goals decisions add prunable-product-leaves --kind checkpoint ...`),
  rendered into the Checkpoints block at the end of this plan.

## Verification Commands

```sh
test "$(wc -m < goals/prunable-product-leaves/GOAL.md)" -le 4000
jq . goals/prunable-product-leaves/ops/manifest.json
rg -n "prunable-product-leaves|GOAL.md|agentLaunchers|packetAnchorDocument" goals/prunable-product-leaves
git diff --check -- goals/prunable-product-leaves
```

## Checkpoints

<!-- beep:decisions:begin -->
_Generated from [`decisions/`](./decisions/) by `bun run beep goals decisions write --slug prunable-product-leaves`; add a `kind: checkpoint` file there, never edit this block._

_No checkpoint files yet._

<!-- beep:decisions:end -->
