<!-- seat: grok-4.7 medium (third seat; Fable and cursor Opus quota exhausted, 2026-10-09) -->
I'll review those seven workspace files read-only against the pinned upstream oracle, round-1 inventory, and the port ledger, and report only new findings.Round 1 already inventoried these files. I'll inspect the round-2 commit for regressions and issues that inventory did not close.Round-1 items stay closed unless the fix left a new defect. I'll read the seven implementations against the pinned oracle.I'll finish the read-only pass on the seven workspace files and only report findings the pinned oracle and round-1 inventory do not already close.### fable-2-1
- file: scratchpad/effected/workspaces/WorkspaceSnapshots.ts:257
- class: bug   severity: required
- standard: D11 bug; the recorded upstream-bug on `CatalogSet.fromManifestWorkspaces` (`PORT_LEDGER.json` workspaces deviations, test `WorkspaceCatalogsPmAware.test.ts:21`); `WorkspaceSnapshots.ts:465-469`   evidence: `bunInlineCatalogs` returns `CatalogSet.empty()` unless `manifest.workspaces` is an object, then reads only `workspaces.catalog` / `workspaces.catalogs`. `computeAt` assigns that result on the bun branch (`WorkspaceSnapshots.ts:472`). The live bun assembler calls `CatalogSet.fromManifestWorkspaces` (`WorkspaceCatalogs.ts:1031`), which merges validated top-level `catalog` / `catalogs` and then the `workspaces` blocks, with the workspaces blocks winning (`WorkspaceCatalogs.ts:304-309`). `worktree` publishes `catalogsService.set` (`WorkspaceSnapshots.ts:568`). The pinned oracle’s `fromManifestWorkspaces` and `bunInlineCatalogs` both ignored top-level catalogs, so the two sides agreed. The parity tests only place catalogs inside `workspaces` (`WorkspaceSnapshots.test.ts:214-219`), so they stay green.
- failure: On a bun/npm manifest whose catalogs sit at the top level (array `workspaces`, or a top-level name the `workspaces` object does not repeat), `at(ref)` resolves those `catalog:` specifiers to none while `worktree()` resolves them. A clean-tree diff reports every such dependency as changed. The comment at `WorkspaceSnapshots.ts:465-469` says the at-ref inline set must not disagree with `fromManifestWorkspaces`.
- fix: In `bunInlineCatalogs`, tolerantly merge top-level `catalog` / `catalogs` and then the `workspaces` blocks through `CatalogSet.fromBunBlocks` (workspaces win). Keep the at-ref degrade-on-malformed behaviour. Do not call `fromManifestWorkspaces` here.

### fable-2-2
- file: scratchpad/effected/workspaces/WorkspaceDiscovery.ts:95
- class: schema   severity: required
- standard: `standards/effect-first-development.md` tagged-error template (`cause: S.Defect({ includeStack: true })`); Effect `Schema.ts` `Defect` / `ErrorInstance` (`includeStack` default false, stack omitted unless `{ includeStack: true }`); D11   evidence: `WorkspaceDiscoveryError.cause` is `S.Defect()` with no options. `LockfileReadError`, `ChangeDetectionError`, and `LayerPolicyError` in this module already pass `{ includeStack: true }` (round-1 r01). The tagged-errors ledger row records only those three. Tsgo does not check encoded stack retention.
- failure: Encoding `WorkspaceDiscoveryError` drops the originating `Error` stack. Decoding that payload cannot recover it. Sibling cause schemas in the same module keep the stack.
- fix: Change this field to `S.Defect({ includeStack: true })` and keep the field annotation.

### fable-2-3
- file: scratchpad/effected/workspaces/WorkspacePackage.ts:135
- class: schema   severity: required
- standard: `standards/effect-first-development.md` tagged-error template; Effect `Schema.ts` `Defect` (`includeStack` default false); D11   evidence: `WorkspaceManifestError.cause` is `S.Defect()` with no options. The same three sibling errors already use `{ includeStack: true }`. The gate does not encode a cause and assert `stack`.
- failure: Encoding `WorkspaceManifestError` drops the originating read or decode stack.
- fix: Change this field to `S.Defect({ includeStack: true })` and keep the field annotation.

### fable-2-4
- file: scratchpad/effected/workspaces/WorkspaceDiscovery.ts:1078
- class: schema   severity: required
- standard: `standards/effect-first-development.md` EF-12b; `standards/effect-laws-v1.md` law 17; D11   evidence: `isStringRecord` is `P.isObject(value) && R.values(value).every(P.isString)` and decides all four dependency fields (`WorkspaceDiscovery.ts:543-546`). `WorkspacePackage.ts:76` already defines that map as `DependencyMap = S.Record(S.String, S.String)`, and `WorkspaceSnapshots.ts:214` already guards the same four fields with `S.is(DependencyRecord)`. Round-1 r45 required this derivation at `WorkspacesSync.ts` only. No schema lint flags a local predicate.
- failure: Discovery keeps a second definition of a dependency map beside the schema that owns it. A later change to `DependencyMap` does not move this guard, so member discovery and snapshot parsing can accept different maps.
- fix: Replace the local predicate with `S.is` of the existing dependency-map schema (`DependencyMap` or the snapshot `DependencyRecord`). Keep the all-or-nothing omit when the guard fails.

REQUIRED: 4
BACKLOG: 0
