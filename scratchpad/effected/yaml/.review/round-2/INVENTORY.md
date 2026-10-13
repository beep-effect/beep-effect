# YAML round-2 inventory

Read all 15 seat reports (grok.md, sol.md and fable.md across part-1 through part-5) and five adjacent BRIEF.md files. All 68 seat records are accounted for: **48 Required, 2 Backlog, 0 Handled by the deviation codemod, 0 Rejected; 9 groups**. Seat IDs are part-qualified; fable.md records the separate Grok medium fallback route.

Reports review 2f515ae2519cc72223c94917019bf7ebfe92a4a5. Inventory checkout is @lab/effected-2 at 6bae3790c442e889df0e2dd8502a032a3f1468a4; no branch switch. Classification follows the full operator revision block, D1-D20, sections 12.4-12.5 and 14, and this merge's S2/S3 deferral. The live native-runtime allowlist has **zero YAML entries**, so no allow-<n> findings are added. Restore decisions cite git history and step-2/S1/law diffs below.

## Required

Every listed source/test file belongs to one required.json group; each group has at most six source files. Schema migrations retain structural plain-object construction and writable/optional keys. The six-file composer group owns all malformed-tag provenance/signature integration; interacting groups land together. Two proposed local tests are internal/cst-parser.round-2.test.ts and internal/raw-models.round-2.test.ts; neither is created by this inventory.

Only YAML source/test surfaces are assigned. Upstream-bug repairs provide reproduction and adjusted-test citations to the orchestrator for central section-14 recording before integration. No group owns root manifests, lockfiles, repo config, PORT_LEDGER.json or README Port notes. Systemic law-forced deviation/export bookkeeping stays with the per-module, per-class codemod. Private schema annotations remain step-4/EF-12 requirements rather than deferred JSDoc work. Later vitest runs use --maxWorkers=2, one at a time; module-wide coverage uses beep-heavy --slot-only. This merge ran no tests, compiler, audit, ledger or closeout command.

### lint-cr-lines — Align lint lines with CR-aware token positions

- file: scratchpad/effected/yaml/YamlLint.ts:216
- class: bug   severity: required
- standard: D9; D11. The recorded lone-CR deviation covers scanner and public token positions only (README Port notes, `token-cr-positions`).
- evidence: `YamlToken.promoteAll` (`YamlToken.ts:105-108`) treats a lone CR and a CRLF as one line break. `buildLines` (`YamlLint.ts:216-217`) splits only on `\n` and strips a CR only when it sits immediately before that `\n`. `document-start` and `document-end` then read `ctx.lines[token.line]` (`internal/rules/document-start.ts:117`, `internal/rules/document-end.ts:128`). For `"\r---\n"` with `present: false`, the document-start token is at offset 1. `promoteAll` assigns it line 1. `buildLines` keeps one line, `"\r---"`. The lookup is `""`, `trim() === "---"` fails, and the removal fix is omitted. Upstream `promoteAll` splits only on `\n`, so the marker stays on line 0, `"\r---".trim() === "---"`, and the fix is offered. `"\r...\n"` with document-end `present: false` drops the same way. CRLF already agrees on both sides.
- failure: After the admitted CR token fix, `token.line` no longer indexes `ctx.lines`. A marker alone on a lone-CR line loses the autofix upstream emits.
- fix: Split `buildLines` with the same lone-CR and CRLF convention as `promoteAll`, and keep the trailing-break rule that a final empty segment is not a line. Leave U+2028 and U+2029 as non-breaks. `eof-newline` still keys off `endsWith("\n")`; only its reported line and character move when a file contains a lone CR.
- seats: part-1/grok-2-1, part-1/fable-2-1
- group: g2

### restore-empty-stream-codec — Restore upstream empty-stream codec decoding

- file: scratchpad/effected/yaml/Yaml.ts:1051
- class: bug   severity: required
- standard: D9; D11. Upstream `Yaml.allFromString` decodes through `Yaml.parseAll` (oracle `packages/yaml/src/Yaml.ts:802-803`). No ledger or Port-notes entry covers an empty-string branch.
- evidence: `Yaml.parseAllResult` documents empty input as `[null]` (`Yaml.ts:772-774`), and `scratchpad/test/yaml/Yaml.test.ts:331` locks that result. The codec decodes `input === ""` to `[]` before `parseAll`. Encoding `[]` is still `""`, matching the oracle encode. `scratchpad/test/yaml/Yaml.property.test.ts:20` round-trips `allFromString` only through `S.Array(Value)`, so the property exercises `[]` and never compares the empty decode with `parseAll("")`. History: git log --format=%h:%s -- Yaml.ts and git show 7a6b586acb place the empty-input shortcut in S3. Pre-S3 decoding always calls parseAll, and the step-2/law diffs do not introduce this shortcut; no law, diagnostic or operator ruling requires it.
- failure: Decoding `""` through `Yaml.allFromString` yields `[]`. `Yaml.parseAll` / `parseAllResult("")` and the pinned upstream codec yield `[null]`.
- fix: Restore the upstream decoder shape: always call Yaml.parseAll(input, options), giving [null] for empty input. Restore upstream test lines rewritten for this shortcut if any; the relevant S3 property file was newly added, so constrain that stream round-trip property to nonempty arrays instead of changing parser behavior. Preserve the upstream [] -> empty-string encoder contract and empty-parser assertion; add codec-versus-parseAll empty-input parity.
- seats: part-1/grok-2-2, part-1/fable-2-2
- group: g1

### invalid-header-comments — Tokenize comments on invalid block-scalar headers

- file: scratchpad/effected/yaml/Yaml.ts:882; scratchpad/effected/yaml/internal/lexer.ts:737-749
- class: bug   severity: required
- standard: D9; D11. Distinct from the three recorded comment deviations (block-scalar content hashes, apostrophe comments, CRLF replacement bytes) and from round-1 `yaml-comments`.
- evidence: `stripComments` removes comment tokens, and re-lexes a header only when the token kind is `scalar` and the source starts with `|` or `>` (`Yaml.ts:882-890`). For `"> hello # comment\n"`, `scanBlockScalar` (`internal/lexer.ts:737-749`) takes the invalid-header branch and returns one `error` token covering the whole line, including the whitespace-preceded `# comment`. The scalar re-lex does not run, so the source is unchanged. Upstream's character scanner (oracle `packages/yaml/src/Yaml.ts:701-708`) is outside quotes, sees a `#` preceded by a space, and returns `"> hello \n"`. A `#` without preceding whitespace, and a `#` inside another error token such as an unterminated quote, stays on both sides.
- failure: A real comment on an invalid block-scalar header survives `Yaml.stripComments`. Upstream removes it.
- fix: In the invalid-header branch, end the error token at a whitespace-preceded `#` and emit `scanComment` for the rest. The existing comment walk then strips it. Leave `#` inside block-scalar bodies and inside other error tokens in place.
- seats: part-1/grok-2-3, part-1/fable-2-3
- group: g1

### modify-combined-depth — Return a typed failure when modification exceeds combined depth

- file: scratchpad/effected/yaml/YamlFormat.ts:1159
- class: bug   severity: required
- standard: standards/effect-first-development.md EF-31; D11; section 14 verified upstream-bug
- evidence: A read-only Bun probe called `modify` with source `"[".repeat(160) + "0" + "]".repeat(160) + "\n"`, path `Array(160).fill(0)`, and a replacement consisting of 160 nested arrays around `"x"`. Both the lab and pinned oracle returned an Exit containing `Die(StringifyDepthExceeded)`, rather than a typed modification failure. The document and replacement are each individually below the 256-level limit.
- failure: Replacement lowering starts its depth counter at zero. Inserting that value into an existing nested document can exceed the stringifier’s limit, contradicting this module’s assumption that lowering prevents every stringifier depth failure. Callers cannot recover through `Effect.catchTag("YamlModificationError", ...)`.
- fix: Wrap the final stringifyDocument call in targeted Effect.try handling; translate only StringifyDepthExceeded to YamlModificationError with a NestingDepthExceeded diagnostic and echoed path. Preserve unexpected defects and the composer-bounded format path. Add the combined-depth regression and correct the inaccurate unreachable-failure comment as part of the bug repair. Supply reproduction/test citations for central upstream-bug recording.
- seats: part-1/grok-2-4, part-1/sol-2-1
- group: g3

### lint-own-config-keys — Preserve own rule and option keys

