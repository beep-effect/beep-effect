# Citation Engine Install Once Plan

## Status

Status: `completed-retained`

## Phases

| Phase | Status | Goal | Exit criteria |
| --- | --- | --- | --- |
| P0 Research | complete | Inspect source hierarchy and confirm scope. | Required facts and blockers are recorded. |
| P1 Implement | complete | Make the smallest changes that satisfy `SPEC.md`. | Acceptance criteria are met. |
| P2 Verify | complete | Run required checks and capture evidence. | Verification is green or blockers are documented. |
| P3 Yeet: PR to mergeable | complete | Publish through yeet and drive the PR to mergeable: required checks green, review comments answered and resolved. | `mergeStateStatus` is `CLEAN`; zero unresolved review threads. |
| P4 Close | complete | Write the closeout reflection and flip packet state. | Packet status and evidence are updated; a closeout reflection exists. |

## Slices

Each slice is one PR and runs the phases above. They land in order.

| Slice | Status | Content | Count that must move |
| --- | --- | --- | --- |
| A1 | merged (#3253) | Measurement fixture and recorded baseline. Test-only. | none; records the baseline |
| A2 | merged (#3265) | `CitationInvocation` binding: budget and admission read at call time, optional lookups deleted, lint rule. Children still installed per request. | optional lookups to 0 |
| A3 | merged (#3282) | Hoist the stage tree, tokenizer and regex evaluators to engine construction. | per-request installs 14 to 0; tokenizer builds 10 to 1 |
| A4 | merged (#3319) | `CitationOwned` at the boundary; nested detaches, per-stage decodes and repeated fingerprints removed. | detaches 10 per engine to 1 (was 2 + 8 per call before A3) |

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

### A3 is in review with per-call install, tokenizer and evaluator counts at zero, 2026-11-13

A1 merged as #3253 and A2 as #3265. A3 hoists the stage tree, tokenizer and every regex evaluator call site to engine construction: per call 0 metadata-operation installs, 0 detaches, 0 tokenizer builds and 0 evaluator installs, with 291 evaluations and child processes unchanged; construction counts 16, 10, 1 and 26. Local proof is file by file; the full law-practice audit and integration cohort run on hosted CI. PR #3282 is ready for review; the merge is the orchestrator's gate.

Lane perf/citation-hoist-installs

Reverse: Return A3 to in progress if hosted CI or review finds a result or accounting change.

### Keep A2 in review after the second review repair, 2026-11-13

A1 remains merged as #3253 and A2 remains in review on draft #3265. Review round 2 fixes all seven findings: all-method deadline controls, expanded optional-authority lint forms, independent loop request budget, explicit scaffold binding with typed closed-admission refusal, one public-boundary refusal log, removal of the orphan cleaner coverage row, and restoration of unrelated inventory positions. All 87 focused files pass individually, the A1 full-span table remains unchanged, and package lint/check, full lint-rules audit, docgen, skills lock and policy fingerprint pass. The full law-practice audit is reserved for hosted CI under the file-by-file rule. No ready transition, merge or readiness monitor is authorized.

Reverse: Restore the prior A2 review status note

### A4 is in review with one configuration detach per engine, 2026-11-14

A3 merged as #3282. A4 owns configuration once at each caller boundary (`ownCitationConfiguration`, one JSON-codec detach at make, makeDefault and the extractor) and removes every nested detach and stage-level decode. Round 2 hoisted the reference-pattern builder's fixed-pattern authentication to install and typed every leaf helper and parent-side installer. Round 3 derives the default engine's installed configuration from the owned caller configuration with `ownedDerive`, so `makeDefault` no longer re-owns it through `make`. Full-span probe per call is unchanged: 0 installs, 0 detaches, 0 tokenizer builds, 0 evaluator installs, 291 evaluations and 291 child processes over ten calls. Construction: 16 installs, 1 detach (10 at A3), 1 tokenizer build, 26 evaluator installs. Round 4 (independent review): the extractor's report takes its own per-request policy snapshot (`captureCitationOperationPolicy`, not a configuration detach), so a caller mutating a returned report no longer changes the installed limits; the tautological refusal tests are deleted and replaced by real boundary tests on CitationEngineLive, the default engine and the extractor; `ownedStruct` takes a schema constructor; reference patterns are authenticated once per engine, by verify. Round 5 (review pass 2): schema-level tests restore coverage of the four custom rules the deletions left untested, the default path runs assets, document services and configuration validation in the base order with the base's typed failure, and the ownership and packet wording state the final state. Every Citation test file passed one by one in round 2; rounds 3 to 5 reran the files they touched. The full suite and coverage run on hosted CI.

Lane perf/citation-owned-configuration

Reverse: Return A4 to in progress if review or hosted CI finds a result or accounting change.

### All four slices merged; the packet is in closeout, 2026-11-14

A4 merged as #3319 (76b653230c5) with one configuration detach per engine. #3319 merged over one accepted red, Heavy / Coverage Regression (job 132371763661), which is not a required check: the six re-baselined rows are judged at the base floor inside the PR that lowers them. All 15 required checks passed on its head 5ec0f6c284d. The closeout reflection is history/reflections/2026-11-14-claude.md.

Lane docs/citation-install-once-closeout

Reverse: Return the packet to in-progress if a merged slice is reverted.

<!-- beep:decisions:end -->
