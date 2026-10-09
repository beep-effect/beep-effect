I'll review the jsonc port against the upstream oracle and the binding decisions, and report only findings the green gates would miss.The port notes and ledger are loaded. Next I’ll diff the lab against the upstream oracle and check the S4 idiom bar the gates do not enforce.### grok-1-1
- file: scratchpad/effected/jsonc/JsoncNode.ts:363
- class: bug   severity: required
- standard: D9 behaviour-preserving; upstream `JsoncNode.find` (`packages/jsonc/src/JsoncNode.ts:97`)   evidence: lab `childAt` resolves a numeric segment with `A.get`. Effect `Array.get` does `Math.floor` before the bounds check (`effect/src/Array.ts:962`). Upstream reads `children[segment]`. In JavaScript `children[0.5]` and `children[1.5]` are `undefined`, so `find` is `Option.none()`. `Math.floor(0.5)` is `0` and `Math.floor(1.5)` is `1`, so a non-empty array returns that element. `S.Natural` is not applied at the `find` boundary (`find` takes the array as-is), and `[-1]` / `[0.5]` already typecheck on `JsoncModifier.modify` in `scratchpad/test/jsonc/JsoncModifier.test.ts:74`. Coverage does not catch this: integer indices take the same branch.
- failure: `parseTree("[10,20]").find([0.5])` is `Option.some` of the `10` node. Upstream is `Option.none()`. `find([1.5])` returns the `20` node upstream misses.
- fix: before `A.get`, accept only `Number.isInteger(segment) && segment >= 0`; otherwise `O.none()`.

### grok-1-2
- file: scratchpad/effected/jsonc/JsoncFormatter.ts:146
- class: bug   severity: required
- standard: D9; upstream `formatImpl` (`packages/jsonc/src/JsoncFormatter.ts:97-104`)   evidence: upstream decrements depth only while computing a gap, and that block is skipped for the first structural token. The lab decrements every closer before the `previous` check. `Str.repeat` goes through `Count.normalize`, which maps a non-positive count to `0` (`effect/src/internal/count.ts:7`), so a negative depth becomes an empty indent instead of `String.prototype.repeat`'s `RangeError`.
- failure: `formatToString('}{"a":1}')` is `}\n{"a": 1\n}`. Upstream keeps depth at `0` across the leading `}` and then indents the object: `}\n{\n  "a": 1\n}`. `formatToString('{"a":1}}')` returns text; upstream throws `RangeError` on `" ".repeat(-1)` when the surplus `}` is indented. Succeeding is not the typed-channel failure the hardening note requires, and it is not recorded under section 14.
- fix: decrement depth only for a closer that already has a predecessor, matching upstream. If the count would go negative, throw a tagged error from `format` / `formatToString` (same posture as `JsoncEditOverlapError`) and record that under section 14 as `law:7`.

### grok-1-3
- file: scratchpad/effected/jsonc/JsoncFingerprint.ts:262
- class: bug   severity: required
- standard: D9; upstream `emit` object arm (`packages/jsonc/src/JsoncFingerprint.ts:236-252`)   evidence: upstream walks keys in UTF-16 order and checks `key.isWellFormed()` immediately before `readProperty` for that key, so an earlier key's getter runs first. The lab rejects the first ill-formed key in the whole key list before `emitMembers` reads anything.
- failure: for `{ a: <getter that throws>, "\uD800": 1 }`, sort order is `"a"` then U+D800. Upstream fails `UnrepresentableValue` at `/a`. The lab fails `LoneSurrogate` at the surrogate's pointer and never calls the getter.
- fix: drop the pre-pass. Inside the sorted `emitMembers` step, fail `LoneSurrogate` for that key before `readProperty`, then read and emit, so earlier keys still run.

### grok-1-4
- file: scratchpad/effected/jsonc/JsoncModifier.ts:182
- class: docs   severity: required
- standard: section 14 (D9); deviation 1 only covers `Jsonc.stringifyResult`   evidence: `modify` serializes through `Jsonc.stringify`, and `Modify` is `Effect<..., JsoncStringifyError | JsoncModificationError>` (`JsoncModifier.ts:129`). Upstream `modify` calls `JSON.stringify` (`packages/jsonc/src/JsoncModifier.ts:122`) and the effect fails only with `JsoncModificationError`; a `bigint`, a cycle, or a throwing `toJSON` escapes the generator as a defect. No deviations entry or ledger row mentions `modify`.
- failure: `JsoncModifier.modify('{ }', ["a"], 1n)` fails typed with `JsoncStringifyError`. Upstream dies. Callers that handle only `JsoncModificationError` now see a second failure type.
- fix: keep the typed failure (`law:7`). Add the README deviation and the ledger row, citing a `modify` test for `bigint` or a throwing `toJSON`.

### grok-1-5
- file: scratchpad/effected/jsonc/JsoncModifier.ts:232
- class: bug   severity: backlog
- standard: D9; deviation 2 records indent columns only   evidence: `Str.replaceAll("\n", `${fmt.eol}${indent}`)` rewrites every `JSON.stringify` newline to the configured `eol`. Upstream uses `eol` only on the wrapper (`packages/jsonc/src/JsoncModifier.ts:173-175`) and leaves `\n` inside the value. Default `eol` is `\n`, so the recorded tests hide it.
- failure: `modify` with `formattingOptions: { eol: "\r\n" }` emits `\r\n` inside a multi-line inserted value. Upstream keeps those bytes as `\n`.
- fix: either record it on deviation 2, or replace `\n` with `\n${indent}` so only the indent columns change.

### grok-1-6
- file: scratchpad/effected/jsonc/JsoncModifier.ts:63
- class: schema   severity: backlog
- standard: D9; upstream `JsoncModificationError.offset` (`packages/jsonc/src/JsoncModifier.ts:40`)   evidence: upstream's schema has `offset: Schema.optionalKey(Schema.Number)`. The lab struct is `path`, `expected`, `depth` only. `modify` never set `offset` upstream, and the rendered message matches when it is absent. Carried `KNOWLEDGE.md:41` still documents `offset?`.
- failure: a payload or constructor call that includes `offset` is outside the lab schema. `modify` results themselves are unchanged.
- fix: restore `offset` as an optional key, or add a port note that the never-populated field was removed.

REQUIRED: 4
BACKLOG: 2
