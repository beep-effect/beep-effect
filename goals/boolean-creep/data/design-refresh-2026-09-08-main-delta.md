# Main-delta design audit

Date: 2026-09-08

Exact source: `7440cb8c4302ce64b87860069a464bafbf65f576`

Corpus source: `9b7553f618b2b3ee10e11a3d6ee93606f3e40ce1`

Compared source: `05405bf322da0ca7eb88b8bb402145081e8fded6`

## Qualified design impact

Only one existing qualified design references the five changed production
files: `r2-tooling-no-native-runtime-strict-failure`.

The merged `NoNativeRuntime.ts` import change moved the options declaration
from line 106 to 107 and the sole summary writer from old lines 694-704 to
current lines 693-703. The exact E4 expression is now line 698. The canonical
inventory still cites the options at line 106 and E4 at line 699; the parent
lane owns those citation corrections. The design now cites the current lines
and includes the changed discovery graph.

The disposition evidence is unchanged. `strictFailure` remains the sole
writer's conjunction of `options.strictCheck` and warning/error presence.
The command's only production result read remains
`packages/tooling/tool/cli/src/commands/Laws/Laws.command.ts:589-591`.

## Source-discovery impact

`packages/tooling/tool/cli/src/commands/Laws/NoNativeRuntime.ts:587-604`
replaced direct `new Project` plus `addSourceFilesAtPaths` with
`createRepoTsMorphProject`. The shared factory at
`packages/tooling/tool/cli/src/internal/tsmorph/ProjectFactory.ts:34-52` now:

- reads tsconfig compiler options while suppressing recursive include
  enumeration;
- expands only the caller's explicit source globs; and
- adds each exact matching path without registering excluded parent
  directories.

The NoNativeRuntime caller still passes
`options.includePaths ?? SOURCE_FILE_GLOBS`, applies ecosystem and explicit
exclusions, and sorts paths before scanning. The new regression at
`packages/tooling/tool/cli/test/native-runtime.test.ts:29-63` proves compiler
options remain loaded while an inaccessible excluded docs directory is not
read. It also proves one warning in strict mode still produces strict failure.

The refreshed design explicitly retains this factory, exact source inputs,
filtering, ordering, and regression. It keeps source discovery independent of
the three-state disposition and does not expand the planned implementation.

## Other changed production files

- `VersionSync/internal/resolvers/BunResolver.ts` bounds literal Bun-version
  extraction at quotes, shell substitution, or backticks. Its inventory rows
  `version-sync-bun-release` and `r3-tooling-bun-report-drift-flags` are both
  disqualified; no qualified design cites the file.
- `VersionSync/internal/updaters/VercelJsonUpdater.ts` applies the matching
  bounded replacement rule. No inventory row or qualified design cites the
  file.
- `repo-configs/src/next/models/ExperimentalConfig.schema.ts` removes `FID`
  from the private `WebVitalsMetric` literal owner. Its inventory rows
  `tooling-rest-experimental-config`, `swc-env-options`, and `mdx-rs-config`
  are disqualified; no qualified design cites the file.
- `internal/tsmorph/ProjectFactory.ts` has no inventory row and no other
  qualified design citation. Its behavior affects the NoNativeRuntime design
  only through the source-discovery call graph described above.

The changed NoNativeRuntime file also contains the disqualified
`r3-tooling-no-native-runtime-typeof-gates` row. Its declaration references
are now at lines 314 and 321-326, but it is not a qualified design and the
helper relationship did not change.

## Verification

- All five changed production files were read at the exact source.
- Inventory rows for those paths and every design citation to those paths were
  searched directly; no new census was run.
- Scoped `git diff --check` over the refreshed design and this handoff passed.

No qualification or cardinality repair is required. The remaining inventory
citation update belongs to the parent lane; implementation and aggregate
validation are outside this bounded refresh.

Parent reconciliation: canonical declaration 107 and E4 citation 698 now match
the refreshed design; no record status or cardinality changed.
