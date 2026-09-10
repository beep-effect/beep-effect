# Tooling baseline design refresh

Date: 2026-09-08

Exact source: `7440cb8c4302ce64b87860069a464bafbf65f576`

Corpus source: `9b7553f618b2b3ee10e11a3d6ee93606f3e40ce1`

## `package-verify-step-outcome`

The only production writers are
`packages/tooling/tool/cli/src/commands/Quality/internal/PackageVerify.ts:498-520`.
An absent script writes `skipped=true, ok=true`; an executed script writes
`skipped=false` and derives `ok` from the exit code. Readers at lines 630, 636,
642, 686-694, and 749 distinguish exactly skip, success, and failure. The
schema accepts skipped-failure structurally, but no writer, fixture, decoder,
or documented input gives it meaning.

The design retains three legitimate outcomes and now inventories the separate
renderer failure-output reader at line 694. It preserves the `exitCode`
`S.Option(S.Finite)` payload, P0 inbox fallback behavior, audit receipt,
skip-filtering, renderer text/timing, and every focused fixture. There is no
encoded boundary.

## `docgen-local-json-requires-plan`

`DocgenLocalOptions` is a named internal options carrier at
`packages/tooling/tool/cli/src/commands/Docgen/internal/Local.ts:141-150`.
`runDocgenLocal` rejects JSON execution before repository discovery at lines
1368-1372. It renders at lines 1377-1381, and
`executeDocgenLocalPlan` stops both plan-only formats before execution at line
1313. A `full-required` plan still exits unsuccessfully at lines 1314-1316.

The refreshed design maps the three legitimate pairs to
`None | Some(text) | Some(json)`, preserves bare-JSON rejection and exact
message, and retains command error precedence by resolving after the existing
concurrency-config read. Direct plan construction remains insensitive to the
output choice. No options object is encoded or persisted.

## `tsconfig-sync-mode-flags`

`packages/tooling/tool/cli/src/commands/TsconfigSync/TsconfigSync.command.ts:18-30`
accepts every one of the eight `check`/`dryRun`/`write` triples. Its exact
precedence is check, then dry-run, then explicit/default sync. The prior design
correctly reused `TsconfigSyncMode`, but its tests delegated combined-input
behavior to a generic helper test.

The refreshed design explicitly treats all eight tuples as supported inputs
and requires a command-local table proving exact precedence and fallback.
Generic `resolveRunMode` tests do not establish this command's candidate order.
The existing literal run options, generated files, filters, and service
behavior remain unchanged.

## `r3-tooling-terse-effect-file-flags`

The complete loop-local write graph is at
`packages/tooling/tool/cli/src/commands/Laws/TerseEffect.ts:626-771`. Every
affected flag write is paired with its source finding-array append. The arrays
have no other mutator: all candidate families append blocking findings, only
helper-ref and thunk-helper append rewritable findings, and those two set
mutation only in write mode. The four reachable tuples are therefore proven
as clean, blocking, rewritable, and mutated rather than inferred from one
producer fixture.

The refreshed design keeps the phase and derivation file-local, derives it
once from finding-array presence plus write intent, and exhaustively folds it
into the existing aggregate arrays. Tests remain on the exported summary seam;
no production or test barrel is widened. Informational candidates remain
outside this record.

## Withdrawn function-parameter records

The census rule in `goals/boolean-creep/ops/prompts/sweep-lane-round1.md:44`
states that function flag parameters are out of scope and must not be
recorded. Two assigned records violate that boundary.

### `generated-file-drift-mode-flags`

`assertExclusiveModeFlags` at
`packages/tooling/tool/cli/src/internal/artifacts/GeneratedFileDrift.ts:49-53`
is an exported function whose anonymous input consists of `write`, `check`,
and `onConflict`. It has only documentation and
`artifacts-io.test.ts:96-115` consumers. All four raw tuples are meaningful to
the validator: three return `Effect.void`, while combined true intentionally
returns `onConflict`. The helper does not produce or store a generated-file
mode.

The old design incorrectly migrated `syncGeneratedFile.write` at lines
172-191, which is a different one-boolean symbol, to manufacture a downstream
two-state domain. Lack of a production caller is not the qualification reason;
the precise defect is that this record is solely out-of-scope function flag
parameters. The parent archived the design and removed the live inventory row.
Any orphan-helper cleanup belongs outside this campaign.

### `docgen-quality-scope-flags`

The recorded pair exists only in the anonymous parameter object at
`packages/tooling/tool/cli/src/commands/Docgen/internal/quality/Quality.scope.ts:107-115`.
Its production callers are `Docgen.command.ts:792-796` and
`Docgen/internal/Targets.ts:292-296`; no schema, config, result, or output
stores the pair.

All four raw pairs have defined behavior. False/false selects package when its
separate selector is present and affected otherwise; true/false selects all;
false/true selects changed files; combined true reaches the exact conflict
`DomainError` at lines 118-122 after `assertNoOrphanDocgenConfigPaths` at line
116. Worker evaluation preserves an `input: Some` short circuit at
`Targets.ts:284-290`, and otherwise calls with `changedFiles=false`.

This is the same source-scope violation, not a D1 classification. The proposed
tagged union also risked moving conflict validation ahead of the current
orphan-config and worker-input precedence. The parent owns inventory removal
and design archival.

Both withdrawn entries were removed from the instance list in
`family-cli-mode-flags.md`; this was the only additional packet file edited.

## Verification

All source declarations, writers, readers, production callsites, supported
test seams, and boundary behavior were inspected at the exact source above.

- `mise exec bun@1.4.2 -- bun goals/boolean-creep/ops/validate-designs.ts`
  completed against 104 qualified ids and named only two unrelated missing
  surfaces, `html-link-imagesizes-disposition` and
  `tabstrip-overflow-disposition`. None of the four retained designs was named;
  the parent lane owns the final aggregate after those concurrent surfaces
  settle.
- Scoped `git diff --check` over the four retained designs, two parent-owned
  deletions, family-list correction, and this handoff passed.

This work prepares designs only. Formal P3 review, implementation, inventory
status, and archive/count ownership remain with the parent lane.
