# YAML — round-3 merged inventory

Seats read: 15 reports (grok, sol, fable in each of part-1 through part-5), 5 BRIEF.md files and 5 BRIEF.grok3.md route briefs. The fable files identify the third-seat grok-4.7 medium fallback. Raw seat findings: 48. Merged disposition records: **Required 33; Backlog 1; Handled by the deviation codemod 0; Rejected 1 (partial claim)**. Required groups: **9**. A seat record may contribute to a merged required record and a separately rejected subclaim; duplicates are contributors, not rejections.

Reviewed seat commit: `c3fc60bdbfd5574dc69623d132dced0a552a586a`. Merge checkout: `@lab/effected-2` at `308cf4850d315a047e096708b8ed3644cb73eb6c`; the requested branch name was `@lab/effected`. No branch was switched. The existing dirty lexer edit only simplifies isPlainScalarBreak and does not repair invalid-header quoting. Evidence below is attributed to the reports, supplemented by read-only source/history inspection; no tests or gates were rerun. The briefs claim green S3/docgen; the current merge instruction explicitly defers docs, JSDoc, coverage and vitest-canon findings and controls classification.

Binding basis: the entire operator revision block (including both 2026-10-09 rulings), D1–D20, §§12.4–12.5 and §14. The live standards/effect-laws.allowlist.jsonc contains **zero** scratchpad/effected/yaml/** entries, so there are no allow-<n> additions. Historical YAML entries are not resurrected after removal.

History provenance: file-scoped git logs plus diffs for `872bceb052` (step 2 cast/diagnostic repairs), `706183e913` (S1 law repairs), `a955556fb3` (allowlist removal), and `576451bec2` (round-2 fixes) distinguish forced port changes from newly evidenced bugs. No retained record alleges an unforced shape change or orders restoration of a forced change. Native anchor collections stay MutableHashMap; schema-first and diagnostic-forced changes stay intact.

Write assignments are only YAML source/tests. Ledger, README Port notes, added-export and deviation recording are central responsibilities and never group assignments. Every verified upstream-bug repair retains its §14 evidence for central recording. Do not interpret that protocol as permission for a lane to edit central bookkeeping. Groups list existing tests whose pins/properties may need adjustment and explicitly named new regression files; those new tests are planned surfaces, not files created by this inventory. All vitest runs use --maxWorkers=2, one at a time; module coverage uses beep-heavy --slot-only.

## Required

### alias-history — Bind nested aliases at their original source position

- file: scratchpad/effected/yaml/YamlNode.ts:1170
- class: bug   severity: required
- standard: D9; D11; §14 verified upstream-bug; the documented contract that aliases resolve to the anchor definition visible at their point of use.
- evidence: Read-only Bun probes against the reviewed source and pinned oracle with `"a: &x 1\nb: &y [*x]\nc: &x 2\nd: *y\n"` return `{ a: 1, b: [1], c: 2, d: [2] }`; the installed `yaml` test oracle returns `d: [1]`. With `"a: &x 1\nb: &y [*x]\nc: &x [*y]\nd: *y\n"`, both implementations throw `RangeError: Maximum call stack size exceeded`, while `yaml` returns `{ a: 1, b: [1], c: [[1]], d: [1] }`. The Effect entry point records this as `Die`, bypassing the typed parse-error channel.
- failure: Expanding an earlier anchored collection reinterprets its nested aliases against the current mutable anchor map. Reusing an anchor name therefore changes previously established references and can turn an acyclic document into infinite extraction recursion before the expansion budget fires. This is new evidence beyond the recorded collection migration and sequential duplicate-anchor tests.
- fix: Bind each alias to the preceding anchor target on its first source-order visit and reuse that binding during later expansion. Historical expansion must not re-register anchors into the live environment. Keep real cycles bounded and typed as AliasExpansionBudgetExceeded. Add both duplicate-anchor counterexamples across value, stream, and document extraction; preserve existing anchor and budget tests.
- seats: part-1/sol-3-1, part-1/fable-3-1
- group: g1

### fatal-stream-errors — Keep every fatal stream diagnostic in AST stream parsing

- file: scratchpad/effected/yaml/YamlDocument.ts:163
- class: bug   severity: required
- standard: D11; §14 verified upstream-bug; `YamlDiagnostic.isFatal("UnresolvedTag")` and `YamlDocument.parseAll`’s fatal-diagnostic contract.
- evidence: A read-only Bun probe with `"%TAG !e! tag:example.com,2000:\n---\n!e!foo bar\n...\n---\n!e!foo baz\n"` produces a stream-level `UnresolvedTag` at offset `54`, with both documents’ own error arrays empty. In both the reviewed implementation and pinned oracle, `Yaml.parseAllResult` returns `Failure`, but `Effect.runSyncExit(YamlDocument.parseAll(...))` returns `Success` with two error-free documents. The filter admits only `InvalidDirective`, discarding this fatal stream diagnostic. The third seat identifies an existing contradictory success pin at scratchpad/test/yaml/YamlDocument.coverage.test.ts:17-19; current source confirms it must change.
- failure: The AST stream parser accepts an undeclared tag handle in a later document and loses the diagnostic entirely. Callers receive apparently valid documents even though the same stream fails the value parser’s validity check.
- fix: Filter streamErrors with isFatalCode, matching the document and value-parser filters. Add the cross-document tag-handle regression and change the erroneous success assertion at YamlDocument.coverage.test.ts:17-19 to a typed failure. Coordinate with tag-handle-composition in g5: after its validation move, the fatal error may belong to a document rather than streamErrors, and both channels must remain fatal.
- seats: part-1/sol-3-2, part-1/fable-3-2
- group: g1

### lint-fix-order — Select conflicting edits by their actual intervals

- file: scratchpad/effected/yaml/YamlLint.ts:879
- class: bug   severity: required
- standard: D11; §14 verified upstream-bug; `YamlLint.fix` promises to apply non-overlapping fixes and preserve diagnostic-order priority for conflicts.
- evidence: A read-only Bun probe supplies a configured custom rule over `"a: 1\nb: 2\n"`. Its first diagnostic has offset `0` and a fix `{ offset: 5, length: 1, content: "B" }`; its second diagnostic has offset `1` and a fix `{ offset: 0, length: 1, content: "A" }`. Both the reviewed implementation and pinned oracle return `"a: 1\nB: 2\n"`, although the edits are disjoint and applying both yields `"A: 1\nB: 2\n"`. `YamlLintDiagnostic` imposes no requirement that a diagnostic and its fix begin at the same offset.
- failure: Diagnostics are sorted by diagnostic position, but overlap selection assumes their fixes are sorted by edit position. A valid earlier-source edit is silently dropped whenever a preceding diagnostic supplies a later-source edit.
- fix: Check actual fix intervals rather than a monotone lastEnd frontier. Preserve diagnostic-order priority for overlapping and same-offset edits, then apply every accepted edit through YamlEdit.applyAll. Add a custom-rule regression with disjoint fixes in reversed edit-offset order, retaining overlap and zero-length priority tests.
- seats: part-1/sol-3-3, part-1/fable-3-3
- group: g9

### diagnostic-position-index — Index source positions once for diagnostic batches

- file: scratchpad/effected/yaml/YamlDiagnostic.ts:283
- class: perf   severity: required
- standard: D11’s algorithmic-class criterion.
- evidence: Every `fromRaw` call invokes `lineChar`, whose loop at line `304` scans from source offset zero to that diagnostic’s offset. Batch callers include `Yaml.ts:375–376` and `YamlDocument.ts`’s raw-document materialization. For `"a: 1\n".repeat(N)`, the `N − 1` duplicate-key diagnostics occur at offsets `6, 12, …, 6(N − 1)`, requiring `3N(N − 1)` character visits solely to derive positions: Θ(N²). One source-position index followed by binary lookups reduces that phase to O(T + D log T), where `T` is source length and `D` is diagnostic count. This criterion does not depend on a timing regression.
- failure: Inputs with many diagnostics repeatedly rescan the same source prefixes. Diagnostic materialization adds quadratic work even when all records and their offsets have already been computed.
- fix: Add a reusable position index and indexed batch conversion in YamlDiagnostic.ts; build it once per source operation and reuse it in Yaml.ts, YamlDocument.ts, YamlVisitor.ts and YamlFormat.ts batch paths. Preserve standalone fromRaw, diagnostic order, LF/CR/CRLF/LS/PS, and offsets inside CRLF. Add an operation-count or scaling regression for many duplicate-key diagnostics and retain existing position assertions. Keep the implementation within these existing files.
- seats: part-1/sol-3-4, part-1/fable-3-5
- group: g1

### regional-effect-equality — Remove the native Object.is comparison without changing signed-zero behavior

- file: scratchpad/effected/yaml/YamlFormat.ts:774
- class: law   severity: required
- standard: `standards/effect-laws-v1.md` law 6; `standards/effect-first-development.md` EF-5; D11.
- evidence: The reachable regional replacement path calls `Object.is(node.value, value)`. The native-runtime gate’s `OBJECT_METHODS` set in `packages/tooling/tool/cli/src/commands/Laws/NoNativeRuntime.ts:56–66` lists `keys`, `values`, `entries`, `fromEntries`, `assign`, `hasOwn`, `freeze`, `seal`, and `create`, but omits `is`, explaining why the declared green gate misses this call. No recorded deviation grants this site an exception. Read-only inspection confirms NoNativeRuntime.ts OBJECT_METHODS omits is. This is a demonstrated green-gate miss under law 6, not a request to fix a diagnostic already enforced by that gate.
- failure: Domain comparison still executes a forbidden native `Object` helper. Its signed-zero check is behaviorally significant, so replacing it with ordinary equality alone would introduce another bug.
- fix: Replace Object.is with Effect primitive equality plus an explicit numeric zero-sign comparison. Preserve NaN equality and the fallback when -0 renders as 0. Retain and extend regional-modification signed-zero regressions. Checker hardening is outside this module inventory; no Laws checker file is assigned.
- seats: part-1/sol-3-5, part-1/fable-3-4
- group: g1

### invalid-header-quoted-hash — Keep quoted hashes in invalid block-scalar headers

- file: scratchpad/effected/yaml/internal/lexer.ts:749
- class: bug   severity: required
- standard: D9; D11. Distinct from the three recorded comment deviations (block-scalar body hashes, plain apostrophes, CRLF replacement) and from the closed round-2 `invalid-header-comments` repair, which only required a split for an unquoted tail such as `> hello # comment`.
- evidence: Round 2’s invalid-header scan ends the error token at any whitespace-preceded `#` and emits `scanComment` (`internal/lexer.ts:749-758`) with no quote state. For `| "hello # not"\n` the byte before `#` is a space, so the lexer yields an `error` token `| "hello ` plus a `comment` token `# not"`. `Yaml.stripComments` deletes every `comment` token, leaving `| "hello \n`. The same split deletes the closing quote on `|"hello # not"\n` and on `| "hello # not" # real\n` (the real comment and the quoted tail become one comment). The pinned oracle lexer consumes that whole header as one `error` token (`packages/yaml/src/internal/lexer.ts:646-651`), and its character scanner keeps `#` while a double or single quote is open (`packages/yaml/src/Yaml.ts:679-708`), so both the token stream and `stripComments` stay `| "hello # not"\n`. Unquoted `> hello # comment` still has no open quote, so the round-2 split remains. No Port-notes or ledger row covers this quoted case. Primary file is normalized to the defective lexer loop; Yaml.ts:878 is its observing facade. The existing dirty lexer edit affects isPlainScalarBreak only and is preserved.
- failure: A `#` inside quotes on an invalid block-scalar header is stripped, and the closing quote and the rest of the header line go with it. Upstream `stripComments` and the upstream token stream keep that text. `YamlTokens.tokenize` shows the same split.
- fix: Track single- and double-quote state only in the invalid-header scan, including doubled single quotes and double-quote backslash escapes. Split comments only outside quotes; preserve the round-2 unquoted-header split. Test quoted hashes, a real comment after the closing quote, stripComments output, and exact token spans.
- seats: part-1/grok-3-1
- group: g2

### fold-tab-fidelity — Do not fold a scalar before an interior tab

- file: scratchpad/effected/yaml/internal/fold.ts:70
- class: bug   severity: required
- standard: D9, D11, §14 verified upstream-bug; `foldScalarLine`’s documented value-preserving contract.
- evidence: A read-only Bun probe called `Yaml.stringifyResult("one two \tthree four", { defaultScalarStyle: "block-folded", lineWidth: 12 })`. Both the port and pinned oracle emitted `">-\n  one two\n  \tthree\n  four\n"`. The independent `yaml` parser decoded this as `"one two\n\tthree\nfour"`, instead of the original string. The split-candidate check excludes neighboring spaces but permits a following tab.
- failure: Width folding moves an interior tab to the beginning of a continuation line. YAML treats that line as more-indented content and preserves the surrounding line breaks, changing the scalar value despite successful serialization. The recorded more-indented-content repair concerns block rendering before width folding and does not cover this counterexample.
- fix: Exclude width-fold split points that move a tab to the start of a continuation line. Add the public block-folded stringify counterexample and extend the folding generator to interior tabs with positive lineWidth; compare decoded values with the independent yaml parser.
- seats: part-2/sol-3-1
- group: g4

### cst-block-entry-boundary — Respect line breaks embedded in block-scalar CST spans

- file: scratchpad/effected/yaml/internal/cst-visitor.ts:443
- class: bug   severity: required
- standard: D9, D11; CST key/value classification contract.
- evidence: For `"a: |\n  x\n: 2\n"`, a read-only probe produced port key sources `["a", "|\n  x\n"]` and value sources `["2"]`. The pinned oracle classified `"|\n  x\n"` as a value. The independent parser and port value parser both returned `{ a: "x\n", "": 2 }`. The same regression occurs with folded style. `findMapContent` stops at separate newline children, but the preceding block-scalar node contains the newline in its own source span, so lookahead reaches the next entry’s `:`.
- failure: A block-scalar value before an empty-key entry is reclassified as a key, and the actual empty key disappears. This is new evidence against the round-2 boundary repair: its fixed plain-scalar examples have separate newline nodes, while block scalars absorb those breaks.
- fix: Use source spans to detect same-line key promotion and subsequent entry boundaries, including breaks contained inside scalar or collection nodes. Preserve the preceding block scalar as a value and emit the following empty key. Add literal and folded regressions beside existing CST empty-key tests.
- seats: part-2/sol-3-2
- group: g3

### visitor-stream-reexecution — Create a fresh visitor generator for each stream execution

- file: scratchpad/effected/yaml/YamlVisitor.ts:183
- class: bug   severity: required
- standard: D11; §14 verified upstream-bug; Effect stream construction semantics. The local Effect reference documents that `Stream.suspend` evaluates its factory each time the stream runs.
- evidence: A read-only probe created `const stream = YamlVisitor.visit("a: 1\n")` and collected that same stream twice. Event counts were `7`, then `0`, in both the port and pinned oracle. Collecting `Stream.take(stream, 1)` on a fresh visitor stream also left a subsequent full collection empty. Wrapping construction in `Stream.suspend(() => YamlVisitor.visit("a: 1\n"))` produced seven events on both full runs and again after a partial run.
- failure: `visit` captures one mutable generator instance. Its returned stream becomes exhausted or closed after its first execution, so reusing a parsing pipeline silently loses all events. Partial consumption also prevents a later complete traversal of the same stream.
- fix: Return Stream.suspend(() => Stream.fromIterable(visitGen(text, options))). Add full-collection-twice and partial-then-full regressions on the same stream; preserve event ordering and lazy construction.
- seats: part-2/sol-3-3
- group: g1

### requote-schema-models — Make the requote payload and named policy schema-derived

- file: scratchpad/effected/yaml/internal/requote.ts:52
- class: schema   severity: required
- standard: D5, D11; `standards/ARCHITECTURE.md`, “Schemas Are Executable Contracts”; `standards/effect-first-development.md` EF-33 and EF-12b; `standards/effect-laws-v1.md` law 19.
- evidence: `RequoteScalarInput` remains a handwritten interface containing only scalar data, presentation metadata, and source coordinates. `RequoteMode` at line 79 remains the named literal union `"conservative" | "escaping"` and controls the branch at line 129. Neither has a defining schema. These declarations are present in the reviewed commit and are not covered by the recorded schema migrations or a model exception. The two third-seat records independently identify the payload and named mode. They are merged as one requote modeling repair. The request to name the anonymous quote parameter is rejected separately below.
- failure: The reusable requoting payload and policy domain remain outside the required schema source of truth. Their fields and literal vocabulary have no schema-derived validation, annotations, or arbitraries; the green gates missed these concrete modeling-law violations.
- fix: Define an identity- and field-annotated structural RequoteScalarInput schema, reusing ScalarStyle, with unknown value, optional tag/anchor accepting their existing undefined compatibility, and finite offset/length fields. Derive the same-name type and retain plain structural inputs without per-call decoding. Define annotated LiteralKit(["conservative", "escaping"]) for RequoteMode and derive its type. Preserve conversion behavior and module initialization. Leave the anonymous inline quote-character domain anonymous; no named QuoteCharacter kit is required. Added-export and systemic law-deviation recording belongs to the central codemod.
- seats: part-2/sol-3-4, part-2/fable-3-2, part-2/fable-3-1
- group: g3

### parser-state-schema — Derive mutable parser state from an annotated schema

- file: scratchpad/effected/yaml/internal/cst-parser.ts:17
- class: schema   severity: required
- standard: D5, D11; `standards/effect-first-development.md` EF-33; `standards/schema-first-development-prompt.md`, “Schema owns pure data.”
- evidence: `ParserState` is a handwritten four-field data interface: `tokens`, `text`, `pos`, and `depth`. It contains no methods, service contract, overload machinery, or type-level transformation. Its token field already has the schema-backed `YamlToken` building block, but no schema defines the parser-state payload.
- failure: The internal parser model remains independently handwritten after the schema-first pass. Cursor and depth fields, their mutability, and the token collection have no executable source of truth. This is a remaining pure-data model, distinct from the closed CST-node and raw-pipeline findings.
- fix: Define a file-local annotated structural ParserState schema using the existing token schema and derive its type. Keep pos and depth writable through field modifiers or the established derived mutable-field type. Preserve plain-object construction, parser behavior and depth guards; do not validate on each parser step.
- seats: part-2/sol-3-5
- group: g3

### flow-empty-key-span — Locate explicit empty flow keys at the question indicator

- file: scratchpad/effected/yaml/internal/composer/block.ts:1226
- class: bug   severity: required
- standard: D11 bug; section 14 `upstream-bug`. The admitted comma/closing fix (PORT_LEDGER.json `composer-regressions.test.ts:179`, README Port notes) stores `explicitKeyOffset` and materializes a zero-length null key there. `block.ts:1178-1188` already anchors a value-separator null key on its `:`. YAML 1.2 explicit-key indicator is `?`. The independent `yaml` parser reports the duplicate on the second entry (`{? : 1, ? : 2}` at column 11, zero-length key ranges `[3,3,3]` and `[10,10,10]`).
- evidence: `flattenFlowChildren` sets `explicitKeyOffset` and pushes `{ kind: "key" }` with no node (`flow.ts:429-435`). The comma branch (`flow.ts:377-388`) and the closing branch (`flow.ts:589-596`) replace that item. The `:` branch (`flow.ts:408-427`) only flushes pending metadata, then pushes `value-sep`, so a bare `{? : value}` stays node-less. `buildPairs` then hits `keyOrNull`, which builds `YamlScalar` at offset 0, length 0 (`block.ts:1225-1226`). `checkDuplicateKeys` warns at `pair.key.offset`. Read-only `composeFirstDocument`: `{? : 1}` key offset 0 length 0; `{? : 1, ? : 2}` both keys 0:0 and `DuplicateKey` 0:0 (`?` is at 1 and 8); `nested: {? : 1, ? : 2}` both inner keys 0:0 and `DuplicateKey` 0:0, the same span as the outer key `nested` (`?` is at 9 and 16); `{? #c\n: 1, ? : 2}` same 0:0 warning. `{?}` and `{? ,}` already use the `?` offset. `{?: 1}` stays the invalid plain scalar `?`. Pinned oracle `af7566a9` `composeFirstDocument("nested: {? : 1, ? : 2}\n")` returns the same `[[0,0,null],[0,0,null]]` and `DuplicateKey` 0:0 (`flow.ts` pushes a node-less key; oracle `block.ts:1061` uses offset 0). Round-2 `flow-empty-key-offset` and its regression cover only `nested: {? , ?}`.
- failure: An explicit empty flow key written `{? : value}` gets a null key span of 0:0. In a nested map the duplicate-key warning points at the start of the outer document, on a different key. The comma and closing spellings of the same empty key already keep the `?` offset.
- fix: In the flow colon branch, replace a preceding node-less key with a zero-length null plain scalar at explicitKeyOffset when no metadata-generated key replaced it. Skip intervening comments as at comma boundaries. Preserve metadata-bearing keys and invalid tight ?: syntax. Add {? : 1}, nested duplicate empty-key offsets 9/16, and comment-separated regressions alongside the comma tests.
- seats: part-3/grok-3-1
- group: g5

### nested-flow-comment-lines — Keep multiline nested flow renderings intact

- file: scratchpad/effected/yaml/internal/stringifier.ts:1591
- class: bug   severity: required
- standard: D10 formatter fidelity; D11; section 14, verified upstream bug.
- evidence: A read-only Bun probe against commit `c3fc60bdbfd5574dc69623d132dced0a552a586a` and the pinned oracle parsed `"{a: [1, # inner\n 2]}\n"` through `YamlDocument.parse`, then called the document’s default `stringify()`. Both emitted `"{a: [   1, # inner   2 ]}\n"`. Reparsing returned `Failure` in both implementations; the independent `yaml` parser reported `BAD_INDENT` and `MISSING_CHAR`. The sibling flow-sequence paths at lines 1968 and 1979 also flatten rendered child lines with `.join(" ")`.
- failure: A nested flow collection can render across lines because it contains comments, while its enclosing flow collection flattens those lines into one. The inner `#` then consumes subsequent values and closing delimiters. Default document stringification turns valid YAML into invalid YAML.
- fix: Promote a flow map or sequence to multiline layout whenever any rendered child spans lines. Preserve child line breaks; append commas and parent trailing comments after the final child line. Cover nested flow maps/sequences with comments through document stringify and independent-parser round trips.
- seats: part-3/sol-3-1
- group: g4

### flow-alias-key-spacing — Separate alias keys from flow value indicators

- file: scratchpad/effected/yaml/internal/stringifier.ts:1592
- class: bug   severity: required
- standard: D10 formatter fidelity; D11; section 14, verified upstream bug.
- evidence: A read-only Bun probe parsed `"x: &a key\ny: {*a : val}\n"` successfully in both the port and pinned oracle, yielding `{ x: "key", y: { key: "val" } }`. Default document stringification emitted `"x: &a key\ny: {*a: val}\n"` in both. The independent parser rejected the output with `MISSING_CHAR`. The comment-bearing flow-map branch at line 1581 emits the same delimiter-tight form. The block-map branch already handles alias-key separation at lines 1710–1718.
- failure: Flow mappings omit the required separation between an alias key and its value indicator. The emitted colon becomes part of the alias name, so a valid alias-key mapping cannot round-trip.
- fix: Apply the existing block-map key-separator logic in both flow-map rendering branches: emit *a : val for alias keys and preserve metadata-only empty-key separation. Test flow maps with and without comments using both the port and independent yaml parser.
- seats: part-3/sol-3-2
- group: g4

### alias-tag-properties — Reject tags attached to aliases

- file: scratchpad/effected/yaml/internal/composer/anchors.ts:44
- class: bug   severity: required
- standard: D11; section 14, verified upstream bug; the composer’s alias-property validation contract.
- evidence: Read-only probes of both the port and pinned oracle returned `Success({ a: 1, b: 1 })` for `"a: &x 1\nb: !!str *x\n"` and `Success([1, 1])` for `"- &x 1\n- !!str *x\n"`. The independent `yaml` parser rejected both with `ALIAS_PROPS`. `checkAnchorOnAlias` checks only `pendingMeta.anchor`; pending tags pass through and are discarded when the alias is constructed.
- failure: Strict parsing accepts tags attached to aliases and silently ignores them. For example, `!!str *x` produces the referenced number without reporting the invalid property.
- fix: Extend shared alias-property validation to reject pending tags with an existing fatal diagnostic such as UnexpectedToken at tagSpan. Preserve the anchor check and recovered alias AST. Add block-map and block-sequence tagged-alias regressions.
- seats: part-3/sol-3-3
- group: g5

### explicit-multiline-keys — Exempt explicit quoted keys from the implicit multiline-key rejection

- file: scratchpad/effected/yaml/internal/composer/block.ts:1671
- class: bug   severity: required
- standard: D11; section 14, verified upstream bug; `checkMultilineImplicitKeys`’ contract restricts **implicit** keys, while explicit keys may span lines.
- evidence: A read-only probe of `Yaml.parseResult("? \"a\n b\"\n: value\n")` returned `Failure` with `UnexpectedToken: Implicit mapping key must not span multiple lines` in both the port and pinned oracle. The independent parser accepted the source and returned `{ "a b": "value" }`. The quoted-scalar arm performs no explicit-key exemption, although the flow-collection arm applies `wasIntroducedByExplicitKeyIndicator` at line 1687.
- failure: Valid explicit multiline quoted mapping keys are rejected as implicit keys.
- fix: Check the existing explicit-key exemption before rejecting quoted scalar keys containing line breaks. Add explicit single- and double-quoted multiline acceptance regressions while retaining multiline implicit-key rejection.
- seats: part-3/sol-3-4
- group: g5

### empty-key-value-comments — Preserve comments consumed between an empty key and its value

- file: scratchpad/effected/yaml/internal/composer/block.ts:1421
- class: bug   severity: required
- standard: D11; section 14, verified upstream bug; the block composer’s documented comment-attribution contract and default document stringification’s comment preservation.
- evidence: Read-only parse/stringify probes against both the port and pinned oracle transformed `": # before\n  1 # after\n"` into `": 1 # after\n"` and `":\n  # lead\n  1\n"` into `": 1\n"`. `consumeValueNodeForNullKey` skips comments and returns only `{ node, nextIdx }`; the caller at lines 1182–1191 therefore cannot attach the consumed separator-line or leading comments.
- failure: Comments between an empty key’s `:` and its value disappear during composition. Subsequent stringification permanently loses them, although equivalent named-key entries retain their comment fields.
- fix: Return the existing ConsumedValue payload from the empty-key value consumer and attach sameLineComments and leadingComments using the named-key path. Preserve cross-line next-key lookahead. Test separator-line and own-line comments on empty keys through parse/stringify.
- seats: part-3/sol-3-5
- group: g5

### empty-document-final-newline — Honor finalNewline for canonically framed empty documents

- file: scratchpad/effected/yaml/internal/stringifier.ts:2132
- class: bug   severity: required
- standard: D11; section 14, verified upstream bug; `YamlStringifyOptions.finalNewline` specifies whether emitted YAML ends with a newline (`Yaml.ts:217`).
- evidence: A read-only probe parsed `"---\n"` and called `document.stringify({ forceDefaultStyles: true, finalNewline: false })`. Both the port and pinned oracle returned `"---\n"`. The canonical empty-document branch returns literal marker strings before applying `finalNewline`; its explicit-end-marker form also ends with a newline.
- failure: Empty documents with explicit framing ignore `finalNewline: false` in canonical mode, violating the option’s public contract.
- fix: Apply finalNewline to assembled empty-document marker output. Remove only the terminal newline when false, retaining the separator between --- and .... Add canonical start-only and start/end-marker option regressions.
- seats: part-3/sol-3-6
- group: g4

### duplicate-node-properties — Validate duplicate properties before overwriting or collapsing metadata

- file: scratchpad/effected/yaml/internal/composer/block.ts:590
- class: bug   severity: required
- standard: D11; section 14, verified upstream bug. This is new evidence for metadata collapsing across multiple lines, beyond the closed round-2 same-line duplicate-property cases.
- evidence: Read-only probes of both the port and pinned oracle accepted `"a: !!str\n  !!int\n  1\n"` as `{ a: 1 }` and `"a: &x\n  &y\n  foo\n"` as `{ a: "foo" }`, with zero document errors. The recovered scalars retained only `tag: "!!int"` or `anchor: "y"`. The independent parser rejected these inputs with `MULTIPLE_TAGS` and `MULTIPLE_ANCHORS`. At scalar consumption, `commitOuterIfNewlineSeen()` merges and clears `pendingMeta` before `validateNoDoubleAnchorOnScalar` examines the two slots. Additional root/flow evidence from part-4/sol-3-3: &a &b hello, !!str !!int 1, [&a &b foo], and [!!str !!int 1] are accepted by port/oracle but rejected independently with MULTIPLE_ANCHORS/MULTIPLE_TAGS; assignments in document.ts:415 and flow.ts:457/461 overwrite metadata. All duplicate-property paths share the same missing-before-overwrite validation defect and are one repair.
- failure: A newline after the second property bypasses duplicate-property validation. Two properties belonging to the same scalar are silently reduced to the last property, so strict parsing accepts malformed YAML despite the round-2 repair.
- fix: Validate duplicate scalar tag/anchor slots before commitOuterIfNewlineSeen merges or clears them in block.ts. Apply equivalent pending-property validation before metadata replacement in document.ts and flow.ts. Preserve legal outer-container/inner-key splits and the recovered last-property AST while recording fatal diagnostics. Add multiline block, root, and flow multiple-tag/multiple-anchor counterexamples.
- seats: part-3/sol-3-7, part-4/sol-3-3
- group: g5

### composer-cr-comments — Use physical CR/LF/CRLF boundaries throughout comment attribution

- file: scratchpad/effected/yaml/internal/composer/comments.ts:140
- class: bug   severity: required
- standard: D9 / recorded `composer-cr-lines` (PORT_LEDGER.json, `scratchpad/test/yaml/composer-regressions.test.ts:224`). YAML 1.2 line breaks are CR, LF, and CRLF. `state.sameLine` (`state.ts:125`) already treats `\r` as a break; `sameLineSpan` (`comments.ts:141`), `blankLineAboveStart` (`comments.ts:274`), `hasBlankLineBelow` (`comments.ts:381`), `hasBlankLineBetween` (`comments.ts:117`), and `columnAt` (`comments.ts:467`) still search only for `\n`.
- evidence: Read-only `composeFirstDocument` / `YamlFormat.formatToString` probe against the LF twin and the pinned oracle. `":\r# c\rkey: 1\r"` composes with no errors and formats to `":\nkey: 1\n"`; the LF twin formats to `":\n# c\nkey: 1\n"`. `consumeValueNodeForNullKey` (`block.ts:1422`) keeps `firstOwnLineIdx` at -1 because `sameLineSpan` misses the CR, then returns `nextIdx` past the comment, while `state.sameLine` (`block.ts:1433`) correctly refuses to consume `key`. `"a:\r  # note\r  1\r"` stores `value.comment` `" note"` and formats to `"a: 1 # note\n"`; the LF twin stores `commentBefore` and keeps the comment on its own line. `"# heading\r\ra: 1\r"` stores `" heading"` and formats to `"# heading\na: 1\n"`; the LF twin stores `" heading\n"` and keeps the blank line (`document.ts:706`). `"root:\r  nested:\r    b: 1\r# tail\ra: 2\r"` attaches `# tail` to the nested value and formats it indented under `nested`; the LF twin, and the pinned oracle, attach it to `a`. `columnAt` measures that `#` from the last `\n`, so the column-0 escape at `block.ts:1295` does not fire. part-3/fable-3-1 adds two independent LF-only scans in block.ts:231/238 (trimDisownedTrailingComments), so the fix surface includes block.ts as well as comments.ts. Other seats reproduce sameLineSpan/columnAt failures and loss of blank lines. These are one physical-line-model defect.
- failure: After CR became a real line break, these helpers still treat a CR-only document as one line. Own-line comments are dropped or moved onto another node, blank lines between a header and the body disappear, and a column-0 comment is captured by the inner collection.
- fix: Recognize LF, lone CR, and CRLF counted once in sameLineSpan, hasBlankLineBetween, blankLineAboveStart, hasBlankLineBelow and columnAt. Update both LF-only line-start scans in block.ts trimDisownedTrailingComments as well. Keep isOwnLineAt/isAfterIndicatorOnly behavior. Compare CR inputs with LF twins for key-line/own-line comments, blank lines, empty-key comments, escaped node spans and nested terminal-comment ownership.
- seats: part-4/grok-3-1, part-4/sol-3-5, part-4/fable-3-3, part-3/fable-3-1
- group: g5

### document-end-cr-position — Report EOF positions after a trailing lone CR

- file: scratchpad/effected/yaml/internal/rules/document-end.ts:70
- class: bug   severity: required
- standard: D11; the rule’s documented EOF-position contract; the recorded CR-aware lint-line semantics.
- evidence: A commit-pinned probe of `YamlLint.run("a: 1\r", builtins, config)` with `document-end` enabled emits `{ offset: 5, line: 0, character: 4 }`. The composer’s CR-aware `lineCol(text, 5)` returns `{ line: 1, column: 0 }`. For `"a: 1\r\r"`, the rule reports line 1 instead of line 2. CRLF reports correctly. `buildLines` already treats lone CR as a terminator, but `endOfStreamPosition` recognizes a trailing terminator only through `endsWith("\n")`.
- failure: Missing-end-marker diagnostics and absence inference votes have line/character coordinates that disagree with their EOF offset on CR-terminated input.
- fix: Recognize a trailing lone CR as a physical break in endOfStreamPosition, reporting the following line at character 0. Test one and multiple CR terminators in diagnostics and inference. Preserve current insertion bytes; this position fix must not change the endsWith-LF insertion policy.
- seats: part-4/sol-3-6, part-4/grok-3-2, part-4/fable-3-2
- group: g8

### flow-comment-before-value — Accept comments between a flow colon and its value

- file: scratchpad/effected/yaml/internal/composer/flow.ts:88
- class: bug   severity: required
- standard: D9 behaviour preservation; D11; section 14.
- evidence: Read-only `bun -e` probes loaded YAML source from commit `c3fc60bdbfd5574dc69623d132dced0a552a586a` through an in-memory loader. `Yaml.parseResult("{foo: # c\n bar}")` fails with `MalformedFlowCollection` at offset 11. The pinned upstream oracle succeeds with `{ foo: "bar" }`, and the independent `yaml` parser reports no errors. `[foo: # c\n bar]`, quoted keys, and collection-valued entries fail similarly. The colon branch resets `contentAfterColon` but leaves `sawContent` true, so a comment before the value incorrectly arms `separatorRequired`.
- failure: Valid comments between a flow mapping’s colon and its value cause strict parsing to reject the document.
- fix: Distinguish an entry awaiting its value from completed entry content when arming separatorRequired. Clear completed-content state at the first structural colon or gate the comment arm appropriately. Add valid map and implicit sequence-map cases with comments before values; keep missing-comma and comment-before-colon regressions. Use correctly matched brackets in test inputs.
- seats: part-4/sol-3-1, part-4/fable-3-1
- group: g5

### flow-property-empty-key-once — Materialize property-bearing empty explicit flow keys once

- file: scratchpad/effected/yaml/internal/composer/flow.ts:383
- class: bug   severity: required
- standard: D9; D11; section 14.
- evidence: Commit-pinned read-only probes show `Yaml.parseResult("{? &a, next: *a}")` failing with a false `DuplicateKey` at offset 5; the pinned oracle and independent `yaml` parser succeed with `{ "": null, next: null }`. Composition produces three pairs: a synthetic null key, a second anchored null key, and `next`. `{? &a}` also fails, through the closing-boundary branch at line 592. `{? !!str}` produces two AST pairs for one explicit entry, although conversion to a JavaScript object hides the extra pair.
- failure: Empty explicit flow keys carrying pending properties are materialized twice. Valid anchored keys fail strict parsing, and tagged keys acquire phantom AST entries. The recorded empty-key position correction does not authorize either outcome.
- fix: At comma and closing boundaries, create one explicit empty key using pending tag/anchor metadata and its resolved empty value. Register that anchor, consume the metadata once, and avoid a subsequent phantom node. Test parsed values, AST pair counts and {? &a, next: *a}, {? &a}, {? !!str}; preserve empty-key source positions.
- seats: part-4/sol-3-2
- group: g5

### tag-handle-composition — Validate actual tag properties in every document

- file: scratchpad/effected/yaml/internal/composer/tags.ts:204
- class: bug   severity: required
- standard: D11; section 14 verified upstream-bug protocol; `validateTagHandlesInDocument`’s documented requirement that named handles be declared in the same document.
- evidence: Commit-pinned probes show `!missing!str hi\n`, `x: !missing!str hi\n`, and `!missing!map {x: 1}\n` succeeding without diagnostics in both port and pinned upstream; the independent parser reports unresolved tags. `composeDocument` at `document.ts:767` requests only percent validation, while handle validation starts at document index 1. Conversely, `---\n0\n---\nhello\n !missing!str\n` fails with `UnresolvedTag` at offset 17 because the `"handles"` walk checks a CST tag-shaped token absorbed into plain-scalar content. Independent `yaml.parseAllDocuments` reports no errors and yields `[0, "hello !missing!str"]`.
- failure: Handle validation misses genuine undeclared properties in the first document and rejects ordinary scalar continuation text in later documents.
- fix: Perform named-handle validation during every document composition, filtering to consumed property offsets in state.tagOffsets. Remove only the corresponding handle check from the pre-composition cross-document pass to avoid duplicates; retain directive-placement checks. Test undeclared scalar/collection tags in document one and tag-shaped plain continuation text in later documents. Coordinate the AST parseAll assertions with g1.
- seats: part-4/sol-3-4
- group: g5

### document-end-empty-fidelity — Do not erase an explicit empty document when removing its sole marker

- file: scratchpad/effected/yaml/internal/rules/document-end.ts:129
- class: bug   severity: required
- standard: D11; section 14 verified upstream-bug protocol; the document-count fidelity invariant already applied to the round-2 document-start fix.
- evidence: Commit-pinned read-only probes show `YamlLint.fix("...\n", builtins, config)` with `document-end: { present: false }` succeeding with `""`; `"# c\n...\n"` becomes `"# c\n"`. Independent `yaml.parseAllDocuments` reports one explicit empty document before either fix and zero documents afterward. The pinned upstream has the same inherited bug. The removal condition checks only that the marker occupies its line, without determining whether that marker is the empty document’s sole structural carrier.
- failure: Removing a forbidden document-end marker can erase an explicit empty document from the stream.
- fix: Keep the forbidden-end-marker diagnostic but withhold removal when the final document has no content and no explicit start marker independently preserving it. Inspect the final document rather than first-document context. Test standalone and comment-prefixed ... streams with independent document counts, including safe removal when a start marker remains.
- seats: part-4/sol-3-7
- group: g8

### plain-scalar-blank-lines — Exclude composed scalar-content blank lines from layout fixes and inference

- file: scratchpad/effected/yaml/internal/rules/empty-lines.ts:114
- class: bug   severity: required
- standard: D9, D11, section 14 (`upstream-bug`)
- evidence: `scanPlainScalar` stops at a newline (`internal/lexer.ts:527`), so a blank line between plain fragments is not inside a scalar token. `insideScalarSpan` (`internal/rules/util.ts:293`) is that token test, and both the check (`empty-lines.ts:114`) and the infer hook (`empty-lines.ts:166`) use only it. The composer still spans those fragments (`internal/composer/block.ts:814`) and `foldFlowLines` keeps an empty part as a newline (`internal/composer/scalars.ts:470`). The pinned oracle has the same token-only skip (`packages/yaml/src/internal/rules/empty-lines.ts:46`). Probe on this tree: `YamlLint.fix("a: first\n\n\n\n  second\n", [emptyLines], default)` changes `"first\n\n\nsecond"` to `"first\n\nsecond"` under the default `max` of 2, and `observe` records floor 3. With `{ max: 0 }`, `"a: first\n\n  second\n"` changes `"first\nsecond"` to `"first second"`. The same deletion changes a flow sequence item and a block sequence item. `a: |\n  hello\n\n\n  world\n` with `{ max: 0 }` stays `"hello\n\n\nworld\n"`.
- failure: The rule's own contract skips blank lines inside scalar content. For a multiline plain scalar those lines are the value, and the deleting fix removes them. Inference floors `max` from the same lines.
- fix: Collect composed sourceMultiline scalar spans through walkScalars once per rule operation. In both empty-lines checking and inference, skip blank lines whose offsets lie inside those spans, retaining existing token-span protection. Test multiline plain map values, flow/block sequence items, max 0/default settings and unchanged block scalars with independent value fidelity.
- seats: part-5/grok-3-1
- group: g6

### indent-document-reset — Reset explicit-key continuation state at document markers

- file: scratchpad/effected/yaml/internal/rules/indentation.ts:141
- class: bug   severity: required
- standard: D9, D11
- evidence: `contentLines` continues on `document-start` and `document-end` at line 141 before `explicitKeyColumn` can be cleared at line 143. Line 179 then drops a deeper line whose first token is a scalar and which has no block indicator. Check and infer both use this list (`indentation.ts:253`, `indentation.ts:327`). Probe with `{ spaces: 4 }`: `"? key\n---\n  hello\n"` parses as `[{ key: null }, "hello"]` and produces no diagnostic and no vote. `"key: 1\n---\n  hello\n"` reports `Indent of 2 spaces, expected 4` on line 2 and votes `spaces: 2`. `"? key\n: 1\n---\n  hello\n"` reports the same on line 3, because the value indicator clears the column. `"? key\n...\n  hello\n"`, `"? key\n---\n  \"hello\"\n"`, and `"? key\n---\n  |\n    hello\n"` are silent. `"? key\n  hello\n"` parses as `{ "key hello": null }` and stays silent. The pinned oracle only skips the marker line itself (`packages/yaml/src/internal/rules/indentation.ts:80`).
- failure: An explicit key still open at `---` or `...` suppresses indentation checks and `spaces` votes for the next document's deeper plain, quoted, or block-scalar line. A colon line in that document is still checked.
- fix: Clear explicitKeyColumn before continuing on document-start or document-end tokens. Test an unfinished explicit key followed by ---/... and a deeper plain, quoted or block scalar in the next document; assert both expected indentation diagnostics and spaces votes while retaining same-document continuation exemptions.
- seats: part-5/grok-3-2
- group: g6

### eof-keep-chomp-fidelity — Withhold EOF insertion that adds a keep-chomp scalar content break

- file: scratchpad/effected/yaml/internal/rules/eof-newline.ts:82
- class: bug   severity: required
- standard: `scratchpad/EFFECTED_PORT_GOAL.md` D9, D11, §14 — verified upstream-bug correction preserving YAML values.
- evidence: A read-only Bun probe against the requested commit and pinned upstream ran `YamlLint.fix` with only `eof-newline` enabled on `"a: |+\n  hi\n  "`. Both returned `"a: |+\n  hi\n  \n"`. The independent `yaml` parser reads the original as `{ a: "hi\n" }` and the fixed text as `{ a: "hi\n\n" }`. The equivalent `>+` case also gains a retained newline. The port’s parser returns `"hi\n\n"` for both inputs, so a fidelity assertion using only that parser would miss the change. This case is absent from the round-2 inventory and recorded deviations.
- failure: The unconditional EOF insertion completes an unfinished whitespace-only line inside a keep-chomp block scalar, adding a newline to its value. A successful layout fix therefore changes the document’s meaning.
- fix: Keep the eof-newline diagnostic but omit insertion when completing a final whitespace-only line inside a keep-chomp block scalar adds a retained content newline. Add literal |+ and folded >+ fidelity regressions using the independent yaml parser, since the current port parser masks this difference.
- seats: part-5/sol-3-1
- group: g6

### mapping-key-subtree-policy — Exclude whole collection-valued key subtrees from value-only scalar rules

- file: scratchpad/effected/yaml/internal/rules/quoted-strings.ts:129
- class: bug   severity: required
- standard: The `quotedStrings` contract excludes mapping keys from checking and inference; `truthyOptions.checkKeys` controls whether mapping keys are checked. `scratchpad/EFFECTED_PORT_GOAL.md` D11 and §14 permit a verified upstream-bug correction.
- evidence: Read-only probes against the requested commit and pinned upstream produced the same results. For `"? ['a', 'b']\n: value\n"`, `quoted-strings` reports and offers fixes for both strings inside the mapping key. For `"? ['a']\n: \"value\"\n"`, observation emits both `single` and `double` votes, and strict resolution fails with `YamlStyleConflictError`, although the sole value uses double quotes. For `"? [yes, no]\n: value\n"` with `truthy: { checkKeys: false }`, the rule still reports and quotes both key elements. `util.ts:178–185` explains the shared cause: traversal enters the collection with role `"key"` but replaces that role with `"item"` or `"value"` when descending.
- failure: Collection-valued mapping keys bypass the key-exclusion policy. Their contents receive unwanted diagnostics and fixes, and their quote styles can create a false inference conflict. `checkKeys: false` also fails to leave those keys alone.
- fix: Add a walkScalars traversal mode excluding entire mapping-key subtrees while retaining immediate-parent roles for existing callers. Use it for quoted-string checking/inference and for truthy checking when checkKeys is false. Add sequence-key and mapping-key diagnostics, fix and strict-inference regressions; retain checkKeys true behavior.
- seats: part-5/sol-3-2
- group: g6

### hyphen-scan-scaling — Precompute hyphen relocation safety instead of scanning every suffix

- file: scratchpad/effected/yaml/internal/rules/hyphen-spacing.ts:108
- class: perf   severity: required
- standard: `scratchpad/EFFECTED_PORT_GOAL.md` D11 — measured regression versus pinned upstream and an algorithmic-class improvement.
- evidence: For `"-   ".repeat(n) + "x\n"`, every over-spaced hyphen scans the remaining same-line token suffix. The total scan is Θ(n²); upstream checks these indicators in Θ(n). A read-only Bun probe captured each lint context once, excluded parsing, warmed the checks, then measured three samples of five checks each. At 1,024 entries, port samples were `[26.76, 27.49, 27.53]` ms versus upstream `[5.15, 4.16, 4.81]` ms. At 2,048 entries, port samples were `[105.73, 105.85, 106.14]` ms versus upstream `[10.28, 13.92, 9.44]` ms. Both implementations returned exactly `n` hyphen diagnostics. These larger inputs have a recovered nesting-depth error; `YamlLint.run` explicitly supports malformed documents. This suffix-scan regression is distinct from the closed round-2 scalar-guard findings.
- failure: Doubling the token stream approximately quadruples hyphen-check time. The parser’s depth limit does not bound this work because the rule still examines the full eager token stream.
- fix: Compute reusable relocation-safety data once per line or token stream and query it for each hyphen; eliminate repeated same-line suffix scans. Preserve compact collection and explicit-indent scalar protections, including hyphen-safe-map-fix. Add a bounded scaling or operation-count regression for recovered deep input rather than relying on parser depth to bound lint work.
- seats: part-5/sol-3-3
- group: g7

### indent-own-line-properties — Look past own-line node properties when pairing a key with its sequence

- file: scratchpad/effected/yaml/internal/rules/indentation.ts:201
- class: bug   severity: required
- standard: EFFECTED_PORT_GOAL.md D9, D11, §14 (`upstream-bug`)
- evidence: Source reading only; `YamlLint.run` was not executed. `contentLines` pushes every anchor/tag line (`indentation.ts:180`). `opensKey` stays set only for an anchor or tag after `:` on that same line (`indentation.ts:173-174`); a property-only line starts with `opensKey` false. `isKeyThenSeqEntry` then requires the immediate predecessor to open a key (`indentation.ts:201`), and both check and infer walk consecutive content lines (`indentation.ts:298`, `indentation.ts:361`). For `a:\n  &anchor\n  - x\n`, `a:\n  !!seq\n  - x\n`, and `a:\n  !!seq &anchor\n  - x\n`, the property line sits between the key and the sequence. The composer still attaches that anchor or tag to the following block sequence: `flattenBlockMapChildren` keeps the property as pending meta and `commitOuterIfNewlineSeen` applies it at the `block-seq` (`block.ts:563-576`, `block.ts:941-957`). The landed tests only put the properties on the key line (`scratchpad/test/yaml/rules/indentation.test.ts:248-285`). The pinned oracle misses the same inputs: `isKeyThenSeqEntry` requires the previous line text to end with `:` (oracle `packages/yaml/src/internal/rules/indentation.ts:104`). This is the remaining hole beside the closed same-line finding `indent-node-properties`. A same-line `&anchor - item` is a composer error (`block.ts:536-554`) and is outside this fix.
- failure: An own-line anchor or tag on a block sequence hides that sequence from `indentSequences`. With `{ spaces: 2, indentSequences: false }`, `a:\n  &anchor\n  - x\n` produces no "should not be indented" diagnostic, and the indented form produces no vote. Consistent mode on `a:\n  - x\nb:\n  &anchor\n- y\n` stays silent, and strict inference can settle on the remaining document's placement. The two-space unit check itself stays quiet, because both the property and the sequence sit at column 2.
- fix: For indentSequences checking/inference pair scans, skip lines containing only anchors/tags and pair the sequence with the nearest earlier opening key. Keep those property lines in the indentation-unit stack and leave aliases as content. Test own-line anchor, tag and combined forms for explicit policy, consistent drift and strict inference.
- seats: part-5/fable-3-1
- group: g6

### hyphen-safe-map-fix — Keep safe outer-hyphen fixes before explicit-indent mapping values

- file: scratchpad/effected/yaml/internal/rules/hyphen-spacing.ts:117
- class: bug   severity: required
- standard: EFFECTED_PORT_GOAL.md D9, D11, §14
- evidence: Source reading only; `YamlLint.fix` was not executed. After any later same-line `block-seq-entry`, the next same-line scalar matching an explicit-indent header sets `relocatesCollection` and the fix is omitted (`hyphen-spacing.ts:116-120`). For `"-   - item: |2\n    hello\n"` the outer hyphen has three spaces and the inner hyphen has one, so only the outer hyphen is diagnosed. The body is inside that one scalar token, so the later-line compact check never runs. Both the lexer (`lexer.ts:792-807`) and `findKeyIndent` (`composer/scalars.ts:1282-1296`) take the parent indent from the line's leading spaces, plus 2 because the line begins with `-` followed by a space. Deleting the two spaces after the first `-` leaves that count at 0, so `contentIndent` stays `2 + 2 = 4` (`composer/scalars.ts:1348`) and the body line is untouched. `"- - item: |2\n    hello\n"` decodes to the same `hello\n`. The same holds for `>2` and both chomp orders. The pinned oracle has no such withhold. The ledger row at `PORT_LEDGER.json` (`hyphen-spacing`, labBehaviour "fixes remain available when the scalar parent hyphen does not move") and `spacing-regressions.test.ts:108-142` cover a nested hyphen that itself parents `|2`/`>2`, which this input does not.
- failure: The port keeps the "Too many spaces after `-`" diagnostic and drops a value-preserving fix. Upstream applies it. The recorded deviation withholds the fix only when moving a hyphen changes the block scalar's parent indent.
- fix: Withhold an explicit-indent scalar fix only when the nearest separated structural indicator before the header, skipping whitespace/tag/anchor properties, is a hyphen affected by the deletion. A preceding colon does not withhold. Apply the safe -   - item: |2/>2 fix while preserving protection for -   - |2/>2, chomp orders and node properties, and the existing safe -   |2 fix. Assert decoded-value fidelity.
- seats: part-5/fable-3-2
- group: g7

### indent-bom-and-spaces — Measure YAML indentation in U+0020 and skip the stream BOM

- file: scratchpad/effected/yaml/internal/rules/indentation.ts:125
- class: bug   severity: required
- standard: EFFECTED_PORT_GOAL.md D9, D11, §14 (`upstream-bug`); YAML 1.2 `s-space` / `s-indent(n)` are U+0020; ECMA-262 `TrimString` treats U+FEFF as `WhiteSpace`
- evidence: Source reading only; the rule was not executed. `buildLines` leaves a stream BOM on the first line (`YamlLint.ts:217`). `indent` is `line.text.length - line.text.trimStart().length` (`indentation.ts:125`). `"\uFEFFname: Ada".trimStart()` drops the BOM, so the indent is 1 and `firstChar` is `n`. The tab skip does not apply. The pinned oracle uses the same formula (`packages/yaml/src/internal/rules/indentation.ts:72`) and the same BOM-preserving split (`packages/yaml/src/YamlLint.ts:153`). No indentation fixture uses a leading BOM. The closed `document-start-bom` row is the `---` insertion site (`documents-and-keys.test.ts:110`).
- failure: `"\uFEFFname: Ada\n"` with `{ spaces: 2 }` reports `Indent of 1 spaces, expected 2` on line 0, spanning the BOM. In consistent mode the first increase sets the unit to 1, and inference votes `spaces: 1`. A following real two-space child (`\uFEFFname: Ada\n  child: 1\n`) then matches that unit, so the file is accepted and learned as one-space indentation.
- fix: Count leading U+0020 spaces rather than trimStart whitespace. Exclude a single initial U+FEFF at offset 0 and carry that width into every probe offset, including token lookup and diagnostics. Retain tab-indented-line skipping. Add BOM diagnostics/consistent-inference tests and prevent NBSP or other non-YAML whitespace from counting as indentation.
- seats: part-5/fable-3-3
- group: g6

## Backlog

### internal-schema-roundtrip-properties — Add generated round trips for the internal schemas at S3

- file: scratchpad/effected/yaml/internal/options.ts:30
- class: test   severity: backlog
- standard: D10’s mandatory encode/decode round-trip property for every exported schema or codec; D11’s binding-law criterion; §11.4 property floor.
- evidence: A read-only search across `scratchpad/test/yaml/**/*.ts` found runtime references to `CstNode`, `ParseOptionsInput`, `StringifyOptionsInput`, `RawDirective`, and `RawYamlDocument` only in `internal/round-2-integration.test.ts`, which uses fixed `S.is` assertions. `RawDiagnostic` and `RawEdit` have no runtime schema references in the tests. None of these seven schemas has an `Arbitrary.schema` encode/decode round-trip property. Existing parser/diff properties exercise their algorithms, and `index.property.test.ts` covers barrel schemas rather than these new internal exports.
- failure: The runtime schemas introduced by the round-2 repair do not meet D10’s property floor. Green coverage and fixed validation examples do not establish the required generated codec round trips. This concerns newly added schema exports, rather than repeating the earlier property-floor finding for preexisting models.
- fix: At S3, add canonical generated encode/decode round trips for CstNode, ParseOptionsInput, StringifyOptionsInput, RawDirective, RawYamlDocument, RawDiagnostic and RawEdit, using Arbitrary.schema, schema equivalence and fcRuns. Retain existing fixed integration and algorithm properties.
- seats: part-2/sol-3-6

- reason: S3 property/coverage and vitest-canon work is deferred by the explicit merge instruction. This is a testing-floor request, not new parser/schema behavior evidence; no required group owns it.

## Handled by the deviation codemod

None. No standalone seat finding only requests recording identity keys, S.Finite, tagged errors, added exports or native-runtime replacements. Recording clauses embedded in actual required repairs are central bookkeeping, not extra required findings. The live YAML allowlist is already empty.

## Rejected

### anonymous-quote-kit — Do not require a named kit for the anonymous quote parameter

- file: scratchpad/effected/yaml/internal/requote.ts:118
- class: schema   severity: backlog
- standard: effect-laws-v1 law 19; effect-first-development EF-12b; operator rulings and D11
- evidence: part-2/fable-3-1 asks to give the inline quote parameter the same named LiteralKit treatment as RequoteMode. The source uses an anonymous inline two-character union; the cited law distinguishes named domains from anonymous inline unions. The named RequoteMode defect is retained in requote-schema-models.
- failure: No independently demonstrated required defect for naming this anonymous parameter.
- fix: Drop the mandatory named QuoteCharacter-kit request; retain the requote payload and named RequoteMode repair.
- seats: part-2/fable-3-1

- reason: The cited law permits anonymous inline domains; requiring a named LiteralKit for this parameter overstates law 19. Only this subclaim is rejected; the same seat contributes the required named-mode repair.

**Group ownership** (the exact source/test paths are in required.json):

| Group | Source files | Required findings | Repair surface |
| --- | ---: | ---: | --- |
| g1 | 6 | 5 | Public extraction, diagnostic materialization, AST parsing, regional equality, visitor streams |
| g2 | 1 | 1 | Invalid block-header lexer |
| g3 | 3 | 3 | CST roles and internal schema models |
| g4 | 2 | 4 | Folding and document stringification |
| g5 | 6 | 9 | Composer metadata, tags, keys, comments and flow validity |
| g6 | 6 | 6 | Scalar layout, key traversal and indentation rules |
| g7 | 1 | 2 | Hyphen safety and scaling |
| g8 | 1 | 2 | Document-end position and empty-document fidelity |
| g9 | 1 | 1 | Lint edit conflict selection |

Coordination: g1 and g5 must agree on where composed tag-handle failures are emitted; g1 owns the AST stream-parser pin. g4 exercises independent-parser stringify fidelity without editing the public-source group. g6/g7/g8 own separate rule tests. No source or test file is shared across groups; each group has at most six source files.

REQUIRED: 33  BACKLOG: 1  CODEMOD: 0  REJECTED: 1  GROUPS: 9
