# P0 baseline check

Checked 2026-08-01 against the live checkout. No Effect source was re-mined. The
inventory outputs were redirected to `/tmp` so this report remains the only
packet/worktree write.

## 1. Inventory rule chassis — VERIFIED

- `requiredExportTags` is still `[@example, @category, @since]` at
  `packages/tooling/tool/cli/src/commands/Quality/internal/JSDocDocumentationInventory.ts:115`.
- Direct exports and overload groups still pass that same list to
  `missingRequiredTags` at `JSDocDocumentationInventory.ts:605` and `:667`.
- `missingExportExamples` is still derived only from a missing `@example` tag
  at `JSDocDocumentationInventory.ts:879`; description-carried Example sections
  do not currently satisfy presence.

## 2. Repo-wide JSDoc ratchet — VERIFIED

`runJSDocRatchet` reads one generated inventory's aggregate totals
(`JSDocRatchet.ts:431-432`), reads the committed aggregate baseline
(`:443`), and compares the two (`:444`). There is no file list, diff, or
per-file comparison in this path (`:426-445`).

## 3. Changed-files machinery — VERIFIED

- The reusable entry point is `collectChangedPathsSinceBase` in
  `packages/tooling/tool/cli/src/internal/repo-run/GitExec.ts:381-390`, exported
  by `packages/tooling/tool/cli/src/internal/repo-run/index.ts:8`. It accepts a
  diff range plus an optional pathspec.
- The same module also exposes `collectDirtyPaths` for staged, unstaged, and
  untracked paths (`GitExec.ts:328-355`).
- Existing quality-task usage independently collects working-tree changes at
  `packages/tooling/tool/cli/src/commands/Quality/Tasks.ts:578-603` and applies
  them to the root lint-fix fast path at `:1385-1393`.

P2 can reuse the generic `GitExec` entry points; it does not need to invent Git
path parsing.

## 4. Docgen dual-carrier harvest and compile gate — VERIFIED

- `getExampleFiles` extracts TypeScript fences from `doc.description` at
  `packages/tooling/tool/docgen/src/Core.ts:319-327`, then extracts fences from
  every parsed `@example` body at `:329-334`.
- The two arrays are concatenated into the same generated `Domain.File` stream
  at `Core.ts:336-345`.
- That stream is written and passed through the example tsconfig and compiler
  path at `Core.ts:159-170`; the compiler invocation is
  `tsc --noEmit --project <examples/tsconfig.json>` at `:450-456`.

Both carriers therefore feed the generated example files and the same compile
gate. P2 needs a regression fixture, not new harvesting.

## 5. Pattern-doc copy-paste bug — VERIFIED

The bug is currently at `.patterns/jsdoc-documentation.md:848`: the forbidden
example says `@packageDocumentation ← use @packageDocumentation`. The left side
should be the banned JSDoc-era `@module` tag; the replacement remains
`@packageDocumentation`.

## 6. Skill source references and mirrors — VERIFIED

Three Source Reference paths are stale in
`.claude/skills/jsdoc-annotation-specialist/SKILL.md:126-129`:

- `commands/Shared/JSDocCategories.ts` is now
  `packages/tooling/library/repo-utils/src/schemas/JSDocCategories.ts`
  (taxonomy begins at `:19`; exported values begin at `:31`).
- `packages/common/schema/src/SemanticVersion.ts` is now
  `packages/foundation/modeling/schema/src/SemanticVersion.ts` (schema at
  `:46-58`).
- `packages/common/schema/src/Duration.ts` is now split under
  `packages/foundation/modeling/schema/src/Duration/`; the cited Class and
  LiteralKit patterns are together in `Duration.input.ts:65-86` and `:141-155`.

The live root skill locations are `.claude/skills/jsdoc-annotation-specialist/`
and `.agents/skills/jsdoc-annotation-specialist/`; `.agents/skills` is a symlink
to `.claude/skills`, so these are one underlying mirror. There is no root
`.codex/skills/jsdoc-annotation-specialist/` mirror.

## 7. TSDoc registrations — VERIFIED

`tsdoc.json` still registers `@module` and `@template` as block tags at lines
6-7 and enables both in `supportForTags` at lines 64-65.

## 8. Regression baseline — VERIFIED

`standards/jsdoc-totals.regression-baseline.jsonc:5-19` is schema version 1
with source/regeneration/snapshot/comparison metadata and six aggregate
`tracked_totals`. Its snapshot is:

- `packagesNeedingRemediation: 0`
- `missingExportExamples: 0`
- `missingExportCategories: 0`
- `missingExportSince: 0`
- `unsafeExampleFindings: 0`
- `schemaAnnotationFindings: 0`

The recorded generation time remains `2026-07-08T11:32:58.606Z` (`:11`).

## 9. Live jsdoc-inventory run — DRIFTED

`bun run beep quality jsdoc-inventory` was run through its supported
`--output-json`/`--output-markdown` flags (`Quality.command.ts:2092-2112`) with
outputs under `/tmp`. It exited 0, so the command itself is green, but the live
inventory is not clean:

- packages 132; clean 127; without public src surface 3; needing remediation 2
- public modules 2,319; public exports 15,233
- open modules 2; open exports 14; root policy open 0
- missing examples 14; missing categories 2; missing since 2
- forbidden, malformed-conditional, import, unsafe-example, and schema-annotation
  findings are all 0

The command's summary was `packages=132 openPackages=2 openExports=14
openModules=2 rootPolicyOpen=0`. This differs from the six-zero committed
ratchet baseline for missing examples/categories/since and remediation count.
The generator reports findings but exits successfully (`Quality.command.ts:1951-1955`),
so exit-green must not be read as zero findings.

## 10. `@remarks` count — DRIFTED

An exact occurrence count with
`rg -o --glob 'packages/**/src/**/*.{ts,tsx}' '@remarks\b' packages | wc -l`
is **532**, not 491: growth of 41. The 532 occurrences span 291 source files.

## Implications for P1/P2

- P1 should fix the current line-848 `@module` example, remove both TSDoc
  registrations/support entries, and update the three skill paths in the single
  canonical `.claude` tree (the `.agents` path mirrors it automatically).
- P1/P2 planning should use 532 as the current `@remarks` cleanup universe.
- P2 should make Example presence kind-aware and accept a valid description
  section or grandfathered `@example`; the current chassis is tag-only.
- P2 should build touched-file enforcement on `collectChangedPathsSinceBase`
  and/or `collectDirtyPaths`; the aggregate ratchet cannot enforce cleanup on
  touch.
- P2's docgen work remains a dual-carrier regression fixture.
- Before changing the baseline, P2 must attribute the current 14/2/2 live
  findings and distinguish inventory exit success from ratchet cleanliness.
