### grok-2-1
- file: scratchpad/effected/jsonc/Jsonc.ts:631
- class: bug   severity: required
- standard: D9 / section 14 (error code). Upstream `stringifyResult` classifies a thrown `TypeError` whose message matches `/bigint/i` as `BigIntValue` (`packages/jsonc/src/Jsonc.ts:463-468`). `Predicate.isBigInt` is `typeof === "bigint"` only (`effect/src/Predicate.ts:828-829`).
- evidence: ECMA-262 calls the replacer before unboxing `[[BigIntData]]`, then throws. `Object(1n)` is `typeof "object"` and `instanceof BigInt`, so the replacer takes the `isObjectKeyword` arm and leaves `code` at `SerializationFailed`. The codec catch (`effect/src/SchemaGetter.ts:1456-1460`) drops the `TypeError`, so the `/bigint/i` test never runs. No Port notes entry covers this input. Primitive `1n` still hits `P.isBigInt`, which is why `Jsonc.test.ts:328` stays green.
- failure: `Jsonc.stringifyResult(Object(1n))` and `Jsonc.stringifyResult({ n: Object(1n) })` fail with `SerializationFailed`. Upstream fails with `BigIntValue`. `JsoncModifier.modify` uses the same path.
- fix: In the replacer, set `BigIntValue` for `current instanceof BigInt` before the object arm.

### grok-2-2
- file: scratchpad/effected/jsonc/Jsonc.ts:649
- class: bug   severity: required
- standard: D9 / section 14 (public error payload). Upstream stores `detail: defect.message` (`packages/jsonc/src/Jsonc.ts:465-468`). The carried contract calls that field the engine message (`packages/jsonc/src/Jsonc.ts:142-144`); the lab getter still says "the engine's detail" (`Jsonc.ts:327`).
- evidence: `SchemaGetter.stringifyJson` discards the thrown value and builds `InvalidValue({ expected: "a JSON-serializable value" })`. `SchemaError.message` is `SchemaIssue.defaultFormatter` (`effect/src/Schema.ts:1185-1186`). `reportInput` defaults off (`effect/src/SchemaIssue.ts:168`), so `getExpectedMessage` returns exactly `Expected a JSON-serializable value` (`SchemaIssue.ts:1294-1296`). `Encoding` wrappers recurse to that leaf (`SchemaIssue.ts:1418-1419`). Deviation 1 records only the throwing-`toJSON` channel change, not this payload. `TopLevelUnrepresentable` is unaffected: both sides use the hardcoded sentence (`Jsonc.ts:404`).
- failure: `BigIntValue`, `CircularReference`, and `SerializationFailed` all expose `detail` and `message` as `Expected a JSON-serializable value`. Upstream's `detail` is the engine text (`serialize a BigInt`, `circular structure` / `cyclic`, or the thrown `RangeError` message such as `boom`).
- fix: Take `detail` from the caught `Error.message` inside `stringifyResult`. Keep the hardcoded top-level sentence. Note on deviation 1 that `SerializationFailed` still carries the thrown message.

### grok-2-3
- file: scratchpad/effected/jsonc/Jsonc.ts:279
- class: schema   severity: required
- standard: D9 / section 14 (accepted input). `schemaNumber` only forbids non-finite `S.Number` (`effect-tsgo/docs/rules/schema-number.md`). Upstream `tabSize` is `Schema.optionalKey(Schema.Number)` (`packages/jsonc/src/Jsonc.ts:137`, `JsoncEdit.ts:46`). Same field on `JsoncFormattingOptions` at `JsoncEdit.ts:84`.
- evidence: `S.Natural` rejects `-1` and `1.5`. `JSON.stringify` applies `ToInteger` to `space`: `-1` yields an empty gap (compact, same as `0`) and `1.5` yields one space. `JsoncModifier.test.ts:24` pins the rejection and Port notes do not record it. Deviation 9 covers `offset` only.
- failure: `JsoncStringifyOptions.make({ tabSize: -1 })` and `make({ tabSize: 1.5 })` fail schema decode, so `stringifyResult` never emits the compact document or the one-space indent upstream emits. Formatting options reject the same values; upstream accepts them and `String.prototype.repeat` then throws `RangeError`.
- fix: Widen both `tabSize` fields to `S.Finite`. Record the two leftovers: non-finite `tabSize` stays rejected (`schemaNumber`, same cause as deviation 9), and a negative or fractional `tabSize` formats because `Str.repeat` uses `Count.normalize` (`n > 0 ? Math.floor(n) : 0`, `effect/src/internal/count.ts:7`) where upstream `repeat` throws (same `upstream-bug` as deviation 6). Drop the `tabSize: -1` rejection assertion.

REQUIRED: 3
BACKLOG: 0
