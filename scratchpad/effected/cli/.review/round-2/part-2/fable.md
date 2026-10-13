<!-- seat: grok-4.7 medium (third seat; Fable and cursor Opus quota exhausted, 2026-10-09) -->
I'll review the assigned CLI rendering and UI files against the port decisions, round-1 inventory, and the pinned upstream oracle. No files will be written.Round-1 required items on these files are recorded as fixed in the ledger. I'll check the current sources for incomplete fixes and new divergences the gates would miss.The remaining focus-file tails and the literal-domain law text still decide whether anything new clears D11. I'll read those before writing findings.### fable-2-1
- file: scratchpad/effected/cli/GithubAnnotation.ts:10
- class: schema   severity: required
- standard: D5; `standards/effect-laws-v1.md` short laws 17 and 19; `standards/effect-first-development.md` EF-12b. Same class as closed cli-6, cli-7, and cli-8. This site is absent from `scratchpad/effected/cli/.review/round-1/INVENTORY.md`.
- evidence: `export type AnnotationLevel = "error" | "warning" | "notice"` is a named, reused literal domain. `Doc.ts:582` repeats those three literals as `S.Literals(["error", "warning", "notice"])` on `AnnotationOptions.level`. The cli schema-first deviation lists LiteralKit for color, token, status, key, and span only. `exportsExpected` still records `AnnotationLevel` as kind `type`.
- failure: The GitHub annotation level has no single annotation-bearing schema. The exported name and the document field can drift, and membership and enumeration cannot be derived from `AnnotationLevel`.
- fix: Add one identity-annotated `LiteralKit` for `error`, `warning`, and `notice`. Derive `export type AnnotationLevel` from its `.Type`, and use that schema as `AnnotationOptions.level`. Keep the package barrel type-only, as `NamedColor` is, and extend the existing schema-first deviation site list.

### fable-2-2
- file: scratchpad/effected/cli/Doc.ts:545
- class: docs   severity: backlog
- standard: D11. Docgen already checks example execution and section shape. The prose contradicts the schemas those checks compile.
- evidence: Line 545 says "nothing decodes them" immediately before `S.is(Block)(Doc.paragraph("Ready"))`. Line 878 says "nothing decodes or encodes one" and that a document is not meant to be serialised. `scratchpad/test/cli/Doc.coverage.test.ts:23` encodes and decodes `Block`. `scratchpad/test/cli/Doc.property.test.ts:49` round-trips `AnnotationOptions`.
- failure: The public `Block` and `Doc` contracts tell callers that documents are neither decoded nor encoded, while the schemas and those tests do both. A later edit can drop the codecs on that instruction.
- fix: Rewrite both sentences so constructors still return plain objects and do not decode, and the schemas remain the decode and encode contract for structural nodes, with `overflow` and `total` staying function fields.

REQUIRED: 1
BACKLOG: 1
