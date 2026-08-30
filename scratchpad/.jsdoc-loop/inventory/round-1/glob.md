# Pack `glob` — Round 1 JSDoc inventory

Kit-port of minimatch / brace-expansion / balanced-match behind an Effect-schema
facade. Census: 13 modules, 34 owning exports, 5 re-exports. Every public and
internal owning symbol is below. No titled `**Example**` exists in the pack.
File-level `//` port notes are not JSDoc. Facade leads are often useful; they
still lack `@category`, `@since 0.0.0`, Examples, `$I.annote`, and `**Gotchas**`
for hostile input, globstar false-negatives, and the two bang semantics.

## Mechanical findings

### glob-R1-001: `GlobPattern.ts` module header and three schema classes lack tags and Examples

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: glob/GlobPattern.ts:1, glob/GlobPattern.ts:24, glob/GlobPattern.ts:50, glob/GlobPattern.ts:144
- `symbol`: GlobPatternError, GlobPatternOptions, GlobPattern
- `kind`: module | value
- `evidence`: Census `missing-module-summary|missing-packageDocumentation|missing-module-since` (confirmed: only `//` comments at file top). Owning `GlobPatternError` / `GlobPatternOptions` / `GlobPattern` each have a useful lead and `@public` but missing `@category`, `@since`, titled Example (`missing-required-tags`).
- `impact`: Public facade is the package's documented surface; docgen `enforceExamples`/`enforceVersion` fail, and hovers omit role/version. Classes are value-level (schema-backed).
- `suggestedFix`: Convert the cycle-firewall `//` block into a `/**` lead plus `@packageDocumentation` `@since 0.0.0`. Add `@category errors` / `configuration` / `schemas` and `@since 0.0.0` on the three classes. One titled Example per class: construct/handle `GlobPatternError` from `compileResult`; `GlobPatternOptions.make` with `platform: "posix"`; `GlobPattern.compile` then `matches` with a realistic path. Keep existing leads; do not echo the class name.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: glob
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: glob-R1-014, glob-R1-015, glob-R1-016, glob-R1-017, glob-R1-018, glob-R1-019
- `status`: open
- `fixedCommit`: pending

### glob-R1-002: `GlobSet.ts` module header and `GlobSet` lack tags and Example

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: glob/GlobSet.ts:1, glob/GlobSet.ts:58
- `symbol`: GlobSet
- `kind`: module | value
- `evidence`: Census module `missing-module-summary|missing-packageDocumentation|missing-module-since` (confirmed: `//` only). `GlobSet` has a useful lead and `@public`; missing `@category`, `@since`, titled Example.
- `impact`: The multi-pattern workspaces contract is undocumented for docgen and for callers choosing `GlobSet` vs `GlobPattern`.
- `suggestedFix`: Lift the SET-semantics `//` notes into a module `/**` with `@packageDocumentation` `@since 0.0.0`. Tag `GlobSet` `@category schemas` `@since 0.0.0`. Example: compile `["packages/*", "!packages/docs"]` and show include vs exclude.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: glob
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: glob-R1-016, glob-R1-017, glob-R1-018, glob-R1-019
- `status`: open
- `fixedCommit`: pending

### glob-R1-003: `index.ts` package entry missing `@since 0.0.0`

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P2-medium
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: glob/index.ts:1
- `symbol`: glob (package entry)
- `kind`: module
- `evidence`: Lead and `@packageDocumentation` present. Census skipped module findings because `owningExportCount === 0` (barrel). REVIEW-BRIEF still requires `@since 0.0.0` on the module header. Re-exports of `GlobPattern*` / `GlobSet` are graph edges — not new symbols (census correctly left them empty).
- `impact`: Package overview omits the version tag every other exporting module is required to carry; `enforceVersion` can fail the entry file.
- `suggestedFix`: Add `@since 0.0.0` after `@packageDocumentation`. Do not document the re-export lines.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: glob
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: none
- `status`: open
- `fixedCommit`: pending

