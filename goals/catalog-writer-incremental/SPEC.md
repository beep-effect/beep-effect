# Incremental Catalog Writer Spec

## Objective

Make the lefthook catalog writers (`beep lint schema-catalog --write --stage`, and the
instrumentation-catalog twin) parse only the staged files and splice their entries into the existing
per-package shards, so a commit costs the ~1 GB bun + ts-morph floor on every host instead of
1 GB + ~1.7 GB per 1000 files of each owning package (a `@beep/repo-cli` touch is 5.3 GB today).
Measurements, parity fixture and decision D2: `explorations/compute-profile-gate-routing/`
(RESEARCH.md M1, DECISIONS.md, MAP.md).

## Non-Goals

- Changing shard format, entry schema or ownership resolution.
- ts-morph flags as the fix: `skipFileDependencyResolution` and a syntactic symbol lookup were measured as no-ops for RSS (keep them only for wall time).
- Profile-based hook skipping and hosted regeneration (goal `compute-profile-gate-routing`).

## Source Hierarchy

1. User objective or issue that created this packet.
2. `AGENTS.md`, `CLAUDE.md`, and required skills.
3. Governing architecture/package standards.
4. This `SPEC.md`.
5. `PLAN.md`.
6. `GOAL.md`.
7. Supporting `research/`, `ops/`, and `history/` files.

Higher sources outrank lower sources when they conflict.

## Target Surfaces

- `packages/tooling/tool/cli/src/commands/Lint/SchemaCatalog.ts` and the instrumentation-catalog command.
- `packages/tooling/library/repo-cli-kit/**` `ShardScope` (per-file scope in addition to per-package scope).
- The `lefthook.yml` comment describing the hook's cost.

## Constraints

- Byte-identical shards: a scoped incremental run must produce what the full writer produces ("is current" after a full regeneration).
- A deleted or moved file (the hook passes `--diff-filter=ACMD --no-renames`) drops its entries; a renamed file adds under the new path.
- Only staged files are parsed; owning-package files that are not staged are never loaded into ts-morph.
- Full-repo runs and hosted Repo Sanity are unchanged.

## Acceptance Criteria

- [ ] Scoped run over the five exploration fixture files (`packages/epistemic/server/test/RetentionCalibrationCLI.test.ts`, `packages/foundation/ui-system/editor/test/capability-catalog.test.ts`, `packages/tooling/tool/cli/src/commands/Goals/ArchiveExecution.service.ts`, `packages/tooling/tool/cli/src/commands/Lint/EffectSchemaInventory.schemas.ts`, `packages/tooling/tool/cli/src/commands/Lint/SchemaCatalog.ts`) ≤ 1.5 GB max RSS (`/usr/bin/time -v`), 5.31 GB today, with byte-identical shards.
- [ ] Deleting a schema module and running the hook path drops its entries; full run then reports `is current`.
- [ ] Tests cover add, modify, delete and move for both writers.
- [ ] No unrelated refactors or formatting churn.

## Verification Matrix

| Check | Command or evidence | Required result |
| --- | --- | --- |
| Packet launcher size | `test "$(wc -m < goals/catalog-writer-incremental/GOAL.md)" -le 4000` | Passes |
| Manifest JSON | `jq . goals/catalog-writer-incremental/ops/manifest.json` | Passes |
| Whitespace | `git diff --check -- goals/catalog-writer-incremental` | Passes |
| RSS budget | `/usr/bin/time -v bun run beep lint schema-catalog <five fixture files>` | Max RSS ≤ 1.5 GB |
| Parity | `bun run beep lint schema-catalog` after the incremental write | `is current` |
| Package verify | `bun run beep quality package-verify @beep/repo-cli` | Passes |

## Stop Conditions

- Required source files are missing or materially contradictory.
- Any spend: purchases, paid services, quota top-ups or plan changes need the
  operator.
- The same blocker repeats after reasonable investigation.

Scope growth, destructive side effects and policy calls are not stops: decide
them and record each as a decision file.

## Decision log

Record each decision as its own file under `decisions/` (`bun run beep goals
decisions add catalog-writer-incremental --title "..." --reversal "..."`); the block below is
generated from that directory and never edited by hand.

<!-- beep:decisions:begin -->
_Generated from [`decisions/`](./decisions/) by `bun run beep goals decisions write --slug catalog-writer-incremental`; add a `kind: decision` file there, never edit this block._

### Incremental per-file shard splice is the fix; ts-morph flags are not, 2026-11-07

Measured 2026-11-07: skipFileDependencyResolution 5.31 to 5.23 GB, syntactic symbol lookup 5.05 GB, one small package 1.00 GB, CLI floor 0.35 GB. Cost is per-package ts-morph loading, so parse only staged files and splice entries (add/modify/delete/move). Exploration D2, D7.

Reverse: Revert to whole-shard regeneration per owning package

### Instrumentation writer keeps whole-owner regeneration, 2026-11-08

A scoped instrumentation-catalog run over two @beep/repo-cli files measured 566 MB max RSS and 3.4 s, already near the bun floor, because the writer adds and removes one source file at a time. Its span entries carry no file path, so a per-file splice needs a shard-format change, which SPEC.md lists as a non-goal. Only the schema-catalog writer becomes incremental.

Reverse: Add a file field to instrumentation span entries and splice per file

### Schema catalog reads exports syntactically instead of through the type checker, 2026-11-08

The per-file splice alone measured 2.28 GB max RSS (6.2 s) for the five fixture files, above the 1.5 GB target. Phase probes showed parsing is cheap (a 36 KB file adds ~2 MB); the spike came from ts-morph isExported(), which builds the type checker and loads every imported module the first time it meets a statement without an export keyword. For a variable statement isExported() reduces to hasExportKeyword() because a statement has no symbol, so that swap is exact; classes use a syntactic check for the export keyword, a local export specifier or export default. With it the run is 634 MB / 2.1 s. The brief's fallback, a syntactic same-file lookup replacing identifier.getSymbol(), measured 2.27 GB alone and made no difference once exports were syntactic (627 MB without it, 645 MB with it), so it was not adopted; skipFileDependencyResolution was likewise a no-op (634 MB both ways) and was left out. Full-repo parity: the full check prints is current and the full writer leaves git status clean.

Reverse: Restore declaration.isExported() and variableStatement.isExported() in SchemaCatalog.ts

<!-- beep:decisions:end -->

## Exception Ledger

| Exception | Scope | Owner | Rationale | Removal condition |
| --- | --- | --- | --- | --- |
| None | N/A | N/A | N/A | N/A |
