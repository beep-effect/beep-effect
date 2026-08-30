# Fallow Quality Enforcement

## Status

Lifecycle: `completed-retained`

**COMPLETED-RETAINED** — P3 blocking promotion landed (fqe-006 closed via
goals/fallow-zero-dead-code on 2026-06-11). Current posture: `fallow:dead-code`
is blocking in `quality github-checks pre-push`; `fallow:audit` was later
downgraded to advisory-only (`295eb62557`, 2026-06-18). Manifest lifecycle:
`completed-retained`.

### Closeout reconciliation (2026-07-11)

The work shipped weeks before this paperwork closeout. Git evidence: advisory
integration landed through PR #222 (merged 2026-06-08, `1366a812a6`); the final
blocking promotion (fqe-006) landed through PR #229 "fallow zero dead-code +
blocking lane promotion" (merged 2026-06-11, commits `bccc71ef23`,
`ae74f400f6`). A post-close adjustment (`295eb62557`, 2026-06-18) kept
dead-code blocking but returned the audit lane (complexity/duplication smells)
to advisory. All tasks in `tasks/tasks.jsonc` are `done` with checks `passed`.
Only `ops/manifest.json` had drifted, still reading `active` with
`updated: 2026-06-08`; reconciled today to `completed-retained`.

## Owner

@beep-team

## Created / Updated

- **Created:** 2026-06-08
- **Updated:** 2026-07-11

## Purpose

This goal turns the current Fallow pilot into a repo-native quality subsystem
for fast agent feedback. Fallow should deepen existing quality law enforcement:
dead-code analysis, changed-code audit, duplicate logic, complexity, boundaries,
feature flags, security candidates, suppressions, and dry-run fix previews.

Fallow is an enforcement projection only. Architecture meaning remains owned by
`standards/ARCHITECTURE.md`, numbered architecture docs, package READMEs, and
existing repo-law standards.

## Reading Order

- [SPEC.md](./SPEC.md) - binding contract for this goal
- [PLAN.md](./PLAN.md) - phase sequence
- [GOAL.md](./GOAL.md) - compact launcher
- [ops/manifest.json](./ops/manifest.json) - machine-readable metadata
- [research/feature-matrix.jsonc](./research/feature-matrix.jsonc) - feature
  family status and promotion gates
- [research/knip-parity.jsonc](./research/knip-parity.jsonc) - keep-or-retire
  evidence for Knip
- [tasks/tasks.jsonc](./tasks/tasks.jsonc) - implementation queue
- [reports/report-envelope-fixtures.jsonc](./reports/report-envelope-fixtures.jsonc) -
  report and Yeet attribution fixtures
- [history/review-rounds.jsonc](./history/review-rounds.jsonc) - critic loop
  closure inventory
- [../../standards/fallow.boundaries.provenance.jsonc](../../standards/fallow.boundaries.provenance.jsonc) -
  generated boundary-rule provenance sidecar

## Current Decisions

- Target canonical operator UX is `beep quality fallow ...`; P1 implements it.
- Existing root scripts are convenience shims only.
- `beep fallow boundaries` may remain as a compatibility alias while Fallow
  migrates under `beep quality`.
- P1 wrappers are report-only and stay outside `pre-push`.
- P3 adds an explicit advisory Yeet feedback step before any blocking promotion;
  the advisory step is implemented and emits nonblocking `QualityIssueIndex`
  packets from Fallow envelopes.
- P3 blocking promotion must be wired through `quality github-checks pre-push`
  so Yeet verify, Yeet publish, and `audit:github pre-push` remain equivalent.
- Blocking promotion must also prove the normal
  `beep yeet publish --plan --json` pre-push path, not only
  `beep yeet verify --plan --json`.
- Runtime coverage is research-only.
- `fix-preview` is dry-run only; Yeet repair must not run hidden Fallow
  mutations.
- Knip remains the reference analyzer and parity gate until parity rows
  explicitly support replacing it.
- Hosted CI now uploads repo-cli Fallow envelopes with hard
  artifact-existence proof.

## Verification

```sh
test "$(wc -m < goals/fallow-quality-enforcement/GOAL.md)" -le 4000
bun goals/fallow-quality-enforcement/ops/validate-packet.ts
bun goals/fallow-quality-enforcement/ops/validate-fallow-audit-baseline.ts
bun goals/fallow-quality-enforcement/ops/validate-knip-parity-baselines.ts
bunx biome check goals/fallow-quality-enforcement standards/fallow.pilot.inventory.jsonc standards/fallow.dead-code.regression-baseline.jsonc standards/fallow.boundaries.generated.jsonc standards/fallow.boundaries.provenance.jsonc standards/fallow.boundaries.provenance.schema.json
git diff --check -- goals/fallow-quality-enforcement standards/fallow.pilot.inventory.jsonc standards/fallow.dead-code.regression-baseline.jsonc standards/fallow.boundaries.generated.jsonc standards/fallow.boundaries.provenance.jsonc standards/fallow.boundaries.provenance.schema.json
```