### glob-R1-004: `assertValidPattern.ts` undocumented module and export

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: glob/internal/assertValidPattern.ts:1, glob/internal/assertValidPattern.ts:12
- `symbol`: assertValidPattern
- `kind`: module | value
- `evidence`: Census `missing-module-summary|missing-packageDocumentation|missing-module-since` plus export `missing-summary|missing-required-tags` — all confirmed. Port notes at lines 4–8 are `//` only.
- `impact`: Engine entry guard is invisible in hovers; callers cannot tell TypeError (non-string defect) from `GuardExceeded("PatternTooLong")`.
- `suggestedFix`: Module `/**` with `@packageDocumentation` `@since 0.0.0`. Lead: reject non-strings as defects and over-length patterns as the typed guard. `@category assertions` `@since 0.0.0`. Titled Example: a short string passes; a `MAX_PATTERN_LENGTH + 1` string throws `GuardExceeded`. Add `@throws` for `TypeError` vs `GuardExceeded` (sync throws outside an Effect channel).
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: glob
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: glob-R1-014
- `status`: open
- `fixedCommit`: pending

### glob-R1-005: `ast.ts` module, `ExtglobType`, and `AST` undocumented

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: glob/internal/ast.ts:1, glob/internal/ast.ts:69, glob/internal/ast.ts:180
- `symbol`: ExtglobType, AST
- `kind`: module | type | value
- `evidence`: Census module + `ExtglobType` `missing-summary|missing-required-tags` + `AST` `missing-summary|missing-required-tags|@example` — all confirmed. Port notes (lines 5–13) already describe the hostile `@(@(@` stack-overflow backstop.
- `impact`: The extglob compiler has no public prose; `AST` is value-level and needs an Example (or `@internal` — see glob-R1-019).
- `suggestedFix`: Module header from the five port notes. `ExtglobType`: prose for the five extglob operators, `@category type-level` `@since 0.0.0` (Example optional). `AST`: lead that it is the extglob tree minimatch compiles; `@category models` `@since 0.0.0`; one Example only if the class stays public, else `@internal`.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: glob
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: glob-R1-014, glob-R1-019
- `status`: open
- `fixedCommit`: pending

### glob-R1-006: `balancedMatch.ts` module header and three exports missing tags/Examples

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: glob/internal/balancedMatch.ts:1, glob/internal/balancedMatch.ts:27, glob/internal/balancedMatch.ts:44, glob/internal/balancedMatch.ts:62
- `symbol`: BalancedResult, balanced, range
- `kind`: module | type | value
- `evidence`: Census module `missing-packageDocumentation|missing-module-since` confirmed. Census **missed** `missing-module-summary`: `getLeadingCommentRanges(0)` steals `BalancedResult`'s `/**` as fileoverview. Exports: `BalancedResult` missing `@category` `@since` (lead exists, type-level — Example not required). `balanced` / `range` missing `@category` `@since` titled Example (leads exist).
- `impact`: Iterative balanced-match (no recursion, no depth guard — port notes line 23–24) is not a module doc. Value exports fail the Example ratchet.
- `suggestedFix`: Real module `/**` **before** `BalancedResult` so its JSDoc stays on the interface. Mention fully iterative / no depth guard. Tag `BalancedResult` `@category type-level`; `balanced` / `range` `@category parsing` `@since 0.0.0`. Example: `balanced("{", "}", "a{b,c}d")` yields `body === "b,c"`; unmatched returns `false`.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: glob
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: none
- `status`: open
- `fixedCommit`: pending

### glob-R1-007: `braceExpansion.ts` module, `BraceExpansionOptions`, and `expand` incomplete

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: glob/internal/braceExpansion.ts:1, glob/internal/braceExpansion.ts:108, glob/internal/braceExpansion.ts:119
- `symbol`: BraceExpansionOptions, expand
- `kind`: module | type | value
- `evidence`: Census module findings confirmed (`//` license + port notes). `BraceExpansionOptions` `missing-summary|missing-required-tags` confirmed (empty interface). `expand` has a useful lead mentioning `GuardExceeded`; missing `@category` `@since` titled Example.
- `impact`: Hostile brace bombs are the expansion budget's whole reason; without an Example callers still think Bash-style expansion is unbounded.
- `suggestedFix`: Module header from port notes 22–34 (depth guard, lazy post, throw on budget instead of truncate). Document `BraceExpansionOptions.max` (positive integer; invalid is a defect via `assertCap`). `expand` `@category parsing` `@since 0.0.0`. Example: `"a{b,c}d"` → `["abd","acd"]` and note that over-budget throws `GuardExceeded`.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: glob
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: glob-R1-014
- `status`: open
- `fixedCommit`: pending

