# Inline Schema Compiler Hard Error Spec

## Objective

Eliminate all remaining inline Effect Schema compiler calls governed by
`beep(no-inline-schema-compile)`, compile each reusable helper once at module
scope, and promote the lint rule from warning to error.

## Opening Baseline

The predecessor's closing census recorded 2,931 findings on 2026-08-30. That
artifact is the opening baseline for this packet:

`goals/schema-utils-selective-codec-statics/research/closing-census.json`

The first phase must reproduce the count against the then-current checkout and
record any drift before implementation begins.

## Non-Goals

- Redesign schemas, codecs, errors, or public APIs when a behavior-preserving
  module-scope compiler is sufficient.
- Reintroduce broad codec-static bundles or attach helpers that have no
  evidenced consumer.
- Change parse options, JSON formatting policy, service requirements, or
  sync/effect execution semantics.
- Clean unrelated lint families.

## Source Hierarchy

1. User objective and the ratified predecessor packet.
2. `AGENTS.md`, `CLAUDE.md`, and required skills.
3. Repository architecture, lint, schema, and generator standards.
4. This `SPEC.md`.
5. `PLAN.md`.
6. `GOAL.md`.
7. Supporting `research/`, `ops/`, and `history/` files.

Higher sources outrank lower sources when they conflict.

## Target Surfaces

- Every repository file governed by `beep(no-inline-schema-compile)`.
- The lint rule's severity configuration and focused rule tests.
- Generator templates or writers that own affected generated output.
- Affected package tests and documentation examples.

## Constraints

- Compile runners and guards once at module declaration scope or expose an
  already-hoisted, selectively attached helper.
- Preserve the exact native Effect helper signature and error channel.
- Preserve invocation-time `SchemaAST.ParseOptions`; do not close over a
  per-call option by rebuilding the compiler.
- Update generator ownership before output and verify regeneration.
- Use per-family no-growth baselines until the repository reaches zero.
- Do not weaken, suppress, or add exceptions to achieve zero.

## Acceptance Criteria

- [x] A reproducible inventory accounts for the full opening baseline.
- [x] Repository lint reports zero `beep(no-inline-schema-compile)` findings.
- [x] The lint rule is configured as an error after zero is reached.
- [x] Focused rule tests cover inline rejection and module-scope acceptance.
- [x] Every affected workspace package completes its required package verify.
- [x] Generated sources are regenerated from their updated owners without
      unexplained drift.
- [x] Canonical repository and hosted verification are green.
- [x] No unrelated refactors or formatting churn.

These acceptance records refer to the completed implementation and its pinned
verification evidence. This packet-only closeout candidate must independently
pass final-head local and hosted verification and terminal Yeet monitoring
before merge. The lifecycle update is included before publication so that the
accepted PR lands the completed packet without another metadata-only follow-up.

## Verification Matrix

| Check | Command or evidence | Required result |
| --- | --- | --- |
| Opening census | Reproducible goal-local census | Accounts for 2,931 findings or records explained drift |
| Rule tests | Focused policy-pack lint-rule tests | Green |
| Repository lint | Canonical lint/Yeet lane | Zero findings, error severity enabled |
| Packages | `bun run beep quality package-verify <package>` | Green for every touched package |
| Package evidence inventory | `bun test goals/inline-schema-compile-hard-error/research/scripts/package-verification.test.ts` | Primary and linked supplemental receipts cover all 108 affected owners on the pinned head |
| Packet launcher | `test "$(wc -m < goals/inline-schema-compile-hard-error/GOAL.md)" -le 4000` | Passes |
| Goal fleet | `bun run beep goals doctor` and index check | Green |
| Hosted closure | `bun run beep yeet monitor` | `merge-ready: yes` |

## Stop Conditions

- A compiler cannot be hoisted without changing observable behavior.
- The opening census cannot be reproduced or its ownership cannot be mapped.
- Required source files are missing or materially contradictory.
- The implementation would exceed named scope.
- Verification requires credentials, cost, destructive side effects, or policy
  approval not named in this spec.
- The same blocker repeats after reasonable investigation.

## Exception Ledger

| Exception | Scope | Owner | Rationale | Removal condition |
| --- | --- | --- | --- | --- |
| Final closeout follows the implementation PR | Packet publication only; PR #1038 | Operator, approved 2026-09-09 | PR #1028 merged before final verification and lifecycle closeout. The operator authorized a final closeout PR; no implementation or verification requirement was waived. | Superseded by the successor-draft exception after #1038 also merged before closeout. |
| Successor draft carries final closeout | Packet publication only; PR #1042, branch `codex/inline-schema-packet-closeout` | Operator, approved 2026-09-09 | PR #1038 merged while its final-head local proof was queued. The operator authorized a successor draft PR and later marked it ready for review. No implementation or verification requirement was waived. | Unfulfilled at merge: #1042 merged at 09:01:20 UTC on 2026-09-09 before the final packet update. Superseded by the explicitly approved lifecycle-closeout successor below. |
| Lifecycle update precedes successor publication | Packet publication only; branch `codex/inline-schema-lifecycle-closeout` | Operator, approved 2026-09-09 after #1042 merged | The operator authorized one successor containing the completed packet-state update before publication, with merging held until final verification and reviews complete. This corrects #1042's packet-closeout P1 without waiving any implementation, verification, or review requirement. | The successor contains the synchronized completed-retained lifecycle, completed phase states, and validated reflection; its final head passes local and hosted verification, all review comments are addressed, and Yeet reports `merge-ready: yes`. |
