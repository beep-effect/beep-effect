### sol-2-1
- file: scratchpad/effected/yaml/internal/cst-parser.ts:399
- class: bug   severity: required
- standard: D9; D11; the ledger’s recorded removal of “same-or-shallower marker alternatives” as unreachable.   evidence: A read-only probe of `parseCSTAll("  ? a\n  : 1\n? b\n: 2\n")` reaches this branch with a shallower `block-map-start`. The pinned oracle returns two sibling block maps; the port nests the second map inside the first. Public `Yaml.parseResult` consequently returns `{ b: 2 }` in the oracle and `{ a: { "1": null, b: 2 } }` in the port. This counterexample disproves the recorded invariant; it is new evidence against that accepted simplification.
- failure: Dedenting explicit mappings changes the recovered CST and parsed value because every subsequent mapping-start marker is treated as a nested mapping. The behavior differs from the oracle even though the removal was recorded as behavior-preserving.
- fix: Restore the oracle’s indentation dispatch: recurse when `token.column > indent`, consume a same-indent marker, and stop on a shallower marker. Add this counterexample as a CST and recovered-value regression.

### sol-2-2
- file: scratchpad/effected/yaml/internal/fold.ts:355
- class: bug   severity: required
- standard: D9’s verified-upstream-bug exception; D11; formatter value fidelity.   evidence: In both the port and pinned oracle, `renderBlockLiteral("\n", "  ")` returns `"|\n"` and `renderBlockFolded("\n", "  ")` returns `">\n"`. Public `Yaml.stringifyResult("\n", { defaultScalarStyle: "block-literal" })` emits `"|\n\n"`; folded style emits `">\n\n"`. The independent `yaml` parser reads both as `""`. Existing block-rendering properties always supply `"keep"`, which bypasses this default-argument failure.
- failure: Requesting either block style silently loses a value consisting of exactly one newline. Clip chomping cannot preserve that newline in an otherwise empty body.
- fix: Derive keep chomping for every nonempty newline-only value, independently of `explicitChomp`, in both block renderers. Add round trips with omitted optional arguments and through the public stringify options; record the verified upstream-bug deviation.

### sol-2-3
- file: scratchpad/effected/yaml/internal/fold.ts:279
- class: bug   severity: required
- standard: D9’s verified-upstream-bug exception; D11; the renderer’s documented value-preserving contract.   evidence: `renderSingleQuotedMultiline("a \nb", "  ")` returns `"'a \n\n  b'"`; the independent parser reads it as `"a\nb"`. The public failure is reproducible in both the port and pinned oracle: `Yaml.stringifyResult("a \nb", { forceDefaultStyles: true })` emits `"'a \n\n  b'\n"`, which loses the space when parsed. Direct helper probes also lose continuation-leading whitespace: `"a\n b"` becomes `"a\nb"`.
- failure: Single-quoted flow folding strips whitespace adjacent to physical line breaks. The helper accepts values it cannot encode faithfully, and canonical public stringification reaches the trailing-whitespace case.
- fix: Return `null` for values containing whitespace before an interior newline or leading whitespace on a continuation line, and make the canonical caller fall back to double-quoted rendering for that result. Add helper and public canonical round-trip regressions; record the verified upstream-bug deviation.

### sol-2-4
- file: scratchpad/effected/yaml/internal/fold.ts:380
- class: bug   severity: required
- standard: D9’s verified-upstream-bug exception; D11; valid, value-preserving formatter output.   evidence: Both block renderers use `String(indent.length)` as an indentation indicator; folded rendering repeats this at line 458. Read-only public probes with value `" x"` and block-literal style produce `"|0-\n x\n"` for `indent: 0` and `"|10-\n           x\n"` for `indent: 10`. The independent parser rejects both headers. The pinned oracle reproduces the failure, and the public option schema accepts both finite values.
- failure: Accepted stringify options produce invalid YAML whenever preserving leading content spaces requires an explicit indentation indicator outside YAML’s single-digit `1`–`9` range.
- fix: When an explicit indicator is required and the requested indentation cannot supply a valid digit, use the existing double-quoted fallback rather than emitting `0` or a multi-digit indicator. Apply the guard to both block styles and add public regressions for indentation widths 0 and 10; record the upstream-bug deviation.

### sol-2-5
- file: scratchpad/effected/yaml/internal/cst-visitor.ts:488
- class: bug   severity: required
- standard: D9’s verified-upstream-bug exception; D11; `CstKeyEvent` and `CstValueEvent` classification contracts.   evidence: For `"a: one\n  two\nb: 2\n"`, the port emits key events for `a`, `two`, and `b`, and value events for `one` and `2`. The independent parser returns `{ a: "one two", b: 2 }`, and the AST visitor agrees. The pinned oracle also misclassifies `two`, establishing an upstream bug beyond the closed compact-map and omitted-value findings.
- failure: A continuation fragment of a multiline plain value becomes a mapping key because the walker toggles its role after each scalar CST node. Consumers receive an invented key even for valid YAML.
- fix: Advance mapping roles from actual key/value indicators and entry boundaries rather than every scalar fragment. Keep continuation fragments in their current role, including the analogous flow-map walk. Add multiline block and flow key/value projection regressions and record the verified upstream-bug deviation.

