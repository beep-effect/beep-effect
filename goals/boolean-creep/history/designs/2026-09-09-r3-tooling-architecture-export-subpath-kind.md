# Instance

- id: `r3-tooling-architecture-export-subpath-kind`
- file:line: `packages/tooling/tool/cli/src/commands/Architecture/OperationPlanPackageJson.ts:15`
- symbol: `packageExportEntrypointFor`
- members: `isRootExportSubpath`, `isServerLayerExportSubpath`,
  `isWildcardExportSubpath`, `isDomainDirectoryExportSubpath`
- evidence: E2 at `OperationPlanPackageJson.ts:31-39` — the entrypoint renderer
  dispatches root, server layer, wildcard, domain directory, then generic file.
  The role/subpath recognizers are disjoint and no combined-true case exists.

# Current shape

Four private recognizers classify one `(role, subpath)` pair and an ordered
if-chain chooses among five rendering rules. The same renderer is called for
source and published export maps. This is one export-subpath kind rather than
four independent facts.

# Cardinality gap

Sixteen four-boolean tuples are representable and five entrypoint kinds are
legal: `root`, `server-layer`, `wildcard`, `domain-directory`, and `file`.
Role restrictions and distinct exact/suffix subpaths make every combined-true
tuple unreachable.

# Target schema

Define a private named `PackageExportSubpathKind` LiteralKit with those five
members, imported from `@beep/schema/LiteralKit`. Add one classifier over the
existing `ArchitecturePackageRole` plus subpath. Match the literal once in
`packageExportEntrypointFor`; reuse the existing stripped subpath, outDir, and
extension inputs and preserve every exact template. Keep
`domainDirectoryExportSubpaths` as the canonical set used by the classifier.

# Migration inventory

- `OperationPlanPackageJson.ts:8-21` — add the narrow LiteralKit import and the
  private owner/classifier; remove the four boolean predicate declarations.
- `OperationPlanPackageJson.ts:23-40` — replace the ordered if-chain with an
  exhaustive literal match while retaining root `index`, server `Layer`,
  wildcard `*/index`, domain-directory `index`, and generic-file output bytes.
- `OperationPlanPackageJson.ts:42-60` — preserve both source and publish calls
  through `packageExportMapFor`, including `./internal/*: null` and the exact
  `./package.json` mapping.
- `OperationPlanPackageJson.ts:92-133` — `renderPackageJsonOperation` remains
  the exported renderer and continues to construct both `exports` and
  `publishConfig.exports` from the same rule.
- `OperationPlanExecution.ts:19,69` remains the production execution reader;
  `Architecture/index.ts:35` continues exporting only the existing renderer,
  not the private kind.
- `Architecture/internal/PackageShell.ts:48-51` and
  `Architecture/internal/RoleTopology.ts:241-242` remain the role/export-list
  producers and are not migrated.
- `test/architecture-operation-plan.test.ts:565-595,655-692` — retain package
  shell and exact manifest assertions and add a focused render table for every
  kind in both source and publish maps.

# Guard-deletion accounting

Delete all four `is*ExportSubpath` predicates and their four ordered guards.
One classifier plus one exhaustive match becomes the sole rule-selection
boundary; there is no default boolean fallthrough that can admit an impossible
combination.

# Encoded-side impact

None. The literal is private. Generated `package.json` bytes, export keys and
values, publishConfig paths, JSON ordering, internal/package-json entries,
operation-plan schemas, command JSON, and filesystem execution remain exactly
unchanged.

# Test impact

Render operations whose exports exercise `.`, server `./layer`, wildcard
`./feature/*`, each domain directory (`./aggregates`, `./entities`,
`./identity`, `./values`), and ordinary file subpaths. Prove the role guards by
rendering `./layer` for a non-server role and a directory name for a non-domain
role. Assert exact source `.ts` and publish `.js` values, retained null/package
entries, stable ordering, and second-apply idempotence. Run focused architecture
operation-plan tests and full `@beep/repo-cli` package verification with the
required patch changeset.

# Risk and sequencing

Land in Tier 1E. The server-layer special case is case-sensitive (`Layer`) and
must remain role-gated; domain-directory special handling must not leak to
other roles. Generated manifest byte equality is the acceptance boundary.
