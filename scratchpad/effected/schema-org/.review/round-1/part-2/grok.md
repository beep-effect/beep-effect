I'll review `vocabulary.ts` against the pinned upstream oracle and the port decisions, and report findings only.The data tables are generated literals. I'll read the decode and walk logic, the port decisions, and the upstream oracle next.The tables match the upstream shape. I'll diff the hand-written lookups and check how callers use them.### grok-1-1
- file: scratchpad/effected/schema-org/internal/vocabulary.ts:4592
- class: effect-idiom   severity: required
- standard: standards/effect-first-development.md EF-5 and LLM review checklist item 6 (no native `String` helpers in domain logic). `effect/String.ts` `split` is `dual` and calls `self.split(separator)`.
- failure: `decodeRow` tokenizes index rows with `row.split(",")`. That is the module's only native string helper, on the reused subclass, domain, and superseded-pair encoding. `Str.split(row, ",")` yields the same parts, so generated rows keep the same indexes.
- fix: Import `* as Str from "effect/String"` and iterate `Str.split(row, ",")`.

### grok-1-2
- file: scratchpad/effected/schema-org/internal/vocabulary.ts:4580
- class: effect-idiom   severity: backlog
- standard: `effect/MutableHashMap` ("in-place updates are acceptable"); upstream `vocabulary.ts:4577-4607` types the same tables as `ReadonlySet` / `ReadonlyMap`. EF-5 allows `HashMap` and `HashSet` for data that is not updated.
- failure: `FOREIGN_PREFIX_SET`, `TYPE_INDEX`, `PROPERTY_INDEX`, `SUPERSEDED_TYPE_MAP`, and `SUPERSEDED_PROPERTY_MAP` are process-wide mutable singletons. Nothing in the module writes them after init (`Vocabulary.ts` and `Conformance.ts` only call `has` / `get`). `MutableHashMap.remove(TYPE_INDEX, "Thing")` typechecks and would make later `Vocabulary.hasType("Thing")` false for the rest of the process. Upstream's readonly types reject that call.
- fix: Build the set with `HashSet.fromIterable` and the maps with `HashMap.fromIterable` / `HashMap.set` (use the value `HashMap.set` returns). Point `Vocabulary.ts` and `Conformance.ts` at `HashMap.has` / `HashMap.get` and `HashSet.has`. Those call sites do not iterate the collections.

### grok-1-3
- file: scratchpad/effected/schema-org/internal/vocabulary.ts:33
- class: jsdoc   severity: backlog
- standard: `.patterns/jsdoc-documentation.md` (value exports need a titled `**Example**`); `scratchpad/EFFECTED_PORT_GOAL.md` section 10.2 (`@category`, `@since 0.0.0`, `@internal` kept, prose that teaches behaviour kept). S2 has not run, so this stays backlog.
- failure: Every value export from `VOCABULARY_VERSION` through `SUPERSEDED_PROPERTY_MAP` is a one-line summary plus `@internal`, with no `@category`, no `@since`, and no titled Example. `decodeRow` (line 4589) is the behaviour-bearing case: an empty row is `[]`, and that sentence has to survive as **Details** or **Gotchas**. Section 10.2 docgen (`enforceExamples`, `enforceVersion`) fails on this shape.
- fix: At S2, convert each value export to the beep carrier. Keep the empty-row sentence on `decodeRow`, and add one compiling Example.

REQUIRED: 1
BACKLOG: 2
