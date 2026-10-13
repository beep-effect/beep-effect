### sol-2-1
- file: scratchpad/effected/markdown/internal/blocks/linkReferenceDefinition.ts:107
- class: bug   severity: required
- standard: D9, D11 and §14 (`upstream-bug`); the facade’s valid-input/no-defect contract.   evidence: A read-only Node v24.20.0 probe called `parseBlocks("[a]: /b\n" + "x\n".repeat(150000))`. The port throws `RangeError: Maximum call stack size exceeded` at this line. Loading the pinned oracle through an in-memory TypeScript loader reproduces the same failure in its `extractDefinitions`.
- failure: One definition followed by a long, shallow paragraph expands approximately 150,000 remaining source segments into native call arguments. Valid Markdown escapes parsing as a defect instead of producing a document. The nesting guard cannot prevent this argument-count overflow.
- fix: Clear the existing segment array and append remaining segments iteratively, preserving its identity and segment order. Add a Node regression with a definition followed by a long paragraph, and record the verified upstream bug.

### sol-2-2
- file: scratchpad/effected/markdown/internal/stringify.ts:152
- class: bug   severity: required
- standard: D9, D10, D11 and §14 (`upstream-bug`); `MarkdownStringifyError` documents serialization as total over parser-produced trees.   evidence: In both the port and pinned oracle, parsing `"> ".repeat(200) + "*".repeat(140) + "x" + "*".repeat(140) + "\n"` succeeds. Stringifying that result returns `MarkdownStringifyError` with `NestingDepthExceeded: limit 256, actual 257`.
- failure: Parsing separately bounds block nesting and inline nesting, while serialization adds both to one counter. A document accepted by both parser guards therefore cannot be serialized, breaking the parser/stringifier round-trip contract.
- fix: Make serialization use the parser’s separate block and inline depth budgets while retaining bounded recursive traversal. Add the combined-depth regression and record the upstream bug.

### sol-2-3
- file: scratchpad/effected/markdown/internal/stringify.ts:549
- class: bug   severity: required
- standard: D9, D10 and §14 (`upstream-bug`); the render-equivalence contract in `scratchpad/test/markdown/e2e/stringify-roundtrip.e2e.test.ts`.   evidence: Read-only probes against both implementations parse `[x](a&amp;amp;b "t&amp;amp;")` into URL `a&amp;b` and title `t&amp;`. Serialization emits `[x](a&amp;b "t&amp;")`; reparsing changes them to `a&b` and `t&`. The retained HTML writer and normalizer confirm unequal rendered output.
- failure: `destination` emits decoded ampersands directly, and `titleSuffix` at line 568 protects only backslashes and quotes. Entity-shaped text in decoded destinations or titles is decoded a second time, changing link targets, image sources and titles.
- fix: Encode decoded destinations and titles back into source spelling before applying their surrounding syntax. Protect literal ampersands in both helpers, retain the existing quoting rules, and add link/image/definition regressions.

### sol-2-4
- file: scratchpad/effected/markdown/internal/stringify.ts:997
- class: bug   severity: required
- standard: D9, D10 and §14 (`upstream-bug`); fenced-code content and info-string fidelity.   evidence: Both implementations parse `"```&#96;\nx\n```\n"` with language `` ` `` and value `"x\n"`, then serialize it as `"````\nx\n```\n"`. Reparsing produces an unterminated four-backtick block with no language and value `"x\n```\n"`. Separately, language `a&amp;` becomes `a&`, and language `a b` produced by `a&#32;b` becomes language `a` plus metadata `b`.
- failure: Decoded `lang` and `meta` are interpolated directly into fence syntax. Backticks can alter the opening fence, entity-shaped values are decoded again, and decoded whitespace can change the language/metadata boundary.
- fix: Encode decoded language and metadata into valid info-string source, protecting ampersands, backslashes, backticks, line endings and whitespace inside the language token. Add the demonstrated round-trip regressions.

### sol-2-5
- file: scratchpad/effected/markdown/internal/stringify.ts:727
- class: bug   severity: required
- standard: D9, D10 and §14 (`upstream-bug`); image-alt render fidelity.   evidence: Both implementations parse `![\*x\* &amp;amp;](u)` with alt text `*x* &amp;`, serialize it as `![*x* &amp;](u)`, and reparse alt text `x &`. The retained HTML writer confirms that the rendered `alt` attribute changes.
- failure: Image-alt serialization escapes only backslashes and brackets. Literal emphasis, code, HTML and entity syntax can become active inline syntax when reparsed, losing characters from the decoded alt text. The full `imageReference` arm repeats the same escaping at line 750. This is distinct from round-1’s repaired alt-flattening defects.
- fix: Serialize decoded alt text with appropriate inline-text escaping in both image arms. Preserve literal markup and entity-shaped text, and add direct-image and full-reference regressions.

