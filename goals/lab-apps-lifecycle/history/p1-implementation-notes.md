# P1 Implementation Notes

## Status

P1 implementation is complete in uncommitted working-tree state on
`feat/lab-apps-p1-delete-package`, based on `origin/main`. Scope is limited to
Track A: registration geometry, `delete-package`, identity orphan detection,
and P1 tests.

## Implemented

- Read the binding packet sources and the schema-first/effect-first/JSDoc laws.
- Confirmed the ratified ten-kind geometry is closed and expressible; no SPEC
  stop condition has fired.
- Added the private `RegistrationGeometry` schema/service module with the closed
  ten-kind surface union, closed writer domain, schema-versioned plans,
  observations, reverse dependency reports, exhaustive forward/inverse
  interpretation, doctor probes, reverse-transitive dependency scanning, and a
  flag-aware injected executor used by `RegistrationGeometryService.apply`.
- Added `delete-package` as a root CLI command. It resolves live names/paths and
  deleted artifact paths, prints the complete inverse plan, enforces the hard
  refuse table (`--force` never bypasses dependents), supports dry-run/check,
  removes identity/workspace/changeset/tree state, reconstructs tsconfig and
  lockfile state, runs baseline writers, invalidates CI mirrors, and runs a
  post-apply doctor.
- Added `removeIdentityPackageRegistration`, including multi-compose-group and
  manual-alias cleanup, plus identity-registry composer/export orphan detection.
- Added synthetic doctor, plan-shape, ten-row refusal-table, CLI doctor-output,
  and identity-orphan tests.

## File Inventory

- `goals/lab-apps-lifecycle/history/p1-implementation-notes.md` (this handoff)
- `packages/tooling/tool/cli/src/internal/cli/RegistrationGeometry/*`
- `packages/tooling/tool/cli/src/commands/DeletePackage/*`
- `packages/tooling/tool/cli/src/test/DeletePackage.test-kit.ts`
- `packages/tooling/tool/cli/test/delete-package.test.ts`
- `packages/tooling/tool/cli/src/commands/CreatePackage/internal/IdentityRegistration.ts`
- `packages/tooling/tool/cli/src/commands/Lint/IdentityRegistry.ts`
- `packages/tooling/tool/cli/test/lint-identity-registry.test.ts`
- `packages/tooling/tool/cli/src/commands/Root.ts`
- `packages/tooling/tool/cli/src/index.ts`
- `packages/tooling/tool/cli/package.json`
- `tsconfig.json` (reconstructed alias entries for the new command/test kit)

The untracked research files `10`, `11`, and `12` are context copies and are not
part of this implementation.

## Design Deviations

- No deviation from the ratified ten-kind geometry or service contract.
  `delete-package` injects its flag-aware executor into the service, prints the
  service-produced plan first, and invokes `RegistrationGeometryService.apply`;
  the service then runs the same-declaration post-apply doctor.
- P2-only lab identity grouping, lab changeset exemption, data-resource drops,
  and every other labs behavior remain schema-declared but unwired as required.
- Appendix C follow-on mutations (`--cascade`, `--prune-catalog`, packet
  rewriting, identity-major release policy, and retired-registry growth) are
  not implemented in P1. Their flags participate in refusal/explicit-policy
  handling without adding P2 labs behavior or corrupting the retirement
  registry.

## Test Evidence

- `bunx turbo run check --filter=@beep/repo-cli` — PASS (31/31 tasks).
- `bunx vitest run packages/tooling/tool/cli/test/delete-package.test.ts packages/tooling/tool/cli/test/lint-identity-registry.test.ts`
  — PASS (2 files, 18 tests).
- `bunx biome check <17 touched source/test paths>` — PASS.
- `bun run docgen:local -- --package @beep/repo-cli` — PASS (31/31
  dependency-expanded docgen tasks; new DeletePackage metadata and examples
  typecheck).
- `bun run beep delete-package --help` — PASS; command and all P1 flags are
  registered.
- `bun run beep tsconfig-sync` — PASS; one root alias file reconstructed.
- `git diff --check` — PASS.

## Orchestrator Review Pass (2026-08-14, Fable session)

Two SPEC gaps found in review and fixed in-place:

1. **§9.4 row 5 (live promotion record)** — the command hardcoded
   `livePromotionRecord: false`, so the no-override hard refuse could never
   fire. Fixed: `hasLivePromotionRecord` derives it from the live target's
   `README.md` ("promotion record", case-insensitive), per the shared-kernel
   standard's package-README promotion-record convention. Regression test:
   "refuses deleting a live package whose README carries a promotion record".
