# Packs yaml-public + yaml-internal — round 4 inventory

- reviewer: jsdoc-annotation-specialist (independent of rounds 1–3)
- scope: everything under `scratchpad/yaml/`
- census: yaml-public 11 modules / 80 owning; yaml-internal 37 modules / 183 owning; opens = 0

Mechanical census is confirmed closed. Zero `@example` / `@remarks` / `@module` / `@template` tags remain. Every `@see` has a purpose phrase. Every `@category` is a canonical kebab role. Round-3 yaml findings are closed in source (`StyleConflict` candidates disagree; `StyleEvidence.combine` keeps both quote spellings; nesting overflow stringifies a 257-deep array; `createState` default alias budget vs `maxAliasCount: 0`; `stripNodeComments` formats source that carries `#`; fold fences observe width no-op vs wrap, `|` not folded, mixed whitespace bytes, single-quoted fold-to-space, block-literal newlines; `hasBlockMapAfterInList` retitled; `checkDuplicateKeys` is default `Yaml.parseResult` / `DuplicateKey`; keep-chomp format is idempotent and value keeps both trailing newlines; `#` vs `# ` are distinct bytes; `parseDirective` is a `%YAML 1.2` document).

This round does **not** re-open closed tag misses, the internal public-facade Example import constraint, R1 type-companion “Decoded literal union produced by …” leads, method-level Examples that duplicate a class Example, `$I.annoteSchema` on internal lint option schemas, `@effected/jsonc` in prose, or taste-only extra Examples.

## Rejected (not opened)

- Internal value Examples that proxy through `@beep/scratchpad/yaml` **and still observe the named contract** (`makeAlias` defined-vs-dangling, `registerAnchor` last-write-wins, `Yaml.equals` NaN/key-order, `YamlLint.run` hits, `computeEdits` one-line modify, comment-preserving `formatToString` that would fail if comments were dropped, `rawCommentText` `#\n` vs `# \n`, `blankAboveIsKeepChompContent` `keep\\n\\n`).
- `AliasExpansionBudgetExceeded` still trips the composer’s per-token `maxAliasCount` cap rather than the expansion-walk throw (round-2 residual; unobservable from the barrel).
- Extra Examples on `QuoteStyle` / `ScalarChomp` / method `YamlTokens.tokenize` / `YamlFormat.format`.
- Options-schema Examples that only construct and echo a valid `YamlLintConfig` entry (including “Enable as an error” and siblings that `console.log` the constructed entry with no expected comment). Same family round 3 declined to open.
- `enterNesting` “Deep-but-legal nesting still parses” at three mapping levels. The stringify overflow lives on `MAX_NESTING_DEPTH` / `StringifyDepthExceeded`; a 3-level success is not a title/fence inversion of the 256 cap.
- `cstEvents` / `composeBlockMap` / `hasBlockMapAfterInList` one-pair public parses after the sibling-first-key retitle.
- Public owning exports (leads, Gotchas, fences, `$I.annote` / `$I.annoteSchema`) after the round-2/3 closures.

## Items

### yaml-internal-R4-001: Four titled Examples log a parse with no expected result

- `round`: 4
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: scratchpad/yaml/internal/composer/block.ts:1479, scratchpad/yaml/internal/composer/scalars.ts:513, scratchpad/yaml/internal/composer/scalars.ts:933, scratchpad/yaml/internal/composer/scalars.ts:967
- `symbol`: checkMultilineImplicitKeys, collectMultilineKey, blockMapStartsWithValueSep, hasValueSepThroughPlainScalars
- `kind`: value
- `evidence`: Each fence is `console.log(Effect.runSync(Yaml.parse(...)))` with no `// expected` and no assertion. Round 3 closed the same residue on `renderSingleQuotedMultiline` by requiring `{ a: "hello world" }`. Remaining:
  - `checkMultilineImplicitKeys` title “Explicit `?` key may span lines”: `"? hello\n  world\n: 1\n"`. The unique contract is that **implicit** multiline keys fail; the allowed explicit case is unlabelled and the reject is unshown.
  - `collectMultilineKey` title “Multi-line **implicit** key”: the same explicit `? hello` document. Title says implicit; fence is the `?` form.
  - `blockMapStartsWithValueSep` title “Empty-key mapping”: `"? : empty\n"` with no result.
  - `hasValueSepThroughPlainScalars` title “Explicit multi-line key still maps”: `"? multi\n  line\n: 1\n"` with no result.
