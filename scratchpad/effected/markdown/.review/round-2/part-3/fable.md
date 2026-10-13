### fable-2-1
- file: scratchpad/effected/markdown/internal/stringify.ts:656
- class: perf   severity: required
- standard: D11 (measured regression versus upstream); round-1 req-18 precedent (same mechanism in Mdast.ts); law 11 forbids restoring switch   evidence: Read-only Bun 1.4.2 probe: one lab-parsed gfm Root (645,000 bytes, 118,501 nodes) fed to both lab `stringifyTree` and the pinned oracle's (live checkout packages/markdown/src is byte-identical to the oracle, `diff -rq`), 5 warm-ups + 15 runs, two rounds: lab min/median 191.0/198.2 and 199.8/203.6 ms; upstream 58.7/69.4 and 79.0/81.7 ms (2.5-3.3x); outputs identical (`a === b`, 721,499 chars). Mechanism: `serializeInlines` builds `Match.value(child).pipe(Match.discriminator("type")(...) x14, Match.exhaustive)` for every inline child (:656-772) and `serializeBlocks` the same 15-arm chain per block (:1187-1259); `interruptsParagraph` (:1144) and `canJoinWithoutBlank` (:1158) rebuild theirs per call. Micro-timing, 1M dispatches over the 14 inline kinds: per-node chain 557 ns/node vs a module-level `Match.type` dispatcher 38 ns/node; 118k nodes x ~0.5 us is roughly half of the ~130 ms delta. Ruled out: per-character `HashSet.has` in escapeText (14.3 vs 12.8 ns/char for a regex class). Upstream dispatches with `switch` at its :611/:1085/:1109/:1146, which law 11 forbids; the regression comes from where the matcher is built, not from using Match.
- failure: Serializing a document is 2.5-3.3x slower than upstream for byte-identical output; every node pays ~30 matcher/closure allocations on the module's hottest serialization path.
- fix: Build the inline and block dispatchers once at module scope (`Match.type<PhrasingContent>()` / `Match.type<Block>()`, e.g. with `Match.discriminatorsExhaustive("type")`, present in installed effect Match.d.ts:948) whose arms return `(acc) => void` handlers over an explicit serializer-state record (out, atLineStart, index, text-run fields, context, state, junctionGuard, children) instead of closing over per-call locals; hoist `interruptsParagraph` and `canJoinWithoutBlank` the same way. Keep output byte-identical (stringify.test.ts, stringify-literal.test.ts, e2e/stringify-roundtrip) and rerun the benchmark above.

### fable-2-2
- file: scratchpad/effected/markdown/internal/stringify.ts:1046
- class: schema   severity: required
- standard: standards/effect-laws-v1.md law 19 (named schema types over anonymous inline unions); round-1 req-28 precedent (same restatement fixed in blocks/table.ts:359)   evidence: `const alignCell = (align: "left" | "right" | "center" | null | undefined): string` restates `TableAlign` (MarkdownNode.ts:405 LiteralKit, type :414); its only caller passes `table.align?.[column]`, already typed `TableAlign | null | undefined`. blocks/table.ts:359 was migrated to `ReadonlyArray<TableAlign | null>` in the round-1 fix wave; this sibling site was not.
- failure: A second spelling of the alignment domain in the module; widening `TableAlign` would not propagate to the serializer's parameter type.
- fix: Add `TableAlign` to the `import type {...} from "../MarkdownNode.ts"` list and declare `(align: TableAlign | null | undefined)`; no runtime change.

### fable-2-3
- file: scratchpad/effected/markdown/internal/stringify.ts:512
- class: schema   severity: required
- standard: standards/effect-laws-v1.md law 19; round-1 req-28 precedent   evidence: `"*" | "_"` restates `EmphasisChar` (MarkdownNode.ts:350 LiteralKit, type :359) at :512 (`emphasisMarker` fidelity parameter and return), :606 (`JunctionGuard.marker`), :609 (`flipMarker`), :614-618 (`nestedMarker` fidelity and return) and :701 (`let marker: "*" | "_"`); the values flow from `child.markerChar`, which is typed `EmphasisChar | undefined`.
- failure: Six hand-spelled copies of a named literal domain inside one file; the type system cannot tie them to the schema that defines the markers.
- fix: Add `EmphasisChar` to the type import from `../MarkdownNode.ts` and replace each `"*" | "_"` with `EmphasisChar` (`EmphasisChar | undefined` where fidelity is optional); no runtime change.

