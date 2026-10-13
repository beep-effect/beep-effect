### fable-2-1
- file: scratchpad/effected/markdown/internal/inlines/codeSpan.ts:22
- class: jsdoc   severity: required
- standard: .patterns/jsdoc-documentation.md, "Description and section grammar": "A section is non-empty and appears at most once" and "Do not add empty or formulaic sections merely to fill out the shape"; D11 (JSDoc-law break).   evidence: codeSpan.ts:22 reads `**Details**` followed only by a blank ` *` line and then `**Example** (Register the backtick trigger)` at :24. The S2 carrier conversion added the heading with no prose (the oracle's one-line `/** A code span. */` had none). The docgen gate misses it: packages/tooling/tool/docgen/src/Checker.ts:19-22 only tests `titledExampleSection` (a titled Example containing a ts fence); no check validates section emptiness, which is why the gate is green with this block in place.
- failure: The exported `codeSpanConstruct` doc block violates the section grammar: an empty body section renders as a dangling bold heading in IDE hovers and the generated docs, and the law forbids the formulaic shape outright.
- fix: Delete lines 22-23 (`**Details**` and its trailing blank ` *`) so the lead paragraph is followed directly by the Example; or, if a Detail is wanted, write one sentence of non-signature information (e.g. line endings inside the span become spaces and one padding space per side is stripped unless the content is all spaces).

### fable-2-2
- file: scratchpad/effected/markdown/internal/inlines/emphasis.ts:64
- class: jsdoc   severity: required
- standard: .patterns/jsdoc-documentation.md, section grammar ("A section is non-empty"; "Do not add empty or formulaic sections"); "Pure type-level exports still require precise prose"; D11.   evidence: Two empty `**Details**` sections in this file: emphasis.ts:64 (on `export type DelimiterRun`, followed at :66 by `@category type-level`) and emphasis.ts:176 (on `emphasisConstruct`, followed at :178 by `**Example** (Register both emphasis markers)`). Both were introduced by the S2 pass (oracle emphasis.ts has neither). Checker.ts:19-22 only verifies a titled Example exists, so docgen cannot flag an empty section.
- failure: Both doc blocks break the section grammar; the type-level block in particular now consists of a one-line lead plus an empty heading, which is exactly the formulaic shape the law prohibits.
- fix: Remove the `**Details**` heading and its blank line at :64-65 and at :176-177. Keep the leads; the existing Example on `emphasisConstruct` stays.

### fable-2-3
- file: scratchpad/effected/markdown/internal/inlines/entity.ts:21
- class: jsdoc   severity: required
- standard: .patterns/jsdoc-documentation.md, section grammar ("A section is non-empty"; "Do not add empty or formulaic sections"); D11.   evidence: entity.ts:21 `**Details**` is followed by a blank ` *` and then `**Example** (Register the character reference trigger)` at :23; no prose. Added in S2 (oracle: `/** A named, decimal or hexadecimal character reference. */`). Docgen's Checker.ts:19-22 does not inspect section bodies, so the green gate did not see it.
- failure: `entityConstruct`'s exported doc block carries an empty body section, violating the binding section grammar.
- fix: Delete entity.ts:21-22; alternatively fill it with the file-header fact that an unresolvable reference is kept as literal source text (upstream `decodeHTMLStrict` parity).

### fable-2-4
- file: scratchpad/effected/markdown/internal/inlines/escape.ts:20
- class: jsdoc   severity: required
- standard: .patterns/jsdoc-documentation.md, section grammar ("A section is non-empty"; "Do not add empty or formulaic sections"); D11.   evidence: escape.ts:20 `**Details**` followed by a blank ` *` then `**Example** (Register the backslash trigger)` at :22; no prose. Oracle escape.ts:17 had a one-line lead only. Checker.ts:19-22 checks for a titled Example only, so docgen passes with the empty section.
- failure: `escapeConstruct`'s doc block has an empty body section, breaking the section grammar.
- fix: Delete escape.ts:20-21 (or state the three outcomes the header comment already lists: escaped punctuation, backslash hard break, literal backslash).

### fable-2-5
- file: scratchpad/effected/markdown/internal/inlines/footnoteReference.ts:64
- class: jsdoc   severity: required
- standard: .patterns/jsdoc-documentation.md, section grammar ("A section is non-empty"; "Do not add empty or formulaic sections"); D11.   evidence: Two empty `**Details**` sections: footnoteReference.ts:64 (on `footnoteReferenceFallback`, followed by `**Example** (Prepare a footnote close fallback)` at :66) and :141 (on `gfmLinkCloseConstruct`, followed by `**Example** (Register GFM closing brackets)` at :143). Neither exists in the oracle (footnoteReference.ts:56-59, :106-109). Checker.ts:19-22 only tests for a titled Example section, so docgen is green regardless.
- failure: Two exported doc blocks carry empty body sections in violation of the section grammar.
- fix: Delete :64-65 and :141-142. The non-exported `looksLikeFootnote` block (:48-50) is not law-bound but its Details is non-empty and may stay.

### fable-2-6
- file: scratchpad/effected/markdown/internal/inlines/lineBreak.ts:24
- class: jsdoc   severity: required
- standard: .patterns/jsdoc-documentation.md, section grammar ("A section is non-empty"; "Do not add empty or formulaic sections"); D11.   evidence: lineBreak.ts:24 `**Details**` followed by a blank ` *` then `**Example** (Register the newline trigger)` at :26; no prose. Oracle lineBreak.ts:21 was a one-line lead. Docgen's Checker.ts:19-22 does not validate section bodies.
- failure: `lineBreakConstruct`'s doc block has an empty body section.
- fix: Delete lineBreak.ts:24-25; or carry the file-header port note (soft break is a literal `\n` in the text run; two or more trailing spaces form a `break` with `breakStyle: "spaces"`), which is exactly the non-signature information Details is for.

### fable-2-7
- file: scratchpad/effected/markdown/internal/inlines/link.ts:297
- class: schema   severity: required
- standard: standards/effect-laws-v1.md law 19 (LiteralKit for named internal literal domains; `S.Literals` only for anonymous unions never referenced by name); AGENTS.md Code Laws ("Prefer named schema building blocks ... named LiteralKit internal domains"); round-1 precedent req-28 (table.ts restating `TableAlign` inline was required). D11 law violation with a cited standard.   evidence: link.ts:297 `let referenceType: "shortcut" | "collapsed" | "full" = "shortcut";` restates by hand the named domain `ReferenceType = LiteralKit(["shortcut", "collapsed", "full"])` exported from MarkdownNode.ts:159 with its same-name type at :168; the value is assigned to `node.data.referenceType` whose declared type is already `ReferenceType` (inlineNode.ts:53). The same file's sibling emphasis.ts:139 already does this correctly (`markerCharOf = (cc): EmphasisChar => ...`). `rg '"shortcut" \| "collapsed" \| "full"' scratchpad/effected/markdown` finds link.ts:297 as the only hand-rolled copy. None of the four beep laws run by `lint` detects an inline type-level union, so the gate cannot catch it.
- failure: A second, unlinked spelling of the reference-type domain lives in parser logic: adding or renaming a member in `ReferenceType` leaves this annotation stale, and the restated union bypasses the kit's identity and annotations.
- fix: Add `import type { ReferenceType } from "../../MarkdownNode.ts";` next to the existing imports (mirrors emphasis.ts:19) and change :297 to `let referenceType: ReferenceType = "shortcut";`. No runtime change; no test adjustment.

### fable-2-8
- file: scratchpad/effected/markdown/internal/inlines/emphasis.ts:54
- class: schema   severity: required
- standard: standards/schema-first-development-prompt.md "Precision carries invariants" ("Replace broad primitives with the real domain where the domain is narrower: ... finite or integral numbers, ranges"; "Prefer built-in schemas and checks before custom filters"); standards/effect-laws-v1.md law 17 (named domain constraints modeled as schemas with built-in checks); crispen at ultra (invariants absorbed into schemas, §12.1). D11 schema-idiom violation with a cited standard.   evidence: `numdelims: S.Finite.annotateKey({ description: "Length of the delimiter run in UTF-16 code units." })` admits `-3`, `0` and `2.5`, none of which is a run length. The producer makes the invariant explicit: scanDelims returns `O.none()` at :105-108 when `numdelims === 0` and otherwise counts whole UTF-16 units, so every `O.some` carries an integer >= 1; the consumer `handleDelim` adds it to `scanner.pos` (:149). The only test of the domain, scratchpad/test/markdown/delimiter-run.test.ts:62-68, proves string/boolean/Infinity rejection but cannot prove `0` or `1.5` rejection because the schema accepts them, and the D10 round-trip property at scratchpad/test/markdown/internal/inlines/emphasis.property.test.ts:85 therefore generates impossible runs. This does not conflict with the schemaNumber/S.Finite ruling (round-1 reject-1): the rule's own preview (~/YeeBois/references/effect/effect-tsgo/docs/rules/schema-number.md, `integer: Schema.Number.check(Schema.isInt())`) is accepted, and the installed effect exports `S.Int` (Schema.d.ts:6123) and `S.isGreaterThanOrEqualTo` (:5998).
- failure: The schema that round 1 introduced as the source of truth for the measurement (req-34) is wider than the measurement: `DelimiterRun.make({ numdelims: 0, canOpen: true, canClose: false })` and fractional or negative lengths decode successfully although no scan can produce them, so the runtime validator and derived arbitrary do not describe the domain.
- fix: Change the field to `numdelims: S.Int.check(S.isGreaterThanOrEqualTo(1)).annotateKey({ description: "Length of the delimiter run in UTF-16 code units; at least one." })`. Extend delimiter-run.test.ts:62-68 with `assert.isFalse(isRun({ numdelims: 0, ... }))` and `assert.isFalse(isRun({ numdelims: 1.5, ... }))`; the Arbitrary-based property at emphasis.property.test.ts:85 needs no edit because `Arbitrary.schema` honours the checks. Record it under the module's existing numeric-domains deviation class rather than as a new entry.

### fable-2-9
- file: scratchpad/effected/markdown/internal/inlines/link.ts:261
- class: effect-idiom   severity: backlog
- standard: standards/effect-first-development.md EF-2 "Absence is Option" ("Inside domain code, avoid `| null` and `| undefined`"); round-1 req-35 applied the same rule to scanDelims.   evidence: Inside `makeLinkCloseConstruct.parse`: `let title: string | undefined` (:261), `let identifier: string | undefined` (:295), and the inline-link grammar closure passed to `withReferenceScanner` returns `undefined` on failure (:271, :280) so `inline` is `{...} | undefined` and is branched on at :286. These are internally produced domain results, not boundary input. Backlog rather than required because the sentinel originates in the `references.ts` contracts this part does not own (`parseLinkDestination(): string | undefined` at references.ts:250, `parseLinkTitle()` at :312), round 1 reviewed this file and accepted the method-local shape, and no observable failure follows.
- failure: Absence inside the close-bracket handler is modelled with `undefined` sentinels and `=== undefined` branches rather than `Option`, inconsistent with the Option-returning `scanDelims` the same module now exposes.
- fix: Have the `withReferenceScanner` callback return `O.Option<{ destination: string; parsedTitle: O.Option<string> }>` (`O.none()` at :271/:280, `O.some(...)` at :283, wrapping `parseLinkTitle()` with `O.fromUndefinedOr`), then `O.match` at :286; type `title`/`identifier` as `O.Option<string>` and set `node.data.title` via `O.map`/`O.getOrUndefined` at :360. Coordinate with the owner of references.ts if those contracts move to Option later.

### fable-2-10
- file: scratchpad/test/markdown/internal/inlines/FootnoteReference.property.test.ts:26
- class: test   severity: backlog
- standard: §11.3 (coverage closed with tests that assert behaviour); round-1 precedent at INVENTORY.md:121 where a hand-written data-last overload (`parseBlocks("gfm")`) did not match its `dual` arity and was a required bug; EF-18.   evidence: `rg 'footnoteReferenceFallback|gfmLinkCloseConstruct|insertStrikethrough\(' scratchpad/test/markdown` returns nothing: no test calls the data-last overloads `footnoteReferenceFallback(opener, bracketPos, afterBracket)` (footnoteReference.ts:95) or `insertStrikethrough(opener, closer)` (strikethrough.ts:135). Per-file 100% coverage cannot see this gap because `dual`'s arity branch lives in effect/Function, not in the module file; the only exercise is each docgen Example printing `typeof ... // function`. scanDelims' curried form, by contrast, is asserted in delimiter-run.test.ts:48. I verified by reading that the arities (4 and 3) match the overload lists, so this is a test gap, not a bug.
- failure: A future drift between the hand-written overload signature and the `dual` arity (exactly the class of bug round 1 found in Markdown.ts) would pass tsgo, coverage and docgen for these two exports.
- fix: In FootnoteReference.property.test.ts (or a new footnote coverage test) assert `footnoteReferenceFallback(opener, bracketPos, afterBracket)(scanner)` and `footnoteReferenceFallback(scanner, opener, bracketPos, afterBracket)` produce the same node list on a `[^a]` subject with a matching label; in Strikethrough.coverage.test.ts assert `insertStrikethrough(opener, closer)(scanner)` equals the data-first result (same `resume` delimiter and `delete` node) on a two-delimiter stack.

### fable-2-11
- file: scratchpad/test/markdown/internal/inlines/codeSpan.property.test.ts:18
- class: test   severity: backlog
- standard: .patterns/testing-patterns.md / canon SPEC D1 (canonical idioms, shared support modules under `test/**`); §11.1 permits local helpers; no law broken, so backlog under D11.   evidence: `diff <(sed -n 1,55p codeSpan.property.test.ts) <(sed -n 1,55p entity.property.test.ts)` differs only in the `Sample`/`sources` lines (12-13) and the describe title (18): the four properties ("parse(stringify(parse(x))) preserves inline meaning", "canonical inline formatting is idempotent", "marker normalization is idempotent...", "README surgical-edit guarantee preserves surrounding bytes") plus the `meaning` JSON-stripping helper are pasted verbatim into 5 files (autolinkLiteral, autolink, codeSpan, emphasis, entity `.property.test.ts`). A second template ("surgical heading edits keep unrelated inline spelling...", "canonical formatting is idempotent", "parse(stringify(parse(x))) preserves every semantic mdast field" with the `semantic` helper) is pasted into 7 more (`diff Text.property.test.ts LineBreak.property.test.ts` differs only at lines 25-26). In both templates the surgical-edit property modifies the `# Target`/`# Original` heading, so the construct under test only has to survive as untouched bytes; the inline-specific signal is the first three properties.
- failure: Twelve files carry two 30-40 line property bodies by copy; a fix to the `meaning`/`semantic` key list or to the surgical-edit assertion has to be applied twelve times, and drift between copies is invisible to the gates.
- fix: Add `scratchpad/test/markdown/support/inlinePropertyFloor.ts` exporting `inlineParserPropertyFloor(name, sources)` and `inlineMdastPropertyFloor(name, sources, word)` that register the shared `it.effect.prop` cases; each inline property file keeps only its `Sample`/`sources` definition and any construct-specific property (e.g. autolinkLiteral.property.test.ts:57-77, emphasis.property.test.ts:85-103).

### fable-2-12
- file: scratchpad/effected/markdown/internal/inlines/footnoteReference.ts:94
- class: type-safety   severity: backlog
- standard: standards/effect-laws-v1.md law 21 (tersest equivalent form) by analogy; readability of the exported overload list. Does not reopen round-1 reject-8: the `dual` shape stays (missingPipeableSignature), only the parameter spelling changes.   evidence: footnoteReference.ts:94-96 spell every parameter as `Parameters<LinkCloseFallback>[0]` / `Parameters<LinkCloseFallback>[1]` three times each, although `LinkCloseFallback` is declared at link.ts:209-216 directly over the importable `InlineScanner` and `Bracket` from `../inlineTypes.ts` (already imported by link.ts:28). The indirection adds nothing the type checker needs and hides the real types from hover and from the docgen signature.
- failure: The public overload list of `footnoteReferenceFallback` reads as an indexed-tuple puzzle instead of `(scanner: InlineScanner, opener: Bracket, bracketPos: number, afterBracket: number)`; a reader must open link.ts to learn what `[0]` and `[1]` are.
- fix: Import `type { Bracket, InlineScanner } from "../inlineTypes.ts"` and replace the six `Parameters<LinkCloseFallback>[n]` occurrences at :94-96 with `InlineScanner` / `Bracket`; keep `dual(4, ...)` and the `LinkCloseFallback` type import for the `makeLinkCloseConstruct` seam.

REQUIRED: 8
BACKLOG: 4
