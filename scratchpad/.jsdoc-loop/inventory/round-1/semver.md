# Pack semver — round 1 inventory

Read-only review of `scratchpad/semver/` against `.patterns/jsdoc-documentation.md`.
Census: 10 modules, 34 owning exports, 5 barrel re-exports. Kit-port docs still
use retired `@example` / `@remarks`, import `@effected/semver` (docgen maps
`@beep/scratchpad/semver`), and omit `@category` / `@since 0.0.0`. Distinctive
caller trap: **no loose node-semver coercion** on versions, with a whitespace
split between parse and `isValid`.

---

### semver-R1-001: Comparator.ts module header and owning-export tags

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: semver/Comparator.ts:1, semver/Comparator.ts:14, semver/Comparator.ts:49
- `symbol`: InvalidComparatorError, Comparator
- `kind`: module
- `evidence`: Census confirmed. Module has no fileoverview (`missing-module-summary`, `missing-packageDocumentation`, `missing-module-since`). `InvalidComparatorError` (value/class) missing `@category`, `@since`, titled Example. `Comparator` (value/class) missing `@category`, `@since`; uses retired `@example` (lines 32–45). Both leads are useful and should be kept.
- `impact`: jsdoc-ratchet zero-legacy fails on `@example`; value exports are unpublished without category/since and a titled Example. Callers cannot tell this module from `Range` without a header.
- `suggestedFix`: Add a module block (lead that single-operator constraints live here and range sugar does not; `@packageDocumentation`; `@since 0.0.0`). Annotate `InvalidComparatorError` `@category errors` plus a titled Example that parses a bad comparator and reads `_tag`. Convert `Comparator`'s `@example` to `**Example** (Parse and test a comparator)` with an observable `test` result; `@category schemas`; `@since 0.0.0`. Import `@beep/scratchpad/semver`, never `@effected/semver` (see semver-R1-014).
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: semver
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: semver-R1-014, semver-R1-015
- `status`: open
- `fixedCommit`: pending

### semver-R1-002: Range.ts module header and owning-export tags

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: semver/Range.ts:1, semver/Range.ts:17, semver/Range.ts:35, semver/Range.ts:60, semver/Range.ts:382
- `symbol`: InvalidRangeError, ComparatorSet, Range, UnsatisfiableConstraintError
- `kind`: module
- `evidence`: Census confirmed. Module missing fileoverview / `@packageDocumentation` / `@since`. `InvalidRangeError` and `UnsatisfiableConstraintError` (value/class) missing `@category`, `@since`, titled Example. `ComparatorSet` (type) missing `@category`, `@since` (Example optional). `Range` missing `@category`, `@since`; retired `@example` (lines 43–56).
- `impact`: Same ratchet/docgen gate as 001. Error classes have no demonstration of construction or `_tag`. `ComparatorSet` is the AND-unit of a range and is uncategorized.
- `suggestedFix`: Module lead: range expressions as OR of AND comparator sets, with node-semver sugar desugared at parse. `@packageDocumentation` `@since 0.0.0`. Errors `@category errors` with Examples (`Range.parseResult("not a range")`; `Range.intersectResult` on disjoint ranges). `ComparatorSet` `@category type-level` `@since 0.0.0`. `Range` `@category schemas`; convert `@example` to `**Example** (Parse caret range and test)`. Keep existing leads.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: semver
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: semver-R1-014, semver-R1-015, semver-R1-016
- `status`: open
- `fixedCommit`: pending

### semver-R1-003: SemVer.ts module header and owning-export tags

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: semver/SemVer.ts:1, semver/SemVer.ts:27, semver/SemVer.ts:85, semver/SemVer.ts:587
- `symbol`: InvalidVersionError, SemVer, SemVerBump
- `kind`: module
- `evidence`: Census confirmed. Module missing fileoverview / `@packageDocumentation` / `@since`. `InvalidVersionError` missing `@category`, `@since`, titled Example. `SemVer` missing `@category`, `@since`; retired `@example` (lines 67–80). `SemVerBump` missing `@category`, `@since`, titled Example. Leads are useful (do not rewrite into signature echoes).
- `impact`: The public version type ships without category/since and with a forbidden example carrier. `SemVerBump` is a runtime class returned by `SemVer.bump` and currently has no Example of major/minor/prerelease bumps.
- `suggestedFix`: Module lead: strict SemVer 2.0.0 versions as `Schema.Class`, no loose coercion. Errors `@category errors` with Example `SemVer.parseResult("v1.2.3")` failing. `SemVer` `@category schemas`; convert `@example` to titled `**Example** (Parse, bump, compare)`. `SemVerBump` `@category constructors` (or `utilities`) with Example `SemVer.of(1, 0, 0).bump.minor()` and `.bump.prerelease("rc")`. `@since 0.0.0` on all. Fold Gotchas from 011–012 and 020 into the same blocks.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: semver
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: semver-R1-011, semver-R1-012, semver-R1-013, semver-R1-014, semver-R1-020
- `status`: open
- `fixedCommit`: pending