2. **§9.4 row 3 (identity-accessor importers)** — the dependents scan caught
   `@beep/<target>` imports but not consumers importing the target's
   `$<Pascal>Id` accessor from `@beep/identity`. Fixed: the accessor needle is
   pulled from the declared identity-segment surface
   (`RegistrationSurface.guards["identity-segment"]` over
   `surfacesForTarget`), and source files outside the identity package and
   target tree containing it yield hard `import-prod`/`import-test` hits.
   Regression test: "classifies identity-accessor importers outside the
   target tree as hard import dependents".

Post-fix evidence: `bunx vitest run` on both P1 test files — 20/20 pass.

Deliberate P1 stances confirmed in review (not gaps): `--cascade` and
`--prune-catalog` always refuse (closure/uniqueness proofs are follow-on
work); `--force` is consulted nowhere, so it can never override dependents;
the monolithic `executePlan` executor is acceptable for P1 because the plan
and doctor both derive from the declared geometry, but dispatching execution
per-surface from `RegistrationSurface.match` is a P2+ improvement candidate.

## Complexity Refactor (fallow gate, 2026-08-14 Fable session)

The first yeet publish proof failed at `fallow:audit` with 10 introduced
complexity findings against the ratified ceilings (maxCognitive=8,
maxCyclomatic=20; `.fallowrc.jsonc` health block) and 1 introduced
duplication group. The planned Codex refactor delegation died on the OpenAI
usage limit (exhausted until 2026-08-19), so the orchestrator performed the
behavior-preserving refactor directly:

- `dependentsOfAtRoot` (cog 48→): split into `collectWorkspaceEdges` (flat
  edge list replaces the triple-nested manifest loop), `A.reduce` reverse
  adjacency, a local `manifestHitFor`, `scanFile`/`sourceHits`/`textHits`
  closures, `decodedRootManifest`, `rootScriptHits`, `rootPolicyFileHits`,
  and `dedupedSortedHits`.
- Duplication: `needleLineHits` is the single shared per-line scanner used
  by both `accessorHitsInFile` and the E15 text scan; `importKindForFile`
  deduplicates the import-kind ternary.
- `handler` (cog 23→): extracted `planPrintPrefix`, `assembleDeletePolicy`,
  `runCheckMode`, `runApplyMode`, and a `DeletePackageHandlerOptions` type.
- `refusalReasons` (cog 14→): rewritten as a `REFUSAL_RULES` table of
  `(target, report, policy) → Option<refusal>` rules folded with
  `A.flatMap`/`O.toArray` (match/table over conditional chain, per repo law).
- `authoredKindFor` (cog 11→): ordered `(predicate, kind)` rule table +
  `A.findFirst`; `isBaselineReferenceFile` owns the baseline predicate.
- `importHitsInFile` (cog 9→): `dynamicImportSpecifier` extracted.
- `removeWorkspaceLiteral` (cog 9→): pure `workspaceLiteralJsonPath` +
  `isStringArray` extracted.
- `findDeletedTargetPath.walk` (cog 10→): split into `walk`/`walkEntry`
  with a module-level `SKIPPED_WALK_ENTRIES` list.
- `rewritePendingChangesets` (cog 9→): `pruneChangesetFile` +
  `stripPackageFromFrontmatter` extracted.
- `removeIdentityPackageRegistration` arrow (cog 21→) and
  `registeredIdentityComposerSlugs` (cog 9→): `composeCallExpressions`,
  `removeComposeSlugArguments`, `isAccessorExportFor`,
  `removeAccessorExportStatements`, `stringLiteralArgumentTexts` extracted.

Post-refactor evidence: focused vitest 20/20; `turbo run check
--filter=@beep/repo-cli` 31/31; `beep quality fallow audit --base
origin/main --check` reports `introduced: 0` (6 inherited-adjacent remain,
non-blocking); biome clean on all touched files.

## Open Items / Known Gaps

- The exact two focused test files pass directly, but two attempts to route the
  same file arguments through `turbo run test --filter=@beep/repo-cli -- ...`
  entered Vitest and emitted no terminal result; both were interrupted. The
  package-scoped Turbo typecheck and direct focused Vitest evidence above are
  terminal and green.
- A destructive fresh-package round-trip was not run inside this implementation
  worktree because it would intentionally delete and regenerate repository
  state. The orchestrator's authoritative proof should perform that packet
  acceptance scenario.
