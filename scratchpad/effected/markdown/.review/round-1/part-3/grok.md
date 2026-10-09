I'll review this markdown slice against the pinned upstream oracle and the port decisions, starting with the binding rules and the files named in the brief.The four beep laws and the assertion gate are already green, so I’m comparing these files to the pinned oracle for behaviour and idiom bugs the gates would miss.### grok-1-1
- file: scratchpad/effected/markdown/internal/lineIndex.ts:77
- class: bug   severity: required
- standard: D9, section 14, `standards/effect-first-development.md` EF-31   evidence: Upstream `packages/markdown/src/internal/lineIndex.ts:67` throws `new TypeError("line index: a line table must be non-empty and start at offset 0")`. The port throws `InvalidLineTableError.make(...)`. Upstream `__test__/hardening.test.ts:193-194` expects `TypeError`; `scratchpad/test/markdown/hardening.test.ts:193-194` was rewritten to `InvalidLineTableError`. README Port notes → Deviations is `None`, and `PORT_LEDGER.json` `w2-markdown.deviations` is `[]`. The comment at line 73 still calls this a wiring defect.
- failure: `LineIndex.fromLineStarts` with an empty table or a table that does not start at 0 throws a schema tagged error (`_tag` `InvalidLineTableError`, `name` the `$ScratchpadId` identifier) instead of a `TypeError`. `instanceof TypeError` and `error.name` diverge. EF-31 keeps invariant violations as defects. No `law:` or `upstream-bug:` record covers the change.
- fix: Restore `throw new TypeError("line index: a line table must be non-empty and start at offset 0")`, restore the test's `TypeError` expectation, and delete `InvalidLineTableError`.

### grok-1-2
- file: scratchpad/effected/markdown/internal/inlineRegistry.ts:144
- class: bug   severity: required
- standard: D9, section 14, `standards/effect-first-development.md` EF-31   evidence: Upstream `packages/markdown/src/internal/inlineRegistry.ts:119` throws `new TypeError(\`unknown markdown dialect: ${String(dialect)}\`)`. The port throws `UnknownInlineDialectError.make({ message: ... })`. The comment at line 139 still says the unknown dialect dies as a defect. README and the ledger record no deviation. The same swap exists at `scratchpad/effected/markdown/internal/blockRegistry.ts:167` (outside this slice).
- failure: A dialect string outside `"commonmark" | "gfm"` (the check is runtime; the union erases) throws a tagged error instead of `TypeError`. `instanceof TypeError` and `error.name` diverge, and the class is not exported, so callers cannot name the new type either.
- fix: Restore `throw new TypeError(\`unknown markdown dialect: ${String(dialect)}\`)` and delete `UnknownInlineDialectError`.

### grok-1-3
- file: scratchpad/effected/markdown/internal/preprocess.ts:14
- class: jsdoc   severity: backlog
- standard: `.patterns/jsdoc-documentation.md` (S2 not run)   evidence: Upstream places `/** Columns of indentation that open an indented code block. */` directly above `export const CODE_INDENT`. The port inserts `import { dual } from "effect/Function"` between that comment and the export.
- failure: The comment now attaches to the import. `CODE_INDENT` has no doc, and an S2 carrier conversion will document the import.
- fix: Move the `dual` import up with the other imports so the comment sits immediately above `export const CODE_INDENT`.

### grok-1-4
- file: scratchpad/effected/markdown/internal/lineIndex.ts:27
- class: jsdoc   severity: backlog
- standard: `.patterns/jsdoc-documentation.md` (S2 not run)   evidence: `@remarks` remains at lines 27, 46, and 64, copied from upstream. The JSDoc law allows `**Details**` / `**Gotchas**` prose and rejects `@remarks`.
- failure: Docgen enforcement in S2 will fail on these three tags.
- fix: Rewrite each `@remarks` block as a `**Details**` section during S2. No behavior change.

REQUIRED: 2
BACKLOG: 2
