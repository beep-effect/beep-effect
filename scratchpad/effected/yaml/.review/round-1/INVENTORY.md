# YAML — round-1 merged inventory

Read all 15 reports (`grok.md`, `sol.md`, `fable.md` in each of `part-1` through `part-5`) and all five adjacent briefs: 118 seat findings. All briefs pin review commit `3fa5876691901fccf3d1cd29e9324564df134b56` and upstream oracle `af7566a9da2eff169cb74955efcc5ede1e5de9f8`; evidence below is attributed to those reports, not a claim that their gates or benchmarks were rerun here. Grok parts 3 and 4 report `NO FINDINGS`.

Disposition records after deduplication and surface partitioning: **Required 77; Backlog 27; Handled by the deviation codemod 5; Rejected 4; Groups 11.** Counts describe merged records, not a sum of seat severities. Four required records are the operator-mandated YAML allowlist entries (`allow-1`–`allow-4`, all kind `new-map-set`).

The operator revision, both 2026-10-09 ruling blocks, D1–D20, sections 12.4–12.5 and 14 govern these dispositions. S2/S3 documentation, JSDoc, coverage, vitest canon and property-floor work stays backlog. Concrete scanner misses remain required despite declared-green gates. Bookkeeping portions of mixed reports are separated from substantive defects. Alternate fixes are rejected separately when the evidenced defect survives with a lawful fix.

Seat IDs are qualified by part because each report restarts its numbering. Duplicate observations at the same execution/model site are merged with all contributing IDs. Systemic reports are partitioned at distinct execution/model sites or disjoint schema surfaces when necessary to keep every group at six source files or fewer; this does not multiply duplicate reports of the same site. For example, node/formatter/stringifier guards affect separate walks, and schema/type companion omissions affect separate exported surfaces.

`required.json` owns every listed source/test file exactly once. New regression test paths are proposed files, not files created by this inventory. Source migrations are integrated in one wave: g1 owns map types/initializers, anchor API and tag lookups, while g4 owns the distinct directive tag-registration call; g3 owns stringifier error definitions and g1 owns the facade matching sites. These groups must land together before running the module gate. No group owns the root manifest, lockfile, configuration, standards registry, PORT_LEDGER or README Port notes. Allowlist retirement is central/outside-surface backlog; law-forced deviation and export records belong to the central codemod. Upstream-bug fixes must supply their reproduction/test references for central D9 recording before integration, without assigning ledger/Port-notes edits to a port lane.

| Group | Source files | Test/helper files | Required records |
| --- | ---: | ---: | ---: |
| g1 | 6 | 5 | 16 |
| g2 | 2 | 3 | 5 |
| g3 | 5 | 4 | 14 |
| g4 | 5 | 3 | 12 |
| g5 | 3 | 2 | 5 |
| g6 | 6 | 5 | 9 |
| g7 | 1 | 1 | 2 |
| g8 | 6 | 5 | 8 |
| g9 | 5 | 3 | 4 |
| g10 | 4 | 0 | 1 |
| g11 | 0 | 1 | 1 |

## Required

### yaml-comments

- file: scratchpad/effected/yaml/Yaml.ts:711
- class: bug   severity: required
- standard: D9; D11; section 14 upstream-bug
- evidence: Seat probes of both pinned oracle and lab: stripping `a: |\n  # literal content\n` removes scalar content, and equality becomes false; an apostrophe in `bob's` prevents a real comment being stripped.
- failure: The separate character scanner mistakes scalar data for comments and vice versa.
- fix: Remove only the lexer's actual comment-token spans. Add block-scalar and plain-apostrophe regressions; supply the upstream-bug evidence for central deviation recording.
- seats: part-1/sol-1-1
- group: g1

### yaml-typeof

- file: scratchpad/effected/yaml/Yaml.ts:936
- class: law   severity: required
- standard: effect-laws-v1 law 5; D11
- evidence: A reachable `typeof a !== typeof b` survives; NoNativeRuntime recognizes only comparisons with a string literal. Later array/object guards already reject mismatched types.
- failure: A concrete native-runtime gate miss in value equality.
- fix: Delete the redundant typeof-versus-typeof check, preserving equality cases.
- seats: part-1/fable-1-5
- group: g1

### node-guards

- file: scratchpad/effected/yaml/YamlNode.ts:413,614
- class: perf   severity: required
- standard: D11 measured regression; schema-derived guards
- evidence: Pinned-oracle benchmark: 5,000-scalar sequence, 100 extraction calls, oracle/port 3.10/44.12 ms and 2.92/44.69 ms; independent document probes find 13–20x extraction/search slowdowns. S.is is rebuilt inside each walk.
- failure: Value extraction and navigation repeatedly construct guards instead of reusing them.
- fix: Derive Scalar/Map/Seq/Alias guards once after the class declarations and reuse them in toValue, findByPath, pathToNode and offset navigation; retain schema-backed semantics and repeat the reported benchmark.
- seats: part-1/sol-1-4, part-1/fable-1-1, part-3/fable-1-4
- group: g1

### node-literal-kits

- file: scratchpad/effected/yaml/YamlNode.ts:25,45,63,86,101
- class: schema   severity: required
- standard: effect-laws-v1 law 19; EF-35; D5
- evidence: ScalarStyle, CollectionStyle, QuoteStyle, QuoteCompat and ScalarChomp are named annotated S.Literals values; ScalarStyle probe lacks Enum/is/$match.
- failure: Named node/style domains have not received the mandatory LiteralKit modeling pass; green gates did not cover it.
- fix: Use equivalently annotated LiteralKit values with the same literals, value names and derived type names.
- seats: part-1/sol-1-5
- group: g1

### node-identity

- file: scratchpad/effected/yaml/YamlNode.ts:276
- class: schema   severity: required
- standard: Operator revision step 4; D5; EF-12
- evidence: The exported suspended recursive union is bare; the reported runtime probe finds ast.annotations undefined.
- failure: The public union lacks its composer-derived schema identity.
- fix: Apply $I.annoteSchema("YamlNode", { description: ... }) to the suspended union, retaining its recursive codec type.
- seats: part-1/sol-1-6
- group: g1

### alias-error

- file: scratchpad/effected/yaml/YamlNode.ts:544; scratchpad/effected/yaml/Yaml.ts:335,378,919
- class: schema   severity: required
- standard: effect-laws-v1 law 7; EF-1; D5
- evidence: AliasExpansionBudgetExceeded is exported, thrown by nodeToValue and caught by Yaml.ts; it extends Data.TaggedError, has no identity annotations and is not a schema.
- failure: The cross-module error violates the required schema-backed error contract.
- fix: Define an identity/field-annotated S.TaggedError preserving the tag, message, name and upstream positional constructor behavior where lawful; update construction and Yaml.ts catches to hoisted schema guards. Pin catchability and budget messages in tests; central codemod records any forced shape change.
- seats: part-1/sol-1-7, part-1/fable-1-7, part-3/fable-1-7
- group: g1

### anchor-boundary

- file: scratchpad/effected/yaml/internal/composer/anchors.ts:144,179; scratchpad/effected/yaml/YamlNode.ts:590
- class: law   severity: required
- standard: effect-laws-v1 law 6; later ruling: YAML anchors -> MutableHashMap
- evidence: buildAnchorMap returns anchors.backing; getNodeValue advertises Map and dispatches with instanceof Map; YamlNode extraction takes and mutates Map. NoNativeRuntime scans constructors, so these boundary sites escape its green gate.
- failure: The Effect wrapper is discarded and a public native anchor collection remains.
- fix: Return and pass MutableHashMap values through buildAnchorMap, getNodeValue, nodeToJsValue and every node toValue implementation; replace native has/get/set with Effect operations and test sequential duplicate-anchor resolution. The g1 state fix and allow-2/allow-3 complete the same migration; remove the unforced getNodeValue dual rather than retaining its Map predicate.
- seats: part-3/fable-1-5, part-4/sol-1-8, part-4/fable-1-5
- group: g1

### composer-map-state

- file: scratchpad/effected/yaml/internal/composer/state.ts:167,177,198,207; scratchpad/effected/yaml/internal/composer/anchors.ts:44,71,79; scratchpad/effected/yaml/internal/composer/tags.ts:29,42,50
- class: law   severity: required
- standard: effect-laws-v1 law 6; later native-collection ruling
- evidence: createState probe confirms native Map for both anchors and tagMap; initializers deliberately retain MutableHashMap.empty().backing. Anchor and tag consumers use native methods.
- failure: Two separate composer structures still use native maps through an implementation-field escape.
- fix: Store MutableHashMap in ComposerState.anchors and tagMap, retain wrappers in createState, use MutableHashMap.has/set/get in anchors.ts and tags.ts, and unwrap lookup Options explicitly. Keep the document.ts tag-registration site assigned to composer-tag-registration (g4); coordinate both groups in one fix wave.
- seats: part-3/fable-1-5, part-4/sol-1-8, part-4/fable-1-5
- group: g1

### anchor-guards

- file: scratchpad/effected/yaml/internal/composer/anchors.ts:153,161
- class: perf   severity: required
- standard: D11 measured regression
- evidence: The seat identifies three fresh schema-guard sites in collectAnchors; composer benchmark is 315 vs 189 ms with lexer/CST near parity, and the isolated repeated guard costs 64.3 ns vs 28 ns hoisted.
- failure: Collecting anchors rebuilds schema guards for each AST node.
- fix: Hoist the schema-derived guards locally and reuse them; preserve collected anchors and extraction results.
- seats: part-3/fable-1-3
- group: g1

