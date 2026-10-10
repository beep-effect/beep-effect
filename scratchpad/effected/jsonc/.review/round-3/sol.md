### sol-3-1
- file: scratchpad/effected/jsonc/Jsonc.ts:396
- class: bug   severity: required
- standard: `scratchpad/EFFECTED_PORT_GOAL.md` D9 and D11; pinned oracle `src/Jsonc.ts:213–218` compares array elements by index and stops at the first mismatch.   evidence: A read-only differential probe on Node 24.20.0 compared `Jsonc.equalsValue("[1,2]", value)` with `value[0] === 9` and a getter at index `1` that increments a counter and throws `RangeError("unneeded getter")`. Oracle: `false`, counter `0`. Lab: throws `RangeError`, counter `1`. The installed `A.zip` eagerly reads every pair before `A.every` starts comparing.
- failure: An already-unequal array executes later getters unnecessarily and can throw instead of returning `false`. Eager reads also change the order of getter side effects relative to recursive comparison. The existing equality properties use ordinary JSON values and miss this behavior.
- fix: Remove the eager `A.zip` and compare corresponding indices through a short-circuiting traversal, such as `A.every` over the parsed array. Add a regression proving that a later getter is never read after an earlier mismatch.

### sol-3-2
- file: scratchpad/effected/jsonc/JsoncModifier.ts:210
- class: bug   severity: required
- standard: `scratchpad/EFFECTED_PORT_GOAL.md` D9 and D11; `standards/effect-first-development.md` EF-1; pinned oracle `src/JsoncModifier.ts:129–134` returns a typed `JsoncModificationError` for navigation mismatches.   evidence: Read-only Node and Bun differential probes of `JsoncModifier.modify("{}", [-1], 2)` produce oracle `Fail(JsoncModificationError)` and lab `Die(Error("Schema validation failed"))`. The same divergence occurs with `[0.5]`, `[-1, "x"]`, and `[0.5, "x"]`. The error constructor validates `path` against `JsoncPath`, whose `JsoncSegment` uses `S.Natural`.
- failure: Negative and fractional segments remain valid inputs to the public TypeScript signature, but a navigation mismatch with either segment defects while constructing its diagnostic. Callers cannot recover through `Effect.catchTag("JsoncModificationError", ...)`. The recorded final-index no-op behavior does not cover this mismatch path.
- fix: Allow finite numeric segments in the shared path/diagnostic schema, keeping the separate `S.Natural` guard where actual array indexing requires it. Add mismatch regressions for negative and fractional segments that assert a typed `JsoncModificationError` carrying the original path.

### sol-3-3
- file: scratchpad/effected/jsonc/JsoncVisitor.ts:316
- class: bug   severity: required
- standard: `scratchpad/EFFECTED_PORT_GOAL.md` D11 and section 14’s verified `upstream-bug` exception; the recovery-progress invariant documented at `JsoncVisitor.ts:244–246`.   evidence: A read-only Node differential probe of `JsoncVisitor.visit("[}").pipe(Stream.take(12), Stream.runCollect)` returns `ArrayBegin`, then alternating `ValueExpected` and `CommaExpected` errors at offset `1` in both lab and oracle. `visitValue` preserves `CloseBrace`, while `visitArray` stops only at `CloseBracket` or EOF; every subsequent iteration therefore encounters the same token. This is an inherited upstream bug, absent from the recorded deviations.
- failure: Collecting the complete visitor stream for the two-character input `[}` never terminates and accumulates events without bound. An array inside an object, such as `{"a":[}`, also prevents the enclosing object from recovering at its closer. Green coverage does not establish progress on mismatched closers.
- fix: End the array loop when it encounters `CloseBrace` as well as `CloseBracket` or EOF. Let `closeContainer` emit `CloseBracketExpected` while preserving the brace for the enclosing object. Record the verified upstream-bug deviation under section 14 and add terminating recovery regressions for both inputs.

REQUIRED: 3
BACKLOG: 0

