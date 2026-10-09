I'll review the frontmatter and markdown document files against the port decisions and the pinned upstream oracle, and report findings only.### grok-1-1
- file: scratchpad/effected/markdown/MarkdownEdit.ts:86
- class: law   severity: required
- standard: standards/effect-laws-v1.md law 10   evidence: `const sorted = [...edits].sort((a, b) => b.offset - a.offset)` calls `Array.prototype.sort`. The S1 gates that are already green (`effect-imports`, `effect-fn`, `terse-effect`, `native-runtime`) do not cover law 10. The closed jsonc port sorts the same way with `A.sort` and `Order.flip(Order.mapInput(Order.Number, …))` (`scratchpad/effected/jsonc/JsoncEdit.ts:185`, `:242`). `effect/Array.sort` copies and then uses a stable native sort, so equal offsets stay in input order.
- failure: `MarkdownEdit.applyAll` sorts edits outside the Effect `Order` law 10 requires.
- fix: Replace the copy-and-`sort` with `A.sort(edits, Order.flip(Order.mapInput(Order.Number, (edit) => edit.offset)))`, importing `A` from `effect/Array` and `Order` from `effect/Order`.

### grok-1-2
- file: scratchpad/effected/markdown/MarkdownEdit.ts:91
- class: docs   severity: backlog
- standard: EFFECTED_PORT_GOAL.md section 14 / D9, effect-laws-v1.md law 7   evidence: Upstream `MarkdownEdit.applyAll` throws `new Error` with the message `MarkdownEdit.applyAll received overlapping edits at offsets …`. The lab throws `OverlappingMarkdownEditsError` (same message text, new `_tag`). `README.md` Port notes → Deviations is `None`, and the markdown ledger row has `deviations: []`. `edit.test.ts` only matches the message regex.
- failure: The thrown error tag differs from the oracle and is not recorded. Law 7 forbids reverting to `new Error`.
- fix: Add one section 14 ledger deviation and the matching Port notes row, cause `law:7`, citing `edit.test.ts`.

### grok-1-3
- file: scratchpad/effected/markdown/FrontmatterResolver.ts:368
- class: docs   severity: backlog
- standard: EFFECTED_PORT_GOAL.md section 14 / D9, effect-laws-v1.md law 7   evidence: Upstream `SchemaResolver.fromRegistry` throws `new Error` for a bad key, a duplicate versionless registration, an illegal version, or a numeric version collision (`FrontmatterResolver.ts` in the oracle, around the `byName` loop). The lab throws private `SchemaRegistryError` at lines 368, 378, 386, and 392. Message strings match. No deviation is recorded. `frontmatter-resolver.test.ts` only asserts that construction throws.
- failure: Registration failures are a different error tag from the oracle, with no ledger or Port notes entry.
- fix: Record one `law:7` deviation covering these four throws.

### grok-1-4
- file: scratchpad/effected/markdown/MarkdownDocument.ts:218
- class: docs   severity: backlog
- standard: EFFECTED_PORT_GOAL.md section 14 / D9, effect-laws-v1.md law 7   evidence: Oracle `walkTree` and `findInTree` throw `new Error("NestingDepthExceeded: limit …")`. The lab throws `DocumentNavigationError` at lines 218 and 239 with that sentence in the `message` field. No deviation is recorded.
- failure: An over-deep hand-built tree fails with `_tag: "DocumentNavigationError"` instead of a plain `Error`.
- fix: Record one `law:7` deviation for both throw sites.

### grok-1-5
- file: scratchpad/effected/markdown/MarkdownEdit.ts:54
- class: docs   severity: backlog
- standard: EFFECTED_PORT_GOAL.md section 14, `@effect/tsgo` rule `schemaNumber`   evidence: Oracle numeric fields are `Schema.Number` (`MarkdownEdit` offset/length, `MarkdownDiagnostic` offset/length/line/character, `MarkdownModificationError` offset/length, `FrontmatterSourceSplit.bodyOffset`). The lab uses `S.Finite`, which rejects `NaN` and infinities at construction. `schemaNumber` is what forces that, and the jsonc ledger already records the same cause. Markdown Port notes and `deviations` are empty.
- failure: `MarkdownEdit.make` / `MarkdownRange.make` / `MarkdownDiagnostic.make` / `MarkdownModificationError.make` / `FrontmatterSourceSplit.make` reject non-finite numbers the oracle schema accepts, and that deviation is unrecorded.
- fix: Add one `law:tsgo-schemaNumber` deviation listing those fields. Do not switch them back to `S.Number`.

### grok-1-6
- file: scratchpad/effected/markdown/MarkdownDiagnostic.ts:104
- class: bug   severity: backlog
- standard: EFFECTED_PORT_GOAL.md D9 / section 14   evidence: `lineChar` is the same as the oracle (`MarkdownDiagnostic.ts:100-108` there). For source `"a\r\nb"` and offset `2` (the LF of the CRLF), the CR branch does `i++` onto that LF, sets `lineStart = i + 1` (3), then the `for` increment moves `i` to 3, which is not `< limit`. Result: `line === 1`, `character === 2 - 3 === -1`. `scratchpad/test/markdown/diagnostic.test.ts` covers a CRLF offset on the following line and an LF offset, not an offset on the LF of a CRLF pair.
- failure: A diagnostic whose offset sits on the LF of a CRLF reports a negative `character`. This is oracle behavior, so changing it is an `upstream-bug` deviation, not a silent port fix.
- fix: If the paired LF index is `>= limit`, do not consume the pair. Record the position change under section 14 with this input as the evidence.

### grok-1-7
- file: scratchpad/effected/markdown/Frontmatter.ts:30
- class: jsdoc   severity: backlog
- standard: `.patterns/jsdoc-documentation.md` (titled `**Example** (Title)` and `**Details**` / `**Gotchas**`; `@example` and `@remarks` are retired). S2 has not run.   evidence: Exported docs in the nine reviewed files still use `@remarks`, `@example`, `@param`, and `@returns` (first hit `Frontmatter.ts:30`; also `FrontmatterResolver.ts`, `FrontmatterSource.ts`, `JsonFrontmatter.ts`, `Markdown.ts`, `MarkdownDiagnostic.ts`, `MarkdownDocument.ts`, `MarkdownEdit.ts`, `MarkdownFormat.ts`). Docgen is not an S1 gate.
- failure: Exported JSDoc is still on the upstream carriers, so it will fail the S2 docgen enforcement flags.
- fix: Leave it for the S2 carrier conversion. Do not strip examples.

REQUIRED: 1
BACKLOG: 6
