### fable-2-1
- file: scratchpad/effected/jsonc/Jsonc.ts:718
- class: bug   severity: required
- standard: EFFECTED_PORT_GOAL.md D9 + section 14 (every unrecorded observable difference is a deviation that needs a cause; round-1 precedent R14/R15); README Port notes -> Deviations has no entry for stripComments   evidence: `Str.replace` is `(searchValue, replaceValue) => self => self.replace(searchValue, replaceValue)` (node_modules/effect/dist/String.js:215), so `Str.replace(/[^\n\r]/g, replaceCh)(comment)` hands `replaceCh` to String.prototype.replace as a replacement PATTERN; upstream Jsonc.ts:533-537 pushes `replaceCh` per character literally. Read-only differential probe (bun, lab index.ts vs upstream dist/dev/pkg/index.js, effect 4.0.1 both sides): `stripComments("/* ab */1", "$&")` lab => "/* ab */1" (the comment survives), upstream => "$&$&$&$&$&$&$&$&1"; `"$'"` lab => "* ab */ ab */ab */b */ */*//1", upstream => "$'$'$'$'$'$'$'$'1"; single characters ("$", "x") agree. No lab test passes a `$`-sequence, so the gate cannot see it.
- failure: A caller replacing comment characters with any `$`-bearing string gets a different document than upstream, and for `$&` the comments are not stripped at all while the function reports success; nothing in the README deviations or the ledger says the lab diverges here.
- fix: Use a function replacement, which String.prototype.replace inserts literally: `Str.replace(/[^\n\r]/g, () => replaceCh)(comment)` (one token), and pin it with `assert.strictEqual(Jsonc.stripComments("/* ab */1", "$&"), "$&$&$&$&$&$&$&$&1")` in Jsonc.test.ts; otherwise record the difference as a deviation with a cause.

### fable-2-2
- file: scratchpad/effected/jsonc/Jsonc.ts:649
- class: law   severity: required
- standard: EFFECTED_PORT_GOAL.md D9 + section 14 (unrecorded deviation); .patterns/jsdoc-documentation.md (lead/Details must be accurate: Jsonc.ts:327 says the message renders "the engine's detail")   evidence: Lab `detail` is `error.message` of the `S.fromJsonString` SchemaError for every code except TopLevelUnrepresentable; upstream Jsonc.ts:463-469 carries the engine's TypeError message. Probe: `stringifyResult(1n)` lab => ["BigIntValue", "Expected a JSON-serializable value"], upstream => ["BigIntValue", "JSON.stringify cannot serialize BigInt."]; cyclic object lab => ["CircularReference", "Expected a JSON-serializable value"], upstream => ["CircularReference", "JSON.stringify cannot serialize cyclic structures."]. README deviation 1 and the ledger row record only the throwing-`toJSON` case (code SerializationFailed), not that `detail` lost the engine text for the two upstream codes; no lab test asserts `detail` for these codes.
- failure: `JsoncStringifyError.detail` (a public field) and the rendered `message` no longer carry the engine's reason for BigInt and cycle failures, every such error renders the same generic schema sentence, and the `message` JSDoc describes behaviour the port does not have; a consumer or a later S0 refresh has no deviation entry explaining the change.
- fix: Smallest: add the `detail` text change to README deviation 1 and the ledger `deviations` row (cause law:13, the codec reports a schema issue instead of the engine throw) and reword the `message` doc at Jsonc.ts:327 to "the failure detail"; alternatively keep upstream parity by emitting a per-code detail string from the replacer branch that classified the failure (e.g. "JSON.stringify cannot serialize BigInt.") and pin both details in `fails with BigIntValue ...` and the cycle test.

