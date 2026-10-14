### sol-3-1
- file: scratchpad/effected/yaml/internal/composer/flow.ts:88
- class: bug   severity: required
- standard: D9 behaviour preservation; D11; section 14.   evidence: Read-only `bun -e` probes loaded YAML source from commit `c3fc60bdbfd5574dc69623d132dced0a552a586a` through an in-memory loader. `Yaml.parseResult("{foo: # c\n bar}")` fails with `MalformedFlowCollection` at offset 11. The pinned upstream oracle succeeds with `{ foo: "bar" }`, and the independent `yaml` parser reports no errors. `[foo: # c\n bar]`, quoted keys, and collection-valued entries fail similarly. The colon branch resets `contentAfterColon` but leaves `sawContent` true, so a comment before the value incorrectly arms `separatorRequired`.
- failure: Valid comments between a flow mapping’s colon and its value cause strict parsing to reject the document.
- fix: Clear the completed-content state when consuming the first structural colon, or otherwise distinguish “awaiting this entry’s value” from “entry completed” before arming `separatorRequired`. Add map and implicit-sequence-map regressions while retaining the existing missing-comma regressions.

### sol-3-2
- file: scratchpad/effected/yaml/internal/composer/flow.ts:383
- class: bug   severity: required
- standard: D9; D11; section 14.   evidence: Commit-pinned read-only probes show `Yaml.parseResult("{? &a, next: *a}")` failing with a false `DuplicateKey` at offset 5; the pinned oracle and independent `yaml` parser succeed with `{ "": null, next: null }`. Composition produces three pairs: a synthetic null key, a second anchored null key, and `next`. `{? &a}` also fails, through the closing-boundary branch at line 592. `{? !!str}` produces two AST pairs for one explicit entry, although conversion to a JavaScript object hides the extra pair.
- failure: Empty explicit flow keys carrying pending properties are materialized twice. Valid anchored keys fail strict parsing, and tagged keys acquire phantom AST entries. The recorded empty-key position correction does not authorize either outcome.
- fix: At comma and closing boundaries, materialize the explicit key once, using its pending tag/anchor metadata and resolved empty value. Register the anchor on that key and consume the metadata without subsequently emitting another node. Test both parsed values and AST pair counts.

### sol-3-3
- file: scratchpad/effected/yaml/internal/composer/document.ts:415
- class: bug   severity: required
- standard: D11; section 14 verified upstream-bug protocol; the node-property constraint independently enforced by the `yaml` parser.   evidence: Commit-pinned probes return successful parses for `&a &b hello\n` and `!!str !!int 1\n`, retaining only the later property. The pending-property assignments in `flattenFlowChildren` at `flow.ts:457,461` also accept `[&a &b foo]\n` and `[!!str !!int 1]\n`. Both port and pinned upstream exhibit this behaviour; the independent parser rejects these inputs with `MULTIPLE_ANCHORS` or `MULTIPLE_TAGS`. The round-2 `block-duplicate-properties` finding covered the assignments in `block.ts`; these probes exercise the separate document and flow paths.
- failure: Strict parsing still accepts multiple anchors or tags on one root or flow node. It silently discards the earlier anchor and allows the later tag to determine the scalar’s type.
- fix: Apply the pending-property validation already implemented in `block.ts` before replacing metadata in the document and flow composers. Preserve the valid outer-container/inner-key split. Add root and flow regressions and register these additional verified upstream-bug sites under section 14.