### sol-2-6
- file: scratchpad/effected/yaml/internal/lexer.ts:713
- class: bug   severity: required
- standard: D9’s verified-upstream-bug exception; D11; block-scalar header validity.   evidence: Read-only probes of both the port and pinned oracle show that `lexAll("|++\n  a\n")` and `lexAll("|22\n  a\n")` each return a scalar token without an error. Public `Yaml.parseResult` succeeds with `"a\n"` for both inputs. The independent `yaml` parser rejects the duplicated chomping or indentation indicator with “Block scalar header includes extra characters.”
- failure: The two-character header loop accepts two indicators of the same kind, silently overwriting the first. Strict parsing consequently accepts malformed block-scalar headers.
- fix: Track whether a chomping indicator and an indentation indicator have already appeared. Emit an error token on a second indicator of either kind while retaining both valid orderings, such as `|2+` and `|+2`. Add lexer and strict-parser regressions and record the verified upstream-bug deviation.

### sol-2-7
- file: scratchpad/effected/yaml/YamlVisitor.ts:29
- class: schema   severity: required
- standard: D5; D11; `standards/schema-first-development-prompt.md`, “Schema owns pure data” and “Precision carries invariants.”   evidence: The event schema restricts numeric path segments to `S.Finite`, but `walkPair` at line 303 retains every numeric resolved key. Visiting `".nan: x\n"` emits `Pair` and `Scalar` events with path `[NaN]`; visiting `".inf: x\n"` emits paths containing `Infinity`. A read-only probe of the defining path shape, `S.is(S.Array(S.Union([S.String, S.Finite])))`, returns `false` for both emitted paths.
- failure: Valid YAML produces events outside the schema from which `YamlVisitorEvent` is derived. The retained `Data.taggedEnum` constructors do not validate payloads, so this model/producer disagreement escapes the green gates.
- fix: Normalize non-finite mapping-key path segments to their string representation before constructing `pairPath`, retaining finite numeric segments and scalar values. Add `.nan` and signed-infinity path regressions and record the path normalization as the law-forced deviation; do not weaken the schema to unrestricted `S.Number`.

### sol-2-8
- file: scratchpad/effected/yaml/YamlVisitor.ts:236
- class: perf   severity: required
- standard: D11’s measured-regression criterion.   evidence: New measurements qualify the round-1 `visitor-guard-cost` backlog. A read-only, in-memory benchmark retained each version’s visitor implementation and replaced only composition with its own precomposed 3,000-pair AST. For 50 complete traversals, oracle/port times were `110.84/206.58`, `91.87/243.03`, and `101.82/217.15` ms, with identical event counts. An additional port-only comparison changed only the repeated `S.is` factories to module-local guards: for 100 traversals, current/hoisted times were `381.43/239.51`, `357.69/222.02`, and `369.79/231.09` ms, again with identical counts. No files were written.
- failure: The visitor rebuilds schema guards for each node and each pair key/value. Composition-independent traversal is about twice the oracle cost, and hoisting the guards removes approximately 38% of the measured port traversal time.
- fix: Derive Scalar, Alias, and Map guards once at module scope and reuse them in `walkNode` and `walkPair`. Retain schema-backed checks and event ordering, then repeat the isolated comparison.

### sol-2-9
- file: scratchpad/effected/yaml/internal/cst.ts:11
- class: schema   severity: required
- standard: D5; D11; `standards/effect-laws-v1.md`, law 19; `standards/effect-first-development.md`, EF-33; `standards/schema-first-development-prompt.md`, “Schema owns pure data.”   evidence: `CstNodeType` remains a named handwritten literal union, and `CstNode` at line 36 remains a concrete recursive data interface. `internal/cst-visitor.ts` likewise declares thirteen concrete event interfaces and their union without a schema. These declarations remain in the reviewed green commit; they are data models rather than service contracts, overload surfaces, or type-level transformations.
- failure: The CST vocabulary and event payloads lack the required executable schema source of truth. Their domains, recursive fields, and event variants cannot share schema-derived validation and generation with their TypeScript types.
- fix: Define an annotated internal `LiteralKit` for the node-kind domain, an annotated recursive structural schema for CST nodes, and an annotated tagged-union schema for CST events. Derive the existing exported types from those schemas. Preserve plain-object construction and existing traversal behavior; per-node decoding is unnecessary.

### sol-2-10
- file: scratchpad/effected/yaml/internal/options.ts:26
- class: schema   severity: required
- standard: D5; D11; `standards/effect-first-development.md`, EF-33; `standards/schema-first-development-prompt.md`, “Schema owns pure data.”   evidence: The reviewed source still defines configuration payloads as `ParseOptionsInput` and `StringifyOptionsInput` interfaces. The same omission remains on `RawDiagnostic` in `internal/diagnostics.ts:219`, `RawDirective` and `RawYamlDocument` in `internal/raw-document.ts:23,45`, and `RawEdit` in `internal/diff.ts:13`. Each is a concrete field-based configuration or pipeline payload, with no schema-derived definition. The recorded schema-first deviation lists other converted models but provides no exception for these remaining payloads.
- failure: These cross-file data contracts remain outside the mandatory schema-first model. Configuration and raw pipeline records are independently handwritten instead of deriving their types, field domains, and metadata from executable schemas.
- fix: Define annotated internal structural schemas for these existing shapes and derive their exported types. Preserve optionality, plain-object construction, and defaults at the current consumption sites so the conversion does not introduce validation work or change behavior.

REQUIRED: 10
BACKLOG: 0