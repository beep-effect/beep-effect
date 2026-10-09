### sol-1-1
- file: scratchpad/effected/markdown/MarkdownFormat.ts:689
- class: bug   severity: required
- standard: D9 and section 14, verified upstream bug; `MarkdownFormat.formatToString` promises total formatting and independently applicable marker options.   evidence: Read-only Bun probes against both the port and pinned oracle formatted `"*Title*\n=======\n"` with `{ headingStyle: "atx", emphasisChar: "_" }`. Both returned edits `{ offset: 0, length: 15, content: "# *Title*" }`, `{ offset: 0, length: 1, content: "_" }`, and `{ offset: 6, length: 1, content: "_" }`. Applying them threw `MarkdownEdit.applyAll received overlapping edits at offsets 0 and 6`.
- failure: Converting a heading replaces its entire source span, while the subsequent walk also emits emphasis edits inside that span. A valid combination of formatting options makes `formatToString` throw and makes `format` return an unusable edit array.
- fix: Compose descendant marker changes into the heading replacement and suppress their separate source edits when the whole-heading edit is emitted. Preserve both requested normalizations in one pass; add the combined-options regression and record the verified upstream-bug deviation.

### sol-1-2
- file: scratchpad/effected/markdown/MarkdownFormat.ts:802
- class: bug   severity: required
- standard: D9 and section 14, verified upstream bug; the modifier’s replacement-fidelity contract and the stringifier’s existing GFM table-cell escaping rule.   evidence: In both the port and pinned oracle, parse `"| h |\n| - |\n| x |\n"`, select the second `tableCell`, and replace it with `InlineCode.make({ value: "a|b" })`. `modifyToString` succeeds with `"| h |\n| - |\n| \u0060a|b\u0060 |\n"`. Reparsing yields body-cell text `"\u0060a"` instead of an inline-code node containing `"a|b"`.
- failure: Phrasing replacements render inside a synthetic paragraph, losing the destination table-cell context. An unescaped pipe inside code, HTML, or a link destination becomes a column boundary and can discard replacement content.
- fix: Apply the stringifier’s existing parity-aware cell-pipe escaping to rendered replacements whenever the destination is a table cell or lies inside one. Add a code-span-with-pipe regression and record the verified upstream-bug deviation.

### sol-1-3
- file: scratchpad/effected/markdown/FrontmatterResolver.ts:244
- class: bug   severity: required
- standard: D9 and section 14, verified upstream bug; the resolver’s committed `X[.Y[.Z]]` non-negative-integer grammar and exact version-segment equality contract.   evidence: Read-only probes against both implementations registered `"skill@9007199254740992"` and resolved a classified `"skill@9007199254740993"` declaration. Both returned the registered schema. Registering both distinct versions instead threw a collision on version `9007199254740992`.
- failure: `Number.parseInt` rounds valid integer segments beyond the safe-integer range. Distinct legal versions select the wrong schema or are rejected as duplicate registrations. The grammar imposes no safe-integer bound.
- fix: Canonicalize validated segments as decimal strings, removing leading zeros while retaining one zero, and compare/join those strings. This preserves leading-zero equivalence and segment-count semantics without rounding. Add the adjacent-large-integer regression and record the verified upstream-bug deviation.

### sol-1-4
- file: scratchpad/effected/markdown/MarkdownDiagnostic.ts:103
- class: bug   severity: required
- standard: D9 and section 14, verified upstream bug; the diagnostic’s zero-based source-position contract and the existing newline-position test in `scratchpad/test/markdown/diagnostic.test.ts`.   evidence: In both implementations, `MarkdownDiagnostic.fromRaw("a\r\nb", { code: "NestingDepthExceeded", message: "probe", offset: 2, length: 0 })` returns `{ line: 1, character: -1 }`.
- failure: When the offset points at the LF within a CRLF pair, the loop consumes that LF beyond its scan limit and moves `lineStart` past the requested offset. The resulting negative character position is invalid for editor diagnostics.
- fix: Advance past a CRLF pair and update the line start only when the complete pair precedes the requested offset. Keep positions on the terminator pair on the preceding line. Add the CRLF-interior regression and record the verified upstream-bug deviation.

### sol-1-5
- file: scratchpad/effected/markdown/MarkdownEdit.ts:86
- class: law   severity: required
- standard: `standards/effect-laws-v1.md`, law 10: no native `Array.prototype.sort`; use `A.sort` with explicit `Order`.   evidence: `applyAll` still executes `[...edits].sort((a, b) => b.offset - a.offset)` at the reviewed commit. The reported green gates missed this concrete site; the markdown allowlist entries cover `internal/blockParser.ts` and `internal/patterns.ts`, with no sorting exception for this file.
- failure: The production edit-application path retains an explicitly forbidden native collection operation despite the completed law pass.
- fix: Replace the copied-array native sort with `A.sort` and an explicit descending order on `offset`, preserving equal-offset ordering and non-mutation.