- file: scratchpad/effected/yaml/YamlLint.ts:691
- class: bug   severity: required
- standard: D9; D11; section 14 verified upstream-bug; `YamlLint.run`’s documented rule that absent config entries skip a rule
- evidence: A read-only Bun probe supplied one custom rule with `id: "toString"` and `YamlLintConfig.make({ rules: {} })`. In both the lab and pinned oracle, its `check` callback ran once and returned one finding. A second probe inferred a custom option with dimension `"__proto__"` and value `"double"`; both implementations returned `{"custom":{}}`, losing the option.
- failure: Config lookups read inherited properties, so an unconfigured custom rule can run. The assignments at lines 588–589 also treat `__proto__` as a prototype setter rather than an ordinary rule or option key, silently discarding valid custom inference data.
- fix: Read config entries with R.get; build overlays with R.fromEntries and own-property-safe R.assignProperty. Preserve off/warning behavior. Add absent toString/constructor rule and own __proto__ rule/dimension regressions; supply central upstream-bug evidence.
- seats: part-1/grok-2-5, part-1/sol-2-2
- group: g2

### lint-tuple-collisions — Keep style-evidence tuple identities distinct

- file: scratchpad/effected/yaml/YamlLint.ts:396
- class: bug   severity: required
- standard: D11; section 14 verified upstream-bug; `StyleEvidence.combine`’s contract to aggregate by distinct `(rule, dimension, value)` tuples
- evidence: In a read-only Bun probe, combining votes for rule `"a\u0000b"` / dimension `"c"` and rule `"a"` / dimension `"b\u0000c"`, both with value `"double"`, produced one tally with count `2` in both the lab and pinned oracle. The floor key at line 402 has the same ambiguity. These fields use unrestricted `S.String`.
- failure: NUL-delimited concatenation is not an injective tuple encoding. Evidence belonging to separate custom rules or dimensions merges, losing one identity and producing incorrect counts, floors, conflicts, and inferred settings.
- fix: Replace concatenated keys with nested Effect maps keyed separately by rule, dimension, and value, or an unambiguous tuple encoding. Preserve canonical output order and first-seen positions. Add vote and floor collision regressions and record the upstream-bug correction.
- seats: part-1/grok-2-6, part-1/sol-2-3
- group: g2

### lint-histogram-complexity — Accumulate style observations once

- file: scratchpad/effected/yaml/YamlLint.ts:440
- class: perf   severity: required
- standard: D11 algorithmic-class criterion
- evidence: For `N` distinct vote values, `fromObservations` calls `combine` once per observation. Iteration `k` traverses and reconstructs all `k` accumulated tallies and sorts them again, giving at least `Ω(N²)` accumulated traversal work. A single histogram accumulation followed by one canonical sort requires `O(N log N)` expected work with hash maps. Bounded read-only probes with 1,000 and 2,000 distinct values took approximately 98 ms and 404 ms in the lab; the oracle showed the same inherited scaling. Required severity rests on the algorithmic-class improvement, not a claimed port regression.
- failure: Custom inference with many distinct values repeatedly rebuilds the entire evidence histogram. Collection migrations and hoisted guards do not remove this quadratic accumulation.
- fix: Accumulate vote counts, first positions, and maximum floors in local Effect maps throughout the observation loop, then materialize and sort the two arrays once. Retain the existing ordering, homomorphism, and first-position semantics.
- seats: part-1/grok-2-7, part-1/sol-2-4
- group: g2

### node-native-own-property — Remove native own-property construction missed by the gate

- file: scratchpad/effected/yaml/YamlNode.ts:1005
- class: law   severity: required
- standard: effect-laws-v1 law 6. `NoNativeRuntime` `OBJECT_METHODS` is `keys`, `values`, `entries`, `fromEntries`, `assign`, `hasOwn`, `freeze`, `seal`, `create` (`packages/tooling/tool/cli/src/commands/Laws/NoNativeRuntime.ts:56-66`), so `Object.defineProperty` passes the gate. Round-1 inventory: concrete scanner misses stay required. `Record.assignProperty` creates an own data property when the key is `"__proto__"` (`effect/packages/effect/src/Record.ts:1086-1104`).
- evidence: `setOwnProperty` calls `Object.defineProperty` for the key `"__proto__"` (`YamlNode.ts:1002-1005`). `nodeToValue` uses it for every mapping key (`YamlNode.ts:1166`).
- failure: Domain object construction still calls a native `Object` method. The scratchpad law gate does not see it.
- fix: Replace setOwnProperty's body with R.assignProperty(obj, key, value). Preserve early anchor registration, own __proto__, last-wins duplicate replacement and first-seen key order. This is a reachable native-operation repair, not a request to record a previous forced migration.
- seats: part-1/grok-2-8, part-1/sol-2-5
- group: g4

### invariant-error-metadata — Complete both private invariant-error schema annotations

- file: scratchpad/effected/yaml/YamlEdit.ts:22; scratchpad/effected/yaml/YamlFormat.ts:57
- class: schema   severity: required
- standard: EFFECTED_PORT_GOAL.md operator revision step 4; standards/effect-first-development.md EF-12; D5
- evidence: `YamlEditFailure` and the equivalent `YamlFormatInvariantFailure` at `YamlFormat.ts:57` have composer-derived identifiers but omit `$I.annote(...)` schema metadata and `message.annotateKey(...)` field metadata. A read-only overlap probe showed `YamlEditFailure` schema annotations containing only its generated identifier and tag sentinel; `fields.message.ast.annotations` was `undefined`.
- failure: These newly introduced error schemas received only identifier wiring, leaving the required schema descriptions and field annotations absent. Public docgen and the green gates did not catch the private error schemas.
- fix: Add meaningful $I.annote descriptions and message.annotateKey metadata to YamlEditFailure and YamlFormatInvariantFailure. Preserve tags, messages and throwing behavior. This is missing step-4/EF-12 schema metadata, not JSDoc or bookkeeping about the forced native-error replacement.
- seats: part-1/grok-2-9, part-1/grok-2-10, part-1/sol-2-9
- group: g3

### lint-context-models — Derive lint line and context payloads from schemas

- file: scratchpad/effected/yaml/YamlLintRule.ts:101
- class: schema   severity: required
- standard: standards/ARCHITECTURE.md “Schemas Are Executable Contracts”; standards/effect-first-development.md EF-33; standards/schema-first-development-prompt.md “Schema owns pure data”; D5
- evidence: `LintLine` at line 101 and `LintContext` at line 129 remain handwritten interfaces containing only data fields. Their shapes are representable using the existing string, numeric, token, document, and array schemas. They are separate from the callable `YamlRule` extension contract.
- failure: These reusable lint payloads have no schema source of truth, runtime identity, field annotations, or schema-derived types. The green gates missed these remaining pure-data models.
- fix: Define identity- and field-annotated structural schemas for LintLine and LintContext, deriving their same-name types. Preserve plain-object construction and representations so consumers need no constructor migration. Keep callable YamlRule as an interface.
- seats: part-1/grok-2-11, part-1/sol-2-6
- group: g2

### lint-inference-model — Give the inference report a schema source of truth

- file: scratchpad/effected/yaml/YamlLint.ts:660
- class: schema   severity: required
- standard: standards/effect-first-development.md EF-33; standards/schema-first-development-prompt.md “Schema owns pure data”; D5
- evidence: `YamlLintInference` is a handwritten payload interface containing `config: YamlLintConfig` and `residual: ReadonlyArray<YamlLintDiagnostic>`, both of which already have runtime schemas. `inferLenient` constructs this report as a plain object.
- failure: The public inference report remains outside the schema-first modeling contract even though all its constituent models are schema-backed.
- fix: Add an annotated `YamlLintInference` structural schema from the existing constituent schemas and derive the public type from it, preserving the returned plain-object shape.
- seats: part-1/grok-2-12, part-1/sol-2-7
- group: g2

### expansion-budget-model — Derive the mutable expansion budget from a schema

- file: scratchpad/effected/yaml/YamlNode.ts:1088
- class: schema   severity: required
- standard: standards/effect-first-development.md EF-12b and EF-33; standards/schema-first-development-prompt.md “Schema owns pure data”; D5
- evidence: `ExpansionBudget` remains a handwritten concrete payload with `count` and `limit`, reused by `defaultBudget`, `nodeToJsValue`, and the recursive extraction walk. It is a named internal model, rather than an overload or type-level utility.
- failure: The alias-expansion budget’s data shape and metadata are defined solely through an interface, leaving this internal model outside the required schema-first pass.
- fix: Define an annotated structural budget schema and derive its writable counter type from that schema. Preserve the current budget calculation, counting behavior, and accepted parse-option semantics.
- seats: part-1/sol-2-8
- group: g4

### cst-empty-key-roles — Preserve mapping values and explicit empty keys

