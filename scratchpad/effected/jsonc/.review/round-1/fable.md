### fable-1-1
- file: scratchpad/effected/jsonc/JsoncFormatter.ts:146
- class: bug   severity: required
- standard: D9 behaviour-preserving (EFFECTED_PORT_GOAL.md section 2) and section 14 (a different formatted byte is a deviation)   evidence: Lab decrements depth for every closer before the previous-token guard (lines 146-148); upstream JsoncFormatter.ts:102-104 decrements only inside `if (!firstToken && prevTokenEnd >= 0)`. Trace of `formatToString("] [1]")`: lab depth goes -1 at the leading `]`, so `1` gets newline(0) = "\n" and the final `]` gets newline(-1) = "\n" (Str.repeat clamps via Count.normalize) => "] [\n1\n]"; upstream keeps depth 0 at the leading closer, so `1` gets "\n  " => "] [\n  1\n]". Not recorded in PORT_LEDGER.json deviations or README Port notes.
- failure: Any document whose first non-trivia token is a closer (an editor formatting a partially typed or sliced buffer) is indented one level shallower than upstream for every token after it; `format` output diverges byte-for-byte from the oracle on inputs upstream handles.
- fix: Move `if (isCloser(kind)) { depth--; }` inside the `if (O.isSome(previous)) { ... }` block, before `gap` is computed, so a leading closer never decrements (upstream parity); pin with `assert.strictEqual(JsoncFormatter.formatToString("] [1]"), "] [\n  1\n]")`.

### fable-1-2
- file: scratchpad/effected/jsonc/JsoncFormatter.ts:103
- class: law   severity: required
- standard: D9 + section 14 deviation protocol (every observable difference is ledgered first); README Port notes -> Deviations   evidence: `Str.repeat` is `self.repeat(Count.normalize(count))` with `normalize = n => n > 0 ? Math.floor(n) : 0` (node_modules/effect/dist/String.js:643, internal/count.js:7), so a negative depth yields "" in the lab. Upstream uses `indentUnit.repeat(d)` (JsoncFormatter.ts:84) and throws `RangeError: Invalid count value: -1` on unbalanced closers. Trace `format("]]")`: lab returns `[JsoncEdit{offset:1,length:0,content:"\n"}]` ("]\n]"); upstream throws. `format("[1]]")` likewise. This difference survives fable-1-1 and is absent from the ledger `deviations` array and the README Deviations list; no lab test pins it.
- failure: An unrecorded behaviour deviation: the lab is total where upstream raises a defect, and the next S0 refresh or a reviewer comparing against the oracle has no entry saying so; the totality claim in the `JsoncFormatter` lead ("Pure and total") is true only in the lab and nothing proves it.
- fix: Add a ledger `deviations` row and README Port notes entry (cause `upstream-bug:` RangeError defect from a function documented pure and total; no upstream test passes unbalanced closers) and pin it in JsoncFormatter.test.ts, e.g. `assert.deepStrictEqual(JsoncFormatter.format("]]"), [JsoncEdit.make({ offset: 1, length: 0, content: "\n" })])` plus a hostile-text totality property (`Str.trim` of every edit content is "") in Properties.test.ts.

### fable-1-3
- file: scratchpad/effected/jsonc/JsoncVisitor.ts:140
- class: bug   severity: required
- standard: D11 bug; section 14 `upstream-bug:` (upstream JsoncVisitor.ts:100 has the same shape and no test reruns a stream)   evidence: `Stream.fromIterable(visitGen(...))` wraps a generator OBJECT created once per `visit` call. `Stream.fromIterable` -> `Channel.fromIterableArray` -> `fromIteratorArray(() => iterable[Symbol.iterator]())` (node_modules/effect/dist/Stream.js:662, Channel.js:501): the iterator is re-acquired per run, but a generator object's `[Symbol.iterator]()` returns itself, so the second run resumes an exhausted generator. Reasoning: `const s = JsoncVisitor.visit('{ "a": 1 }'); yield* Stream.runCollect(s); yield* Stream.runCollect(s)` yields 5 events then []. A `Stream` is a re-runnable description everywhere else in Effect; the doc block promises "a lazy Stream of typed events".
- failure: Reusing one `visit` stream value (e.g. `s.pipe(filter ObjectProperty, runCollect)` then `s.pipe(filter Comment, runCollect)`, or `Stream.retry`/`Stream.repeat` combinators) silently returns no events on every run after the first; no error, no event, wrong answer.
- fix: `return Stream.fromIterable({ [Symbol.iterator]: () => visitGen(text, options?.disallowComments ?? false) })` (or `Stream.suspend(() => Stream.fromIterable(visitGen(...)))`, both in the installed v4), add a test that collects the same stream twice and asserts equality, and record the `upstream-bug:` deviation in the ledger and README.

