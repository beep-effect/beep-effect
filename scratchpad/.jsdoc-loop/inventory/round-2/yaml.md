# Packs yaml-public + yaml-internal — round 2 inventory

- reviewer: jsdoc-annotation-specialist (independent of round 1)
- scope: everything under `scratchpad/yaml/`
- census: yaml-public 11 modules / 80 owning; yaml-internal 37 modules / 183 owning; opens = 0

Mechanical census is confirmed closed. Zero `@example` / `@remarks` / `@module` / `@template` tags remain. Every `@see` has a purpose phrase. Every `@category` is a canonical kebab role. Public Examples import `@beep/scratchpad/yaml`, not `@effected/*`.

This round does **not** re-open closed tag misses, the internal public-facade Example import constraint (documented as residual risk in round-1 fixer reports), R1-prescribed “Decoded literal union produced by …” type-companion leads, or taste-only extra Examples.

## Rejected (not re-opened)

- Internal value Examples that proxy through `@beep/scratchpad/yaml` **and still observe the named contract** (rule `YamlLint.run` hits, `Yaml.equals` NaN/key-order, `makeAlias` defined-vs-dangling, `createState` `maxAliasCount: 0` failure). Round-1 pack constraint.
- `$I.annoteSchema` on internal lint option schemas (R1-063 residual). Hunt list this round is editorial Examples/leads/Gotchas/see/category/legacy carriers; public files already have `$ScratchpadId`.
- `@effected/jsonc` in **prose** (`YamlDiagnostic` five-field parity, `YamlEdit` field names) — not example fences.
- Method-level Examples that duplicate a class Example (`YamlTokens.tokenize`, `YamlFormat.format` vs class).
- Extra Examples on `QuoteStyle` / `ScalarChomp` that already `S.is` both ways.

## Items

### yaml-public-R2-001: YamlParseError lead says fatal-only; Example uses non-fatal DuplicateKey

- `round`: 2
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: scratchpad/yaml/Yaml.ts:211
- `symbol`: YamlParseError
- `kind`: value
- `evidence`: Lead: “aggregates every **fatal** {@link YamlDiagnostic} encountered”. Example (Construct a parse error and read the code) uses `Yaml.parseResult("a: 1\na: 2\n")` and asserts `diagnostics[0]?.code === "DuplicateKey"`. `DuplicateKey` is **not** in `FATAL_CODES`; `YamlDiagnostic.isFatal("DuplicateKey")` is false. `failureRecords` (Yaml.ts:476) promotes DuplicateKey **warnings** to parse failure when `uniqueKeys` is in force. `Yaml.parseResult` method prose already lists “Fatal diagnostics, duplicate keys and a billion-laughs blow-up”; that promotion never landed on the error class.
- `impact`: A caller filtering `error.diagnostics` with `YamlDiagnostic.isFatal` drops the only code the Example teaches them to read. Hover says “fatal batch”; the Example proves the opposite.
- `suggestedFix`: Rewrite the class lead to “fatal codes plus DuplicateKey promotions when `uniqueKeys` is true”. Add **Gotchas**: `isFatal("DuplicateKey")` is false; the facade still fails parse. Keep the Example; it is the right observation once the lead matches.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: yaml-public
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: none
- `status`: open
- `fixedCommit`: pending

### yaml-public-R2-002: AliasExpansionBudgetExceeded Example contradicts its title

- `round`: 2
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: scratchpad/yaml/YamlNode.ts:822
- `symbol`: AliasExpansionBudgetExceeded
- `kind`: value
- `evidence`: Gotchas correctly say callers of `Yaml.parse` never see this class — the facade maps it to `AliasCountExceeded`. Title: “Public parse maps the budget blow-up to AliasCountExceeded”. Fence:

  ```ts
  const parsed = Yaml.parseResult("a: &x 1\nb: *x\n")
  console.log(Result.isSuccess(parsed)) // true
  ```

  That input is one defined alias under the default budget of 100. It never throws, never yields `AliasCountExceeded`, and never mentions this class. Compare `createState`'s Example, which uses `maxAliasCount: 0` on the same shape and correctly asserts failure.
- `impact`: Hover teaches that a successful alias round-trip *is* the budget blow-up. Callers will not recognize `AliasCountExceeded` as the public mapping.
- `suggestedFix`: Keep the public-facade import (symbol is not barrel-exported). Replace the fence with a parse that actually trips the cap, e.g. `Yaml.parseResult("a: &id 1\nb: *id\n", YamlParseOptions.make({ maxAliasCount: 0 }))`, assert `Result.isFailure` and `diagnostics[0].code === "AliasCountExceeded"`. Do not present `new AliasExpansionBudgetExceeded` as a package entry point.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: yaml-public
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: none
- `status`: open
- `fixedCommit`: pending

### yaml-public-R2-003: YamlRange Example does not observe range restriction