### semver-R1-004: VersionCache.ts module header and owning-export tags

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: semver/VersionCache.ts:1, semver/VersionCache.ts:13, semver/VersionCache.ts:25, semver/VersionCache.ts:41, semver/VersionCache.ts:65, semver/VersionCache.ts:143
- `symbol`: EmptyCacheError, VersionNotFoundError, UnsatisfiedRangeError, VersionCacheShape, VersionCache
- `kind`: module
- `evidence`: Census confirmed. Module missing fileoverview / `@packageDocumentation` / `@since`. Three error classes missing `@category`, `@since`, titled Example. `VersionCacheShape` (interface) missing `@category`, `@since`. `VersionCache` missing `@category`, `@since`; retired `@example` (lines 125–139). Shape lead already explains `next`/`prev` error vs `Option.none()` — keep it.
- `impact`: Service + three tagged errors are undocumented for docgen. Callers cannot distinguish empty-cache, missing pivot, and unsatisfied-range without Examples.
- `suggestedFix`: Module lead: in-memory sorted version cache over SemVer precedence. Errors `@category errors` with Examples constructing/raising each. `VersionCacheShape` `@category type-level`. `VersionCache` `@category services`; convert `@example` to titled Example providing `VersionCache.layer`. `@since 0.0.0`.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: semver
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: semver-R1-014, semver-R1-018
- `status`: open
- `fixedCommit`: pending

### semver-R1-005: VersionDiff.ts module header and owning-export tags

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: semver/VersionDiff.ts:1, semver/VersionDiff.ts:44
- `symbol`: VersionDiff
- `kind`: module
- `evidence`: Census confirmed. Module missing fileoverview / `@packageDocumentation` / `@since`. `VersionDiff` missing `@category`, `@since`; retired `@example` (lines 26–40). Lead is useful (classification order).
- `impact`: Sole export of the file is unpublished for the ratchet and still uses `@example`.
- `suggestedFix`: Module lead + `@packageDocumentation` `@since 0.0.0`. `VersionDiff` `@category schemas` (TaggedClass); convert `@example` to `**Example** (Classify a major bump)`. Keep signed-delta fields in the Example (`type`, `major`).
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: semver
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: semver-R1-014, semver-R1-019
- `status`: open
- `fixedCommit`: pending

### semver-R1-006: index.ts barrel header missing `@since` and titled Example

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: semver/index.ts:1
- `symbol`: (package entry)
- `kind`: module
- `evidence`: Census skipped module findings because `owningExportCount === 0`, but the fileoverview is the package entry: useful lead and `@packageDocumentation` are present; `@since 0.0.0` is absent; retired `@example` (lines 10–24); two undescribed `@see` lines (26–27). The first re-export inherited this block (see Rejected).
- `impact`: Entry-point docs will fail zero-legacy and `enforceVersion`. The barrel is the first hover readers see.
- `suggestedFix`: Keep the lead. Convert `@example` to `**Example** (Parse, bump, and test a range)` using `@beep/scratchpad/semver`. Add `@since 0.0.0` after `@packageDocumentation`. Describe or drop `@see` (semver-R1-013). Do not attach new docs to the `export { ... }` lines.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: semver
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: semver-R1-013, semver-R1-014
- `status`: open
- `fixedCommit`: pending

