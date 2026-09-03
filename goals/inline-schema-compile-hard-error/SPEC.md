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

- [ ] A reproducible inventory accounts for the full opening baseline.
- [ ] Repository lint reports zero `beep(no-inline-schema-compile)` findings.
- [ ] The lint rule is configured as an error after zero is reached.
- [ ] Focused rule tests cover inline rejection and module-scope acceptance.
- [ ] Every affected workspace package completes its required package verify.
- [ ] Generated sources are regenerated from their updated owners without
      unexplained drift.
- [ ] Canonical repository and hosted verification are green.
- [ ] No unrelated refactors or formatting churn.

## Verification Matrix

| Check | Command or evidence | Required result |
| --- | --- | --- |
| Opening census | Reproducible goal-local census | Accounts for 2,931 findings or records explained drift |
| Rule tests | Focused policy-pack lint-rule tests | Green |
| Repository lint | Canonical lint/Yeet lane | Zero findings, error severity enabled |
| Packages | `bun run beep quality package-verify <package>` | Green for every touched package |
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
| None | N/A | N/A | N/A | N/A |