- `round`: 2
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P2-medium
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: scratchpad/yaml/YamlEdit.ts:46
- `symbol`: YamlRange
- `kind`: value
- `evidence`: Title: “Make a range and restrict formatting”. Fence makes `{ offset: 0, length: 4 }`, calls `YamlFormat.format("a: 1\nb: 2\n", range)`, then logs `range.length // 4` (echo of the constructor) and `Array.isArray(edits) // true` (always true). Nothing compares ranged vs full-document edits.
- `impact`: A caller cannot tell from the Example that the range argument does anything. Vacuous observation bar.
- `suggestedFix`: Keep one titled Example. Assert a property of restriction, e.g. ranged format of the first line leaves `"b: 2\n"` intact while a full format may rewrite both, or compare `format(text, range)` vs `format(text)` lengths/offsets. Drop the constructor-echo `range.length` log.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: yaml-public
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: none
- `status`: open
- `fixedCommit`: pending

### yaml-public-R2-004: YamlFormattingOptions leftover “module-level remarks”

- `round`: 2
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P2-medium
- `doctrineBucket`: cleanup-on-touch
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: scratchpad/yaml/YamlFormat.ts:49
- `symbol`: YamlFormattingOptions
- `kind`: value
- `evidence`: Lead still says “see the module-level **remarks** on the `range` parameter vs. this field”. `@remarks` was converted in R1; no module remarks section remains. The positional-`range`-wins-over-`options.range` contract now lives on `YamlFormat` **Gotchas** (line 523) and `format` method Gotchas.
- `impact`: Hover points at a retired carrier. Callers looking for the range-precedence rule will not find “remarks”.
- `suggestedFix`: Replace the sentence with a `{@link YamlFormat.format}` pointer: positional `range` wins over `options.range`. Do not reintroduce `@remarks`.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: yaml-public
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: none
- `status`: open
- `fixedCommit`: pending

### yaml-public-R2-005: YamlParseOptions Example does not bound alias expansion

- `round`: 2
- `reviewer`: jsdoc-annotation-specialist
- `label`: suggestion
- `blockingStatus`: blocking
- `severity`: P2-medium
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: scratchpad/yaml/Yaml.ts:47
- `symbol`: YamlParseOptions
- `kind`: value
- `evidence`: Title: “Bound alias expansion while parsing”. Fence: `YamlParseOptions.make({ maxAliasCount: 50 })` then `Yaml.parseResult("a: 1", options)` success `{ a: 1 }`. Alias-free input cannot trip the DoS guard. The sibling `createState` Example already shows the firing shape (`maxAliasCount: 0` + one defined alias → failure).
- `impact`: Callers think passing `maxAliasCount` is demonstrated by a successful no-alias parse. The option’s actual job is invisible.
- `suggestedFix`: Keep `.make` (never `new`). Parse a document with a defined alias under a tight cap and observe `AliasCountExceeded`, or retitle to “Construct parse options” if the bound is documented only on `Yaml` Gotchas. One Example is enough.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: yaml-public
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: yaml-public-R2-002
- `status`: open
- `fixedCommit`: pending

### yaml-internal-R2-001: parseCSTAll Example inverts the CST no-interpretation contract

- `round`: 2
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: scratchpad/yaml/internal/cst-parser.ts:1107
- `symbol`: parseCSTAll
- `kind`: value
- `evidence`: Lead: “No value interpretation occurs at this stage — `true` is still the string `"true"`.” Title: “`true` is still a scalar at the CST layer”. Fence: `Effect.runSync(Yaml.parse("true\n")) // true` (JavaScript boolean). That is the **composer/value** path, the opposite of the CST contract. `CstNode` / module header repeat the same “still `"true"`” sentence.
- `impact`: The most surprising CST fact is taught backwards. A caller using this Example to understand `parseCSTAll` will think CST already resolves Core Schema booleans.
- `suggestedFix`: Public-facade proxy cannot show CST `source === "true"`. Either (a) retitle and rewrite the fence to a claim `Yaml.parse` can honestly observe without inverting the lead (then move the `"true"` sentence off the Example), or (b) keep the title and drop the value-parse fence in favor of prose + `{@link CstNode}` — do not leave a fence whose `// true` contradicts the lead. Do not import internal paths if the pack still forbids that.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: yaml-internal
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: none
- `status`: open
- `fixedCommit`: pending

### yaml-internal-R2-002: Sibling-first-key Examples never show the sibling-key CST shape

