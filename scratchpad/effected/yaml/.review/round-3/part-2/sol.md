### sol-3-1
- file: scratchpad/effected/yaml/internal/fold.ts:70
- class: bug   severity: required
- standard: D9, D11, §14 verified upstream-bug; `foldScalarLine`’s documented value-preserving contract.   evidence: A read-only Bun probe called `Yaml.stringifyResult("one two \tthree four", { defaultScalarStyle: "block-folded", lineWidth: 12 })`. Both the port and pinned oracle emitted `">-\n  one two\n  \tthree\n  four\n"`. The independent `yaml` parser decoded this as `"one two\n\tthree\nfour"`, instead of the original string. The split-candidate check excludes neighboring spaces but permits a following tab.
- failure: Width folding moves an interior tab to the beginning of a continuation line. YAML treats that line as more-indented content and preserves the surrounding line breaks, changing the scalar value despite successful serialization. The recorded more-indented-content repair concerns block rendering before width folding and does not cover this counterexample.
- fix: Exclude split points that would make a continuation start with a tab. Add a public stringify fidelity regression with interior tabs and positive `lineWidth`, and extend the folding property generator to cover this case. Record the verified upstream-bug correction under §14.

### sol-3-2
- file: scratchpad/effected/yaml/internal/cst-visitor.ts:443
- class: bug   severity: required
- standard: D9, D11; CST key/value classification contract.   evidence: For `"a: |\n  x\n: 2\n"`, a read-only probe produced port key sources `["a", "|\n  x\n"]` and value sources `["2"]`. The pinned oracle classified `"|\n  x\n"` as a value. The independent parser and port value parser both returned `{ a: "x\n", "": 2 }`. The same regression occurs with folded style. `findMapContent` stops at separate newline children, but the preceding block-scalar node contains the newline in its own source span, so lookahead reaches the next entry’s `:`.
- failure: A block-scalar value before an empty-key entry is reclassified as a key, and the actual empty key disappears. This is new evidence against the round-2 boundary repair: its fixed plain-scalar examples have separate newline nodes, while block scalars absorb those breaks.
- fix: Determine same-line key promotion and subsequent entry boundaries from source spans, including line breaks contained inside scalar or collection nodes. Preserve the block scalar’s value role and emit the next empty key. Add literal- and folded-block regressions alongside the existing empty-key tests.

### sol-3-3
- file: scratchpad/effected/yaml/YamlVisitor.ts:183
- class: bug   severity: required
- standard: D11; §14 verified upstream-bug; Effect stream construction semantics. The local Effect reference documents that `Stream.suspend` evaluates its factory each time the stream runs.   evidence: A read-only probe created `const stream = YamlVisitor.visit("a: 1\n")` and collected that same stream twice. Event counts were `7`, then `0`, in both the port and pinned oracle. Collecting `Stream.take(stream, 1)` on a fresh visitor stream also left a subsequent full collection empty. Wrapping construction in `Stream.suspend(() => YamlVisitor.visit("a: 1\n"))` produced seven events on both full runs and again after a partial run.
- failure: `visit` captures one mutable generator instance. Its returned stream becomes exhausted or closed after its first execution, so reusing a parsing pipeline silently loses all events. Partial consumption also prevents a later complete traversal of the same stream.
- fix: Construct the generator inside `Stream.suspend`: `Stream.suspend(() => Stream.fromIterable(visitGen(text, options)))`. Add repeated-collection and partial-then-full-collection regressions, and record the upstream-bug correction under §14.

### sol-3-4
- file: scratchpad/effected/yaml/internal/requote.ts:52
- class: schema   severity: required
- standard: D5, D11; `standards/ARCHITECTURE.md`, “Schemas Are Executable Contracts”; `standards/effect-first-development.md` EF-33 and EF-12b; `standards/effect-laws-v1.md` law 19.   evidence: `RequoteScalarInput` remains a handwritten interface containing only scalar data, presentation metadata, and source coordinates. `RequoteMode` at line 79 remains the named literal union `"conservative" | "escaping"` and controls the branch at line 129. Neither has a defining schema. These declarations are present in the reviewed commit and are not covered by the recorded schema migrations or a model exception.
- failure: The reusable requoting payload and policy domain remain outside the required schema source of truth. Their fields and literal vocabulary have no schema-derived validation, annotations, or arbitraries; the green gates missed these concrete modeling-law violations.
- fix: Define an identity- and field-annotated structural schema for `RequoteScalarInput`, reusing `ScalarStyle`, and an annotated `LiteralKit` for `RequoteMode`. Derive the existing same-name types. Preserve plain-object inputs, optional-field compatibility, and quote-conversion behavior without adding decoding to each call.

### sol-3-5
- file: scratchpad/effected/yaml/internal/cst-parser.ts:17
- class: schema   severity: required
- standard: D5, D11; `standards/effect-first-development.md` EF-33; `standards/schema-first-development-prompt.md`, “Schema owns pure data.”   evidence: `ParserState` is a handwritten four-field data interface: `tokens`, `text`, `pos`, and `depth`. It contains no methods, service contract, overload machinery, or type-level transformation. Its token field already has the schema-backed `YamlToken` building block, but no schema defines the parser-state payload.
- failure: The internal parser model remains independently handwritten after the schema-first pass. Cursor and depth fields, their mutability, and the token collection have no executable source of truth. This is a remaining pure-data model, distinct from the closed CST-node and raw-pipeline findings.
- fix: Define a file-local annotated structural `ParserState` schema and derive its type, keeping `pos` and `depth` writable through schema field modifiers. Retain plain-object construction and the current parser algorithm; per-step validation is unnecessary.

### sol-3-6
- file: scratchpad/effected/yaml/internal/options.ts:30
- class: test   severity: required
- standard: D10’s mandatory encode/decode round-trip property for every exported schema or codec; D11’s binding-law criterion; §11.4 property floor.   evidence: A read-only search across `scratchpad/test/yaml/**/*.ts` found runtime references to `CstNode`, `ParseOptionsInput`, `StringifyOptionsInput`, `RawDirective`, and `RawYamlDocument` only in `internal/round-2-integration.test.ts`, which uses fixed `S.is` assertions. `RawDiagnostic` and `RawEdit` have no runtime schema references in the tests. None of these seven schemas has an `Arbitrary.schema` encode/decode round-trip property. Existing parser/diff properties exercise their algorithms, and `index.property.test.ts` covers barrel schemas rather than these new internal exports.
- failure: The runtime schemas introduced by the round-2 repair do not meet D10’s property floor. Green coverage and fixed validation examples do not establish the required generated codec round trips. This concerns newly added schema exports, rather than repeating the earlier property-floor finding for preexisting models.
- fix: Add canonical `it.effect.prop` round trips for the seven exported schemas using `Arbitrary.schema`, `S.encodeEffect`, `S.decodeEffect`, schema equivalence, and `fcRuns(n)`. Keep the existing integration and algorithm properties.

REQUIRED: 6
BACKLOG: 0