### semver-R1-007: desugar.ts module header and owning-export tags

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: semver/internal/desugar.ts:1, semver/internal/desugar.ts:13, semver/internal/desugar.ts:36, semver/internal/desugar.ts:57, semver/internal/desugar.ts:102, semver/internal/desugar.ts:169
- `symbol`: PartialParts, desugarTilde, desugarCaret, desugarXRange, desugarHyphen
- `kind`: module
- `evidence`: Census confirmed. Module missing fileoverview / `@packageDocumentation` / `@since` (`//` comments at top are not JSDoc). `PartialParts` (interface) missing `@category`, `@since`. Four value consts missing `@category`, `@since`, titled Example. Leads already state npm/node-semver expansion rules — keep them.
- `impact`: Internal pipeline exports are still in the census and docgen corpus (`enforceExamples: true`). Callers (and Range authors) cannot see tilde vs caret vs X-range vs hyphen expansions.
- `suggestedFix`: Module lead from the existing `//` file comment (desugar sugar into primitive comparator sets). `@packageDocumentation` `@since 0.0.0`. `PartialParts` `@category type-level`. Functions `@category normalization` (or `parsing`) with one titled Example each showing input `PartialParts` and printed comparators (`~1.2.3` → `>=1.2.3 <1.3.0-0`).
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: semver
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: semver-R1-022
- `status`: open
- `fixedCommit`: pending

### semver-R1-008: grammar.ts module header and owning-export tags

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: semver/internal/grammar.ts:1, semver/internal/grammar.ts:20, semver/internal/grammar.ts:240, semver/internal/grammar.ts:444, semver/internal/grammar.ts:539, semver/internal/grammar.ts:562, semver/internal/grammar.ts:574, semver/internal/grammar.ts:580
- `symbol`: ParseResult, parseVersion, parseRange, parseComparator, formatVersion, formatComparator, formatRange
- `kind`: module
- `evidence`: Census confirmed. Module missing fileoverview / `@packageDocumentation` / `@since` (strict-grammar rules live only in `//` comments, lines 12–13). `ParseResult` (type) missing `@category`, `@since`. Six value consts missing `@category`, `@since`, titled Example. `parseVersion` lead restates the name and omits the no-coercion rules in the file comment.
- `impact`: The only parser entry points have no Examples of success vs `ok: false`. Formatters are the encode side of `FromString` and have no demonstration that `=` is implicit.
- `suggestedFix`: Promote the file comment into a JSDoc module lead (strict recursive-descent; rejects `v`/`V`, `=`, leading zeros, unsafe integers; must fully consume). `@packageDocumentation` `@since 0.0.0`. `ParseResult` `@category type-level`. Parsers `@category parsing`; formatters `@category formatting`. Each value gets one titled observable Example. Expand `parseVersion` lead with the rejection list (semver-R1-011).
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: semver
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: semver-R1-011, semver-R1-021
- `status`: open
- `fixedCommit`: pending

### semver-R1-009: normalize.ts module header and owning-export tags

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: semver/internal/normalize.ts:1, semver/internal/normalize.ts:50
- `symbol`: normalizeSets
- `kind`: module
- `evidence`: Census confirmed. Module missing fileoverview / `@packageDocumentation` / `@since`. `normalizeSets` missing `@category`, `@since`, titled Example. Lead is one sentence and omits the build-metadata dedup in the `//` comment (lines 1–3, 37–39).
- `impact`: Range parse always runs this; without an Example, callers cannot see sort order or that `>=1.0.0+build` collapses with `>=1.0.0`.
- `suggestedFix`: Module lead from the file comment. `@packageDocumentation` `@since 0.0.0`. `normalizeSets` `@category normalization` with Example of two comparators that differ only in build collapsing, plus operator-weight sort. `@since 0.0.0`.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: semver
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: semver-R1-023
- `status`: open
- `fixedCommit`: pending

### semver-R1-010: order.ts module header (census missed summary) and owning-export tags

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: semver/internal/order.ts:1, semver/internal/order.ts:10, semver/internal/order.ts:19, semver/internal/order.ts:22, semver/internal/order.ts:32, semver/internal/order.ts:43, semver/internal/order.ts:70
- `symbol`: VersionParts, ComparatorOperator, ComparatorParts, comparePrereleaseIdentifier, compareParts, compareBuild
- `kind`: module
- `evidence`: Census reported `missing-packageDocumentation` and `missing-module-since` only. `hasLead: true` is a false module lead: `fileOverview()` picked up `VersionParts`' JSDoc because this file has no import before the first `/**`. There is no real module header — confirm extra `missing-module-summary`. Types missing `@category`, `@since`. Three compare functions missing `@category`, `@since`, titled Example. Value leads are useful (keep).
- `impact`: Precedence lives once here; without Examples, numeric-vs-alphanumeric prerelease and extra-spec build order stay buried. A later census will still flag the module until a true fileoverview exists *above* `VersionParts`.
- `suggestedFix`: Insert a real module JSDoc before `VersionParts` (SemVer §11 primitives over structural parts, import-cycle-free). `@packageDocumentation` `@since 0.0.0`. Types `@category type-level`. Functions `@category combinators` with Examples: `1` vs `"alpha"`; `1.0.0-alpha` vs `1.0.0`; `["a"]` vs `[]` for `compareBuild`.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: semver
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: semver-R1-024
- `status`: open
- `fixedCommit`: pending

