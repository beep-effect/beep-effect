# PLAN — Repo Crispening Orchestration

Execution plan for the goal defined in [SPEC.md](./SPEC.md). Run phases in
order — D3 locks the sequencing: no remediation before enforcement + baseline
exist (`research/decisions-locked.md`). Track status in
[ops/progress.json](./ops/progress.json). All decisions D1–D5 and grill
outcomes G1–G7 are locked; amendments require a superseding
`standards/architecture/DECISIONS.md` entry.

## P0 — Enforce foundations

**Goal:** the enforcement surface exists before any sweep — 4 novel lint
cards, the per-owner blocking policy, the Law 20/47 amendment, and the
doctrine sanction. No remediation in this phase.

Steps:

1. Author the 4 novel cards in
   `packages/tooling/tool/cli/src/commands/Lint/SchemaFirst.ts`:
   - Add `SFV4-fn-schema`, `SFV4-getsomes-struct`, `SFV4-normalization`,
     `SFV4-null-return` to the `SchemaFirstPolicyRuleId` LiteralKit
     (`SchemaFirst.ts:113-123`). `SFV4-type-alias` is dropped (G3 —
     redundant with the existing detectors).
   - One detector function per card, modeled on `detectInterfaceReason` /
     `detectTypeAliasReason` / `detectStructReason`
     (`SchemaFirst.ts:447/460/508`).
   - One remediation branch per card in the `remediationForEntry` chain
     (`SchemaFirst.ts:320-343`).
   - Wire the detectors from `scanSchemaFirstInventory`
     (`SchemaFirst.ts:1076`).
   - Findings emit `[schema-first:issue]` JSON lines; Yeet's
     `schemaFirstPolicyIssueFromLine`
     (`packages/tooling/tool/cli/src/commands/Yeet/internal/QualityIssueIndex.ts:852`,
     prefix constant at `:30`) sets subCategory = ruleId, so the new
     ruleIds parse with NO parser change.
2. Build `standards/schema-crispening.policy.jsonc` (owner/family →
   blocking flag) and extend `schemaFirstLintHasFailures`
   (`SchemaFirst.ts:1464-1477`) to consult it: novel-card advisories are
   non-blocking until their family flips (G4).
3. Amend Law 20 (`.claude/skills/effect-first-development/SKILL.md:99`) and
   Law 47 (`:126`) plus mirrors (`standards/effect-first-development.md:75`,
   `.claude/skills/schema-first-development/SKILL.md:96` and the related
   guidance around lines 34/571): prefer `O.getSomesStruct` for
   heterogeneous struct-spreads; keep `R.getSomes` for homogeneous
   dictionaries (D5 — merged before the sweep runs).
4. Author the consolidated `standards/architecture/DECISIONS.md` entry (ADR
   format `## 2026-MM-DD: Title` / Status / Decision / Rationale)
   sanctioning: family-scoped waves vs cleanup-on-touch
   (`standards/architecture/README.md:48-52`), the per-owner blocking
   policy, and the Law 20/47 amendment (G6).

**Acceptance:** new cards emit findings on fixtures; policy file consulted
by `schemaFirstLintHasFailures`; laws amended in all mirrors; DECISIONS
entry merged; `bun run beep yeet verify` green.

## P1 — Baseline & rank

**Goal:** a complete, ranked, audited inventory of crispening findings —
read-only, no source edits (D2: specialists find, package-agents fix).

Steps:

1. Populate `topoOrder` in `ops/progress.json` from `bun run topo-sort`.
2. Spawn 5 discovery specialists (prompts at
   [ops/prompts/](./ops/prompts/) — `S1-schema-as-truth.discovery.md`
   through `S5-precision-testing-annotations.discovery.md`), each sweeping
   per-package and writing read-only inventories to
   `ops/inventory/<Sn>/<pkg>.json` using the §5.5 record shape:
   `{ ruleId, file, line, symbol, smell, proposedTarget, confidence (0–1),
   mechanization ("codemod"|"assisted"|"judgment"), roiRank, exception? }`.
3. False-positive audit pass over every inventory; drop or downgrade
   non-findings before they enter the baseline.
4. Record exception-ledger entries for findings kept out of scope.
5. Land baseline advisories in `standards/schema-first.inventory.jsonc`
   (entry shape `{file, symbol, kind, status, ruleId?, line?, owner,
   reason}`, key = `file::symbol::kind::ruleId::line`).

