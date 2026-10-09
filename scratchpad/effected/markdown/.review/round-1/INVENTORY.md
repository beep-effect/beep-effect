# Markdown — round-1 merged inventory

Reviewed commit: `3fa5876691901fccf3d1cd29e9324564df134b56`; branch: `@lab/effected`.
Seats read: all 12 reports (Grok, Sol and Fable for parts 1–4), all four adjacent briefs; part-4/grok reports NO FINDINGS. 86 input records accounted for. Seat references are part-qualified because original finding ids repeat across parts.
Counts after deduplication: Required **42**; Backlog **17**; Handled by deviation codemod **2**; Rejected **8**; Groups **11**.

The complete operator revision block (including both 2026-10-09 rulings), D1–D20, §§12.4–12.5 and §14 bind this merge. Evidence below is retained seat evidence unless expressly identified as the current read-only rule-source inspection. No tests, benchmarks, gates or implementations were rerun here.
Independent declarations bundled in one seat record are separated only where needed for non-overlapping ownership; duplicate reports of the same defect remain merged. The public native-constructor defect (allow-1) and the already-existing inline facade/contracts (req-25) are separate staged surfaces: integrate g2 before g1, then run the module gate after both. Every source/test path belongs to one group and every group owns at most six source files. New regression paths are planned files, not files created by this inventory.
Group ownership is in required.json. g1 covers parse/document/errors/edit; g2 the inline contracts and dispatch; g3 nodes/mdast/table types; g4 formatting; g5 frontmatter domain; g6 newline domain; g7 resolver; g8 line index; g9 serializer/segments; g10 inline delimiter/autolink/HTML logic; g11 clone construction. g10 and g2 use dedicated new regression files so they do not overlap g1’s parser-call migrations.
Ledger, Port notes, exportsAdded and allowlist-config bookkeeping stay central. Required bug repairs provide evidence/test references to that central path; they do not assign repo configuration, root package.json, bun.lock, PORT_LEDGER.json or README Port-notes writes. S2/S3 findings remain backlog. Native errors, S.Number restoration and new native-runtime exceptions are rejected. The enabled missingPipeableSignature source explicitly covers exported arrows/callbacks; wrappers forced by it are retained.

## Required

### req-1 — Heading replacement overlaps descendant marker edits
- file: scratchpad/effected/markdown/MarkdownFormat.ts:689
- class: bug   severity: required
- standard: D9 and section 14, verified upstream bug; `MarkdownFormat.formatToString` promises total formatting and independently applicable marker options.   evidence: Read-only Bun probes against both the port and pinned oracle formatted `"*Title*\n=======\n"` with `{ headingStyle: "atx", emphasisChar: "_" }`. Both returned edits `{ offset: 0, length: 15, content: "# *Title*" }`, `{ offset: 0, length: 1, content: "_" }`, and `{ offset: 6, length: 1, content: "_" }`. Applying them threw `MarkdownEdit.applyAll received overlapping edits at offsets 0 and 6`.
- failure: Converting a heading replaces its entire source span, while the subsequent walk also emits emphasis edits inside that span. A valid combination of formatting options makes `formatToString` throw and makes `format` return an unusable edit array.
- fix: Compose descendant marker normalizations into the whole-heading replacement and suppress overlapping child edits. Add the combined headingStyle/emphasisChar regression. Supply upstream-bug evidence and adjusted-test references to the central deviation codemod; do not edit ledger or Port notes.
- seats: part-1/sol-1-1

### req-2 — Table-cell replacements lose pipe-escaping context
- file: scratchpad/effected/markdown/MarkdownFormat.ts:802
- class: bug   severity: required
- standard: D9 and section 14, verified upstream bug; the modifier’s replacement-fidelity contract and the stringifier’s existing GFM table-cell escaping rule.   evidence: In both the port and pinned oracle, parse `"| h |\n| - |\n| x |\n"`, select the second `tableCell`, and replace it with `InlineCode.make({ value: "a|b" })`. `modifyToString` succeeds with `"| h |\n| - |\n| \u0060a|b\u0060 |\n"`. Reparsing yields body-cell text `"\u0060a"` instead of an inline-code node containing `"a|b"`.
- failure: Phrasing replacements render inside a synthetic paragraph, losing the destination table-cell context. An unescaped pipe inside code, HTML, or a link destination becomes a column boundary and can discard replacement content.
- fix: Apply the existing parity-aware table-cell pipe escaping to replacements in a cell or its descendants. Add the inline-code-with-pipe replacement regression and provide upstream-bug evidence to central bookkeeping.
- seats: part-1/sol-1-2

### req-3 — Large frontmatter version segments alias through numeric rounding
- file: scratchpad/effected/markdown/FrontmatterResolver.ts:244
- class: bug   severity: required
- standard: D9 and section 14, verified upstream bug; the resolver’s committed `X[.Y[.Z]]` non-negative-integer grammar and exact version-segment equality contract.   evidence: Read-only probes against both implementations registered `"skill@9007199254740992"` and resolved a classified `"skill@9007199254740993"` declaration. Both returned the registered schema. Registering both distinct versions instead threw a collision on version `9007199254740992`.
- failure: `Number.parseInt` rounds valid integer segments beyond the safe-integer range. Distinct legal versions select the wrong schema or are rejected as duplicate registrations. The grammar imposes no safe-integer bound.
- fix: Canonicalize validated version segments as decimal strings, preserving leading-zero equivalence and segment count. Compare and join strings without Number.parseInt. Add adjacent integers above MAX_SAFE_INTEGER as a regression and provide the upstream-bug receipt centrally.
- seats: part-1/sol-1-3

### req-4 — CRLF-interior diagnostic reports a negative character
- file: scratchpad/effected/markdown/MarkdownDiagnostic.ts:103
- class: bug   severity: required
- standard: D9 and section 14, verified upstream bug; the diagnostic’s zero-based source-position contract and the existing newline-position test in `scratchpad/test/markdown/diagnostic.test.ts`.   evidence: In both implementations, `MarkdownDiagnostic.fromRaw("a\r\nb", { code: "NestingDepthExceeded", message: "probe", offset: 2, length: 0 })` returns `{ line: 1, character: -1 }`.
- failure: When the offset points at the LF within a CRLF pair, the loop consumes that LF beyond its scan limit and moves `lineStart` past the requested offset. The resulting negative character position is invalid for editor diagnostics.
- fix: Consume a CRLF pair only when the complete terminator precedes the requested offset, keeping terminator positions on the preceding line. Add the offset-2 regression for a\r\nb and provide upstream-bug evidence centrally.
- seats: part-1/sol-1-4, part-1/grok-1-6

### req-5 — Native edit sort survived the green law pass
- file: scratchpad/effected/markdown/MarkdownEdit.ts:86
- class: law   severity: required
- standard: `standards/effect-laws-v1.md`, law 10: no native `Array.prototype.sort`; use `A.sort` with explicit `Order`.   evidence: `applyAll` still executes `[...edits].sort((a, b) => b.offset - a.offset)` at the reviewed commit. The reported green gates missed this concrete site; the markdown allowlist entries cover `internal/blockParser.ts` and `internal/patterns.ts`, with no sorting exception for this file.
- failure: The production edit-application path retains an explicitly forbidden native collection operation despite the completed law pass.
- fix: Use A.sort with an explicit descending offset Order, preserving stable equal-offset ordering and non-mutation. Retain upstream edit tests.
- seats: part-1/sol-1-5, part-1/grok-1-1

### req-6a — Named literal domains require LiteralKit: FrontmatterMissingReason
- file: scratchpad/effected/markdown/Frontmatter.ts:148
- class: schema   severity: required
- standard: `standards/effect-laws-v1.md`, law 19; AGENTS.md Code Laws; D5’s `LiteralKit` requirement for named literal domains.   evidence: FrontmatterMissingReason are named, reused S.Literals exports with annotations, rather than anonymous inline unions; the green gates missed these declarations.
- failure: The named domain lacks the required schema-derived Enum, is and match surface.
- fix: Construct FrontmatterMissingReason with LiteralKit; preserve members, same-name type exports, identities and accepted values. Retain existing tests.
- seats: part-1/sol-1-6

### req-6b — Named literal domains require LiteralKit: FrontmatterNewline
- file: scratchpad/effected/markdown/FrontmatterSource.ts:29
- class: schema   severity: required
- standard: `standards/effect-laws-v1.md`, law 19; AGENTS.md Code Laws; D5’s `LiteralKit` requirement for named literal domains.   evidence: FrontmatterNewline are named, reused S.Literals exports with annotations, rather than anonymous inline unions; the green gates missed these declarations.
- failure: The named domain lacks the required schema-derived Enum, is and match surface.
- fix: Construct FrontmatterNewline with LiteralKit; preserve members, same-name type exports, identities and accepted values. Retain existing tests.
- seats: part-1/sol-1-6

### req-6c — Named literal domains require LiteralKit: MarkdownDialect
- file: scratchpad/effected/markdown/Markdown.ts:43
- class: schema   severity: required
- standard: `standards/effect-laws-v1.md`, law 19; AGENTS.md Code Laws; D5’s `LiteralKit` requirement for named literal domains.   evidence: MarkdownDialect are named, reused S.Literals exports with annotations, rather than anonymous inline unions; the green gates missed these declarations.
- failure: The named domain lacks the required schema-derived Enum, is and match surface.
- fix: Construct MarkdownDialect with LiteralKit; preserve members, same-name type exports, identities and accepted values. Retain existing tests.
- seats: part-1/sol-1-6

