### sol-2-1
- file: scratchpad/effected/jsonc/JsoncFingerprint.ts:245
- class: bug   severity: required
- standard: `scratchpad/EFFECTED_PORT_GOAL.md` D9, D11 and §14; upstream `JsoncFingerprint.ts` iterates arrays by numeric index, re-reading `length`.   evidence: A read-only `bun --eval` comparison using `[1, 2]` with an own `keys` method returning `[99].values()` produced upstream success `"[1,2]"`, but lab failure `UnrepresentableValue` at `"/99"`. With an own `keys` getter that throws `"keys getter executed"`, upstream still succeeded with `"[1,2]"`, while the lab threw that exception.
- failure: `emitArray` calls the input’s overridable `keys()` method. A non-index array property can therefore change which elements canonicalize, silently omit elements, or throw outside the typed failure channel. This also affects `hashResult`, `canonicalize` and `hash`. The recorded round-1 fixes for short-circuiting and dynamic array length do not authorize observing this additional property.
- fix: Replace `value.keys()` with a lazy numeric-index generator that re-reads `value.length` before each yield, preserving short-circuiting without accessing an input-owned iterator method. Add regression cases for overridden and throwing `keys`.

### sol-2-2
- file: scratchpad/effected/jsonc/Jsonc.ts:631
- class: bug   severity: required
- standard: `scratchpad/EFFECTED_PORT_GOAL.md` D9, D11 and §14; upstream `Jsonc.stringifyResult` classifies the engine’s bigint serialization failure as `BigIntValue`.   evidence: A read-only `bun --eval` comparison of both `Object(1n)` and `{ a: Object(1n) }` returned `BigIntValue` upstream and `SerializationFailed` in the lab.
- failure: The replacer recognizes primitive bigints only. JSON serialization subsequently unboxes a boxed bigint and fails, leaving the lab’s default `SerializationFailed` classification. Callers branching on the public error code receive a different result from upstream. This is separate from the closed round-1 root-after-`toJSON` finding; neither input requires `toJSON`, and the recorded throwing-`toJSON` deviation does not cover it.
- fix: Extend serialization-failure classification to recognize boxed bigints as `BigIntValue`, retaining the schema codec and typed failures. Pin top-level and nested boxed-bigint cases.

### sol-2-3
- file: scratchpad/effected/jsonc/Jsonc.ts:718
- class: bug   severity: required
- standard: `scratchpad/EFFECTED_PORT_GOAL.md` D9, D11 and §14; upstream `Jsonc.stripComments` appends `replaceCh` literally for each non-line-break comment character.   evidence: A read-only `bun --eval` comparison of `stripComments("1/*x*/", "$&")` returned `"1$&$&$&$&$&"` upstream and `"1/*x*/"` in the lab. With `"$$"`, upstream returned ten dollar signs after `1`, while the lab returned five. The parameter accepts `string`, and neither implementation rejects these inputs.
- failure: Passing `replaceCh` as a replacement string interprets JavaScript substitution tokens instead of emitting the supplied text literally. In the `$&` case, the comment remains intact. This is an unrecorded output difference from upstream.
- fix: Use a replacement callback returning `replaceCh`, such as `Str.replace(/[^\n\r]/g, () => replaceCh)(comment)`, and add a literal-dollar-token regression.

REQUIRED: 3
BACKLOG: 0