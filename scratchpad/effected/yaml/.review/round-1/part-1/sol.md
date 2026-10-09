### sol-1-1

- file: scratchpad/effected/yaml/Yaml.ts:711
- class: bug   severity: required
- standard: D9, D11, section 14 (`upstream-bug`); `Yaml.stripComments`’s contract to remove comments while retaining scalar content.   evidence: Read-only probes against both the reviewed commit and the pinned oracle produce `stripComments("a: |\n  # literal content\n") === "a: |\n  \n"`; `Yaml.equals(input, stripped)` returns `false`. The existing lexer correctly emits no comment token for this input. A second probe, `"a: bob's # real comment\n"`, leaves the real comment intact because the apostrophe incorrectly enters quoted-scalar state.
- failure: Comment stripping deletes block-scalar data and misses comments following plain scalars containing quote characters. This is a verified inherited upstream bug, not a port-only regression.
- fix: Strip or replace the internal lexer’s actual comment-token spans instead of maintaining a separate character-level quote scanner. Add regressions for block scalars and quotes inside plain scalars, and record the correction through section 14.

### sol-1-2

- file: scratchpad/effected/yaml/YamlDiagnostic.ts:192
- class: bug   severity: required
- standard: D11; `YamlDiagnostic.fromRaw`’s zero-based source-position contract; section 14 (`upstream-bug`).   evidence: In both the port and pinned oracle, `YamlDiagnostic.fromRaw({ code: "UnexpectedToken", message: "x", offset: 1, length: 1 }, "\r\n")` returns `line: 1, character: -1`. The CRLF lookahead consumes the LF beyond the requested offset and sets `lineStart` to `2`.
- failure: A valid source offset inside a CRLF pair produces a negative column, which cannot represent the promised zero-based source position.
- fix: Bound CRLF lookahead by the scan limit, so `lineStart` cannot advance beyond the requested offset—for example, use `i + 1 < limit` for the LF-consumption condition. Add an interior-CRLF regression and record the upstream-bug correction.

### sol-1-3

- file: scratchpad/effected/yaml/YamlToken.ts:94
- class: bug   severity: required
- standard: D11; `YamlToken`’s contract that token positions match the diagnostic position vocabulary; section 14 (`upstream-bug`).   evidence: Tokenizing `"a: 1\rb: 2\r"` in both the port and pinned oracle gives the `b` token `{ offset: 5, line: 0, character: 5 }`. `YamlDiagnostic.fromRaw` for that same span gives `{ line: 1, character: 0 }`. The parser successfully accepts the input.
- failure: Tokens on CR-only YAML report the wrong line and column. Token and diagnostic consumers disagree about the same source span.
- fix: Build the token line-start index with the same line-break handling as diagnostics, including lone CR and CRLF. Preserve CRLF as one break, add a CR-only position regression, and record the upstream-bug correction.

### sol-1-4

- file: scratchpad/effected/yaml/YamlNode.ts:614
- class: perf   severity: required
- standard: D11’s measured-regression criterion.   evidence: A read-only Bun benchmark constructed equivalent 5,000-scalar `YamlSeq` instances through each implementation, warmed both with ten `toValue()` calls, then timed 100 calls per implementation. Subsequent rounds measured oracle/port times of **3.10/44.12 ms** and **2.92/44.69 ms** for 500,000 scalar visits—approximately **14–15× slower** in the port. A separate guard benchmark measured repeatedly deriving `S.is(YamlScalar)` at **22.99–31.98 ms**, versus **8.73–11.06 ms** when derived once.
- failure: The AST walk repeatedly invokes the schema guard factory at each node, adding substantial overhead to value extraction. The same pattern appears in navigation and formatting walks.
- fix: Bind the schema-derived node guards once after the class declarations and reuse them throughout the walks. Retain schema-backed guards and rerun the same benchmark.

### sol-1-5

- file: scratchpad/effected/yaml/YamlNode.ts:25
- class: schema   severity: required
- standard: `standards/effect-laws-v1.md`, law 19; `standards/effect-first-development.md`, EF-35; D5.   evidence: Named domains use `S.Literals` throughout the focused surface: `ScalarStyle`, `CollectionStyle`, `QuoteStyle`, `QuoteCompat`, `ScalarChomp`, the five diagnostic-code schemas, `YamlLintSeverity`, and `YamlTokenKind`. A runtime probe confirms `ScalarStyle` has none of the kit’s `Enum`, `is`, or `$match` helpers. These named-domain declarations remain in the declared-green commit; the completed gates therefore do not establish this law’s compliance.
- failure: Reused, annotation-bearing literal domains do not satisfy the required `LiteralKit` modeling contract.
- fix: Replace the named `S.Literals` declarations with equivalently annotated `LiteralKit` values, preserving their names, literal members, and same-name derived types. Keep anonymous inline literal unions as `S.Literals`.

### sol-1-6