### sol-1-6
- file: scratchpad/effected/markdown/Frontmatter.ts:148
- class: schema   severity: required
- standard: `standards/effect-laws-v1.md`, law 19; AGENTS.md Code Laws; D5’s `LiteralKit` requirement for named literal domains.   evidence: Named, reused, annotation-bearing domains remain `S.Literals`: `FrontmatterMissingReason` here, `FrontmatterNewline` in `FrontmatterSource.ts:29`, `MarkdownDialect` in `Markdown.ts:43`, `MarkdownParseErrorCode` in `MarkdownDiagnostic.ts:23`, and `CodeBlockStyle` and `MarkdownModificationErrorCode` in `MarkdownFormat.ts:88` and `:143`. These are not anonymous inline unions.
- failure: These domain schemas bypass the required shared literal-kit representation and its derived enum, guard, and matching surface. The green gates have not enforced this named-domain requirement.
- fix: Construct these domains with `LiteralKit`, retaining their current literals, same-name type aliases, identity annotations, and accepted values.

### sol-1-7
- file: scratchpad/effected/markdown/MarkdownDocument.ts:62
- class: schema   severity: required
- standard: `standards/ARCHITECTURE.md`, principle 5, “Schemas Are Executable Contracts”; `standards/effect-first-development.md`, EF-3; `standards/schema-first-development-prompt.md`, “Schema owns pure data.”   evidence: `DocumentHeading`, `DocumentLink` at line 205, and `SectionQueryOptions` at line 161 are exported interfaces describing navigation payloads and query configuration. None has a runtime schema or a schema-derived type; they are not service contracts or type-level utilities.
- failure: These exported data shapes have no executable schema from which validation, encoding, or arbitrary generation can be derived, contrary to the binding schema-first model requirement.
- fix: Define identity-annotated schemas for the three shapes and derive their same-name types. `S.Struct` can preserve the existing plain-object shape and optional-key contracts without changing navigation results or requiring class instances.

### sol-1-8
- file: scratchpad/effected/markdown/Frontmatter.ts:30
- class: jsdoc   severity: backlog
- standard: `.patterns/jsdoc-documentation.md`, Hard requirements, Carrier policy, and Kind-split Example law; explicitly deferred S2 under this review brief.   evidence: The focused files retain forbidden `@remarks` and `@example` carriers, use `@public` without the required canonical `@category` and `@since 0.0.0`, and leave many exported runtime schemas and classes without examples. Examples include `FrontmatterFormatMismatchError`, `FrontmatterMissingReason`, and `JsonFrontmatter`.
- failure: The carried documentation does not yet meet the repository’s public API documentation contract.
- fix: During S2, preserve the upstream prose while converting carriers to `**Details**` and titled `**Example** (Title)` sections; add canonical categories, since tags, and meaningful compilable examples for value exports.

### sol-1-9
- file: scratchpad/test/markdown/frontmatter-resolver.test.ts:158
- class: test   severity: backlog
- standard: D10 and `goals/effect-vitest-canon/SPEC.md` §1.3; explicitly deferred S3 under this review brief.   evidence: Property options use literal `{ arbitrary: { runs: 300 } }` here and `{ runs: 200 }` at line 182. The related frontmatter schema/write properties likewise use literal run counts, with no `fcRuns` use in the inspected property suites.
- failure: These property tests bypass the required shared run-count configuration, so the repository’s environment-controlled property budget does not govern them.
- fix: During S3, obtain property options through `fcRuns(n)`, retaining each intended baseline count and any additional size settings.

### sol-1-10
- file: scratchpad/test/markdown/edit.test.ts:18
- class: test   severity: backlog
- standard: D10: every exported schema or codec requires an encode/decode round-trip property through `Arbitrary.schema`; explicitly deferred S3 under this review brief.   evidence: The edit suite tests `MarkdownRange` construction/equality and `MarkdownEdit.applyAll` examples and generated splice behavior, but contains no schema-generated encode/decode round-trip property for `MarkdownRange` or `MarkdownEdit`.
- failure: These exported schemas do not yet satisfy the required schema property floor. Generated splice tests exercise edit application rather than schema encoding and decoding.
- fix: During S3, add schema-generated encode/decode round-trip properties for both exported schemas using `Arbitrary.schema`, canonical structural assertions, and `fcRuns`.

REQUIRED: 7
BACKLOG: 3