### glob-R1-008: `braceExpressions.ts` module, `ParseClassResult`, and `parseClass` undocumented

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: glob/internal/braceExpressions.ts:1, glob/internal/braceExpressions.ts:38, glob/internal/braceExpressions.ts:46
- `symbol`: ParseClassResult, parseClass
- `kind`: module | type | value
- `evidence`: Census module + `missing-summary|missing-required-tags` on both exports — confirmed. `//` comments at lines 40–45 describe `parseClass` but are not JSDoc.
- `impact`: Character-class compiler (POSIX classes, negation `!`/`^`, poison `$.`) has no hover docs; `parseClass` throws if `glob[position] !== "["`.
- `suggestedFix`: Module `/**` (position-bounded, no recursion). `ParseClassResult` tuple meaning: regexp source, `/u` flag, consumed count, hasMagic — `@category type-level`. `parseClass` `@category parsing` with titled Example (`[a-z]`, `[!]`, `[_]`) and `@throws` for the not-in-class `Error`.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: glob
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: glob-R1-023
- `status`: open
- `fixedCommit`: pending

### glob-R1-009: `escape.ts` module tags plus `escape` missing `@category` `@since` Example

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: glob/internal/escape.ts:1, glob/internal/escape.ts:9, glob/internal/escape.ts:39
- `symbol`: escape
- `kind`: module | value
- `evidence`: Census module findings confirmed. Owning export is `export { escapePattern as escape }` (local rename, not a foreign graph edge). JSDoc already lives on `escapePattern` (useful lead, windowsPathsNoEscape / magicalBraces prose) — census `missing-summary` is a leftover false positive. Missing `@category` `@since` titled Example on that block is real.
- `impact`: Magic-escaping is how callers embed literals; without an Example the `[]` vs `\\` modes stay tribal knowledge.
- `suggestedFix`: Module header. Move/keep the existing lead on the export (attach JSDoc so `escape` carries it, or `export const escape = escapePattern` with the block on the const). `@category encoding` `@since 0.0.0`. Example: `escape("foo*.ts")` vs `windowsPathsNoEscape: true`. See glob-R1-020 for the magicalBraces default Gotcha.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: glob
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: glob-R1-020
- `status`: open
- `fixedCommit`: pending

### glob-R1-010: `limits.ts` module header and nine guard exports missing tags/Examples

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: glob/internal/limits.ts:1, glob/internal/limits.ts:5, glob/internal/limits.ts:8, glob/internal/limits.ts:11, glob/internal/limits.ts:14, glob/internal/limits.ts:17, glob/internal/limits.ts:20, glob/internal/limits.ts:28, glob/internal/limits.ts:39, glob/internal/limits.ts:46
- `symbol`: MAX_PATTERN_LENGTH, EXPANSION_MAX, MAX_GLOBSTAR_RECURSION, MAX_EXTGLOB_RECURSION, MAX_NESTING_DEPTH, GuardReason, GuardExceeded, isGuardExceeded, assertCap
- `kind`: module | value | type
- `evidence`: Census module `missing-packageDocumentation|missing-module-since` confirmed. Census **missed** `missing-module-summary` (first-export JSDoc stolen as fileoverview). Per-symbol leads exist except `isGuardExceeded`. All nine missing `@category` `@since`; value-level also missing titled Example: `MAX_PATTERN_LENGTH`, `EXPANSION_MAX`, `MAX_GLOBSTAR_RECURSION`, `MAX_EXTGLOB_RECURSION`, `MAX_NESTING_DEPTH`, `GuardExceeded`, `isGuardExceeded`, `assertCap`. `GuardReason` is type-level (Example optional).
- `impact`: These constants **are** the hostile-input policy. Without Examples and categories, compile-time caps look like magic numbers.
- `suggestedFix`: Dedicated module `/**` before `MAX_PATTERN_LENGTH`. Categories: constants for the five caps; `type-level` for `GuardReason`; `errors` for `GuardExceeded`; `guards` for `isGuardExceeded`; `assertions` for `assertCap`. Each value needs one observable Example (log the cap; `isGuardExceeded(new GuardExceeded(...))`; `assertCap` success). Keep leads that already cite upstream numbers.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: glob
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: glob-R1-014, glob-R1-015, glob-R1-022
- `status`: open
- `fixedCommit`: pending

