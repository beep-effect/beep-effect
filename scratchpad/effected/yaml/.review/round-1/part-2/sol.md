### sol-1-1
- file: scratchpad/effected/yaml/internal/fold.ts:270
- class: bug   severity: required
- standard: EFFECTED_PORT_GOAL.md D9 and D11; standards/effect-first-development.md EF-18   evidence: Read-only `bun --eval` imports of the port and pinned oracle show that `renderBlockLiteral("hello", "  ")` returns `"|-\n  hello"` upstream but returns a function in the port. The same regression occurs at line 336: `renderBlockFolded("hello", "  ")` returns `">-\n  hello"` upstream and a function in the port. `dual(6, ...)` and `dual(4, ...)` classify valid upstream calls with omitted optional arguments as data-last calls; the declared overloads also make upstream optional parameters mandatory.
- failure: Existing callers of these exported internal helpers lose both source compatibility and runtime behavior when they omit optional arguments. Current stringifier call sites supply every argument, which leaves this regression outside the passing upstream tests.
- fix: Restore the original optional data-first signatures and defaults. Use predicate-based `dual` dispatch that treats calls with at least two arguments as data-first, with an unambiguous one-argument data-last overload for default rendering.

### sol-1-2
- file: scratchpad/effected/yaml/internal/fold.ts:444
- class: bug   severity: required
- standard: EFFECTED_PORT_GOAL.md D9, D11 and §14, verified upstream bug; `renderBlockFolded`’s value-preservation contract   evidence: In both the port and pinned oracle, stringifying `" a\nb"` with `defaultScalarStyle: "block-folded"` produces `">2-\n   a\n\n  b\n"`. Parsing that output returns `" a\n\nb"`, so the round-trip property fails. The independent `yaml` parser also reads the rendered output as `" a\n\nb"`. The condition checks the current line’s indentation but omits `prevMoreIndented`.
- failure: A transition from a more-indented line to a normal line gains an extra newline. This affects the public stringify path and corrupts the string value.
- fix: Insert the compensation blank line only when both adjacent content lines are non-more-indented: add `!prevMoreIndented` to this condition. Retain a regression test for `" a\nb"` and record the verified upstream-bug deviation under §14.

### sol-1-3
- file: scratchpad/effected/yaml/internal/cst-visitor.ts:352
- class: bug   severity: required
- standard: EFFECTED_PORT_GOAL.md D9, D11 and §14, verified upstream bug; `CstKeyEvent` and `CstValueEvent` contracts   evidence: For `"- a: 1\n- b: 2\n"`, a read-only key-projection property fails in both the port and pinned oracle: AST `Pair` keys are `["a", "b"]`, while CST `CstKeyEvent` sources are `["1", "2"]`. `parseImplicitBlockMapping` includes each compact mapping’s first key inside its children, but `walkBlockMapChildren` always starts by expecting a value.
- failure: Compact mappings inside sequence entries emit their keys as values and their values as keys. The visitor applies the “first key was emitted outside this container” assumption to a different CST layout.
- fix: Pass or derive whether the first key was emitted outside the block-map, and initialize `expectingKey` accordingly. Preserve the existing behavior for sibling-key mappings. Add the compact-sequence regression and record the verified upstream-bug deviation.

### sol-1-4
- file: scratchpad/effected/yaml/internal/cst-visitor.ts:365
- class: bug   severity: required
- standard: EFFECTED_PORT_GOAL.md D9, D11 and §14, verified upstream bug; CST key/value classification contract   evidence: For `"a:\nb: 2\n"`, both versions emit `CstKeyEvent("a")`, `CstValueEvent("b")`, then `CstKeyEvent("2")`. The AST visitor correctly reports keys `["a", "b"]`, so the CST/AST key-projection property fails. The flow walker has the same problem: `"{a: , b: 2}\n"` emits `"b"` as a value and `"2"` as a key; the independent `yaml` oracle parses `{ a: null, b: 2 }`. Structural separators are discarded as trivia, and an omitted value never advances the alternating state.
- failure: An empty mapping value shifts the classification of subsequent keys and values. The failure occurs in both block and flow mappings.
- fix: Update mapping state from entry boundaries and key/value separators, accounting for omitted values before skipping structural nodes. Add block and flow empty-value regressions and record the verified upstream-bug deviation.