### req-6d — Named literal domains require LiteralKit: MarkdownParseErrorCode
- file: scratchpad/effected/markdown/MarkdownDiagnostic.ts:23
- class: schema   severity: required
- standard: `standards/effect-laws-v1.md`, law 19; AGENTS.md Code Laws; D5’s `LiteralKit` requirement for named literal domains.   evidence: MarkdownParseErrorCode are named, reused S.Literals exports with annotations, rather than anonymous inline unions; the green gates missed these declarations.
- failure: The named domain lacks the required schema-derived Enum, is and match surface.
- fix: Construct MarkdownParseErrorCode with LiteralKit; preserve members, same-name type exports, identities and accepted values. Retain existing tests.
- seats: part-1/sol-1-6

### req-6e — Named literal domains require LiteralKit: CodeBlockStyle and MarkdownModificationErrorCode
- file: scratchpad/effected/markdown/MarkdownFormat.ts:88
- class: schema   severity: required
- standard: `standards/effect-laws-v1.md`, law 19; AGENTS.md Code Laws; D5’s `LiteralKit` requirement for named literal domains.   evidence: CodeBlockStyle and MarkdownModificationErrorCode are named, reused S.Literals exports with annotations, rather than anonymous inline unions; the green gates missed these declarations.
- failure: The named domain lacks the required schema-derived Enum, is and match surface.
- fix: Construct CodeBlockStyle and MarkdownModificationErrorCode with LiteralKit; preserve members, same-name type exports, identities and accepted values. Retain existing tests.
- seats: part-1/sol-1-6

### req-7 — Navigation payloads and query options lack schemas
- file: scratchpad/effected/markdown/MarkdownDocument.ts:62
- class: schema   severity: required
- standard: `standards/ARCHITECTURE.md`, principle 5, “Schemas Are Executable Contracts”; `standards/effect-first-development.md`, EF-3; `standards/schema-first-development-prompt.md`, “Schema owns pure data.”   evidence: `DocumentHeading`, `DocumentLink` at line 205, and `SectionQueryOptions` at line 161 are exported interfaces describing navigation payloads and query configuration. None has a runtime schema or a schema-derived type; they are not service contracts or type-level utilities.
- failure: These exported data shapes have no executable schema from which validation, encoding, or arbitrary generation can be derived, contrary to the binding schema-first model requirement.
- fix: Define identity-annotated S.Struct schemas for DocumentHeading, DocumentLink and SectionQueryOptions; derive the same-name types and preserve plain-object results and optional-key contracts. Keep navigation tests intact.
- seats: part-1/sol-1-7

### req-8 — Replacement and parent domains use widened membership tables
- file: scratchpad/effected/markdown/MarkdownFormat.ts:525
- class: schema   severity: required
- standard: AGENTS.md Code Laws ('Prefer named schema building blocks, derived S.is(...) guards, and named LiteralKit internal domains over ad-hoc predicate helpers'); standards/effect-laws-v1.md law 19 (LiteralKit for named internal literal domains, especially when .is is part of the design); D5 (kit substitutions land in S4); precedent scratchpad/effected/jsonc/JsoncNode.ts:111 JsoncNodeType = LiteralKit([...])   evidence: Five named literal domains over MarkdownNodeType are HashSet.fromIterable<string> tables consumed only by HashSet.has: FLOW_TYPES :525, PHRASING_TYPES :539, FLOW_PARENTS :559, PHRASING_PARENTS :562, NO_MULTILINE_ANCESTORS :574; two hand-written guards isFlowReplacement :554 and isPhrasingReplacement :556 assert node is FlowContent / PhrasingContent from string membership. The explicit <string> type parameter widens every table so a misspelled member still compiles. Soundness of the current guards verified: FLOW_TYPES is a subset of the FlowContent union members (MarkdownNode.ts:784-796) and PHRASING_TYPES of PhrasingContent (:480-495). No LiteralKit import exists in the module (rg -l LiteralKit scratchpad/effected/markdown is empty).
- failure: The module's literal domains are untyped membership tables plus ad-hoc predicates instead of named kits with derived .is guards, below the D5 end-state bar the closed modules reached; MarkdownNodeType typos in these tables are not caught by tsgo.
- fix: Replace FLOW_TYPES, PHRASING_TYPES, FLOW_PARENTS, PHRASING_PARENTS and NO_MULTILINE_ANCESTORS with named LiteralKit domains. Use schema-derived guards for FlowContent/PhrasingContent and kit guards for parent membership, preserving the same accepted node kinds.
- seats: part-1/fable-1-3

### req-9 — OverlappingMarkdownEditsError lacks schema intent annotations
- file: scratchpad/effected/markdown/MarkdownEdit.ts:26
- class: schema   severity: required
- standard: D5; operator Identity step; standards/effect-first-development.md EF-12.   evidence: OverlappingMarkdownEditsError is declared with the $I identity template but no $I.annote(...) third argument, while the other two port-added internal errors carry one (FrontmatterResolver.ts:26-33 SchemaRegistryError, MarkdownDocument.ts:42-49 DocumentNavigationError).
- failure: The error has an identity but no description annotation, so catalog and docgen surfaces show it blank; inconsistent with its siblings.
- fix: Add meaningful IdentityComposer error/schema annotations and annotate the message payload without changing the error tag or message.
- seats: part-1/fable-1-9

### req-10 — parseBlocks advertises an ambiguous curried overload
- file: scratchpad/effected/markdown/internal/blockParser.ts:689
- class: bug   severity: required
- standard: D2, D11; reproduced callable-contract bug; tsconfig.base.json:176 missingPipeableSignature and effect-tsgo/internal/rules/missing_pipeable_signature.go.   evidence: A read-only Bun probe of `parseBlocks("gfm")("~~x~~\n")` throws `TypeError: parseBlocks("gfm") is not a function`. Both `parseBlocks("gfm")` and `parseBlocks("gfm", undefined)` return a `BlockPassResult`, although the curried overload promises a function.
- failure: The discriminator treats a first string argument as document text unless the second argument is boolean. A dialect-only curried call therefore parses the dialect name as a document. The original one-argument data-first call and the new dialect-only data-last call are indistinguishable at runtime.
- fix: Use an options-object callable contract: parseBlocks(text, options?) and parseBlocks(options?)(text), with dialect/frontmatter in the options object and string-first dispatch. Update Markdown.ts and every direct parser test call, preserving parsed output and defaults. This is forced by the demonstrated ambiguous overload plus missingPipeableSignature, not an unforced removal of dual. Add direct/curried contract regressions. Supply the law/diagnostic-driven API deviation centrally.
- seats: part-2/sol-1-1, part-2/fable-1-1

### req-11 — Foreign mdast code loses a content newline
- file: scratchpad/effected/markdown/Mdast.ts:396
- class: bug   severity: required
- standard: D9 and section 14, verified upstream bug; the inverse projection contract documented at `Mdast.ts:81`; D10 fidelity property.   evidence: In both the port and the pinned oracle, projecting `fromMdastResult({ type: "root", children: [{ type: "code", value: "body\n" }] })` back through `toMdast` produces `"body"`. Parsing the document `"```\nbody\n\n```\n"` and applying `toMdast → fromMdastResult → toMdast` likewise changes the code value from `"body\n"` to `"body"`.
- failure: A trailing newline in a foreign mdast code value represents content. Admission assumes it already supplies the engine’s extra carried terminator, and projection subsequently strips that content newline. Code blocks lose their trailing blank line during an otherwise successful round trip.
- fix: Append the engine terminator to every nonempty incoming mdast code value, even when content already ends with LF. Add LF/CRLF content round trips; provide the verified upstream-bug receipt centrally.
- seats: part-2/sol-1-2

### req-12 — Foreign association labels are decoded twice
- file: scratchpad/effected/markdown/Mdast.ts:389
- class: bug   severity: required
- standard: D9 and section 14, verified upstream bug; the parsed-label/source-label boundary documented at `Mdast.ts:88`; `scratchpad/test/markdown/mdast.test.ts:92` and `:124`.   evidence: In both the port and the pinned oracle, a foreign definition with `label: "&amp;"` projects back with `label: "&"`; `label: "a\\*"` projects back as `"a*"`. A parsed document containing `[&amp;amp;]: /u` also changes its projected label from `"&amp;"` to `"&"` after `toMdast → fromMdastResult → toMdast`.
- failure: Foreign mdast labels are already decoded text, but admission copies them into fields whose internal contract is source spelling. `projectLabel` then decodes them again. Literal entity-like text and backslashes are lost from definition, reference and footnote labels.
- fix: Encode foreign decoded Association labels into source spelling that unescapeString decodes exactly once, protecting literal ampersands and backslashes; leave identifiers unchanged. Add definition/reference/footnote label round trips and provide upstream-bug evidence centrally.
- seats: part-2/sol-1-3

### req-13 — Prototype-property node kinds throw outside the Result boundary
- file: scratchpad/effected/markdown/Mdast.ts:381
- class: bug   severity: required
- standard: D9 and section 14, verified upstream bug; EF-3’s non-throwing synchronous decode boundary; the unknown-node failure contract at `Mdast.ts:346` and `scratchpad/test/markdown/mdast.test.ts:239`.   evidence: Read-only probes against both the port and the pinned oracle return `Failure` for an unknown node type `"unknown"`, but throw `TypeError: {} is not iterable` for `"toString"`, `"constructor"` and `"__proto__"`.
- failure: `admittedFields[type]` reads inherited object properties. These unknown node types obtain a prototype function or object instead of an admission-field array and throw before schema decoding. `fromMdastResult` escapes its Result channel; the Effect twin turns the same input into a defect.
- fix: Use R.get or a HashMap for own-key admission-field lookup, allowing unknown kinds to reach schema decoding. Extend unknown-node regressions with toString, constructor and __proto__; provide upstream-bug evidence centrally.
- seats: part-2/sol-1-4