### glob-R1-011: `minimatch.ts` module, `braceExpand`, and `Minimatch` undocumented (GLOBSTAR re-export excluded)

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: glob/internal/minimatch.ts:1, glob/internal/minimatch.ts:117, glob/internal/minimatch.ts:135
- `symbol`: braceExpand, Minimatch
- `kind`: module | value
- `evidence`: Census module findings confirmed. `braceExpand` and `Minimatch` `missing-summary|missing-required-tags` confirmed (brace comments at 107–116 are `//`). Foreign re-exports `escape` / `unescape` / types at 36–38 are graph edges (census correctly empty). `export { GLOBSTAR }` at 39 is **not** owning — see Rejected.
- `impact`: Engine class is the compile/match implementation; zero JSDoc on the class. Port notes already warn globstar false-negatives and no ambient `process.platform`.
- `suggestedFix`: Module header from port notes 5–27. `braceExpand` `@category parsing` with Example (`"a{b,c}"`, `nobrace: true` no-ops) and mention the CVE-2022-3517 pre-check. `Minimatch` `@category models` (or `@internal` per glob-R1-019) with a lead covering posix default platform, `match()` totality, globstar cap. If public, one Example constructing `new Minimatch("**/*.ts")` and `match`.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: glob
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: glob-R1-015, glob-R1-019
- `status`: open
- `fixedCommit`: pending

### glob-R1-012: `types.ts` module header and six type/value exports missing tags

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: glob/internal/types.ts:1, glob/internal/types.ts:13, glob/internal/types.ts:33, glob/internal/types.ts:88, glob/internal/types.ts:94, glob/internal/types.ts:96, glob/internal/types.ts:97
- `symbol`: Platform, EngineOptions, MMRegExp, GLOBSTAR, ParseReturnFiltered, ParseReturn
- `kind`: module | type | value
- `evidence`: Census module `missing-packageDocumentation|missing-module-since` confirmed; **missed** `missing-module-summary` (Platform JSDoc stolen as fileoverview). `Platform` / `EngineOptions` / `MMRegExp` / `GLOBSTAR` have leads, missing `@category` `@since`. `GLOBSTAR` is the only value-level export (unique symbol) — needs titled Example. `ParseReturnFiltered` / `ParseReturn` `missing-summary|missing-required-tags` confirmed.
- `impact`: Engine option bag and globstar marker are the dialect contract; `GLOBSTAR` without an Example looks like a regexp. Field JSDoc on `EngineOptions` is useful and should stay.
- `suggestedFix`: Real module `/**` before `Platform` (posix default, no ambient platform). `@category type-level` for the types; `configuration` for `EngineOptions`; `symbols` for `GLOBSTAR`. Prose for `ParseReturn*` (segment parse: string, `MMRegExp`, `GLOBSTAR`, or `false`). `GLOBSTAR` Example: `part === GLOBSTAR` vs a string segment.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: glob
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: glob-R1-015, glob-R1-016
- `status`: open
- `fixedCommit`: pending

### glob-R1-013: `unescape.ts` module tags plus `unescape` missing `@category` `@since` Example

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: glob/internal/unescape.ts:1, glob/internal/unescape.ts:9, glob/internal/unescape.ts:45
- `symbol`: unescape
- `kind`: module | value
- `evidence`: Same shape as escape: census module findings confirmed; `missing-summary` is a leftover (JSDoc on `unescapePattern`); missing tags/Example on that block is real. Lead already covers windowsPathsNoEscape and magicalBraces.
- `impact`: Undo-escape with mismatched options silently leaves braces escaped; callers of `GlobPattern.unescape` inherit engine defaults.
- `suggestedFix`: Module header. Attach the existing block to the exported name. `@category decoding` `@since 0.0.0`. Example: `unescape(escape("foo*.ts")) === "foo*.ts"` and a `windowsPathsNoEscape` round-trip. Pair with glob-R1-020.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: glob
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: glob-R1-020
- `status`: open
- `fixedCommit`: pending

## Editorial findings

