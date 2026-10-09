### fable-1-1
- file: scratchpad/effected/markdown/internal/lineIndex.ts:281
- class: law   severity: required
- standard: D9 + EFFECTED_PORT_GOAL.md section 14 (deviation protocol); 2026-10-09 ruling: one ledger plus README deviation entry per module per systemic class (tagged errors)   evidence: Upstream __test__/hardening.test.ts:193-194 asserts `assert.throws(() => LineIndex.fromLineStarts("abc", [1, 2]), TypeError)`; lab scratchpad/test/markdown/hardening.test.ts:193-194 was adjusted to `InvalidLineTableError` (diff -u upstream vs lab, non-import hunks). README.md `### Deviations` reads `None.` and PORT_LEDGER.json row w2-markdown has `deviations: []`. Same class at inlineRegistry.ts:144 (UnknownInlineDialectError), blockRegistry.ts (UnknownBlockDialectError), blockParser.ts (BlockParserError) replace upstream TypeErrors.
- failure: An observable deviation (different thrown error class) with an adjusted upstream test is unrecorded, so the ledger and README misreport the module as deviation-free and `ledger --verify`/round inventories cannot trace why the upstream assertion changed.
- fix: Add one ledger `deviations` entry on w2-markdown: { test: "scratchpad/test/markdown/hardening.test.ts:193-194", upstreamBehaviour: "LineIndex.fromLineStarts throws TypeError", labBehaviour: "throws InvalidLineTableError (S.TaggedError); sites: internal/lineIndex.ts:281, internal/inlineRegistry.ts:144, internal/blockRegistry.ts, internal/blockParser.ts", reason: "law:effect-laws-v1#7" } and the matching line under README `### Deviations`.

### fable-1-2
- file: scratchpad/effected/markdown/internal/inlineRegistry.ts:42
- class: effect-idiom   severity: required
- standard: standards/effect-laws-v1.md law 6 (no native Map in domain logic) and law 21 (tersest equivalent form); 2026-10-09 ruling rejecting shapes that "only evade the law"   evidence: `triggerTable` builds a MutableHashMap plus a parallel `entries` array and returns a 12-line object literal implementing the native `ReadonlyMap` interface (size/get/has/keys/values/entries/Symbol.iterator/forEach) so `beep laws native-runtime` (constructor-based scan) passes while `InlineDialect.byTrigger` at inlineTypes.ts:183 stays `ReadonlyMap<number, ...>`. Its only reader is inlineParser.ts:624 `this.dialect.byTrigger.get(code) ?? []`. Bun micro-bench (30M lookups): sparse-array index 11.3-12.1 ns vs facade 8.2 ns (noise); end-to-end A/B swapping the facade for a native Map moved the lab/upstream ratio 1.145 -> 1.225 (noise), so the fix is perf-neutral.
- failure: The dispatch table is typed and implemented as a native Map behind a hand-rolled facade: law 6 is evaded rather than met, every lookup allocates an Option it immediately unwraps, and ~30 lines of boilerplate exist to avoid changing one type and one read.
- fix: Replace the facade with a char-code table: `const table: Array<InlineConstruct[]> = []; for (...) (table[trigger] ??= []).push(construct); return table;` typed `ReadonlyArray<ReadonlyArray<InlineConstruct> | undefined>`; change inlineTypes.ts:183 to that type and inlineParser.ts:624 to `this.dialect.byTrigger[code] ?? []`; drop the MutableHashMap/O imports here.

### fable-1-3
- file: scratchpad/effected/markdown/internal/rawInline.ts:10
- class: law   severity: required
- standard: standards/effect-laws-v1.md law 1 (A/O/P/R/S namespace aliases only)   evidence: `import { isFunction } from "effect/Predicate";` (rawInline.ts:10, used at :319) and the same at inlineParser.ts:44. `rg 'import \{[^}]*\} from "effect/Predicate"' packages --glob '**/src/**/*.ts'` returns 0 files; blockParser.ts:37 uses `import * as P from "effect/Predicate"`. The `effect-imports` gate only normalizes root-barrel imports (EffectImports.ts EFFECT_NAMESPACE_BINDINGS), so it let the named import through.
- failure: Two files bypass the `P` alias law the rest of the module and repo follow; the gate does not catch it.
- fix: `import * as P from "effect/Predicate";` and `dual((args) => !P.isFunction(args[0]), ...)` in rawInline.ts; same edit for inlineParser.ts:44/669 (the `dual` form itself is required by the `missingPipeableSignature` tsgo rule at error in tsconfig.base.json:176, so keep it).