### req-14 — Raw engine error carriers are not schema-backed
- file: scratchpad/effected/markdown/internal/carriers.ts:28
- class: law   severity: required
- standard: `standards/effect-laws-v1.md` law 7; `standards/effect-first-development.md` EF-1; D5’s schema-backed error requirement.   evidence: `RawMarkdownError` at line 28 and `GuardExceeded` at line 50 extend `Data.TaggedError`. A runtime probe confirms both constructors have `ast === undefined` and no `.make`. No applicable error-carrier exception is recorded in the allowlist. These declarations remain in the supplied green commit.
- failure: The engine’s cross-module error carriers have TypeScript payloads but no executable schema contract. They cannot participate in schema decoding, encoding or schema-derived arbitrary generation, and they do not satisfy the mandated direct `S.TaggedError` pattern.
- fix: Derive RawMarkdownError and GuardExceeded directly from S.TaggedError with IdentityComposer identities and annotated payloads. Preserve tags, messages, positional constructor spellings and facade catch behavior, including existing diagnostic tests; supply forced changes to central bookkeeping.
- seats: part-2/sol-1-5, part-2/fable-1-10

### req-15 — Suspended node unions and MDX fields missed identity annotations
- file: scratchpad/effected/markdown/MarkdownNode.ts:479
- class: schema   severity: required
- standard: D5; operator step 4 requiring identity and annotations on schemas and fields; `standards/effect-first-development.md` EF-12.   evidence: Runtime inspection shows `ast.annotations === undefined` for all seven exported suspended schemas: `PhrasingContent`, `FlowContent`, `ListContent`, `RowContent`, `TableContent`, `FrontmatterContent` and `MarkdownNode`. The checked MDX class fields also omit key annotations—for example, `MdxJsxAttribute.fields.name.ast.annotations` is undefined. These omissions remain despite the supplied green gates.
- failure: The schema graph lacks the required named identities and intent metadata at its exported category boundaries. The checked MDX classes also leave their fields outside the required annotation pass.
- fix: Annotate PhrasingContent, FlowContent, ListContent, RowContent, TableContent, FrontmatterContent and MarkdownNode with IdentityComposer schema metadata. Add meaningful key annotations to MdxJsxAttribute, MdxJsxFlowElement and MdxJsxTextElement fields; preserve encoded shapes.
- seats: part-2/sol-1-6

### req-16 — Eleven named node literal domains bypass LiteralKit
- file: scratchpad/effected/markdown/MarkdownNode.ts:106
- class: schema   severity: required
- standard: D5’s `LiteralKit` requirement; `standards/effect-laws-v1.md` law 19; `standards/effect-first-development.md` EF-12b.   evidence: Eleven named, reused, annotation-bearing literal domains remain `S.Literals`: `ReferenceType`, `HeadingStyle`, `BreakStyle`, `FenceChar`, `BulletChar`, `ListDelimiter`, `ThematicBreakChar`, `EmphasisChar`, `HeadingDepth`, `TableAlign` and `FrontmatterFormat`. A runtime probe of `ReferenceType` confirms `.Enum`, `.is` and `.$match` are absent. The supplied green gates leave these named domains unchanged.
- failure: These schemas use the constructor reserved for anonymous inline unions and omit the required schema-derived literal-domain API.
- fix: Use LiteralKit for ReferenceType, HeadingStyle, BreakStyle, FenceChar, BulletChar, ListDelimiter, ThematicBreakChar, EmphasisChar, HeadingDepth, TableAlign and FrontmatterFormat. Preserve members, same-name types and identities; keep anonymous escapeStyle as S.Literals.
- seats: part-2/sol-1-7, part-2/grok-1-1

### req-17 — Inline materialization uses a conditional dispatch ladder
- file: scratchpad/effected/markdown/internal/inlineParser.ts:545
- class: effect-idiom   severity: required
- standard: `AGENTS.md`, “Prefer match helpers over conditional chains”; `standards/effect-first-development.md` EF-7; D11.   evidence: The upstream `materializeNode` switch has been replaced by an eleven-arm `if`/`else if` chain over `node.type`, ending in a catch-all `undefined`. The supplied green gates accept this chain.
- failure: Finite node-kind dispatch still uses the conditional ladder explicitly rejected by the cited standard. Replacing `switch` with chained conditionals clears the switch prohibition without implementing the required match-based dispatch.
- fix: Build a module-scope Match.type<InlineNode>() dispatcher and preserve every node construction and fallback. Do not restore switch (law 11) or rebuild a matcher for each node.
- seats: part-2/sol-1-8, part-2/fable-1-7

### req-18 — Per-node mdast matcher rebuilding causes a measured regression
- file: scratchpad/effected/markdown/Mdast.ts:117
- class: perf   severity: required
- standard: D11: performance finding with a measured regression versus upstream.   evidence: `Match.value(node).pipe(Match.discriminator("type")(...) x 25, Match.exhaustive)` rebuilds the whole matcher chain on every `projectNode` call. bun bench on a 146 kB GFM document (31,601 nodes), same port-parsed tree fed to both, min of 7 runs over two rounds: port `Mdast.toMdast` 55.9-70.0 ms vs upstream 2.4-11.8 ms (ratio of mins 23.45x); outputs byte-identical (`JSON.stringify` equal).
- failure: `Mdast.toMdast` is roughly 20x slower than upstream for identical output; matcher allocation dominates projection.
- fix: Build the full Match.type<AnyNode>() dispatcher once at module scope; compute projectPosition inside its arms. Preserve byte-identical projection and rerun the reported benchmark. Do not restore switch, which contradicts law 11.
- seats: part-2/fable-1-3

### req-19 — Tall tables exceed Node argument limits during serialization
- file: scratchpad/effected/markdown/internal/stringify.ts:1008
- class: bug   severity: required
- standard: D9, D11, and EFFECTED_PORT_GOAL.md §14 (`upstream-bug`, verified by reproduction)   evidence: A read-only Node probe constructed a schema-valid root containing a table with 150,000 repetitions of a constructed one-cell `TableRow`, then called `Markdown.stringifyResult(root)`. It threw `RangeError: Maximum call stack size exceeded`, with the first stack frame at `serializeTable:1008:27`. The same probe against the pinned oracle threw the same error at its `serializeTable:1018:27`. Bun returned `Success` for this input, so Bun execution does not expose the Node failure.
- failure: Computing the column count spreads one argument per table row into `Math.max`. A sufficiently tall, shallow table exceeds Node’s argument limit. Serialization throws outside the advertised `Result` failure channel even though the tree satisfies the schemas and stays below the nesting limit. This is an inherited upstream bug, with no recorded deviation covering it.
- fix: Replace Math.max(...rowCounts) with a reduction starting at one. Add a Node regression for a schema-valid 150000-row shallow table and provide the verified upstream-bug evidence centrally.
- seats: part-3/sol-1-1

### req-20 — Repeated source-offset scans make positioning quadratic
- file: scratchpad/effected/markdown/internal/segments.ts:31
- class: perf   severity: required
- standard: D11’s algorithmic-class criterion   evidence: Every `sourceOffsetAt` call restarts traversal at the first segment. `InlineParser.position` calls this helper for both endpoints of each materialized inline node. For a paragraph containing `n` lines of `a *b*\n`, there are Θ(n) segments and Θ(n) positioned nodes, producing Θ(n²) segment visits. A read-only helper probe querying every segment start counted 32,040,000 visits for 8,000 segments, 128,008,000 for 16,000, and 512,016,000 for 32,000; observed times were 38.50 ms, 149.84 ms, and 593.78 ms. The pinned oracle shares this implementation; required severity rests on the available algorithmic-class improvement, not a claimed port regression.
- failure: Source-position bookkeeping becomes quadratic on ordinary long paragraphs containing inline markup. Increasing paragraph length slows parsing disproportionately despite the already available ordered segment index.
- fix: Binary-search ordered segment starts for the last textOffset at or before the requested index. Preserve gaps, fallback and exclusive-end behavior; add boundary and long-paragraph regressions.
- seats: part-3/sol-1-2

### req-21 — Adjacent text siblings repeatedly rebuild the same suffix
- file: scratchpad/effected/markdown/internal/stringify.ts:612
- class: perf   severity: required
- standard: D11’s algorithmic-class criterion   evidence: For every text child, the loop revisits and concatenates all subsequent contiguous text siblings. A paragraph containing `n` one-character `Text("x")` children therefore performs exactly `n(n−1)/2` lookahead iterations, although these values need no following-text inspection to escape. A read-only serialization probe observed 48.59 ms for 4,000 siblings, 162.85 ms for 8,000, and 560.63 ms for 16,000, with successful output lengths of 4,001, 8,001, and 16,001. The pinned oracle contains the same unconditional suffix scan; required severity rests on the algorithmic-class improvement.
- failure: Serializing a valid synthesized paragraph with adjacent text nodes takes Θ(n²) work for Θ(n) output. Node boundaries introduced by editing or tree construction can make otherwise simple prose expensive to serialize.
- fix: Compute each contiguous text run endpoint and backing text once, then derive following-text views by node offsets. Preserve node boundaries and escapeStyle; add scaling and boundary-escaping regressions without merging nodes.
- seats: part-3/sol-1-3