### glob-R1-014: Hostile-input Gotchas missing on compile guards

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: glob/GlobPattern.ts:15, glob/GlobPattern.ts:163, glob/internal/limits.ts:22, glob/internal/braceExpansion.ts:22, glob/internal/ast.ts:5, glob/internal/assertValidPattern.ts:4
- `symbol`: GlobPattern.compile, GlobPatternError, expand, AST, assertValidPattern, GuardExceeded
- `kind`: value
- `evidence`: Implementation already warns: 64KB length cap; brace budget throws `ExpansionBudgetExceeded` instead of upstream silent truncate; `MAX_NESTING_DEPTH` on brace expand and on `@(@(@` extglob chains that overflow real minimatch 10.2.5; non-string patterns are TypeError defects. `GlobPatternError` lead lists the three reasons but the class and `compile`/`compileResult` have no `**Gotchas**`. `matches()` is documented total; compile is the only fallible boundary.
- `impact`: A caller who treats glob compile like `new RegExp` will either miss the typed `GlobPatternError` channel or assume match-time can hang/throw on hostile input.
- `suggestedFix`: Add `**Gotchas**` on `GlobPattern`, `GlobPatternError`, `expand`, `assertValidPattern`, and `GuardExceeded`: compile-time only; three reasons (`PatternTooLong`, `ExpansionBudgetExceeded`, `NestingDepthExceeded`); invalid *options* / caps are defects; match-time never throws this. Do not use `@remarks`. Show a brace-bomb or over-length failure in the `compileResult` Example (`Result.isFailure`).
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: glob
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: glob-R1-001, glob-R1-004, glob-R1-007, glob-R1-010
- `status`: open
- `fixedCommit`: pending

### glob-R1-015: Globstar backtracking cap is a silent false negative, not an error

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: glob/GlobPattern.ts:221, glob/internal/minimatch.ts:15, glob/internal/minimatch.ts:786, glob/internal/limits.ts:10, glob/internal/types.ts:81
- `symbol`: GlobPattern.matches, Minimatch, MAX_GLOBSTAR_RECURSION, EngineOptions.maxGlobstarRecursion
- `kind`: value
- `evidence`: `matches` lead already says the globstar cap is a documented false negative; minimatch port notes and `#matchGlobStarBodySections` (lines 786–787) say exceeding `maxGlobstarRecursion` (default 200) is "intentional false negative — acceptable break in correctness for security" and must never throw. `noglobstar` rewrites `**` to `*`. None of this is a `**Gotchas**` section on `GlobPattern`, `MAX_GLOBSTAR_RECURSION`, or `Minimatch`.
- `impact`: Callers will treat a `false` from `matches("a/b/c/...")` against `**/**/**/...` as "does not match" rather than "gave up". Security-sensitive filters can under-match.
- `suggestedFix`: `**Gotchas**` on `GlobPattern.matches` (and the class), `MAX_GLOBSTAR_RECURSION`, and `Minimatch`: over-cap returns `false`; never `GuardExceeded`. Mention `noglobstar`. Example can stay a simple `**/*.ts` match plus a one-line Gotcha, not a 200-deep path.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: glob
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: glob-R1-001, glob-R1-010, glob-R1-011
- `status`: open
- `fixedCommit`: pending

### glob-R1-016: Two bang semantics — whole-pattern negation vs GlobSet exclusion

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: glob/GlobSet.ts:1, glob/GlobSet.ts:16, glob/GlobPattern.ts:235, glob/GlobPattern.ts:247, glob/GlobPattern.ts:287, glob/internal/minimatch.ts:562, glob/internal/types.ts:38
- `symbol`: GlobSet, GlobPattern.negated, GlobPattern.enumerationPrefix, GlobPattern.crossesSegments
- `kind`: value
- `evidence`: GlobSet file notes: "a leading bang marks an exclusion filter applied after positive matching. This is deliberately distinct from minimatch's whole-pattern negation: both exist, at different levels, on purpose." `exclusionTarget` strips exactly one `!`; a remaining bang is inner minimatch negate. `parseNegate` toggles on each leading `!`. `enumerationPrefix` / `crossesSegments` `@remarks` already warn that negated patterns under-enumerate if used as a walk root. Public leads never say "do not confuse SET `!` with pattern `!`".
- `impact`: `GlobSet.compile(["!foo"])` is an exclude of `foo`, not a negated matcher. `GlobPattern.compile("!foo")` inverts `matches`. Using `enumerationPrefix` on a negated pattern as a traversal root misses paths *outside* the prefix.
- `suggestedFix`: `**Gotchas**` on `GlobSet` and `GlobPattern` (and `negated` / `enumerationPrefix` / `crossesSegments`): (1) SET bang vs pattern bang; (2) `nonegate` / `flipNegate` only affect the engine, not GlobSet's leading-bang strip; (3) guard `negated` before trusting `enumerationPrefix`. Move the existing `@remarks` prose into those Gotchas (glob-R1-017). Example on `GlobSet` should include a `!` exclude; Example on `GlobPattern` should show `negated === true` for `!*.ts`.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: glob
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: glob-R1-001, glob-R1-002, glob-R1-017
- `status`: open
- `fixedCommit`: pending

