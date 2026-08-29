# Complexity Ceiling Burn-Down Spec

## Objective

Every function above cognitive complexity 15 (the inherited tail: ~60 functions,
snapshot in `research/tail-inventory.md`) has a triage verdict executed —
refactored below the ceiling, waived via `thresholdOverrides` with reason and
review date, or excluded via `ignorePatterns` with provenance — and the fallow
health lane is promoted from advisory to a blocking baseline ratchet
(`--baseline standards/fallow.health.regression-baseline.jsonc`) after three
consecutive clean runs. The `maxCognitive: 8` gate (law 23,
`standards/effect-laws-v1.md`; DECISIONS entry 2026-07-30) stays credible:
suppression count does not grow, and no threshold-appeasement refactors land.

## Non-Goals

- Lowering the ceiling to 6 (revisit decision, recorded in the DECISIONS entry,
  after this packet closes and suppression pressure at 8 is observed).
- Refactoring the 7–15 band (frozen by the baseline; cleanup-on-touch).
- New fallow features beyond the two named P0 evaluations.
- The skills plugin or PreToolUse hooks (explicitly rejected 2026-07-30).

## Source Hierarchy

1. User objective (2026-07-30 calibration session decisions, all seven recorded
   in `research/calibration.md`).
2. `AGENTS.md`, `CLAUDE.md`, and required skills.
3. `standards/effect-laws-v1.md` (law 23), `standards/architecture/DECISIONS.md`
   (2026-07-30 entry), `standards/ARCHITECTURE.md`.
4. This `SPEC.md`.
5. `PLAN.md`.
6. `GOAL.md`.
7. Supporting `research/`, `ops/`, and `history/` files.

## Target Surfaces

- The tail functions' owning packages (concentrated in `packages/tooling` CLI
  lint/codegen and `packages/foundation/ui-system`).
- `.fallowrc.jsonc` (`thresholdOverrides`, `ignorePatterns`).
- `standards/fallow.health.regression-baseline.jsonc` (shrinks each wave via
  `bun run fallow:health:baseline:write`).
- `packages/tooling/tool/cli/src/commands/Ci/CiLane.ts` and
  `packages/tooling/tool/cli/src/commands/Quality/FallowQuality.command.ts`
  (lane promotion, PR2 of the campaign).
- This packet's own files.

## Constraints

- **No appeasement.** A refactor must be defensible in review with the gate
  turned off: real seams, match helpers, schema/data-table dispatch, named
  concept extraction. Crispen doctrine outranks the metric — if the best form
  of a function is over the ceiling, it gets an override with reason + review
  date, never fragmentation and never a bare suppression.
- Triage-first (fallow-zero-dead-code discipline): every tail function gets a
  recorded verdict before remediation; disputed verdicts are re-verified.
- Attribution before repair (CLAUDE.md Quality Operator): introduced /
  inherited / unrelated / environment-only decides fix vs rebase vs report.
- The baseline only shrinks. Rebaseline (`fallow:health:baseline:write`) only
  at wave boundaries, in the same PR as the wave's refactors.
- Generated-ish or vendored-port code follows the `Html.model.ts` precedent:
  `ignorePatterns` with a provenance comment, not per-function overrides.
- Execution routing (user directive 2026-07-30): Codex agents implement
  (GPT-5.6 Sol, xhigh); Fable orchestrates and reviews. Refactor worked
  examples: `goals/standards-remediation/ops/reports/{DA-2,SF-2}`.
- Effect-first repo laws apply to every refactor (no helper-wall extraction,
  `Effect.fn`/`Effect.fnUntraced` for generator returns, match over chains).

## Acceptance Criteria

- [ ] `research/tail-inventory.md` carries a triage verdict per tail function,
      each executed (refactor merged, override added, or ignore added).
- [ ] Wave 1 (five panel-named refactors in `research/calibration.md`) merged.
- [ ] `bun run fallow:health:baseline:check` exits 0 and the committed baseline
      shows zero `critical` complexity findings (nothing above cognitive 15
      without an override/ignore).
- [ ] Health lane promoted to blocking after 3 consecutive clean runs recorded
      under `reports/clean-runs.md` (PR2; CiLane + FallowQuality wiring).
- [ ] P0 adopt/defer verdicts recorded for runtime-coverage CRAP and
      `fallow impact` trends, with evidence.
- [ ] Inline suppression count (fallow suppressions totals) has not grown vs
      the 2026-07-30 backfilled inventory.
- [ ] No unrelated refactors or formatting churn.

## Verification Matrix

| Check | Command or evidence | Required result |
| --- | --- | --- |
| Packet launcher size | `test "$(wc -m < goals/complexity-ceiling-burn-down/GOAL.md)" -le 4000` | Passes |
| Manifest JSON | `jq . goals/complexity-ceiling-burn-down/ops/manifest.json` | Passes |
| Whitespace | `git diff --check -- goals/complexity-ceiling-burn-down` | Passes |
| Baseline ratchet | `bun run fallow:health:baseline:check` | Exit 0 |
| Audit gate | `bun run beep quality fallow audit --check --quiet` | Exit 0 on each wave PR |
| Suppression hygiene | `bun run fallow suppressions` | Zero missing reasons; totals not above 2026-07-30 inventory |
| Reflection | `bun run beep lint reflection-artifacts` | Passes at P4 |

## Stop Conditions

- Required source files are missing or materially contradictory.
- The implementation would exceed named scope.
- Verification requires credentials, cost, destructive side effects, or policy
  approval not named in this spec.
- The same blocker repeats after reasonable investigation.
- A refactor would degrade quality to satisfy the threshold — take the override
  path and record it in the Exception Ledger instead.

## Exception Ledger

| Exception | Scope | Owner | Rationale | Removal condition |
| --- | --- | --- | --- | --- |
| `maxCrap: 73` override | `Session.inspector.tsx` `TripleValidationMessages` | ontology/ui | Attribution artifact (pre-existing; import-suffix change misattribution) | Review by 2026-10-30; drop if audit no longer misattributes |
| `maxCrap: 57` override | `Session.sparql.tsx` `sparqlResultPreview`, `runSparqlFromKeyboard` | ontology/ui | Attribution artifact (same class) | Review by 2026-10-30; drop if audit no longer misattributes |
