# Map

## Candidate Goal Packets

| Slug | Mission | Depends on | Capabilities cited |
| --- | --- | --- | --- |
| `comment-law-gate` | Scanner, exemption grammar, merge-base growth check, scope lock, oxlint rule, `/delete-comment` skill, package `decisions/` home and checks, AGENTS and template changes | none | `@beep/lint-rules` (`src/rules/tsdoc-syntax.ts`, `docs.ts`), `packages/tooling/tool/cli/src/internal/ratchet/`, `Goals/Decisions.schemas.ts`, knowledge doctor evaluators; scanner and growth check NET-NEW |
| `comment-census-defects` | Fix the defects the census found under comments, each a small PR | none | owning packages; ledger outside the repo |
| `comment-law-sweep` | Burn the backlog down in batches: T and S deleted, D to decisions, X families fixed or filed, H and N absorbed | `comment-law-gate` | the skill and checks from the gate goal |
| `jsdoc-lead-single-source` | Derive JSDoc leads from `$I.annote*` descriptions, drop required leads on type-level companions and barrels, lint restating leads | `comment-law-gate` (shared scanner) | `tool/docgen`, `Quality/internal/JSDocDocumentationInventory.ts`, `.patterns/jsdoc-documentation.md`, `standards/effect-laws-v1.md` law 15 |

## Sequencing

`comment-law-gate` and `comment-census-defects` start now and do not touch the same files. The sweep starts
once the growth check is blocking, so the backlog cannot refill. The JSDoc lead change starts when the
scanner exists, and can run beside the sweep.

## First Vertical Slice

In `comment-law-gate`: the scanner and growth check in advisory mode as a cheap-gates lane. A PR that adds a
`//` comment to any package shows a finding naming the comment, and a PR that only moves a commented function
passes. Verified on hosted CI and by replaying the last 100 main commits.

## Open Risks Inherited From The Brief

- Label precision: two votes or an AST-checked rule before any deletion.
- Live tags inside JSDoc must survive.
- Export resolution through `export { x }` and module headers.
- AST identity gaps: JSX whitespace, source-reading tests, line-keyed inventories, sealed files.
- Templates and law text must change before the ban blocks.
- S11 laundering, covered by the scope lock.
- One suppression form for `KEEP (D-nn)` waivers.
