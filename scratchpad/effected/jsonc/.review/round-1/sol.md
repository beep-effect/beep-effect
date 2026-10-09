### sol-1-1
- file: scratchpad/effected/jsonc/JsoncFingerprint.ts:237
- class: bug   severity: required
- standard: `scratchpad/EFFECTED_PORT_GOAL.md` D9, D11 and §14; upstream `JsoncFingerprint.ts` short-circuits on the first canonicalization failure.   evidence: `Result.all(A.map(keys, ...))` evaluates every recursive member before `Result.all` can short-circuit. A read-only differential probe using a shared 12-level graph with two getters per level and an invalid leaf produced **8,190 getter reads in the lab versus 12 upstream**. For `{ a: undefined, b: new Proxy({}, { getPrototypeOf() { throw new Error("later member observed"); } }) }`, upstream returned `Failure(UnrepresentableValue, "/a")`; the lab threw `"later member observed"`.
- failure: Later members are inspected after canonicalization has already failed, introducing observable getter side effects and allowing a later exception to replace the expected typed failure. A cycle with two references to itself expands both branches recursively: traversal grows exponentially toward the 256-level cap, whereas upstream stops after the first failing branch.
- fix: Replace the eager `A.map` with a lazy iterable of per-member results passed to `Result.all`, so no subsequent member is evaluated after the first failure. Add a regression asserting that a later getter is never called after an earlier member fails.

### sol-1-2
- file: scratchpad/effected/jsonc/internal/parser.ts:400
- class: perf   severity: required
- standard: `scratchpad/EFFECTED_PORT_GOAL.md` D11’s measured-regression or algorithmic-class criterion.   evidence: Installed Effect implements `A.append(self, last)` as `[...self, last]`. Repeatedly appending each parsed element therefore copies `0 + 1 + … + (n − 1)` elements: **Θ(n²)** accumulation versus upstream’s amortized **Θ(n)** `push` accumulation. A read-only `bun --eval` differential probe parsing flat arrays measured lab/upstream times of **24/3 ms for 2,000 elements, 86/5 ms for 8,000, and 186/5 ms for 16,000**. The same growing-array copy occurs in parser error and AST-child accumulation, scanner escape chunks (`internal/scanner.ts:265`), formatter edits (`JsoncFormatter.ts:133`), and stripped-comment parts (`Jsonc.ts:699`).
- failure: Wide documents, strings containing many escapes, and documents containing many comments or formatting edits incur quadratic copying introduced by the port. The nesting cap does not bound these flat-input cases.
- fix: Replace these grow-by-copy accumulators with local `effect/MutableList` builders, then convert to arrays once at their result boundaries. Preserve the existing element, diagnostic, and edit order.

### sol-1-3
- file: scratchpad/effected/jsonc/JsoncFingerprint.ts:262
- class: bug   severity: required
- standard: `scratchpad/EFFECTED_PORT_GOAL.md` D9 and §14 explicitly treat a different error order as a behavioral deviation; D11 makes an unrecorded behavioral bug required.   evidence: A read-only differential probe of `canonicalizeResult({ a: undefined, [String.fromCharCode(0xd800)]: 1 })` returned **`UnrepresentableValue` at `/a` upstream**, but **`LoneSurrogate` at the later key in the lab**. Upstream validates each sorted key immediately before processing that member; the lab scans all keys for invalid Unicode before processing any values. Neither the README deviations nor the jsonc ledger row records this change.
- failure: A later invalid key takes precedence over an earlier invalid value, changing the public error code and JSON-pointer path callers receive.
- fix: Move key well-formedness validation into the sequential per-member traversal, immediately before reading that member’s value. Add a mixed-invalidity regression that pins upstream’s first-error order.

### sol-1-4
- file: scratchpad/effected/jsonc/Jsonc.ts:607
- class: bug   severity: required
- standard: `scratchpad/EFFECTED_PORT_GOAL.md` D9, D11 and §14; upstream `Jsonc.stringifyResult` classifies the result of serialization after `toJSON` runs. The recorded throwing-`toJSON` deviation does not cover successful `toJSON` conversions.   evidence: Read-only differential probes produced:
  - `Object.assign(() => 0, { toJSON: () => 7 })`: upstream returned `Success("7")`; the lab returned `Failure(TopLevelUnrepresentable)`.
  - `{ toJSON: () => undefined }`, `{ toJSON: () => Symbol("x") }`, and `{ toJSON: () => () => 1 }`: upstream returned `Failure(TopLevelUnrepresentable)`; the lab returned `Failure(SerializationFailed)`.
- failure: The pre-serialization guard rejects a function whose `toJSON` produces valid JSON, while the replacer fails to classify objects whose root `toJSON` result has no JSON representation. This changes both accepted inputs and public error codes.
- fix: Remove the raw-input unrepresentable guard and classify the first root replacer invocation, which receives the value after `toJSON`. Set `TopLevelUnrepresentable` there when appropriate, retain `SerializationFailed` for actual serialization throws, and add regressions for both conversion directions.

### sol-1-5
- file: scratchpad/test/jsonc/Properties.test.ts:304
- class: test   severity: required
- standard: `goals/effect-vitest-canon/SPEC.md` D5 and `.patterns/testing-patterns.md`, “Choose assertions by value, not by tester”; required under `scratchpad/EFFECTED_PORT_GOAL.md` D11.   evidence: Inside the `it.effect.prop` Effect body, both arguments to `assert.deepStrictEqual` are `Result.map(...)` expressions and therefore remain whole `Result` containers. The green gates missed this concrete comparison of tagged containers using an ordinary assertion.
- failure: The hostile-text differential property violates the binding requirement to assert `Result` variants and payloads through the public `@effect/vitest/utils` helpers.
- fix: Match the value parser’s result. In the failure branch, use `assertFailure(tree, expectedError)`; in the success branch, use `assertSuccess` on the tree result mapped to its evaluated value. Preserve the existing comparison of diagnostic payloads and parsed values.

REQUIRED: 5
BACKLOG: 0