### fable-2-3
- file: scratchpad/test/jsonc/Jsonc.test.ts:509
- class: test   severity: required
- standard: goals/effect-vitest-canon/SPEC.md D5 (Option/Result/Exit values inside it.effect are asserted with @effect/vitest/utils helpers); .patterns/testing-patterns.md "Choose assertions by value, not by tester"; round-1 R5 treated the same class as required   evidence: Jsonc.test.ts:509 inside `it.effect("schema(Target) decodes JSONC straight into a domain value")`: `S.decodeResult(strict)('{ "name": "app", "version": 1, }').pipe(Result.isFailure, assertTrue)` asserts a Result through a boolean, checking neither the failure payload nor its tag. The same shape sits at scratchpad/test/jsonc/JsoncNode.test.ts:68 (`S.decodeResult(JsoncNode)({...}).pipe(Result.isFailure, assertTrue)`, plain `it`). The S3 note says the canon detectors are clean, so the syntax-only detector does not match this form; JsoncModifier.test.ts:62 already shows the canonical shape (`assertFailure(Result.mapError(decoded, (error) => error._tag), "SchemaError")`).
- failure: The test passes for any failure at all (a parse failure, a schema-level failure, or a future regression that fails for an unrelated reason), and the suite carries a non-canon Result assertion the detector cannot see.
- fix: `assertFailure(Result.mapError(S.decodeResult(strict)('{ "name": "app", "version": 1, }'), (error) => error._tag), "SchemaError")` at Jsonc.test.ts:509, and the same rewrite at JsoncNode.test.ts:68 (drop the now-unused `assertTrue` import there if nothing else uses it).

### fable-2-4
- file: scratchpad/effected/jsonc/Jsonc.ts:750
- class: effect-idiom   severity: backlog
- standard: standards/effect-laws-v1.md "Dual-Arity Inventory Contract" (public helper APIs; `(input, options?)` shapes are exempt, `(a, b)` shapes are not); @effect/tsgo `missingPipeableSignature` (effect-tsgo internal/rules/missing_pipeable_signature.go)   evidence: Verification of the user's tsgo concern: pinned tsgo 0.47.2 (`bun run --cwd scratchpad tsgo -p effected/jsonc/tsconfig.json --noEmit --pretty false`) and the editor's newest cached tsgo 0.50.0 (coverage/tsgo-editor/0.50.0/tsc, same args) both exit 0 on effected/jsonc AND effected/runner with `missingPipeableSignature: "error"` from tsconfig.base.json:176; the gate canary (scratchpad/effected/.canary/EffectDiagnosticsCanary.ts:12 `canaryPair`) proves that rule is live, and the cited runner/Ledger.schema.ts:306 `exportKindCovers` is already a `dual(2, ...)` with a `(expected) => (actual) => boolean` overload, so the reported diagnostic does not reproduce under either binary. The rule's only blind spot in jsonc is structural: it walks `GetExportsOfModule` and `GetSignaturesOfType(..., SignatureKindCall)`, and a class value has construct signatures only, so the facade statics with two required data parameters are never inspected: `Jsonc.equals(a, b)` (Jsonc.ts:750), `Jsonc.equalsValue(text, value)` (:773), `JsoncEdit.applyAll/applyAllResult(text, edits)` (JsoncEdit.ts:240, :282), `JsoncFingerprint.hashResult(value, digest)` (JsoncFingerprint.ts:464), `hashTextResult(text, digest, options?)` (:530). None has a pipeable form; the module-level internals (`parseValue`, `parseTree`, `navigate`, `createScanner`) are dual.
- failure: The abstract-class facade (upstream API shape, kept under D2) carries six public two-argument helpers that cannot be used data-last in a `pipe`, and no gate will ever report them; at promotion the dual-arity inventory would list them.
- fix: No change now (upstream shape, D2/D9). Record the static-facade exemption in the ledger backlog, and at promotion either export module-level `dual` twins (e.g. `export const applyAll = dual(2, JsoncEdit.applyAll)`) or accept the facade shape in the inventory with a reason.

### fable-2-5
- file: scratchpad/effected/jsonc/JsoncModifier.ts:182
- class: jsdoc   severity: backlog
- standard: .patterns/jsdoc-documentation.md Kind-split Example law (required on value-level exports; the class `JsoncModifier` carries one, so this is a consistency gap, not a law break)   evidence: The `modify` doc block (JsoncModifier.ts:161-181) has a lead, Details, @param and @returns but no `**Example**`; every other static in the module (Jsonc.parse*/stringify*/stripComments/equals*/fromString/schema/bind, JsoncEdit.applyAll*, JsoncFormatter.format*, JsoncFingerprint.*, JsoncVisitor.visit, JsoncNode.find/findAtOffset/pathAt/toValue) carries one. Docgen is green because `enforceExamples` is satisfied by the class-level Example.
- failure: Hover on `JsoncModifier.modify`, the module's one orchestration entry point, shows no runnable usage while every sibling static does; readers must scroll to the class doc or the README.
- fix: Add `**Example** (Change one value and keep the comment)` with the README's three-line `modify` + `applyAll` snippet (or move the class-level example down) before the @param tags.

