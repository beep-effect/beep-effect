# Packs yaml-public + yaml-internal — round 3 inventory

- reviewer: jsdoc-annotation-specialist (independent of rounds 1–2)
- scope: everything under `scratchpad/yaml/`
- census: yaml-public 11 modules / 80 owning; yaml-internal 37 modules / 183 owning; opens = 0

Mechanical census is confirmed closed. Zero `@example` / `@remarks` / `@module` / `@template` tags remain. Every `@see` has a purpose phrase. Every `@category` is a canonical kebab role. Round-2 yaml findings are closed in source (leads, Gotchas, and fences now match for `YamlParseError`, `YamlParseOptions`, `YamlRange`, `YamlFormattingOptions`, `AliasExpansionBudgetExceeded`, `parseCSTAll`, `cstEvents`, `composeBlockMap`, `computeEdits`, `builtinOptionsSchemas`, quote escaping, apostrophe doubling, document `0x10`, and interior trailing space).

This round does **not** re-open closed tag misses, the internal public-facade Example import constraint, R1 type-companion “Decoded literal union produced by …” leads, method-level Examples that duplicate a class Example, `$I.annoteSchema` on internal lint option schemas, `@effected/jsonc` in prose, or taste-only extra Examples.

## Rejected (not opened)

- Internal value Examples that proxy through `@beep/scratchpad/yaml` **and still observe the named contract** (`makeAlias` defined-vs-dangling, `Yaml.equals` NaN/key-order, `YamlLint.run` hits, `computeEdits` one-line modify, comment-preserving `formatToString` that would fail if comments were dropped).
- `AliasExpansionBudgetExceeded` still trips the composer’s per-token `maxAliasCount` cap rather than the expansion-walk throw (round-2 residual; unobservable from the barrel).
- Extra Examples on `QuoteStyle` / `ScalarChomp` / method `YamlTokens.tokenize` / `YamlFormat.format`.
- Options-schema Examples that only construct and echo a valid `YamlLintConfig` entry under a matching “Enable as an error” title.

## Items

### yaml-public-R3-001: StyleConflict Example is not a conflict

- `round`: 3
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: scratchpad/yaml/YamlLint.ts:472
- `symbol`: StyleConflict
- `kind`: value
- `evidence`: Lead: “a `(rule, dimension)` whose observed spellings **disagree**.” Title: “Name a quote-style conflict.” Fence constructs `StyleConflict.make` with a **single** `StyleVoteTally` (`value: "double"`, `count: 2`) and logs `conflict.dimension // "quoteType"`. Strict inference only pushes a conflict when `tallies.length > 1` (`resolveStrictEvidence`). The sibling `YamlStyleConflictError` Example already uses mixed quotes (`a: 'x'\nb: "y"\n`).
- `impact`: Hover teaches that a one-spelling tally *is* a conflict. Callers will not recognize disagreement as two candidates.
- `suggestedFix`: Keep one titled Example. Put two candidates in `candidates` (double and single) so the record is an actual disagreement, or retitle to constructing a conflict-shaped record and drop “conflict” as the observed fact. Do not add a second Example.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: yaml-public
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: none
- `status`: open
- `fixedCommit`: pending

### yaml-public-R3-002: StyleEvidence.combine Example does not prove a merge

- `round`: 3
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P2-medium
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: scratchpad/yaml/YamlLint.ts:370
- `symbol`: StyleEvidence
- `kind`: value
- `evidence`: Title: “Combine two observe results.” Fence observes `singles` (`'Ada'`) and `doubles` (`"Bob"`), then `StyleEvidence.combine`, then `combined.votes.some((vote) => vote.dimension === "quoteType")`. That assertion is already true of `singles` alone; `combine` could return the left operand unchanged and still pass.
- `impact`: The monoid this class exists to teach — counts add, both spellings survive — is invisible. Callers cannot tell combine from identity.
- `suggestedFix`: Keep one Example. Assert a merge property: two `quoteType` tallies after combine, or `single` and `double` values both present. Drop the tautological `some(quoteType)`.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: yaml-public
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: yaml-public-R3-001
- `status`: open
- `fixedCommit`: pending