- file: scratchpad/effected/yaml/internal/cst-visitor.ts:469
- class: bug   severity: required
- standard: D9 behaviour-preserving; D11 bug. The round-1 `cst-empty-values` repair is still open on this input.
- evidence: In `walkBlockMapChildren`, a scalar whose next `:` survives `findMapContent` is forced to a key before the value test. `findMapContent` skips newlines, so for `a: 1\n: 2` the block-map children are `:`, `1`, newline, `:`, `2`. At `1`, lookahead still sees `:`, sets `expectingKey`, and emits `CstKeyEvent` `"1"`; `2` is then the only value. The same `:` arm at line 448 runs while a key is already expected and only clears `expectingKey`, so the empty key is never emitted. `walkFlowMapChildren` line 557 does the same: `{a: 1, : 2}` emits key `"a"` and values `"1"`, `"2"`, with no key for the second entry. `{a: , b: 2}` still works because the comma, not this lookahead, restores key position.
- failure: A value placed before an empty-key entry is reported as a key, and the empty key itself disappears. `a: 1\n: 2` projects keys `a`, `1` and value `2`. `a:\nb: 2` must stay keys `a`, `b` and value `2`.
- fix: Keep the same-line omitted-value promotion, and do not treat a `:` after a newline as this scalar's indicator. When a `:` is reached while a key is expected, emit the empty key before the value, in both `walkBlockMapChildren` and `walkFlowMapChildren`. Pin `a: 1\n: 2`, `a:\n: 2`, `{a: 1, : 2}`, and the existing omitted-value cases.
- seats: part-2/grok-2-1, part-2/fable-2-1
- group: g5

### cst-dedented-explicit-map — Restore CST indentation dispatch for explicit mappings

- file: scratchpad/effected/yaml/internal/cst-parser.ts:399
- class: bug   severity: required
- standard: D9; D11; the ledger’s recorded removal of “same-or-shallower marker alternatives” as unreachable.
- evidence: A read-only probe of `parseCSTAll(" ? a\n : 1\n? b\n: 2\n")` reaches this branch with a shallower `block-map-start`. The pinned oracle returns two sibling block maps; the port nests the second map inside the first. Public `Yaml.parseResult` consequently returns `{ b: 2 }` in the oracle and `{ a: { "1": null, b: 2 } }` in the port. This counterexample disproves the recorded invariant; it is new evidence against that accepted simplification. History: the file's git log and retained --all history plus git show bdca1c58e5 place removal of the column dispatch in the S3 checkpoint. Step-2 diffs retain it. This counterexample invalidates the later unreachable-branch claim.
- failure: Dedenting explicit mappings changes the recovered CST and parsed value because every subsequent mapping-start marker is treated as a nested mapping. The behavior differs from the oracle even though the removal was recorded as behavior-preserving.
- fix: Restore upstream dispatch: recurse for a deeper block-map-start, consume a same-indent marker, and stop for a shallower marker. Restore upstream test lines rewritten for that removal if any; retain unrelated lawful total iteration. Add the reported CST and recovered-value regression.
- seats: part-2/sol-2-1
- group: g5

### block-newline-chomp — Preserve newline-only block values with default chomping

- file: scratchpad/effected/yaml/internal/fold.ts:355
- class: bug   severity: required
- standard: D9’s verified-upstream-bug exception; D11; formatter value fidelity.
- evidence: In both the port and pinned oracle, `renderBlockLiteral("\n", " ")` returns `"|\n"` and `renderBlockFolded("\n", " ")` returns `">\n"`. Public `Yaml.stringifyResult("\n", { defaultScalarStyle: "block-literal" })` emits `"|\n\n"`; folded style emits `">\n\n"`. The independent `yaml` parser reads both as `""`. Existing block-rendering properties always supply `"keep"`, which bypasses this default-argument failure.
- failure: Requesting either block style silently loses a value consisting of exactly one newline. Clip chomping cannot preserve that newline in an otherwise empty body.
- fix: Derive keep chomping for every nonempty newline-only value, independently of `explicitChomp`, in both block renderers. Add round trips with omitted optional arguments and through the public stringify options; record the verified upstream-bug deviation.
- seats: part-2/sol-2-2
- group: g6

### single-quoted-whitespace — Reject unrepresentable single-quoted folding and use a safe fallback

- file: scratchpad/effected/yaml/internal/fold.ts:279; scratchpad/effected/yaml/internal/stringifier.ts:571
- class: bug   severity: required
- standard: D9’s verified-upstream-bug exception; D11; the renderer’s documented value-preserving contract.
- evidence: `renderSingleQuotedMultiline("a \nb", " ")` returns `"'a \n\n b'"`; the independent parser reads it as `"a\nb"`. The public failure is reproducible in both the port and pinned oracle: `Yaml.stringifyResult("a \nb", { forceDefaultStyles: true })` emits `"'a \n\n b'\n"`, which loses the space when parsed. Direct helper probes also lose continuation-leading whitespace: `"a\n b"` becomes `"a\nb"`.
- failure: Single-quoted flow folding strips whitespace adjacent to physical line breaks. The helper accepts values it cannot encode faithfully, and canonical public stringification reaches the trailing-whitespace case.
- fix: Return null from renderSingleQuotedMultiline for whitespace before an interior newline or leading whitespace on a continuation line. Handle that result in the canonical caller with double-quoted fallback, replacing its current getOrThrow assumption. Preserve the existing justified continuation-whitespace fallback. Add helper/public round trips for trailing and leading whitespace; supply upstream-bug evidence centrally.
- seats: part-2/sol-2-3
- group: g6

### block-indent-indicator — Avoid invalid block indentation indicators

- file: scratchpad/effected/yaml/internal/fold.ts:380
- class: bug   severity: required
- standard: D9’s verified-upstream-bug exception; D11; valid, value-preserving formatter output.
- evidence: Both block renderers use `String(indent.length)` as an indentation indicator; folded rendering repeats this at line 458. Read-only public probes with value `" x"` and block-literal style produce `"|0-\n x\n"` for `indent: 0` and `"|10-\n x\n"` for `indent: 10`. The independent parser rejects both headers. The pinned oracle reproduces the failure, and the public option schema accepts both finite values.
- failure: Accepted stringify options produce invalid YAML whenever preserving leading content spaces requires an explicit indentation indicator outside YAML’s single-digit `1`–`9` range.
- fix: Guard both block renderers when an explicit indicator is needed: never emit 0 or a multi-digit width. Use escaped double-quoted fallback through the rendering path for out-of-range widths; preserve valid 1-9/fidelity behavior. Add public literal/folded regressions for widths 0 and 10, supplying upstream-bug evidence centrally.
- seats: part-2/sol-2-4
- group: g6

### cst-multiline-value-roles — Keep multiline scalar fragments in their mapping role

- file: scratchpad/effected/yaml/internal/cst-visitor.ts:488
- class: bug   severity: required
- standard: D9’s verified-upstream-bug exception; D11; `CstKeyEvent` and `CstValueEvent` classification contracts.
- evidence: For `"a: one\n two\nb: 2\n"`, the port emits key events for `a`, `two`, and `b`, and value events for `one` and `2`. The independent parser returns `{ a: "one two", b: 2 }`, and the AST visitor agrees. The pinned oracle also misclassifies `two`, establishing an upstream bug beyond the closed compact-map and omitted-value findings.
- failure: A continuation fragment of a multiline plain value becomes a mapping key because the walker toggles its role after each scalar CST node. Consumers receive an invented key even for valid YAML.
- fix: Advance mapping roles from actual key/value indicators and entry boundaries rather than every scalar fragment. Keep continuation fragments in their current role, including the analogous flow-map walk. Add multiline block and flow key/value projection regressions and record the verified upstream-bug deviation.
- seats: part-2/sol-2-5
- group: g5

### lexer-duplicate-header-indicators — Reject repeated block-scalar header indicators

- file: scratchpad/effected/yaml/internal/lexer.ts:713
- class: bug   severity: required
- standard: D9’s verified-upstream-bug exception; D11; block-scalar header validity.
- evidence: Read-only probes of both the port and pinned oracle show that `lexAll("|++\n a\n")` and `lexAll("|22\n a\n")` each return a scalar token without an error. Public `Yaml.parseResult` succeeds with `"a\n"` for both inputs. The independent `yaml` parser rejects the duplicated chomping or indentation indicator with “Block scalar header includes extra characters.”
- failure: The two-character header loop accepts two indicators of the same kind, silently overwriting the first. Strict parsing consequently accepts malformed block-scalar headers.
- fix: Track whether a chomping indicator and an indentation indicator have already appeared. Emit an error token on a second indicator of either kind while retaining both valid orderings, such as `|2+` and `|+2`. Add lexer and strict-parser regressions and record the verified upstream-bug deviation.
- seats: part-2/sol-2-6
- group: g1

### visitor-finite-paths — Normalize non-finite keys before constructing event paths

