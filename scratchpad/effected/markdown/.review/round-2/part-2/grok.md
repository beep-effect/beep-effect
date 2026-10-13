I'll review this markdown slice against the pinned upstream oracle and the round-1 inventory, and report only new findings.Round 1 already inventoried this module. I’ll read the binding decisions and the post-fix diff, then look only for new issues in this slice.This is the part-2 slice. I’ll check whether the round-1 fixes in these files actually landed, then look for anything the green gates missed.The round-1 code-newline fix may disagree with how the serializer strips a terminator. I’ll probe that path before deciding whether it’s a new defect.I'll confirm the exact line cites in this slice, then emit the round-2 findings.### grok-2-1
- file: scratchpad/effected/markdown/internal/carriers.ts:77
- class: law   severity: required
- standard: standards/effect-laws-v1.md law 7; standards/effect-first-development.md EF-1; D5. Unfixed round-1 req-14. Port notes and the ledger still say these carriers await the schema migration.   evidence: `RawMarkdownError` (line 77) and `GuardExceeded` (line 165) still extend `Data.TaggedError`. `Data.TaggedError` has no schema. The native-runtime and effect-imports gates are constructor scans and do not flag it. `RawDiagnostic` (line 49) is an exported interface, and `GuardReason` (line 136) hand-spells `"NestingDepthExceeded"` beside `MARKDOWN_PARSE_ERROR_CODES`.
- failure: The engine’s cross-module errors still have TypeScript payloads and no executable schema, so they cannot decode, encode, or generate arbitraries.
- fix: Derive both directly from `S.TaggedError` with `$ScratchpadId` identities and annotated payloads. Make `RawDiagnostic` the schema payload and reuse the public parse-error code kit for `GuardReason`. Keep the tags, `name = "Error"`, messages, positional `new` constructors, and `isRawMarkdownError` / `isGuardExceeded`.

### grok-2-2
- file: scratchpad/effected/markdown/internal/inlineNode.ts:19
- class: law   severity: required
- standard: standards/effect-laws-v1.md law 1 (`import * as P from "effect/Predicate"` only). Same gate miss as round-1 req-24, which covered `rawInline.ts` and `inlineParser.ts` only.   evidence: `import { isString } from "effect/Predicate"` is the dual discriminator at line 103. `effect-imports` only normalizes the root `effect` barrel.
- failure: The inline-node constructor bypasses the `P` alias the rest of the module uses.
- fix: `import * as P from "effect/Predicate"` and call `P.isString`. Keep the dual signature.

### grok-2-3
- file: scratchpad/effected/markdown/internal/blockTypes.ts:20
- class: law   severity: required
- standard: standards/effect-laws-v1.md law 1. Same gate miss as req-24, this file was outside that item.   evidence: `import { isString } from "effect/Predicate"` is the dual discriminator in `makeBlockNode` at line 634.
- failure: The block-node constructor bypasses the `P` alias.
- fix: `import * as P from "effect/Predicate"` and call `P.isString`. Keep the dual signature.

### grok-2-4
- file: scratchpad/effected/markdown/internal/entityMap.ts:44
- class: effect-idiom   severity: required
- standard: standards/effect-laws-v1.md law 6; D5 (`HashMap` only); round-1 req-23 ruling that a `ReadonlyMap` facade over `HashMap` only evades the law. reject-4 rejected a native `Map` allowlist, not this repair.   evidence: `ENTITY_MAP` implements `size`/`get`/`has`/`keys`/`values`/`entries`/`forEach` by unwrapping `HashMap.get` through `O.getOrUndefined`. The only production reader is `entities.ts:55` (`ENTITY_MAP.get(body)`). It is not a package export. Coverage tests call the imitation methods.
- failure: The entity table is typed and implemented as a native map. Every named-entity lookup allocates an `Option` and unwraps it to `undefined`.
- fix: Export the `HashMap` directly. Decode with `HashMap.get`. Retarget `entityMap` coverage and the entity tests that assert `.get` / `.has`. Record the change under `native-runtime`. Do not restore `new Map`.

