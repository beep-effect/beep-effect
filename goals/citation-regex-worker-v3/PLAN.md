# Citation Regex Worker V3 Plan

## Status

Status: `in progress`

## Phases

| Phase | Status | Goal | Exit criteria |
| --- | --- | --- | --- |
| P0 Research | completed | Inspect source hierarchy and confirm scope. | Required facts and blockers are recorded. |
| P1 Implement | in progress | Make the smallest changes that satisfy `SPEC.md`. | Acceptance criteria are met. |
| P2 Verify | pending | Run required checks and capture evidence. | Verification is green or blockers are documented. |
| P3 Yeet: PR to mergeable | pending | Publish through yeet and drive the PR to mergeable: required checks green, review comments answered and resolved. | `mergeStateStatus` is `CLEAN`; zero unresolved review threads. |
| P4 Close | pending | Write the closeout reflection and flip packet state. | Packet status and evidence are updated; a closeout reflection exists. |

## Slices

Each slice is one PR and runs the phases above. They land in order.

| Slice | Status | Content | Count that must move |
| --- | --- | --- | --- |
| B1 | in progress | `CitationNativeLane`; regex v2, Diff and Markup start through it; limits cross-field check; policy v2. | none; adds the markup interleave proofs |
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

### B1 review fixes verified; held on regex admission deadline ordering, 2026-11-14

Round 1 fixes the masked Markup ownership transfer and replaces the fiber-reentrant cleaner lock with short Semaphore transitions plus logical yield depth. Forked/concurrent nested plans and real spawn-return interruption proofs pass. Both parent runners pass the four NativeLane proof files; focused worker, pipeline, invocation and engine files pass independently. One fresh CanonicalFullSpan run passes 12/12 in 57.22 seconds at launch load 37.51 / 25.35 / 21.73; ten calls retain 291 regex children, zero per-call installs/detaches/tokenizer/evaluator builds, ten physical lane owners and ten lane acquisitions; construction remains 16/1/1/26 installs/detach/tokenizer/evaluators with one physical owner and zero children or lane claims. Quick server/use-cases/lint-rules verifications, source/test typechecks, both requested laws, root Oxlint, Biome, docgen, Effect Vitest and Fallow audit vs origin/main pass. The request-authority lint now covers CitationNativeLane with 24 new fixtures. B1 returns to in progress, held on the separate audit finding: real regex native admission moved inside regexDeadline, so external contention can change the selected refusal. No contract expansion or weakening guard is implemented. Evidence: history/evidence/2026-11-14-b1-review-round-1.md. No push, PR, rebase or stash operation.

Reverse: Return B1 to review after an owner ruling resolves pre-timer lane reservation and the targeted refusal proof passes.

### B1 locally verified with policy v2 and cleaner-boundary yield, 2026-11-14

Both owner-ruling stops are resolved. B1 is in review locally; no push or PR.
Policy v2 and its major changeset are in df7dbe7f5dc. Invocation lanes route
regex v2, Diff and Xml; the closed HTML cleaner uses the named standalone starter
only after lane.yieldTo returns capacity. The public cleaner contracts and the
physical SIGKILL/isRunning/Scope-close sequence are unchanged.

Two full-span runs pass 12/12. The ten Bun calls remain 291 evaluations and 291
children, with zero per-call installs/detaches/tokenizer/evaluator installs.
Construction remains 16 metadata installs, 1 detach, 1 tokenizer, 26 evaluators,
1 physical owner and zero children. New lane-unit counts are zero at construction
and ten across the calls. File wall times are 61.72 s and 64.59 s; the latter's
launch-adjacent load is 20.27 / 22.31 / 18.30. File timings include the Node parity
leg and do not claim a latency improvement over the historical A4 cohort timing.

All new real-process proofs pass under Bun and Node parent runners, each testing
Bun and Node children. Markup completes under 1/1 and concurrently under 2/2 with
max-alive 1 and 2. Cleaner proofs cover engine HTML clean, a direct host call,
regex before HTML, acquisition/start quarantine, interrupted transfer, terminal
unconfirmed yield and late acknowledgement, and nested/concurrent yields within
caller transactions. Exact process and release assertions remain.

Both quick package checks/typechecks, both law checks, root Oxlint, local docgen,
Biome and whitespace pass. Fallow against origin/main has zero introduced
findings. Effect Vitest passes with explicit resource-hook deadlines; generated
inventory churn is restored. No full suite, coverage, hosted CI or remote timing
was run. Full file-by-file receipts and proof details are in
history/evidence/2026-11-14-b1-native-lane.md. Owner publishes after the predecessor
merges and directs the base update; this lane was not rebased.

Reverse: Return B1 to in progress if owner review finds an ownership, refusal or counting regression.

<!-- beep:decisions:end -->
