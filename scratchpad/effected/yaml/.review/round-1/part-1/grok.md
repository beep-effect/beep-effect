I'll review the yaml port against the pinned upstream oracle and the D1–D20 decisions, starting with the binding notes and the nine files in this brief.Decisions and port notes come first so I only flag divergences the ledger has not already accepted.The remaining gap is `YamlLintRule.ts` and the `YamlFormat` facade tail. I'll compare those against the pinned oracle, then report only findings that survive the gates and the recorded deviations.`YamlLintRule.ts` is the schema model and matches the oracle. Next I’ll check `YamlFormat`’s modify path and the token constructor against the same commit.### grok-1-1
- file: scratchpad/effected/yaml/YamlFormat.ts:127
- class: bug   severity: required
- standard: D9; `schema-number` (`effect-tsgo/docs/rules/schema-number.md`); `effect/src/internal/effect.ts` generator catch   evidence: `YamlPath` is `string | number` (`YamlEdit.ts:30`). `YamlModificationError.path` is `S.Array(S.Union([S.String, S.Finite]))`. `schema-number` states that `S.Number` accepts `NaN` and `±Infinity` and `S.Finite` does not. Upstream `YamlModificationError.path` is `Schema.Union([Schema.String, Schema.Number])`. `modify` does not decode `path` on entry. On `MultiDocumentStream`, a fatal parse, or directives it calls `YamlModificationError.make({ path, ... })` directly (`YamlFormat.ts:951`, `:968`, `:974`). A navigation `ModifyFailure` does the same inside `Effect.try`'s `catch` (`:1005`). `S.Finite` makes `.make` throw for `NaN` or `±Infinity`. A throw in an `Effect.fn` generator is `die` (`fromIteratorEagerUnsafe`, `effect/src/internal/effect.ts:1407`). A throw inside `Effect.try`'s `catch` is a defect (`Effect.ts:2487`).
- failure: `YamlFormat.modify("---\na: 1\n---\nb: 2\n", [NaN], 1)` and `YamlFormat.modify("- a\n", [NaN], 1)` fail with `YamlModificationError` upstream, so `Effect.catchTag("YamlModificationError")` recovers. The port dies while building that error. The same split holds for `±Infinity` whenever navigation fails (`Index Infinity out of bounds`). A last-segment `Infinity` on a sequence still appends on both sides (`Infinity < length` is false) and is not this bug.
- fix: This field echoes `YamlPath`, so non-finite numbers are intentional. On this field only, use `S.Number` and disable `schema-number` for that line (the rule's own escape hatch). Do not stringify the segment.

### grok-1-2
- file: scratchpad/effected/yaml/YamlFormat.ts:492
- class: bug   severity: backlog
- standard: D9; section 14 `upstream-bug`   evidence: `idx` rejects only `NaN` and `< 0`. A last-segment delete calls `newItems.splice(idx, 1)` (`:499`); `splice` applies `ToInteger`, so `1.5` deletes index `1`. A last-segment replace assigns `newItems[1.5]` (`:501`), which is not an array index, so the following `YamlSeq.make` drops it and the edit succeeds with no change. Upstream `YamlFormat.ts:479-490` does the same. A deeper non-integer (`[1.5, "x"]` on a sequence of length greater than 1) is the one port difference: `items[1.5]` is `undefined`, and line 512 throws `YamlFormatInvariantFailure` with message `Cannot read properties of undefined (reading '_tag')`. Upstream casts past that hole and throws `TypeError` with the same message. Both are defects; `catchTag("YamlModificationError")` misses both.
- failure: `modify("- a\n- b\n- c\n", [1.5], undefined)` deletes `b` on both sides. `modify(..., [1.5], "z")` reports success and leaves the document unchanged on both sides. Deeper non-integers die with a different defect class in the port.
- fix: Leave it if the contract stays upstream. If fixed, reject `!Number.isInteger(idx)` with `ModifyFailure` `"InvalidIndex"` in `modifyNode` and `findExistingTarget` (`:605`) before `splice` or assign, and record `upstream-bug` (ECMAScript `ToInteger` on `splice`, plus the non-index assign) in the ledger and Port notes.

### grok-1-3
- file: scratchpad/effected/yaml/YamlToken.ts:109
- class: docs   severity: backlog
- standard: D9 hot-path comment vs `effect/src/Schema.ts` class constructor   evidence: The comment says construction uses `new` so it skips the validating `make`. The next statement is `YamlToken.make` (`:112`). Upstream `YamlToken.ts:103` really uses `new YamlToken`. In this Effect, the class constructor also validates: `struct.make(input)` unless a payload token is set (`Schema.ts:15193-15198`).
- failure: The comment describes a validation-free hot path the function does not take. Restoring `new` still runs `struct.make`.
- fix: Delete the two comment lines. Do not switch the call for speed without a measurement.

### grok-1-4
- file: scratchpad/effected/yaml/YamlToken.ts:138
- class: jsdoc   severity: backlog
- standard: `.patterns/jsdoc-documentation.md` (S2 not run; D11 JSDoc overridden to backlog by this brief)   evidence: `@remarks` is forbidden, and examples must be titled `**Example** (Title)` sections. `@remarks` / `@example` remain on `YamlToken.ts:138`, `YamlNode.ts:268`, `YamlFormat.ts:91`, `YamlDocument.ts:168`, `YamlLint.ts:364`, `YamlDiagnostic.ts:125`, and `YamlEdit.ts:56`. `Yaml.ts` and `YamlLintRule.ts` do not use those tags.
- failure: Exported docs still use the upstream tag shape. Docgen and the JSDoc law will fail when S2 runs.
- fix: In the S2 pass, rewrite those blocks to a lead paragraph plus `**Details**` / `**Gotchas**` / `**Example** (Title)`. Do not drop example bodies.

REQUIRED: 1
BACKLOG: 3
