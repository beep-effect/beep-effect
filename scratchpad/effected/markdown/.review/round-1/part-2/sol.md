### sol-1-1
- file: scratchpad/effected/markdown/internal/blockParser.ts:689
- class: bug   severity: required
- standard: D2 callable-contract preservation; D11.   evidence: A read-only Bun probe of `parseBlocks("gfm")("~~x~~\n")` throws `TypeError: parseBlocks("gfm") is not a function`. Both `parseBlocks("gfm")` and `parseBlocks("gfm", undefined)` return a `BlockPassResult`, although the curried overload promises a function.
- failure: The discriminator treats a first string argument as document text unless the second argument is boolean. A dialect-only curried call therefore parses the dialect name as a document. The original one-argument data-first call and the new dialect-only data-last call are indistinguishable at runtime.
- fix: Narrow the curried signatures to unambiguous forms: a separate zero-argument default overload and a dialect-bearing overload with a required boolean second argument. Preserve the original one-argument data-first parser.

### sol-1-2
- file: scratchpad/effected/markdown/Mdast.ts:396
- class: bug   severity: required
- standard: D9 and section 14, verified upstream bug; the inverse projection contract documented at `Mdast.ts:81`; D10 fidelity property.   evidence: In both the port and the pinned oracle, projecting `fromMdastResult({ type: "root", children: [{ type: "code", value: "body\n" }] })` back through `toMdast` produces `"body"`. Parsing the document `"```\nbody\n\n```\n"` and applying `toMdast → fromMdastResult → toMdast` likewise changes the code value from `"body\n"` to `"body"`.
- failure: A trailing newline in a foreign mdast code value represents content. Admission assumes it already supplies the engine’s extra carried terminator, and projection subsequently strips that content newline. Code blocks lose their trailing blank line during an otherwise successful round trip.
- fix: Append the engine terminator to every nonempty incoming mdast code value, including values already ending in a newline. Extend the existing round-trip test with trailing LF and CRLF content, and record the repair under section 14 as a verified upstream bug.

### sol-1-3
- file: scratchpad/effected/markdown/Mdast.ts:389
- class: bug   severity: required
- standard: D9 and section 14, verified upstream bug; the parsed-label/source-label boundary documented at `Mdast.ts:88`; `scratchpad/test/markdown/mdast.test.ts:92` and `:124`.   evidence: In both the port and the pinned oracle, a foreign definition with `label: "&amp;"` projects back with `label: "&"`; `label: "a\\*"` projects back as `"a*"`. A parsed document containing `[&amp;amp;]: /u` also changes its projected label from `"&amp;"` to `"&"` after `toMdast → fromMdastResult → toMdast`.
- failure: Foreign mdast labels are already decoded text, but admission copies them into fields whose internal contract is source spelling. `projectLabel` then decodes them again. Literal entity-like text and backslashes are lost from definition, reference and footnote labels.
- fix: During admission, convert foreign Association labels into a source spelling that `unescapeString` decodes exactly once to the original label, protecting literal backslashes and ampersands. Keep identifiers unchanged. Add label round-trip regressions and record the verified upstream repair under section 14.

### sol-1-4
- file: scratchpad/effected/markdown/Mdast.ts:381
- class: bug   severity: required
- standard: D9 and section 14, verified upstream bug; EF-3’s non-throwing synchronous decode boundary; the unknown-node failure contract at `Mdast.ts:346` and `scratchpad/test/markdown/mdast.test.ts:239`.   evidence: Read-only probes against both the port and the pinned oracle return `Failure` for an unknown node type `"unknown"`, but throw `TypeError: {} is not iterable` for `"toString"`, `"constructor"` and `"__proto__"`.
- failure: `admittedFields[type]` reads inherited object properties. These unknown node types obtain a prototype function or object instead of an admission-field array and throw before schema decoding. `fromMdastResult` escapes its Result channel; the Effect twin turns the same input into a defect.
- fix: Use an own-key lookup, such as `effect/Record.get`, or a `HashMap` for `admittedFields`. Let unrecognized names reach the schema decoder. Extend the existing unknown-node test with prototype-property names and record the verified upstream repair under section 14.