### grok-2-5
- file: scratchpad/effected/markdown/internal/blockRegistry.ts:58
- class: effect-idiom   severity: required
- standard: standards/effect-laws-v1.md law 6; D5; the req-23 anti-evasion ruling. reject-5 only profiled swapping this facade back to a native `Map`.   evidence: `constructTable` returns the same `ReadonlyMap` imitation. `BlockDialect.constructs` is `ReadonlyMap<BlockType, BlockConstruct>` at `blockTypes.ts:592`. The only production reader is `blockParser.ts:199` (`this.dialect.constructs.get(type)`). Coverage tests monkeypatch the shared dialect with `Object.assign`.
- failure: Block-construct lookup is a native-map facade. A missing construct is `undefined` from `.get` rather than `Option`.
- fix: Type `constructs` as `HashMap.HashMap<BlockType, BlockConstruct>`. Look up with `HashMap.get` and `O.getOrThrowWith(() => BlockParserError.make(...))`. Retarget the coverage tests and stop patching the shared dialect object.

### grok-2-6
- file: scratchpad/effected/markdown/internal/blockRegistry.ts:42
- class: schema   severity: required
- standard: standards/effect-first-development.md EF-12; D5 identity step. Round-1 req-22b required this metadata for `UnknownInlineDialectError` and did not list this class. reject-3 forbids restoring `TypeError`.   evidence: `UnknownBlockDialectError` is `S.TaggedError` with a bare `message: S.String` and no third-argument `$I.annote`. The repaired sibling at `inlineRegistry.ts:36-42` annotates the schema and the message field. The class is unexported. `blockDialect` throws it at line 183.
- failure: An unknown block dialect still fails as a tagged error whose schema and payload have no identity description.
- fix: Mirror `UnknownInlineDialectError`: annotate `message` and pass `$I.annote` as the third argument. Keep the tag and the message text.

### grok-2-7
- file: scratchpad/effected/markdown/internal/blockParser.ts:74
- class: schema   severity: required
- standard: standards/effect-first-development.md EF-12; the same field-annotation requirement as round-1 req-22a.   evidence: `BlockParserError` has a schema-level `$I.annote`, and `message` is still bare `S.String`. Thrown from the tip getter (line 193) and `constructOf` (line 201).
- failure: The block-parser error schema describes the class and leaves the only payload field without intent metadata.
- fix: Add an `annotate` plus `annotateKey` description on `message`. Keep the tag and the existing schema annotation.

### grok-2-8
- file: scratchpad/effected/markdown/internal/blockParser.ts:702
- class: schema   severity: required
- standard: standards/effect-laws-v1.md law 19; standards/effect-first-development.md EF-12b; D5. Round-1 req-26 is already done: `InlineDialectName` is a type alias of `blockRegistry.ts:56`. This spelling was not part of that fix.   evidence: `BlockParseOptions.dialect` is `S.Literals(["commonmark", "gfm"])`. The same two members are also `export type MarkdownDialect = "commonmark" | "gfm"` at `blockRegistry.ts:56` and `LiteralKit(["commonmark", "gfm"])` at `Markdown.ts:56`. Law 19 reserves `S.Literals` for an anonymous union that is never named.
- failure: One dialect domain has three spellings. Widening any one of them leaves the block-pass schema and the registry type behind.
- fix: Replace the `blockRegistry` type alias with a `LiteralKit` of the same name (the cycle-firewall home, same pattern as req-27). Use `S.optionalKey(MarkdownDialect)` in `BlockParseOptions`. Re-annotate that kit from `Markdown.ts` instead of declaring a second kit. Leave `InlineDialectName` as a type alias of it.