### glob-R1-017: Retired `@remarks` on facade methods

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: glob/GlobPattern.ts:179, glob/GlobPattern.ts:247, glob/GlobPattern.ts:287, glob/GlobSet.ts:129
- `symbol`: GlobPattern.compileResult, GlobPattern.enumerationPrefix, GlobPattern.crossesSegments, GlobSet.compileResult
- `kind`: value
- `evidence`: Four `@remarks` blocks. Census inspects only the class declaration, so it undercounted. Zero-legacy law forbids `@remarks` in new/touched docs; body must use `**Details**` / `**Gotchas**` / `**When to use**`.
- `impact`: Touching these files for Examples will fail `jsdoc-ratchet` if `@remarks` remains. The content is the actual Gotchas/When-to-use (sync vs Effect compile; negation vs prefix).
- `suggestedFix`: `compileResult` remarks → `**When to use**` ("Use when the call site cannot host an Effect") plus `{@link GlobPattern.compile}` / `{@link GlobSet.compile}` for traced Effect. Prefix/crosses remarks → `**Gotchas**` (glob-R1-016). No `@example` carrier.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: glob
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: glob-R1-016
- `status`: open
- `fixedCommit`: pending

### glob-R1-018: Schema classes missing `$I.annote`

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P2-medium
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .agents/skills/jsdoc-annotation-specialist/references/annotation-patterns.md
- `affectedFiles`: glob/GlobPattern.ts:24, glob/GlobPattern.ts:50, glob/GlobPattern.ts:144, glob/GlobSet.ts:58
- `symbol`: GlobPatternError, GlobPatternOptions, GlobPattern, GlobSet
- `kind`: value
- `evidence`: No `$I` composer in the pack. `Schema.TaggedError<GlobPatternError>()("GlobPatternError", fields)` and `Schema.Class<X>("X")({...})` omit the annotation argument. Sibling scratchpad schemas use `$ScratchpadId.create(...)` then `$I.annote`.
- `impact`: Runtime schema identity/description never match JSDoc; OpenAPI/AST identity is a bare string; annotation-patterns require `$I.annote` on class schemas and tagged errors.
- `suggestedFix`: Add `const $I = $ScratchpadId.create("glob/...")`. Pass `$I.annote("GlobPatternError"|"GlobPatternOptions"|"GlobPattern"|"GlobSet", { description })` as the class/error third argument. Keep `S.TaggedError<E>()("E", fields, annote)` (do not pass a bare identifier equal to the tag as the first type-id argument).
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: glob
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: glob-R1-001, glob-R1-002
- `status`: open
- `fixedCommit`: pending

### glob-R1-019: Docgen `checkClasses` requires Examples on members; engine classes should be `@internal`

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: glob/GlobPattern.ts:144, glob/GlobSet.ts:58, glob/internal/minimatch.ts:135, glob/internal/ast.ts:180, glob/internal/limits.ts:28
- `symbol`: GlobPattern, GlobSet, Minimatch, AST, GuardExceeded
- `kind`: value
- `evidence`: `packages/tooling/tool/docgen/src/Checker.ts` `checkClass` runs `enforceExample` on static methods, instance methods, and properties. `scratchpad/docgen.json` has `enforceExamples: true`. Parser includes members unless `@internal`/`@ignore`. Facade members already have JSDoc (`compile`, `compileResult`, `matches`, getters, `escape`/`unescape`/`FromString`, GlobSet accessors). `Minimatch` / `AST` have large public method surfaces with no docs — adding a class lead without `@internal` will demand an Example per method.
- `impact`: Fixing only top-level census tags still leaves `bun run docgen` red. Writing Examples for the entire minimatch engine is the wrong fix.
- `suggestedFix`: Public facade: one titled Example on each documented member that docgen extracts (or fold trivial getters into the class Example and keep member prose without claiming they are undocumented — they will still be checked). Internal engine (`Minimatch`, `AST`, `GuardExceeded`, helpers): tag `@internal` on the class/module so docgen skips them, and keep a short lead for in-repo readers. Do not strip existing facade member prose.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: glob
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: glob-R1-001, glob-R1-002, glob-R1-005, glob-R1-011
- `status`: open
- `fixedCommit`: pending