**Acceptance:** every in-scope package has 5 specialist inventories (or an
explicit clean marker); false-positive audit done; baseline advisories
landed; `ops/progress.json` reflects per-package `discovery` status.

## P1.5 — Mechanize

**Goal:** every finding triaged into the 0.9/0.6 tiers (G5) and the tier-1/
tier-2 transforms exist as tested codemods.

Steps:

1. Triage the inventory: confidence ≥ 0.9 → pure codemod; 0.6–0.9 →
   codemod proposes + agent reviews each diff; < 0.6 → judgment-only.
2. Author ts-morph codemods in `ops/codemods/`, built on
   `packages/tooling/library/repo-utils/src/TSMorph/TSMorph.service.ts`
   `updateSourceFile` (interface `:364`, impl `:1273` — the only
   persisting edit path).
3. A golden-diff dry-run test per codemod is REQUIRED before any wave runs
   it.

**Acceptance:** triage table complete; every codemod has a passing
golden-diff dry-run test; no codemod has touched source yet.

## P2 — Remediation waves

**Goal:** family-scoped waves flip each family from advisory to blocking.
Order: foundation → drivers → tooling → apps/slices (G2). Wave 1 = pilot
on one foundation/modeling exemplar (e.g. `@beep/md` or `@beep/lexical`).

Per package (one writer agent, prompt at
`ops/prompts/remediation.agent.md`):

1. Apply tier-1 codemods; review every tier-2 diff; handle judgment items
   by hand.
2. Behavior-parity proof (§5.3): encoded/wire snapshot byte-identical
   before vs after (SQL row shape for persisted models) + at least one
   `S.toArbitrary` round-trip per absorbed invariant.
3. Ripple protocol (§5.4): any public-form change ships the consumer sweep
   in the same PR — no deferred call-site fixes.
4. `bun run beep yeet verify` green; mark `remediation: done` in
   `ops/progress.json`. On failure: stop the wave, leave the package
   `remediation: blocked` with the failing output.

Per family, once its wave is green: flip the family to blocking in
`standards/schema-crispening.policy.jsonc` + add a regression fixture;
update `families` and the burndown in `ops/progress.json`.

**Acceptance:** all four families remediated and flipped to blocking;
burndown table (below) fully `done`; zero actionable S1–S5 findings per
family or a documented exception (§5.1).

## P3 — Catalog & ship

**Goal:** the schema catalog exists and the PR is mergeable.

Steps:

1. Implement a `beep` CLI command that walks schema ASTs and emits
   `standards/schema-catalog.generated.jsonc` (tracked in git — G7;
   `docs/generated/` is gitignored).
2. Drive the Yeet PR to mergeable:
   `bun run beep yeet publish --message "..." && bun run beep yeet monitor`.

**Acceptance:** catalog generated and tracked; PR checks green and merge-
ready via Yeet monitor.

## P4 — Close

**Goal:** packet closed with reflection, final burndown, ratchet engaged.

Steps:

1. `/reflect` reflection artifact at
   `history/reflections/<date>-<agent>.md`;
   `bun run beep lint reflection-artifacts` passes.
2. Burndown table below at Definition of Done.
3. Ratchet fully engaged: all families blocking in the policy.

**Acceptance:** reflection lint green; burndown `done` across the board;
`ops/progress.json` phases all `done`.

## Burndown

Cells advance `pending` → `in_progress` → `done` per family wave. Mirror in
`ops/progress.json` `burndown`.

| Specialist | foundation | drivers | tooling | apps/slices |
| --- | --- | --- | --- | --- |
| S1 schema-as-truth | pending | pending | pending | pending |
| S2 defaults/normalization/Option | pending | pending | pending | pending |
| S3 discrimination/exhaustiveness | pending | pending | pending | pending |
| S4 colocation/pipeability | pending | pending | pending | pending |
| S5 precision/testing/annotations | pending | pending | pending | pending |

## Operating constraints

- Never edit `.repos/**` or generated files.
- §6 fences (SPEC.md Non-Goals) are binding on every wave — notably the
  service-contract carve-out, SQL absence encodes `null`, and no
  native-collection migration (that is `effect-native-migration`'s seam).
- One writer agent per package; touch-scoped waves — each wave edits only
  its family's packages.
- The run is resumable: reconcile against `ops/progress.json` before each
  wave; skip packages already `done`.