### fable-2-4
- file: scratchpad/effected/markdown/internal/stringify.ts:794
- class: schema   severity: required
- standard: standards/effect-laws-v1.md laws 17 and 19; AGENTS.md Code Laws (named LiteralKit internal domains and derived `S.is` guards over ad-hoc predicate helpers); round-1 req-8 precedent (MarkdownFormat.ts membership tables)   evidence: `const MDX_NODE_TYPES = HashSet.fromIterable<string>(["mdxJsxFlowElement", "mdxJsxTextElement", "mdxFlowExpression", "mdxTextExpression", "mdxjsEsm"])` is a named literal domain over MarkdownNodeType members consumed only by `HashSet.has(MDX_NODE_TYPES, node.type)` (:816); the explicit `<string>` parameter widens the table so a misspelled member compiles. This is the exact shape req-8 required MarkdownFormat.ts to replace with LiteralKit domains; `rg -n LiteralKit scratchpad/effected/markdown/internal/stringify.ts` is empty.
- failure: The MDX-presence domain is an untyped membership table plus an ad-hoc `has` predicate rather than a named kit with a derived guard, below the D5 bar the rest of the module now meets.
- fix: Declare a module-local `const MdxNodeType = LiteralKit(["mdxJsxFlowElement", "mdxJsxTextElement", "mdxFlowExpression", "mdxTextExpression", "mdxjsEsm"])` (annotated with a `$ScratchpadId` composer for this file) and `const isMdxNodeType = S.is(MdxNodeType)`; in `treeContainsMdx` test `isMdxNodeType(node.type)`; delete the HashSet.

### fable-2-5
- file: scratchpad/effected/markdown/internal/blocks/list.ts:32
- class: schema   severity: required
- standard: standards/effect-laws-v1.md law 17 (derive guards with `S.is(...)` from the schema that models the constraint); AGENTS.md Code Laws; round-1 req-8 precedent; the fix wave's own shape at blocks/atxHeading.ts:27   evidence: Four helpers narrow a matched character into a LiteralKit type by re-spelling its members in nested ternaries: list.ts:32 `bulletCharOf = (char) => char === "-" ? "-" : char === "*" ? "*" : "+"`, list.ts:35 `delimiterOf = (char) => char === "." ? "." : ")"`, fencedCode.ts:14 `fenceCharOf = (char) => char === "`" ? "`" : "~"`, thematicBreak.ts:15 `markerCharOf = (char) => char === "-" ? "-" : char === "_" ? "_" : "*"`. Upstream returned `| undefined` with a guard; the S3 coverage deviations (ledger list.ts:32,35 / thematicBreak.ts:15) made them total by hand instead of deriving from `BulletChar`/`ListDelimiter`/`FenceChar`/`ThematicBreakChar` (MarkdownNode.ts:269/296/242/323). atxHeading.ts:27 already derives `HeadingDepth` the schema way (`Result.getOrThrow(S.decodeUnknownResult(HeadingDepth)(hashes))`).
- failure: Each helper is a parallel, hand-maintained copy of a schema's literal set with a silent default arm; adding or renaming a member in the kit does not fail these sites.
- fix: Per file hoist `const decodeBulletChar = S.decodeUnknownResult(BulletChar)` (likewise ListDelimiter, FenceChar, ThematicBreakChar) and write `Result.getOrThrow(decodeBulletChar(char))`, the shape atxHeading.ts uses; the regexes guarantee membership so behaviour is unchanged. Apply the same change at list.ts:35, fencedCode.ts:14 and thematicBreak.ts:15.

