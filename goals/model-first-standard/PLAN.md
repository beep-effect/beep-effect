# Model-First Standard Plan

## Status

Status: `active`

## Phases

| Phase | Status | Goal | Exit criteria |
| --- | --- | --- | --- |
| P0 Research | complete | Inspect source hierarchy and confirm scope. | Required facts and blockers are recorded. |
| P1 Implement | in-progress | Make the smallest changes that satisfy `SPEC.md`. | Acceptance criteria are met. |
| P2 Verify | pending | Run required checks and capture evidence. | Verification is green or blockers are documented. |
| P3 Yeet: PR to mergeable | pending | Publish through yeet and drive the PR to mergeable: required checks green, review comments answered and resolved. | `mergeStateStatus` is `CLEAN`; zero unresolved review threads. |
| P4 Close | pending | Write the closeout reflection and flip packet state. | Packet status and evidence are updated; a closeout reflection exists. |

## P1 Work Breakdown

In order. Each step lands through Yeet; the packet has at most three open pull requests.

1. Doctrine: amend `standards/ARCHITECTURE.md`, the decision log, the glossary and chapters `01`, `10`, `13`. One pull request, docs only. `authority-context` may begin in-memory work once it merges.
2. Scaffolder: retarget `beep architecture` to the four roles, keeping the seven-role plan available for legacy slices. Prove it by generating a throwaway context in a test.
3. Checkers: role suffix and placement, exact exports, imports between contexts, each with a baseline and a fixture.
4. Generators: handler registry and proof inventory with drift checks and outcome coverage.
5. Close: supersede `goals/slice-topology-audit`, update `AGENTS.md` and skills where they name the old shape.

## Closeout Checklist

Before marking the packet closed:

1. Write a closeout reflection via the `/reflect` skill to
   `history/reflections/<YYYY-MM-DD>-<agent>.md`. Its YAML frontmatter must
   validate against `ReflectionFrontmatter`.
2. Run `bun run beep lint reflection-artifacts`.
3. Update `README.md` (status, latest evidence) and `ops/manifest.json` phase
   statuses. Once the final PR is open, run
   `bun run beep goals set-status model-first-standard completed-retained`: it writes
   `closeout` naming that PR with the matching `initiative.status`, and the
   commit ships in the final PR. After the merge,
   `bun run beep goals completion refresh --slug model-first-standard` must print verified;
   name any red required check in a committed decision file
   (`redAttribution`).

## Execution Notes

- Preserve unrelated worktree changes.
- Keep `SPEC.md` normative and update it only when the contract changes.
- Keep this plan current; archive old run outputs under `history/`.
- Status checkpoints are `kind: checkpoint` files under `decisions/`
  (`bun run beep goals decisions add model-first-standard --kind checkpoint ...`),
  rendered into the Checkpoints block at the end of this plan.

## Verification Commands

```sh
test "$(wc -m < goals/model-first-standard/GOAL.md)" -le 4000
jq . goals/model-first-standard/ops/manifest.json
rg -n "model-first-standard|GOAL.md|agentLaunchers|packetAnchorDocument" goals/model-first-standard
git diff --check -- goals/model-first-standard
```

## Checkpoints

<!-- beep:decisions:begin -->
_Generated from [`decisions/`](./decisions/) by `bun run beep goals decisions write --slug model-first-standard`; add a `kind: checkpoint` file there, never edit this block._

### P0 done; P1 step 1, the doctrine amendment, is written, 2026-11-18

P0 read the packet, the exploration decision log D1 to D66, the brief, the map, the fifth-draft artifact and the v3-consistency-audit deferred rows; no blocker. P1 step 1 amends standards/ARCHITECTURE.md (new "Model-First Slice Topology" section, legacy banners, North Star, principles, consumption rules, CQRS, enforcement), the 2026-11-18 entry of standards/architecture/DECISIONS.md, the glossary and chapters 01, 10 and 13, as one docs-only pull request. Next: P1 step 2, retarget `bun run beep architecture` to the four roles.

Lane claude/model-first-standard-doctrine-b72d36

Reverse: Revert the doctrine pull request

<!-- beep:decisions:end -->
