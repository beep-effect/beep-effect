---
title: "P3: merge reports the least conflict and orders the captures, so it commutes on refusals too; CaptureMismatch is the @beep/text one"
date: 2026-11-22
lane: "goals/text-knowledge-stack-rebuild-p3-annotation"
reversal: "Return the first conflict found and restrict L2-1 commutativity to compatible documents, by a decision file with the ledger row"
---

The design module's `merge` reported the first conflict found by iteration with fixed sides, so `merge(a, b)` and `merge(b, a)` could fail with different values. `merge` now collects every `GenerationTimeConflict` and returns the least by (annotation id, activity id), with `left` the earlier time (`None` first). A `CaptureMismatch` names the two identities in a fixed order of their eight fields. The L2 copy of `CaptureMismatch`, with the same tag and fields as `@beep/text/LocatorMap`, goes; `merge` returns the text one, whose annotation description is widened from two locator maps to any two values that name different captures.

Simulated on this base over 400 generated document triples, 4 percent of the left documents on a second capture and times drawn from none and two instants, 23 of the pairs refused: idempotent 400 of 400, commutative including refusals 400 of 400, associative 363 of 363 where both groupings succeed.