### state-model

- file: scratchpad/effected/yaml/internal/composer/state.ts:114
- class: schema   severity: required
- standard: schema-first-development-prompt: Schema owns pure data
- evidence: NodeMeta is a handwritten concrete payload interface carrying optional anchor/tag/comment fields, separate from the callable FlowComposers service contract.
- failure: The mutable metadata payload is not derived from a schema.
- fix: Define an annotated structural schema and derive NodeMeta, retaining optional and writable keys. Leave the callable FlowComposers contract alone.
- seats: part-4/sol-1-10
- group: g1

### state-option-spreads

- file: scratchpad/effected/yaml/internal/composer/state.ts:142
- class: perf   severity: required
- standard: D11 measured regression; law 21
- evidence: commentProps makes three separate single-field getSomesStruct calls. Six-field microbenchmark: separate calls 213 ns, one combined call 59 ns, upstream spreads 110 ns.
- failure: Redundant Option/record allocations at each node rebuild.
- fix: Consolidate the three optional comment fields into one getSomesStruct call with identical omission behavior.
- seats: part-4/fable-1-2
- group: g1

### restore-composer-core

- file: scratchpad/effected/yaml/internal/composer/anchors.ts:25; scratchpad/effected/yaml/internal/composer/state.ts:42; scratchpad/effected/yaml/internal/composer/tags.ts:19
- class: law   severity: required
- standard: Later ruling: restore unforced upstream shape; D9
- evidence: The report identifies internal composer helpers wrapped in dual without any running gate requiring it: state lineCol/createState and tags resolveTagHandle; the same rewrite covers anchors helpers. Measured createState 50 vs 26 ns and lineCol 25 vs 12 ns.
- failure: Unforced callable shape and dispatch changes in the core composer helpers.
- fix: Restore the pinned oracle's plain function signatures/defaults and bodies in anchors.ts, state.ts and tags.ts, retaining required native-runtime/schema changes. Restore any upstream test lines changed solely for these new curried forms; use the g1-owned core regression test.
- seats: part-4/fable-1-3, part-3/fable-1-5
- group: g1

### format-nonfinite-error

- file: scratchpad/effected/yaml/YamlFormat.ts:127,951,968,974,1005
- class: bug   severity: required
- standard: D9; D11; law-forced finite-number migration
- evidence: The report traces non-finite YamlPath indices into YamlModificationError.make: S.Finite validation throws, turning navigation/multi-document failures into defects missed by catchTag.
- failure: A law-forced representation change broke typed failure construction; this is substantive, not deviation bookkeeping.
- fix: Keep finite numeric schemas. Add an annotated tagged non-finite-index representation with a LiteralKit kind (NaN/PositiveInfinity/NegativeInfinity); normalize only echoed error paths to that representation before every error.make and include it in the path schema. Render these tags as their original numeric spelling. Add NaN/±Infinity failure/catchTag regressions; do not restore unrestricted S.Number or weaken schema-number.
- seats: part-1/grok-1-1
- group: g2

### format-guards

- file: scratchpad/effected/yaml/YamlFormat.ts:210,442,597,665,715
- class: perf   severity: required
- standard: D11 measured regression
- evidence: Format/requote probes: 431 vs 280 ms; insert-key modification 322 vs 160 ms. Per-pair findIndex callbacks rebuild S.is; guard microbenchmarks show about 3x improvement from hoisting.
- failure: Measured constant-factor regression in formatting and modification walks.
- fix: Derive Scalar/Map/Seq guards once at module scope in YamlFormat.ts and use them in recursive functions and callbacks; repeat the reported probes.
- seats: part-1/fable-1-2, part-1/sol-1-4
- group: g2

### modify-error-schema

- file: scratchpad/effected/yaml/YamlFormat.ts:142
- class: law   severity: required
- standard: effect-laws-v1 law 7; D5; error-handling pattern
- evidence: ModifyFailure extends Data.TaggedError without identity/schema metadata; eight construction sites and its catch remain outside the green checks.
- failure: The navigation failure model violates the typed-error law.
- fix: Use an annotated S.TaggedError with a named LiteralKit code domain and finite offset/length fields; preserve its message/codes, update construction and use a hoisted schema guard at the catch.
- seats: part-1/fable-1-6
- group: g2

### edit-sort

- file: scratchpad/effected/yaml/YamlEdit.ts:80
- class: law   severity: required
- standard: effect-laws-v1 law 10
- evidence: [...edits].sort remains reachable; NoNativeRuntime emits native-sort only in its hotspot scope, which excludes this lab.
- failure: Edit application uses explicitly forbidden native sorting despite green gates.
- fix: Use A.sort with reverse numeric offset Order and preserve stable ties and the non-mutating input contract.
- seats: part-1/sol-1-8, part-1/fable-1-4
- group: g2

### restore-render-helpers

- file: scratchpad/effected/yaml/internal/fold.ts:41,98,209,270,336; scratchpad/effected/yaml/internal/diff.ts:32; scratchpad/effected/yaml/internal/equal.ts:23; scratchpad/effected/yaml/internal/requote.ts:79
- class: law   severity: required
- standard: Later unforced-change ruling; D9; Dual-Arity Inventory Contract
- evidence: Eight upstream plain function declarations were wrapped in dual without an enforcing gate. renderBlockLiteral("hello", "  ") returns a function in the lab instead of "|-\n  hello"; folded rendering has the same optional-argument break.
- failure: Unforced signatures and dispatch regress from the pinned oracle.
- fix: Restore all eight upstream plain function signatures, optional parameters/defaults and bodies in fold/diff/equal/requote, retaining diagnostic- or law-required substitutions. Restore any upstream test lines rewritten for their added data-last shape; add optional-argument regressions.
- seats: part-2/sol-1-1, part-2/fable-1-2
- group: g3

### fold-newline

- file: scratchpad/effected/yaml/internal/fold.ts:444
- class: bug   severity: required
- standard: D11; section 14 verified upstream-bug
- evidence: Both oracle and lab render " a\nb" in folded style as a value with an extra newline; the independent yaml parser agrees.
- failure: A more-indented-to-normal transition corrupts scalar content.
- fix: Add !prevMoreIndented to the compensation-blank-line condition; pin the failing value round trip and supply the verified upstream-bug evidence.
- seats: part-2/sol-1-2
- group: g3

### fold-boolean-iifes

- file: scratchpad/effected/yaml/internal/fold.ts:312,376
- class: effect-idiom   severity: required
- standard: effect-laws-v1 law 21; strict-boolean-expressions
- evidence: Two immediate lambdas ((value) => value === true)(firstContent?.startsWith(" ")) wrap a single comparison; cst-parser already uses direct === true and green terse-effect did not find these.
- failure: Trivial allocated wrapper lambdas violate the tersest equivalent helper form.
- fix: Replace both with firstContent?.startsWith(" ") === true.
- seats: part-2/fable-1-1
- group: g3

### fold-error-identity

- file: scratchpad/effected/yaml/internal/fold.ts:14
- class: schema   severity: required
- standard: Operator step 4; EF-12
- evidence: FoldFailure uses $I only for identity and omits schema annotation metadata and its message-field semantics.
- failure: The error schema's required identity/field annotations are incomplete.
- fix: If FoldFailure remains after the local fix, add meaningful $I.annote and message.annotateKey metadata without changing tag/message; do not remove guards just to satisfy coverage.
- seats: part-2/sol-1-8, part-2/fable-1-10
- group: g3

### equal-typeof

- file: scratchpad/effected/yaml/internal/equal.ts:29
- class: law   severity: required
- standard: effect-laws-v1 law 5
- evidence: typeof-versus-typeof survives because the detector recognizes only string-literal comparisons; subsequent array/object branches already decide every mismatch.
- failure: A concrete native-runtime scanner miss remains even in an unused upstream file.
- fix: Delete the redundant typeof comparison. Retain the upstream module/export under D2.
- seats: part-2/fable-1-5
- group: g3

### restore-stringifier-api

- file: scratchpad/effected/yaml/internal/stringifier.ts:302,1956,1973
- class: law   severity: required
- standard: Later unforced-change ruling; D9; optional-options exemption
- evidence: stringifyValue({finalNewline:false}) serializes the options object rather than returning the promised curried function; pipe use throws TypeError. stringifyDocument sniffs contents; upstream declares plain functions, including renderDoubleQuoted.
- failure: Unforced dual APIs introduce ambiguous/shadowed overloads and duck dispatch.
- fix: Restore plain data-first stringifyValue(value, options?), stringifyDocument(doc, options?) and renderDoubleQuoted(s, canonical=false) from the pinned oracle, retaining required body changes. Restore any test lines rewritten for new curried forms.
- seats: part-3/sol-1-1, part-3/fable-1-10
- group: g3

### stringifier-bigint

- file: scratchpad/effected/yaml/internal/stringifier.ts:1139
- class: bug   severity: required
- standard: D11; section 14 verified upstream-bug
- evidence: Both versions compose n: 9007199254740993 as bigint but AST stringify emits a quoted string; reparsing changes its value type, also at root and in sequences.
- failure: AST rendering loses large-integer fidelity.
- fix: Before string/fallback branches, handle P.isBigInt and emit preserved numeric spelling or the bigint string without quotes. Add root/map/sequence document round-trip regressions.
- seats: part-3/sol-1-2
- group: g3

### stringifier-depth