### semver-R1-011: No loose node-semver coercion (versions)

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: semver/SemVer.ts:22, semver/SemVer.ts:85, semver/SemVer.ts:177, semver/internal/grammar.ts:12, semver/internal/grammar.ts:195, semver/internal/grammar.ts:239
- `symbol`: InvalidVersionError, SemVer, parseVersion
- `kind`: value
- `evidence`: Implementation already warns, but it is not a class-level **Gotchas** and the class Example is happy-path only. `InvalidVersionError` lead: "Unlike node-semver, no loose parsing or `v`-prefix coercion is performed." `parseVersionCore` rejects `v`/`V`/`=` at position 0; numeric identifiers reject leading zeros and unsafe integers; input must be fully consumed. `SemVer.parseResult` restates the rejection list on the method, not the class. `parseVersion`'s JSDoc is "Parse a strict SemVer 2.0.0 version string." Range sugar (`^`, `~`, `x`, hyphen, `||`) is *not* accepted here — that is `Range`.
- `impact`: Callers coming from `semver.coerce` / `semver.parse("v1.2.3", { loose: true })` will treat `InvalidVersionError` as a defect. `1`, `1.2`, `=1.2.3`, `v1.2.3`, `01.2.3` all fail. The kit-port Example never shows a rejection.
- `suggestedFix`: Add **Gotchas** on `InvalidVersionError`, `SemVer`, and `parseVersion`: no `v`/`V`, no `=` prefix, no leading zeros, no partial versions, no dist-tags, no `coerce`. Titled Example must include `parseResult("v1.2.3")` / `"1.2"` / `"=1.0.0"` as failures. `@see {@link Range}` for node-semver range sugar. Do not imply parse is as strict about whitespace — that is semver-R1-012.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: semver
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: semver-R1-003, semver-R1-008
- `status`: open
- `fixedCommit`: pending

### semver-R1-012: Parse trims whitespace; `isValid` / Exact / Pinnable reject it

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: semver/SemVer.ts:128, semver/SemVer.ts:180, semver/SemVer.ts:238, semver/SemVer.ts:261, semver/internal/grammar.ts:241, semver/internal/grammar.ts:445, semver/internal/grammar.ts:540
- `symbol`: SemVer, parseVersion, parseRange, parseComparator
- `kind`: value
- `evidence`: Missing Gotcha that method `@remarks` already spell out (retired carrier). `parseVersion` / `parseRange` / `parseComparator` all `raw.trim()` (node-semver constructor posture), so `" 1.2.3"` parses. `SemVer.isValid` / `isPinnable` / `ExactVersionString` / `PinnableVersionString` require `input === input.trim()` and refuse padded input. That split is the opposite of "parse and validate agree."
- `impact`: A manifest field using `ExactVersionString` rejects the same string `SemVer.parse` accepts. Callers who "validate then parse" will see false `isValid` after a successful parse of padded input.
- `suggestedFix`: Move the `@remarks` on `parseResult`, `isValid`, `isPinnable`, `ExactVersionString`, and `PinnableVersionString` into **Gotchas**. Mirror a short Gotcha on the `SemVer` class and on `parseVersion`. Example: `SemVer.parseResult(" 1.2.3")` succeeds; `SemVer.isValid(" 1.2.3")` is `false`. `@see` between `parse` / `parseResult` and `isValid` / `ExactVersionString`.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: semver
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: semver-R1-015, semver-R1-017
- `status`: open
- `fixedCommit`: pending