### req-22a — InvalidLineTableError lacks schema and field metadata
- file: scratchpad/effected/markdown/internal/lineIndex.ts:12
- class: schema   severity: required
- standard: standards/effect-first-development.md EF-12; the completed Identity step requires annotations on schemas and fields   evidence: InvalidLineTableError has an IdentityComposer constructor identifier but lacks meaningful title/description metadata and the message field lacks annotations.
- failure: The completed Identity step omitted this error schema and its payload field.
- fix: Add meaningful IdentityComposer schema/error annotations to InvalidLineTableError and annotate message; retain the law-forced tagged error.
- seats: part-3/sol-1-4, part-3/fable-1-11

### req-22b — UnknownInlineDialectError lacks schema and field metadata
- file: scratchpad/effected/markdown/internal/inlineRegistry.ts:35
- class: schema   severity: required
- standard: standards/effect-first-development.md EF-12; the completed Identity step requires annotations on schemas and fields   evidence: UnknownInlineDialectError has an IdentityComposer constructor identifier but lacks meaningful title/description metadata and the message field lacks annotations.
- failure: The completed Identity step omitted this error schema and its payload field.
- fix: Add meaningful IdentityComposer schema/error annotations to UnknownInlineDialectError and annotate message; retain the law-forced tagged error.
- seats: part-3/sol-1-4, part-3/fable-1-11

### req-23 — Trigger dispatch retains a native-map facade
- file: scratchpad/effected/markdown/internal/inlineRegistry.ts:42
- class: effect-idiom   severity: required
- standard: standards/effect-laws-v1.md law 6 (no native Map in domain logic) and law 21 (tersest equivalent form); 2026-10-09 ruling rejecting shapes that "only evade the law"   evidence: `triggerTable` builds a MutableHashMap plus a parallel `entries` array and returns a 12-line object literal implementing the native `ReadonlyMap` interface (size/get/has/keys/values/entries/Symbol.iterator/forEach) so `beep laws native-runtime` (constructor-based scan) passes while `InlineDialect.byTrigger` at inlineTypes.ts:183 stays `ReadonlyMap<number, ...>`. Its only reader is inlineParser.ts:624 `this.dialect.byTrigger.get(code) ?? []`. Bun micro-bench (30M lookups): sparse-array index 11.3-12.1 ns vs facade 8.2 ns (noise); end-to-end A/B swapping the facade for a native Map moved the lab/upstream ratio 1.145 -> 1.225 (noise), so the fix is perf-neutral.
- failure: The dispatch table is typed and implemented as a native Map behind a hand-rolled facade: law 6 is evaded rather than met, every lookup allocates an Option it immediately unwraps, and ~30 lines of boilerplate exist to avoid changing one type and one read.
- fix: Use an Effect HashMap trigger table directly, changing InlineDialect.byTrigger and the InlineParser lookup to HashMap.get with Option handling. Preserve construct order within each bucket; retain explicit trigger order only where iteration is promised. Remove the ReadonlyMap facade and parallel imitation methods.
- seats: part-3/fable-1-2

### req-24 — Named Predicate imports bypass the namespace alias law
- file: scratchpad/effected/markdown/internal/rawInline.ts:10
- class: law   severity: required
- standard: standards/effect-laws-v1.md law 1 (A/O/P/R/S namespace aliases only)   evidence: `import { isFunction } from "effect/Predicate";` (rawInline.ts:10, used at :319) and the same at inlineParser.ts:44. `rg 'import \{[^}]*\} from "effect/Predicate"' packages --glob '**/src/**/*.ts'` returns 0 files; blockParser.ts:37 uses `import * as P from "effect/Predicate"`. The `effect-imports` gate only normalizes root-barrel imports (EffectImports.ts EFFECT_NAMESPACE_BINDINGS), so it let the named import through.
- failure: Two files bypass the `P` alias law the rest of the module and repo follow; the gate does not catch it.
- fix: Use import * as P from effect/Predicate and P.isFunction in both files. Retain diagnostic-required dual signatures.
- seats: part-3/fable-1-3

### req-25 — The inline reference seam still exposes native-map facades
- file: scratchpad/effected/markdown/internal/phrasing.ts:35
- class: law   severity: required
- standard: D5; effect-laws-v1 law 6; later operator public-collection ruling; required prerequisite to allow-1.   evidence: internal/phrasing.ts:35 implements EMPTY_REFMAP as a ReadonlyMap facade over HashMap. Native-shaped refmap contracts remain in inlineTypes.ts:83, rawInline.ts:77-82 and inlineParser.ts:118/140/667; inlines/link.ts:265 calls scanner.refmap.has.
- failure: Retiring the public native constructor alone leaves the inline parser on incompatible native collection contracts and retains the empty-map facade.
- fix: Migrate only the inline seam to HashMap.HashMap<string, Definition>: inlineTypes, rawInline and inlineParser signatures; HashMap.has in inlines/link; HashMap.empty in phrasing with the facade removed. Integrate this prerequisite with allow-1 before running the module gate.
- seats: part-3/fable-1-4

### req-26 — Inline dialect type duplicates the canonical literal domain
- file: scratchpad/effected/markdown/internal/inlineRegistry.ts:40
- class: schema   severity: required
- standard: law 19 / standing rule (no hand-rolled literal unions; one named literal domain)   evidence: `export type InlineDialectName = "commonmark" | "gfm";` duplicates the public `MarkdownDialect` schema (Markdown.ts:43, `S.Literals(["commonmark", "gfm"])`, type at :50) and the internal `blockRegistry.ts` `MarkdownDialect` alias, whose comment says the name doubles as the inline key.
- failure: Three spellings of one literal domain; widening the public union does not propagate to the inline registry.
- fix: Derive InlineDialectName through a type-only import of the existing canonical MarkdownDialect type in blockRegistry; preserve the runtime cycle firewall. Do not add a second literal union.
- seats: part-3/fable-1-12

### req-27 — RawNewline duplicates the frontmatter terminator domain
- file: scratchpad/effected/markdown/internal/blocks/frontmatter.ts:602
- class: schema   severity: required
- standard: law 19 (LiteralKit for named literal domains)   evidence: `export type RawNewline = "\n" | "\r\n" | "\r";` duplicates `FrontmatterNewline = S.Literals(["\n", "\r\n", "\r"])` (FrontmatterSource.ts:29, type :36); the cycle firewall forbids importing the public module from internal/.
- failure: Two spellings of the terminator domain; `terminatorAt` and `RawFrontmatterCapture.newline` are typed by the hand-rolled one.
- fix: Create one named LiteralKit RawNewline in the internal leaf and derive its type. Reuse it for identity-annotated FrontmatterNewline in FrontmatterSource, preserving the three accepted terminators and avoiding an internal-to-public runtime import.
- seats: part-3/fable-1-13

### req-28 — Table alignment type restates the named schema domain
- file: scratchpad/effected/markdown/internal/blocks/table.ts:346
- class: schema   severity: required
- standard: law 19 (named schema types over anonymous inline unions)   evidence: `alignmentsOf` returns `ReadonlyArray<"left" | "right" | "center" | null>` while `TableAlign` (MarkdownNode.ts, `S.Literals(["left", "right", "center"])`) is the named domain and `Table.align` is `TableAlign.pipe(S.NullOr, S.Array, S.optionalKey)` (MarkdownNode.ts:767).
- failure: The alignment literal set is restated inline instead of referencing the schema type it feeds.
- fix: Import the existing TableAlign type from MarkdownNode and return ReadonlyArray<TableAlign | null>; preserve runtime behavior.
- seats: part-3/fable-1-14

### req-29 — Decoded-prefix boundaries corrupt autolink source spans
- file: scratchpad/effected/markdown/internal/inlines/autolinkLiteral.ts:488
- class: bug   severity: required
- standard: D9 and section 14 (`upstream-bug`, demonstrated source-position failure); `InlineScanner`’s original-source position contract.   evidence: A read-only `bun -e` probe calling both the port’s `parseBlocks` and the pinned oracle’s `parseBlocks` on `"&#64;a@b.com"` produces a prefix text span `[0,1)` and an email link span `[1,12)`. The entity occupies `[0,5)`, and the literal email occupies `[5,12)`. `"\\!a@b.com"` similarly starts the link at offset 1 instead of 2. Neither bug is recorded in the module’s deviations.
- failure: At a decoded piece’s end, `localAt` maps the decoded value length into the source with `node.start + within`. That truncates the entity or escape’s source extent and includes part of it in the following email link. Consumers using the link position to replace or delete the address can corrupt the preceding entity or escape.
- fix: At a decoded piece end return piece.node.end, preserving existing interior-index mapping. Add entity/escape prefix and email-link span regressions and provide upstream-bug evidence centrally.
- seats: part-4/sol-1-1

### req-30 — Image-alt flattening drops leaf HTML and hard breaks
- file: scratchpad/effected/markdown/internal/inlines/link.ts:75
- class: bug   severity: required
- standard: D9 and section 14 (`upstream-bug`, demonstrated differential failure); `plainTextOf`’s stated contract to preserve the image description’s plain text.   evidence: Both port and pinned oracle flatten ![a\
b](u) to alt="ab", while CommonMark preserves a newline. They also flatten ![a <b>c](/u) to "a c", while commonmark.js, mdast-util-from-markdown and cmark-gfm preserve "a <b>c". Both are missing leaf cases in plainTextOf at link.ts:75.
- failure: Image descriptions lose hard-break separation and literal inline HTML, including reference images.
- fix: Preserve html.value and append a newline for break nodes in plainTextOf. Add both hard-break styles, raw tags/comments and reference-image regressions in image-alt.test.ts; provide verified upstream-bug evidence centrally.
- seats: part-4/sol-1-2, part-4/fable-1-1