- file: scratchpad/effected/yaml/internal/stringifier.ts:1009
- class: bug   severity: required
- standard: D11; section 14 verified upstream-bug; nesting-depth contract
- evidence: A 50,000-deep synthetic AST produces StringifyDepthExceeded normally, but RangeError in canonical mode because stripNodeComments recurses before the guarded renderer.
- failure: Canonical preprocessing bypasses the nesting-depth guarantee.
- fix: Thread a depth counter into stripNodeComments and throw StringifyDepthExceeded at MAX_NESTING_DEPTH before descending. Add canonical preprocessing depth regressions.
- seats: part-3/sol-1-3
- group: g3

### stringifier-errors

- file: scratchpad/effected/yaml/internal/stringifier.ts:39,47,63
- class: schema   severity: required
- standard: effect-laws-v1 law 7; EF-1/EF-12; D5
- evidence: StringifyFailure and StringifyDepthExceeded are Data.TaggedError classes; S.isSchema probes return false. StringifierInvariantFailure lacks its schema annotation.
- failure: Cross-module errors lack required schema identities; invariant metadata is incomplete.
- fix: Use identity/field-annotated S.TaggedError classes, preserving reason/message/name and upstream construction semantics where lawful; annotate StringifierInvariantFailure. Use .make at internal construction sites as required. The public facade catch migration is stringify-error-catches (g1), not an extra source owner here.
- seats: part-3/sol-1-4, part-3/fable-1-7
- group: g3

### stringifier-sort

- file: scratchpad/effected/yaml/internal/stringifier.ts:731,1404
- class: law   severity: required
- standard: effect-laws-v1 law 10; EF-38
- evidence: keys.sort and items.sort remain in both sortKeys paths; scanner's hotspot restriction excludes scratchpad/effected.
- failure: Value and AST renderers still execute forbidden native sorts.
- fix: Use A.sort with Order.String and equivalent mapInput Order for pairs; preserve key coercion, non-scalar fallback and stable ties.
- seats: part-3/sol-1-5, part-3/fable-1-6
- group: g3

### stringifier-dispatch

- file: scratchpad/effected/yaml/internal/stringifier.ts:447
- class: perf   severity: required
- standard: D11 measured regression; D9
- evidence: 40k strings: record 44.7 vs 12.2 ms, array 14.3 vs 4.1 ms, while number-array control is 1.06x. Rebuilt five-arm Match dispatch costs 72.3 ns vs 1.2 ns if dispatch; outputs match.
- failure: Per-scalar matcher allocation causes a measured 2.5–3.5x public stringification regression.
- fix: Build the style dispatch once at module scope (handlers accept a record carrying dynamic scalar/context arguments), or use an equivalent schema/data dispatch table; avoid rebuilding Match and its closures for each scalar. Verify byte parity and repeat the seat benchmark. A measured if-chain tradeoff must cite this evidence if chosen.
- seats: part-3/fable-1-1
- group: g3

### stringifier-indicators

- file: scratchpad/effected/yaml/internal/stringifier.ts:243
- class: perf   severity: required
- standard: D11 measured regression; law 6
- evidence: Indicator HashSet membership costs 12.4 vs 1.4 ms per million checks; numeric-record rendering 21.9 vs 6.7 ms isolates the string-key path.
- failure: A measured membership regression affects every plain scalar/key.
- fix: Represent the same indicator characters once as a string and use effect/String includes, handling the empty first character explicitly so empty-string membership cannot change semantics.
- seats: part-3/fable-1-2
- group: g3

### stringifier-guards

- file: scratchpad/effected/yaml/internal/stringifier.ts:947,1009,1073,1176,1276
- class: perf   severity: required
- standard: D11 measured regression
- evidence: 37 per-call guard constructions; isolated Scalar guard 64.3 ns rebuilt vs 28 ns hoisted, with document rendering 88.3 vs 25.5 ms.
- failure: Repeated schema guard factories inflate every AST walk.
- fix: Hoist the four class guards once in stringifier.ts and reuse them throughout rendering, tag normalization and comment stripping; retain schema-derived semantics.
- seats: part-3/fable-1-3, part-1/sol-1-4
- group: g3

### stringify-error-catches

- file: scratchpad/effected/yaml/Yaml.ts:281; scratchpad/effected/yaml/YamlDocument.ts:188,206
- class: effect-idiom   severity: required
- standard: law 7 migration; tsgo instanceOfSchema; D9
- evidence: Facades match StringifyFailure/StringifyDepthExceeded with instanceof while reading reason/message; the required S.TaggedError conversion makes these schema-class instance checks diagnostic-bearing.
- failure: Facade error handlers must remain typed and catch the migrated errors in the same fix wave.
- fix: Hoist S.is guards for the migrated stringifier error classes and replace their instanceof catch tests in Yaml.ts/YamlDocument.ts; retain reason/message and fatal-diagnostic mappings.
- seats: part-3/sol-1-4, part-3/fable-1-7
- group: g1

### restore-composer-walks

- file: scratchpad/effected/yaml/internal/composer/comments.ts:67; scratchpad/effected/yaml/internal/composer/document.ts:214; scratchpad/effected/yaml/internal/composer/flow.ts:177; scratchpad/effected/yaml/internal/composer/scalars.ts:103; scratchpad/effected/yaml/internal/composer/block.ts:77
- class: law   severity: required
- standard: Later unforced-change ruling; D9
- evidence: Upstream resolveScalar(raw,style,tag?,state?) accepts two/three arguments; dual(4) returns a function and makes optional parameters mandatory. More than forty internal helpers gained unrequired dual wrappers; resolveScalar micro 47 vs 2 ns.
- failure: The composer walk helpers acquired unforced API changes and measurable dispatch cost.
- fix: Restore plain upstream function declarations/defaults throughout these five files, retaining law/diagnostic-required body changes and injected FlowComposers seams forced by import-cycle diagnostics. Restore upstream tests rewritten only for the added currying; add resolveScalar two/three-argument regressions. No checker/config edits belong to this group.
- seats: part-4/sol-1-7, part-4/fable-1-3
- group: g4

### composer-tag-registration

- file: scratchpad/effected/yaml/internal/composer/document.ts:295
- class: law   severity: required
- standard: effect-laws-v1 law 6; later native-map ruling
- evidence: %TAG processing uses state.tagMap.set; the state currently obtains a native Map through .backing, missed by the constructor-only scanner.
- failure: Directive registration still uses native collection methods.
- fix: Replace this registration site with MutableHashMap.set, coordinated with composer-map-state's tagMap schema/type/initializer and tags.ts lookups. Add directive-resolution regression coverage in this group's test.
- seats: part-3/fable-1-5, part-4/sol-1-8, part-4/fable-1-5
- group: g4

### composer-verbatim-indent

- file: scratchpad/effected/yaml/internal/composer/scalars.ts:869
- class: bug   severity: required
- standard: D11; section 14 verified upstream-bug
- evidence: outer/key with a separately placed !<tag:yaml.org,2002:str>, |2 and hello parses as an empty string in lab/oracle; yaml reference yields hello\n. Replacing the tag with !!str avoids failure.
- failure: findParentIndent interprets a tag URI colon as a mapping delimiter and discards block content.
- fix: Skip tag/property spans in backward structural-colon/sequence-indicator search; add the verbatim-tag block-scalar regression.
- seats: part-4/sol-1-1
- group: g4

### flow-missing-comma

- file: scratchpad/effected/yaml/internal/composer/flow.ts:72
- class: bug   severity: required
- standard: D11; section 14 verified upstream-bug
- evidence: Both versions accept {foo: 1 bar: 2} as {foo:'1 bar','':2}; yaml reference rejects BLOCK_IN_FLOW. The second colon resets contentAfterColon.
- failure: Malformed flow maps are accepted with invented keys.
- fix: Detect a second structural separator inside a populated comma-delimited entry, keeping nested collection separators scoped; pin rejection without rejecting valid nested/quoted scalar colons.
- seats: part-4/sol-1-2
- group: g4

### flow-continuations

- file: scratchpad/effected/yaml/internal/composer/flow.ts:90
- class: bug   severity: required
- standard: D11; section 14 verified upstream-bug
- evidence: Both versions reject {foo: multi\n  line} and [foo: multi\n  line] with Missing comma; yaml reference and recovered AST yield the correct folded scalar.
- failure: Valid multiline scalar fragments are counted as separate flow entries.
- fix: Use the scalar collector's continuation boundaries to count a folded scalar once, retaining genuine missing-comma rejection; add both map/implicit-sequence regressions.
- seats: part-4/sol-1-3
- group: g4

### tag-percent-decoding

- file: scratchpad/effected/yaml/internal/composer/tags.ts:44
- class: bug   severity: required
- standard: D11; section 14 verified upstream-bug
- evidence: %TAG !e! tag:yaml.org,2002: followed by !e!%69nt 123 returns string in lab/oracle and number in yaml reference; !e!int already resolves to number.
- failure: Equivalent shorthand suffix encodings resolve differently.
- fix: Safely percent-decode the suffix before concatenating its prefix, including the default secondary handle; return positioned composer diagnostics for malformed encodings. Add equivalence/malformed regressions in the g1-owned core test.
- seats: part-4/sol-1-4
- group: g1

### directive-validation

- file: scratchpad/effected/yaml/internal/composer/document.ts:783
- class: bug   severity: required
- standard: D11; section 14 verified upstream-bug
- evidence: Lab/oracle accept %YAML nope, %TAG !!, and a %TAG with an extra parameter; independent yaml reports malformed version/arity.
- failure: Malformed directives lack fatal diagnostics.
- fix: Validate YAML version-token grammar and exactly two TAG parameters; emit positioned InvalidDirective diagnostics and add the three regressions.
- seats: part-4/sol-1-5
- group: g4