### glob-R1-020: `escape` / `unescape` default `magicalBraces` disagree

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: glob/internal/escape.ts:21, glob/internal/unescape.ts:26, glob/GlobPattern.ts:300
- `symbol`: escape, unescape, GlobPattern.escape, GlobPattern.unescape
- `kind`: value
- `evidence`: `escapePattern` defaults `magicalBraces = false`. `unescapePattern` defaults `magicalBraces = true`. Public `GlobPattern.escape`/`unescape` pass `toEngineOptions`, so omitted `magicalBraces` keeps that asymmetry. Leads mention each option but not the mismatch. `GlobPattern.unescape` lead is only "Undo {@link GlobPattern.escape}".
- `impact`: Default round-trip is not symmetric for `{` / `}`. Callers who unescape engine-escaped braces with public defaults will strip brace escapes that `escape` did not add, and the reverse leaves braces escaped.
- `suggestedFix`: `**Gotchas**` on both internals and the `GlobPattern` statics: pass the same options bag both ways; default `magicalBraces` is false on escape and true on unescape. Also document `windowsPathsNoEscape` (`[]` wrap, `\\` is a separator; slashes never escape). Example must show both modes.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: glob
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: glob-R1-009, glob-R1-013
- `status`: open
- `fixedCommit`: pending