### sol-2-6
- file: scratchpad/effected/markdown/internal/stringify.ts:556
- class: bug   severity: required
- standard: D9, D10 and §14 (`upstream-bug`); `ReferenceScanner.parseLinkDestination`’s explicit 32-level parenthesis limit.   evidence: In both implementations, `[x](<${"(".repeat(33)}x${")".repeat(33)}>)` parses as a link. Serialization removes the angle brackets because `balancedParens` returns true. Reparsing the emitted bare destination produces plain text rather than a link; the retained render-equivalence comparison fails.
- failure: Balanced parentheses are insufficient to make a destination representable in bare form. The serializer ignores the parser’s maximum nesting depth and emits syntax its own parser rejects.
- fix: Keep the angle-bracket form when parenthesis nesting exceeds 32, even when balanced. Add round trips at the 32/33 boundary.

### sol-2-7
- file: scratchpad/effected/markdown/internal/blocks/linkReferenceDefinition.ts:105
- class: perf   severity: required
- standard: D11’s algorithmic-class criterion.   evidence: For a paragraph containing `n` consecutive one-line definitions, each extraction calls `sliceWithSegments` over every remaining segment and recreates that suffix. The segment visits sum to Θ(n²). `parent.children.indexOf(block)` also rescans the growing definition prefix. A read-only port probe took approximately 160 ms for 4,000 definitions and 646 ms for 8,000; required severity rests on the algorithmic-class argument, not those timings.
- failure: Definition extraction repeatedly copies and searches progressively smaller/larger arrays for Θ(n) input and output. Large definition sections therefore perform quadratic bookkeeping even after round-1’s `sourceOffsetAt` binary-search repair.
- fix: Track a consumed-text cursor and the insertion index while extracting definitions. Rebase the surviving segment suffix once after extraction and avoid repeated searches for the same paragraph. Preserve definition order, first-definition precedence and positions.

### sol-2-8
- file: scratchpad/effected/markdown/internal/stringify.ts:656
- class: perf   severity: required
- standard: D11’s measured-regression criterion.   evidence: A read-only benchmark fed the same preconstructed paragraph of 10,000 `InlineCode("x")` children to the port and pinned oracle. On Node v24.20.0, after five warm-ups and nine alternating samples, median serialization was **12.25 ms port versus 6.33 ms oracle**, with identical output. A separate Bun run measured **20.60 ms versus 9.58 ms**. This input contains no adjacent text-run lookahead.
- failure: The port rebuilds the complete `Match.value(...).pipe(...)` dispatcher, predicates and captured handlers for every inline node. Serialization is approximately twice as slow for this identical-output workload. This is separate from round-1’s repaired mdast dispatcher and adjacent-text suffix findings.
- fix: Build a reusable `Match.type` dispatcher once, supplying the current node and serialization context as input. Preserve every arm’s ordering and output, then repeat the same benchmark.

### sol-2-9
- file: scratchpad/effected/markdown/internal/inlineTypes.ts:32
- class: schema   severity: required
- standard: D5; `standards/ARCHITECTURE.md` §5; `standards/effect-first-development.md` EF-33; schema-first prompt, “Schema owns pure data.”   evidence: `InlineSource` remains an exported interface containing only text, an offset and source segments. It is the runtime payload passed into inline parsing, but has no corresponding schema or schema-derived type. The recorded schema-first deviation covers other migrated models and grants no exception for this carrier.
- failure: This reusable parser data contract has no executable model, annotations, derived validation or arbitrary generation. The green gates missed the remaining interface-only payload.
- fix: Define an identity-annotated schema for `InlineSource`, using the shared segment model, and derive its same-name type. Preserve the current plain-object representation and parser call contracts.

### sol-2-10
- file: scratchpad/effected/markdown/internal/lineIndex.ts:47
- class: schema   severity: required
- standard: D5; `standards/ARCHITECTURE.md` §5; `standards/effect-first-development.md` EF-33.   evidence: `LineColumn`, the runtime result of `positionAt`, remains a two-number interface with no schema. Its documentation identifies it as a 1-based position model; it is neither a service contract nor type-level machinery.
- failure: The named position payload’s shape and documented numeric meaning remain outside the executable schema contract, despite the schema-first end-state requirement.
- fix: Define an annotated `LineColumn` schema and derive the type, preserving the existing returned object shape and positioning behavior.

### sol-2-11
- file: scratchpad/effected/markdown/internal/preprocess.ts:60
- class: schema   severity: required
- standard: D5; `standards/ARCHITECTURE.md` §5; `standards/effect-first-development.md` EF-12b and EF-33.   evidence: `SourceLine` is an exported interface reused by preprocessing, the block parser and frontmatter scanning. Its runtime fields are only `text` and `start`; no schema defines the carrier.
- failure: A central named intermediate parser model remains interface-authored, so its data shape, metadata and schema-derived validation/generation are unavailable. Existing preprocessing tests do not satisfy the model-ownership requirement.
- fix: Define an identity-annotated schema for `SourceLine`, derive its type and preserve plain preprocessing results, NUL normalization and offsets.