### composer-guards

- file: scratchpad/effected/yaml/internal/composer/comments.ts:167,292; scratchpad/effected/yaml/internal/composer/document.ts:696,991
- class: perf   severity: required
- standard: D11 measured regression
- evidence: 2,349-node document: composition 16.9 vs 7.3 ms, with CST 1.13x; isolated guard 59.2 ns rebuilt vs 18.4 ns hoisted. Fourteen concrete comments/document guard sites are identified.
- failure: Every parse/format/lint rebuilds schema guards during composition.
- fix: Derive module-local class guards once in comments.ts/document.ts and reuse them in all node walks and rebuilds; preserve behavior and rerun reported measurements.
- seats: part-4/fable-1-1
- group: g4

### composer-option-spreads

- file: scratchpad/effected/yaml/internal/composer/comments.ts:296; scratchpad/effected/yaml/internal/composer/document.ts:484; scratchpad/effected/yaml/internal/composer/flow.ts:236; scratchpad/effected/yaml/internal/composer/scalars.ts:1221
- class: perf   severity: required
- standard: D11 measured regression; law 21
- evidence: Six separate optional-field lifts cost 213 ns vs 59 ns for one combined getSomesStruct; per-node rebuilds contribute to composition's 2.31x slowdown.
- failure: Multiple redundant Option/record passes per construction.
- fix: Consolidate optional fields into one getSomesStruct per construction in these four files; preserve omission and class field values. State's separate commentProps site is state-option-spreads.
- seats: part-4/fable-1-2
- group: g4

### composer-schema-alias

- file: scratchpad/effected/yaml/internal/composer/comments.ts:48; scratchpad/effected/yaml/internal/composer/document.ts:34
- class: law   severity: required
- standard: effect-laws-v1 law 1; EF-4
- evidence: Both files import effect/Schema as Schema; green dedicated-path import checks fail to enforce the required alias.
- failure: Canonical Schema namespace aliases are violated.
- fix: Rename imports and references to S in these two files, coordinating guard hoisting.
- seats: part-4/sol-1-9, part-4/fable-1-4
- group: g4

### composer-payload-models

- file: scratchpad/effected/yaml/internal/composer/comments.ts:53,277; scratchpad/effected/yaml/internal/composer/flow.ts:546
- class: schema   severity: required
- standard: schema-first-development-prompt: Schema owns pure data
- evidence: CommentFields, EscapedComment and PendingFlowComment are named, concrete handwritten interfaces; no runtime schemas define them.
- failure: Payload types cannot supply derived guards/annotations from one schema source.
- fix: Use annotated structural schemas and derive the three types; preserve mutable keys, optionality and existing field representations. NodeMeta is separately owned by state-model.
- seats: part-4/sol-1-10
- group: g4

### semantic-item-model

- file: scratchpad/effected/yaml/internal/composer/block.ts:204; scratchpad/effected/yaml/internal/composer/flow.ts:248
- class: schema   severity: required
- standard: effect-laws-v1 law 20; EF-13/EF-33
- evidence: SemanticItem is an interface with four kind variants but independent optional node/comment/offset payloads, forcing downstream presence recovery.
- failure: Impossible combinations are representable in the semantic composition stream.
- fix: Define an annotated discriminated schema union using existing kind values; retain intentional node-less explicit-key markers and empty-value behavior. Adjust block/flow producers and consumers locally to the derived type.
- seats: part-3/sol-1-7
- group: g4

### block-guards

- file: scratchpad/effected/yaml/internal/composer/block.ts:1151,1326
- class: perf   severity: required
- standard: D11 measured regression
- evidence: Three block guard construction sites share the isolated 64.3 vs 28 ns cost; composition measures 315 vs 189 ms with CST/lexer near parity.
- failure: Repeated guard construction in key checks contributes to measured composition overhead.
- fix: Hoist and reuse schema-derived Scalar/Map/Seq guards locally in block.ts; retain key identities and duplicate-key outcomes.
- seats: part-3/fable-1-3
- group: g4

### lint-native-sort

- file: scratchpad/effected/yaml/YamlLint.ts:296,297,444,527
- class: law   severity: required
- standard: effect-laws-v1 law 10
- evidence: Four native sorts remain; the scanner checks native-sort only within hotspot scope and excludes this lab.
- failure: Vote/floor normalization, conflict ordering and diagnostics violate the sort law.
- fix: Use A.sort and equivalent explicit Orders for every sort, preserving lexicographic rule/dimension/key ties, descending counts and diagnostic position order.
- seats: part-1/sol-1-8, part-1/fable-1-3
- group: g5

### lint-json-codec

- file: scratchpad/effected/yaml/YamlLint.ts:379
- class: law   severity: required
- standard: EF-3 schema JSON codecs; D11
- evidence: YamlStyleConflictError.message calls native JSON.stringify(c.value) on each candidate in the green commit without an exception.
- failure: The conflict renderer violates the schema JSON serialization standard.
- fix: Bind a schema JSON codec for the existing string/finite-number/boolean candidate domain and use its synchronous Result encoder; preserve existing JSON spelling and recover safely from codec failure.
- seats: part-1/sol-1-9
- group: g5

### lint-object-guard

- file: scratchpad/effected/yaml/YamlLint.ts:60,65,413,496,520
- class: effect-idiom   severity: required
- standard: effect-laws-v1 law 21
- evidence: Five copies of P.isObjectKeyword(entry) && !P.isFunction(entry); Effect's P.isObjectOrArray has the same truth table and narrowing, while terse-effect missed it.
- failure: The equivalent named Effect guard is obscured by a repeated two-call helper expression.
- fix: Use P.isObjectOrArray at all five sites; preserve arrays/object narrowing and rejection of functions.
- seats: part-1/fable-1-8
- group: g5

### lint-severity-kit

- file: scratchpad/effected/yaml/YamlLintRule.ts:24
- class: schema   severity: required
- standard: effect-laws-v1 law 19; D5
- evidence: YamlLintSeverity is a named annotated S.Literals value rather than LiteralKit.
- failure: A reused severity domain misses the named-literal modeling contract.
- fix: Use an annotated LiteralKit with error/warning, preserving the same-name type.
- seats: part-1/sol-1-5
- group: g5

### catalog-collection

- file: scratchpad/effected/yaml/internal/rules/catalog.ts:56; scratchpad/effected/yaml/YamlLint.ts:66
- class: effect-idiom   severity: required
- standard: effect-laws-v1 laws 6/21; later native-collection ruling
- evidence: A 24-line ReadonlyMap facade wraps HashMap plus an order array; the only consumer calls .get in YamlLint. No index export requires the native interface.
- failure: An internal native collection contract is retained behind unnecessary delegation.
- fix: Export the HashMap directly and use HashMap.get plus explicit Option handling in YamlLint; remove the facade. If retaining any promised catalog iteration, expose the existing ordered catalog separately rather than relying on hash iteration.
- seats: part-4/fable-1-7
- group: g5

### token-kind-and-model

- file: scratchpad/effected/yaml/internal/token.ts:6,35; scratchpad/effected/yaml/YamlToken.ts:26
- class: schema   severity: required
- standard: effect-laws-v1 laws 17/19; EF-12b/EF-33; D5
- evidence: The internal 22-kind handwritten union is duplicated by public S.Literals; raw token payload is a plain interface. The seat notes validating .make per token would add substantial lexer cost.
- failure: Duplicated literal truth and a non-schema internal data model.
- fix: Define the kind domain once with an annotated LiteralKit and raw token payload as an annotated S.Struct; derive types and reuse the kind domain in the public token schema. Preserve value/column vs public text/character fields; construct plain typed literals in the lexer without adding per-token validation.
- seats: part-1/sol-1-5, part-3/sol-1-6, part-3/fable-1-8, part-3/fable-1-12
- group: g6

### token-cr-positions

- file: scratchpad/effected/yaml/YamlToken.ts:94; scratchpad/effected/yaml/internal/lexer.ts:97
- class: bug   severity: required
- standard: D11; section 14 verified upstream-bug
- evidence: a: 1\rb: 2\r reports b at line 0/column 5 in both versions; diagnostics report line 1/column 0. Lexer emits CR newline tokens but advance/setPosition only count LF.
- failure: Lone-CR line/column and indentation-state handling are wrong in both scanner and promoted tokens.
- fix: Count lone CR and CRLF once in advance/setPosition and reset applicable line state; build the public token line-start index with the same convention. Add scanner-reset and public-token CR/CRLF regressions.
- seats: part-1/sol-1-3, part-2/sol-1-6
- group: g6

### lexer-trailing-whitespace

- file: scratchpad/effected/yaml/internal/lexer.ts:389
- class: bug   severity: required
- standard: D11; section 14 verified upstream-bug; CST fidelity contract
- evidence: parseCSTAll('hello  ')[0].source is 'hello' and the mapping variant drops trailing EOF spaces in lab/oracle. scanPlainScalar consumes whitespace but computes a trimmed token span.
- failure: Consumed source whitespace is absent from token/CST spans.
- fix: Rewind pos/col by trailing whitespace after determining the trimmed scalar end, letting the next scan emit whitespace separately; retain trimmed scalar values and add EOF source-fidelity regressions.
- seats: part-2/sol-1-5
- group: g6

### cst-compact-events

