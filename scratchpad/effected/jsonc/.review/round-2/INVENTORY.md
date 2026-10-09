# jsonc review round 2 — inventory

Commit 1dc437fe33 (round 1 fixes). Seats: grok (first run spent its 80-turn budget before
reporting and is kept as grok.failed-max-turns.md; the same session was resumed for the
report), sol, fable.

Counts as reported: grok 3/0, sol 3/0, fable 3/6. After dedupe: 6 required, 6 backlog.

## Required (deduplicated)

| Id | Sources | File | Class | Resolution |
| --- | --- | --- | --- | --- |
| R1 | sol-2-3, fable-2-1 | Jsonc.ts:718 | bug (bytes) | `stripComments` inserts `replaceCh` literally: function replacement, pin `$&`, `$$` and `$'` |
| R2 | grok-2-1, sol-2-2 | Jsonc.ts:631 | bug (error code) | a boxed bigint (`Object(1n)`), top level and nested, classifies as `BigIntValue` |
| R3 | grok-2-2, fable-2-2 | Jsonc.ts:649, :327 | bug (public payload) | recorded as README deviation 11 (see Resolution): `detail` stays the codec's sentence, pinned; the JSDoc no longer promises the engine's text |
| R4 | grok-2-3 | Jsonc.ts:279, JsoncEdit.ts:84 | schema (accepted input) | `tabSize` accepts every finite number as upstream (`S.Finite`); record the two leftovers (non-finite rejected by the schemaNumber rule; negative width formats where upstream throws a RangeError defect), drop the `tabSize: -1` rejection |
| R5 | sol-2-1 | JsoncFingerprint.ts:245 | bug (observes input-owned method) | `emitArray` walks numeric indices re-reading `length`, never `value.keys()`; pin an overridden and a throwing `keys` |
| R6 | fable-2-3 | Jsonc.test.ts:509, JsoncNode.test.ts:68 | test (canon D5) | `assertFailure(Result.mapError(..., (e) => e._tag), "SchemaError")` |

## Backlog

| Id | File | Decision |
| --- | --- | --- |
| fable-2-4 | Jsonc.ts:750 and five more facade statics | recorded: upstream facade shape (D2, D9); decide dual twins at promotion |
| fable-2-5 | JsoncModifier.ts:182 | fixed this round: `modify` gets its own Example |
| fable-2-6 | Jsonc.test.ts:142 | fixed this round: U+2028 and U+2029 written as escapes |
| fable-2-7 | JsoncFormatter.ts:109 | fixed this round: plain `(g: Gap) => string` arm |
| fable-2-8 | navigate.ts:154, parser.ts:465, JsoncVisitor.ts:181 | fixed this round: parameter types derive from the kits |
| fable-2-9 | JsoncNode.ts, JsoncModifier.ts, JsoncFormatter.ts, JsoncVisitor.ts | fixed this round: import order and formatting only |

## Resolution

All six required rows are closed: five restored to upstream, one recorded.

- R3 is a recorded deviation, not a restoration. Only a direct `JSON.stringify` inside a try can
  observe the engine's thrown message; the schema JSON codec the lab must use
  (`standards/effect-first-development.md`, "Never use `JSON.parse` / `JSON.stringify`") discards
  it. README deviation 11, cause `law:13` plus the JSON codec rule, pinned by
  `Jsonc.test.ts` "carries the schema codec's sentence as detail for every thrown failure".
- R2 is restored without that direct call: the code is decided from the value the engine refused
  (a bigint by its internal slot, primitive or boxed).
- R4 restored the accepted input (`S.Finite`) and recorded the two leftovers the row named:
  deviation 13 (a non-finite width is rejected, tsgo `schemaNumber`) and deviation 14 (a width of
  -1 or below stays total where upstream throws a `RangeError`, `upstream-bug`).
- Found by the differential probe while fixing R2 and R3, not raised by a seat: upstream
  classifies a caller-thrown `TypeError` by its message text. Recorded as deviation 12
  (`upstream-bug`, upstream's own JSDoc says caller code failing is never a typed bigint or cycle
  error) and pinned.
- The probe compared lab and upstream on 313 inputs after the fixes: no unexplained difference.

## Rejected

None.