### sol-1-5
- file: scratchpad/effected/markdown/internal/carriers.ts:28
- class: law   severity: required
- standard: `standards/effect-laws-v1.md` law 7; `standards/effect-first-development.md` EF-1; D5’s schema-backed error requirement.   evidence: `RawMarkdownError` at line 28 and `GuardExceeded` at line 50 extend `Data.TaggedError`. A runtime probe confirms both constructors have `ast === undefined` and no `.make`. No applicable error-carrier exception is recorded in the allowlist. These declarations remain in the supplied green commit.
- failure: The engine’s cross-module error carriers have TypeScript payloads but no executable schema contract. They cannot participate in schema decoding, encoding or schema-derived arbitrary generation, and they do not satisfy the mandated direct `S.TaggedError` pattern.
- fix: Define schema-backed payloads and derive both errors directly from `S.TaggedError` with `$ScratchpadId` identities and meaningful annotations. Update their construction sites while preserving messages, tags and facade catch behavior.

### sol-1-6
- file: scratchpad/effected/markdown/MarkdownNode.ts:479
- class: schema   severity: required
- standard: D5; operator step 4 requiring identity and annotations on schemas and fields; `standards/effect-first-development.md` EF-12.   evidence: Runtime inspection shows `ast.annotations === undefined` for all seven exported suspended schemas: `PhrasingContent`, `FlowContent`, `ListContent`, `RowContent`, `TableContent`, `FrontmatterContent` and `MarkdownNode`. The checked MDX class fields also omit key annotations—for example, `MdxJsxAttribute.fields.name.ast.annotations` is undefined. These omissions remain despite the supplied green gates.
- failure: The schema graph lacks the required named identities and intent metadata at its exported category boundaries. The checked MDX classes also leave their fields outside the required annotation pass.
- fix: Apply `$I.annoteSchema(...)` to the seven exported suspended schemas and add meaningful `annotateKey(...)` metadata to the fields of `MdxJsxAttribute`, `MdxJsxFlowElement` and `MdxJsxTextElement`. Preserve their existing validation and encoded shapes.

### sol-1-7
- file: scratchpad/effected/markdown/MarkdownNode.ts:106
- class: schema   severity: required
- standard: D5’s `LiteralKit` requirement; `standards/effect-laws-v1.md` law 19; `standards/effect-first-development.md` EF-12b.   evidence: Eleven named, reused, annotation-bearing literal domains remain `S.Literals`: `ReferenceType`, `HeadingStyle`, `BreakStyle`, `FenceChar`, `BulletChar`, `ListDelimiter`, `ThematicBreakChar`, `EmphasisChar`, `HeadingDepth`, `TableAlign` and `FrontmatterFormat`. A runtime probe of `ReferenceType` confirms `.Enum`, `.is` and `.$match` are absent. The supplied green gates leave these named domains unchanged.
- failure: These schemas use the constructor reserved for anonymous inline unions and omit the required schema-derived literal-domain API.
- fix: Construct the eleven named domains with `LiteralKit`, retaining their literal values, IdentityComposer annotations and same-name type exports. Leave genuinely anonymous inline unions as `S.Literals`.

### sol-1-8
- file: scratchpad/effected/markdown/internal/inlineParser.ts:545
- class: effect-idiom   severity: required
- standard: `AGENTS.md`, “Prefer match helpers over conditional chains”; `standards/effect-first-development.md` EF-7; D11.   evidence: The upstream `materializeNode` switch has been replaced by an eleven-arm `if`/`else if` chain over `node.type`, ending in a catch-all `undefined`. The supplied green gates accept this chain.
- failure: Finite node-kind dispatch still uses the conditional ladder explicitly rejected by the cited standard. Replacing `switch` with chained conditionals clears the switch prohibition without implementing the required match-based dispatch.
- fix: Replace the ladder with `Match.value(node)` and discriminator cases, preserving every construction expression and the existing text-node fallback.

