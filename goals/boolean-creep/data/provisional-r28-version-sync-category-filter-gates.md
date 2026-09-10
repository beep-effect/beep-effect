# Current shape

Provisional native P2 design for stable `r3-tooling-version-sync-category-filter-gates`, correcting D1 to qualified 4/3. Independent R28 reconciliation and P3 remain pending. Frozen source: HEAD `93217d998f851e2e93d9864e2b5315552eaa58a7`, origin/main `d1b4d769fbaffddd55717f3b1ba461897dd545c5`.

`packages/tooling/tool/cli/src/commands/VersionSync/internal/services/CategorySelectionService.ts:38–51` computes two actual sibling Boolean values: `hasExplicitCategoryFilter` selects the requested category's flag, while `hasAnyExplicitCategoryFilter` ORs all five flags. These are values inside `shouldCheck`, not the callable service methods or CLI Flag descriptors. The public service shape at `:22–25` exposes `shouldCheck(options, category): boolean` and `selectedCategories(options): ReadonlyArray<VersionCategory>`. The latter currently calls the former for each category (`:54–55`).

The raw request remains three `VersionSyncOptions` members (`VersionSync.schemas.ts:411–454`), each with five independent category Booleans and independent `skipNetwork`; all six default to false on construction and decoding (`:406–409`). The mode vocabulary and five-category `VersionCategory` LiteralKit already exist (`:64–99`).

# Cardinality gap

For `[hasExplicitCategoryFilter, hasAnyExplicitCategoryFilter]`, the legal tuples are FF (no flags), FT (another category selected), and TT (this category selected, possibly alongside others). TF is impossible because the selected flag is one term in the OR. This is E4 at `CategorySelectionService.ts:48–51`, 4 representable / 3 legal.

Concrete supported inputs for category `bun` are `VersionSyncOptions.cases.check.make({})`, the same constructor with `{nodeOnly: true}`, and with `{bunOnly: true}`. The existing CLI adapter passes all five flags to `handleVersionSync` without mutual-exclusion validation (`VersionSync.command.ts:83–94`); multiple true flags, including all five, remain legitimate. Repeat these witnesses for every category and every check/write/dry-run mode. No Option, omission-as-false assumption beyond the existing defaults, or required-payload predicate contributes an inventory member.

# Target schema

Reuse `VersionCategory` and `VersionCategoryOptions`; do not create another all/selected/excluded vocabulary. Make the already exposed `selectedCategories` method the single derivation of the category collection. Filter `VersionCategoryOptions` by the corresponding existing option Boolean, using the existing category LiteralKit's exhaustive matcher. If that collection is empty, return `VersionCategoryOptions`; otherwise return the selected collection. `shouldCheck` becomes the single membership test `A.contains(selectedCategories(options), category)`.

This reverses the current helper dependency without recursion. The existing `S.Array(VersionCategory)` domain describes the collection; a new stored schema, wrapper class, decoded request shape, or persisted selection is unnecessary. Preserve the declaration-order result, multi-selection, defaults, and both service method signatures. The target taxonomy is `literalkit` because the existing five-value LiteralKit supplies the single authoritative category domain. The original three local situations are preserved observationally: unfiltered and explicitly selected both include the queried category; an unrelated explicit selection does not.

# Migration inventory

| Location | Required migration or preserved consumer |
| --- | --- |
| `CategorySelectionService.ts:38–55` | Replace the two Boolean locals and their OR expression with the collection derivation and membership projection; keep helpers private. |
| `CategorySelectionService.ts:22–36,63–69` | Keep service methods, Context identity and Layer wiring intact. |
| `internal/services/ResolverService.ts:55,59,75,89,103,119` | Preserve all five category checks, resolver order, failures and conditional network requests. No signature migration. |
| `internal/Handler.ts:13,22,28–80` | Preserve service provision and check/write/dry-run handling. |
| `VersionSync.command.ts:83–94`; `VersionSync.schemas.ts:406–496` | Preserve the CLI adapter, mode schemas and complete independent request fields. |
| `src/test/VersionSync.test-kit.ts`; CLI `package.json:66` | Existing command wildcard export permits source-subpath imports. The service's exported interface remains identical; no new test-only API is needed. |

Graft's incoming graph and exhaustive source searches across `packages` and `apps` found only ResolverService calling `shouldCheck`; `selectedCategories` has no external current source call. Layer construction in Handler remains a real dependency. Missing graph edges were not used as absence proof. Do not refactor sibling services or the exported service type as part of this Boolean change.

# Guard-deletion accounting

Remove two correlated Boolean locals, one five-way OR, and the final `!hasAny || hasExplicit` branch. Keep the category lookup necessary to interpret the five independent input flags, now in one collection derivation. Add one collection-empty/default decision and one membership test. There is no invalid-state validator or typed error to delete. Do not claim five deleted input guards: the five input observations remain semantically necessary. No custom schema guard or extra check wall is introduced.

# Encoded-side impact

Tier 1, derived/internal. Neither local flag is encoded. No JSON key, public request Boolean, mode, default, omission behavior, category string, report layout, network policy or operation ordering changes. Existing `VersionSyncOptions` schemas and the final report codec remain unchanged. The broader six-Boolean D1 mode owners remain independent and must not be replaced by an exclusive one-category selection.

# Test impact

At implementation time, exercise the existing service Layer over all 32 category subsets, five queried categories, three modes and both `skipNetwork` values. Assert `selectedCategories` preserves category order and defaults an empty subset to all categories, and `shouldCheck` agrees with membership. Explicit no-filter, other-filter, this-filter, multiple-filter and all-filter cases verify the supported tuples without mirroring the old OR implementation. Preserve current version-sync resolver tests and run required CLI package verification only during implementation. No test or package command ran for this provisional document.

# Risk

The main risks are accidentally making category flags exclusive, reversing the helper dependency without removing recursion, or evaluating a resolver for an unselected category. The collection is derived per invocation as today; no cache or new state lifetime is proposed. This draft changes no canonical record or current design and is not independent review or an implementation authorization.