### sol-2-12
- file: scratchpad/effected/markdown/internal/references.ts:373
- class: schema   severity: required
- standard: D5; `standards/ARCHITECTURE.md` §5; `standards/effect-first-development.md` EF-33; schema-first prompt, “Schema owns pure data.”   evidence: `ParsedReference` remains an exported interface for the runtime `parseReference` result: key, identifier, label, URL, optional title and consumed length. No corresponding schema exists.
- failure: The reference parser’s reusable result payload lacks the executable model required for pure data. Its optional-key contract and field metadata exist only in TypeScript and prose.
- fix: Define an annotated schema with the same fields and optional-title semantics, derive `ParsedReference` from it and retain the current plain-object result.

### sol-2-13
- file: scratchpad/effected/markdown/internal/blocks/frontmatter.ts:61
- class: schema   severity: required
- standard: D5; `standards/ARCHITECTURE.md` §5; `standards/effect-first-development.md` EF-12b and EF-33.   evidence: `FrontmatterCapture` and `RawFrontmatterCapture` at line 182 remain exported pure-data interfaces. The private `FenceRule` at line 44 is also interface-authored configuration. Adding the `RawNewline` kit did not give these surrounding models schemas.
- failure: The named capture results and fence configuration remain outside schema ownership. Their formats, offsets, line counts and newline-bearing shapes have no executable contracts; the green gates missed these declarations.
- fix: Define annotated schemas and derived types for the captures and fence rule. Reuse the existing format/newline schemas and preserve both scanners’ distinct value contracts, plain-object results and null-on-no-capture behavior.

### sol-2-14
- file: scratchpad/effected/markdown/internal/blocks/table.ts:78
- class: schema   severity: required
- standard: D5; `standards/effect-first-development.md` EF-12b and EF-33; schema-first prompt, “Schema owns pure data.”   evidence: `RowSource`, `RawCell` at line 85, `ScannedRow` at line 95 and `CellContent` at line 280 are named, reused pure-data interfaces. They carry text, provenance segments, cell offsets and scan results; none has a schema.
- failure: The table scanner’s intermediate data models remain ad-hoc TypeScript shapes despite the explicit requirement to model named and reused intermediate concepts with schemas. These are data carriers rather than scanner service contracts.
- fix: Define annotated schemas and derive these types, reusing the segment model and shared text/segment fields where equivalent. Preserve scanner output objects and cell-boundary behavior.

### sol-2-15
- file: scratchpad/effected/markdown/internal/stringify.ts:794
- class: schema   severity: required
- standard: D5; `standards/effect-laws-v1.md` law 19; AGENTS.md’s named internal literal-domain rule.   evidence: `MDX_NODE_TYPES` defines a named five-member node-kind domain as `HashSet.fromIterable<string>(...)` and supplies the membership guard for `treeContainsMdx`. The explicit string parameter widens the vocabulary; no `LiteralKit` owns this domain. The green gates accept this site.
- failure: The MDX classification domain lacks the required schema-derived literal vocabulary and guard. Misspelled members still typecheck, and the domain is maintained independently of executable schema metadata.
- fix: Replace this membership table with an annotated named `LiteralKit` containing the same five members and use its derived guard.

### sol-2-16
- file: scratchpad/effected/markdown/internal/stringify.ts:379
- class: effect-idiom   severity: required
- standard: AGENTS.md, “Prefer match helpers over conditional chains”; `standards/effect-first-development.md` EF-7; D11.   evidence: `literalLineOpensBlock` replaces the oracle’s character switch with a multi-arm `if`/`else if` dispatch over finite marker cases. The green switch/law gates accept this conditional ladder. Round-1’s corresponding finding concerned `inlineParser.materializeNode`, not this function.
- failure: Clearing the native-switch prohibition left finite grammar dispatch in the conditional-chain form rejected by the binding Effect idiom.
- fix: Express the marker cases with a reusable Match dispatcher and a false fallback. Preserve the current predicates and escaping behavior.

### sol-2-17
- file: scratchpad/effected/markdown/internal/limits.ts:11
- class: docs   severity: backlog
- standard: D11’s backlog classification for documentation improvements; evidence from the actual schema implementation.   evidence: The Details section says recursive `MarkdownNode` schema decoding trips this guard. `MarkdownNode.ts` contains no reference to `MAX_NESTING_DEPTH` or a depth check. A read-only `S.decodeUnknownResult(MarkdownNode)` probe successfully decoded 300 nested plain blockquote objects, exceeding the documented limit of 256.
- failure: The documentation gives callers a depth-safety guarantee that schema decoding does not provide. Parser and serializer guards do not establish that guarantee for direct schema admission.
- fix: Describe the actual parser and serializer guard sites and remove the claim about guarded schema decoding.

REQUIRED: 16
BACKLOG: 1