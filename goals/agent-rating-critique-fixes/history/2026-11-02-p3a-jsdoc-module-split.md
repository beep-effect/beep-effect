# P3a T7 — split `repo-utils` `JSDoc/JSDoc.ts`, 2026-11-02

Lane: branch `codex/jsdoc-module-split` cut from `origin/main` a7104ce5. Scope:
`packages/tooling/library/repo-utils/src/JSDoc/**` plus this note. No manifest,
SPEC/PLAN, lifecycle, registry, root config or test edits.

## Seams and plan

`JSDoc.ts` (5,223 lines) was a flat catalog of 125 tag schema classes, already
grouped by `// <category>` comment headers into 11 category unions, followed by
the `JSDocTag` union of those 11. The category groups do not reference each
other. Every group depends on the same three things: `JSDocTagDefinition`
(`./models`), the file-private `JSDocTagMember<Tag>` type, and the
`$RepoUtilsId.create("JSDoc/JSDocTagDb")` identity.

The split follows those seams exactly:

- `src/JSDoc/tags/<Union>.model.ts`, one per category union, moved verbatim.
  The `.model.ts` role matches the sibling `src/JSDoc/models/*.model.ts`.
- `src/JSDoc/JSDoc.shared.ts` exports the `JSDocTagMember` type, following the
  `TSMorph/TSMorph.shared.ts` precedent.
- Each category file builds its own `$I` with the unchanged identity string,
  so every schema identifier (`@beep/repo-utils/JSDoc/JSDocTagDb/<Name>`)
  stays the same. That avoids exporting an identity composer.
- `JSDoc.ts` is now the facade. It re-exports each category file with
  `export *` and still defines `JSDocTag`.

Dependency direction is one-way: `JSDoc.ts` → `tags/*` → `JSDoc.shared.ts` →
`models/`, with no cycles. Reuse search: no existing helper covers the
tag-member type, and `JSDocTagDefinition.make` stays the single factory.

## Line counts

| File | Before | After |
| --- | ---: | ---: |
| `JSDoc/JSDoc.ts` | 5,223 | 155 |
| `JSDoc/JSDoc.shared.ts` | — | 27 |
| `tags/StructuralJSDoc.model.ts` | — | 687 |
| `tags/AccessModifierJSDoc.model.ts` | — | 706 |
| `tags/DocumentationContentJSDoc.model.ts` | — | 471 |
| `tags/TSDocSpecificJSDoc.model.ts` | — | 510 |
| `tags/InlineJSDoc.model.ts` | — | 158 |
| `tags/OrganizationalJSDoc.model.ts` | — | 358 |
| `tags/EventDependencyJSDoc.model.ts` | — | 233 |
| `tags/RemainingJSDoc.model.ts` | — | 865 |
| `tags/ClosureSpecificJSDoc.model.ts` | — | 667 |
| `tags/TypeDocSpecificJSDoc.model.ts` | — | 467 |
| `tags/TypeScriptSpecificJSDoc.model.ts` | — | 121 |

The largest handwritten file is now 865 lines, under the 2,500 limit.
`models/TSCategory.model.ts` (1,702 lines) was already under the limit and was
not touched.

## Public surface

- The `@beep/repo-utils/JSDoc/JSDoc` subpath is unchanged. A runtime probe
  listed every export with its `typeof`, schema identifier, and a hash of
  `jsDocTagMetadata` + AST tag + union arity. All 126 rows are byte-identical
  before and after. The `export class|const|type|declare namespace`
  declaration names (150) are also identical.
- Additive only: the package's `./*` wildcard export now also resolves
  `JSDoc/JSDoc.shared` and `JSDoc/tags/<Union>.model`. No existing path was
  removed or renamed, and the package manifest is unchanged.

## Validation

| Check | Result | Attribution |
| --- | --- | --- |
| `vitest run test/JSDoc.model.test.ts test/JSDocTagDefinition.golden.test.ts` | 7/7 pass (golden fingerprints unchanged) | — |
| `bun run check` (repo-utils src + tests) | pass | — |
| `biome check .` (repo-utils) | pass (one import-order autofix in the facade) | — |
| `bun run docgen` (repo-utils) | pass, 72 modules, 563 examples typechecked | — |
| `package-verify @beep/repo-utils` (audit) | 216/217 tests. `FsUtils` "directory mid-walk is unreadable" fails | environment-only: the test uses `chmod 000` and the cloud container runs as root. File untouched. Inbox row acked. |
| `package-verify @beep/repo-cli --quick` | lint ok, `src` + `scripts` check ok. `test/goals-manifest-capabilities.test.ts:103` `effectFnOpportunity` | inherited from main (file last changed 2fff63b1, unrelated to JSDoc). Outside this lane's ownership. Inbox row acked. |

Before typechecking, the fresh container needed
`turbo run build --filter=@beep/repo-utils^...` (TS6305, missing upstream
`dist`). That is environment-only.

## Remaining

None for the JSDoc file. The other P3 mega-files (HTML and Quality) belong to
other owners. Merge and the ready flip wait for the parent's independent review
and exact-head proof.
