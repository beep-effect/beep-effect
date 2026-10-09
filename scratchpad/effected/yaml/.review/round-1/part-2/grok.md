I'll review the yaml CST, visitor, and internal parser files against the pinned upstream oracle and the port decisions, and report findings only.The CST, lexer, visitor, and helper files in this slice match the pinned upstream oracle on reachable behavior. The only gaps are JSDoc carriers that S2 has not converted yet.

### grok-1-1
- file: scratchpad/effected/yaml/YamlVisitor.ts:92
- class: jsdoc   severity: backlog
- standard: .patterns/jsdoc-documentation.md (retired `@example` / `@remarks`; titled `**Example**` / `**Details**`)   evidence: `YamlVisitor` still uses `@example` at line 92 and `@remarks` at line 119; `@public`, `@param`, and `@returns` sit on the same block. S2 docgen has not run, and the four S1 gates do not scan these carriers.
- failure: The public visitor docs stay on the retired carriers, so the S2 docgen pass (`enforceDescriptions`, `enforceExamples`, `enforceVersion`) will reject this file.
- fix: Move the `@remarks` prose under `**Details**` and the fenced sample under `**Example** (Visit scalars)`, and drop `@public`.

### grok-1-2
- file: scratchpad/effected/yaml/index.ts:4
- class: jsdoc   severity: backlog
- standard: .patterns/jsdoc-documentation.md (`@remarks` is forbidden)   evidence: The package lead still opens with `@remarks` (lines 4–15), carried from upstream. Same S2 deferral as grok-1-1.
- failure: The module entry’s package docs use the retired remarks carrier.
- fix: Replace that `@remarks` block with a `**Details**` section and keep the lead paragraph.

REQUIRED: 0
BACKLOG: 2