### yaml-internal-R3-001: Nesting-depth overflow Examples never overflow

- `round`: 3
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: scratchpad/yaml/internal/composer/state.ts:408, scratchpad/yaml/internal/stringifier.ts:85
- `symbol`: MAX_NESTING_DEPTH, StringifyDepthExceeded
- `kind`: value
- `evidence`: `MAX_NESTING_DEPTH` title: “Public stringify maps depth overflow to NestingDepthExceeded.” Fence: `YamlDiagnostic.isFatal("NestingDepthExceeded") // true` and `Yaml.parseResult("a: 1\n")` success. `StringifyDepthExceeded` title: “Public fatality of NestingDepthExceeded.” Fence is only `isFatal("NestingDepthExceeded")`. Neither stringifies a deep value, neither yields `NestingDepthExceeded` on a result, and the sibling `StringifyFailure` Example *does* run `Yaml.stringifyResult(cyclic)`. A 257-deep array is constructible from the barrel; this is not the unobservable-from-barrel residual.
- `impact`: Hover teaches that a successful one-line parse *is* the depth blow-up mapping. Callers will not recognize `NestingDepthExceeded` as the public stringify mapping.
- `suggestedFix`: Keep one Example each. Build a JS value nested past 256, `Yaml.stringifyResult`, assert `Result.isFailure` and `diagnostics[0].code === "NestingDepthExceeded"` (and `isFatal` if useful). Do not present `new StringifyDepthExceeded` as a package entry point. Retitle `StringifyDepthExceeded` off “fatality” if the fence stays a predicate-only check.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: yaml-internal
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: none
- `status`: open
- `fixedCommit`: pending

### yaml-internal-R3-002: createState Example trips a zero cap, not the default of 100

- `round`: 3
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P2-medium
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: scratchpad/yaml/internal/composer/state.ts:358
- `symbol`: createState
- `kind`: value
- `evidence`: Title: “Alias budget of **100** is the default DoS guard.” Details correctly say `maxAliasCount: 100`. Fence: `Yaml.parseResult("a: &id 1\nb: *id\n", YamlParseOptions.make({ maxAliasCount: 0 }))` then `Result.isFailure`. That is the zero-cap trip already used on `YamlParseOptions` / `AliasExpansionBudgetExceeded`. Default 100 is never observed (the same document succeeds under omitted options).
- `impact`: Hover implies the default guard is the failing `0` in the fence. Callers will not see that one defined alias is legal at the default of 100.
- `suggestedFix`: Keep one Example. Parse the same defined-alias document with default options (success) and with `maxAliasCount: 0` (failure), or retitle to the zero-cap trip the fence actually runs.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: yaml-internal
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: yaml-internal-R3-001
- `status`: open
- `fixedCommit`: pending

### yaml-internal-R3-003: stripNodeComments Example has no comments to drop

- `round`: 3
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: scratchpad/yaml/internal/stringifier.ts:1022
- `symbol`: stripNodeComments
- `kind`: value
- `evidence`: Title: “Canonical stringify drops comments.” Fence: `Yaml.stringify({ a: 1 })` then `text.includes("#") === false`. A JS object never carried comments; the assertion is true of any comment-free stringify. The function strips comment fields from AST nodes when `forceDefaultStyles` is on; that input never reaches it.
- `impact`: Callers following the Example will believe comment-stripping is demonstrated by serializing `{ a: 1 }`. The canonical-output contract is untested.
- `suggestedFix`: Keep one Example. Drive a public path that actually has comments to drop — e.g. `YamlFormat.formatToString("a: 1 # c\n", undefined, YamlFormattingOptions.make({ preserveComments: false }))` and observe the `#` is gone — or retitle to “Value stringify of a mapping contains no comment marker” and stop claiming a drop. Do not add a second Example.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: yaml-internal
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: none
- `status`: open
- `fixedCommit`: pending