### fable-1-4
- file: scratchpad/test/jsonc/JsoncParser.test.ts:15
- class: law   severity: required
- standard: D13 ("module internals in tests by relative path too"), section 11.2 ("Test files import package source through relative paths (section 5.2)"), section 5.2 item 2   evidence: `rg -n '@beep/scratchpad/effected/jsonc' scratchpad/test/jsonc`: JsoncParser.test.ts:15 (`.../internal/parser`), JsoncNavigate.test.ts:4 (`.../internal/navigate`), JsoncScanner.test.ts:3 (`.../internal/scanner`), JsoncFormatter.test.ts:4 (`.../index`). The sibling files already use the mandated form (Jsonc.test.ts:22 `../../effected/jsonc/index.ts`, JsoncNode.test.ts:12 `../../effected/jsonc/JsoncNode.ts`). The parity gate only rejects `@effected/*`, so it does not catch this.
- failure: D13 exists so promotion is a path rewrite; four files resolve through the `@beep/scratchpad` alias and will silently keep pointing at the lab (or break) when the module moves to its provisional home, while the rest of the suite moves with it.
- fix: Rewrite the four specifiers to `../../effected/jsonc/internal/parser.ts`, `../../effected/jsonc/internal/navigate.ts`, `../../effected/jsonc/internal/scanner.ts` and `../../effected/jsonc/index.ts`.

### fable-1-5
- file: scratchpad/effected/jsonc/JsoncModifier.ts:62
- class: schema   severity: required
- standard: standards/effect-laws-v1.md law 19 (LiteralKit for NAMED internal literal domains; `S.Literals` for anonymous inline unions); AGENTS.md Code Laws ("named LiteralKit internal domains"); crispen literal-family collapse   evidence: `expected: LiteralKit(["object", "array"])` builds an anonymous inline kit, while the same domain already exists as the named, identity-annotated `NavigateContainer` kit (internal/navigate.ts:40), which this file already imports (line 16) and uses (line 234 `NavigateContainer.is.object`). The field is neither the named kit nor `S.Literals`, so it sits outside both halves of law 19 and creates a second literal family with a second identity for one concept.
- failure: Two schemas describe one container-kind domain; a future addition (or rename) to `NavigateContainer` does not reach `JsoncModificationError`, and the error's `expected` annotations carry no identity of their own.
- fix: `expected: NavigateContainer,` (one-token change; `NavigateContainer.Type` is already `"object" | "array"`, so `JsoncModificationError.make({ expected: "array" })` in tests and docs is unchanged).

### fable-1-6
- file: scratchpad/effected/jsonc/Jsonc.ts:449
- class: jsdoc   severity: required
- standard: .patterns/jsdoc-documentation.md "Rules for all sections": `**When to use**` opens with `Use to`, `Use when`, `Use as`, or `Use with`   evidence: `Jsonc.parseResult`'s section reads "Use at synchronous boundaries such as a plain config loader or a build script." The other three sections in the module comply (scanner.ts:187 "Use as", JsoncEdit.ts:26 "Use with", JsoncFingerprint.ts:451 "Use when"). The runner's JsdocLaw.ts only matches section names and order (`SECTION`/`SECTION_ORDER`, lines 24-25); it does not check the opener, so the docgen/JSDoc gate missed this.
- failure: A JSDoc-law break on a public export's doc block that the gate cannot see; the repo-wide jsdoc ratchet will reject it at promotion.
- fix: Rewrite the opener: "Use when a synchronous boundary such as a plain config loader or a build script needs the value. Inside Effect code reach for {@link Jsonc.parse}, ...".

### fable-1-7
- file: scratchpad/effected/jsonc/internal/parser.ts:400
- class: perf   severity: required
- standard: D11 algorithmic-class regression versus upstream (O(n) -> O(n^2)); upstream parser.ts:273/418 use `arr.push`/`children.push`   evidence: `A.append` is `dual(2, (self, last) => [...self, last])` (node_modules/effect/dist/Array.js:477): a full copy per call. Every container accumulator in the parser grows by `x = A.append(x, ...)` inside the entry loop: `items` (line 400), `children` (508, 540, 555, 567) and `errors` (277, hit once per recovered error). An array of n elements therefore performs sum_{k<n} k = n(n-1)/2 element copies: 5x10^7 for the 10,000-element wide-document test (which passes only because 10^4 is small), 5x10^9 for 100,000 elements. Upstream is O(n) per container (`push`). No measurement taken; the class argument is exact.
- failure: Parse time is quadratic in the width of any array or object instead of linear, so large flat documents (lockfiles, generated arrays) parse orders of magnitude slower than the oracle and the "linear in node count" test name no longer describes the implementation.
- fix: Accumulate into a local mutable `Array<T>` with `.push` (`const items: Array<unknown> = []` / `const children: Array<JsoncNode> = []` / `let errors: Array<RawParseError> = []`) and return it as `ReadonlyArray<T>`; no API change, same values. Apply the same at the error recorder (line 277).