### sol-1-9
- file: scratchpad/effected/markdown/MarkdownVisitor.ts:58
- class: jsdoc   severity: backlog
- standard: `.patterns/jsdoc-documentation.md`, Hard requirements and Carrier policy; D4; S2 deferral in this review brief.   evidence: `MarkdownVisitor` retains an untitled `@example`, its `visit` method retains `@remarks`, and exported APIs across the focused files lack canonical `@category` and `@since 0.0.0`. Many value exports, including the node schemas, have no Example.
- failure: The carried documentation does not satisfy the final JSDoc carrier, metadata and example requirements.
- fix: In S2, preserve the existing prose and examples while converting carriers to `**Details**` and titled `**Example** (Title)` sections. Add canonical categories, `@since 0.0.0` and compiling examples for value exports.

### sol-1-10
- file: scratchpad/test/markdown/visitor.test.ts:31
- class: test   severity: backlog
- standard: `goals/effect-vitest-canon/SPEC.md` EV001 and D5; port goal section 11.2; S3 deferral in this review brief.   evidence: `collect` runs the visitor stream with `Effect.runSync` and is called inside ordinary `it` callbacks, including line 48. The same file hand-rolls Result assertions with `Result.isSuccess` and `Result.getOrThrow`. Frontmatter property tests similarly execute Effects through synchronous runners.
- failure: Effect execution bypasses the canonical test runner and its test services; Result assertions bypass the prescribed variant-and-payload helpers.
- fix: In S3, return the collection Effect from the helper and yield it inside `it.effect`. Convert effectful properties to `it.effect.prop`, and use `@effect/vitest/utils` helpers for Result assertions.

### sol-1-11
- file: scratchpad/test/markdown/node.test.ts:48
- class: test   severity: backlog
- standard: D10; port goal section 11.4; S3 deferral in this review brief.   evidence: The node suite contains construction and decode examples but no `Arbitrary.schema` encode/decode round-trip properties for the exported node schemas. Existing properties elsewhere use fixed counts—for example, `{ arbitrary: { runs: 250, size: 12 } }` at `oracle.property.test.ts:177`—and a module-wide search finds no `fcRuns` usage.
- failure: The schema property floor is incomplete, and existing property counts cannot honor the configured run-count floor. The mdast newline and label failures above also demonstrate gaps in the existing round-trip examples.
- fix: In S3, add schema-derived round-trip properties for the exported schemas and fidelity properties for the mdast boundary. Route existing and new run counts through `fcRuns(n)` while retaining the upstream oracle properties.

### sol-1-12
- file: scratchpad/effected/markdown/MarkdownNode.ts:45
- class: docs   severity: backlog
- standard: D9 and section 14’s deviation-recording protocol; explicit docs deferral in this review brief.   evidence: A differential probe shows `Point` decoding accepts `NaN`, `Infinity` and `-Infinity` in the pinned oracle but rejects them in the port. The same `Schema.Number → S.Finite` conversion affects `column`, `offset`, `Code.fenceLength` and `List.start`. The `schemaNumber` rule explains why this tightening was necessary, but README Port notes says `Deviations: None`, and the markdown ledger row has an empty `deviations` array.
- failure: A law-forced change to accepted inputs is absent from both required provenance records. Readers cannot distinguish an intentional rule-driven tightening from an accidental compatibility regression.
- fix: Retain the finite schemas and record the input-domain deviation in README Port notes and the ledger, citing `schemaNumber` and focused regression tests. Record the intentional engine error-class changes through the same protocol.

REQUIRED: 8
BACKLOG: 4