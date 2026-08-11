# KN-1b — conflicted-scope knip mop-up

Lane scope: the 10 remaining knip findings identified by kn-1a as belonging to previously
owner-blocked, now-freed scopes: 9 `unresolved: bun-types` (identical manifest-gap pattern
kn-1a root-caused) + 1 `binaries: rustc`.

## Root cause (confirmed, per kn-1a's diagnosis — same pattern, different packages)

Each of the 9 packages' `tsconfig.test.json` declares `"types": ["node", "bun-types"]`, but the
package's own `package.json` never lists `bun-types` as a `devDependency`. TypeScript resolves fine
(bun-types is hoisted at the repo root), so nothing breaks at build time — it's a pure manifest gap.
Fix: add `"bun-types": "catalog:"` to `devDependencies`, alphabetically ordered last (matching the
exact insertion point kn-1a used across its 17 identical fixes) — no `bun install` needed.

## Disposition table

| Kind | File | Name | Disposition | Evidence |
|---|---|---|---|---|
| unresolved | packages/drivers/box/package.json | bun-types | **fixed** | added `"bun-types": "catalog:"` devDependency |
| unresolved | packages/drivers/ecfr/package.json | bun-types | **fixed** | same |
| unresolved | packages/drivers/govinfo/package.json | bun-types | **fixed** | same |
| unresolved | packages/drivers/wink/package.json | bun-types | **fixed** | same |
| unresolved | packages/foundation/capability/api-transport/package.json | bun-types | **fixed** | same |
| unresolved | packages/foundation/capability/langextract/package.json | bun-types | **fixed** | same |
| unresolved | packages/foundation/capability/mcp-kit/package.json | bun-types | **fixed** | same |
| unresolved | packages/foundation/modeling/html/package.json | bun-types | **fixed** | same |
| binaries | apps/professional-desktop/scripts/build-sidecar.ts | rustc | **fixed (detector-scope)** | system Rust toolchain compiler, invoked via subprocess (`` await $`rustc -vV` ``) to read the host target triple for Tauri's `externalBin` naming convention — never an npm-installable dependency. Added `rustc` to `knip.jsonc` `ignoreBinaries`, same category as the existing `readlink` entry kn-1a added for the same reason (system binary invoked via subprocess). |

No non-bun-types dependency or file findings appeared in any of the 9 packages — each package's only
issue was the single `bun-types` manifest gap.

## Detector-scope change

`knip.jsonc` `ignoreBinaries`: appended `"rustc"` with an inline rationale comment naming the
script and invocation. This is the third-party tool config, not repo detector code — same category
as kn-1a's `readlink`/`op`/`beep-cli`/`portless` entries.

## Files touched (10)

- `knip.jsonc`
- `packages/drivers/{box,ecfr,govinfo,wink}/package.json`
- `packages/foundation/capability/{api-transport,langextract,mcp-kit}/package.json`
- `packages/foundation/modeling/html/package.json`

No commits made. `standards/knip.regression-baseline.jsonc` was not touched.

## Verification

- `bun run knip --workspace <pkg>` clean (zero output) for all 9 packages individually.
- Final full-repo `bun run knip --reporter json`: **1 finding**, down from the 10-item lane
  assignment. That 1 remaining finding is `files: packages/tooling/tool/cli/probe-jsdoc-r19-tmp.ts`
  — confirmed untracked (`git status --short` shows `??`), a transient scratch probe file from a
  concurrent JD-lane (JSDoc waves), not authored by this lane and not part of the KN-1b assignment.
  Every finding in this lane's 10-item scope is resolved; zero KN-1b findings remain.
