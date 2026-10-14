### sol-3-1
- file: scratchpad/effected/jsonc/Jsonc.ts:396
- class: bug   severity: required
- standard: D9 (behavior preservation), D11 (bugs are required).   evidence: A read-only `bun -e` probe compared `Jsonc.equalsValue("[1,2]", value)` with the pinned upstream, using `value = [9, 2]` and an accessor at index `1`. With a counting getter, upstream returned `false` with **0 getter reads**; the lab returned `false` with **1 getter read**. With that getter throwing `Error("late getter")`, upstream still returned `false`; the lab threw `late getter`. Effect’s `A.zip` eagerly reads every pair before `A.every` begins comparing.
- failure: Array comparison loses upstream’s short-circuit behavior. An element after an already unequal element can execute caller code or throw unnecessarily. This affects nested arrays as well as top-level arrays passed to `equalsValue`.
- fix: Replace the eager `A.zip` with an indexed comparison loop that returns `false` immediately on the first unequal pair. Add regressions proving that a later counting or throwing getter is never read after an earlier mismatch.

### sol-3-2
- file: scratchpad/effected/jsonc/JsoncVisitor.ts:316
- class: bug   severity: required
- standard: D11 (bugs are required); D9 / section 14 (`upstream-bug` deviation supported by a reproducer); the malformed-input recovery contract exercised by `scratchpad/test/jsonc/JsoncVisitor.test.ts:100`.   evidence: Read-only probes collecting `Stream.take(JsoncVisitor.visit("[}"), 8)` produced `ArrayBegin`, then alternating `ValueExpected` and `CommaExpected` errors at offset `1`, in both the lab and pinned upstream. Taking 50 events from `[}`, `{"a":[}`, and `[1,}` likewise exhausted the event limit while repeatedly reporting the same closing-brace offset. `visitValue` leaves `CloseBrace` unconsumed, while `visitArray` stops only at `CloseBracket` or EOF; no subsequent iteration changes the cursor.
- failure: A finite malformed document produces an infinite visitor stream. Full collection never completes and continues accumulating error events. A missing array closer inside an object also prevents recovery from reaching the enclosing object’s closer.
- fix: Stop the array loop when it encounters `CloseBrace`, allowing `closeContainer` to emit `CloseBracketExpected` and leave the brace for the enclosing object. Add bounded recovery regressions for the three inputs above, and record the verified upstream-bug deviation in the README and ledger before changing behavior.

REQUIRED: 2
BACKLOG: 0