- `round`: 2
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P2-medium
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: scratchpad/yaml/internal/cst-visitor.ts:639, scratchpad/yaml/internal/composer/block.ts:88
- `symbol`: cstEvents, composeBlockMap
- `kind`: value
- `evidence`: `cstEvents` Gotchas: for `name: John` the first key is a sibling scalar before the block-map, rewritten as `CstKeyEvent` (`source` is `name`). Example title “Sibling-first-key mapping still parses” runs `Yaml.parse("name: John\n")` → `{ name: "John" }` — value parse, no CST events. `composeBlockMap` documents the CST pattern `[flow-scalar("a"), block-map(...)]` then Examples `Yaml.parse("a: 1\n")` → `{ a: 1 }`. Same shape miss on both owning exports.
- `impact`: The most surprising CST/composer seam in the pack is on the hover Gotchas and then contradicted by a successful value parse that would look the same if the sibling-key rewrite did not exist.
- `suggestedFix`: Retitle both Examples to the observable public job they actually run (parse a one-pair mapping), or replace with a public observation that depends on the sibling-key rewrite (there may be none — then do not claim “sibling-first-key” in the title). Do not add a second Example.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: yaml-internal
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: yaml-internal-R2-001
- `status`: open
- `fixedCommit`: pending

### yaml-internal-R2-003: computeEdits Example is tautological and misses the skeleton/LF Gotchas

- `round`: 2
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: scratchpad/yaml/internal/diff.ts:45
- `symbol`: computeEdits
- `kind`: value
- `evidence`: Gotchas correctly warn: not a general diff; LF-only; unrelated strings collapse to one coarse middle edit. Title: “One-line value change vs unrelated strings”. Fence:

  ```ts
  const edits = YamlFormat.format("a: 1\nb: 2\n")
  console.log(edits.length === 0 || edits.every((e) => e.length >= 0)) // true
  console.log(YamlFormat.formatToString("a: 1\n").includes("a:")) // true
  ```

  No one-line value change, no unrelated-string collapse. `e.length >= 0` is always true. `includes("a:")` is true of the input.
- `impact`: The LF/skeleton contract the implementation comments exist to warn about is invisible. A caller feeding CRLF or unrelated strings gets a coarse edit with no hover demonstration.
- `suggestedFix`: Drive the public formatter so the observation is real: format a one-field value change and log edit offset/content, and/or format two unrelated documents and show a single spanning edit. Drop the tautological `length >= 0` / `includes("a:")` lines.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: yaml-internal
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: none
- `status`: open
- `fixedCommit`: pending

### yaml-internal-R2-004: builtinOptionsSchemas Example shows a valid config, not a typo failure

- `round`: 2
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: scratchpad/yaml/internal/rules/catalog.ts:86
- `symbol`: builtinOptionsSchemas
- `kind`: value
- `evidence`: Title: “Built-in option typos fail at config construction”. Fence: `YamlLintConfig.make({ rules: { "line-length": { max: 80 } } })` then `console.log(config.rules["line-length"])` — a **valid** decode. Gotchas say a schema-less built-in would accept opaque options; the Example never misspells a key (`maxx`, `Max`) or asserts a throw/`SchemaError`.
- `impact`: Callers following the Example will believe typos are accepted. The pairing invariant the catalog exists to enforce is untested in the fence.
- `suggestedFix`: Keep one Example. `try/catch` (or `Schema.decodeUnknownResult` if shown with `import * as S from "effect/Schema"`) around `{ "line-length": { maxx: 80 } }` and observe construction failure. Do not log a successful `{ max: 80 }` under a “typos fail” title.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: yaml-internal
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: none
- `status`: open
- `fixedCommit`: pending

### yaml-internal-R2-005: Stringifier/fold Examples assert tautological `includes(...)`

- `round`: 2
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P2-medium
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: scratchpad/yaml/internal/stringifier.ts:323, scratchpad/yaml/internal/stringifier.ts:388, scratchpad/yaml/internal/stringifier.ts:2004, scratchpad/yaml/internal/fold.ts:183
- `symbol`: renderDoubleQuoted, renderSingleQuoted, stringifyDocument, hasInteriorTrailingWhitespace
- `kind`: value
- `evidence`: Titles claim quote escaping / apostrophe doubling / interior trailing space / document stringify. Fences observe:

  - `renderDoubleQuoted`: `Yaml.stringify("say \"hi\"")` then `text.includes("hi")`
  - `renderSingleQuoted`: `Yaml.stringify("it's")` then `text.includes("it")`
  - `hasInteriorTrailingWhitespace`: parse `"hi \\nthere"` then `JSON.stringify(value).includes("hi")`
  - `stringifyDocument`: `doc.stringify().includes("a:")`

  None of those assertions can fail if stringify/parse merely echo the input fragment. They do not show `\"`, `''`, interior space-before-newline, or document-path (non-folding) stringify.
- `impact`: Vacuous Examples hide the actual renderer/predicate contracts. `includes("it")` is true of both `'it''s'` and `it's`.
- `suggestedFix`: One Example each. Observe the claimed bytes: double-quoted `\"`, single-quoted `''`, a parsed string that still contains ` \n`, document stringify equal to source (or `.includes("a: 1")` with a style that would change on the value path). Do not add extra Examples.
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
- rejected false positives: 5
- accepted findings: 10