### yaml-internal-R3-004: fold.ts Examples still assert tautological fragments

- `round`: 3
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: scratchpad/yaml/internal/fold.ts:34, scratchpad/yaml/internal/fold.ts:101, scratchpad/yaml/internal/fold.ts:226, scratchpad/yaml/internal/fold.ts:266, scratchpad/yaml/internal/fold.ts:322
- `symbol`: foldScalarLine, foldRenderedScalar, hasNewlineSpacesTab, renderSingleQuotedMultiline, renderBlockLiteral
- `kind`: value
- `evidence`: Round-2 closed `hasInteriorTrailingWhitespace` (`hi \\nthere`) and quote-escaping elsewhere. Remaining fold fences still cannot fail relative to their titles:
  - `foldScalarLine` (`lineWidth <= 0` is a no-op): stringify `"abcdefghij"` at `lineWidth: 0`, `includes("abcdefghij")`. The string has no safe break; even a positive width would keep the substring.
  - `foldRenderedScalar` (block-literal is never width-folded): **parse** of `a: |\n  keep this line whole\n` then `includes("keep this line whole")` — value parse, not width-fold.
  - `hasNewlineSpacesTab` (quoted style can still carry mixed whitespace): `JSON.stringify(value).includes("x")` — true of any successful parse of that document.
  - `renderSingleQuotedMultiline` (multi-line single-quoted value): `console.log(Effect.runSync(Yaml.parse("a: 'hello\n  world'\n")))` with no expected result and no fold-to-space observation.
  - `renderBlockLiteral` (block literal preserves newlines): `JSON.stringify(value).includes("hello")` — true if newlines were folded to spaces. Compare `renderBlockFolded`, which honestly asserts `includes("hello world")`.
- `impact`: Vacuous Examples hide the renderer/predicate contracts. Mixed-whitespace, no-op width, and newline preservation are the facts the implementation comments exist to warn about.
- `suggestedFix`: One Example each. Observe the claimed bytes: a long spaced string that stays unwrapped at `lineWidth: 0` vs wraps at a tight positive width; stringify (not parse) a `|` body that would wrap if folded; `JSON.stringify` of `"x\\n \\ty"` (space-then-tab after newline); single-quoted fold-to-space `{ a: "hello world" }`; block-literal `includes("hello\\nworld")`. Do not add extra Examples.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: yaml-internal
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: yaml-internal-R3-003
- `status`: open
- `fixedCommit`: pending

### yaml-internal-R3-005: hasBlockMapAfterInList still titles sibling-first-key

- `round`: 3
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P2-medium
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: scratchpad/yaml/internal/composer/scalars.ts:845
- `symbol`: hasBlockMapAfterInList
- `kind`: value
- `evidence`: Round-2 retitled `cstEvents` / `composeBlockMap` off “sibling-first-key” because the public fence is a value parse. This owning export still titles “Sibling-first-key nested mapping” and runs `Yaml.parse("outer:\n  name: John\n")` → `{ outer: { name: "John" } }`. That result looks the same if the helper did not exist.
- `impact`: The leftover sibling-first-key phrase on the hover title re-opens the CST/composer seam round-2 closed on the neighboring exports.
- `suggestedFix`: Retitle to the observable public job (parse a nested one-pair mapping). Leave the CST pattern in the lead/Gotchas. Do not add a second Example.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: yaml-internal
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: none
- `status`: open
- `fixedCommit`: pending

### yaml-internal-R3-006: checkDuplicateKeys Example lints; the title says default parse

