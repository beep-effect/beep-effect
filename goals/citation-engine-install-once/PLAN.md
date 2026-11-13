# Citation Engine Install Once Plan

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

## Slices

Each slice is one PR and runs the phases above. They land in order.

| Slice | Status | Content | Count that must move |
| --- | --- | --- | --- |
| A1 | merged (#3253) | Measurement fixture and recorded baseline. Test-only. | none; records the baseline |
| A2 | in review | `CitationInvocation` binding: budget and admission read at call time, optional lookups deleted, lint rule. Children still installed per request. | optional lookups to 0 |
| A3 | pending | Hoist the stage tree, tokenizer and regex evaluators to engine construction. | per-request installs 14 to 0; tokenizer builds 10 to 1 |
| A4 | pending | `CitationOwned` at the boundary; nested detaches, per-stage decodes and repeated fingerprints removed. | detaches 2 + 8 per call to 1 |

First slice: A1, the measurement fixture and baseline.

Sequencing rationale and the cross-goal dependency are in
[`explorations/citation-engine-install-and-worker-reuse/MAP.md`](../../explorations/citation-engine-install-and-worker-reuse/MAP.md).

## Closeout Checklist

Before marking the packet closed:

1. Write a closeout reflection via the `/reflect` skill to
   `history/reflections/<YYYY-MM-DD>-<agent>.md`. Its YAML frontmatter must
   validate against `ReflectionFrontmatter`.
2. Run `bun run beep lint reflection-artifacts`.
3. Update `README.md` (status, latest evidence) and `ops/manifest.json` phase
   statuses. Once the final PR is open, run
   `bun run beep goals set-status citation-engine-install-once completed-retained`: it writes
   `closeout` naming that PR with the matching `initiative.status`, and the
   commit ships in the final PR. After the merge,
   `bun run beep goals completion refresh --slug citation-engine-install-once` must print verified;
   name any red required check in a committed decision file
   (`redAttribution`).

## Execution Notes

- Preserve unrelated worktree changes.
- Keep `SPEC.md` normative and update it only when the contract changes.
- Keep this plan current; archive old run outputs under `history/`.
- Status checkpoints are `kind: checkpoint` files under `decisions/`
  (`bun run beep goals decisions add citation-engine-install-once --kind checkpoint ...`),
  rendered into the Checkpoints block at the end of this plan.

## Verification Commands

```sh
test "$(wc -m < goals/citation-engine-install-once/GOAL.md)" -le 4000
jq . goals/citation-engine-install-once/ops/manifest.json
rg -n "citation-engine-install-once|GOAL.md|agentLaunchers|packetAnchorDocument" goals/citation-engine-install-once
git diff --check -- goals/citation-engine-install-once
```

## Checkpoints

<!-- beep:decisions:begin -->
_Generated from [`decisions/`](./decisions/) by `bun run beep goals decisions write --slug citation-engine-install-once`; add a `kind: checkpoint` file there, never edit this block._

### A2 invocation binding is in review with unchanged A1 counts, 2026-11-13

A1 merged as #3253. A2 removes the optional request-authority captures, binds public calls through CitationInvocation, and preserves every A1 full-span count. Local proof uses file-by-file tests, quick law-practice verification plus docgen, and full lint-rules verification. The draft PR leaves the full law-practice audit and integration cohort to hosted CI; no ready transition or merge is authorized for this slice handoff.

Reverse: Return A2 to in progress if the focused proof or hosted acceptance fails.

<!-- beep:decisions:end -->