### fable-2-6
- file: scratchpad/effected/markdown/internal/preprocess.ts:60
- class: schema   severity: required
- standard: standards/schema-first-development-prompt.md "Schema owns pure data" (plain interfaces only for service contracts, ports, overload surfaces, type-level machinery); EF-3/EF-12b; round-1 req-34 precedent (DelimiterRun, now `S.Struct` at inlines/emphasis.ts:53)   evidence: `export interface SourceLine { readonly text: string; readonly start: number }` is an exported pure-data record (no methods, no dependency inversion) constructed as object literals at :98/:102/:115 and consumed by frontmatter.ts, phrasing.ts and blockParser; it has no runtime schema, identity or arbitrary. The same class of exported pure-data interface was made required in req-34 and fixed with an annotated `S.Struct` plus same-name type.
- failure: The line-table model disappears at runtime: it cannot be validated, generated for the D10 property floor, or documented through the identity catalog, unlike its sibling DelimiterRun.
- fix: `export const SourceLine = S.Struct({ text: S.String.annotateKey({...}), start: S.Finite.annotateKey({...}) }).annotate($I.annote("SourceLine", {...}))` with a file-level `$ScratchpadId` composer and `export type SourceLine = typeof SourceLine.Type`; keep the plain object literals in `preprocessLines` (type-only consumption on the hot path) and add the `Arbitrary.schema` round-trip property.

### fable-2-7
- file: scratchpad/effected/markdown/internal/lineIndex.ts:47
- class: schema   severity: required
- standard: standards/schema-first-development-prompt.md "Schema owns pure data"; EF-12b; round-1 req-34 precedent   evidence: `export interface LineColumn { readonly line: number; readonly column: number }` is an exported pure-data result returned by `positionAt` (:191) and read by MarkdownNode's `Point` construction; the file already has a `$ScratchpadId` composer and `effect/Schema` imported (:7-10) for `InvalidLineTableError`, yet the data shape it returns stays a TypeScript-only interface.
- failure: The index's output model has no executable schema although the file is already schema-bearing; `Point` (MarkdownNode.ts) and `LineColumn` restate the same line/column fields without a shared building block.
- fix: `export const LineColumn = S.Struct({ line: S.Finite.annotateKey({...}), column: S.Finite.annotateKey({...}) }).annotate($I.annote("LineColumn", {...}))` and `export type LineColumn = typeof LineColumn.Type`; `positionAt` keeps returning the object literal (no `.make` on the query path). lineIndex stays a leaf, so `Point` cannot be reused here.

### fable-2-8
- file: scratchpad/effected/markdown/internal/references.ts:373
- class: schema   severity: required
- standard: standards/schema-first-development-prompt.md "Schema owns pure data"; EF-2/EF-12b; round-1 req-34 precedent   evidence: `export interface ParsedReference { key; identifier; label; url; title?; length }` is an exported pure-data payload built as a literal at :469-476 (with `O.getSomesStruct` for `title`) and consumed by blocks/linkReferenceDefinition.ts; it is neither a service contract nor type-level machinery and has no schema, identity or arbitrary.
- failure: The parsed-definition model is TypeScript-only: it cannot be validated at the block seam or generated for the D10 property floor, unlike DelimiterRun after req-34.
- fix: `export const ParsedReference = S.Struct({ key: S.String, identifier: S.String, label: S.String, url: S.String, title: S.optionalKey(S.String), length: S.Finite })` with `annotateKey` descriptions and `$I.annote`, `export type ParsedReference = typeof ParsedReference.Type`; `parseReference` keeps returning the literal; add the round-trip property.

### fable-2-9
- file: scratchpad/effected/markdown/internal/blocks/frontmatter.ts:61
- class: schema   severity: required
- standard: standards/schema-first-development-prompt.md "Schema owns pure data"; EF-12b; round-1 req-27 (RawNewline moved into this leaf) and req-34 precedents   evidence: `export interface FrontmatterCapture` (:61-69) and `export interface RawFrontmatterCapture` (:182-199) are exported pure-data captures (format, value, lineCount/endOffset, newline, bodyOffset) built as literals at :134-139 and :271-276, in a file that already carries `$I` (:41) and the `RawNewline` LiteralKit (:160). `format` is typed by `FrontmatterFormat`, imported type-only (:38) because of the internal-to-public cycle firewall.
- failure: Two capture models stay TypeScript-only next to a schema-bearing sibling (`RawNewline`); `newline: RawNewline` is a schema type inside an interface the schema cannot validate.
- fix: Model both as annotated `S.Struct` schemas with same-name types (`newline: RawNewline`, `lineCount`/`endOffset`/`bodyOffset: S.Finite`). For `format`, move the `FrontmatterFormat` LiteralKit definition into this leaf (as req-27 did for RawNewline) and have MarkdownNode.ts re-export it, keeping the runtime import direction internal -> public only; keep the literal construction in the scanners.