- `impact`: Hover teaches that dumping an unlabeled parse *is* the contract. Callers cannot tell success from throw, implicit from explicit, or empty-key from a dropped pair. `collectMultilineKey` names the wrong key shape.
- `suggestedFix`: One Example each. Put the observable value on the log (`{ "hello world": 1 }`, `{ null: "empty" }` or whatever `Yaml.parse` actually yields). On `checkMultilineImplicitKeys` show an implicit multiline key failing, or retitle to the allowed explicit case. On `collectMultilineKey` drop “implicit” unless the fence is a plain `multi\n  line: 1` key. Do not add extra Examples.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: yaml-internal
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: none
- `status`: fixed
- `fixedCommit`: none (working tree)

### yaml-internal-R4-002: getBlockChomp Example does not retain a trailing newline

- `round`: 4
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: scratchpad/yaml/internal/composer/scalars.ts:193
- `symbol`: getBlockChomp
- `kind`: value
- `evidence`: Title: “Keep-chomp retains the trailing newline.” Fence: parse `"a: |+\n  keep\n"` then `JSON.stringify(value).includes("keep")`. Clip `|` of the same body also contains `"keep"`; clip already keeps exactly one trailing newline. Round 3 closed this exact `includes("keep")` tautology on `blankAboveIsKeepChompContent` by asserting `keep\\n\\n`. This sibling was not in that list and still uses the pre-fix assertion. Input `"a: |+\n  keep\n"` does not even distinguish keep from clip.
- `impact`: Hover equates keep-chomp with “the word keep survived.” Callers will not recognize extra trailing newlines as the keep indicator’s job.
- `suggestedFix`: Keep one Example. Parse a keep-chomp body with extra trailing blanks (`"a: |+\n  keep\n\n"`) and assert `JSON.stringify(value).includes("keep\\n\\n")`, matching `blankAboveIsKeepChompContent`. Do not add a second Example.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: yaml-internal
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: yaml-internal-R4-001
- `status`: fixed
- `fixedCommit`: none (working tree)

### yaml-internal-R4-003: Remaining comment helpers still assert tautological fragments

- `round`: 4
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P2-medium
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: scratchpad/yaml/internal/composer/comments.ts:120, scratchpad/yaml/internal/composer/comments.ts:278, scratchpad/yaml/internal/composer/comments.ts:338, scratchpad/yaml/internal/composer/comments.ts:357
- `symbol`: isAfterIndicatorOnly, hasBlankLineBelow, joinComments, columnAt
- `kind`: value
- `evidence`: Round 3 closed `blankLineAboveStart` / `blankAboveIsKeepChompContent` / `rawCommentText` by observing keep-chomp bytes and `#` vs `# `. Remaining comment-fidelity fences still cannot fail relative to their titles:
  - `isAfterIndicatorOnly` (“Sequence-entry comment stays with the item”): `formatToString("- # c\n  item\n").includes("# c")` — true if `# c` moved to document scope.
  - `hasBlankLineBelow` (“Blank after a comment run is stored, not dropped”): `includes("# a")` — true if the blank between `# a` and `b:` was dropped.
  - `joinComments` (“Consecutive own-line comments stay stacked”): `includes("# a")` — true if `# b` was dropped or unstacked.
  - `columnAt` (“Indented comment stays indented”): `includes("# inner")` — true if the comment was rewritten at column 0.
- `impact`: The node-level attribution and indent/stacking contracts the implementation comments exist to warn about stay invisible. A format pass that relocated or unindented the comment would still print the fragment.
- `suggestedFix`: One Example each. Observe the claimed bytes: `includes("- # c")`; `includes("# a\n\nb:")` (or exact `formatToString` equality); `includes("# a\n# b")`; `includes("  # inner")`. Do not add extra Examples.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: yaml-internal
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: yaml-internal-R4-002
- `status`: fixed
- `fixedCommit`: none (working tree)

### yaml-internal-R4-004: validateCrossDocumentDirectives Example is the TAG-leak check, not the `...` requirement