### fable-1-8
- file: scratchpad/effected/jsonc/JsoncFormatter.ts:133
- class: perf   severity: required
- standard: D11 algorithmic-class regression versus upstream (O(e) -> O(e^2)); upstream JsoncFormatter.ts:88 `edits.push`, Jsonc.ts:531 `parts.push`, scanner.ts:126 `chunks.push`   evidence: Same copying `A.append` (Array.js:477) used as the per-document accumulator: formatter `edits` (line 133, one edit per token gap, so e ~ token count), `Jsonc.stripComments` `parts` (Jsonc.ts:699, 702; one per comment), and the scanner's `chunks` (scanner.ts:265, 276, 280; one per escape inside a string). Formatting a compact 100k-token document builds ~100k edits with ~5x10^9 element copies; upstream does e pushes.
- failure: `JsoncFormatter.format`/`formatToString` are quadratic in the number of reflowed gaps, `stripComments` quadratic in comment count and string scanning quadratic in escape count, all linear upstream.
- fix: Use a local mutable `Array<...>` with `.push` for `edits`, `parts` and `chunks` (returned/joined as before).

### fable-1-9
- file: scratchpad/effected/jsonc/Jsonc.ts:628
- class: perf   severity: required
- standard: D11 algorithmic-class regression versus upstream (upstream classifies the native `JSON.stringify` throw in O(1) after an O(n) serialization)   evidence: Per object/array node visited by the replacer, lines 628-632 run `A.reverse` (Array.from + reverse, O(d)), `A.dropWhile` (O(d) copy), `A.reverse` (O(d)) and `A.append` (O(d)), where d is the current ancestor depth; the copies happen regardless of how many ancestors are popped. Total work is Theta(m*d) for m container nodes; for a chain nested d deep that is Theta(d^2) with ~4 array allocations per level (d = 10^4 => ~2x10^8 element copies before the native stringify even runs). Upstream `stringifyResult` is O(n). The visitor repeats the pattern per entry at JsoncVisitor.ts:288/297 and 312/314 (`A.append`/`A.dropRight` of `path`, O(d) each, Theta(n*d) overall vs upstream push/pop).
- failure: `Jsonc.stringify`, `JsoncModifier.modify` (which serializes through it) and `Jsonc.fromString` encoding become quadratic in nesting depth; deep but legal documents (stringify has no depth cap) spend most of their time copying the ancestor stack.
- fix: Keep `ancestors` as a local mutable stack and pop until the holder is on top: `while (ancestors.length > 0 && ancestors[ancestors.length - 1] !== this) ancestors.pop(); if (ancestors.includes(current)) code = CircularReference; ancestors.push(current);` (amortized O(1) per node; the `includes` is only reached for container nodes and can be a `MutableHashSet` if the cycle scan itself matters). In the visitor, keep `path` as a mutable `Array<JsoncSegment>` with push/pop and snapshot with `A.copy(path)` when building an event.

### fable-1-10
- file: scratchpad/effected/jsonc/Jsonc.ts:49
- class: effect-idiom   severity: backlog
- standard: crispen literal-family collapse; AGENTS.md Discovery & Reuse   evidence: `JsoncParseErrorCode = LiteralKit(ParseCode.literals).annotate(...)` constructs a second kit over the same 17 literals that `ParseCode` (internal/parser.ts:46) already is; `JsoncNodeType` shows the kit's `.annotate` returns a kit, so `ParseCode.annotate($I.annote("JsoncParseErrorCode", {...}))` yields the same public value with one literal family. Upstream needed the split only because its parser exported a plain array.
- failure: Two kits for one domain to keep in step; no runtime failure.
- fix: `export const JsoncParseErrorCode = ParseCode.annotate($I.annote("JsoncParseErrorCode", { description: ... }));`

