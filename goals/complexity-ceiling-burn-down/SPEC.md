# Complexity Ceiling Burn-Down Spec

## Objective

Every function above cognitive complexity 15 in the live P0 Fallow 3.22.0 scan
(49 functions in `research/tail-inventory.md`) has a triage verdict executed —
refactored below the ceiling, waived via `thresholdOverrides` with reason and
review date, or excluded via `ignorePatterns` with provenance — and the fallow
health lane is promoted from advisory to a blocking baseline ratchet
(`--baseline standards/fallow.health.regression-baseline.jsonc`) after three
consecutive clean runs. The `maxCognitive: 8` gate (law 23,
`standards/effect-laws-v1.md`; DECISIONS entry 2026-07-30) stays credible:
suppression count does not grow from the current latest-main total of 207, and
no threshold-appeasement refactors land. The 2026-07-30 scan and original
refreshed P0 total of 194 remain provenance, not permanent inventories of a
repository that has since changed.

## Non-Goals

- Lowering the ceiling to 6 (revisit decision, recorded in the DECISIONS entry,
  after this packet closes and suppression pressure at 8 is observed).
- Refactoring the 7–15 band (frozen by the baseline; cleanup-on-touch).
- New fallow features beyond the two named P0 evaluations.
- The skills plugin or PreToolUse hooks (explicitly rejected 2026-07-30).

## Source Hierarchy

1. User objective (2026-09-03 refresh: burn down the current repository's
   complexity using the latest Fallow release; the historical packet must not
   block current work. 2026-09-08 clarification: keep the cognitive >15
   completion scope; critical estimated-CRAP findings in the 7-15 band do not
   expand the work. The user also approved mitigating inherited
   `GHSA-vwc7-r8mq-g2x9` with a private ONNX installer extraction directory,
   regression proof, and a reviewed expiring advisory exception).
2. `AGENTS.md`, `CLAUDE.md`, and required skills.
3. `standards/effect-laws-v1.md` (law 23), `standards/architecture/DECISIONS.md`
   (2026-07-30 entry), `standards/ARCHITECTURE.md`.
4. This `SPEC.md`.
5. `PLAN.md`.
6. `GOAL.md`.
7. Supporting `research/`, `ops/`, and `history/` files.

## Target Surfaces

- Every live tail function's owning package; the current inventory spans
  tooling, UI, modeling, drivers, ontology, and epistemic packages.
- `.fallowrc.jsonc` (`thresholdOverrides`, `ignorePatterns`).
- `standards/fallow.health.regression-baseline.jsonc` (shrinks each wave via
  `bun run fallow:health:baseline:write`).
- `packages/tooling/tool/cli/src/commands/Ci/CiLane.ts` and
  `packages/tooling/tool/cli/src/commands/Quality/FallowQuality.command.ts`
  (lane promotion, PR2 of the campaign).
- This packet's own files.
- The explicitly approved security follow-up: the pinned ONNX installer patch,
  root package manifest and lockfile registration, and a
  regression check run by the security lane before OSV.

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

- [x] `research/tail-inventory.md` carries a triage verdict per tail function,
      each executed in the candidate branch (refactor landed, override added,
      or ignore added).
- [x] Wave 1 (five panel-named seams in `research/calibration.md`) executed and
      verified; already-landed work counts when current source proves it.
- [x] `bun run fallow:health:baseline:check` exits 0 and an unbaselined scan
      shows zero functions above cognitive 15 without an override/ignore.
      Fallow's combined critical-severity labels may include estimated CRAP
      findings below that ceiling; report them separately without expanding
      the 7-15 non-goal.
- [x] Health lane promoted to blocking after 3 consecutive clean runs recorded
      under `reports/clean-runs.md` (PR2; CiLane + FallowQuality wiring).
- [x] P0 adopt/defer verdicts recorded for runtime-coverage CRAP and
      `fallow impact` trends, with evidence.
- [x] Inline suppression count is at most the latest-main Fallow 3.22.0 total
      of 207, with zero missing/stale reasons and no campaign-added
      suppressions. The +13 from the original 194 comparator landed on main
      independently of this campaign.
- [x] No unrelated refactors or formatting churn.
- [x] The approved ONNX installer mitigation is applied through a pinned Bun
      patch. Regression tests prove destination-symlink isolation, private
      permissions, successful extraction, and cleanup on failure. The security
      lane runs this proof before OSV. Main at `663904610c` replaces the
      vulnerable ZIP dependency with fflate, so the temporary advisory
      exception is no longer needed or retained.

## Verification Matrix

| Check | Command or evidence | Required result |
| --- | --- | --- |
| Packet launcher size | `test "$(wc -m < goals/complexity-ceiling-burn-down/GOAL.md)" -le 4000` | Passes |
| Manifest JSON | `jq . goals/complexity-ceiling-burn-down/ops/manifest.json` | Passes |
| Whitespace | `git diff --check -- goals/complexity-ceiling-burn-down` | Passes |
| Baseline ratchet | `bun run fallow:health:baseline:check` | Exit 0 |
| Cognitive tail | `bun run fallow:health --format json --quiet --complexity-breakdown --report-only` | Zero unwaived findings with cognitive complexity above 15 |
| Audit gate | `bun run beep quality fallow audit --check --quiet` | Exit 0 on each wave PR |
| Suppression hygiene | `bun run fallow suppressions` | Zero missing/stale reasons; total at most 207; no campaign-added suppressions |
| Reflection | `bun run beep lint reflection-artifacts` | Passes at P4 |
| Installer mitigation | `node --test scripts/test-onnxruntime-installer-patch.mjs` | Both regression cases pass against the installed pinned patch |
| Security gate | `bun run beep ci lane security` | Mitigation proof and OSV exit 0 |

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
| Five inherited/current tail waivers | `collectPgModelState`, `collectSqliteModelState`, `isSpec`, `jsonObjectTextFromMixedOutput`, and `jsonObjectTextFromRight`; exact paths and measured dimensions are recorded in `research/tail-inventory.md` and `.fallowrc.jsonc` | effect-drizzle / repo-cli | Existing attribution boundaries and linear mixed-output recovery algorithms; not budgets for campaign code | Reviews by 2026-11-10 or 2026-11-30; drop or reduce any dimension that no longer reproduces |
| Fourteen campaign waivers | `Scene`, `LiveWaveform`, `LinkPreview`, `TodoItem`, `Sidebar`, `parseQuotedField`, `SpeechInput`, `visit`, `walk`, `tokenizeLocal`, `scanComponent`, `parseRowAt`, `CalendarEventCard`, and `ChartTooltipContent`; exact paths and measured dimensions are recorded in `research/tail-inventory.md` and `.fallowrc.jsonc` | UI / schema / identity / RDF / repo-utils / repo-cli | Cohesive hook/prop boundaries, parser state machines, and filesystem-safety transactions where extraction would fragment invariants or change public APIs | Review by 2026-12-03; re-measure, lower, or remove when the owning boundary naturally changes |
