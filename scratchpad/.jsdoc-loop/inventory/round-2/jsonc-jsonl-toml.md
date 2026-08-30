# Packs jsonc / jsonl / toml — round 2 independent JSDoc review

- `round`: 2
- `reviewer`: jsdoc-annotation-specialist
- `scope`: `scratchpad/jsonc/`, `scratchpad/jsonl/`, `scratchpad/toml/`
- `law`: `.patterns/jsdoc-documentation.md`, `.agents/skills/jsdoc-annotation-specialist/references/conventions.md`, `.agents/skills/jsdoc-annotation-specialist/references/annotation-patterns.md`
- `census`: mechanical opens are 0; this pass is editorial residual only

Kit-ports of `@effected/{jsonc,jsonl,toml}`. Public example fences import `@beep/scratchpad/<kit>`, never `@effected/*`. Runtime identity strings (`~effected/jsonl/JsonlEvent`, `assertCap`'s `@effected/toml` TypeError) are not findings.

## jsonc

### jsonc-R2-001: Exported schemas still lack `$I.annote` / `$I.annoteSchema`

- `round`: 2
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P2-medium
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .agents/skills/jsdoc-annotation-specialist/references/annotation-patterns.md
- `affectedFiles`: jsonc/Jsonc.ts:53, jsonc/Jsonc.ts:92, jsonc/Jsonc.ts:135, jsonc/Jsonc.ts:176, jsonc/Jsonc.ts:208, jsonc/Jsonc.ts:247, jsonc/Jsonc.ts:279, jsonc/JsoncEdit.ts:41, jsonc/JsoncEdit.ts:75, jsonc/JsoncEdit.ts:138, jsonc/JsoncFingerprint.ts:66, jsonc/JsoncFingerprint.ts:114, jsonc/JsoncFingerprint.ts:148, jsonc/JsoncModifier.ts:64, jsonc/JsoncNode.ts:61, jsonc/JsoncNode.ts:109
- `symbol`: JsoncParseErrorCode, JsoncParseErrorDetail, JsoncParseError, JsoncParseOptions, JsoncStringifyErrorCode, JsoncStringifyOptions, JsoncStringifyError, JsoncRange, JsoncFormattingOptions, JsoncEdit, JsoncCanonicalizeErrorCode, JsoncCanonicalizeError, JsoncTextHashOptions, JsoncModificationError, JsoncNodeType, JsoncNode
- `kind`: value
- `evidence`: Round-1 jsonc inventory rejected `$I` because “scratchpad jsonc has no package `$I` composer.” That premise is now false: sibling kits in this same package (`jsonl`, `toml`, `yaml`, `glob`, `schemastore`) wire `const $I = $ScratchpadId.create("…")` from `@beep/identity` and annotate every exported `Schema.Class` / `TaggedError` / `Literals`. jsonc still uses bare `Schema.Literals(...)`, `Schema.Class<X>("X")`, and `Schema.TaggedError<X>()("X", …)` with no `$I`. Same-name type aliases already exist for the Literals schemas.
- `impact`: When this kit lands as a beep package, schema identity / JSON-schema titles stay unnamespaced while every neighboring scratchpad codec already carries them. `TaggedError()` with a bare identifier equal to the tag is the annotation-patterns anti-pattern.
- `suggestedFix`: In each schema file, `import { $ScratchpadId } from "@beep/identity"`, `const $I = $ScratchpadId.create("jsonc/<File>")`, then `$I.annote` on Class/TaggedError and `$I.annoteSchema` on Literals. Do not invent extra same-name aliases. Do not change `_tag` strings.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: jsonc
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: none
- `status`: open
- `fixedCommit`: pending

### jsonc-R2-002: `JsoncFormatter` Example is tautological and does not show formatted text

- `round`: 2
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P2-medium
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: jsonc/JsoncFormatter.ts:24
- `symbol`: JsoncFormatter
- `kind`: value
- `evidence`: The titled Example runs `format` then `JsoncEdit.applyAll`, `console.log(formatted)` with no expected value, then asserts `formatted === JsoncFormatter.formatToString(text) // true`. `formatToString` is implemented as `applyAll ∘ format`, so the only assertion is an identity. The actual job — compact `'{"a":1,"b":2}'` becoming pretty-printed JSONC — is never observed.
- `impact`: A caller cannot tell from the Example what canonical formatting looks like, or that `format` is total on already-formatted / malformed input.
- `suggestedFix`: Keep one titled Example. Log the formatted document (`console.log(formatted)` with the pretty-printed expected text, or an `includes`/`startsWith` observation). Optionally keep `formatToString` as a one-line equality only if the formatted text is already shown. Do not add a second Example.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: jsonc
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: none
- `status`: open
- `fixedCommit`: pending

### jsonc-R2-003: `JsoncNode` walkers silently bound hand-built trees — Gotcha lives only in comments

- `round`: 2
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P2-medium
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: jsonc/JsoncNode.ts:73, jsonc/JsoncNode.ts:173, jsonc/JsoncNode.ts:224
- `symbol`: JsoncNode
- `kind`: value
- `evidence`: Implementation comments at L224–228 and `evaluateNode` L290–293 already warn: parser-built trees are depth-capped, but a tree assembled via `JsoncNode.make` can nest past `MAX_NESTING_DEPTH`; walkers then return a bounded placeholder (`toValue` yields `{}` / `[]` / `null`, `findAtOffset` / `pathAt` stop descending) instead of overflowing. The owning `JsoncNode` block documents missing parent pointers and `make` vs `new`, not this contract.
- `impact`: A caller who `JsoncNode.make`s a deep fixture and trusts `toValue()` / `findAtOffset` as a total reconstruction will get a silently truncated value with no typed error.
- `suggestedFix`: Add **Gotchas** on `JsoncNode` (or `toValue`): parser trees cannot exceed the cap; hand-built trees past {@link MAX_NESTING_DEPTH} return placeholders, not a defect. Described `@see {@link MAX_NESTING_DEPTH}`. Do not add a second Example.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: jsonc
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: none
- `status`: open
- `fixedCommit`: pending

### jsonc-R2-004: `__proto__` own-property assignment is an implementation comment, not a Gotcha

- `round`: 2
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P2-medium
- `doctrineBucket`: cleanup-on-touch
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: jsonc/Jsonc.ts:389, jsonc/JsoncNode.ts:173, jsonc/internal/parser.ts:411, jsonc/JsoncNode.ts:304
- `symbol`: Jsonc, JsoncNode
- `kind`: value
- `evidence`: Parser L411–414 and `evaluateNode` L303–306 already warn that a `"__proto__"` key is defined as an own data property (JSON.parse / pollution-safe). The sibling TOML facade lifted the same fact into class **Gotchas**. jsonc `Jsonc` / `JsoncNode` docs never mention it.
- `impact`: Callers comparing this parser to a naive `obj[key] = value` walk will think a `__proto__` member mutates `Object.prototype`, or will “fix” the defineProperty into assignment.
- `suggestedFix`: One **Gotchas** sentence on `Jsonc` (parse / `parseResult`) and `JsoncNode.toValue`: `__proto__` is an own data property. Described `@see` is optional. Do not add Examples.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: jsonc
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: none
- `status`: open
- `fixedCommit`: pending

## jsonl

No accepted editorial residuals. Module headers, titled Examples, described `@see`, Gotchas lifted from implementation comments, `$I.annote` / `$I.annoteSchema`, and `@beep/scratchpad/jsonl` example imports all hold. `JsonlEventTypeId = "~effected/jsonl/JsonlEvent"` is a runtime brand, not an example import.

## toml

### toml-R2-001: `TomlFormat` class lead still restates “statics / not instantiable”

- `round`: 2
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P2-medium
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: toml/TomlFormat.ts:809
- `symbol`: TomlFormat
- `kind`: value
- `evidence`: Round-1 `toml-R1-006` / `toml-R1-021` required replacing the thin “Formatting and modification statics. Not instantiable.” lead with the purpose trapped in `@remarks`. The remarks moved into **Gotchas** (format is total; modify never creates tables / appends arrays), but the class lead is still exactly “Conservative TOML formatting and path-based modification statics. Not instantiable.” The module fileoverview already states the real purpose (non-mutating CST splices, multi-line strings untouchable).
- `impact`: Hover on the facade still reads as a constructor note. Callers choosing `format` vs `modify` vs `Toml.stringify` have to scroll past a signature echo into Gotchas.
- `suggestedFix`: Rewrite the lead around conservative, span-preserving format/modify (malformed `format` yields no edits; `modify` fails typed and never auto-creates). Leave Gotchas in place. Do not add a third Example (two titled Examples already exist).
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: toml
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: none
- `status`: open
- `fixedCommit`: pending

### toml-R2-002: Stringify/format expected comments over-escape quotes and newlines

- `round`: 2
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P2-medium
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: toml/Toml.ts:348, toml/Toml.ts:481, toml/TomlFormat.ts:830, toml/internal/stringifyValue.ts:111
- `symbol`: Toml.stringifyResult, Toml.bind, TomlFormat, renderKey
- `kind`: value
- `evidence`: Actual encode of `{ name: "Alice" }` is the characters `name = "Alice"` plus a newline. The internal `stringifyValue` Example records that correctly (`// 'name = "Alice"\n'`). Public fences disagree: `stringifyResult` uses `// "name = \"Alice\"\\n"` (newline written as two-char `\\n`); `Toml.bind` and the `TomlFormat` class Example use `// "name = \\"Alice\\"\\n"` (quotes and newline both double-escaped). Same-file `TomlFormattingOptions` / `TomlStringifyOptions` Examples use the correct JS-literal form (`"name = \"Alice\"\r\n"`). `renderKey("has space")` comments `// "\\"has space\\""` instead of the printed `"has space"`.
- `impact`: A reader who runs the Example and compares console output will think stringify/format emit backslash-quote sequences or a literal `\n` pair. The pack already has the correct expected-comment grammar next door, so this is leftover conversion residue, not style.
- `suggestedFix`: Match `stringifyValue`'s expected comments: single-quoted source showing real `"` and a `\n` / `\r\n` escape, or the already-correct `TomlFormattingOptions` JS-literal form. One observation per fence; do not add Examples.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: toml
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: none
- `status`: open
- `fixedCommit`: pending

## Rejected (do not open)

- Extra titled Examples on `TomlFormat` (class already has format + modify), `TomlVisitor.visit` (class already has one), `Jsonc` / `Toml` / `TomlDocument` members, and `Line` statics. One owning-export Example is enough; member fences that already observe the job stay.
- `toml/index.ts` has no Example: the barrel has no owning value export. Lead + Details + `@packageDocumentation` + `@since 0.0.0` is the module-header law.
- Type-level companions without Examples (`JsoncBoundCodec`, `TomlBoundCodec`, Literals `.Type` aliases, `Slice` / `EnvelopeOf`, scanner `SyntaxKind`, …).
- Runtime `@effected/*` identity: `assertCap` TypeError message, `JsonlEventTypeId` (`~effected/jsonl/JsonlEvent`). Documented as runtime, not example imports.
- `JsoncParseError` `@see {@link parseValue}`: described, and the purpose phrase already says the public API does not expose the recovery pair.
- `JsoncFingerprint.hash` / `hashText` without a runnable Crypto-provided Example: class Details already state `R` includes `Crypto.Crypto` and keep canonicalize as the observable Example.
- Named `Schema` from root `"effect"` in `Toml.bind` (`import { Effect, Schema } from "effect"`). Conventions allow named imports from root `effect`; sibling `fromString` / `schema` fences already use `import * as S from "effect/Schema"`. Not a caller-confusion defect on its own.
- Thin “Not instantiable.” sentences that continue with a useful purpose (`Jsonc`, `JsoncFingerprint`, `JsoncModifier`, `JsoncVisitor`). Only `TomlFormat` is a lead that is *only* that restatement.
- `$I` on `Data.taggedEnum` visitor events (`JsoncVisitorEvent`, `TomlVisitorEvent`) and on non-schema facades (`Jsonc`, `Toml`, `Journal`). Annotation-patterns cover Schema Class / TaggedError / Literals / Union, not Data enums.
- Taste-only lead polish on `JournalReadError` / `AppendOptions` after the round-1 rewrite.

## Pack verdict

- files reviewed: 39 (jsonc 13, jsonl 11, toml 15)
- owning exports reviewed: 193 (jsonc 55, jsonl 46 including the `EnvelopeFrame` same-name alias, toml 92)
- confirmed mechanical items: 0
- editorial items: 6
- rejected false positives: 10
- accepted findings: 6

Every exporting module and every owning export in the three packs was reviewed. Barrel re-exports were not treated as documentation subjects. jsonl is clean (accepted findings: 0). jsonc and toml still have residual editorial defects listed above. Mechanical census opens were not re-opened.