### fable-1-11
- file: scratchpad/effected/jsonc/JsoncFormatter.ts:23
- class: effect-idiom   severity: backlog
- standard: .patterns/module-organization.md; AGENTS.md Discovery & Reuse (search before recreating a shared helper)   evidence: `S.is(SyntaxKind.pick([...]))` guards are re-derived in five modules: isComment x3 (Jsonc.ts:400, JsoncFormatter.ts:26, JsoncVisitor.ts:145) plus parser.ts:251, isCloser/isOpener x2 (JsoncFormatter.ts:24-25, skip.ts:35-36), trivia subsets x3 (JsoncFormatter.ts:23, JsoncVisitor.ts:144, parser.ts:250), closer-or-EOF x2 (JsoncVisitor.ts:147, skip.ts:37).
- failure: Drift risk when a token subset changes (e.g. a new comment kind) and seven places must agree; no runtime failure today.
- fix: Export the derived guards once beside `SyntaxKind` in internal/scanner.ts (`isComment`, `isTrivia`, `isOpener`, `isCloser`, `isNotAValue`) and import them.

### fable-1-12
- file: scratchpad/effected/jsonc/JsoncEdit.ts:247
- class: docs   severity: backlog
- standard: repo formatting conventions (biome) and sorted namespace imports; not gated by the runner   evidence: Line 247 reads `Str.substring( 0, edit.offset)(result)` (stray space after the paren); lines 12-13 import `effect/String` before `effect/Option`, out of the alphabetical order every other module in the lab keeps.
- failure: Cosmetic; the next biome pass over the promoted package rewrites it.
- fix: `Str.substring(0, edit.offset)(result)` and move the `Str` import below `S`.

### fable-1-13
- file: scratchpad/effected/jsonc/internal/navigate.ts:44
- class: effect-idiom   severity: backlog
- standard: standards/effect-laws-v1.md law 21 (tersest equivalent form); crispen helper-wall deletion   evidence: `const Container = NavigateContainer;` exists only to be referenced three times inside `NavigateResult`; the exported name is equally short.
- failure: One extra indirection to read; no runtime effect.
- fix: Delete the alias and reference `NavigateContainer` directly in the `NavigateResult` fields.

### fable-1-14
- file: scratchpad/effected/jsonc/Jsonc.ts:412
- class: jsdoc   severity: backlog
- standard: .patterns/jsdoc-documentation.md Category annotation ("most specific canonical kebab-case role"); JSDocCategories.ts   evidence: `JsoncBoundCodec` (an interface bundling a codec with its two directions) and `JsoncDigest` (JsoncFingerprint.ts:187, a function type alias) both carry `@category services`; they are not services. Canonical roles that fit are `codecs` (JsoncBoundCodec) and `type-level` or `ports` (JsoncDigest, the consumer-supplied platform binding).
- failure: Docgen groups two type-level exports under Services next to the facade classes; readers looking for the codec bundle under Codecs miss it.
- fix: `@category codecs` on JsoncBoundCodec; `@category ports` (or `type-level`) on JsoncDigest.

### fable-1-15
- file: scratchpad/effected/jsonc/JsoncEdit.ts:137
- class: docs   severity: backlog
- standard: .patterns/jsdoc-documentation.md (lead explains the symbol's purpose accurately)   evidence: The `JsoncEditOverlapError` lead says "Raised by {@link JsoncEdit.applyAllResult} when two edits overlap", but `applyAllResult` RETURNS it as a `Result` failure (line 250) and `applyAll` is what throws it (line 283); the Gotchas on `applyAll` describe it correctly. Similarly JsoncNode.ts:284 opens the `JsoncNode` namespace block with "The encoded companion of JsoncNode", which describes its member `Encoded`, not the namespace.
- failure: Hover text points callers at the wrong entry point for the throw; no runtime effect.
- fix: "Returned by {@link JsoncEdit.applyAllResult} and thrown by {@link JsoncEdit.applyAll} when two edits overlap."; for the namespace: "Type-level companions of {@link JsoncNode}: the plain recursive record the class decodes from and encodes to."

### fable-1-16
- file: scratchpad/effected/jsonc/JsoncModifier.ts:225
- class: law   severity: backlog
- standard: standards/effect-laws-v1.md law 12 (`Bool.match` for boolean branching in domain/runtime orchestration code)   evidence: `modify` is the module's one orchestration effect and branches with ternaries on `deleting` (line 225) and `insert.isFirst` (line 237); the scanner/parser/formatter loops also use ternaries and `if`, but those are hot lexing paths, not orchestration, and the closed jsonl/jsonc rounds accepted that split. Not enforced by the four runner laws.
- failure: Style divergence from law 12 inside the orchestration effect only; behaviour unchanged.
- fix: `Bool.match(deleting, { onTrue: () => Effect.succeed(edits()), onFalse: () => Effect.gen(...) })` and the same for `insert.isFirst` when building `content`.

REQUIRED: 9
BACKLOG: 7