- file: scratchpad/effected/yaml/YamlVisitor.ts:29
- class: schema   severity: required
- standard: D5; D11; `standards/schema-first-development-prompt.md`, “Schema owns pure data” and “Precision carries invariants.”
- evidence: The event schema restricts numeric path segments to `S.Finite`, but `walkPair` at line 303 retains every numeric resolved key. Visiting `".nan: x\n"` emits `Pair` and `Scalar` events with path `[NaN]`; visiting `".inf: x\n"` emits paths containing `Infinity`. A read-only probe of the defining path shape, `S.is(S.Array(S.Union([S.String, S.Finite])))`, returns `false` for both emitted paths.
- failure: Valid YAML produces events outside the schema from which `YamlVisitorEvent` is derived. The retained `Data.taggedEnum` constructors do not validate payloads, so this model/producer disagreement escapes the green gates.
- fix: Normalize non-finite mapping-key path segments to their string representation before constructing `pairPath`, retaining finite numeric segments and scalar values. Add `.nan` and signed-infinity path regressions and record the path normalization as the law-forced deviation; do not weaken the schema to unrestricted `S.Number`.
- seats: part-2/sol-2-7
- group: g4

### visitor-guard-regression — Hoist visitor guards after the measured regression

- file: scratchpad/effected/yaml/YamlVisitor.ts:236
- class: perf   severity: required
- standard: D11’s measured-regression criterion.
- evidence: New measurements qualify the round-1 `visitor-guard-cost` backlog. A read-only, in-memory benchmark retained each version’s visitor implementation and replaced only composition with its own precomposed 3,000-pair AST. For 50 complete traversals, oracle/port times were `110.84/206.58`, `91.87/243.03`, and `101.82/217.15` ms, with identical event counts. An additional port-only comparison changed only the repeated `S.is` factories to module-local guards: for 100 traversals, current/hoisted times were `381.43/239.51`, `357.69/222.02`, and `369.79/231.09` ms, again with identical counts. No files were written.
- failure: The visitor rebuilds schema guards for each node and each pair key/value. Composition-independent traversal is about twice the oracle cost, and hoisting the guards removes approximately 38% of the measured port traversal time.
- fix: Derive Scalar, Alias, and Map guards once at module scope and reuse them in `walkNode` and `walkPair`. Retain schema-backed checks and event ordering, then repeat the isolated comparison.
- seats: part-2/sol-2-8
- group: g4

### cst-schema-models — Define schema-backed CST vocabulary and event payloads

- file: scratchpad/effected/yaml/internal/cst.ts:11,36; scratchpad/effected/yaml/internal/cst-visitor.ts:13
- class: schema   severity: required
- standard: D5; D11; `standards/effect-laws-v1.md`, law 19; `standards/effect-first-development.md`, EF-33; `standards/schema-first-development-prompt.md`, “Schema owns pure data.”
- evidence: `CstNodeType` remains a named handwritten literal union, and `CstNode` at line 36 remains a concrete recursive data interface. `internal/cst-visitor.ts` likewise declares thirteen concrete event interfaces and their union without a schema. These declarations remain in the reviewed green commit; they are data models rather than service contracts, overload surfaces, or type-level transformations.
- failure: The CST vocabulary and event payloads lack the required executable schema source of truth. Their domains, recursive fields, and event variants cannot share schema-derived validation and generation with their TypeScript types.
- fix: Define an annotated internal `LiteralKit` for the node-kind domain, an annotated recursive structural schema for CST nodes, and an annotated tagged-union schema for CST events. Derive the existing exported types from those schemas. Preserve plain-object construction and existing traversal behavior; per-node decoding is unnecessary.
- seats: part-2/sol-2-9
- group: g5

### raw-pipeline-models — Derive options and raw pipeline records from annotated schemas

- file: scratchpad/effected/yaml/internal/options.ts:26; scratchpad/effected/yaml/internal/diagnostics.ts:219; scratchpad/effected/yaml/internal/raw-document.ts:23,45; scratchpad/effected/yaml/internal/diff.ts:13
- class: schema   severity: required
- standard: D5; D11; `standards/effect-first-development.md`, EF-33; `standards/schema-first-development-prompt.md`, “Schema owns pure data.”
- evidence: The reviewed source still defines configuration payloads as `ParseOptionsInput` and `StringifyOptionsInput` interfaces. The same omission remains on `RawDiagnostic` in `internal/diagnostics.ts:219`, `RawDirective` and `RawYamlDocument` in `internal/raw-document.ts:23,45`, and `RawEdit` in `internal/diff.ts:13`. Each is a concrete field-based configuration or pipeline payload, with no schema-derived definition. The recorded schema-first deviation lists other converted models but provides no exception for these remaining payloads.
- failure: These cross-file data contracts remain outside the mandatory schema-first model. Configuration and raw pipeline records are independently handwritten instead of deriving their types, field domains, and metadata from executable schemas.
- fix: Define annotated internal structural schemas for these existing shapes and derive their exported types. Preserve optionality, plain-object construction, and defaults at the current consumption sites so the conversion does not introduce validation work or change behavior.
- seats: part-2/sol-2-10
- group: g7

### quoted-lone-cr — Fold lone CR consistently in both quoted scanners

- file: scratchpad/effected/yaml/internal/lexer.ts:584
- class: bug   severity: required
- standard: D11; section 14 upstream-bug. YAML 1.2.2 §5.4 `b-char` (`#xA` | `#xD`) and §7.3 line folding.
- evidence: `scanSingleQuotedScalar` (line 584) and `scanDoubleQuotedScalar` (line 674) fold only `\n` and `\r\n`. A raw CR falls through to `value += ch`. `advance` now treats that same CR as a line break, so the value keeps U+000D while the line counter moves on. Outside quotes, `isNewline` already breaks on a lone CR. The pinned oracle's quoted scanners have the same value branch; `token-cr-positions` only fixed unquoted line and column counting.
- failure: `"a\rb"` and `'a\rb'` parse as a value containing a carriage return. The folded quoted value is `a b`, and a following token is positioned as if the break were both content and a new line.
- fix: In both quoted scanners, treat a lone CR like a line break: fold it to a space, consume it, and run the same column-0 document-marker check used for `\n`. Pin `"a\rb"`, `'a\rb'`, and a token on the next physical line. Record the upstream-bug deviation at the central ledger.
- seats: part-2/fable-2-2
- group: g1

### restore-canonical-closing-quote — Restore upstream canonical closing-quote bytes

- file: scratchpad/effected/yaml/internal/stringifier.ts:572
- class: bug   severity: required
- standard: D9 / EFFECTED_PORT_GOAL.md §14 (a different formatted byte is a deviation; allowed only for `law:<id>` or a verified upstream bug)
- evidence: Pinned oracle `packages/yaml/src/internal/stringifier.ts:408-412` returns `renderSingleQuotedMultiline` unchanged. For `s = "first\nsecond\n"` and `indent = " "` (default `ctx.indent` from `stringifyLines` / `stringifyScalarNodeLines`) that is `'first\n\n second\n\n'`. Line 572 rewrites a final `\n'` to `\n${indent}'`, producing `'first\n\n second\n\n '`. `foldFlowLines` (`internal/composer/scalars.ts:447-480`) trims that closing line and drops it when the previous line already ended in `\n`, so both decode to `"first\nsecond\n"`. No `out.yaml` under `scratchpad/test/yaml/fixtures/yaml-test-suite` matches an indented closer (`^ +'$` is empty). `stringifier.coverage.test.ts:109` only asserts `parse(text)` equals the value. `PORT_LEDGER.json` for `stringifier.ts:583` calls this edit behaviour-neutral and describes only the removed null rejection. History: the file's git log, retained --all history, and git show bdca1c58e5 place sq.replace in the S3 checkpoint. Step-2/S1/law diffs retain the unchanged-return shape; no diagnostic or law requires an indented closing quote.
- failure: Canonical plain and single-quoted strings that end in a newline are emitted with indent spaces inside the closing quote. Bytes differ from the pinned oracle and from the libyaml single-quoted form this branch says it matches. The value is unchanged, so the green parse round-trip does not see it.
- fix: Remove only the trailing-closing-quote replace and return the single-quoted result unchanged when representable. Restore upstream test lines rewritten solely for this byte change if any; the S3 coverage file was added and its cited assertion is value-only. Add an oracle byte-parity regression for trailing-newline canonical plain/single-quoted values. Preserve independently justified control/whitespace fallbacks.
- seats: part-3/grok-2-1, part-3/fable-2-1
- group: g6

### flow-scalar-fidelity — Render flow-collection strings without block syntax or folding loss

- file: scratchpad/effected/yaml/internal/stringifier.ts:524
- class: bug   severity: required
- standard: D9, D11, section 14 (`upstream-bug`), and section 11.4 parser/formatter fidelity.
- evidence: Read-only Bun probes imported both the port and the pinned oracle’s `src/internal/stringifier.ts`. In both, `stringifyValue({ x: "a\nb" }, { defaultCollectionStyle: "flow" })` returns `"{x: |- a b}\n"`. The independent `yaml` parser rejects it with `BAD_SCALAR_START`; the port’s own parser instead returns `{ x: "|- a b" }`. Adding `forceDefaultStyles: true` produces `"{x: 'a b'}\n"`, which both parsers read with spaces replacing the original newline. The same failures occur in flow sequences; multiline flow mapping keys also emit invalid block-scalar syntax.
- failure: `renderString` receives `inFlow` but enters its multiline/block-style branches without honoring it. Flow collection renderers subsequently join the scalar’s lines with spaces, producing invalid YAML or silently changing scalar content. Green coverage does not exercise fidelity across this combination of values and options.
- fix: Before style dispatch, use escaped double-quoted rendering when `inFlow` is true and the string is multiline or the requested style is block-literal/block-folded. Apply the same rule to flow keys. Add value-path and AST-path regressions for flow maps and sequences, including canonical mode, and register the verified upstream bug under section 14.
- seats: part-3/sol-2-1
- group: g6