### glob-R1-021: GlobSet classification Gotchas (braces, escaped literals, comments)

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P2-medium
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: glob/GlobSet.ts:6, glob/GlobSet.ts:66, glob/GlobSet.ts:187
- `symbol`: GlobSet
- `kind`: value
- `evidence`: File notes: braced patterns classify per expanded alternative (`{tools/cli,packages/*}` is a literal AND a wildcard). `#classify` keys literals on the engine's **unescaped** single row so `foo\*bar` does not drop matches; comments contribute nothing; leftover negate/non-string rows go to `wildcards`. None of that is in the class JSDoc (`wildcards` getter mentions negation only).
- `impact`: Enumerator consumers that assume `literals` is the raw source text, or that a brace set is one wildcard, will mis-walk workspaces (the issue-#62 path).
- `suggestedFix`: `**Details**`/`**Gotchas**` on `GlobSet` and the `literals`/`wildcards` getters. Example: compile `["{tools/cli,packages/*}", "foo\\*bar", "# comment"]` and print `literals` / `wildcards` / `excludes`.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: glob
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: glob-R1-002, glob-R1-016
- `status`: open
- `fixedCommit`: pending

### glob-R1-022: `MAX_EXTGLOB_RECURSION` degrades to literal; it does not throw

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P2-medium
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: glob/internal/limits.ts:13, glob/internal/ast.ts:13
- `symbol`: MAX_EXTGLOB_RECURSION
- `kind`: value
- `evidence`: Lead: "over-nesting degrades to literal." AST port notes: `maxExtglobRecursion` degrade-to-literal on-limit is kept; the *structural* `MAX_NESTING_DEPTH` backstop is what throws `NestingDepthExceeded`. Easy to conflate with globstar (false `false`) and brace budget (throw).
- `impact`: Nested extglobs that exceed depth 2 silently stop being extglobs; match semantics change without `GlobPatternError`.
- `suggestedFix`: `**Gotchas**` on `MAX_EXTGLOB_RECURSION` and `AST`: over-limit → literal, not throw; `MAX_NESTING_DEPTH` is the throw. Cross-link the three policies (throw / false-negative / degrade).
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: glob
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: glob-R1-010, glob-R1-014, glob-R1-015
- `status`: open
- `fixedCommit`: pending

### glob-R1-023: `parseClass` throw, poison `$.`, and `[_]` literal escape

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P2-medium
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: glob/internal/braceExpressions.ts:40, glob/internal/braceExpressions.ts:48, glob/internal/braceExpressions.ts:139, glob/internal/braceExpressions.ts:148
- `symbol`: parseClass
- `kind`: value
- `evidence`: Throws `Error("not in a brace expression")` if `glob[pos] !== "["`. Empty class poisons the whole glob with `$.`. Single-character `[x]` / `[_]` is not magic (literal escape of glob metacharacters). `!`/`^` at class start negate.
- `impact`: Callers treating `parseClass` as total will see a sync throw; invalid `[]` does not fail compile — it matches nothing.
- `suggestedFix`: `**Gotchas**` plus `@throws` on `parseClass`. Example: `[_]` consumed as literal `_`; `[` at a non-`[` position throws.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: glob
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: glob-R1-008
- `status`: open
- `fixedCommit`: pending

### glob-R1-024: Public `GlobPatternOptions` omits field Gotchas that `EngineOptions` already documents

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P2-medium
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: glob/GlobPattern.ts:38, glob/internal/types.ts:33
- `symbol`: GlobPatternOptions
- `kind`: value
- `evidence`: Public class lead covers `platform` default `"posix"` and `braceExpandMax` "caps tighten, never raise." Field JSDoc for `nonegate`, `noglobstar`, `flipNegate`, `dot`, `matchBase`, `partial`, `windowsPathsNoEscape` lives only on internal `EngineOptions`. Invalid options throw at `make` (defect), not `GlobPatternError`.
- `impact`: Published options surface is what config authors see; they will not open `EngineOptions`. `nonegate: true` plus a `!` pattern is a different dialect than GlobSet exclusion.
- `suggestedFix`: `**Gotchas**` / field prose on `GlobPatternOptions` (or `@see {@link EngineOptions}` with a purpose phrase is weaker because EngineOptions should likely be `@internal`). Restate: no ambient platform; `braceExpandMax` cannot exceed `EXPANSION_MAX`; `nonegate`/`noglobstar`/`flipNegate` interactions. Keep the defect-at-make fact.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: glob
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: glob-R1-001, glob-R1-015, glob-R1-016
- `status`: open
- `fixedCommit`: pending

## Rejected false positives

1. **`glob/internal/minimatch.ts:39` `GLOBSTAR`** — census lists this as owning (`export { GLOBSTAR }` after importing from `./types.ts`). It is a graph edge. Owning docs belong on `glob/internal/types.ts:94`. Do not write a second Example here.
2. **`glob/internal/escape.ts` `missing-summary`** — useful lead already on `escapePattern`. Confirm missing `@category` `@since` Example only (glob-R1-009).
3. **`glob/internal/unescape.ts` `missing-summary`** — same leftover; lead is on `unescapePattern` (glob-R1-013).
4. **`glob/index.ts` re-exports** — `GlobPattern*` / `GlobSet` barrels are not documentation subjects. Only the missing module `@since` is accepted (glob-R1-003).
5. **Type-level Example demands** — census correctly omitted `@example` for `ExtglobType`, `BalancedResult`, `BraceExpansionOptions`, `ParseClassResult`, `GuardReason`, `Platform`, `EngineOptions`, `MMRegExp`, `ParseReturnFiltered`, `ParseReturn`. Do not add placeholder Examples.

Census undercounts (accepted above, not rejects): `index.ts` missing `@since`; `balancedMatch.ts` / `limits.ts` / `types.ts` missing module lead (first-export JSDoc leaked into fileoverview); method-level `@remarks`; `$I.annote`; class-member Examples.

## Files reviewed

| File | Owning | Disposition |
| --- | ---: | --- |
| `glob/index.ts` | 0 | Lead + `@packageDocumentation`; add `@since`. Re-exports skipped. |
| `glob/GlobPattern.ts` | 3 | Confirm mechanical; editorial Gotchas, `@remarks`, `$I.annote`, members. |
| `glob/GlobSet.ts` | 1 | Confirm mechanical; SET bang, classification, `@remarks`, `$I.annote`. |
| `glob/internal/assertValidPattern.ts` | 1 | Confirm all census. |
| `glob/internal/ast.ts` | 2 | Confirm all census. |
| `glob/internal/balancedMatch.ts` | 3 | Confirm tags; add missed module summary. |
| `glob/internal/braceExpansion.ts` | 2 | Confirm all census. |
| `glob/internal/braceExpressions.ts` | 2 | Confirm all census. |
| `glob/internal/escape.ts` | 1 | Confirm tags/Example; reject missing-summary. |
| `glob/internal/limits.ts` | 9 | Confirm tags; add missed module summary. |
| `glob/internal/minimatch.ts` | 3 listed / 2 real | Confirm `braceExpand`+`Minimatch`; reject `GLOBSTAR` re-export. |
| `glob/internal/types.ts` | 6 | Confirm tags; add missed module summary; `GLOBSTAR` Example required. |
| `glob/internal/unescape.ts` | 1 | Confirm tags/Example; reject missing-summary. |

## Pack verdict

- files reviewed: 13
- owning exports reviewed: 34
- confirmed mechanical items: 13
- editorial items: 11
- rejected false positives: 5
- accepted findings: 24