### fable-1-4
- file: scratchpad/effected/markdown/internal/phrasing.ts:35
- class: effect-idiom   severity: backlog
- standard: law 6 / law 21; recorded plan EFFECTED-MD-REFMAP (allowlist) and 2026-10-09 ruling `MarkdownDocument.definitions -> S.HashMap`   evidence: `EMPTY_REFMAP` is a 13-line facade over `HashMap.empty()` implementing native `ReadonlyMap` because `refmap` is still typed `ReadonlyMap<string, Definition>` at inlineTypes.ts:83, inlineParser.ts:118/140/667, rawInline.ts:77-82, blockParser.ts:97 (allowlisted native Map). Not re-raised as required: the refmap boundary change is already recorded for the fix wave.
- failure: Same evasion shape as fable-1-2; it disappears only when the refmap type moves to HashMap.
- fix: When EFFECTED-MD-REFMAP is retired, type `refmap` as `HashMap.HashMap<string, Definition>` end to end (link.ts:265 -> `HashMap.has`, blockParser.ts:598-600 -> MutableHashMap/HashMap) and reduce this to `const EMPTY_REFMAP = HashMap.empty<string, Definition>();`.

### fable-1-5
- file: scratchpad/effected/markdown/internal/blockParser.ts:687
- class: perf   severity: backlog
- standard: D11 (measured regression versus upstream)   evidence: Node 24.20 (gate engine), `parseBlocks(doc, "gfm")` on a 295,780-byte mixed GFM document, 5 warm-ups + 21 paired runs: upstream median 116.6 ms, lab 126.7 ms (ratio 1.086; min ratio 1.095). Bun: 1.15-1.18. Both trees resolve effect 4.0.2; upstream packages/markdown/src is byte-identical to the oracle (`diff -rq`). In-process load-time source patches (no files written) rule out: removing the dual wrappers in preprocess/segments/rawInline/frontmatter/htmlBlock (1.163), inlineRegistry facade -> native Map (1.225), blockRegistry facade -> native Map (1.153), getSomesStruct -> plain loop (1.136), `{ disableChecks: true }` on position() (bun 1.149, Node 1.078). `S.Finite -> S.Number` in MarkdownNode.ts gave 1.099-1.117 in bun but is not reproduced by disableChecks, so the cause is unattributed and diffuse.
- failure: The port parses roughly 9% slower than upstream under Node with no single site responsible among the ones tested.
- fix: No code change proposed yet: `node --cpu-prof` over parseBlocks on the same document before the fix wave (the planned refmap/definitions rewrite will move the numbers), then anchor a finding on the hot frame.

### fable-1-6
- file: scratchpad/effected/markdown/internal/preprocess.ts:367
- class: docs   severity: backlog
- standard: .patterns/jsdoc-documentation.md (doc block attaches to the following declaration); header accuracy   evidence: Lines 367-369: `/** Columns of indentation that open an indented code block. */` then `import { dual } from "effect/Function";` then `export const CODE_INDENT = 4;` — the JSDoc now documents the import. Header line 12 still says `Leaf module: imports nothing.`
- failure: docgen will attach the CODE_INDENT description to nothing and the module header lies about its imports.
- fix: Move the `dual` import above the comment into the import position and reword the header to `Leaf module: imports only `dual`.`

### fable-1-7
- file: scratchpad/effected/markdown/internal/segments.ts:10
- class: docs   severity: backlog
- standard: header accuracy (carried upstream prose, section 10.1)   evidence: Line 10 `Leaf module: imports only the segment type.` while line 13 imports `dual` from effect/Function.
- failure: Stale module header.
- fix: Reword to `Leaf module: imports only `dual` and the segment type.`

### fable-1-8
- file: scratchpad/effected/markdown/internal/blocks/atxHeading.ts:27
- class: effect-idiom   severity: backlog
- standard: law 17 (derive guards with S.is(...) as named building blocks); section 11.3 (unreachable branches are findings against the source)   evidence: `S.is(HeadingDepth)(hashes)` rebuilds the guard inside the expression on every heading; the trailing `: 1` fallback and both clamps are unreachable because `reATXHeadingMarker = /^#{1,6}.../` bounds the run to 1-6. Lines 17-18 import from `../../MarkdownNode.ts` twice.
- failure: Guard construction per call and three dead branches that S3 per-file 100% coverage will have to explain.
- fix: `const isHeadingDepth = S.is(HeadingDepth);` at module level and `const headingDepth = (hashes: number): HeadingDepth => (isHeadingDepth(hashes) ? hashes : hashes < 1 ? 1 : 6);`; merge the two MarkdownNode imports.

