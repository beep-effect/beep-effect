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
| B1 | in review | `CitationNativeLane`; regex v2, Diff and Markup start through it; limits cross-field check; policy v2. | none; adds the markup interleave proofs |
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

### B1 explicit reservation verified and in review, 2026-11-14

Owner ruling 3 resolves the admission/deadline stop. B1 is in review locally on
feat/citation-native-lane. Explicit lane.reserve runs at the base's regex, Diff
and Xml acquisition points; standalone HTML keeps its own placement. Both review
race fixes remain. No public cleaner contract, limit value or protocol change.

The new contention proof passes 32/32 under each parent (Bun and Node), covering
all four kinds with both real child runtimes: queue-full, queue-expiry, quarantine
before reservation and job deadline after reservation. The regex queue proof
observes that regexDeadline has not started. Reservation/start counts one claim;
unused reservations return on Scope close. NativeLane now passes 16/16 per parent,
and the prior handover/interruption/cleaner/1-and-1/2-and-2 proofs remain green.

The final full-span count replay passes 12/12 in 58.86 seconds, launch load
24.72 / 19.30 / 18.52. Ten plain-text Bun calls remain 291 regex children and
291 evaluations, zero per-call installs/detaches/tokenizer/evaluator builds, ten
physical lane owners and ten lane unit claims. Construction remains metadata
16, detach 1, tokenizer 1, evaluators 26, physical owner 1, children/lane claims 0.

Both quick package verifications/typechecks, both laws, root Oxlint, Biome,
docgen:local, Effect Vitest and Fallow audit vs origin/main pass. Fallow has zero
introduced findings; Effect Vitest has zero introduced findings and no inventory
churn. Detailed base/head source references, exact refusals, file receipts and
proof limits are in history/evidence/2026-11-14-b1-reservation.md.

No stop remains. No push, PR, rebase, subagent, shared-stash operation, whole suite
or whole-package coverage. The owner publishes and directs the later base update.

Review round 2 qualifies base refusal equivalence to matching admission state and
records the intentional external contention from lifetime-held idle units. The
combined two-entrant unconfirmed-retirement proof passes on both parent runtimes,
with neither cleaner body running, depth zero and late-confirmation release.

Reverse: Return B1 to in progress if review finds an ownership, admission, timer or counting regression.

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

### Record hosted round 1 repairs and the completed provider audit, 2026-11-14

B1 remains in review as PR #3336. Hosted round 1 repairs preserve every expected
child count, budget and refusal assertion. The evaluator checks the actual lane
spawner/Clock, including its first call, and retains the base closed-installation
refusal. Fixtures open invocations in their installed runtime Context.

The serial provider audit passes 168 files / 772 tests; the requested full-law
integration replay passes 768 observations with 936/936 confirmed children.
CanonicalFullSpan ran last: 12/12, 291 children and 10 lane claims per ten calls,
construction unchanged, 67.29 s at load 10.92 / 12.20 / 11.36. Total: 170 files,
785 tests. Required server check, quick verification, laws, fallow, Effect Vitest,
schema-first, Biome and decision projections pass. Full receipts and each file's
pass count are in history/evidence/2026-11-14-b1-native-lane.md, Hosted round 1.

No push, PR mutation, rebase or stash operation. The owner publishes local commits;
hosted CI/review resolution is still outstanding on those commits.

Lane feat/citation-native-lane · PR #3336

Reverse: Rerun the same file-level proofs after any change; preserve the recorded counts and refusals.

### Record quarantine overlap and coverage review follow-through, 2026-11-14

B1 remains in review as PR #3336, with this local wave based on b749cd91e7e.
Remove only Markup reap's aggregate quarantine reset; exact-record callbacks own
settlement. A/B real-child regressions fail with the old reset and pass for Bun
and Node children. The two-request composition proof forces both first children
to exist before either request proceeds; its exact peak-two assertion remains.

The owner-expanded coverage wave covers every reported reachable branch in six
regressed sources plus new NativeLane. Single-file reports merged with hosted
artifacts clear all reported floors; six typed invariant guards stay and are
reported with source/line arguments and measured values. No coverage baseline
edit, guard weakening, typed-refusal conversion or ignore directive.

Current proof: 79 green Node consumer/coverage files / 369 tests; 55 touched cases
also pass with a Bun parent. The three unchanged parent-runtime tests reproduce
six passes / 26 failures under Node and pass 32/32 under Bun. Census passes 4/4.
CanonicalFullSpan ran last: 12/12, 65.22 s, launch load 10.12 / 12.81 / 13.97;
291 regex children / ten lane claims per ten calls, construction unchanged.

Server check, quick verification, laws, scoped root oxlint, Biome, fallow,
Effect Vitest, schema-first, docgen and decision projections pass. Evidence lists
every file and coverage-path test. One EV003 per-request fixture exception is
reviewed under the standing invocation policy; unrelated inventory rows match
HEAD exactly. The owner publishes this local commit; no push, PR mutation,
rebase or stash operation.

Lane feat/citation-native-lane · PR #3336

Reverse: Repeat these bounded proofs after changes; keep unchanged parent-runtime tests and all typed guards intact.

<!-- beep:decisions:end -->