### fable-2-10
- file: scratchpad/effected/markdown/internal/inlineRegistry.ts:147
- class: effect-idiom   severity: backlog
- standard: standards/effect-laws-v1.md law 21 (tersest equivalent Effect helper form); round-1 back-5 classification for law-21 items   evidence: `const found = O.getOrUndefined(HashMap.get(dialects, dialect)); if (found === undefined) { throw UnknownInlineDialectError.make({...}); } return found;` reimplements `O.getOrThrowWith` (installed node_modules/effect/dist/Option.d.ts:1259, dual) with an undefined sentinel.
- failure: No runtime difference; four lines and a nullish sentinel express what one helper call expresses.
- fix: `export const inlineDialect = (dialect: InlineDialectName): InlineDialect => O.getOrThrowWith(HashMap.get(dialects, dialect), () => UnknownInlineDialectError.make({ message: `unknown markdown dialect: ${dialect}` }));`

### fable-2-11
- file: scratchpad/effected/markdown/internal/blocks/list.ts:62
- class: effect-idiom   severity: backlog
- standard: standards/effect-laws-v1.md law 21; EF-2 (Option only where absence exists)   evidence: `...O.getSomesStruct({ bulletChar: O.fromUndefinedOr(bulletChar) })` where `bulletChar` is `BulletChar` (never undefined since `bulletCharOf` became total under the S3 coverage deviation at list.ts:32); the same at :73 for `delimiter` (`delimiterOf` is total). Upstream wrapped these because its helpers returned `| undefined`; the lab kept the wrapper after removing the absence.
- failure: An Option round trip on a value that is always present; `getSomesStruct` always yields `{ bulletChar }`.
- fix: Write `bulletChar,` at :62 and `delimiter,` at :73 (ListData's keys are optional, so the literal types are unchanged); drop the two spreads.

### fable-2-12
- file: scratchpad/effected/markdown/internal/segments.ts:56
- class: test   severity: backlog
- standard: EFFECTED_PORT_GOAL.md section 11.3 (an unreachable branch is a finding against the source); the lab's own lineIndex.ts:182 fix (`A.getUnsafe`) for the same shape   evidence: `const segment = segments[mid]; if (segment !== undefined && !(textIndex < segment.textOffset))` with `0 <= low <= mid < high <= segments.length` on a dense array: `segment` is never undefined, so the false outcome of the first operand cannot occur. The coverage gate reports 100% branches because v8/istanbul counts a `&&` operand as covered when it is evaluated, not when both outcomes occur; the gate cannot see this.
- failure: A guard that never fires survives per-file 100% coverage, contradicting the section 11.3 clean-up applied to lineIndex.ts in the same wave.
- fix: `const segment = A.getUnsafe(segments, mid); if (!(textIndex < segment.textOffset)) {` (import `* as A from "effect/Array"`); the NaN comment and the `segments[low - 1]` fallback at :62-63 stay (that one is reachable).

### fable-2-13
- file: scratchpad/effected/markdown/internal/blocks/frontmatter.ts:117
- class: test   severity: backlog
- standard: EFFECTED_PORT_GOAL.md section 11.3; lineIndex.ts:182 precedent   evidence: :116-118 `const line = lines[index]; if (line === undefined || line.text !== rule.close) continue;` with `1 <= index < lines.length`, and :123-127 `const current = lines[inner]; const next = lines[inner + 1]; if (current === undefined || next === undefined) break;` with `1 <= inner < index < lines.length` (so `inner + 1 <= index`): neither undefined outcome is reachable on the preprocessor's dense array. Evaluation-based branch counting hides both.
- failure: Two never-taken guards remain after the S3 unreachable-branch pass.
- fix: Use `A.getUnsafe(lines, index)`, `A.getUnsafe(lines, inner)` and `A.getUnsafe(lines, inner + 1)` and delete the undefined checks.

### fable-2-14
- file: scratchpad/effected/markdown/internal/blocks/footnoteDefinition.ts:143
- class: test   severity: backlog
- standard: EFFECTED_PORT_GOAL.md section 11.3   evidence: `const rawLabel = found?.[1]; if (found === null || rawLabel === undefined) return 0;` — `reFootnoteDefinition` (:56) has one mandatory capture `([^\]\0\t\n\r ]+)`, so whenever `found !== null`, `found[1]` is a non-empty string; the `rawLabel === undefined` outcome is unreachable, and the optional chain's short-circuit only mirrors the `found === null` test.
- failure: A fixed-outcome guard survives the 100% gate (operand evaluated, outcome never true).
- fix: `if (found === null) return 0; const rawLabel = A.getUnsafe(found, 1);` (RegExpExecArray is an Array<string>).

### fable-2-15
- file: scratchpad/effected/markdown/internal/blocks/htmlBlock.ts:68
- class: test   severity: backlog
- standard: EFFECTED_PORT_GOAL.md section 11.3   evidence: `return reHtmlBlockClose[type]?.test(rest) ?? false;` after :65 has established `1 <= type <= 5` against a six-entry table (:34), so the `?.` short-circuit and the `?? false` arm cannot occur; branch coverage counts them as covered because they are evaluated.
- failure: Two dead fallback arms on the block-close test.
- fix: `return A.getUnsafe(reHtmlBlockClose, type).test(rest);`

### fable-2-16
- file: scratchpad/effected/markdown/internal/references.ts:23
- class: docs   severity: backlog
- standard: EFFECTED_PORT_GOAL.md section 10.1 (carried prose must stay true after a law-driven change); round-1 back-8/back-10/back-11 classification for stale headers   evidence: Port note 2 (:21-23) still says "the map is keyed through a real `Map`" while the definition index is now `HashMap`/`S.HashMap` with `definitionOrder` (ledger native-runtime deviation; inlineTypes.ts:154 `refmap: HashMap.HashMap<string, Definition>`).
- failure: The header documents a representation the port no longer has.
- fix: Reword to "...the caller decides what to do with the result, and the index is an Effect `HashMap` keyed by the normalized label (plus an explicit document order)."

### fable-2-17
- file: scratchpad/effected/markdown/internal/references.ts:29
- class: effect-idiom   severity: backlog
- standard: AGENTS.md Discovery & Reuse (search live source before recreating a shared constant); law 21   evidence: `const ESCAPABLE = "[!\"#$%&'()*+,./:;<=>?@[\\\\\\]^_`{|}~-]";` is byte-identical to the exported `ESCAPABLE` in unescape.ts:31, which this file already imports from (:26 `unescapeString`) and which blocks/table.ts:55 imports for the same purpose. Upstream carries the same duplication; D9 does not require keeping a duplicated constant.
- failure: Two definitions of the spec's escapable set that can drift silently.
- fix: `import { ESCAPABLE, unescapeString } from "./unescape.ts";` and delete the local constant (no cycle: unescape.ts imports only entities.ts).

### fable-2-18
- file: scratchpad/effected/markdown/internal/lineIndex.ts:129
- class: jsdoc   severity: backlog
- standard: .patterns/jsdoc-documentation.md (Gotchas hold accurate, non-obvious information); section 10.1 carried prose stays true   evidence: The `fromLineStarts` Gotchas say "`starts` must be ascending and begin at 0; a table that is neither is a wiring bug and dies as a defect." and immediately after "The constructor checks that the table is non-empty and begins at zero; the caller is responsible for ensuring ascending order." The two sentences contradict each other on ascending order, and "dies as a defect"/"wiring bug" predates the tagged `InvalidLineTableError` the code throws (:149) and the `@throws` tag that already names it.
- failure: A reader cannot tell from the block whether a non-ascending table throws (it does not).
- fix: Replace both sentences with one: "`starts` must be non-empty and begin at 0 (checked; `InvalidLineTableError` otherwise) and ascending (not checked; the caller's responsibility)."

REQUIRED: 9
BACKLOG: 9