### sol-3-4
- file: scratchpad/effected/yaml/internal/composer/tags.ts:204
- class: bug   severity: required
- standard: D11; section 14 verified upstream-bug protocol; `validateTagHandlesInDocument`’s documented requirement that named handles be declared in the same document.   evidence: Commit-pinned probes show `!missing!str hi\n`, `x: !missing!str hi\n`, and `!missing!map {x: 1}\n` succeeding without diagnostics in both port and pinned upstream; the independent parser reports unresolved tags. `composeDocument` at `document.ts:767` requests only percent validation, while handle validation starts at document index 1. Conversely, `---\n0\n---\nhello\n !missing!str\n` fails with `UnresolvedTag` at offset 17 because the `"handles"` walk checks a CST tag-shaped token absorbed into plain-scalar content. Independent `yaml.parseAllDocuments` reports no errors and yields `[0, "hello !missing!str"]`.
- failure: Handle validation misses genuine undeclared properties in the first document and rejects ordinary scalar continuation text in later documents.
- fix: Validate named handles during composition of every document, filtering to consumed property offsets in `state.tagOffsets`. Remove the corresponding handle check from the pre-composition cross-document pass to avoid duplicate diagnostics; retain its directive-placement checks. Add first-document scalar/collection and later-document continuation regressions, and register the verified upstream bugs.

### sol-3-5
- file: scratchpad/effected/yaml/internal/composer/comments.ts:467
- class: bug   severity: required
- standard: D11; section 14 verified upstream-bug protocol; the recorded CR-aware physical-line semantics and the comment helpers’ documented line/column and blank-line contracts.   evidence: Commit-pinned probes show `columnAt("a\r#c", 2) === 2`, `sameLineSpan("a\r#c", 0, 2) === true`, and `hasBlankLineAbove("a\r\rb", 3) === false`. The helpers still locate only LF boundaries. Observable formatting failures include `"# a\r\rx: 1\r"` becoming `"# a\nx: 1\n"` and `"x:\r  a: 1\r# tail\r"` becoming `"x:\n  a: 1\n  # tail\n"`. Their LF equivalents retain the blank line and keep `# tail` at document scope. The round-2 composer-line correction did not update these comment helpers.
- failure: Accepted CR-only documents lose stylistic blank lines, and shallow terminal comments can be attributed to a nested collection and emitted at a different indentation.
- fix: Make the existing comment position and blank-line helpers recognize CR, LF, and CRLF as physical line boundaries, counting CRLF once. Add equivalent-line-ending assertions for blank-line metadata and comment ownership; register the inherited fidelity correction under section 14.

### sol-3-6
- file: scratchpad/effected/yaml/internal/rules/document-end.ts:70
- class: bug   severity: required
- standard: D11; the rule’s documented EOF-position contract; the recorded CR-aware lint-line semantics.   evidence: A commit-pinned probe of `YamlLint.run("a: 1\r", builtins, config)` with `document-end` enabled emits `{ offset: 5, line: 0, character: 4 }`. The composer’s CR-aware `lineCol(text, 5)` returns `{ line: 1, column: 0 }`. For `"a: 1\r\r"`, the rule reports line 1 instead of line 2. CRLF reports correctly. `buildLines` already treats lone CR as a terminator, but `endOfStreamPosition` recognizes a trailing terminator only through `endsWith("\n")`.
- failure: Missing-end-marker diagnostics and absence inference votes have line/character coordinates that disagree with their EOF offset on CR-terminated input.
- fix: Recognize trailing lone CR when calculating EOF line and character, alongside LF and CRLF. Add exact-position checks for one and multiple trailing CR terminators.

### sol-3-7
- file: scratchpad/effected/yaml/internal/rules/document-end.ts:129
- class: bug   severity: required
- standard: D11; section 14 verified upstream-bug protocol; the document-count fidelity invariant already applied to the round-2 document-start fix.   evidence: Commit-pinned read-only probes show `YamlLint.fix("...\n", builtins, config)` with `document-end: { present: false }` succeeding with `""`; `"# c\n...\n"` becomes `"# c\n"`. Independent `yaml.parseAllDocuments` reports one explicit empty document before either fix and zero documents afterward. The pinned upstream has the same inherited bug. The removal condition checks only that the marker occupies its line, without determining whether that marker is the empty document’s sole structural carrier.
- failure: Removing a forbidden document-end marker can erase an explicit empty document from the stream.
- fix: Keep the diagnostic but withhold removal when the final document has neither content nor an explicit start marker that independently preserves it. Evaluate the final document’s structure rather than using the first-document lint context. Add standalone and comment-prefixed empty-document fidelity regressions and register the verified upstream bug under section 14.

REQUIRED: 7
BACKLOG: 0