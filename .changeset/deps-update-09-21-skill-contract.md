---
"@beep/skill-contract": patch
---

Pin `BudgetDuration` to the whole-millisecond representation its JSON encoding carries: the check now rejects sub-millisecond nanosecond values and magnitudes past the safe-integer range in addition to infinite and negative durations. effect rc.117 derives `Duration` arbitraries from the JSON codec (nanosecond bigints of any magnitude included), and such values encoded to `Infinity` or to a millisecond count that decoded to a different `Duration`, which broke the schema-derived round-trip and projection properties.