### grok-2-9
- file: scratchpad/effected/markdown/Mdast.ts:300
- class: schema   severity: required
- standard: standards/effect-laws-v1.md laws 17 and 19; EF-12b (`S.is` for a named domain). `FrontmatterFormat` became a `LiteralKit` under req-16.   evidence: `frontmatterTypes` is `HashMap.fromIterable<string, FrontmatterFormat>` of `["yaml","yaml"]`, `["toml","toml"]`, `["json","json"]`. Line 380 admits a frontmatter node when `O.getOrUndefined(HashMap.get(...)) !== undefined`. `FrontmatterFormat` at `MarkdownNode.ts:1723` is exactly those three literals, and its example already uses `S.is`.
- failure: The foreign frontmatter kinds restate `FrontmatterFormat` with `string` keys, so a typo still typechecks and a new format does not.
- fix: Delete the map. Admit with `S.is(FrontmatterFormat)(type)` and use `type` as the format.

### grok-2-10
- file: scratchpad/effected/markdown/MarkdownNode.ts:1467
- class: schema   severity: required
- standard: standards/effect-laws-v1.md law 17; EF-12b, which names `S.NonEmptyString` ahead of `S.makeFilter`. `S.NonEmptyString` is `Schema.ts:9138` in the Effect checkout (`String.check(isNonEmpty())`).   evidence: `MdxJsxAttribute` (line 1467), `MdxJsxFlowElement` (line 1575), and `MdxJsxTextElement` (line 1615) each reject an empty name with `S.makeFilter`. The field types are `S.String` and `S.NullOr(S.String)`. `mdx.test.ts:81` and `:84` only assert that `make` throws; `:453` only asserts decode failure.
- failure: A named non-empty-string constraint is an ad-hoc filter on three classes. The filter message is the only thing those tests do not pin.
- fix: Declare `MdxJsxName = S.NonEmptyString` with an identity annotation. Use it for `MdxJsxAttribute.name` and `S.NullOr(MdxJsxName)` on both elements. Shrink the two element filters to the fragment-with-attributes rule only. Record the issue-path change as `law:17`.

### grok-2-11
- file: scratchpad/effected/markdown/internal/entities.ts:46
- class: effect-idiom   severity: required
- standard: standards/effect-first-development.md EF-2; D5. Same class as round-1 req-35 (`scanDelims`), which did not cover this function.   evidence: `decodeEntity` returns `string | undefined` from the wrapper check (line 48), the named-entity miss (line 55), and the digit check (line 61). Callers `unescape.ts` and `internal/inlines/entity.ts` substitute the original source with `??`. This is an internal miss, not a mutable-list sentinel (`prev` / `next` / `parent` stay `undefined`).
- failure: A failed entity decode is a nullish union inside the decoder. The four green beep laws do not enforce EF-2.
- fix: Return `O.Option<string>`. After grok-2-4, the named branch is already `HashMap.get`. Callers use `O.getOrElse(decodeEntity(source), () => source)`. Retarget tests from `undefined` to `O.none()` / `O.some`. Record `law:EF-2`.

### grok-2-12
- file: scratchpad/effected/markdown/Mdast.ts:428
- class: bug   severity: required
- standard: D9; section 14. New evidence against the recorded code-newline deviation (`PORT_LEDGER.json` lab behaviour: append CRLF after a content-final CR; test `mdast.test.ts:124,138`). The original lost-newline bug stays fixed.   evidence: Reading only, no probe. Line 428 stores `` `${value}\r\n` `` when `value` ends in `\r`, so `"body\r"` is carried as `"body\r\r\n"` (`mdast.test.ts:130`). `stripFinalLineEnding` (`Mdast.ts:117-118`) removes that trailing `\r\n`, so `toMdast` returns `"body\r"`. `serializeCode` (`stringify.ts:978`) removes only one trailing `\n`, leaving content `"body\r\r"`. With no fence, lang, or meta, the indented path (`stringify.ts:980-989`) emits that extra CR. `preprocessLines` (`preprocess.ts:101-103`) treats every CR as a line break, and `addLine` only ever appends `\n`, so parser-produced code never contains `\r`. The other pinned rows end in `\n` or are empty, so they already take the `\n` branch.
- failure: `fromMdast` of a code value ending in CR stores a terminator `stringify` reads as content. Serializing that node emits one more CR than the foreign value had, and reparsing splits it into an extra line.
- fix: Always append `"\n"`. Change `stripFinalLineEnding` so it removes only a final `"\n"`. Change the test row `["body\r", "body\r\r\n"]` to `["body\r", "body\r\n"]`. Update the recorded deviation’s CRLF sentence in the central ledger. Leave the other pinned rows as they are.

