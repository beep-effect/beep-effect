# LINT-01 residual: noResolve parity, 2026-11-13

PLAN slice 4 pays the LINT-01 gate items #3019 left unpaid: fixtures for all five named shapes, a parity
assertion between the production `noResolve: true` programs and resolving programs, a whole-repo byte-parity
run, and one hosted JSDoc Ratchet timing.

## Seam

`buildJSDocDocumentationInventory` and `writeJSDocDocumentationInventory` take an optional second argument,
`JSDocInventoryProgramOptions` (`{ noResolve: boolean }`), in
`packages/tooling/tool/cli/src/commands/Quality/internal/JSDocDocumentationInventory.ts`. It defaults to
`{ noResolve: true }`, the value #3019 hard-coded, so production behaviour is unchanged. No CLI flag or
environment variable reaches it. `createInMemoryTsMorphProject` in `@beep/repo-cli-kit` is unchanged.

## Fixtures

`packages/tooling/tool/cli/test/jsdoc-inventory-noresolve-parity.test.ts` builds one fixture workspace with six
packages and runs the inventory twice, once with `noResolve: true` and once with `noResolve: false`:

| Shape | Fixture |
| --- | --- |
| Merged namespace | `toLabel` function + `namespace toLabel` (documented and undocumented members); `Registry` class + `namespace Registry`, both undocumented |
| Module augmentation | `declare module "@fixture/augmented"` augmenting a package the file imports; the package exists under the fixture's `node_modules` |
| Star export | `export * from "./lib.ts"` (shared with the R2 detector test) |
| Local named re-export | `export { default as documentedRule } from "./documentedRule.ts"` (shared with the R20 test) |
| Overload groups | documented-first-signature and fully undocumented groups (shared with the R19 tests) |

The test asserts:

1. the resolving program loads `node_modules/@fixture/augmented/index.d.ts` and the `noResolve` program does
   not, so the augmentation fixture exercises resolution;
2. the two inventories are strictly deep-equal;
3. both match an explicit 25-row listing (path:line, symbol, kind, status, missing tags).

The star-export, named re-export and overload fixture sources moved to `test/jsdoc-inventory-fixtures.ts`, which
both suites import, so the detector tests and the parity test score the same source. The listing shows that
namespace members (`toLabel.prefix`, `toLabel.suffix`, `Registry.empty`) are not scored as separate entries
today. Only the merged declarations are. That is existing behaviour, and the listing pins it.

## Whole-repo byte parity

Run once on tbk-worker (worker profile, shared with two sibling agents; load average about 8.5 at the start),
base `0f8a9b7503`, with the slice's seam applied.

| Mode | Command | Start (UTC) | End (UTC) | Wall | Peak RSS |
| --- | --- | --- | --- | --- | --- |
| Production (`noResolve: true`) | `/usr/bin/time -v timeout 1800 bun run beep quality jsdoc-inventory` | 21:49:16 | 21:51:27 | 2:11.24 | 1.31 GiB (1371120 KiB) |
| Resolution forced on | same command, after a throwaway local edit of the seam default to `{ noResolve: false }` (restored afterwards; `cmp` with the backup confirmed it) | 21:51:45 | 22:02:07 | 10:21.87 | 4.59 GiB (4816296 KiB) |

Both runs reported `packages=196 openPackages=15 openExports=88 openModules=114 rootPolicyOpen=0`.

Digests after removing the `generatedAt` line (jsonc: the `"generatedAt"` line; md: the `Generated:` line):

| Artifact | Production sha256 | Resolution-on sha256 |
| --- | --- | --- |
| `standards/jsdoc-documentation.inventory.jsonc` (722420 lines) | `c02336b210e363bbc13ac66aa01b2286623989c55913e4f6c5f691f57a48af94` | `c02336b210e363bbc13ac66aa01b2286623989c55913e4f6c5f691f57a48af94` |
| `standards/jsdoc-documentation.inventory.md` (558 lines) | `40d78cb1faff5279e9b0891fba133855b8cc0a42a48e025f76f4c8dc73520d73` | `40d78cb1faff5279e9b0891fba133855b8cc0a42a48e025f76f4c8dc73520d73` |

`diff` of the raw outputs shows only the `generatedAt` / `Generated:` line. The package count is 196, not the
194 the SPEC gate names; the universe grew after the SPEC was written.

Both outputs differ from the copies committed on `main` (last refreshed in #3184): 3915 public modules against
3907 and 28190 public exports against 27953, plus line shifts. The committed copy is a snapshot. The
`jsdoc:inventory:check` task writes `.beep/ci/` and does not compare against it. The artifacts were restored
with `git checkout`, so this slice adds no inventory churn.

Under the same shared load, `noResolve` costs about a fifth of the wall time and about 28% of the peak memory
of a resolving build. This is a local reading, not the hosted scorecard reading.

## Hosted JSDoc Ratchet timing

Recorded after the PR's hosted Check run, below.