### fable-2-6
- file: scratchpad/test/jsonc/Jsonc.test.ts:142
- class: test   severity: backlog
- standard: .patterns/testing-patterns.md (tests are readable specifications); upstream __test__/Jsonc.test.ts "counts U+2028/U+2029 as line breaks in error positions" names the code points   evidence: `sed -n 142p | od -c` shows the literal bytes `{ 342 200 250 b a d 342 200 251 }`: the source embeds raw U+2028 and U+2029 inside `Jsonc.parse("{ bad }")`, which renders as an ordinary space in editors and in the review diff, while the sibling assertion at line 111-118 for the visually identical `"{ bad }"` expects line 0 / character 2.
- failure: Two visually identical strings assert different positions; an editor, formatter or copy-paste that normalizes line separators silently turns the LS/PS case into a duplicate of the plain case and the test keeps passing for the wrong reason.
- fix: Write the escapes: `Jsonc.parse("{ bad }")` (and keep the comment naming LS/PS).

### fable-2-7
- file: scratchpad/effected/jsonc/JsoncFormatter.ts:109
- class: effect-idiom   severity: backlog
- standard: standards/effect-laws-v1.md law 21 (tersest equivalent form); AGENTS.md Code Laws (direct helper refs over trivial lambdas)   evidence: `const applyGapDepthFromNewLine = <T extends { depth: number }>({ depth }: T) => newline(depth);` introduces a type parameter over an inline structural type for a callback whose every call site is a `Match.when` arm already typed `(g: Gap) => string` (lines 113-118); the other arms use the plain `(g) => ...` form.
- failure: Readers must parse a generic constraint to learn that the arm returns `newline(g.depth)`; no behaviour change.
- fix: `const gapAtDepth = (g: Gap): string => newline(g.depth);` (or inline `(g) => newline(g.depth)` in the three arms).

### fable-2-8
- file: scratchpad/effected/jsonc/internal/navigate.ts:154
- class: effect-idiom   severity: backlog
- standard: AGENTS.md Code Laws (named schema building blocks over ad-hoc); standards/effect-laws-v1.md law 19 (named literal domains through the kit, `S.Literals` only for anonymous inline unions)   evidence: `located = (container: "object" | "array", ...)` restates the `NavigateContainer` kit's type (`typeof NavigateContainer.Type`) declared 110 lines above in the same file; the same restatement appears at internal/parser.ts:465 (`leafTree = (type: "string" | "number" | "boolean" | "null", ...)`, a subset of `JsoncNodeType`) and JsoncVisitor.ts:181 (`separator = (character: "," | ":")`, the `JsoncVisitorEvent` Separator field).
- failure: Adding or renaming a kit literal does not reach the hand-written parameter unions, so the compiler reports the drift at the call sites instead of at the domain; no runtime effect today.
- fix: `container: typeof NavigateContainer.Type` (or export `type NavigateContainer = typeof NavigateContainer.Type` beside the kit); `type: typeof JsoncNodeType.pick(["string", "number", "boolean", "null"]).Type` or a named `LeafNodeType` kit in parser.ts; derive the separator character type from `JsoncVisitorEvent` in the visitor.

### fable-2-9
- file: scratchpad/effected/jsonc/JsoncNode.ts:8
- class: docs   severity: backlog
- standard: repo formatting conventions (biome/oxlint import sort); fable-1-12 recorded the same class for JsoncEdit.ts only   evidence: JsoncNode.ts:8 imports `effect/Record` above `@beep/identity/packages` and puts `@beep/utils/thunk` and `effect/Function` (lines 16-17) after the local `./internal/limits.ts` import; JsoncModifier.ts:8-9 orders `effect/Record` before `effect/Array`; JsoncFormatter.ts:8-20 opens with `effect/Match`, places `effect/Record` after `effect/Schema` and `@beep/utils/thunk` last; JsoncVisitor.ts:197 reads `for (; ;)`; JsoncModifier.ts:203-211 spreads the `Mismatch` arm's destructured parameter over five lines. Every other lab module keeps `@beep/*` first and `effect/*` alphabetical.
- failure: Cosmetic drift the next biome pass over the promoted package rewrites wholesale, producing a noisy diff unrelated to behaviour.
- fix: One import-sort/format pass over JsoncNode.ts, JsoncModifier.ts, JsoncFormatter.ts and JsoncVisitor.ts (no semantic change).

REQUIRED: 3
BACKLOG: 6
