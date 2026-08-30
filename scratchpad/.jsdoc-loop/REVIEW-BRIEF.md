# Round 1 JSDoc reviewer brief

You are a **read-only** JSDoc reviewer for the scratchpad quality loop.

## Write permission

Write **exactly one file**: `scratchpad/.jsdoc-loop/inventory/round-1/<PACK>.md`

Do not edit source, tests, docgen config, census, or any other inventory file.

## Binding law (read these)

- `.patterns/jsdoc-documentation.md`
- `.agents/skills/jsdoc-annotation-specialist/references/conventions.md`
- `.agents/skills/jsdoc-annotation-specialist/references/annotation-patterns.md` (schemas)
- Categories: `packages/tooling/library/repo-utils/src/schemas/JSDocCategories.ts`

## Census input

- Pack overview: `scratchpad/.jsdoc-loop/packs/<PACK>/README.md`
- Slice: `scratchpad/.jsdoc-loop/packs/<PACK>/slice.json`
- Full census if needed: `scratchpad/.jsdoc-loop/census.json`

If this prompt names a **file glob subset**, only review those files, still using the pack slice.

## What to review

For **every exporting module** and **every owning export** (`kind` is `value` or `type`, never a barrel `re-export`):

1. Confirm or reject each census mechanical finding. Common false positives:
   - JSDoc lives on the `export const` statement (census was fixed; leftover misses still possible)
   - `export { Foo }` / `export { default }` graph edges (not owning)
   - Type-level flagged for a required Example
   - Config files (`drizzle.config.ts`) — report as `note`, not a docs rewrite
2. Add editorial findings that cite law or a concrete caller-confusion risk:
   - Lead restates the name/signature
   - Missing Gotcha that the implementation comments already warn about
   - Missing described `@see` / `{@link}` to a sibling a caller must choose
   - Vacuous Example (`void x`, unused binding, no observable result)
   - Legacy `@example` / `@remarks` / `@module` / `@template`
   - Bare `@see` without a purpose phrase
   - Wrong `@category` (topology like `exports`/`core` instead of a role)
   - Missing `$I.annote` / `$I.annoteSchema` / same-name type alias on exported schemas
   - Example imports from `@effected/*` or named `Schema`/`Option`/`Array` imports
3. Module header required: useful lead, `@packageDocumentation`, `@since 0.0.0`. Never `@module`.

## Reject (do not open)

- Extra Examples when one titled, observable Example already exists
- Empty `**When to use**` / `**Details**` filled just to complete the shape
- Documenting barrel re-exports as new symbols
- Taste-only wording churn

## Item format

```md
### <PACK>-R1-<nnn>: <title>

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue | suggestion
- `blockingStatus`: blocking
- `severity`: P1-high | P2-medium
- `doctrineBucket`: target-doctrine-violation | cleanup-on-touch | not-doctrine
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: <path:line>
- `symbol`: <name>
- `kind`: module | value | type
- `evidence`: <quote or census rule>
- `impact`: <why a caller or the ratchet cares>
- `suggestedFix`: <smallest doc fix>
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: <PACK>
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: none
- `status`: open
- `fixedCommit`: pending
```

Group identical mechanical misses (for example every export in a file missing `@category` `@since` and a titled Example) into **one item per file** with the symbol list in `evidence`, plus separate items for editorial Gotchas / bad Examples / wrong leads.

## Closing section of your file

```md
## Pack verdict

- files reviewed: N
- owning exports reviewed: N
- confirmed mechanical items: N
- editorial items: N
- rejected false positives: N
- accepted findings: N
```

If you reviewed every owning export and have zero accepted findings, say so explicitly. Do not skip files.
