# `tsconfig-sync` malformed root export: typed failure, 2026-11-02

Scope: OIP scout candidate 2 (PR comment 6580301003). A package manifest whose
root export is a wildcard, `"exports": { ".": "./src/*.ts" }`, made
`tsconfig-sync` die with an untyped `Schema validation failed` defect instead
of a typed failure naming the manifest.

Files touched: `TsconfigSync.plan.ts`, the focused test
`packages/tooling/tool/cli/test/tsconfig-sync.test.ts`, and this note. No
schema, API, config, manifest, catalog or baseline change. The separate
`PackageJsonTools` writer is out of scope and untouched.

Run: one Claude cloud session (uid 0), no child agents, promotional cloud
credit only. Branch `codex/tsconfig-root-export-error`, cut from a fresh
`origin/main` at `12ececd3` before any edit.

## Trigger (observed before the fix)

- `decodePackageJsonEffect` accepts any string export target.
- `resolveRootExportTarget` returns `./src/*.ts`.
- `buildCanonicalAliasTargets` ran inside `Option.map` and called
  `CanonicalAliasTargets.make`. That call checks `RootAliasTarget`
  (`^\./(?!.*\*).+`) and throws synchronously.

The new regression test failed on the unfixed tree with exactly that throw
(`Error: Schema validation failed` on `rootAliasTarget`).

## Fix

`buildWorkspaceDescriptors` now decodes the resolved root export with the
existing `RootAliasTarget` schema (`S.decodeUnknownEffect`, hoisted). It then
maps a failure to the existing `DomainError.newCauseMessage`:
`Invalid root export "<target>" in "<package.json path>": <schema issue>`. This
follows the same pattern the planner already uses for package.json decode
failures. Canonical alias targets are built only from a decoded root. The
validation is limited to that one value; nothing else is caught.

Valid manifests are unchanged. A string root still resolves as before, and so
do conditional roots and subpath and wildcard-subpath exports. All 25 existing
tests pass unchanged.

## Proof

| Command | Exit |
| --- | --- |
| `bunx --bun vitest run test/tsconfig-sync.test.ts` (pre-fix, new test only) | 1 (expected red: defect throw) |
| same, after the fix | 0 (26 tests) |
| `bun run beep quality package-verify @beep/repo-cli --quick` | 0 (lint, check) |

During the work, `package-verify --quick` failed once (exit 1) on Biome
`organizeImports` in my own import edit. I fixed it with `biome check --write`,
re-ran package-verify (exit 0), and re-ran the focused test (exit 0). Not run
here: full package-verify (audit, docgen) and the heavy hosted proofs. Those
are left to hosted CI and the parent's head proof.