### sol-1-5
- file: scratchpad/effected/yaml/internal/lexer.ts:389
- class: bug   severity: required
- standard: EFFECTED_PORT_GOAL.md D9, D11 and §14, verified upstream bug; `parseCSTAll`’s explicit character-preservation contract   evidence: Read-only probes show `parseCSTAll("hello  ")[0].source === "hello"` and `parseCSTAll("a: foo  ")[0].source === "a: foo"` in both the port and pinned oracle. The source-fidelity property fails. `scanPlainScalar` advances over trailing whitespace, trims its value, and derives the token length from that trimmed value; the consumed whitespace receives no token or CST span.
- failure: Trailing spaces disappear from the document’s CST source when a plain scalar ends at EOF. Elsewhere, consumed spaces can be absent from all leaf spans even when a container’s larger source slice happens to retain them.
- fix: After finding the trimmed end, rewind `pos` and `col` by the consumed trailing-whitespace count so the next scan emits that whitespace separately. Keep the scalar value trimmed. Add EOF fidelity regressions and record the verified upstream-bug deviation.

### sol-1-6
- file: scratchpad/effected/yaml/internal/lexer.ts:97
- class: bug   severity: required
- standard: EFFECTED_PORT_GOAL.md D9, D11 and §14, verified upstream bug; `YamlScanner.getTokenLine`/`getTokenColumn` contracts and the lexer’s classification of `"\r"` as a newline   evidence: For `"a: 1\rb: 2\r"`, both the port and pinned oracle emit a newline token for `"\r"` but report the following `"b"` scalar at `[line: 0, column: 5]`. The line-coordinate property expects `[1, 0]` and fails. `advance` increments the line only for `"\n"`; `setPosition` repeats that convention.
- failure: Token coordinates remain on the previous line after a lone carriage return. The scanner also retains the previous line’s indentation-lock state across a token it identifies as a newline.
- fix: Treat a lone `"\r"` as a line break in both `advance` and `setPosition`, resetting the column and applicable line state while counting CRLF once. Add sequential-scan and reset-coordinate regressions and record the verified upstream-bug deviation.

### sol-1-7
- file: scratchpad/effected/yaml/YamlVisitor.ts:34
- class: schema   severity: required
- standard: standards/effect-first-development.md EF-33; standards/schema-first-development-prompt.md, “Schema owns pure data”; EFFECTED_PORT_GOAL.md D5 and D11   evidence: The public event payload vocabulary is defined solely by a TypeScript `Data.TaggedEnum` type literal, and its runtime value at line 85 supplies tagged constructors and matchers. There is no schema definition from which these event types are derived. These are concrete event payloads, rather than service contracts, overloads or type-level machinery—the standard’s explicit exceptions.
- failure: The public event model has no executable schema for its discriminated payload shapes. Its runtime type and schema validation cannot share the required source of truth. Passing type and lint gates does not establish compliance with this modeling requirement.
- fix: Define an identity-annotated internal `S.TaggedUnion` for the existing event shapes and derive `YamlVisitorEvent` from its `.Type`. Retain `Data.taggedEnum<YamlVisitorEvent>()` as the exported constructor/matcher surface so constructor names and structural equality remain compatible.

### sol-1-8
- file: scratchpad/effected/yaml/internal/cst-parser.ts:17
- class: schema   severity: required
- standard: EFFECTED_PORT_GOAL.md operator revision, step 4; standards/effect-first-development.md EF-12   evidence: `CstParserFailure` uses `$I` for its identifier but supplies neither schema annotation metadata nor an annotation on its `message` field. The newly introduced `FoldFailure` at `internal/fold.ts:14` has the same omission. Step 4 requires annotations on fields and schemas, and EF-12 requires meaningful schema metadata through `$I.annote(...)`.
- failure: These error schemas carry their identity but omit the required schema description and field semantics. The existing green gates have left this portion of the completed identity stage unenforced.
- fix: Add meaningful `$I.annote(...)` metadata to both error declarations and an `annotateKey` description to each `message` field. Preserve their tags, fields and throwing behavior.

### sol-1-9
- file: scratchpad/effected/yaml/YamlVisitor.ts:92
- class: jsdoc   severity: backlog
- standard: .patterns/jsdoc-documentation.md, hard requirements and carrier policy; EFFECTED_PORT_GOAL.md §10.2; operator deferral of S2   evidence: `YamlVisitor` still uses `@example`, `visit` uses `@remarks` at line 119, and the package entry uses `@remarks` at `index.ts:4`. Owning exports throughout the focused internal files also lack canonical `@category` and `@since 0.0.0`; value exports generally lack titled, observable examples.
- failure: The focused documentation has not reached the required section grammar and export metadata contract. This belongs to deferred S2 and does not block the current review stage.
- fix: During S2, convert the legacy carriers while retaining their prose, add canonical categories and `@since`, and add compiling titled examples to owning value declarations. Keep barrel re-exports as graph edges.

REQUIRED: 8
BACKLOG: 1