- file: scratchpad/effected/yaml/internal/cst-visitor.ts:352
- class: bug   severity: required
- standard: D11; section 14 verified upstream-bug
- evidence: For - a: 1\n- b: 2, AST keys are a,b but CST keys are 1,2; compact block-map children include their first key while walker assumes it was emitted outside.
- failure: CST visitor swaps key/value classification for compact mappings in sequences.
- fix: Pass/derive whether the first key is external and initialize expectingKey appropriately, retaining sibling-key behavior; add AST/CST projection regressions.
- seats: part-2/sol-1-3
- group: g6

### cst-empty-values

- file: scratchpad/effected/yaml/internal/cst-visitor.ts:365
- class: bug   severity: required
- standard: D11; section 14 verified upstream-bug
- evidence: a:\nb: 2 and {a: , b: 2} emit b as value and 2 as key in lab/oracle; structural separators are skipped before state advances for empty values.
- failure: Omitted values shift all subsequent key/value events.
- fix: Update map walker state from entry boundaries/separators before skipping structural nodes; account for omitted block and flow values and pin both regressions.
- seats: part-2/sol-1-4
- group: g6

### visitor-event-schema

- file: scratchpad/effected/yaml/YamlVisitor.ts:34,85
- class: schema   severity: required
- standard: EF-33; schema-first-development-prompt; D5/D11
- evidence: Event payloads are defined only by a Data.TaggedEnum type literal and runtime constructors/matchers, with no executable payload schema.
- failure: The concrete public event vocabulary has no schema source of truth.
- fix: Define an identity/field-annotated S.TaggedUnion for the existing shapes; derive YamlVisitorEvent and keep Data.taggedEnum as the constructor/matcher surface for structural equality and names.
- seats: part-2/sol-1-7
- group: g6

### cst-error-identity

- file: scratchpad/effected/yaml/internal/cst-parser.ts:17
- class: schema   severity: required
- standard: Operator step 4; EF-12
- evidence: CstParserFailure has a composer-derived identifier but lacks schema and message-field metadata.
- failure: The identity pass is incomplete for this typed error.
- fix: Add meaningful $I.annote and message.annotateKey metadata if the error survives, preserving its tag/throwing behavior.
- seats: part-2/sol-1-8, part-2/fable-1-10
- group: g6

### cst-token-dispatch

- file: scratchpad/effected/yaml/internal/cst-parser.ts:150
- class: effect-idiom   severity: required
- standard: AGENTS match preference; effect-laws-v1 laws 11/23
- evidence: Upstream kind switch became a 15-arm if/else ladder, each arm returning makeLeafNode; the switch-only scanner misses it.
- failure: A kind-to-node-type data mapping is encoded as a long conditional chain.
- fix: Use a typed exhaustive module-level kind-to-node-type table or Match dispatch, retaining every token kind, source span and upstream comment.
- seats: part-2/fable-1-3
- group: g6

### lexer-escape-dispatch

- file: scratchpad/effected/yaml/internal/lexer.ts:448
- class: effect-idiom   severity: required
- standard: AGENTS match preference; effect-laws-v1 laws 11/23
- evidence: A 22-arm escape switch became an approximately 100-line conditional chain; seventeen arms are static character substitutions.
- failure: Lexer escape data is obscured by repetitive dispatch code outside the scanner's reach.
- fix: Hoist simple escape characters into a typed Record/HashMap read with R.get/HashMap.get and dispatch the remaining hex/newline/error logic explicitly; preserve all escape/token semantics.
- seats: part-2/fable-1-4
- group: g6

### diagnostic-crlf

- file: scratchpad/effected/yaml/YamlDiagnostic.ts:192
- class: bug   severity: required
- standard: D11; section 14 verified upstream-bug
- evidence: fromRaw offset=1,length=1 on CRLF returns line 1, character -1 in lab/oracle because lookahead advances lineStart beyond the limit.
- failure: A valid source position has a negative column.
- fix: Bound CRLF lookahead by the requested scan limit (i+1 < limit), adding the interior-CRLF position regression.
- seats: part-1/sol-1-2
- group: g7

### diagnostic-kits

- file: scratchpad/effected/yaml/YamlDiagnostic.ts:32,46,60,74,89
- class: schema   severity: required
- standard: effect-laws-v1 law 19; D5
- evidence: Five named diagnostic-code domains use annotated S.Literals rather than the named-domain LiteralKit form.
- failure: The exported code vocabulary lacks the required kit surface.
- fix: Use annotated LiteralKit values over the existing code lists, retaining members/names/types and the public aggregate error-code union.
- seats: part-1/sol-1-5
- group: g7

### numeric-option-metadata

- file: scratchpad/effected/yaml/internal/rules/util.ts:16,27
- class: schema   severity: required
- standard: effect-laws-v1 laws 17/18; EF-12/EF-12c; operator step 4
- evidence: Both reusable filters pass undefined annotations and their exported schemas lack $I. Runtime metadata probes confirm no identifier/title/description; adding check metadata preserves error sentences.
- failure: Shared numeric constraints lack mandatory schema identity and reusable-filter metadata.
- fix: Create the file composer, annotate both schemas and both checks with identifier/title/description, retaining predicate messages and abort behavior. Do not substitute safe-integer checks that narrow upstream acceptance.
- seats: part-5/grok-1-1, part-5/grok-1-2, part-5/sol-1-5, part-5/fable-1-1
- group: g8

### scalar-role-kit

- file: scratchpad/effected/yaml/internal/rules/util.ts:37
- class: schema   severity: required
- standard: effect-laws-v1 law 19; D5
- evidence: ScalarRole is a named key/value/item/root type union reused by walkScalars and rules, with no schema.
- failure: The named scalar-role domain is outside the required LiteralKit model.
- fix: Define annotated LiteralKit ScalarRole and derive its same-name type, preserving all walker literals/signatures.
- seats: part-5/grok-1-3, part-5/fable-1-2
- group: g8

### restore-util-functions

- file: scratchpad/effected/yaml/internal/rules/util.ts:40,67,76,103,113
- class: law   severity: required
- standard: Later unforced-change ruling; D9
- evidence: Five upstream helpers gained dual/data-last overloads; no YAML test imports those helpers and in-module calls use full arity.
- failure: An unused unforced API shape was added without a law/diagnostic cause.
- fix: Restore upstream plain signatures/defaults/bodies for walkScalars, isScalarContinuationLine, coveringToken, insideScalarSpan and positionAt, retaining forced guard substitutions. Restore any test lines rewritten solely for currying; do not add tests for an API that must be removed.
- seats: part-5/fable-1-8
- group: g8

### indent-markers

- file: scratchpad/effected/yaml/internal/rules/indentation.ts:79
- class: bug   severity: required
- standard: D11; section 14 verified upstream-bug
- evidence: Keys ---key/...key cause valid intermediate indentation to be discarded: line 2 gets 'Indent of 4 spaces, expected 2' and inference votes 4 in both versions.
- failure: Prefix matching treats ordinary mapping keys as document markers.
- fix: Use marker token kinds or complete marker/legal-boundary checks in shared contentLines; add ---key and ...key regressions for check and infer.
- seats: part-5/sol-1-2
- group: g8

### indent-quoted-comment

- file: scratchpad/effected/yaml/internal/rules/indentation.ts:103
- class: bug   severity: required
- standard: D11; section 14 verified upstream-bug
- evidence: A quoted key containing ' # ' followed by an indented sequence avoids the indentSequences:false diagnostic and vote in both versions.
- failure: A regex removes scalar content as if it were a trailing comment.
- fix: Use actual comment spans or last significant separator tokens on the preceding line; pin quoted-key checking/inference regressions.
- seats: part-5/sol-1-3
- group: g8

### indent-compact-level

- file: scratchpad/effected/yaml/internal/rules/indentation.ts:126
- class: bug   severity: required
- standard: D11; section 14 verified upstream-bug
- evidence: Compact outer/- two:/child emits a false indentation diagnostic and 2/4 inference votes, while its equivalent expanded form passes with only 2 votes.
- failure: The stack omits structural levels opened after a sequence indicator on one line.
- fix: Advance the shared check/infer indentation model using the compact mapping's structural column; add equivalent compact/expanded regressions.
- seats: part-5/sol-1-4
- group: g8

### rule-option-isolation-a

- file: scratchpad/effected/yaml/internal/rules/empty-lines.ts:31; scratchpad/effected/yaml/internal/rules/indentation.ts:112; scratchpad/effected/yaml/internal/rules/line-length.ts:29; scratchpad/effected/yaml/internal/rules/quoted-strings.ts:51; scratchpad/effected/yaml/internal/rules/truthy.ts:63
- class: bug   severity: required
- standard: D9; D11; later unforced-change ruling
- evidence: A whole-struct S.is failure discards every option; direct emptyLines.check with valid max:5 and invalid maxEnd:2.5 uses max:2 in the port and max:5 upstream. Facade decoding hides the difference from green tests.
- failure: One bad field erases unrelated valid settings in direct rule.check calls.
- fix: Read and narrow each known field independently, retaining all valid upstream options/defaults and safe values. Restore any rewritten upstream direct-call test lines; add a valid-field/invalid-sibling regression. D15-forced differences on the invalid field itself are central deviation bookkeeping, not permission to discard valid fields.
- seats: part-5/fable-1-3, part-4/fable-1-6
- group: g8

### rule-options-types-a