### grok-2-13
- file: scratchpad/effected/markdown/MarkdownVisitor.ts:179
- class: perf   severity: backlog
- standard: D11. No measurement, and the walk stays linear.   evidence: Each container allocates `A.map(children, (child, index) => [child, index] as const)` before walking.
- failure: Every child walk builds a tuple array the same size as the child list.
- fix: Index the children in the loop without allocating the tuple array.

### grok-2-14
- file: scratchpad/effected/markdown/internal/inlineParser.ts:682
- class: perf   severity: backlog
- standard: D11. Round-1 req-17 already required the hoisted matcher; this is the remaining constant factor. No measurement.   evidence: `materializeInlineNode` is a module-scope `Match.type` (line 128) that returns a fresh closure per kind. Line 682 copies the node so `type` narrows, then calls that closure.
- failure: Every non-text inline pays a spread plus a closure allocation.
- fix: Narrow with a type predicate instead of the spread. Dispatch with `Match.discriminator("type")` and pass `position` and `materializeChildren` as arguments.

### grok-2-15
- file: scratchpad/effected/markdown/internal/blockParser.ts:373
- class: effect-idiom   severity: backlog
- standard: D9; EF-1. The none branch is unreachable on a well-formed tree, so this is not a demonstrated bug.   evidence: Line 373 and line 429 use `O.getOrThrow(O.fromUndefinedOr(parent|container.parent))`. The pinned oracle uses `parent ?? this.doc` (`blockParser.ts:342`) and `container.parent ?? this.doc` (`:399`). `inlineParser.ts:379` uses the same `O.getOrThrow`; the oracle returns `false` when `lastChild` is missing (`inlineParser.ts:254-257`). `O.getOrThrow` throws an untagged error.
- failure: A broken parent or tail invariant defects here. Upstream falls back to the document, or returns `false`.
- fix: Restore `?? this.doc` at the two block sites. At `inlineParser.ts:379`, return `false` when `lastChild` is missing.

### grok-2-16
- file: scratchpad/effected/markdown/Mdast.ts:347
- class: effect-idiom   severity: backlog
- standard: standards/effect-laws-v1.md law 21. Same shape as round-1 back-5, which named `FrontmatterResolver.ts:478` only.   evidence: `isRecord` is `P.isObjectKeyword(value) && !P.isFunction(value) && !A.isArray(value)`. `P.isObjectKeyword` is `(typeof === "object" && value !== null) || isFunction` (`Predicate.ts:1136`). `P.isObjectOrArray` is `typeof === "object" && value !== null` (`Predicate.ts:1038`). With `!A.isArray`, both accept the same values.
- failure: The foreign-node guard uses three predicates for a check one Effect helper already expresses.
- fix: `P.isObjectOrArray(value) && !A.isArray(value)`.

### grok-2-17
- file: scratchpad/effected/markdown/internal/blockTypes.ts:52
- class: schema   severity: backlog
- standard: standards/effect-laws-v1.md law 19. Law 19’s LiteralKit requirement is aimed at domains that need `.Enum`, `.is`, `$match`, or an annotated schema. These unions are type-level discriminators on mutable engine nodes and have no such consumer. Round 1 reviewed both files and left them as types.   evidence: `BlockType` (line 52, 14 members) and `InlineNodeType` (`inlineNode.ts:28`, 12 members) are hand-rolled named unions. They are not duplicates of a public schema.
- failure: Two named literal domains stay outside `LiteralKit`, so a typo’d kind is still a separate spelling from any future schema.
- fix: When a runtime consumer appears, replace each alias with a module-local `LiteralKit` and use `typeof Kit.Type` on the mutable nodes. Do that as behaviour-neutral type work, not as a schema migration of the engine nodes.

REQUIRED: 12
BACKLOG: 5
