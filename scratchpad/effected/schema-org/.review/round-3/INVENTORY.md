# schema-org round-3 inventory

Seats read: `part-1/grok.md`, `part-1/sol.md`, `part-1/fable.md`,
`part-2/grok.md`, `part-2/sol.md`, `part-2/fable.md`, with both adjacent
`BRIEF.md` files. Five seats report no findings; `part-2/sol.md` reports one.
Counts: required 0; backlog 1; deviation codemod 0; rejected 0; groups 0.

The briefs pin `3ad7b305790c7f0903f6d55766c55186745ba2d1`. The inspected checkout is
on `@lab/effected-2` at `576451bec24c6452dc359a863b5c99e4f7888fef`, rather than the
requested `@lab/effected`; `git diff --stat <brief-commit> HEAD --
scratchpad/effected/schema-org scratchpad/test/schema-org` is empty. The binding
merge instructions and operator revisions override the briefs' severity guidance.
`standards/effect-laws.allowlist.jsonc` contains zero entries for
`scratchpad/effected/schema-org/**`, so there are no `allow-<n>` additions.

## Required

None. No required write groups are needed.

## Backlog

### backlog-1
- file: scratchpad/effected/schema-org/internal/vocabulary.ts:2557,3518,4472,4507,4762-4764
- class: jsdoc   severity: backlog
- standard: This merge's explicit docs/JSDoc deferral; `.patterns/jsdoc-documentation.md`, Hard requirements, "Example code uses Effect patterns"; `standards/effect-first-development.md` EF-3 and EF-19; D11.
- evidence: `part-2/sol-3-1` identifies seven `JSON.stringify` calls in JSDoc example fences. Read-only inspection with `git show HEAD:scratchpad/effected/schema-org/internal/vocabulary.ts` confirms all seven at the cited lines. The pinned upstream `src/internal/vocabulary.ts` has no `JSON.stringify` match. The seat explains the gate gap: these calls are in comments outside the source AST diagnostics, and example compilation permits these expressions. This is separate from round-2 backlog-8, which addresses native `.map` and `.includes` in examples.
- failure: The added examples teach native JSON encoding contrary to the cited Effect guidance. The defect concerns documentation, so the explicit merge rule reclassifies the seat's required finding to backlog even with concrete evidence of a gate gap.
- fix: During JSDoc cleanup, remove the seven `JSON.stringify` wrappers and log the decoded arrays directly. Retain the comments describing the returned values and preserve every demonstrated result. No runtime or test change is needed.
- seats: part-2/sol-3-1

## Handled by the deviation codemod

None. No round-3 seat submitted a finding that only requests recording a law-forced change.

## Rejected

None. The only submitted finding has evidence and a concrete fix; it is retained as backlog.