### fable-1-9
- file: scratchpad/effected/markdown/internal/blocks/code.ts:270
- class: effect-idiom   severity: backlog
- standard: law 21 (tersest equivalent helper form)   evidence: Lines 270-273: two adjacent `...O.getSomesStruct({ lang })` / `...O.getSomesStruct({ meta })` spreads followed by two conditional spreads `...(isFenced === true && fenceChar !== undefined ? { fenceChar } : {})` in one `Code.make`.
- failure: Four spreads for one optional-field struct; the ternary pair is the shape the terse-effect law rewrote elsewhere.
- fix: One spread: `...O.getSomesStruct({ lang: O.fromUndefinedOr(lang), meta: O.fromUndefinedOr(meta), fenceChar: isFenced === true ? O.fromUndefinedOr(fenceChar) : O.none(), fenceLength: isFenced === true ? O.fromUndefinedOr(fenceLength) : O.none() })`.

### fable-1-10
- file: scratchpad/effected/markdown/internal/blocks/list.ts:280
- class: effect-idiom   severity: backlog
- standard: law 21 (tersest equivalent helper form)   evidence: Line 280 `...(ordered && listData?.start !== undefined ? { start: listData.start } : {})` sits directly above the `O.getSomesStruct({ bulletChar, delimiter })` spread at 281-284.
- failure: Mixed spread styles for one optional-field struct.
- fix: Fold `start: ordered ? O.fromUndefinedOr(listData?.start) : O.none()` into the getSomesStruct call and delete line 280.

### fable-1-11
- file: scratchpad/effected/markdown/internal/lineIndex.ts:216
- class: schema   severity: backlog
- standard: D5 (identity annotations on every exported error); .patterns/error-handling.md; house form `$I.annoteError<X>("X", { description })` (packages/foundation/modeling/identity/src/IdentityRegistry.ts:186)   evidence: `export class InvalidLineTableError extends S.TaggedError<InvalidLineTableError>($I`InvalidLineTableError`)("InvalidLineTableError", { message: S.String }) {}` carries the identifier but no description annotation; same at inlineRegistry.ts:35 (non-exported).
- failure: The exported error lacks the annotation set the identity step gives every other schema in the module.
- fix: Add the third argument `$I.annoteError<InvalidLineTableError>("InvalidLineTableError", { description: "A line table handed to LineIndex.fromLineStarts was empty or did not start at offset 0." })`; same for UnknownInlineDialectError.

### fable-1-12
- file: scratchpad/effected/markdown/internal/inlineRegistry.ts:40
- class: schema   severity: backlog
- standard: law 19 / standing rule (no hand-rolled literal unions; one named literal domain)   evidence: `export type InlineDialectName = "commonmark" | "gfm";` duplicates the public `MarkdownDialect` schema (Markdown.ts:43, `S.Literals(["commonmark", "gfm"])`, type at :50) and the internal `blockRegistry.ts` `MarkdownDialect` alias, whose comment says the name doubles as the inline key.
- failure: Three spellings of one literal domain; widening the public union does not propagate to the inline registry.
- fix: `import type { MarkdownDialect } from "./blockRegistry.ts"; export type InlineDialectName = MarkdownDialect;` (type-only, no runtime cycle); longer term one LiteralKit in internal/ that Markdown.ts reuses.

### fable-1-13
- file: scratchpad/effected/markdown/internal/blocks/frontmatter.ts:602
- class: schema   severity: backlog
- standard: law 19 (LiteralKit for named literal domains)   evidence: `export type RawNewline = "\n" | "\r\n" | "\r";` duplicates `FrontmatterNewline = S.Literals(["\n", "\r\n", "\r"])` (FrontmatterSource.ts:29, type :36); the cycle firewall forbids importing the public module from internal/.
- failure: Two spellings of the terminator domain; `terminatorAt` and `RawFrontmatterCapture.newline` are typed by the hand-rolled one.
- fix: Define the domain once here: `export const RawNewline = LiteralKit(["\n", "\r\n", "\r"]); export type RawNewline = typeof RawNewline.Type;` and have FrontmatterSource.ts build `FrontmatterNewline = RawNewline.pipe($I.annoteSchema(...))`.

### fable-1-14
- file: scratchpad/effected/markdown/internal/blocks/table.ts:346
- class: schema   severity: backlog
- standard: law 19 (named schema types over anonymous inline unions)   evidence: `alignmentsOf` returns `ReadonlyArray<"left" | "right" | "center" | null>` while `TableAlign` (MarkdownNode.ts, `S.Literals(["left", "right", "center"])`) is the named domain and `Table.align` is `TableAlign.pipe(S.NullOr, S.Array, S.optionalKey)` (MarkdownNode.ts:767).
- failure: The alignment literal set is restated inline instead of referencing the schema type it feeds.
- fix: `import type { TableAlign } from "../../MarkdownNode.ts"` (type export exists) and return `ReadonlyArray<TableAlign | null>`.

REQUIRED: 3
BACKLOG: 11
