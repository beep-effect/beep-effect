# Packs jsonc / jsonl / toml — round 3 independent JSDoc review

- `round`: 3
- `reviewer`: jsdoc-annotation-specialist
- `scope`: `scratchpad/jsonc/`, `scratchpad/jsonl/`, `scratchpad/toml/`
- `law`: `.patterns/jsdoc-documentation.md`, `.agents/skills/jsdoc-annotation-specialist/references/conventions.md`, `.agents/skills/jsdoc-annotation-specialist/references/annotation-patterns.md`
- `census`: mechanical opens are 0/0; this pass is editorial residual only
- `prior`: round-2 jsonc/toml items were fixed (`fixed-jsonc-toml.md`); jsonl had zero accepted findings in round 2

Kit-ports of `@effected/{jsonc,jsonl,toml}`. Public example fences import `@beep/scratchpad/<kit>`, never `@effected/*`. Runtime identity strings (`~effected/jsonl/JsonlEvent`, `assertCap`'s `@effected/toml` TypeError) are not findings.

Round-2 closures verified on the live sources: `$I.annote` / `$I.annoteSchema` on exported jsonc schemas; `JsoncFormatter` observes pretty-printed text; `JsoncNode` class and `Jsonc` parse Gotchas cover depth-cap and `"__proto__"`; `TomlFormat` lead is purpose-first; stringify/format expected comments use the JS-literal grammar.

## jsonc

### jsonc-R3-001: `Jsonc.stringifyResult` expected comment is unquoted `\n`, unlike the formatter grammar next door

- `round`: 3
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P2-medium
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: jsonc/Jsonc.ts:674
- `symbol`: Jsonc.stringifyResult
- `kind`: value
- `evidence`: Default stringify is `JSON.stringify(value, null, 2)`. The titled Example logs `ok.success` with `// {\n  "port": 3000\n}`. That is not a JS string literal: a reader who runs the fence sees a real two-line pretty-print, not the two-character sequence `\n`. Round 2 closed the same residue on toml (`toml-R2-002`) by matching `stringifyValue`'s quoted form (`// 'name = "Alice"\n'`). Same-pack `JsoncFormatter` already uses that grammar (`// '{\n  "a": 1,\n  "b": 2\n}'`). Compact `JsoncStringifyOptions` (`// {"port":3000}`) is fine because the console line has no newline.
- `impact`: Hover on the Result twin — the method that actually produces the pretty-printed document — teaches a different expected-comment grammar than format/stringify siblings. Callers comparing console output to the comment will think stringify emits a literal backslash-n pair.
- `suggestedFix`: Quote the observation as a JS literal of the returned string: `console.log(ok.success); // '{\n  "port": 3000\n}'`. Keep the bigint failure line. Do not add a second Example.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: jsonc
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: none
- `status`: open
- `fixedCommit`: pending

### jsonc-R3-002: `Jsonc.equalsValue` / `Jsonc.equals` still hide the depth-cap contract that `deepEqual` comments warn about

- `round`: 3
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P2-medium
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: jsonc/Jsonc.ts:819, jsonc/Jsonc.ts:849, jsonc/Jsonc.ts:411
- `symbol`: Jsonc.equals, Jsonc.equalsValue
- `kind`: value
- `evidence`: Implementation comment on `deepEqual` (L411–414): over-deep comparison is “reachable via `equalsValue`, whose `value` side is an arbitrary caller-supplied structure”; past `{@link MAX_NESTING_DEPTH}` the walk returns `false` rather than overflowing. `equals` / `equalsValue` leads document only “malformed → false”, comments/key-order, and totality. Neither block has **Gotchas**. Parser-built values are already capped; a hand-built 256-deep fixture compared with `equalsValue` is silently unequal to itself. Same “Gotcha lives only in comments” shape as `jsonc-R2-003` (fixed on `JsoncNode`, never lifted here).
- `impact`: A caller who trusts `equalsValue` as structural equality on fixture objects nested past the package cap gets `false` with no typed error and no hover warning. `equals` of two parsed documents cannot hit this; `equalsValue` can.
- `suggestedFix`: Add **Gotchas** on `equalsValue` (and a sentence on `equals` if it shares the helper): past `{@link MAX_NESTING_DEPTH}` comparison returns `false` rather than overflowing; parser-produced JSONC never reaches the cap. Described `@see {@link MAX_NESTING_DEPTH}`. Do not add a second Example.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: jsonc
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: none
- `status`: open
- `fixedCommit`: pending

### jsonc-R3-003: `JsoncNode.toValue` Gotchas still omit the silent depth-cap placeholder

- `round`: 3
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P2-medium
- `doctrineBucket`: cleanup-on-touch
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: jsonc/JsoncNode.ts:250, jsonc/JsoncNode.ts:105
- `symbol`: JsoncNode.toValue
- `kind`: value
- `evidence`: Round-2 `jsonc-R2-003` allowed the depth-cap Gotcha on `JsoncNode` *or* `toValue`; the fixer put it on the class (parser trees cannot exceed the cap; `JsoncNode.make` trees past it yield `{}` / `[]` / `null` with no typed error). `toValue` already has **Gotchas**, but only the `"__proto__"` own-property sentence from `jsonc-R2-004`. Hover on `node.toValue()` — the method that actually returns the placeholder — does not mention truncation. `findAtOffset` / `pathAt` stop descending at the same cap and have no Gotchas either; class text names all three walkers.
- `impact`: Callers of the walker APIs read method hover, not the class block. They will treat `toValue()` as a total reconstruction of a `make`-built fixture and receive a silent `{}` / `[]` / `null`.
- `suggestedFix`: Add one **Gotchas** sentence on `toValue` (and optionally `findAtOffset` / `pathAt`): hand-built trees past `{@link MAX_NESTING_DEPTH}` return a bounded placeholder / stop descending, matching the class Gotchas. Do not add a second Example. Do not remove the class Gotchas.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: jsonc
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: jsonc-R2-003
- `status`: open
- `fixedCommit`: pending

## jsonl

No accepted editorial residuals. Module headers, titled Examples, described `@see`, Gotchas lifted from implementation comments (torn tail vs hole, empty `events: []`, asymmetric `canMerge`, BOM probe, bind-once layers, `Schema.Void` payloads), `$I.annote` / `$I.annoteSchema`, and `@beep/scratchpad/jsonl` example imports all hold. `JsonlEventTypeId = "~effected/jsonl/JsonlEvent"` remains a runtime brand.

## toml

Round-2 items are closed on the live sources: `TomlFormat` lead is conservative span-preserving format/modify; stringify/format/bind/formatToString/`renderKey` expected comments match `stringifyValue` (`// 'name = "Alice"\n'`, `// '"has space"'`); `TomlFormattingOptions` keeps the quoted CRLF JS-literal. No new editorial residual that cites law or a concrete caller-confusion risk.

## Rejected (do not open)

- Re-opening `jsonc-R2-001`…`jsonc-R2-004` or `toml-R2-001`/`toml-R2-002` as still-open mechanical/editorial misses. Closures match the live files.
- Extra titled Examples on `TomlFormat` (class already has format + modify), `Jsonc` Effect twins (`parse` / `parseTree` / `stringify` defined in terms of `*Result`), `JsoncFromString` / `TomlFromString`, `JsoncFingerprint.hash` / `hashText` (class Details already state `R` includes `Crypto.Crypto`).
- Member `@since` present on some statics (`equals`) and absent on Effect twins / `JsoncFromString`. Census owning-export law; not a new hover defect.
- Type-level companions without Examples (`JsoncBoundCodec`, `TomlBoundCodec`, Literals `.Type` aliases, `Slice` / `EnvelopeOf`, scanner `SyntaxKind`, …).
- Runtime `@effected/*` identity: `assertCap` TypeError message, `JsonlEventTypeId`.
- `$I` on `Data.taggedEnum` visitor events (`JsoncVisitorEvent`, `TomlVisitorEvent`) and non-schema facades (`Jsonc`, `Toml`, `Journal`). Annotation-patterns cover Schema Class / TaggedError / Literals / Union.
- Internal example relative depths (`../../jsonc/...` vs `../../../toml/...`). `@internal` symbols are skipped by docgen extraction; public fences use `@beep/scratchpad/<kit>`. Round-1 residual, not new caller confusion on the public API.
- `Toml.bind` named `Schema` from root `"effect"`. Conventions allow named imports from root `effect`.
- `Journal` `fs.watch` arming-yield heuristic (`HONEST LIMITATION` in `supervise`). Maintainer comment, not a public contract; `JournalConfig` already documents directory derivation.
- Nested non-exported Literals (`JsoncModificationError.expected`, `TomlFormattingOptions.newline`).
- Taste-only lead polish and extra `**When to use**` padding.

## Pack verdict

- files reviewed: 39 (jsonc 13, jsonl 11, toml 15)
- owning exports reviewed: 193 (jsonc 55, jsonl 46 including the `EnvelopeFrame` same-name alias, toml 92)
- confirmed mechanical items: 0
- editorial items: 3
- rejected false positives: 12
- accepted findings: 3

Every exporting module and every owning export in the three packs was reviewed. Barrel re-exports were not treated as documentation subjects. jsonl remains clean (accepted findings: 0). toml round-2 closures hold (accepted findings: 0). jsonc still has three residual editorial defects listed above. Mechanical census opens were not re-opened.