### req-31 — Delimiter flanking classifies surrogate halves as characters
- file: scratchpad/effected/markdown/internal/inlines/emphasis.ts:64
- class: bug   severity: required
- standard: [CommonMark 0.31.2 §2.1](https://spec.commonmark.org/0.31.2/#characters-and-lines) defines characters as Unicode code points and punctuation as categories P or S; [§6.2](https://spec.commonmark.org/0.31.2/#emphasis-and-strong-emphasis) applies that classification to delimiter flanking. D9 and section 14 permit a verified upstream bug fix.   evidence: Read-only probes show that both the port and pinned oracle parse `"😀_a_"` and `"_a_😀"` entirely as text, and parse `"a*𐄀*b"` with emphasis. Under the cited rules, the first two inputs contain emphasis around `a`, while the third stays literal because U+10100 is punctuation between alphanumeric neighbors and the delimiters.
- failure: `charAt(startpos - 1)` reads only the preceding low surrogate. On the other side, `scanner.peek()` returns a UTF-16 code unit, so `String.fromCodePoint(ccAfter)` reconstructs only the high surrogate. The Unicode punctuation regex consequently receives surrogate halves and misclassifies astral punctuation and symbols, both allowing forbidden emphasis and rejecting valid emphasis.
- fix: Read complete code points before and after delimiter runs, stepping backward over a valid surrogate pair. Keep scanner positions in UTF-16 units. Add astral punctuation/symbol regressions and provide the inherited spec-bug evidence centrally.
- seats: part-4/sol-1-3

### req-32 — Email source lookup is quadratic in pieces and matches
- file: scratchpad/effected/markdown/internal/inlines/autolinkLiteral.ts:485
- class: perf   severity: required
- standard: D11’s algorithmic-class criterion.   evidence: `localAt` starts at the first `RunPiece` for every position lookup, and each email invokes it for its link boundaries and intervening text boundaries. A read-only probe built adjacent pieces `"a"`, `"_"`, `"b@c.de "` per email and counted reads of the original nodes’ `value` properties during `linkifyEmails`: 64 emails/192 pieces → 25,153 reads; 128/384 → 99,457; 256/768 → 395,521. Doubling input approximately quadruples the work. The implementation matches the pinned oracle, so this is an inherited quadratic path.
- failure: A paragraph containing Θ(n) email matches and Θ(n) text pieces requires Θ(n²) work just to recover source positions, despite the matches and pieces already being ordered.
- fix: Keep a cursor for nondecreasing localAt queries and advance only when a query passes its piece. Preserve the corrected exact-end mapping from req-29; add multi-piece/multi-email position regressions.
- seats: part-4/sol-1-4

### req-33 — Unterminated declarations repeatedly scan the remaining paragraph
- file: scratchpad/effected/markdown/internal/inlines/rawHtml.ts:36
- class: perf   severity: required
- standard: D11’s algorithmic-class criterion.   evidence: The precheck covers comments, processing instructions and CDATA, but omits declarations. `reHtmlTag` includes the declaration pattern `<![A-Za-z]+[^>]*>`. For `"x " + "<!A".repeat(n)` with no `>`, each opener retries that pattern against the remaining suffix: Θ(n) attempts, each scanning Θ(n) remaining characters, yielding Θ(n²) work. A bounded read-only parse probe took approximately 58 ms, 87 ms and 319 ms for 8,000, 16,000 and 32,000 openers respectively. The pinned oracle has the same path; the required basis is the algorithmic-class improvement.
- failure: Repeated unterminated declarations bypass the memoized missing-closer protection and repeatedly scan the rest of an otherwise valid text paragraph.
- fix: Include declaration openers in the memoized missing-closer checks, or check hasAhead(">") before the declaration regex. Preserve accepted HTML and text output and add repeated unterminated declaration regressions.
- seats: part-4/sol-1-5

### req-34 — DelimiterRun is a pure-data interface without a schema
- file: scratchpad/effected/markdown/internal/inlines/emphasis.ts:33
- class: schema   severity: required
- standard: `standards/schema-first-development-prompt.md`, “Schema owns pure data”; AGENTS.md’s schema-first domain-model law; D5.   evidence: `DelimiterRun` is an exported pure-data interface containing only `numdelims`, `canOpen` and `canClose`; `scanDelims` constructs a parallel object literal at line 81. It is neither a service contract nor type-level machinery. The green lint gate runs oxlint and `effect-fn`, `terse-effect`, `native-runtime`, and `effect-imports`; those checks do not enforce this pure-data modeling requirement.
- failure: The shared delimiter measurement has no runtime schema as its source of truth. Its runtime validator and arbitrary cannot be derived from the exported model, and the model bypasses the required identity and schema annotation surface.
- fix: Define an identity-annotated DelimiterRun schema, derive the same-name type, and construct/type scan measurements through that contract without changing the three payload fields.
- seats: part-4/sol-1-6

### req-35 — Missing delimiter measurements use undefined in domain logic
- file: scratchpad/effected/markdown/internal/inlines/emphasis.ts:48
- class: effect-idiom   severity: required
- standard: `standards/effect-first-development.md` EF-2, “Absence is Option”; effect-first-development skill law 5; D5.   evidence: Both overloads of `scanDelims` expose `DelimiterRun | undefined`, and the implementation returns `undefined` when no run exists. Its domain consumers branch directly on that sentinel in `handleDelim` and `strikethrough.ts`. This is an internally produced domain result, not external nullable input. The four green beep laws do not enforce EF-2.
- failure: Missing delimiter measurements flow through parser domain logic as a nullish union rather than the required `Option`, leaving absence outside the Effect model.
- fix: Return O.Option<DelimiterRun> from both scanDelims forms; use O.none/O.some and update handleDelim and handleTilde to narrow the Option. Preserve cursor restoration and parser behavior; provide the law:EF-2 deviation centrally.
- seats: part-4/sol-1-7

### allow-1 — Replace the native public definition index and retain document order
- file: scratchpad/effected/markdown/internal/blockParser.ts:643
- class: new-map-set   severity: required
- standard: standards/effect-laws.allowlist.jsonc EFFECTED-MD-REFMAP; later operator ruling removing every effected entry.   evidence: Allowlist entry file internal/blockParser.ts, kind new-map-set, cites new Map validated through MarkdownDocument S.ReadonlyMap. MarkdownDocument.ts:342 still uses S.ReadonlyMap and :561 calls definitions.get; blockParser collects first-wins definitions into native Map.
- failure: The public definition index remains native and cannot be retained under the ruling; HashMap iteration alone would lose the promised document order.
- fix: After req-25 migrates the inline seam, build an Effect HashMap definition index in blockParser with an explicit ordered label/definition sequence. Make MarkdownDocument.definitions an S.HashMap, carry the explicit document order, and use HashMap.get/Option for navigation. Preserve first-definition-wins, node identity and order. Retarget native Map/prototype/size/get fixtures and assertions to the new representation and ordered sequence. Send deviation metadata to the central codemod; do not edit standards or ledger.
- seats: operator allowlist retirement; no reviewer seat (entry kind: new-map-set)

### allow-2 — Remove global WeakMap caches of regex clones
- file: scratchpad/effected/markdown/internal/patterns.ts:14
- class: new-map-set   severity: required
- standard: standards/effect-laws.allowlist.jsonc EFFECTED-MD-REGEX-CLONE-CACHE; later per-structure identity/cache ruling.   evidence: The allowlist entry is internal/patterns.ts, kind new-map-set. stickyCache and globalCache are WeakMap<RegExp, RegExp> at lines 14-15, consumed by stickyOf/globalOf.
- failure: The entry survives as global identity-keyed native caches; source/flags keys would alias different owners and mutable lastIndex.
- fix: Remove both WeakMaps. Compute the sticky/global clone for its matching operation owner, preserving caret removal, flags and independent lastIndex; the bounded one-file version computes a fresh clone per stickyOf/globalOf invocation and retains no cache. If later caching is needed, fields must live on module-owned matcher objects, never a global identity registry or Equal.byReferenceUnsafe mark. Retain signatures and add identity/lastIndex regressions. Provide native-runtime deviation metadata centrally.
- seats: operator allowlist retirement; no reviewer seat (entry kind: new-map-set)

## Backlog

### back-1 — Core exported documentation requires S2 conversion
- file: scratchpad/effected/markdown/Frontmatter.ts:30
- class: jsdoc   severity: backlog
- standard: `.patterns/jsdoc-documentation.md`, Hard requirements, Carrier policy, and Kind-split Example law; explicitly deferred S2 under this review brief.   evidence: The focused files retain forbidden `@remarks` and `@example` carriers, use `@public` without the required canonical `@category` and `@since 0.0.0`, and leave many exported runtime schemas and classes without examples. Examples include `FrontmatterFormatMismatchError`, `FrontmatterMissingReason`, and `JsonFrontmatter`.
- failure: The carried documentation does not yet meet the repository’s public API documentation contract.
- fix: During S2 preserve all carried prose/examples, convert retired carriers, add required category/since/example metadata, and compile examples with the lab module alias.
- seats: part-1/sol-1-8, part-1/grok-1-7, part-1/fable-1-8
- classification: S2 has not run; docs/JSDoc are deferred.

### back-2 — Property floors and run budgets require S3
- file: scratchpad/test/markdown/node.test.ts:48
- class: test   severity: backlog
- standard: D10; port goal section 11.4; S3 deferral in this review brief.   evidence: The node suite contains construction and decode examples but no `Arbitrary.schema` encode/decode round-trip properties for the exported node schemas. Existing properties elsewhere use fixed counts—for example, `{ arbitrary: { runs: 250, size: 12 } }` at `oracle.property.test.ts:177`—and a module-wide search finds no `fcRuns` usage.
- failure: The schema property floor is incomplete, and existing property counts cannot honor the configured run-count floor. The mdast newline and label failures above also demonstrate gaps in the existing round-trip examples.
- fix: During S3 add Arbitrary.schema round trips for exported schemas/codecs, retain oracle/fidelity properties, and use fcRuns(n) for existing/new counts without dropping size options.
- seats: part-2/sol-1-11, part-1/sol-1-9, part-1/sol-1-10
- classification: S3 has not run; property/coverage/test-canon requirements are deferred.

### back-3 — Resolver trace name is unqualified
- file: scratchpad/effected/markdown/FrontmatterResolver.ts:401
- class: effect-idiom   severity: backlog
- standard: standards/effect-first-development.md:372 (Effect.fn('Name') for reusable effectful functions, the name being the API); law 22 scope (only Effect.gen bodies must use Effect.fn); upstream and jsonc span-naming convention Module.method   evidence: Upstream resolve is a plain arrow returning Effect.fail/Effect.succeed; the port wraps it in Effect.fn('resolve'). Every other span in the module and in the closed ports is qualified: Markdown.ts:240/326/467, MarkdownDocument.ts:665, MarkdownFormat.ts:754/832, scratchpad/effected/jsonc/JsoncFingerprint.ts:414 ('JsoncFingerprint.canonicalize').
- failure: Every registry resolution emits an un-namespaced span named 'resolve' that upstream never emitted and that cannot be attributed to this API in a trace.
- fix: If retaining the Effect.fn wrapper, qualify its span as SchemaResolver.resolve; do not remove a diagnostic/law-forced wrapper merely because the upstream arrow was unwrapped.
- seats: part-1/fable-1-4
- classification: Naming preference outside D11; no runtime bug or mandatory naming diagnostic demonstrated.

### back-4 — Navigation matchers could be hoisted
- file: scratchpad/effected/markdown/MarkdownDocument.ts:271
- class: perf   severity: backlog
- standard: D11 (perf is required only with a measurement or an algorithmic-class argument; neither applies, this is constant-factor); law 11 is satisfied, the issue is where the matcher is built   evidence: phrasingText (:268-296) constructs Match.value(node).pipe(five Match.discriminator cases, Match.orElse) plus fresh closures over `out` for every phrasing node on every call, and links (:556-564) does the same per tree node; upstream's switch allocated nothing per node. phrasingText runs for every heading and section text projection and recurses per container.
- failure: Per-node matcher and closure allocation in the heading/section-text and link walks; no measured regression, so backlog.
- fix: Hoist a module-level const phrasingNodeText = Match.type<PhrasingContent>().pipe(Match.discriminator('type')('text','inlineCode',(n) => n.value), ...('break', () => ' '), ...('image','imageReference',(n) => n.alt ?? ''), ...(containers, (n) => phrasingText(n.children)), Match.orElse(() => '')) and write out += phrasingNodeText(node); same shape returning O.Option<DocumentLink> for links.
- seats: part-1/fable-1-5
- classification: No measured regression or algorithmic-class improvement; outside D11 performance requirement.

### back-5 — Mapping guard could use fewer predicates
- file: scratchpad/effected/markdown/FrontmatterResolver.ts:248
- class: effect-idiom   severity: backlog
- standard: standards/effect-laws-v1.md law 21 (tersest equivalent helper form when behaviour is unchanged)   evidence: isMapping is P.isObjectKeyword(value) && !P.isFunction(value) && !A.isArray(value). isObjectKeyword admits functions (node_modules/effect/dist/Predicate.js:782-784: typeof object && not null || isFunction), which is why the port subtracts them; P.isObjectOrArray (Predicate.js:688-690) is exactly upstream's typeof value === 'object' && value !== null.
- failure: No runtime difference; three predicates express a guard two express.
- fix: const isMapping = (value: unknown): value is Record<string, unknown> => P.isObjectOrArray(value) && !A.isArray(value);
- seats: part-1/fable-1-6
- classification: Behavior-equivalent readability preference; no mandatory checker violation or failure demonstrated.

### back-6 — Node and mdast documentation requires S2 conversion
- file: scratchpad/effected/markdown/MarkdownVisitor.ts:58
- class: jsdoc   severity: backlog
- standard: `.patterns/jsdoc-documentation.md`, Hard requirements and Carrier policy; D4; S2 deferral in this review brief.   evidence: `MarkdownVisitor` retains an untitled `@example`, its `visit` method retains `@remarks`, and exported APIs across the focused files lack canonical `@category` and `@since 0.0.0`. Many value exports, including the node schemas, have no Example.
- failure: The carried documentation does not satisfy the final JSDoc carrier, metadata and example requirements.
- fix: During S2 preserve prose/examples, convert carriers and metadata, compile example imports through the lab alias, and retarget Toml/Yaml codec dependency descriptions.
- seats: part-2/sol-1-9, part-2/grok-1-3, part-2/fable-1-8
- classification: S2 has not run; documentation is deferred.

### back-7 — Visitor/effectful property tests require vitest canon
- file: scratchpad/test/markdown/visitor.test.ts:31
- class: test   severity: backlog
- standard: `goals/effect-vitest-canon/SPEC.md` EV001 and D5; port goal section 11.2; S3 deferral in this review brief.   evidence: `collect` runs the visitor stream with `Effect.runSync` and is called inside ordinary `it` callbacks, including line 48. The same file hand-rolls Result assertions with `Result.isSuccess` and `Result.getOrThrow`. Frontmatter property tests similarly execute Effects through synchronous runners.
- failure: Effect execution bypasses the canonical test runner and its test services; Result assertions bypass the prescribed variant-and-payload helpers.
- fix: In S3, return the collection Effect from the helper and yield it inside `it.effect`. Convert effectful properties to `it.effect.prop`, and use `@effect/vitest/utils` helpers for Result assertions.
- seats: part-2/sol-1-10
- classification: S3 has not run; vitest-canon changes are deferred.

### back-8 — Node/parser leaf headers are stale
- file: scratchpad/effected/markdown/MarkdownNode.ts:26
- class: docs   severity: backlog
- standard: D4 (carried prose must stay true after the port); D13 (`.js` -> `.ts` rewrite).   evidence: Header says "Leaf module: imports only `effect`." while the file now imports `@beep/identity/packages` (:28). internal/blockParser.ts:28 and internal/inlineParser.ts:38 still say "Imports node classes from `../MarkdownNode.js`" after the D13 rewrite (entityMap.ts:13 was updated).
- failure: Stale module-contract comments misdescribe the cycle firewall the comments exist to document.
- fix: Correct the carried headers to the actual dependencies and .ts import paths after the fix wave.
- seats: part-2/fable-1-9
- classification: Docs deferred to S2; outside current required wave.

### back-9 — Internal exports require S2 JSDoc metadata
- file: scratchpad/effected/markdown/internal/lineIndex.ts:27
- class: jsdoc   severity: backlog
- standard: .patterns/jsdoc-documentation.md, “Hard requirements” and “Carrier policy”; S2 deferral in the review brief   evidence: `LineIndex` retains forbidden `@remarks` carriers at lines 27, 46, and 64. Its exported class documentation also lacks canonical `@category`, `@since`, and a titled Example. Exported value documentation elsewhere in the reviewed internal surface, including `sourceOffsetAt` and `stringifyTree`, likewise lacks the required tags and Examples.
- failure: The reviewed documentation is not ready for the S2 JSDoc/docgen contract. This is deferred documentation work and does not block the current round.
- fix: During S2, convert the `@remarks` bodies to `**Details**`, retain their substantive prose, and add canonical categories, `@since 0.0.0`, and meaningful compilable `**Example** (Title)` sections to the owning value declarations.
- seats: part-3/sol-1-5, part-3/grok-1-4
- classification: S2 has not run; documentation is deferred.

### back-10 — CODE_INDENT doc attaches to an inserted import
- file: scratchpad/effected/markdown/internal/preprocess.ts:367
- class: docs   severity: backlog
- standard: .patterns/jsdoc-documentation.md (doc block attaches to the following declaration); header accuracy   evidence: Lines 367-369: `/** Columns of indentation that open an indented code block. */` then `import { dual } from "effect/Function";` then `export const CODE_INDENT = 4;` — the JSDoc now documents the import. Header line 12 still says `Leaf module: imports nothing.`
- failure: docgen will attach the CODE_INDENT description to nothing and the module header lies about its imports.
- fix: Move the `dual` import above the comment into the import position and reword the header to `Leaf module: imports only `dual`.`
- seats: part-3/fable-1-6, part-3/grok-1-3
- classification: S2 has not run; documentation is deferred.

### back-11 — Segment leaf header is stale
- file: scratchpad/effected/markdown/internal/segments.ts:10
- class: docs   severity: backlog
- standard: header accuracy (carried upstream prose, section 10.1)   evidence: Line 10 `Leaf module: imports only the segment type.` while line 13 imports `dual` from effect/Function.
- failure: Stale module header.
- fix: Reword to `Leaf module: imports only `dual` and the segment type.`
- seats: part-3/fable-1-7
- classification: S2 has not run; documentation is deferred.

### back-12 — Heading guard allocation and dead branches need S3 review
- file: scratchpad/effected/markdown/internal/blocks/atxHeading.ts:27
- class: effect-idiom   severity: backlog
- standard: law 17 (derive guards with S.is(...) as named building blocks); section 11.3 (unreachable branches are findings against the source)   evidence: `S.is(HeadingDepth)(hashes)` rebuilds the guard inside the expression on every heading; the trailing `: 1` fallback and both clamps are unreachable because `reATXHeadingMarker = /^#{1,6}.../` bounds the run to 1-6. Lines 17-18 import from `../../MarkdownNode.ts` twice.
- failure: Guard construction per call and three dead branches that S3 per-file 100% coverage will have to explain.
- fix: `const isHeadingDepth = S.is(HeadingDepth);` at module level and `const headingDepth = (hashes: number): HeadingDepth => (isHeadingDepth(hashes) ? hashes : hashes < 1 ? 1 : 6);`; merge the two MarkdownNode imports.
- seats: part-3/fable-1-8
- classification: Coverage is deferred to S3; no measured allocation regression or demonstrated mandatory gate miss.

### back-13 — Code optional-field spreads could be consolidated
- file: scratchpad/effected/markdown/internal/blocks/code.ts:270
- class: effect-idiom   severity: backlog
- standard: law 21 (tersest equivalent helper form)   evidence: Lines 270-273: two adjacent `...O.getSomesStruct({ lang })` / `...O.getSomesStruct({ meta })` spreads followed by two conditional spreads `...(isFenced === true && fenceChar !== undefined ? { fenceChar } : {})` in one `Code.make`.
- failure: Four spreads for one optional-field struct; the ternary pair is the shape the terse-effect law rewrote elsewhere.
- fix: One spread: `...O.getSomesStruct({ lang: O.fromUndefinedOr(lang), meta: O.fromUndefinedOr(meta), fenceChar: isFenced === true ? O.fromUndefinedOr(fenceChar) : O.none(), fenceLength: isFenced === true ? O.fromUndefinedOr(fenceLength) : O.none() })`.
- seats: part-3/fable-1-9
- classification: Style consolidation outside the enumerated mandatory terse forms; no observable failure or checker miss demonstrated.

### back-14 — List optional-field spreads could be consolidated
- file: scratchpad/effected/markdown/internal/blocks/list.ts:280
- class: effect-idiom   severity: backlog
- standard: law 21 (tersest equivalent helper form)   evidence: Line 280 `...(ordered && listData?.start !== undefined ? { start: listData.start } : {})` sits directly above the `O.getSomesStruct({ bulletChar, delimiter })` spread at 281-284.
- failure: Mixed spread styles for one optional-field struct.
- fix: Fold `start: ordered ? O.fromUndefinedOr(listData?.start) : O.none()` into the getSomesStruct call and delete line 280.
- seats: part-3/fable-1-10
- classification: Style consolidation outside the enumerated mandatory terse forms; no observable failure or checker miss demonstrated.

### back-15 — Inline exports require S2 documentation
- file: scratchpad/effected/markdown/internal/inlines/emphasis.ts:39
- class: jsdoc   severity: backlog
- standard: `.patterns/jsdoc-documentation.md`, “Hard requirements” and “Kind-split Example law”; the review brief explicitly defers S2 findings to backlog.   evidence: `scanDelims` has descriptive prose but no titled `**Example**`, canonical `@category`, or `@since 0.0.0`. The same omission affects the exported value declarations throughout the eleven focused files; the exported `DelimiterRun` and `LinkCloseFallback` types also lack category and since tags.
- failure: The exported declarations do not yet meet the repository documentation rubric or teach the newly added direct and pipeable call forms.
- fix: During S2, preserve the existing prose and add canonical category/since tags and compilable titled examples for value exports. Document the direct and pipeable forms where applicable; examples remain optional for pure type exports.
- seats: part-4/sol-1-8
- classification: S2 has not run; documentation is deferred.

### back-16 — GFM symbol-adjacent tilde behavior needs a dialect decision
- file: scratchpad/effected/markdown/internal/inlines/strikethrough.ts:44
- class: bug   severity: backlog
- standard: strikethrough.ts header and gfm-inlines.test.ts:4 ("Semantics authority is cmark-gfm 0.29.0.gfm.13"); D9   evidence: handleTilde reuses scanDelims, whose rePunctuation (emphasis.ts:23, identical to commonmark.js 0.31.2 inlines.js:37) is \p{P}\p{S}; cmark-gfm 0.29.0.gfm.13 src/utf8.c:255-256 cmark_utf8proc_is_punctuation "matches anything in the P[cdefios] classes" (no symbols) and scan_delimiters feeds that into both flanking flags. Probe: `a~€b~` (gfm) -> "a~€b~" in the lab; with P-only flanking the opener before € is left-flanking, so cmark-gfm pairs it (a<del>€b</del>). fixtures/gfm/extensions.json has no symbol-adjacent tilde. Upstream @effected is byte-identical here.
- failure: Tildes adjacent to a Unicode symbol (currency, arrows, emoji) refuse to open/close where cmark-gfm pairs them; the same drift for emphasis is sanctioned by the 0.31.2 spec corpus, but the gfm dialect's stated authority is the C.
- fix: Verify the pinned dialect authority, then pin the selected symbol-flanking behavior with a regression. Do not silently change emphasis punctuation or hand-edit Port notes; send any permitted deviation evidence centrally.
- seats: part-4/fable-1-3
- classification: Shared upstream dialect-version choice without an established permitted deviation cause; outside D11.

### back-17 — Autolink underflow branches appear unreachable
- file: scratchpad/effected/markdown/internal/inlines/autolinkLiteral.ts:124
- class: test   severity: backlog
- standard: Section 11.3 (an unreachable branch is a finding against the source; S3 per-file 100% branches)   evidence: autolinkDelim enters the `;` arm with linkEnd < 2 only when subject.charAt(base) is `;`; base is the `w` of `www.` (:251), the `:` of a scheme (:300) or the `@` of an email run (:442), and the email scan (:404-429) breaks at `;` before autolinkDelim sees it, while www/url runs begin with at least 4 non-`;` characters. In JS newEnd = linkEnd - 2 cannot underflow, so lines 121-127 guard a C-only hazard the TS arithmetic already survives (newEnd = -1 -> loop skipped -> linkEnd -= 1).
- failure: S3's branch gate will red on dead code; the comment claims a trimming behaviour no input can observe.
- fix: Delete lines 121-127 and fold the underflow note into the surrounding comment; no behaviour change.
- seats: part-4/fable-1-4
- classification: Coverage/dead-branch cleanup is deferred to S3.

## Handled by the deviation codemod

### codemod-1 — Record Number-to-Finite tightening once for the module
- file: scratchpad/effected/markdown/MarkdownDiagnostic.ts:52
- class: docs   severity: backlog
- standard: Later operator per-module, per-systemic-class deviation codemod ruling; schemaNumber diagnostic.   evidence: The seat probes demonstrate non-finite input rejection in MarkdownDiagnostic, MarkdownRange/MarkdownEdit, FrontmatterSourceSplit, MarkdownModificationError, Point, Code.fenceLength and List.start. The changes are diagnostic-forced; only their central records/tests provenance is requested.
- failure: Ledger/Port notes still claim no deviations, but reverting finite schemas contradicts the ruling.
- fix: Central codemod generates one markdown S.Finite deviation entry listing sites and adjusted upstream tests. Retain S.Finite; assign no ledger, README Port notes or repo-config writes to groups.
- seats: part-1/grok-1-5, part-1/fable-1-1, part-2/grok-1-2, part-2/sol-1-12
- classification: Systemic law-forced bookkeeping handled centrally.

### codemod-2 — Record tagged native-error replacements once for the module
- file: scratchpad/effected/markdown/FrontmatterResolver.ts:368
- class: docs   severity: backlog
- standard: Later operator per-module, per-systemic-class deviation codemod ruling; law 7/native-runtime.   evidence: Native Error/TypeError replacements include SchemaRegistryError, OverlappingMarkdownEditsError, DocumentNavigationError, InvalidLineTableError, UnknownInlineDialectError, UnknownBlockDialectError and BlockParserError. hardening.test.ts:193-194 was retargeted; other assertions preserve messages.
- failure: Law-forced tags and adjusted upstream assertions lack centralized provenance, rather than requiring restoration of native errors.
- fix: Central codemod generates one tagged-errors deviation entry with all sites and adjusted upstream tests; exportsAdded handles any added public exports. Missing actual schemas/annotations remain Required in req-9, req-14 and req-22a/b.
- seats: part-1/fable-1-2, part-1/grok-1-2, part-1/grok-1-3, part-1/grok-1-4, part-2/fable-1-6, part-3/fable-1-1, part-2/sol-1-12
- classification: Systemic law-forced bookkeeping handled centrally.

## Rejected

### reject-1 — Restore S.Number on node fields
- file: scratchpad/effected/markdown/MarkdownNode.ts:45
- class: schema   severity: backlog
- standard: D9 behaviour-preserving + section 14 ("a different accepted input" is a deviation; only `law:<id>` or `upstream-bug:<evidence>` allow one, recorded in the ledger and README Port notes first). README Port notes -> Deviations says "None" and the ledger row `w2-markdown.deviations` is `[]`. No beep standard or law prefers `S.Finite` over `S.Number` (`rg Finite` over standards/, .patterns/ and the Laws/SchemaDiagnostics source matches only "finite variants" prose; the patterns themselves use `S.Number`).   evidence: Upstream uses `Schema.Number` for `Point.line/column/offset`, `Code.fenceLength` and `List.start`; the port uses `S.Finite` at :45, :46, :47, :560, :662. bun probe: upstream `Point.make({ line: NaN, column: 1, offset: 0 })` -> ok (line NaN) and `List.make({ children: [], start: Infinity })` -> ok; the port throws `Schema validation failed` for both.
- failure: `Point.make`, `Mdast.fromMdast` and every decode of these five fields reject non-finite numbers that upstream accepts; the D10 `Arbitrary.schema` round-trip domain also changes. The deviation is unrecorded and has neither allowed cause.
- fix: Restore `S.Number` on the five fields (keep the `annotateKey` descriptions). If `Finite` is genuinely wanted, follow section 14 first: ledger `deviations` entry + README Port notes with a cause, which neither `law:` nor `upstream-bug:` currently supplies.
- seats: part-2/fable-1-2
- rejection: Contradicts the confirmed schemaNumber/S.Finite ruling; record the tightening through codemod-1.

### reject-2 — Restore native TypeError in LineIndex
- file: scratchpad/effected/markdown/internal/lineIndex.ts:77
- class: bug   severity: backlog
- standard: D9, section 14, `standards/effect-first-development.md` EF-31   evidence: Upstream `packages/markdown/src/internal/lineIndex.ts:67` throws `new TypeError("line index: a line table must be non-empty and start at offset 0")`. The port throws `InvalidLineTableError.make(...)`. Upstream `__test__/hardening.test.ts:193-194` expects `TypeError`; `scratchpad/test/markdown/hardening.test.ts:193-194` was rewritten to `InvalidLineTableError`. README Port notes → Deviations is `None`, and `PORT_LEDGER.json` `w2-markdown.deviations` is `[]`. The comment at line 73 still calls this a wiring defect.
- failure: `LineIndex.fromLineStarts` with an empty table or a table that does not start at 0 throws a schema tagged error (`_tag` `InvalidLineTableError`, `name` the `$ScratchpadId` identifier) instead of a `TypeError`. `instanceof TypeError` and `error.name` diverge. EF-31 keeps invariant violations as defects. No `law:` or `upstream-bug:` record covers the change.
- fix: Restore `throw new TypeError("line index: a line table must be non-empty and start at offset 0")`, restore the test's `TypeError` expectation, and delete `InvalidLineTableError`.
- seats: part-3/grok-1-1
- rejection: Contradicts law 7 and the operator ruling retaining tagged errors; missing metadata is req-22a and recording is codemod-2.

### reject-3 — Restore native TypeError for an unknown inline dialect
- file: scratchpad/effected/markdown/internal/inlineRegistry.ts:144
- class: bug   severity: backlog
- standard: D9, section 14, `standards/effect-first-development.md` EF-31   evidence: Upstream `packages/markdown/src/internal/inlineRegistry.ts:119` throws `new TypeError(\`unknown markdown dialect: ${String(dialect)}\`)`. The port throws `UnknownInlineDialectError.make({ message: ... })`. The comment at line 139 still says the unknown dialect dies as a defect. README and the ledger record no deviation. The same swap exists at `scratchpad/effected/markdown/internal/blockRegistry.ts:167` (outside this slice).
- failure: A dialect string outside `"commonmark" | "gfm"` (the check is runtime; the union erases) throws a tagged error instead of `TypeError`. `instanceof TypeError` and `error.name` diverge, and the class is not exported, so callers cannot name the new type either.
- fix: Restore `throw new TypeError(\`unknown markdown dialect: ${String(dialect)}\`)` and delete `UnknownInlineDialectError`.
- seats: part-3/grok-1-2
- rejection: Contradicts law 7 and the operator ruling retaining tagged errors; missing metadata is req-22b and recording is codemod-2.

### reject-4 — Add a native entity-map allowlist exception
- file: scratchpad/effected/markdown/internal/entityMap.ts:29
- class: perf   severity: backlog
- standard: D11 (measured) but law-forced: `beep-laws/no-native-runtime` MAP_SET_CTORS bans `new Map` (NoNativeRuntime.ts:69); section 14 cause `law:native-runtime`, so backlog.   evidence: bun micro-bench, 2M `ENTITY_MAP.get` lookups cycling the 2125 entity names: port facade (`O.getOrUndefined(HashMap.get(entities, key))`) 75.3 ms vs upstream native `Map.get` 14.4 ms (5.24x). `Hash.string` rehashes the key on every call and each hit allocates an `Option`.
- failure: Every `&name;` entity reference in inline parsing pays about 5x per lookup; it is part of the measured 1.2x end-to-end parse regression.
- fix: Add a `beep-laws/no-native-runtime` allowlist entry for internal/entityMap.ts (`kind: new-map-set`, reason: engine-constant 2125-entry table built once at module load; mirror of `EFFECTED-MD-REFMAP` in standards/effect-laws.allowlist.jsonc:357-364) and restore `new Map(entries)` behind the same `ReadonlyMap` type.
- seats: part-2/fable-1-5
- rejection: Contradicts the ruling removing every effected allowlist entry and proposes a repo-level standards write outside the port surface; the measured regression does not license native Map.

### reject-5 — Diffuse parse regression with profiling as the only next step
- file: scratchpad/effected/markdown/internal/blockParser.ts:687
- class: perf   severity: backlog
- standard: D11 (measured regression versus upstream)   evidence: Node 24.20 (gate engine), `parseBlocks(doc, "gfm")` on a 295,780-byte mixed GFM document, 5 warm-ups + 21 paired runs: upstream median 116.6 ms, lab 126.7 ms (ratio 1.086; min ratio 1.095). Bun: 1.15-1.18. Both trees resolve effect 4.0.2; upstream packages/markdown/src is byte-identical to the oracle (`diff -rq`). In-process load-time source patches (no files written) rule out: removing the dual wrappers in preprocess/segments/rawInline/frontmatter/htmlBlock (1.163), inlineRegistry facade -> native Map (1.225), blockRegistry facade -> native Map (1.153), getSomesStruct -> plain loop (1.136), `{ disableChecks: true }` on position() (bun 1.149, Node 1.078). `S.Finite -> S.Number` in MarkdownNode.ts gave 1.099-1.117 in bun but is not reproduced by disableChecks, so the cause is unattributed and diffuse.
- failure: The port parses roughly 9% slower than upstream under Node with no single site responsible among the ones tested.
- fix: No code change proposed yet: `node --cpu-prof` over parseBlocks on the same document before the fix wave (the planned refmap/definitions rewrite will move the numbers), then anchor a finding on the hot frame.
- seats: part-3/fable-1-5
- rejection: No concrete code fix or attributed defect; a request to profile does not satisfy section 12.5 admission.

### reject-6 — Drop node construction/splice dual wrappers wholesale
- file: scratchpad/effected/markdown/internal/inlineNode.ts:68
- class: perf   severity: backlog
- standard: Operator retain diagnostic-forced changes; missingPipeableSignature.   evidence: tsconfig.base.json:176 sets missingPipeableSignature to error. effect-tsgo/internal/rules/missing_pipeable_signature.go scans module exports and considers every non-rest signature with at least two parameters, including arrow functions, optional parameters and contextual callback types. The supplied green gates therefore do not establish that the wrappers were unforced.
- failure: Every inline/block node construction and every sibling splice on the parser's hottest path pays a trampoline (`isString(args[0])` / `arguments.length >= 2`) plus a second call frame, for an API shape nothing uses.
- fix: Retain diagnostic-required direct/pipeable signatures. A future optimization must preserve those signatures and supply a concrete measured implementation fix.
- seats: part-2/fable-1-4
- rejection: The proposed restoration removes signatures required by missingPipeableSignature; inspecting only the separate terse-effect overload detector misses the binding tsgo diagnostic.

### reject-7 — Drop parsePassResult dual as an unforced shape change
- file: scratchpad/effected/markdown/Markdown.ts:156
- class: effect-idiom   severity: backlog
- standard: Operator retain diagnostic-forced changes; missingPipeableSignature.   evidence: tsconfig.base.json:176 sets missingPipeableSignature to error. effect-tsgo/internal/rules/missing_pipeable_signature.go scans module exports and considers every non-rest signature with at least two parameters, including arrow functions, optional parameters and contextual callback types. The supplied green gates therefore do not establish that the wrappers were unforced.
- failure: Predicate-dispatched arity and a dead overload on an internal helper; parsePassResult() with no arguments now returns a function instead of being a type error.
- fix: Restore the plain export const parsePassResult = (text: string, options?: MarkdownParseOptions): Result.Result<BlockPassResult, MarkdownParseError> => { ... } and drop the dual/isString imports if unused elsewhere.
- seats: part-1/fable-1-7
- rejection: The cited scanner exclusion is not the tsgo rule; exported parsePassResult has two parameters and is covered by missingPipeableSignature.

### reject-8 — Restore the plain footnote close-fallback callback
- file: scratchpad/effected/markdown/internal/inlines/footnoteReference.ts:62
- class: law   severity: backlog
- standard: Operator retain diagnostic-forced changes; missingPipeableSignature.   evidence: tsconfig.base.json:176 sets missingPipeableSignature to error. effect-tsgo/internal/rules/missing_pipeable_signature.go scans module exports and considers every non-rest signature with at least two parameters, including arrow functions, optional parameters and contextual callback types. The supplied green gates therefore do not establish that the wrappers were unforced.
- failure: An unforced shape change on the hot path: every `]` that closes no link under gfm now pays dual's arguments.length dispatch, and the declaration reads through Parameters<LinkCloseFallback>[n] instead of InlineScanner/Bracket. scanDelims (emphasis.ts:47) and insertStrikethrough (strikethrough.ts:80) are reusable helpers EF-18 covers; this one is not.
- fix: Restore `export const footnoteReferenceFallback: LinkCloseFallback = (scanner, opener, bracketPos, afterBracket) => { ... };` and drop the dual import at footnoteReference.ts:35.
- seats: part-4/fable-1-2
- rejection: The claim that no gate asks for a pipeable signature is contradicted by the enabled exported-signature diagnostic, which also sees contextual callback exports.
