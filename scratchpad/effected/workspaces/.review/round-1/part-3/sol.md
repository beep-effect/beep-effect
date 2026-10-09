### sol-1-1
- file: scratchpad/effected/workspaces/WorkspaceCatalogs.ts:233
- class: bug   severity: required
- standard: D11; D9 and section 14 (`upstream-bug`); `CatalogSet.resolveSpecifier` documents total lookup with `Option.none()` for an unmatched dependency, and `WorkspaceCatalogs.catalogResolver` documents the same miss convention.   evidence: Read-only probes against commit `3fa5876691901fccf3d1cd29e9324564df134b56` and the pinned oracle both reproduce: `CatalogSet.make({ entries: { default: {} } }).rangeOf("constructor", O.none())` returns `Some` whose payload is a function; `.resolveSpecifier("constructor", "catalog:")` throws `TypeError: bareSpecifier.startsWith is not a function`. A snapshot with that empty default catalog and a seed declaring `constructor: "^1"` also resolves to `Some(function)`.
- failure: Catalog lookups read inherited properties as declared dependencies. `rangeOf` violates its `Option<string>` contract and suppresses valid seed or importer fallback; `resolveSpecifier` passes the inherited function into pnpm’s resolver and throws despite its totality contract.
- fix: Require own-property membership at both the catalog-name and dependency-name levels. Apply those checks in `rangeOf` and before `resolveSpecifier` delegates to pnpm. Add negative controls for inherited names and a positive control for an explicitly declared `"constructor"` dependency; record the verified upstream-bug deviation under section 14.

### sol-1-2
- file: scratchpad/effected/workspaces/WorkspaceStateSnapshot.ts:316
- class: bug   severity: required
- standard: D11; D9 and section 14 (`upstream-bug`); `WorkspaceStateSnapshot.resolveIn` explicitly promises `Option.none()` for an unknown importer or one recording nothing for the dependency.   evidence: Read-only probes against the exact review commit and pinned oracle, using `WorkspaceStateSnapshot.make({ packages: [], catalogs: CatalogSet.empty(), importerVersions: { ".": {} } })`, return `Some(function)` from `resolveIn(".", "constructor", "catalog:")` and `Some("Object")` from `resolveIn("constructor", "name", "catalog:")`.
- failure: The importer fallback traverses prototypes at both lookup levels. An absent dependency can produce a non-string payload, and an absent importer can fabricate a string version from the inherited `Object` constructor’s `name`. This can produce false resolution or diff results even after the catalog lookup in sol-1-1 is fixed.
- fix: Use own-property lookups for `importerPath` and `dependency`, returning `None` when either key is absent. Add regression cases for inherited importer and dependency names, and record the verified upstream-bug deviation under section 14.

### sol-1-3
- file: scratchpad/effected/workspaces/WorkspacePackage.ts:330
- class: bug   severity: required
- standard: D11; D9 and section 14 (`upstream-bug`); `WorkspacePackage.dependencyDiff` promises additions, removals and changed specifiers across its schema-accepted dependency records.   evidence: With a dependency record parsed from `{"__proto__":"^1"}`, the exact-commit probe shows `allDependencies` retains the own key, but adding or removing it produces `{"added":{},"removed":{},"changed":{}}`. Changing it to `"^2"` produces the same empty serialized diff while `Object.getPrototypeOf(diff.changed)` becomes `{"from":"^1","to":"^2"}`. The pinned oracle reproduces the omission.
- failure: Assignments into the three plain result objects invoke the inherited `__proto__` setter. Additions and removals disappear, and a changed dependency modifies the result object’s prototype instead of creating a diff entry. The diff loses information that the input schema and merged dependency record preserve.
- fix: Construct result entries with an own-key-safe operation, such as `R.set` or `R.fromEntries`, for all three branches. Preserve ordinary result-object behavior. Add addition, removal and change regression cases for `"__proto__"` and record the verified upstream-bug deviation under section 14.