- `round`: 4
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P2-medium
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: scratchpad/yaml/internal/composer/document.ts:962
- `symbol`: validateCrossDocumentDirectives
- `kind`: value
- `evidence`: Lead: directives between documents must be preceded by `...`. Gotchas name both handle non-leak **and** the `...` rule. Title/fence: “Handle from document 1 is unresolved in document 2” / `Yaml.parseAllResult("%TAG !e! …\n---\n!e!foo: 1\n")` is failure — the same TAG-leak fence `validateTagHandlesInDocument` already owns (and that `parseDirective` was retitled off in round 3). The unique `...` placement check is never observed.
- `impact`: Hover for the stream-level placement validator teaches the sibling QLJ7 handle check. Callers looking for “directives between documents require `...`” will not find it.
- `suggestedFix`: Retitle and rewrite the fence to a public observation this function can honestly own (a `%TAG` between documents without `...` fails; or keep the TAG-leak fence only on `validateTagHandlesInDocument`). Do not add a second Example.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: yaml-internal
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: none
- `status`: fixed
- `fixedCommit`: none (working tree)

### yaml-internal-R4-005: Parse-failure Examples never read the named code

- `round`: 4
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P2-medium
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: scratchpad/yaml/internal/diagnostics.ts:48, scratchpad/yaml/internal/composer/anchors.ts:34
- `symbol`: YAML_PARSE_ERROR_CODES, checkAnchorOnAlias
- `kind`: value
- `evidence`: Titles name a specific code; fences only prove some failure:
  - `YAML_PARSE_ERROR_CODES` (“Tab indentation is a parse-stage fatal”): `Yaml.parseResult("a:\n\t- 1\n")` is failure, then `YamlDiagnostic.isFatal("TabIndentation")`. The predicate is independent of that parse; `diagnostics[0].code` is never read. A different fatal (`InvalidIndentation`, `UnexpectedToken`) still “passes”.
  - `checkAnchorOnAlias` (“Anchor on alias is a fatal parse”): `Result.isFailure(Yaml.parseResult("&a *b\n"))`. Gotchas say inspect `message` because `DuplicateAnchor` is reused on error vs warning. The fence never reads `DuplicateAnchor` or the message; dangling `*b` would fail as `UndefinedAlias` even if this helper did not exist.
- `impact`: Hover equates “some parse failure” with the named code. Callers filtering `error.diagnostics` by `TabIndentation` / `DuplicateAnchor` cannot tell from the Example whether that is what they will see.
- `suggestedFix`: Keep one Example each. After `Result.isFailure`, read `diagnostics[0]?.code` (`"TabIndentation"` / `"DuplicateAnchor"`), matching the public `YamlParseError` Example. Drop the tautological standalone `isFatal("TabIndentation")` unless it stays beside that code assertion. Do not add extra Examples.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: yaml-internal
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: none
- `status`: fixed
- `fixedCommit`: none (working tree)

### yaml-internal-R4-006: getLineStarts Example does not prove memo reuse

- `round`: 4
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P2-medium
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: scratchpad/yaml/internal/composer/state.ts:40
- `symbol`: getLineStarts
- `kind`: value
- `evidence`: Title: “Two lookups on the same string reuse the index.” Gotchas correctly warn the memo is process-global and keyed by reference equality. Fence: two `YamlDiagnostic.fromRaw` calls on `"a: 1\n"` at offset 2, then `a.line === b.line && a.character === b.character`. Equal positions are true of two independent scans of the same offset; reuse vs recompute is unobservable from the barrel (same public-proxy limit as `parseCSTAll` after round 2).
- `impact`: Hover teaches that equal `line`/`character` *is* the memo. Callers will not recognize the reference-keyed, process-global index the Gotchas exist to warn about.
- `suggestedFix`: Keep one Example. Retitle to the observable public job the fence actually runs (fromRaw derives the same `line`/`character` twice from one offset). Leave the memo identity rule in Gotchas. Do not add a second Example.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: yaml-internal
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: yaml-internal-R4-005
- `status`: fixed
- `fixedCommit`: none (working tree)

## Pack verdict

- files reviewed: 48
- owning exports reviewed: 263
- confirmed mechanical items: 0
- editorial items: 6
- rejected false positives: 8
- accepted findings: 6 (fixed: 6, open: 0)