### explicit-style-controls — Apply control-character safety before style dispatch

- file: scratchpad/effected/yaml/internal/stringifier.ts:524
- class: bug   severity: required
- standard: D9, D11, section 14 (`upstream-bug`), and section 11.4 fidelity.
- evidence: Read-only probes of both public facades show that `Yaml.stringifyResult("a\u0000b", { defaultScalarStyle: "single-quoted" })` succeeds with a literal NUL inside single quotes. Passing that output to `Yaml.parseResult` fails with `UnexpectedCharacter: Unescaped control character U+0000`. `"block-literal"` and `"block-folded"` produce the same failure. Separately, `"a\rb"` with either block style serializes successfully but parses back as `"b"` in both the port and pinned oracle. The default plain style correctly emits escaped double quotes for these values.
- failure: The general control-character/CR safety check runs only when the value contains LF. For a string without LF, explicit single-quoted or block styles bypass the plain renderer’s safety checks. Stringification therefore succeeds with output the package cannot parse, or loses content on round-trip.
- fix: Hoist the existing control-character/CR check ahead of multiline handling and style dispatch, falling back to `renderDoubleQuoted` for styles that cannot safely represent those characters. Add NUL/ESC regressions for explicit single-quoted and block styles and a lone-CR regression for both block styles. Register the verified upstream bug under section 14.
- seats: part-3/sol-2-2
- group: g6

### block-duplicate-properties — Reject duplicate anchors and tags on one node

- file: scratchpad/effected/yaml/internal/composer/block.ts:2097
- class: bug   severity: required
- standard: D9, D11, section 14 (`upstream-bug`), and the parser’s YAML conformance contract.
- evidence: Read-only probes of both port and pinned-oracle public facades return successful results for `"- &a &b foo\n"` (`["foo"]`), `"- !!str !!int 1\n"` (`[1]`), and `"a: &a &b foo\n"` (`{ a: "foo" }`), with no composition diagnostics. The independent `yaml` parser rejects these inputs with `MULTIPLE_ANCHORS` or `MULTIPLE_TAGS`. The assignments at lines 2098/2102 overwrite pending sequence properties; the block-map assignments at lines 556/562 do the same.
- failure: Multiple anchor or tag properties on one node are silently reduced to the last property. Strict parsing accepts malformed YAML, loses the earlier anchor, and can change the scalar’s resolved type through the later tag.
- fix: Before replacing a property already pending for the same node, emit a positioned fatal diagnostic in both block-map and block-sequence composition. Preserve the intentional outer-container/inner-node metadata split. Add strict-parser regressions for repeated anchors and tags, plus a valid outer/inner metadata case, and register the verified upstream bug under section 14.
- seats: part-3/sol-2-3
- group: g8

### stringifier-context-models — Derive render contexts from annotated structural schemas

- file: scratchpad/effected/yaml/internal/stringifier.ts:450
- class: schema   severity: required
- standard: `standards/effect-first-development.md` EF-33; `standards/schema-first-development-prompt.md`, “Schema owns pure data”; D5 and D11.
- evidence: `StringRenderContext` at line 450 and `StringifyContext` at line 659 remain handwritten interfaces. Both consist entirely of data fields: scalar presentation settings, literal domains, optional positioning information, and traversal state. Neither is a service contract, overload surface, or type-level transformation. No schema defines either payload; the declared-green gates therefore leave this concrete modeling-law violation undetected.
- failure: The named rendering payloads remain type-only models. Their field definitions, literal domains, and resolved configuration shape have no schema source from which annotations, validation, equivalence, or arbitraries can be derived. The required schema-first pass is incomplete.
- fix: Define file-local annotated structural schemas for both contexts and derive their types. Reuse the existing scalar/collection/quote/chomp schemas, preserve optionality and the mutable ancestor stack, and retain typed-literal construction without adding per-scalar decoding.
- seats: part-3/sol-2-4
- group: g6

### block-pipeline-models — Share schema-backed pending comments and consumed values

- file: scratchpad/effected/yaml/internal/composer/block.ts:1030
- class: schema   severity: required
- standard: `standards/effect-first-development.md` EF-33; `standards/schema-first-development-prompt.md`, “Schema owns pure data”; D5 and D11.
- evidence: `PendingComment` at line 1030, `ConsumedValue` at line 1302, and `PendingSeqComment` at line 1985 remain handwritten pure-data interfaces. The two pending-comment interfaces duplicate the same `{ text, offset, blankAbove }` payload. `ConsumedValue` models a composed node, cursor, and two comment arrays. None contains callable or type-level machinery, and none derives from a schema.
- failure: Migrating exported `SemanticItem` leaves the comment-attribution and value-consumption payloads outside the mandatory schema model. The same pending-comment shape is independently declared twice, so its fields and invariants have no shared runtime source of truth.
- fix: Define one file-local annotated pending-comment schema and reuse its derived type in mapping and sequence composition. Define an annotated structural schema for `ConsumedValue`, preserving its existing nullability, array fields, and mutation behavior. No public export or algorithm change is needed.
- seats: part-3/sol-2-5
- group: g8

### tag-diagnostic-spans — Emit each malformed-tag diagnostic once at its own span

- file: scratchpad/effected/yaml/internal/composer/tags.ts:85,188-196; scratchpad/effected/yaml/internal/composer/document.ts:985,1275
- class: bug   severity: required
- standard: D9 / D11; PORT_LEDGER.json percent-diagnostic row (core-regressions.test.ts:196) says each offending span is reported. Section 14 does not record cross-document span theft.
- evidence: `decodeTagSuffix` searches `lexAll(state.text)` for the first `token.value === tag` absent from this state's `errors` (tags.ts:85-94). `composeAllDocuments` builds a fresh `errors: []` per document (document.ts:1278-1281, state.ts:390) while `state.text` is the whole stream. `validateTagHandlesInDocument` runs only for document index ≥ 1 and pushes the CST span onto the isolated cross-doc state (document.ts:985-994, tags.ts:188-196). `parseAllResultImpl` concatenates both fatal lists (Yaml.ts:476-478); `UnresolvedTag` is fatal (diagnostics.ts:252). For `a: !!%GG 1\n---\nb: !!%GG 2\n`, document 2's resolver therefore records document 1's offset, and the stream validator adds document 2's real offset. The aggregate is two diagnostics on the first span and one on the second. Repeated tags inside one state still advance, which is why the single-document `findFirst` test stays green. `decodeTagSuffix` pushes `UnresolvedTag` while resolving a scalar tag. `validateTagHandlesInDocument` (line 191) pushes the same code, message, and span for every CST tag. `composeAllDocuments` (`document.ts:1275`) runs that validator on a separate state for every document after the first, and `parseAllResultImpl` (`Yaml.ts:476`) concatenates fatal `streamErrors` with each document's fatal errors. `UnresolvedTag` is fatal. A one-document `parseResult` only hits the resolver, which is why `core-regressions.test.ts:197` stays green.
- failure: Resolution re-searches the entire stream using per-document errors, stealing an earlier tag's span. Separate stream validation also diagnoses the later tag, producing wrong-span or duplicate fatal UnresolvedTag errors.
- fix: Use the actual tag CST offset/length instead of lexAll(state.text) spelling matches. Thread or retain provenance through composer metadata/resolver calls. Coordinate document resolution and cross-document validation in document.ts to emit malformed-percent diagnostics once per span/code, preserving collection-tag validation and other handle diagnostics. Add repeated-spelling multi-document and malformed-later-document regressions. Keep signature/metadata call-site edits within this six-file composer group.
- seats: part-4/grok-2-1, part-4/fable-2-3
- group: g8

### flow-empty-key-offset — Anchor synthetic empty flow keys on their explicit indicator

