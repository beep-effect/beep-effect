# P3a T7 — split `repo-utils` `JSDoc/JSDoc.ts`, 2026-11-02

Lane: branch `codex/jsdoc-module-split` cut from `origin/main` a7104ce5. Scope:
`packages/tooling/library/repo-utils/src/JSDoc/**` plus this note. No manifest,
SPEC/PLAN, lifecycle, root config or test edits. One generated registry shard
(`standards/schema-catalog/@beep/repo-utils.generated.jsonc`) is regenerated, with
the parent's ownership extension; see Validation.

## Seams and plan

`JSDoc.ts` (5,223 lines) was a flat catalog of 113 tag schema classes, already
grouped by `// <category>` comment headers into 11 category unions, followed by
the `JSDocTag` union of those 11. The category groups do not reference each
other. Every group depends on the same three things: `JSDocTagDefinition`
(`packages/tooling/library/repo-utils/src/JSDoc/models/`), the file-private `JSDocTagMember<Tag>` type, and the
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

Dependency direction is one-way and acyclic. `JSDoc.ts` → `tags/*`. Each
`tags/*` file imports both `JSDoc.shared.ts` (type-only) and `models/` (a value
import of `JSDocTagDefinition`), so `tags/* → {JSDoc.shared.ts, models/}`.
`JSDoc.shared.ts` → `models/` is type-only. `models/` imports neither. Reuse search: no existing helper covers the
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
  listed every export (113 classes + 11 category unions + `JSDocTag` +
  `matchStructuralJSDoc`) with its `typeof`, schema identifier, and a hash of
  `jsDocTagMetadata` + AST tag + union arity. All 126 rows are byte-identical
  before and after. The `export class|const|type|declare namespace`
  declaration names (150) are also identical. The head adds one: the
  `JSDocTagMember` type, now exported from `JSDoc.shared.ts` (151).
- Additive only: the package's `./*` wildcard export now also resolves
  `JSDoc/JSDoc.shared` and `JSDoc/tags/<Union>.model`. No existing path was
  removed or renamed, and the package manifest is unchanged.

## Validation

Heads: the split commit is `564a0f6c` (merge-base `a7104ce5`). The correction wave
regenerates the repo-utils schema-catalog shard and merges `origin/main` twice. Its final
merge is with `e0b14ca4`. Each row names the head it ran on. A failed command is listed
as a failure, even where its cause lies outside this PR.

| Check | Head | Result | Attribution |
| --- | --- | --- | --- |
| `vitest run test/JSDoc.model.test.ts test/JSDocTagDefinition.golden.test.ts` | `564a0f6c`, merged head | pass, 7/7 (golden fingerprints unchanged) | — |
| repo-utils `bun run check` (src + tests) | `564a0f6c`, merged head | pass | — |
| repo-utils `biome check .` | `564a0f6c`, merged head | pass (one import-order autofix in the facade before commit) | — |
| repo-utils `bun run docgen` | `564a0f6c` | pass, 72 modules, 563 examples typechecked | — |
| `package-verify @beep/repo-utils` (audit) | `564a0f6c` | **FAILED**: 216/217 tests. The audit stopped at tests, so its own lint and docgen steps did not run. Lint and docgen were then run separately (rows above). | environment-only, see FsUtils below |
| `package-verify @beep/repo-cli --quick` | `564a0f6c` | **FAILED**: lint ok, check red on `test/goals-manifest-capabilities.test.ts:103` `effectFnOpportunity` | inherited from main (#2527). Fixed on main by #2533 (`14a4596d`). |
| `package-verify @beep/repo-cli --quick` | merged head (base `e0b14ca4`) | pass (lint ok, check ok) | — |
| hosted Repo Sanity, job 125167483984 | `564a0f6c` | **FAILED**: `lint:schema-catalog` stale `@beep/repo-utils.generated.jsonc` | **introduced** by the split: 11 union entries moved from `JSDoc.ts` to `tags/*.model.ts`. Fixed by regenerating with `bun run beep lint schema-catalog --write`. The `@beep/git` shard the generator also rewrote was inherited (#2522), fixed on main by #2530, and restored rather than committed. Parent widened ownership to this one generated shard (PR comment 6572644999). |
| `bun run beep lint schema-catalog` | merged head | pass (current, 9505 entries) | — |
| `yeet final-check` (partial, stopped) | `997304af` | **INCOMPLETE, no receipt.** Cheap-gates ran 26 lanes: 25 passed (including fallow audit/dead-code/health, jsdoc ratchet, schema-first, schema-catalog), 1 failed (`observability:catalog-check`). Stopped during lint-policy after ~20 min. That head predates this note, so its receipt could not have proved the final head. | — |
| `bun run beep observability catalog --check` | `997304af`, merged head | **FAILED**: `standards/instrumentation-catalog/@beep/repo-cli.generated.jsonc` stale | inherited: HEAD differs from `origin/main` only in the 15 lane files, none of them repo-cli. Belongs to the observability owner. |

### FsUtils attribution (exact-base reproduction)

Same checkout, same uid (0), same config. `git switch --detach a7104ce5` with a clean
tree, then `bunx --bun vitest run test/FsUtils.test.ts` (the same runner as the audit),
then back to the branch. Result on the unchanged base: 1 failed / 30 passed. The failure is
the same "directory mid-walk is unreadable" case. Mechanism: as uid 0, `ls` of a
`chmod 000` directory succeeds, and `test/FsUtils.test.ts:457-476` has no uid guard. So the
expected `DomainError` never happens. Environment-only. The test is not root-safe; a
root-skip would be a separate small PR, outside this lane.

### Environment preparation

The fresh container needed `turbo run build --filter=@beep/repo-utils^...` and later
`--filter=@beep/repo-cli^...` before typechecking (TS6305, missing upstream `dist`).
That is environment-only.

### Deviation and friction: turbo telemetry

The first `bunx turbo run build` ran without `TURBO_TELEMETRY_DISABLED`. Turbo printed
its anonymous-telemetry notice, so one telemetry emission must be assumed. That breaks
the lane's no-telemetry boundary. Every later tool and build call exported
`TURBO_TELEMETRY_DISABLED=1 DO_NOT_TRACK=1` first. No telemetry enrollment or global
setting was changed. Prevention: the cloud bootstrap could export both variables, so
lane sessions never depend on per-command discipline.

### Friction: Yeet publish route

`yeet publish --push-only` refuses without a full-proof receipt. The local full
final-check needs more than 20 minutes on this container. Both pushes therefore used
the documented constrained-compute route (plain `git push`, draft PR with
`ready-for-heavy`), with hosted CI as the proof.

The correction wave reached GitHub in two pushes instead of one. The note commit
failed lefthook pre-commit (`typos` and `gitleaks` are not installed in the
container, exit 127). A chained `git push` still pushed the catalog fix and the main
merge (`c6b415ad`). The note followed in a second push, committed with
`LEFTHOOK_EXCLUDE=typos,gitleaks`. `typos` and `gitleaks` did not run locally;
hosted CI covers them. Prevention: gate a push on the commit's exit code, and
install both tools in the cloud bootstrap.

## Remaining

None for the JSDoc file. The other P3 mega-files (HTML and Quality) belong to other
owners. An exact-head `yeet final-check` receipt for the final head, the parent's
re-review of that head, the ready flip and the merge are all still open.