### semver-R1-013: Undescribed `@see` on SemVer, InvalidVersionError, and the barrel

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: semver/SemVer.ts:24, semver/SemVer.ts:82, semver/index.ts:26, semver/index.ts:27
- `symbol`: InvalidVersionError, SemVer
- `kind`: value
- `evidence`: Census `undescribed-see`: `@see {@link https://semver.org | SemVer 2.0.0 Specification}` (link text is not a purpose phrase). Barrel also has `@see {@link https://effect.website | Effect}` with no purpose. Described-links law: every `@see` needs a phrase after the link.
- `impact`: Ratchet/census flags these; readers get a URL with no "why look here."
- `suggestedFix`: `@see {@link https://semver.org} for the SemVer 2.0.0 grammar this parser implements strictly (no loose coercion).` Drop the Effect website `@see` or describe a real purpose (this package's Effect schema/service shape). Do not leave bare `{@link}` lines.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: semver
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: semver-R1-003, semver-R1-006
- `status`: open
- `fixedCommit`: pending

### semver-R1-014: Kit-port Examples import `@effected/semver` (docgen will not resolve)

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: semver/index.ts:12, semver/Comparator.ts:34, semver/Range.ts:45, semver/SemVer.ts:69, semver/VersionCache.ts:127, semver/VersionDiff.ts:28
- `symbol`: Comparator, Range, SemVer, VersionCache, VersionDiff
- `kind`: value
- `evidence`: Every class-level (and barrel) `@example` does `import { ... } from "@effected/semver"`. Scratchpad `docgen.json` paths expose `@beep/scratchpad/semver` only. REVIEW-BRIEF lists `@effected/*` example imports as defects. Existing fences are otherwise observable (`Effect.runSync` + `// =>`); do not replace with `void x`.
- `impact`: Converting `@example` without rewriting imports leaves examples failing the docgen TypeScript gate. Named `Effect` / `Result` imports from `effect` are legal; keep those.
- `suggestedFix`: When converting each `@example` to `**Example** (Title)`, import from `@beep/scratchpad/semver`. Keep the current observable assertions. Same rewrite for member examples on `parseResult` / `intersectResult` (semver-R1-015).
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: semver
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: semver-R1-001, semver-R1-002, semver-R1-003, semver-R1-004, semver-R1-005, semver-R1-006
- `status`: open
- `fixedCommit`: pending

### semver-R1-015: Member `@remarks` / `@example` must move on file touch

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P2-medium
- `doctrineBucket`: cleanup-on-touch
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: semver/Comparator.ts:87, semver/Range.ts:97, semver/Range.ts:148, semver/SemVer.ts:128
- `symbol`: Comparator.parseResult, Range.parseResult, Range.satisfies, SemVer.parseResult
- `kind`: value
- `evidence`: Census only inspects owning declarations, so these did not appear as `legacy-remarks` / `legacy-example`. Members still carry retired carriers: `Comparator.parseResult` `@remarks`+`@example`; `Range.parseResult` `@remarks`+`@example`; `Range.satisfies` / `filter` / `maxSatisfying` / `minSatisfying` / `intersectResult` / `isSubset` / `test` `@remarks` (`intersectResult` also `@example`); `SemVer.ExactVersionString`, `PinnableVersionString`, `parseResult`, `isValid`, `isPinnable` `@remarks` (`parseResult` also `@example`). Touched-file law: a touched file returns fully rubric-compliant.
- `impact`: Fixing only class blocks leaves `@example`/`@remarks` in the same files; zero-legacy scans whole files under `{packages,apps}/**/src` and scratchpad docgen will still parse these tags.
- `suggestedFix`: On each file touch, move `@remarks` into **Details** / **Gotchas** (content is already the dual-order, whitespace, prerelease, subset, and parse-vs-Effect guidance). Convert member `@example` to titled `**Example**` only where the member is the right teaching site; otherwise keep a single class-level Example and drop redundant member fences. No empty When-to-use padding.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: semver
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: semver-R1-012, semver-R1-016
- `status`: open
- `fixedCommit`: pending

### semver-R1-016: Range matching and algebra Gotchas trapped in `@remarks`

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: semver/Range.ts:60, semver/Range.ts:148, semver/Range.ts:300, semver/Range.ts:348, semver/internal/grammar.ts:441
- `symbol`: Range
- `kind`: value
- `evidence`: Implementation comments / member `@remarks` already warn, but the class block has no **Gotchas**. (1) Dual data-first order is `(version, range)` / `(versions, range)` — `Range.satisfies(range, version)` at an untyped probe throws `TypeError: range.test is not a function`. (2) Prerelease tuple restriction: `^1.2.3` does not match `1.2.4-alpha` unless a comparator in the matching set carries a prerelease on the same `major.minor.patch`. (3) `isSubset` is conservative; `>=1.0.0 <3.0.0` vs `>=1.0.0 <2.0.0 || >=2.0.0 <3.0.0` returns `false`. (4) `parseRange("")` is match-all; `SemVer.parse("")` fails.
- `impact`: Untyped callers mis-order dual statics and blame this package. Dependabot-style range tests silently exclude prereleases. Simplifiers using `isSubset` drop legal unions. Empty string as a range is a footgun next to strict versions.
- `suggestedFix`: Add class-level **Gotchas** covering dual order, prerelease restriction, conservative `isSubset`, and empty-string match-all. Keep the existing `^1.0.0` Example; do not add extra Examples if that one stays observable. `@see {@link Range.satisfies}` / `{@link Range.isSubset}` / `{@link SemVer.parse}` with purpose phrases.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: semver
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: semver-R1-002, semver-R1-015
- `status`: open
- `fixedCommit`: pending

### semver-R1-017: Missing described `@see` between caller-choice siblings

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: suggestion
- `blockingStatus`: blocking
- `severity`: P2-medium
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: semver/Comparator.ts:26, semver/Range.ts:37, semver/SemVer.ts:58, semver/SemVer.ts:104, semver/internal/grammar.ts:239
- `symbol`: Comparator, Range, SemVer, parseVersion, parseRange, parseComparator
- `kind`: value
- `evidence`: Inline `{@link}` exists in some leads, but there are no described `@see` lines for alternatives a caller must choose. Comparator lead says wildcards belong to Range, with no `@see {@link Range}`. SemVer has `parse` / `parseResult` / `FromString` / `isValid` / `ExactVersionString` / `PinnableVersionString` / `Order` / `OrderWithBuild` without choice links. `FromString` decode reports `SchemaIssue.InvalidValue`, not `InvalidVersionError` (stated in the error lead, not linked from `FromString`). Grammar exports three parse entry points with no cross `@see`. Equality, `Hash`, and `Order` ignore build metadata (comment at SemVer.ts:540–542); `OrderWithBuild` does not.
- `impact`: Callers pick the wrong parse surface (range sugar on `Comparator`, padded strings on `isValid`, `FromString` error type vs tagged error, `Order` vs `OrderWithBuild` for unique strings).
- `suggestedFix`: Add purpose-phrase `@see` only for real choices: Comparator ↔ Range; `SemVer.parse` ↔ `parseResult` ↔ `FromString` ↔ `isValid` ↔ `ExactVersionString` ↔ `PinnableVersionString`; `Order` ↔ `OrderWithBuild`; tagged parse errors ↔ `FromString`; `parseVersion` ↔ `parseRange` ↔ `parseComparator`. Add a SemVer **Gotchas** bullet that `equal` / `Hash` / `Order` ignore build (§10). Skip formulaic links.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: semver
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: semver-R1-001, semver-R1-002, semver-R1-003, semver-R1-008
- `status`: open
- `fixedCommit`: pending

### semver-R1-018: VersionCache membership and navigation Gotchas

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: semver/VersionCache.ts:96, semver/VersionCache.ts:119, semver/VersionCache.ts:65
- `symbol`: VersionCache, VersionCacheShape
- `kind`: value
- `evidence`: Comment at lines 96–98 is not JSDoc: membership and ordering follow SemVer precedence (build ignored), so versions that differ only in build occupy one slot. Shape lead already documents `next`/`prev` (`VersionNotFoundError` vs `Option.none()` at the boundary) and empty vs unsatisfied vs not-found — that prose is good but not on the class, and the three error classes do not `@see` each other.
- `impact`: Loading `1.0.0+build.1` then `1.0.0+build.2` silently no-ops on `add`. Navigation failures are easy to handle as the wrong channel.
- `suggestedFix`: Class **Gotchas**: build-metadata twins are one slot; `next`/`prev` use `Option.none()` only when the pivot exists at an edge. Described `@see` among `EmptyCacheError`, `VersionNotFoundError`, `UnsatisfiedRangeError`, and `Range.maxSatisfying` (Option vs typed failure). Keep one Example; do not add a second just for navigation.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: semver
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: semver-R1-004
- `status`: open
- `fixedCommit`: pending

### semver-R1-019: VersionDiff `"build"` vs SemVer equality

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P2-medium
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: semver/VersionDiff.ts:16, semver/VersionDiff.ts:7
- `symbol`: VersionDiff
- `kind`: value
- `evidence`: `classifyDiff` returns `"build"` when only build identifiers differ. `SemVer.equal` / `compare` / `Order` treat those as equal (§10). Class lead lists the `type` enum but does not warn that `VersionDiff.between(a, b).type === "build"` can coexist with `a.equal(b)`.
- `impact`: Changelog UI using `equal` to skip "no change" will drop build-only diffs; the reverse hides spec-equal versions as a change.
- `suggestedFix`: **Gotchas** on `VersionDiff`: build-only diffs are classified even though precedence equality ignores build. `@see {@link SemVer.OrderWithBuild}` for a total order that agrees with this classification, and `{@link SemVer.equal}` for spec equality.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: semver
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: semver-R1-005
- `status`: open
- `fixedCommit`: pending

### semver-R1-020: SemVerBump prerelease starts at next patch; build never survives

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: semver/SemVer.ts:580, semver/SemVer.ts:614
- `symbol`: SemVerBump
- `kind`: value
- `evidence`: Class lead says every operation returns a new `SemVer` and "build metadata never survives a bump" — good, but there is no Example. `prerelease` JSDoc states node-semver compatibility: stable `1.0.0` → `1.0.1-0` (not `1.0.0-0`); switching identifier resets the counter; trailing numeric identifier increments. That is easy to get wrong and is not on the class Gotchas or Example.
- `impact`: Callers expecting `1.0.0` + prerelease bump to stay on `1.0.0-rc.0` will ship the wrong version. Build metadata disappearing after `bump.patch()` looks like data loss.
- `suggestedFix`: **Gotchas** on `SemVerBump` with the next-patch rule and build stripping. Titled Example: `SemVer.of(1, 0, 0).bump.prerelease("rc")` → `1.0.1-rc.0`; `SemVer.of(1, 0, 0, [], ["build"]).bump.patch()` has empty `build`. `@see {@link SemVer.bump}`.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: semver
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: semver-R1-003
- `status`: open
- `fixedCommit`: pending

### semver-R1-021: grammar.ts Gotchas (trim, empty range, `~>`, no version coerce)

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: semver/internal/grammar.ts:12, semver/internal/grammar.ts:239, semver/internal/grammar.ts:363, semver/internal/grammar.ts:441, semver/internal/grammar.ts:535, semver/internal/grammar.ts:573
- `symbol`: parseVersion, parseRange, parseComparator, formatComparator
- `kind`: value
- `evidence`: File comment (rejects `v`/`V`, `=`, leading zeros, unsafe integers, partial consume) is not on the exports. `parseSimple` rejects Ruby `~>`. Empty range string is match-all (`desugarXRange` of `*`). `parseComparator` forbids wildcards and sugar (missing operator means `=`). `formatComparator` omits `=`. All three parse entry points trim. `ParseFailure` must not escape (already a private class).
- `impact`: `parseRange("~>")` and `parseVersion("v1.0.0")` fail for different reasons than node-semver. `parseRange("")` succeeding is invisible from the current one-line lead. Printers round-trip `=1.2.3` as `1.2.3`.
- `suggestedFix`: **Gotchas** per entry point (reuse 011/012; add empty-range, `~>`, comparator-no-sugar, implicit `=`). Described `@see` among the three parsers and the matching `format*` / concept-module `FromString`. Examples must show one failure and one success, including `formatComparator` dropping `=`.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: semver
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: semver-R1-008, semver-R1-011
- `status`: open
- `fixedCommit`: pending

### semver-R1-022: desugar caret / X-range / hyphen surprises plus sibling `@see`

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: semver/internal/desugar.ts:31, semver/internal/desugar.ts:51, semver/internal/desugar.ts:95, semver/internal/desugar.ts:163
- `symbol`: desugarTilde, desugarCaret, desugarXRange, desugarHyphen
- `kind`: value
- `evidence`: Leads mention npm rules, but there is no **Gotchas** or `@see` among the four. Code comments: `^0.2.3` allows patch only; `^0.0.3` allows none; `>1.x` → `>=2.0.0`; `<=1.2.x` → `<1.3.0-0`; `*` and `>*` both → `>=0.0.0`; hyphen `1.2.3 - 2.3` → `>=1.2.3 <2.4.0-0`; full upper uses `<=`. Tilde with no minor (`~1`) allows minor-level changes.
- `impact`: Callers who think `^` always means "compatible major" mis-handle 0.x. Operator + wildcard rewrites (`>1.x`) do not preserve the operator. The four functions are easy to call instead of each other.
- `suggestedFix`: **Gotchas** on caret (rightmost non-zero 0.x rule), X-range operator rewrites including `*`/`>*`, hyphen partial upper. One Example per function already required by 007 should use those surprising inputs. Described `@see` among the four and `{@link parseRange}`.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: semver
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: semver-R1-007
- `status`: open
- `fixedCommit`: pending

### semver-R1-023: normalizeSets drops build-only duplicate constraints

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P2-medium
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: semver/internal/normalize.ts:37, semver/internal/normalize.ts:49
- `symbol`: normalizeSets
- `kind`: value
- `evidence`: Comment at 37–39: comparators that differ only in build metadata are duplicate constraints (SemVer §10) and collapse. `normalizeSets` lead does not say this, nor that each set is sorted independently by operator weight then version precedence.
- `impact`: Range encode/decode can drop `+build` from a comparator and reorder sets; looks like a printer bug if undocumented.
- `suggestedFix`: **Details**/**Gotchas** on independent per-set sort + build-ignored keys. Example in 009 should make the collapse observable. `@see {@link compareParts}` for the sort key.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: semver
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: semver-R1-009
- `status`: open
- `fixedCommit`: pending

### semver-R1-024: compareBuild is extra-spec; compareParts ignores build

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P2-medium
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: semver/internal/order.ts:39, semver/internal/order.ts:64, semver/SemVer.ts:309
- `symbol`: compareParts, compareBuild, comparePrereleaseIdentifier
- `kind`: value
- `evidence`: `compareParts` lead already says build is ignored (§10). `compareBuild` lead already says it is a total-order tiebreaker outside the spec, used only by `SemVer.OrderWithBuild`. Missing described `@see` to those `Order` instances, and no Example of `1.0.0+a` vs `1.0.0+b` (compareParts `0`, compareBuild non-zero). `comparePrereleaseIdentifier` numeric-always-less-than-alphanumeric is in the lead but not shown.
- `impact`: Using `compareBuild` for spec precedence (or skipping it when sorting unique strings) produces the wrong order. Ties back to VersionDiff (019) and VersionCache (018).
- `suggestedFix`: Described `@see {@link SemVer.Order}` on `compareParts` and `{@link SemVer.OrderWithBuild}` on `compareBuild`. Examples as in 010. Do not add empty When-to-use sections.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: semver
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: semver-R1-010, semver-R1-017
- `status`: open
- `fixedCommit`: pending

---

## Rejected false positives / not opened

- `semver/index.ts:32` re-export `Comparator, InvalidComparatorError` — census `legacy-carrier` is the barrel fileoverview leaking onto the first `export { }` (TypeScript attaches it). Not an owning symbol. Do not document re-exports. Fix the module block (semver-R1-006) instead.
- Four other barrel re-exports (`Range.ts`, `SemVer.ts`, `VersionCache.ts`, `VersionDiff.ts` names) — graph edges, not documentation subjects.
- Type-level exports (`ComparatorSet`, `VersionCacheShape`, `PartialParts`, `ParseResult`, `VersionParts`, `ComparatorOperator`, `ComparatorParts`) — census correctly did not require `@example`; only `@category` / `@since` / prose.
- `$I.annote` / `$I.annoteSchema` on `Schema.Class` / `TaggedError` / `TaggedClass` — not opened. This kit-port has no beep identity composer; adding `$I.annote` is a runtime schema change, not a JSDoc-only fix. Class schemas already double as decoded types (no missing same-name alias).
- Extra Examples on classes that already have an observable fence — rejected. Convert the existing fence; do not pile on more once it is titled and compilable.
- Taste-only lead rewrites — rejected. Public leads are already purpose-shaped except `parseVersion` (handled in 008/011).

---

## Pack verdict

- files reviewed: 10
- owning exports reviewed: 34
- confirmed mechanical items: 10
- editorial items: 14
- rejected false positives: 1
- accepted findings: 24

Every exporting module and every owning export was reviewed. All 34 owning exports are open (missing `@category` / `@since`, and value exports missing a titled Example or still on `@example`). Distinctive kit-port work for the fixer: no loose node-semver coercion on versions; parse trims while `isValid` does not; dual `Range.satisfies` argument order; Examples must import `@beep/scratchpad/semver`.