- file: scratchpad/effected/yaml/internal/rules/util.ts:16; scratchpad/effected/yaml/internal/rules/empty-lines.ts:20; scratchpad/effected/yaml/internal/rules/indentation.ts:30; scratchpad/effected/yaml/internal/rules/line-length.ts:18; scratchpad/effected/yaml/internal/rules/quoted-strings.ts:29; scratchpad/effected/yaml/internal/rules/truthy.ts:29
- class: schema   severity: required
- standard: EF-3 same-name type companions; D11
- evidence: The six files export non-class numeric/options schemas without same-name derived type exports; green gates do not enforce the value/type API.
- failure: Consumers cannot import these schema names as their prescribed decoded types.
- fix: Add same-name typeof Schema.Type aliases for both numeric constraints and the five option schemas in these six files. Record additions centrally via exportsAdded; do not hand-edit Port notes.
- seats: part-5/sol-1-6
- group: g8

### bom-comment-spacing

- file: scratchpad/effected/yaml/internal/rules/comments-spacing.ts:44
- class: bug   severity: required
- standard: D11; section 14 verified upstream-bug
- evidence: BOM+# header gives a false 'Too few spaces before comment (0 < 1)' and insertion at offset 1 in both versions; unprefixed header has no finding.
- failure: A leading BOM is incorrectly treated as preceding line content.
- fix: Exclude a leading BOM from hasContentBefore and pin own-line comment diagnosis/fix behavior.
- seats: part-4/sol-1-6
- group: g9

### hyphen-fix-fidelity

- file: scratchpad/effected/yaml/internal/rules/hyphen-spacing.ts:55
- class: bug   severity: required
- standard: D11; section 14 failing value-preservation property
- evidence: Both versions fix '-   - one\n    - two\n' to '- - one\n    - two\n', changing [[one,two]] to [[one - two]]; compact map continuation similarly corrupts values.
- failure: A successful spacing edit changes nested collection content.
- fix: Retain the diagnostic but omit its fix when shortening the separator relocates a compact block collection with continuation entries. Keep safe scalar fixes; add sequence/map value-fidelity regressions.
- seats: part-5/sol-1-1
- group: g9

### rule-option-isolation-b

- file: scratchpad/effected/yaml/internal/rules/comments-spacing.ts:54; scratchpad/effected/yaml/internal/rules/document-start.ts:38; scratchpad/effected/yaml/internal/rules/document-end.ts:55
- class: bug   severity: required
- standard: D9; D11
- evidence: comments-spacing with valid minSpacesBefore:3 and invalid severity drops the spacing option, unlike upstream; whole-struct guards appear in all three rules.
- failure: An unrelated invalid field erases valid direct-call rule settings.
- fix: Narrow known fields independently, retaining valid options and defaults without unsafe casts; add independent-field direct-check regressions and restore any rewritten upstream tests. Record only residual D15-forced invalid-field behavior centrally.
- seats: part-4/fable-1-6, part-5/fable-1-3
- group: g9

### rule-options-types-b

- file: scratchpad/effected/yaml/internal/rules/colon-spacing.ts:23; scratchpad/effected/yaml/internal/rules/comments-spacing.ts:23; scratchpad/effected/yaml/internal/rules/document-start.ts:21; scratchpad/effected/yaml/internal/rules/document-end.ts:20; scratchpad/effected/yaml/internal/rules/hyphen-spacing.ts:21
- class: schema   severity: required
- standard: EF-3; schema-first same-name value/type API
- evidence: The four part-4 option schemas and hyphenSpacingOptions lack their same-name type companions.
- failure: These exported non-class schemas omit the required decoded-type API.
- fix: Add same-name derived type exports for all five schemas; let the central codemod record added exports.
- seats: part-4/sol-1-11, part-5/sol-1-6
- group: g9

### rule-options-types-c

- file: scratchpad/effected/yaml/internal/rules/eof-newline.ts:13; scratchpad/effected/yaml/internal/rules/key-duplicates.ts:21; scratchpad/effected/yaml/internal/rules/parse-validity.ts:20; scratchpad/effected/yaml/internal/rules/trailing-spaces.ts:16
- class: schema   severity: required
- standard: EF-3; D11
- evidence: The remaining four exported rule-option schemas lack same-name type companions.
- failure: Their schema-owned decoded-type API is incomplete.
- fix: Add the four same-name typeof Schema.Type aliases; central exportsAdded bookkeeping owns the record.
- seats: part-5/sol-1-6
- group: g10

### restore-test-harness

- file: scratchpad/test/yaml/rules/harness.ts:70,202
- class: law   severity: required
- standard: Later unforced-change ruling; D9; section 11.1 upstream tests
- evidence: testRule/testRuleInference were plain upstream helpers; the lab constructs dual with overload blocks on every call, while all suite callers use the original direct form.
- failure: The upstream test-helper shape was rewritten without a law or diagnostic requiring currying.
- fix: Restore the upstream plain two-parameter helper signatures/bodies and all upstream test lines rewritten only for currying; retain assert.isDefined cast removal and YamlLintDiagnostic.make required by diagnostics. Do not treat this restoration as deferred vitest-canon work.
- seats: part-4/fable-1-12
- group: g11

### allow-1

- file: scratchpad/effected/yaml/internal/stringifier.ts:519,577
- class: law   severity: required
- standard: beep-laws/no-native-runtime; kind: new-map-set; EFFECTED-YAML-CYCLE-DETECTION; later identity-set ruling
- evidence: standards/effect-laws.allowlist.jsonc:517–524 names stringifier.ts/new-map-set; the retained ancestor Set uses object identity.
- failure: The removed native-runtime exception must be eliminated without merging structurally equal distinct values.
- fix: Replace the ancestor Set with a per-traversal ancestor stack scanned using ===; push/pop on descent/unwind and retain circular-reference failure, shared-reference acceptance and depth behavior. Add cyclic vs structurally equal distinct-object regressions; no byReferenceUnsafe marks.
- seats: operator/allowlist-1
- group: g3

### allow-2

- file: scratchpad/effected/yaml/Yaml.ts:331,374,912
- class: law   severity: required
- standard: beep-laws/no-native-runtime; kind: new-map-set; EFFECTED-YAML-ANCHOR-MAP; later YAML anchor ruling
- evidence: standards/effect-laws.allowlist.jsonc:525–532 explicitly names Yaml.ts/new-map-set and its public anchor-map boundary.
- failure: A now-removed exception retains native anchor maps at the facade.
- fix: Create MutableHashMap anchor maps in every Yaml facade extraction path and pass them to migrated node APIs; preserve encounter-order registration and duplicate-anchor alias semantics. Update the native Map in scratchpad/test/yaml/e2e/support/engine.ts:75 in this group, plus affected core tests.
- seats: operator/allowlist-2
- group: g1

### allow-3

- file: scratchpad/effected/yaml/YamlDocument.ts:233
- class: law   severity: required
- standard: beep-laws/no-native-runtime; kind: new-map-set; EFFECTED-YAML-ANCHOR-MAP; later YAML anchor ruling
- evidence: standards/effect-laws.allowlist.jsonc:533–540 explicitly names YamlDocument.ts/new-map-set.
- failure: Document extraction still creates a native anchor map under a removed exception.
- fix: Use MutableHashMap.empty in document toValue/extraction, passing it through the migrated node API; preserve alias registration/resolution semantics and test document extraction.
- seats: operator/allowlist-3
- group: g1

### allow-4

- file: scratchpad/effected/yaml/YamlFormat.ts:381,424
- class: law   severity: required
- standard: beep-laws/no-native-runtime; kind: new-map-set; EFFECTED-YAML-CYCLE-DETECTION; later identity-set ruling
- evidence: standards/effect-laws.allowlist.jsonc:541–548 names YamlFormat.ts/new-map-set for replacement-value cycle detection.
- failure: The removed identity-set exception must be replaced without structural equality collisions.
- fix: Use a replacement-conversion ancestor stack scanned with ===, pushed/popped per recursive descent. Preserve CircularReference handling, accept distinct structurally equal objects and repeated non-ancestor sharing, and add regressions.
- seats: operator/allowlist-4
- group: g2

## Backlog

### docs-public

- file: scratchpad/effected/yaml/YamlToken.ts:138; scratchpad/effected/yaml/YamlDocument.ts:56
- class: jsdoc   severity: backlog
- standard: S2 deferred; JSDoc carrier/kind-split laws; D4
- evidence: Legacy @example/@remarks, missing category/since/titled examples occur in Token/Node/Format/Document/Lint/Diagnostic/Edit.
- failure: The focused public docs have not received scheduled S2 conversion.
- fix: During S2 retain upstream bodies, convert carriers, add canonical metadata and compiling titled examples.
- seats: part-1/grok-1-4, part-1/sol-1-10

### docs-visitor-internals

- file: scratchpad/effected/yaml/YamlVisitor.ts:92; scratchpad/effected/yaml/index.ts:4
- class: jsdoc   severity: backlog
- standard: S2 deferred; JSDoc law
- evidence: Visitor example/remarks and index package remarks use retired tags; part-2 internal value exports lack required metadata/examples.
- failure: Visitor, entry-point and part-2 helper docs are incomplete.
- fix: In S2 convert legacy carriers, retain prose/examples and add metadata and meaningful titled examples to owning exports; re-export edges stay edges.
- seats: part-2/grok-1-1, part-2/grok-1-2, part-2/sol-1-9, part-2/fable-1-8

### docs-stringifier-block