- file: scratchpad/effected/yaml/internal/composer/flow.ts:365
- class: bug   severity: required
- standard: D11 bug. The comma materialization is the recorded node-less-key fix (PORT_LEDGER.json, composer-regressions.test.ts:91), which only requires the null entry to survive. block.ts:1160-1169 anchors the other synthetic null key on its indicator so `DuplicateKey` is not `0:0`.
- evidence: `{?` pushes `{ kind: "key" }` with no offset (flow.ts:408-413). The comma then replaces it with `YamlScalar.make({ value: null, style: "plain", offset: 0, length: 0 })` (flow.ts:362-366). `buildPairs` sees a key node and skips the empty-key path (block.ts:1187-1194). `checkDuplicateKeys` warns at `pair.key.offset` (block.ts:1517-1521). `uniqueKeys` defaults to true (Yaml.ts:472, 529-532). `{? , ?}` therefore yields two null keys and a `DuplicateKey` diagnostic at offset 0, length 0, which is the `{` of a nested map rather than either `?`.
- failure: Explicit empty flow keys and their duplicate-key diagnostics are anchored at 0:0.
- fix: Remember the ? indicator offset in local flow state and use it for the zero-length null key materialized at a comma. Preserve the existing SemanticItem key variant and entry behavior. Add nested {? , ?} key/duplicate-diagnostic position regressions.
- seats: part-4/grok-2-2
- group: g8

### flow-comment-separators — Require commas between comment-separated flow entries

- file: scratchpad/effected/yaml/internal/composer/flow.ts:79
- class: bug   severity: required
- standard: D9 / section 14. Oracle `validateFlowSeparators` (packages/yaml/src/internal/composer/flow.ts:54-60) forces `colonCount = 1` and `contentAfterColon = 1` when a comment follows content. The ledger rows for flow-missing-comma and flow-continuations do not accept comment-separated entries.
- evidence: The lab comment branch only `continue`s (flow.ts:77-79). The missing-comma checks require `colonCount > 0` (flow.ts:88 and flow.ts:128). For `{foo #c\n bar: baz}`, `hasValueSepThroughPlainScalars` looks through the comment and the later plain scalar, but `collectMultilineKey` stops at the comment, so `foo` is counted while `colonCount` is still 0. `bar` then increments `contentAfterColon` to 2 with `colonCount` still 0, and its own `:` resets the counters. No `MalformedFlowCollection` is pushed. `buildPairs` keeps both entries, so `parseResult` succeeds as `{foo: null, bar: baz}`. The same path accepts `[foo #c\n bar]` as two sequence items. The oracle comment transition makes the following content token trip `contentAfterColon > 1`. `{ "foo" # comment\n :bar }` stays valid because that `:` belongs to the same entry.
- failure: Flow entries separated only by a comment parse successfully. The oracle reports `Missing comma between flow collection entries`.
- fix: After collector-aware content classification, arm a separator-required flag when a comment follows content. Error on the next independent content entry; clear the flag when a colon belongs to the same key. Do not blindly force colonCount, which would reject a valid key/comment/colon sequence. Preserve folded plain continuations. Add missing-comma map/sequence cases and the valid quoted-key/comment/colon case.
- seats: part-4/grok-2-3, part-4/fable-2-1
- group: g8

### tag-uri-fragment — Allow URI hashes inside TAG directive parameters

- file: scratchpad/effected/yaml/internal/composer/document.ts:818
- class: bug   severity: required
- standard: D9 behaviour preservation; D11; section 14.
- evidence: A read-only `bun -e` probe of `Yaml.parseResult("%TAG !e! tag:example.com,2026:foo#\n---\n!e!bar x\n")` succeeds with `"x"` in the pinned oracle but fails in the port with `InvalidDirective`, `"Comment in directive requires preceding whitespace"`, at offset 0. The independent `yaml` parser reports no errors and resolves the node tag to `tag:example.com,2026:foo#bar`. Upstream applied this comment check only to `%YAML`; extending it to `%TAG` introduced the regression.
- failure: A hash inside a valid tag-prefix URI is mistaken for a comment indicator, so valid documents accepted upstream are rejected. The recorded TAG-arity correction does not justify rejecting these valid parameters.
- fix: For `%TAG`, recognize a comment only at a whitespace-separated `#`; retain embedded hashes in the URI parameter. Preserve the `%YAML` malformed-comment check and TAG-arity validation. Add the reproduced URI-fragment regression.
- seats: part-4/sol-2-1
- group: g8

### document-start-empty-document — Withhold marker removal that would erase an empty document

- file: scratchpad/effected/yaml/internal/rules/document-start.ts:132
- class: bug   severity: required
- standard: D11; section 14 verified upstream-bug; the rule’s documented requirement to preserve multi-document structure.
- evidence: With only `document-start` enabled and `{ present: false }`, `YamlLint.fix("---\n---\na: 1\n", …)` returns `"---\na: 1\n"` in both the port and pinned oracle. Read-only probes show `Yaml.parseAllResult` changes from `[null, { a: 1 }]` to `[{ a: 1 }]`; independent `yaml.parseAllDocuments` confirms the same loss.
- failure: Removing the stream’s first marker deletes an empty first document. A marker being alone on its line is insufficient to establish that its removal preserves the document sequence.
- fix: Withhold the removal fix when the first marker establishes an empty document that would disappear after removal. Keep the diagnostic. Add a regression asserting preservation of document count and values for consecutive start markers, including a preceding header comment, and record the upstream-bug correction under section 14.
- seats: part-4/sol-2-2
- group: g2

### document-start-bom — Insert a missing start marker after the stream BOM

- file: scratchpad/effected/yaml/internal/rules/document-start.ts:109
- class: bug   severity: required
- standard: D11; section 14 verified upstream-bug; lint-fix semantic fidelity.
- evidence: For `"\uFEFFa: 1\n"`, enabling `document-start` produces `"---\n\uFEFFa: 1\n"` in both the port and pinned oracle. An independent `yaml.parseDocument` probe returns `{ a: 1 }` before the fix and `{ "\uFEFFa": 1 }` afterward, with no parse errors. The port’s own parser ignores the relocated BOM, masking the change.
- failure: Inserting the marker before the stream-leading BOM moves that character into document content and changes the mapping key for another YAML parser.
- fix: Insert the missing marker immediately after an initial BOM, using offset 1 when `ctx.text` begins with `\uFEFF`, otherwise offset 0. Add an independent-parser value-fidelity regression and record the upstream-bug correction under section 14.
- seats: part-4/sol-2-3
- group: g2

### explicit-integer-precision — Preserve explicit integers beyond the safe-number range

- file: scratchpad/effected/yaml/internal/composer/scalars.ts:93
- class: bug   severity: required
- standard: D11; section 14 verified upstream-bug; the existing precision-preserving integer resolver.
- evidence: Read-only probes against both the port and pinned oracle show `Yaml.parseResult("n: 9007199254740993\n")` returns `{ n: 9007199254740993n }`, while adding the explicit integer tag—`"n: !!int 9007199254740993\n"`—returns `{ n: 9007199254740992 }`. `"n: !!int 0x20000000000001\n"` also rounds to `9007199254740992`. The independent `yaml` parser with `{ intAsBigInt: true }` preserves `9007199254740993n` for both tagged spellings.
- failure: Explicitly declaring an integer changes its mathematical value. The tagged resolver bypasses `safeParseInt`, although the implicit resolver already preserves these integers exactly. The earlier bigint-stringification finding concerns a different execution site and does not cover this parsing loss.
- fix: Use the existing `safeParseInt` for valid decimal, hexadecimal, and octal spellings in the explicit integer branch, preserving the existing fallback behavior for other inputs. Add tagged-versus-implicit integer fidelity regressions above the safe-number boundary and record the upstream-bug correction under section 14.
- seats: part-4/sol-2-4
- group: g8

### composer-cr-lines — Use CR-aware physical line indexing during composition

- file: scratchpad/effected/yaml/internal/composer/state.ts:53
- class: bug   severity: required
- standard: D11; section 14 verified upstream-bug; consistency with the lexer’s supported CR/LF/CRLF line breaks.
- evidence: `lineCol("a: 1\rb: 2\r", 5)` returns `{ line: 0, column: 5 }` instead of the second line’s column zero. A read-only line-ending-equivalence probe shows both the port and pinned oracle reject `"a:\n first\nbare\n"` but accept its CR-only equivalent, `"a:\r first\rbare\r"`, as `{ a: "first bare" }`. The scalar continuation collector uses `lineCol` to enforce its indentation floor.
- failure: The LF-only line index gives dedented CR-only continuation text an artificially large column, allowing malformed input to be absorbed into the preceding scalar. This is composer acceptance behavior beyond the closed lexer/token-position correction.
- fix: Index lone CR as a line break and CRLF as one line break. Align the state helpers that determine physical line boundaries with that convention. Add the reproduced CR-versus-LF acceptance regression and record the upstream-bug correction under section 14.
- seats: part-4/sol-2-5
- group: g8

### flow-segment-complexity — Avoid repeated suffix scans in separator validation

