# Current shape

P2 source/design refresh at `7536a751b40b8560706dfe8cfa451591b11b025d`. The owner remains designed, Tier 1, derived/internal, 4/3. Current source and consumers support the same collection-based target with six categories. Independent P3 review and implementation remain pending. The exact preceding design is archived under `history/designs/2026-09-21-before-version-sync-refresh-r3-tooling-version-sync-category-filter-gates.md`.

`packages/tooling/tool/cli/src/commands/VersionSync/internal/services/CategorySelectionService.ts:38–58` computes two actual sibling Boolean values: `hasExplicitCategoryFilter` selects the requested category's flag, while `hasAnyExplicitCategoryFilter` ORs all six flags. These are values inside `shouldCheck`, not the callable service methods or CLI Flag descriptors. The public service shape at `:22–25` exposes `shouldCheck(options, category): boolean` and `selectedCategories(options): ReadonlyArray<VersionCategory>`. The latter currently calls the former for each category (`:60–61`).

The raw request remains three `VersionSyncOptions` members (`VersionSync.schemas.ts:428–474`), each with six independent category Booleans and independent `skipNetwork`; all seven default to false on construction and decoding (`:423–426`). The mode vocabulary and six-category `VersionCategory` LiteralKit already exist (`:64–99`).

# Cardinality gap

For `[hasExplicitCategoryFilter, hasAnyExplicitCategoryFilter]`, the legal tuples are FF (no flags), FT (another category selected), and TT (this category selected, possibly alongside others). TF is impossible because the selected flag is one term in the OR. This is E4 at `CategorySelectionService.ts:49–57`, 4 representable / 3 legal.

Concrete supported inputs for category `bun` are `VersionSyncOptions.cases.check.make({})`, the same constructor with `{nodeOnly: true}`, and with `{bunOnly: true}`. The existing CLI adapter passes all six flags to `handleVersionSync` without mutual-exclusion validation (`VersionSync.command.ts:82–108`); multiple true flags, including all six, remain legitimate. Repeat these witnesses for every category and every check/write/dry-run mode. No Option, omission-as-false assumption beyond the existing defaults, or required-payload predicate contributes an inventory member.

# Target schema

Reuse `VersionCategory` and `VersionCategoryOptions`; do not create another all/selected/excluded vocabulary. Make the already exposed `selectedCategories` method the single derivation of the category collection. Filter `VersionCategoryOptions` by the corresponding existing option Boolean, using the existing category LiteralKit's exhaustive matcher. If that collection is empty, return `VersionCategoryOptions`; otherwise return the selected collection. `shouldCheck` becomes the single membership test `A.contains(selectedCategories(options), category)`.

This reverses the current helper dependency without recursion. The existing `S.Array(VersionCategory)` domain describes the collection; a new stored schema, wrapper class, decoded request shape, or persisted selection is unnecessary. Preserve the declaration-order result, multi-selection, defaults, and both service method signatures. The target taxonomy is `literalkit` because the existing six-value LiteralKit supplies the single authoritative category domain. The original three local situations are preserved observationally: unfiltered and explicitly selected both include the queried category; an unrelated explicit selection does not.

# Migration inventory

| Location | Required migration or preserved consumer |
| --- | --- |
| `CategorySelectionService.ts:38–61` | Replace the two Boolean locals and their OR expression with the collection derivation and membership projection; keep helpers private. |
| `CategorySelectionService.ts:22–36,69–75` | Keep service methods, Context identity and Layer wiring intact. |
| `internal/services/ResolverService.ts:149–177` | Preserve all six category checks, resolver order, failures and conditional network requests. No signature migration. |
| `internal/Handler.ts:13,22,28–80` | Preserve service provision and check/write/dry-run handling. |
| `VersionSync.command.ts:82–108`; `VersionSync.schemas.ts:423–474` | Preserve the CLI adapter, mode schemas and complete independent request fields. |
| `src/test/VersionSync.test-kit.ts`; CLI `package.json:67` | Existing command wildcard export permits source-subpath imports. The service's exported interface remains identical; no new test-only API is needed. |