- file: scratchpad/effected/yaml/internal/composer/anchors.ts:36
- class: jsdoc   severity: backlog
- standard: S2 deferred; section 10.2 includes internal/**
- evidence: makeAlias is undocumented and anchor/stringifier/block/token exports lack canonical metadata/titled examples.
- failure: Part-3 internal APIs are not ready for docgen.
- fix: Document owning exports in the four focused files during S2, preserving upstream prose and adding compilable examples.
- seats: part-3/sol-1-8

### docs-composer-rules-a

- file: scratchpad/effected/yaml/internal/composer/comments.ts:64
- class: jsdoc   severity: backlog
- standard: S2 deferred; JSDoc kind-split law
- evidence: Part-4 composer and colon/comments/document marker rule exports have absent/prose-only docs without category/since/titled examples.
- failure: The scheduled documentation pass remains incomplete.
- fix: During S2 preserve prose and supply canonical metadata and observable examples to value exports, useful prose to type exports.
- seats: part-4/sol-1-12

### docs-rules-b

- file: scratchpad/effected/yaml/internal/rules/util.ts:16; scratchpad/effected/yaml/internal/rules/empty-lines.ts:15
- class: jsdoc   severity: backlog
- standard: S2 deferred; section 10.2
- evidence: Every export in the eleven part-5 files has only a lead sentence and no canonical metadata/titled examples.
- failure: Rule and shared utility docs have not undergone S2.
- fix: Add required metadata and compiling examples during S2; do not drop carried prose or examples.
- seats: part-5/sol-1-7, part-5/fable-1-7

### token-hotpath-comment

- file: scratchpad/effected/yaml/YamlToken.ts:109
- class: docs   severity: backlog
- standard: S2 deferred; D4; code/prose accuracy
- evidence: Comment says new skips make validation, but code uses make and Effect 4 constructors validate too; measured 1.94 vs 1.95 ms is parity.
- failure: The retained hot-path comment describes the opposite of actual construction.
- fix: Remove the false validation-free claim and accurately explain the measured parity and lawful make construction during S2.
- seats: part-1/grok-1-3, part-1/fable-1-10

### test-container-canon

- file: scratchpad/test/yaml/YamlDocument.test.ts:97
- class: test   severity: backlog
- standard: S3 deferred; effect-vitest-canon; section 11.2
- evidence: Tests manually branch/assert Result/Option and no YAML test imports @effect/vitest/utils.
- failure: Container assertions lack the scheduled canonical helpers.
- fix: In S3 use the canonical Result/Option/Exit assertions while retaining upstream payload assertions.
- seats: part-1/sol-1-11

### schema-property-floor

- file: scratchpad/test/yaml/YamlToken.test.ts:90; scratchpad/effected/yaml/internal/rules/util.ts:27
- class: test   severity: backlog
- standard: S3 deferred; D10; section 11.4
- evidence: One fixed token round-trip and three effect properties do not include schema-derived Arbitrary/fcRuns; rule/numeric schemas also lack their round-trip properties.
- failure: The exported schema/codec property floor has not run.
- fix: In S3 add schema-derived round-trip properties for public models and all rule/numeric schemas using fcRuns(n); retain examples/oracles.
- seats: part-1/sol-1-12, part-5/sol-1-8

### fractional-modify-indices

- file: scratchpad/effected/yaml/YamlFormat.ts:492,605
- class: bug   severity: backlog
- standard: D9; section 14; no verified proposed fix/admitted semantics
- evidence: Both versions delete index 1 for 1.5, silently no-op a 1.5 replacement, and defect on deeper fractional navigation. This is inherited behavior rather than a port-only change.
- failure: Fractional sequence paths have surprising upstream behavior; the report offers a conditional behavior change.
- fix: If the upstream-bug correction is admitted later, reject non-integer indices with ModifyFailure before splice/assignment in modifyNode/findExistingTarget and pin direct/deeper cases; keep current oracle behavior until then.
- seats: part-1/grok-1-2

### encode-span-name

- file: scratchpad/effected/yaml/Yaml.ts:816
- class: effect-idiom   severity: backlog
- standard: D11; no demonstrated law/behavior failure
- evidence: Yaml.allFromString's inner encoder span is named encode, whereas siblings qualify API names; Effect.fn wrapping was required.
- failure: Trace attribution is less specific, with no measured regression or broken contract.
- fix: Use Yaml.allFromString.encode or fnUntraced in a later observability pass, preserving codec behavior.
- seats: part-1/fable-1-11

### lint-single-use-filter

- file: scratchpad/effected/yaml/YamlLint.ts:105
- class: schema   severity: backlog
- standard: Law 18 reusable-check requirement; D11
- evidence: A single-use validateRulesMap filter is unnamed while its owning exported class has identity; the mandatory reusable clause does not apply.
- failure: Introspection of this one-off check has less descriptive metadata.
- fix: Optionally name/annotate the filter without changing issue messages.
- seats: part-1/fable-1-12

### visitor-guard-cost

- file: scratchpad/effected/yaml/YamlVisitor.ts:188
- class: perf   severity: backlog
- standard: D11 performance evidence threshold
- evidence: Per-node S.is factory sites are identified, but this visitor path has no measurement or algorithmic-class regression.
- failure: Potential constant-factor visitor overhead remains unmeasured.
- fix: Measure the visitor against pinned upstream; if confirmed, hoist local schema guards while retaining event order.
- seats: part-2/fable-1-6

### visitor-optional-spreads

- file: scratchpad/effected/yaml/YamlVisitor.ts:200,222,240
- class: effect-idiom   severity: backlog
- standard: D11; law 21 preference
- evidence: Each event uses separate tag/anchor getSomesStruct calls; no behavior/performance measurement is provided for this visitor.
- failure: Redundant optional-field lifting is a local simplification opportunity.
- fix: Combine tag/anchor into one getSomesStruct call per event in a later cleanup.
- seats: part-2/fable-1-7

### parenthesis-residue

- file: scratchpad/effected/yaml/internal/cst-parser.ts:216; scratchpad/effected/yaml/internal/composer/tags.ts:66
- class: effect-idiom   severity: backlog
- standard: D11; readability-only residue
- evidence: Doubled parentheses and expanded non-empty-string conditions appear in cst-parser/lexer and composer tags/document/flow/scalars; no gate/behavior impact.
- failure: Machine-generated condition formatting adds noise.
- fix: Drop redundant parentheses and simplify equivalent string predicates without changing truthiness.
- seats: part-2/fable-1-9, part-4/fable-1-11

### unreachable-guard-coverage

- file: scratchpad/effected/yaml/internal/fold.ts:70; scratchpad/effected/yaml/internal/rules/indentation.ts:124
- class: test   severity: backlog
- standard: S3 deferred; section 11.3 no coverage weakening
- evidence: Reports identify bounded-loop/index fallback branches in fold/cst-parser and indentation/util/empty-lines/eof-newline that ordinary inputs cannot reach.
- failure: Scheduled branch coverage may expose guard branches with no admissible input.
- fix: In S3 establish the invariants, then use total iteration/paired arrays/non-empty structures to remove truly unreachable branches; no ignore markers, casts or reduced assertions. Error metadata portions are required elsewhere.
- seats: part-2/fable-1-10, part-5/fable-1-5

### fatal-code-model

- file: scratchpad/effected/yaml/internal/diagnostics.ts:128
- class: schema   severity: backlog
- standard: D11; no demonstrated mandatory schema failure beyond optional set projection
- evidence: Fatality is represented as a HashSet and membership function; the error-code lists already drive public schemas.
- failure: A schema projection of the fatal subset could improve reuse/arbitraries.
- fix: Optionally derive an annotated LiteralKit fatal-code subset and its guard, retaining the code list and fatality behavior.
- seats: part-2/fable-1-11

### lexer-removal-iteration

- file: scratchpad/effected/yaml/internal/lexer.ts:117
- class: bug   severity: backlog
- standard: D11; current Effect 4.0.2 behavior remains identical
- evidence: Removal during MutableHashMap key iteration is safe in the verified current implementation; concern is a possible future backing change.
- failure: Only a speculative future iteration compatibility risk is demonstrated.
- fix: Snapshot keys before dedent removals if a future Effect upgrade requires it; pin token behavior.
- seats: part-2/fable-1-12

### readme-attribution-residue

- file: scratchpad/effected/yaml/README.md:244
- class: docs   severity: backlog
- standard: S2 deferred; D4 attribution accuracy
- evidence: Attribution contains a pasted catalog.ts comment rather than a package/commit/license fact.
- failure: README carries stray tool output.
- fix: Remove only the stray attribution bullet during S2; Port-notes deviation/exports bookkeeping remains central.
- seats: part-1/fable-1-9, part-2/fable-1-13, part-4/fable-1-10

### block-minor-costs

- file: scratchpad/effected/yaml/internal/composer/block.ts:1303
- class: perf   severity: backlog
- standard: D11; isolated public regression not established for this microcontribution
- evidence: keyIdentity Match and MutableHashSet microbenchmarks add only a few ms of an approximately 125 ms total composition delta; the seat explicitly leaves this minor contribution backlog.
- failure: Small per-key overhead lacks an independently measured affected-path regression.
- fix: Measure the keyIdentity path separately before simplifying dispatch; retain the required Effect hash collection.
- seats: part-3/fable-1-9

### block-stringifier-optional-lifts

- file: scratchpad/effected/yaml/internal/composer/block.ts:144; scratchpad/effected/yaml/internal/stringifier.ts:144
- class: effect-idiom   severity: backlog
- standard: D11; no demonstrated forbidden API or public behavior change
- evidence: Many single-key getSomesStruct calls cost 44 vs 33 ms per million two-field builds; unlike the separate measured construction finding, no complete scalar-path regression is isolated here.
- failure: Optional-field spelling may have unnecessary allocation/verbosity.
- fix: If touched later, consolidate fields into one getSomesStruct per construction and preserve optional-field omission; do not invent a new shared helper without reuse discovery.
- seats: part-3/fable-1-11

### block-leading-emptiness

- file: scratchpad/effected/yaml/internal/composer/block.ts:926
- class: effect-idiom   severity: backlog
- standard: D11; optional terseness cleanup
- evidence: R.keys({...leading}).length copies a two-field CommentFields object just to test emptiness.
- failure: A small per-pair allocation has no measured public regression.
- fix: Check the two known optional fields directly or use the derived schema predicate in a later cleanup.
- seats: part-3/fable-1-13

### scalar-escape-table

- file: scratchpad/effected/yaml/internal/composer/scalars.ts:250
- class: effect-idiom   severity: backlog
- standard: D11; source-identical behavior/readability-only finding
- evidence: The 20-case escape switch became an equivalent if ladder; the seat provides no measurement or failure for this separate scalar decoder.
- failure: A compact data table may be clearer.
- fix: Optionally hoist simple escape substitutions and keep multi-character/error logic explicit.
- seats: part-4/fable-1-8

### tagged-scalar-matcher

- file: scratchpad/effected/yaml/internal/composer/scalars.ts:79
- class: perf   severity: backlog
- standard: D11; no measured material corpus regression
- evidence: Tagged scalar microcost is 241 vs 37 ns, but the benchmark corpus contains none and the seat explicitly leaves it backlog.
- failure: Rare tagged scalar dispatch is slower without demonstrated document-level impact.
- fix: Measure tagged-input corpora; if warranted build the matcher once at module scope and retain resolution.
- seats: part-4/fable-1-9

### last-significant-token

- file: scratchpad/effected/yaml/internal/rules/document-end.ts:29
- class: effect-idiom   severity: backlog
- standard: D11; direct helper preference without measured regression
- evidence: tailToken copies/reverses tokens then finds the last non-trivia token; A.findLast would avoid the copy.
- failure: A once-per-rule allocation can be simplified.
- fix: Use A.findLast and explicit Option handling in a later cleanup, retaining trivia semantics.
- seats: part-4/fable-1-13

### numeric-check-comment

- file: scratchpad/effected/yaml/internal/rules/util.ts:18
- class: docs   severity: backlog
- standard: S2/S3 deferred; schema-number diagnostic; D9
- evidence: abort:true integer predicate makes the trailing finite check redundant at runtime, but that check satisfies schema-number. Safe-integer built-ins would narrow upstream acceptance.
- failure: The diagnostic-required check's reason is undocumented.
- fix: Document the schema-number reason and keep current acceptance/messages; any future built-in substitution must preserve ordinary integers outside the safe range.
- seats: part-5/fable-1-4

### optional-rule-fixes

- file: scratchpad/effected/yaml/internal/rules/quoted-strings.ts:41; scratchpad/effected/yaml/internal/rules/truthy.ts:78
- class: effect-idiom   severity: backlog
- standard: D11; optional Option contract cleanup
- evidence: Undefined fixes are immediately lifted into Option before spreading.
- failure: Absence passes through a redundant nullish representation without a demonstrated contract failure.
- fix: Optionally return Option<YamlEdit> directly from safeQuoteFix/builders while keeping fix omission behavior.
- seats: part-5/fable-1-6

### allowlist-retirement

- file: standards/effect-laws.allowlist.jsonc:517
- class: law   severity: backlog
- standard: outside the port's write surface
- evidence: The seats explicitly request deletion of YAML allowlist entries after replacing native collections; standards/** cannot be assigned to any port group.
- failure: Registry retirement still needs its central owner after local replacements.
- fix: Have the central owner remove the four exact YAML entries after source fixes; required allow-1..allow-4 assign only module/test changes.
- seats: part-3/fable-1-5, part-4/fable-1-5
- reason: outside the port's write surface

## Handled by the deviation codemod

### codemod-finite

- file: scratchpad/effected/yaml/README.md:252
- class: docs   severity: backlog (central codemod)
- standard: Later per-module/per-class deviation-codemod ruling
- evidence: The seat asks to record S.Number->S.Finite acceptance changes on options/model fields; these are forced by schema-number.
- failure: Missing finite-number deviation bookkeeping is centrally owned.
- fix: Generate one finite-number deviation entry per module/class listing affected sites and adjusted upstream tests; no handwritten ledger or Port-notes edits.
- seats: part-1/fable-1-9, part-5/fable-1-4

### codemod-tagged-errors

- file: scratchpad/effected/yaml/README.md:252
- class: docs   severity: backlog (central codemod)
- standard: Later per-class deviation-codemod ruling
- evidence: YamlEditFailure replacing native Error changes name/_tag but preserves the message; the seat asks for a law:7 record.
- failure: Missing tagged-error bookkeeping is centrally owned.
- fix: Generate the module's tagged-error deviation entry with sites and adjusted tests; retain substantive error-model defects as required.
- seats: part-1/fable-1-9

### codemod-identities

- file: scratchpad/effected/yaml/README.md:252
- class: docs   severity: backlog (central codemod)
- standard: Later per-class identity deviation-codemod ruling
- evidence: The seat asks to record identity-derived names/tags; operator assigns identity-key systemic entries to the codemod.
- failure: Identity projection bookkeeping must not become per-site required work.
- fix: Generate the module/class identity entry and any derived JSON Schema-key sites centrally, with adjusted tests.
- seats: part-1/fable-1-9

### codemod-exports

- file: scratchpad/effected/yaml/internal/rules/line-length.ts:18
- class: docs   severity: backlog (central codemod)
- standard: Later exportsAdded codemod ruling; D2
- evidence: Same-name type companions are substantive required work; the separate request to record added exports is bookkeeping.
- failure: exportsAdded recording is centrally owned.
- fix: Populate exportsAdded for the actual landed additions centrally; required groups add types but never edit Port notes.
- seats: part-5/sol-1-6, part-4/sol-1-11

### codemod-native-runtime

- file: scratchpad/effected/yaml/README.md:252
- class: docs   severity: backlog (central codemod)
- standard: Later per-module/per-class deviation-codemod ruling
- evidence: Reports ask to record law-forced HashSet/native-runtime replacements and safe narrowing after D15 cast removal. Unforced dual changes must instead be restored; valid option-field loss stays required.
- failure: Law/diagnostic-forced representation bookkeeping must be generated centrally.
- fix: Generate per-class entries for landed native-runtime and unsafe-assertion-removal replacements, listing sites and adjusted tests. Do not record unforced API changes as accepted deviations.
- seats: part-1/fable-1-9, part-2/fable-1-13, part-4/fable-1-6, part-5/fable-1-3

## Rejected

### reject-number-escape

- file: scratchpad/effected/yaml/YamlFormat.ts:127
- class: bug   severity: backlog (rejected proposal)
- standard: schema-number; later finite-number ruling
- evidence: The seat proposes restoring S.Number with a diagnostic suppression to handle non-finite echoed indices.
- failure: The proposed fix weakens the green diagnostic and contradicts the law-forced finite-number pass.
- fix: Use required format-nonfinite-error's lawful tagged representation instead.
- seats: part-1/grok-1-1
- reason: Restoring unrestricted S.Number and suppressing schema-number contradicts the binding diagnostic/ruling; the evidenced typed-failure defect remains required.

### reject-format-unreachable

- file: scratchpad/effected/yaml/YamlFormat.ts:512; scratchpad/effected/yaml/YamlEdit.ts:83
- class: effect-idiom   severity: backlog (rejected proposal)
- standard: D11 evidence rule; section 11.3
- evidence: The seat calls oldPair/items guards unreachable because indices are bounded; part-1/grok-1-2 demonstrates a fractional index within bounds yielding undefined and a real invariant defect.
- failure: The blanket unreachable premise is contradicted by a concrete input; remaining wording is optional style.
- fix: Retain reachable protection; evaluate proven unreachable edit branches during S3 rather than deleting the format guard.
- seats: part-1/fable-1-13
- reason: The claimed format invariant is false for fractional array indices; no blanket guard removal is supported.

### reject-curried-render-fix

- file: scratchpad/effected/yaml/internal/fold.ts:270; scratchpad/effected/yaml/internal/composer/scalars.ts:103
- class: bug   severity: backlog (rejected proposal)
- standard: Later unforced-shape ruling
- evidence: The reports propose predicate dual to preserve optional direct calls while retaining the unforced new curried API.
- failure: That alternative keeps a callable shape no law/diagnostic/operator required.
- fix: Restore the plain upstream declarations under restore-render-helpers/restore-composer-walks.
- seats: part-2/sol-1-1, part-4/sol-1-7
- reason: Keeping an unforced dual API contradicts the ruling to restore upstream shape; the underlying regressions are retained as required.

### reject-safe-integer-substitution

- file: scratchpad/effected/yaml/internal/rules/util.ts:18
- class: schema   severity: backlog (rejected proposal)
- standard: D9; section 14; part-5/grok-1-1
- evidence: The built-in S.isInt uses safe-integer semantics, while current Number.isInteger accepts integral values outside the safe range; changing message annotations cannot preserve that domain.
- failure: The proposed built-in-check substitution narrows valid upstream inputs without a verified bug.
- fix: Keep current acceptance and add mandatory metadata; the diagnostic-check explanation is numeric-check-comment backlog.
- seats: part-5/fable-1-4
- reason: The suggested safe-integer replacement changes upstream acceptance without a forced cause; preserving messages alone does not fix it.
