# Epistemics Foundation Extraction Plan

## Status

Status: `in-progress` (closeout PR #2315; #2017 remains historical implementation evidence)

## Phases

| Phase | Status | Goal | Exit criteria |
| --- | --- | --- | --- |
| P0 Research | complete (2026-10-21) | Inspect source hierarchy and confirm scope. | Inventory, tenancy check and importer census recorded in `SPEC.md`. |
| P1 Implement | complete (2026-10-22) | 1) `bun run beep create-package` for `@beep/epistemics`; 2) move the value modules listed in `SPEC.md` with transitional re-exports; 3) add `ValidInterval`/`KnowledgeInterval` and repoint `EdgeVersion` with a row round-trip test; 4) add the `Claim<P>` and evidence-signal envelopes; 5) repoint every external importer and delete the re-exports. | Acceptance criteria are met. |
| P2 Verify | complete (2026-10-22) | Run required checks and capture evidence. | Verification is green or blockers are documented. |
| P3 Yeet: PR to mergeable | complete (2026-10-22, #2017 merged `ab6000add2`) | Publish through yeet and drive the PR to mergeable: required checks green, review comments answered and resolved. | `mergeStateStatus` is `CLEAN`; zero unresolved review threads. |
| P4 Close | complete as a proposal: reflection, acceptance audit and private-workspace migration note prepared; PR #2315 must still pass hosted readiness and merge verification | Write the closeout reflection and flip packet state. | Packet status and evidence are updated; a closeout reflection exists. |

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

## Verification Commands

```sh
test "$(wc -m < goals/epistemics-foundation-extraction/GOAL.md)" -le 4000
jq . goals/epistemics-foundation-extraction/ops/manifest.json
rg -n "epistemics-foundation-extraction|GOAL.md|agentLaunchers|packetAnchorDocument" goals/epistemics-foundation-extraction
git diff --check -- goals/epistemics-foundation-extraction
```

## 2026-10-28 recovery execution

1. Preserve the original implementation and remediation history.
2. Repair the required proposition logical-key binding and prove mismatch rejection.
3. Verify both packages, row compatibility, factory bindings, identifiers and import boundaries.
4. Publish a final closeout PR; bind its number and the new Yeet run in the manifest.
5. Pass content-final verification, mark ready, wait for hosted checks and review window,
   answer review threads, then merge at the strict gate.
6. Retain readiness artifacts in the owning clone, run completion refresh against the new
   final PR, and retire the lane only after the verified receipt proves closeout.