Graft's incoming graph and exhaustive source searches across `packages` and `apps` found only ResolverService calling `shouldCheck`; `selectedCategories` has no external current source call. Layer construction in Handler remains a real dependency. Missing graph edges were not used as absence proof. Do not refactor sibling services or the exported service type as part of this Boolean change.

## Current resolver and update contracts

`ResolverService.ts:76–145` retains typed warning-to-empty handling for Bun,
Docker, Biome, Effect, and Turbo. Node resolution retains its propagated failure
and update-location collection. `:153–177` checks bun, node, docker, biome,
effect, and turbo in that order. Empty Bun/Biome/Turbo states may omit their
reports. Preserve those omissions, exact report payloads, warning behavior, and
conditional network requests. The selection refactor does not move resolution,
change its error channel, or eagerly run an unselected category.

Turbo resolution at `TurboResolver.ts:207–227` reads the installed version and
scans the root followed by sorted unique workspace directories. Files without
`$schema` remain untouched. `RootCatalog.ts:228–245` gives the lockfile priority,
then the root catalog and devDependencies. Preserve the unsupported-version and
missing-version report behavior at `TurboResolver.ts:239–284`.

`UpdateApplierService.ts:227–261` applies only the selected reports, in existing
order, with Node locations handled separately. `:169–182` updates only Turbo
schema items using their complete expected URL. `JsoncSchemaUpdater.ts:35–55`
changes only the top-level `$schema`, preserves the existing JSONC formatting
behavior, and writes only when content differs. Keep these helpers unchanged.
`Handler.ts:28–55` still renders before mode dispatch, writes only when drift
exists, fails check mode on drift, and leaves dry-run without update calls.

The current package/app search found ResolverService as the production service
consumer, Handler as its layer provider, and the VersionSync test facade as the
export route. `selectedCategories` has no production external caller. Keep the
existing wildcard package export and test-facade routes. The source fixture at
`version-sync-effect.test.ts:855–878` verifies default order including Turbo,
turbo-only selection, and mixed selections. This source inspection is not an
executed implementation test or an independent P3 review.

# Guard-deletion accounting

Remove two correlated Boolean locals, one six-way OR, and the final `!hasAny || hasExplicit` branch. Keep the category lookup necessary to interpret the five independent input flags, now in one collection derivation. Add one collection-empty/default decision and one membership test. There is no invalid-state validator or typed error to delete. Do not claim six deleted input guards: the six input observations remain semantically necessary. No custom schema guard or extra check wall is introduced.

# Encoded-side impact

Tier 1, derived/internal. Neither local flag is encoded. No JSON key, public request Boolean, mode, default, omission behavior, category string, report layout, network policy or operation ordering changes. Existing `VersionSyncOptions` schemas and the final report codec remain unchanged. The broader seven-Boolean D1 mode owners remain independent and must not be replaced by an exclusive one-category selection.

# Test impact

At implementation time, exercise the existing service Layer over all 64 category subsets, six queried categories, three modes and both `skipNetwork` values. Assert `selectedCategories` preserves category order and defaults an empty subset to all categories, and `shouldCheck` agrees with membership. Explicit no-filter, other-filter, this-filter, multiple-filter and all-filter cases verify the supported tuples without mirroring the old OR implementation. Preserve current version-sync resolver tests and run required CLI package verification only during implementation. No test or package command ran for this P2 design.

# Risk

The main risks are accidentally making category flags exclusive, reversing the helper dependency without removing recursion, or evaluating a resolver for an unselected category. The collection is derived per invocation as today; no cache or new state lifetime is proposed. Independent P3 remains pending; this design specifies future implementation without authorizing source changes.

Landing: use the ordered Tier 1E internal tooling subsystem batch. VersionSync category selection precedes the Bun report simplification. Keep all shared-file edits serial and verify the completed subsystem batch.