- file: scratchpad/effected/yaml/YamlNode.ts:279
- class: schema   severity: required
- standard: Operator revision, step 4, in `scratchpad/EFFECTED_PORT_GOAL.md`; D5; `standards/effect-first-development.md`, EF-12.   evidence: The exported `YamlNode` schema is a bare `S.suspend(() => S.Union(...))`, unlike its annotated member schemas. A read-only runtime probe prints `YamlNode.ast.annotations === undefined`.
- failure: The public recursive union has no composer-derived schema identity, title, or description, leaving the required schema-identity pass incomplete.
- fix: Apply `$I.annoteSchema("YamlNode", { description: ... })` to the exported suspended schema while retaining its recursive codec type.

### sol-1-7

- file: scratchpad/effected/yaml/YamlNode.ts:544
- class: schema   severity: required
- standard: D5; `standards/effect-first-development.md`, EF-1, requiring public or cross-module failures to extend `S.TaggedError` directly.   evidence: `AliasExpansionBudgetExceeded` is exported from this file, thrown during extraction, and caught across module boundaries by `Yaml.ts`. It extends `Data.TaggedError` and has no `$I` identity or schema annotations. A runtime probe returns `S.isSchema(AliasExpansionBudgetExceeded) === false`.
- failure: This cross-module error remains outside the required schema-backed error model and composer identity contract.
- fix: Make it an annotated `S.TaggedError` using `$I`, retaining its tag, message, `name`, and existing `constructor(limit: number)` behavior.

### sol-1-8

- file: scratchpad/effected/yaml/YamlEdit.ts:80
- class: law   severity: required
- standard: `standards/effect-laws-v1.md`, law 10: no native `Array.prototype.sort`; use `A.sort` with explicit `Order`.   evidence: The declared-green commit still contains `[...edits].sort(...)` here and native sorts in `YamlLint.ts:296`, `:297`, `:444`, and `:527`. No corresponding sort exception is recorded in the law allowlist. These reachable calls demonstrate that the completed gates missed this prohibition.
- failure: Edit ordering, evidence normalization, conflict ordering, and diagnostic ordering still execute the explicitly forbidden native sorting API.
- fix: Replace these calls with `A.sort` and equivalent explicit `Order` values, preserving stable tie ordering and existing output order.

### sol-1-9

- file: scratchpad/effected/yaml/YamlLint.ts:379
- class: law   severity: required
- standard: `standards/effect-first-development.md`, EF-3: never use native `JSON.parse`/`JSON.stringify`; use schema JSON codecs.   evidence: `YamlStyleConflictError.message` calls `JSON.stringify(c.value)` for each conflict candidate. The call remains reachable in the declared-green commit, and no YAML lint JSON exception is recorded.
- failure: Rendering a style conflict uses native JSON serialization despite the binding codec requirement.
- fix: Bind a schema JSON codec for the existing string/finite-number/boolean candidate domain and use its synchronous Result encoder, preserving the current JSON spelling in error messages.

### sol-1-10

- file: scratchpad/effected/yaml/YamlDocument.ts:56
- class: jsdoc   severity: backlog
- standard: `.patterns/jsdoc-documentation.md`, hard requirements and carrier policy; EFFECTED_PORT_GOAL section 10.2; the review brief’s S2 deferral.   evidence: This block retains `@example`, and line 168 retains `@remarks`. The focused files contain further legacy carriers and lack the required `@category` and `@since` tags. Several value exports, including the diagnostic-code schemas, have no titled example.
- failure: The documentation has not reached the required S2 grammar, metadata, and example coverage.
- fix: During S2, convert legacy carriers, add canonical categories and `@since 0.0.0`, and supply compiling titled examples while retaining the upstream behavioral prose.

### sol-1-11

- file: scratchpad/test/yaml/YamlDocument.test.ts:97
- class: test   severity: backlog
- standard: `goals/effect-vitest-canon/SPEC.md`, D5; EFFECTED_PORT_GOAL section 11.2; the review brief’s S3 deferral.   evidence: The effectful test branches on `Result.isFailure(result)`, manually fails the success case, and then accesses `result.failure`. No file under `scratchpad/test/yaml` imports `@effect/vitest/utils`; other focused tests similarly hand-roll Option and Result assertions.
- failure: Container assertions have not undergone the scheduled canonical test migration.
- fix: During S3, use the appropriate `assertFailure`, `assertSuccess`, `assertSome`, and `assertNone` helpers while preserving every payload assertion and upstream test.

### sol-1-12

- file: scratchpad/test/yaml/YamlToken.test.ts:90
- class: test   severity: backlog
- standard: D10; EFFECTED_PORT_GOAL section 11.4; the review brief’s S3 deferral.   evidence: The token codec round-trip uses one fixed token. Searching `scratchpad/test/yaml` finds only three `it.effect.prop` sites, with no `Arbitrary` or `fcRuns` usage. The exported schemas in the focused surface therefore lack the specified schema-derived round-trip properties.
- failure: Fixed examples do not satisfy the per-export schema/codec property floor or configurable run-count requirement.
- fix: During S3, add schema-derived encode/decode round-trip properties for the focused exported schemas and codecs, with run counts through `fcRuns(n)`, retaining the existing example and oracle tests.

REQUIRED: 9
BACKLOG: 3

