# JSDoc Lead Single Source Plan

## Status

Status: `in-progress`

## Phases

| Phase | Status | Goal | Exit criteria |
| --- | --- | --- | --- |
| P0 Research | complete | Inspect source hierarchy and confirm scope. | Required facts and blockers are recorded. |
| P1 Implement | complete | Make the smallest changes that satisfy `SPEC.md`. | Acceptance criteria are met. |
| P2 Verify | complete | Run required checks and capture evidence. | Verification is green or blockers are documented. |
| P3 Yeet: PR to mergeable | complete | Publish through yeet and drive the PR to mergeable: required checks green, review comments answered and resolved. | `mergeStateStatus` is `CLEAN`; zero unresolved review threads. |
| P4 Close | complete | Write the closeout reflection and flip packet state. | Packet status and evidence are updated; a closeout reflection exists. |

## Closeout Checklist

Before marking the packet closed:

1. Write a closeout reflection via the `/reflect` skill to
   `history/reflections/<YYYY-MM-DD>-<agent>.md`. Its YAML frontmatter must
   validate against `ReflectionFrontmatter`.
2. Run `bun run beep lint reflection-artifacts`.
3. Update `README.md` (status, latest evidence) and `ops/manifest.json` phase
   statuses. Once the final PR is open, run
   `bun run beep goals set-status jsdoc-lead-single-source completed-retained`: it writes
   `closeout` naming that PR with the matching `initiative.status`, and the
   commit ships in the final PR. After the merge,
   `bun run beep goals completion refresh --slug jsdoc-lead-single-source` must print verified;
   name any red required check in a committed decision file
   (`redAttribution`).

## Execution Notes

- Preserve unrelated worktree changes.
- Keep `SPEC.md` normative and update it only when the contract changes.
- Keep this plan current; archive old run outputs under `history/`.
- Status checkpoints are `kind: checkpoint` files under `decisions/`
  (`bun run beep goals decisions add jsdoc-lead-single-source --kind checkpoint ...`),
  rendered into the Checkpoints block at the end of this plan.

## Verification Commands

```sh
test "$(wc -m < goals/jsdoc-lead-single-source/GOAL.md)" -le 4000
jq . goals/jsdoc-lead-single-source/ops/manifest.json
rg -n "jsdoc-lead-single-source|GOAL.md|agentLaunchers|packetAnchorDocument" goals/jsdoc-lead-single-source
git diff --check -- goals/jsdoc-lead-single-source
```

## Checkpoints

<!-- beep:decisions:begin -->
_Generated from [`decisions/`](./decisions/) by `bun run beep goals decisions write --slug jsdoc-lead-single-source`; add a `kind: checkpoint` file there, never edit this block._

### P0 done, P1 wave 1 built: lead source in docgen and the inventory, 2026-11-22

Docgen derives a missing lead from the export's $I.annote* description (values, classes, same-name type companions, Encoded namespace members, named re-exports from their target). The inventory stops requiring a lead where one is derived, no longer calls an empty lead leading-blank, and counts restating leads as restating-lead (8,726 measured, ratcheted). Law text: .patterns/jsdoc-documentation.md Lead source, law 15, AGENTS.md, jsdoc-annotation-specialist skill. Next: package sweeps in waves, CI-closure and P5 runner packages last.

Lane goals/jsdoc-lead-single-source-p0

Reverse: Revert the wave-1 PR.

<!-- beep:decisions:end -->