### sol-1-4
- file: scratchpad/effected/workspaces/WorkspaceRoot.ts:143
- class: bug   severity: required
- standard: D11; D9 and section 14 (`upstream-bug`); the `isWorkspaceRoot` contract at lines 117–118 says a malformed root manifest is treated as “not a root” and ascent continues; `standards/effect-first-development.md`, “Operating Model,” requires explicit handling of external input failures.   evidence: A read-only virtual filesystem containing `/repo/a/package.json = "null"` and `/repo/package.json = {"workspaces":["packages/*"]}` causes `find("/repo/a", { stopAt: "/repo" })` to exit with a `WorkspaceRootManifestError` defect at the exact review commit. The pinned oracle exits with a `TypeError` on the same fixture instead of finding `/repo`.
- failure: A non-object manifest at a nearer ancestor aborts discovery and hides a valid workspace root above it. The explicit preservation of the null-property-access defect retains a verified upstream bug in malformed-input handling.
- fix: Remove the null-specific throw and let the following object guard return `false` for `null`. Add a regression asserting ascent reaches the valid ancestor, and record the verified upstream-bug deviation under section 14.

### sol-1-5
- file: scratchpad/effected/workspaces/WorkspaceCatalogs.ts:83
- class: jsdoc   severity: backlog
- standard: `.patterns/jsdoc-documentation.md`, “Hard requirements,” “Carrier policy,” and “Kind-split Example law”; the reviewer brief defers S2.   evidence: `CatalogSet` has a legacy `@remarks` block, no Example, and no `@category` or `@since`. The seven focus files retain legacy `@remarks`/`@example` carriers and public declarations lacking the required category and since tags; several exported schema/error classes also lack Examples.
- failure: The public documentation does not satisfy the canonical JSDoc contract. These are visible documentation deficiencies; docgen was not run during this review.
- fix: During S2, convert the retained prose to `**Details**` and titled `**Example** (Title)` sections, add meaningful Examples for value-level exports, and add canonical categories plus `@since 0.0.0`. Preserve the upstream documentation bodies.

### sol-1-6
- file: scratchpad/test/workspaces/WorkspaceCatalogs.test.ts:35
- class: test   severity: backlog
- standard: `.patterns/testing-patterns.md`, “Never use Effect.runSync in tests”; the reviewer brief defers S3 test-canon work.   evidence: The catalog normalization test uses ordinary `it` and manually executes `Effect.gen` with `Effect.runSync`; the neighboring named-catalog and lookup tests repeat that pattern. `WorkspaceRoot.test.ts:211` also manually runs an Effect to construct its test double.
- failure: Effectful tests bypass the canonical Effect tester and its managed test environment.
- fix: During S3, migrate Effect-returning cases to `it.effect`; use the canonical layer tester for shared effectful construction where applicable. Keep the existing behavioral assertions.

### sol-1-7
- file: scratchpad/test/workspaces/WorkspaceSnapshots.test.ts:377
- class: test   severity: backlog
- standard: `goals/effect-vitest-canon/SPEC.md`, D5; `.patterns/testing-patterns.md`, “Choose assertions by value, not by tester”; the reviewer brief defers S3.   evidence: Inside `it.effect`, this test compares an `Option` with `assert.deepStrictEqual` and uses `assert.isTrue(O.isNone(...))` for the miss. Similar container assertions occur in the discovery and catalog Effect tests.
- failure: Option assertions do not use the required variant-and-payload helpers, so these tests remain outside the agreed test canon.
- fix: During S3, replace these assertions with `assertSome(result, expectedValue)` and `assertNone(result)` from `@effect/vitest/utils`. Keep plain-value assertions as they are.

### sol-1-8
- file: scratchpad/test/workspaces/WorkspacePackage.test.ts:25
- class: test   severity: backlog
- standard: D10 and section 11.4, “S3: property floor”; the reviewer brief defers S3.   evidence: An exact-commit search over `scratchpad/test/workspaces/**` for `Arbitrary`, `fcRuns`, `it.effect.prop`, and `it.prop` finds no occurrences. The exported schemas in the focus files—including `PublishConfig`, `WorkspacePackage`, `CatalogSet`, `LayerEdge`, `LayeringReport`, `PackageStateSnapshot`, and `WorkspaceStateSnapshot`—have example-based tests but no required generated round-trip properties.
- failure: The module has not met the schema/codec property floor. Existing examples do not establish encode/decode behavior across the generated schema domain.
- fix: During S3, add generated round-trip properties for the exported schemas/codecs using Effect Arbitrary, the canonical property tester, and `fcRuns(n)`. Retain the upstream example suites and add the required parser/formatter properties where applicable.

REQUIRED: 4
BACKLOG: 4