- `round`: 3
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: scratchpad/yaml/internal/composer/block.ts:1358
- `symbol`: checkDuplicateKeys
- `kind`: value
- `evidence`: Title: “Duplicate keys fail the **default parse**.” Fence: `YamlLint.run("a: 1\na: 2\n", … { "key-duplicates": "error" })` then `hits.some((d) => d.rule === "key-duplicates")`. Default `Yaml.parse` / `Yaml.parseResult` already fails this input with `YamlParseError` / `DuplicateKey` (the public `YamlParseError` Example). Lint `key-duplicates` is a different channel; compose under lint uses `uniqueKeys: false` so `parse-validity` does not double-report.
- `impact`: Hover equates engine duplicate-key parse failure with the configurable lint rule. A caller who “fixes” parse by turning `key-duplicates` off still hits `YamlParseError` under default `uniqueKeys`.
- `suggestedFix`: Keep one Example. Drive `Yaml.parseResult("a: 1\na: 2\n")` and read `DuplicateKey`, matching the public parse-error Example — or retitle to the lint observation the fence actually runs.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: yaml-internal
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: none
- `status`: open
- `fixedCommit`: pending

### yaml-internal-R3-007: Comment helpers claim keep-chomp / `#` vs `# ` and do not observe them

- `round`: 3
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P2-medium
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: scratchpad/yaml/internal/composer/comments.ts:179, scratchpad/yaml/internal/composer/comments.ts:245, scratchpad/yaml/internal/composer/comments.ts:314
- `symbol`: blankLineAboveStart, blankAboveIsKeepChompContent, rawCommentText
- `kind`: value
- `evidence`: Gotchas correctly warn that a keep-chomp blank is value (not `spaceBefore`) and that `rawCommentText("#")` vs `"# "` are distinct because `""` is reserved. Fences:
  - `blankLineAboveStart` title “Used to decide keep-chomp content vs style”: `formatToString("a: |+\n  keep\n\n").includes("|+")` — header survival, not content-vs-style.
  - `blankAboveIsKeepChompContent` title “Keep-chomp trailing blank is value”: parse then `JSON.stringify(value).includes("keep")` — true under clip as well; the trailing newlines are unasserted.
  - `rawCommentText` title “Bare `#` and spaced `# ` both round-trip”: both sides `includes("#")`, which cannot distinguish `#` from `# ` if the renderer canonicalized them.
- `impact`: The reserved-empty-string and keep-chomp double-count rules the implementation comments exist to warn about stay invisible. A format pass that grew a keep-chomp document would still print `keep`.
- `suggestedFix`: One Example each. Observe keep-chomp as value (`JSON.stringify` includes `keep\\n\\n`, or format does not grow the document) and observe `#` vs `# ` as distinct bytes (`includes("#\\n")` vs `includes("# \\n")`, or exact `formatToString` equality). Do not add extra Examples.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: yaml-internal
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: yaml-internal-R3-004
- `status`: open
- `fixedCommit`: pending

### yaml-internal-R3-008: parseDirective Example is the TAG-leak check, not directive-line parsing

- `round`: 3
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P2-medium
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: scratchpad/yaml/internal/composer/tags.ts:85
- `symbol`: parseDirective
- `kind`: value
- `evidence`: Lead: “Parse a `%NAME args` directive line into a raw name/parameters record.” Gotchas: trailing `#` comments on the directive line are stripped from parameters. Title/fence: “Document-local `%TAG` does not leak across `---`” / `Yaml.parseAllResult("%TAG !e! …\n---\n!e!foo: 1\n")` is failure — copied from `validateTagHandlesInDocument` / `validateCrossDocumentDirectives`. The fence never shows a parsed `{ name, parameters }` or comment-stripped args.
- `impact`: Hover for the directive-line parser teaches the sibling QLJ7 handle check. Callers looking for parameter/comment stripping will not find it.
- `suggestedFix`: Retitle and rewrite the fence to a public observation `parseDirective` can honestly own (a `%YAML 1.2` document parses; or keep the TAG-leak fence only on `validateTagHandlesInDocument`). If the pack still forbids importing internals, do not claim comment-stripping in the title unless the public fence shows it. Do not add a second Example.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: yaml-internal
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: none
- `status`: open
- `fixedCommit`: pending

## Pack verdict

- files reviewed: 48
- owning exports reviewed: 263
- confirmed mechanical items: 0
- editorial items: 10
- rejected false positives: 6
- accepted findings: 10