- file: scratchpad/effected/yaml/internal/composer/flow.ts:112
- class: perf   severity: required
- standard: D11 algorithmic-class and measured-regression criteria.
- evidence: For `"{k: " + "x [b] ".repeat(n) + "}"`, each plain `x` makes `validateFlowSeparators` scan to the same closing brace and copy the remaining entry with `children.slice(i, end)`. The scalar collector stops at the following nested sequence, so this repeats for every `x`: total scanning and copying are Θ(n²), whereas the pinned oracle’s separator validation is linear. Read-only `composeFirstDocument(source, { uniqueKeys: false })` probes measured oracle/port times of 62.7/112.6 ms at n=1,000, 131.5/230.6 ms at n=4,000, and 274.1/1,675.3 ms at n=16,000. Both versions produced the same diagnostic counts at each size.
- failure: The new separator validation adds quadratic work and allocation on malformed comma-free flow collections, substantially increasing the cost of error recovery. The earlier continuation correction did not assess this newly introduced complexity.
- fix: Determine each comma-delimited segment boundary once and reuse a bounded segment with a cursor when calling the scalar collectors. Avoid rescanning and copying the remaining segment for every plain scalar. Retain the existing diagnostics and add a scaling regression or benchmark for the reproduced input.
- seats: part-4/sol-2-6
- group: g8

### flow-duplicate-missing-comma — Report a missing comma once

- file: scratchpad/effected/yaml/internal/composer/flow.ts:124
- class: bug   severity: required
- standard: D9; D11
- evidence: For `{foo: 1 bar: 2}`, the `:` arm at line 87 pushes `MalformedFlowCollection` at the second colon (offset 11, the offset `composer-regressions.test.ts` asserts). The same key is then visited as plain content: `collectMultilineKey` stops on that colon, `contentAfterColon` becomes 2, and the arm at line 128 pushes a second fatal diagnostic at `bar` (offset 8). The regression test uses `.some`, so the extra diagnostic stays green.
- failure: One missing comma is reported as two fatal composer errors.
- fix: Do not increment `contentAfterColon` for a plain scalar that the collector classified as the next key. Keep the colon-arm diagnostic at the second structural `:`.
- seats: part-4/fable-2-2
- group: g8

### block-indent-comment-scan — Ignore comment punctuation when locating scalar parent indentation

- file: scratchpad/effected/yaml/internal/composer/scalars.ts:1238
- class: bug   severity: required
- standard: D11; section 14 upstream-bug
- evidence: `findParentIndent` now skips `!` and `&` tokens, then still treats a separated `:` or a token-initial `-` as structure. In `key:\n # note: x\n |2\n hello\n`, the backward scan hits the colon in the comment first. `findKeyIndent` returns that comment line's indent (2), so `contentIndent` becomes 4. The body line has only 2 spaces, and `decodeBlockScalar` stops at `spaces < contentIndent` (line 1403), returning the empty string. The same scan is in the pinned oracle; the verbatim-tag fix did not cover comments. YAML comments are not mapping or sequence indicators.
- failure: A colon or sequence dash inside a comment between a key and an explicit-indent block scalar drops the block body.
- fix: While scanning backward, skip a line comment (an unquoted `#` through the line end) before classifying `:` or `-`. Add the comment-colon `|2` case next to the verbatim-tag regression.
- seats: part-4/fable-2-4
- group: g8

### indent-compact-unit — Keep compact columns out of indentation-unit checks and votes

- file: scratchpad/effected/yaml/internal/rules/indentation.ts:137
- class: bug   severity: required
- standard: EFFECTED_PORT_GOAL.md D9, D11, §14
- evidence: `contentLines` always starts `indents` at the line indent, then appends the next same-line `block-seq-entry` column (line 138) or the compact key column at a depth-0 `block-map-value` (lines 141–143). `check` (lines 226–246) and `infer` (lines 294–309) treat every increase, including that column, as one `spaces` level. Public `character` is `offset - lineStarts[line]` (`YamlToken.ts:128`), so the canonical `- ` gap is 2. Upstream `contentLines` stores only the line indent (oracle `indentation.ts:81`) and unit-checks only that. The recorded compact-column deviation (`PORT_LEDGER.json` indent-compact-level; `indentation.test.ts:117–166`) pins only `spaces: 2`, where this gap equals the unit, so those tests stay green. The `spaces: 4` fixture at `indentation.test.ts:111` is a flow mapping and never pushes a compact column.
- failure: A same-line compact separator is diagnosed and voted as a block indent. `"- two: 1\n"` with `{ spaces: 4 }` has indents `[0, 2]`, so the port reports `Indent of 2 spaces, expected 4` and inference votes `spaces: 2`; upstream sees indent 0, reports nothing, and votes nothing. `"outer:\n - two: 1\n"` with `{ spaces: 4 }` has indents `[4, 6]`: the port reports the same message and votes both 4 and 2, so strict inference cannot settle on 4; upstream sees only 4 and is silent. `"- - item\n"` with `{ spaces: 4 }` pushes the inner hyphen at column 2 and fails the same way. At `spaces: 2` the gap equals the unit, which is why `indentation.test.ts:117` passes.
- fix: In `check` and `infer`, unit-check and vote only the first column (the line indent). Still push each later same-line column onto the stack with no comparison and no `spaces` vote, so later lines and `indentSequences` keep measuring from the innermost compact column. That preserves `indentation.test.ts:117–166`. Do not go back to hyphen-line measurement: that restores the recorded false positive (`child` at column 6 read as a delta of 4). Add a `spaces: 4` regression for `"- two: 1\n"`, `"outer:\n - two: 1\n"`, and `"- - item\n"`. Record, as an extension of the existing compact-column upstream-bug, that a sibling at the key column and a child at key+unit are the accepted shapes when `spaces` is not 2 (upstream still measures those from the hyphen line).
- seats: part-5/grok-2-1
- group: g9

### indent-node-properties — Recognize mapping openers followed by anchor or tag properties

- file: scratchpad/effected/yaml/internal/rules/indentation.ts:148
- class: bug   severity: required
- standard: D11; D9 §14 verified upstream bug; this rule’s documented sequence-placement policy.
- evidence: Read-only probes against the port and pinned oracle show that `a:\n - x\n` reports “Sequence under a mapping key should not be indented” with `{ spaces: 2, indentSequences: false }`, while `a: &ref\n - x\n` and `a: !!seq &ref\n - x\n` return no diagnostics. All three parse successfully to `{ a: ["x"] }`. With consistent mode, `a:\n - x\nb: &ref\n- y\n` produces no diagnostic, and strict inference succeeds with `indentSequences: true` despite the mixed placement.
- failure: `opensKey` requires the last significant token to be `block-map-value`. An anchor or tag after the colon replaces that token as `lastKind`, hiding the mapping-to-sequence relationship from both checking and inference. Valid node properties therefore bypass an explicit policy and conceal style conflicts.
- fix: Track whether a block-value separator is followed only by node properties and trivia, with no same-line value content. Treat that case as an opening key. Add anchor/tag regressions for explicit policies, consistent checking, and strict inference; record the verified upstream-bug correction under §14.
- seats: part-5/sol-2-1
- group: g9

### indent-scalar-continuations — Exclude composed plain-scalar continuations from indentation inference

- file: scratchpad/effected/yaml/internal/rules/indentation.ts:120
- class: bug   severity: required
- standard: D11; D9 §14 verified upstream bug; indentation.ts:12–14 and util.ts:186–192 promise to skip scalar continuations.
- evidence: In both the port and pinned oracle, `a: first\n second\n` parses successfully as `{ a: "first second" }`, but `{ spaces: 2 }` reports “Indent of 4 spaces, expected 2” on line 1. Observation also emits a four-space indentation vote. The captured composed scalar has `sourceMultiline: true`, `offset: 3`, and `length: 16`; the lexical stream instead contains separate scalar tokens for `first` and `second`. `compactKeyIndent` is committed only when a same-line `block-map-value` is seen. A compact explicit key has `block-map-key` on the `-` line and `:` on a later line, so the `?` column is dropped. `scanPlainScalar` ends at the newline, so `isScalarContinuationLine` does not skip the next plain line. For `- ? a long\n key\n : value\n` with `spaces: 2`, the continuation's indent is 4 against a stack top of 0, which reports `Indent of 4 spaces, expected 2` and inference votes `4`. The expanded form (`-\n ? a long\n key\n : value\n`) only produces unit-2 steps. The composer merges that continuation when its column is greater than the `?` column (`? a\n true\n:`), including indents that are not exactly one `spaces` unit.
- failure: The continuation test assumes a multiline scalar occupies one lexical token. The composer joins multiline plain scalars from separate tokens, so their continuation lines enter the block-indentation stack. This creates false diagnostics and trains inference on scalar-content indentation.
- fix: Collect composed multiline scalar spans once per contentLines traversal; exclude continuation lines from structural checks and votes. Include compact/expanded explicit-key continuations deeper than the ? column until the value indicator, mapping values and sequence items. Retain token-only handling where sufficient and preserve structural colon-line/unit handling. Add check/infer regressions for all reported forms.
- seats: part-5/sol-2-2, part-5/fable-2-2
- group: g9

### rule-scalar-guard-regression — Hoist scalar-rule traversal guards

