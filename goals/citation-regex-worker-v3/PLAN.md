# Citation Regex Worker V3 Plan

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

## Slices

Each slice is one PR and runs the phases above. They land in order.

| Slice | Status | Content | Count that must move |
| --- | --- | --- | --- |
| B1 | pending | `CitationNativeLane`; regex v2, Diff and Markup start through it; limits cross-field check; policy v2. | none; adds the markup interleave proofs |
| B2 | pending | Protocol v3 messages, looping worker, `CitationRegexSession`, sleep-counting clock, the real-process proofs; every regex call site switches. | regex processes 291 to 10 |
| B3 | pending | Delete v2; rewrite spawn-count assertions; re-record shard timings; append isolation evidence. | none |

First slice: B1, the native lane, once slice A2 of `citation-engine-install-once` has merged.

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
   `bun run beep goals set-status citation-regex-worker-v3 completed-retained`: it writes
   `closeout` naming that PR with the matching `initiative.status`, and the
   commit ships in the final PR. After the merge,
   `bun run beep goals completion refresh --slug citation-regex-worker-v3` must print verified;
   name any red required check in a committed decision file
   (`redAttribution`).

## Execution Notes

- Preserve unrelated worktree changes.
- Keep `SPEC.md` normative and update it only when the contract changes.
- Keep this plan current; archive old run outputs under `history/`.
- Status checkpoints are `kind: checkpoint` files under `decisions/`
  (`bun run beep goals decisions add citation-regex-worker-v3 --kind checkpoint ...`),
  rendered into the Checkpoints block at the end of this plan.

## Verification Commands

```sh
test "$(wc -m < goals/citation-regex-worker-v3/GOAL.md)" -le 4000
jq . goals/citation-regex-worker-v3/ops/manifest.json
rg -n "citation-regex-worker-v3|GOAL.md|agentLaunchers|packetAnchorDocument" goals/citation-regex-worker-v3
git diff --check -- goals/citation-regex-worker-v3
```

## Checkpoints

<!-- beep:decisions:begin -->
_Generated from [`decisions/`](./decisions/) by `bun run beep goals decisions write --slug citation-regex-worker-v3`; add a `kind: checkpoint` file there, never edit this block._

_No checkpoint files yet._

<!-- beep:decisions:end -->