- file: scratchpad/effected/yaml/internal/rules/util.ts:169
- class: perf   severity: required
- standard: D11 measured regression versus pinned upstream; schema-first-development-prompt.md, Pattern 5 permits hoisting repeatedly used schema guards.
- evidence: A read-only Bun 1.4.2 probe parsed a 5,000-scalar sequence once, then measured 100 `walkScalars` traversals per sample with identical counting callbacks. Five samples, in milliseconds: oracle `[1.93, 1.69, 1.68, 1.71, 1.88]`; port `[36.54, 37.73, 43.43, 45.17, 36.37]`. An in-memory control retaining schema guards but binding them once measured `[13.29, 12.58, 13.43, 12.32, 12.00]`. Parsing was excluded, and visitor counts agreed.
- failure: Every recursive visit creates fresh `S.is` closures for scalar/map/sequence dispatch. The median traversal time is approximately 22 times the oracle’s; hoisting alone reduces the port median from 37.73 ms to 12.58 ms. This affects truthy checking and quoted-string checking/inference.
- fix: Bind the three schema-derived guards once at module scope and reuse them in `walkScalars`. Preserve the existing schema semantics, traversal order, roles, and dual signatures.
- seats: part-5/sol-2-3
- group: g9

### duplicate-key-guard-regression — Hoist duplicate-key traversal guards

- file: scratchpad/effected/yaml/internal/rules/key-duplicates.ts:53
- class: perf   severity: required
- standard: D11 measured regression versus pinned upstream; schema-first-development-prompt.md, Pattern 5.
- evidence: A read-only Bun probe captured already-composed contexts containing 2,000 unique mapping pairs and measured 50 duplicate-key checks per sample, alternating measurement order. Five samples, in milliseconds: oracle `[8.85, 12.91, 7.29, 6.02, 6.38]`; port `[87.12, 87.96, 96.67, 79.72, 71.22]`. A control retaining the port’s `MutableHashSet`, key identities, and traversal while hoisting schema guards measured `[49.32, 56.24, 49.68, 47.65, 55.92]`. Parsing was excluded; all checks found zero duplicates.
- failure: The recursive walk repeatedly constructs map/sequence guards, and the pair loop constructs a scalar guard for every key. The port median is about 12 times the oracle’s; hoisting reduces the port median from 87.12 ms to 49.68 ms without changing the required Effect collection representation.
- fix: Hoist `S.is(YamlMap)`, `S.is(YamlScalar)`, and `S.is(YamlSeq)` once and reuse them throughout `walk`. Retain `MutableHashSet` and the existing key-identity semantics.
- seats: part-5/sol-2-4
- group: g9

### indent-content-line-model — Model the nonempty indentation progression in ContentLine

- file: scratchpad/effected/yaml/internal/rules/indentation.ts:75
- class: schema   severity: required
- standard: standards/effect-first-development.md EF-33; standards/schema-first-development-prompt.md “Schema owns pure data”; D5 and D11.
- evidence: `ContentLine` remains a named handwritten interface containing the pure-data payload shared by checking and inference: `line`, `indent`, `firstChar`, `indents`, and `opensKey`. It is neither a service contract nor type-level machinery. In particular, `indents` is declared as an unrestricted `ReadonlyArray<number>`, while lines 170 and 262 assume it is nonempty. The declared green compiler and four-law gates do not supply the missing schema model.
- failure: The shared structural payload’s type and invariants remain outside the required schema-first model. Its nonempty indentation progression is maintained only by procedural construction and unsafe indexed reads, rather than represented by its named data shape.
- fix: Define an annotated internal structural schema for `ContentLine`, derive its same-name type, and model `indents` as a nonempty collection of nonnegative integers. Preserve plain structural construction and existing runtime behavior.
- seats: part-5/sol-2-5
- group: g9

### hyphen-explicit-block-fidelity — Withhold hyphen fixes that relocate explicit-indent block scalars

- file: scratchpad/effected/yaml/internal/rules/hyphen-spacing.ts:112
- class: bug   severity: required
- standard: D9; D11; section 14 value preservation (same class as the compact-collection hyphen fix)
- evidence: `relocatesCollection` is set only for a later-line token. An explicit-indent block scalar is one `scalar` token whose `line` is the header line, so the body is never inspected. In the lexer, `|2` / `>2` set `contentIndent` to the column of the preceding `-` plus the digit (`lexer.ts` parent-indent branch, then `extra = " ".repeat(spaces - contentIndent)`). For `- - |2\n hello\n` the inner `-` is a same-line `block-seq-entry` (`compact` becomes true) and no later-line token exists, so a fix is still attached. Deleting the two extra spaces moves that `-` from column 4 to column 2, `contentIndent` falls from 6 to 4, and the unchanged content line is re-stripped as `" hello\n"` instead of `"hello\n"`. Folded `>2` takes the same header path. Upstream always attaches this fix, so both sides corrupt the value.
- failure: A successful hyphen-spacing fix changes an explicit-indent block scalar's text. The parsed sequence value gains leading spaces (and folded style can also change break folding).
- fix: On the same-line scan, if a `block-seq-entry` at or after `j` will move and a later same-line scalar's source span is an explicit-indent block header (`|` or `>` with a `1`–`9` digit, optional chomp), omit the fix the same way `relocatesCollection` does. Keep the diagnostic. Add a `|2` and `>2` value-fidelity regression, and leave the central upstream-bug record to the deviation codemod.
- seats: part-5/fable-2-1
- group: g9

## Backlog

### docs-width-fold-deviation — Record the width-fold idempotence correction centrally

- file: scratchpad/effected/yaml/internal/fold.ts:62
- class: docs   severity: backlog
- standard: D9; section 14 (one ledger row per behavioural divergence)
- evidence: Upstream `fold.ts` keeps a pending split across `\n`, so `foldScalarLine("hello world\nthis is longer", "", 20, 0)` folds the 11-character first line at the space. The lab clears that split and sets `end = i + 1 + lineWidth`, returning the input unchanged. `scratchpad/test/yaml/internal/fold.property.test.ts:19` pins the new idempotence. README Port notes and the `w1-yaml` deviations record only the more-indented compensation blank, not this width-fold change. History places the reset in 7a6b586acb (S3); its newly added fold.property.test.ts checks re-folding idempotence. The seat requests recording this correction rather than an implementation repair.
- failure: Width-fold bytes diverge from the pinned upstream and the deviation is unrecorded.
- fix: Backlog central upstream-bug documentation of the physical-break reset and fold.property.test.ts evidence. Do not assign PORT_LEDGER.json or README Port notes to a fix group. This is not one of the systemic law-forced deviation classes.
- seats: part-2/grok-2-2
- reason: Documentation-only finding; S2/S3 reporting is deferred by this merge instruction, and ledger/README Port-notes edits are outside the port's write surface.

### docs-canonical-whitespace-deviation — Record the canonical continuation-whitespace correction centrally

- file: scratchpad/effected/yaml/internal/stringifier.ts:569
- class: docs   severity: backlog
- standard: D9 / §14 (`upstream-bug` must be recorded on the ledger and in README Port notes)
- evidence: The same oracle block does not special-case `/\n[ \t]/`. For `"first\n second"` and indent `" "`, `renderSingleQuotedMultiline` yields `'first\n\n second'`. `foldFlowLines` `trimStart`s the continuation, so the content space is lost and the value becomes `"first\nsecond"`. `renderDoubleQuoted` (`stringifier.ts:388`) escapes the newline, and `"first\n second"` decodes back to `"first\n second"`. `stringifier.coverage.test.ts:109` round-trips `"first\n \tsecond"` only through the lab. README Port notes list stringifier upstream bugs for bigint spelling and canonical depth only. The ledger’s `stringifier.ts:583` entry still says the edit did not change behaviour. History places the whitespace fallback in bdca1c58e5 (S3). The concrete folding counterexample supports upstream-bug documentation, distinct from the unjustified closing-quote rewrite.
- failure: Canonical plain and single-quoted values that contain a newline followed by a space or tab are double-quoted instead of single-quoted. That preserves the value, and it is a formatted-byte divergence from the pinned oracle that is recorded as if it were not one.
- fix: Backlog central upstream-bug ledger/Port-notes recording of the already-correct double-quoted continuation-whitespace fallback, citing foldFlowLines and stringifier.coverage.test.ts. Retain the value-preserving fallback; no source repair or per-lane bookkeeping is requested.
- seats: part-3/grok-2-2, part-3/fable-2-2
- reason: Documentation-only finding; S2/S3 reporting is deferred by this merge instruction, and ledger/README Port-notes edits are outside the port's write surface.

## Handled by the deviation codemod

None. No seat record merely requests recording a systemic law-forced change. The two documentation requests concern upstream-bug corrections and remain backlog.

## Rejected

None. All retained findings have concrete evidence and fixes. Duplicates were merged; broader conflicting fix suggestions were replaced with the smallest ruling-consistent repair.
