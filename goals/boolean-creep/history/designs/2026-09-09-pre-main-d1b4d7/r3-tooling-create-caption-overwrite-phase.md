# Instance

- id: `r3-tooling-create-caption-overwrite-phase`
- file:line: `packages/tooling/tool/cli/src/commands/Files/Files.service.ts:822`
- symbol: `createCaptionFilesPlan.overwritePhase`
- members: `captionExists`, `overwritesExisting`
- evidence: E4 at `Files.service.ts:822-896` — `overwritesExisting` becomes
  true only inside the existing-target branch after every refusal path has
  returned. Overwrite without an existing target is unreachable.

# Current shape

Caption planning probes target existence, initializes a second boolean to
false, validates or skips existing targets, then flips the second bit before
constructing `CreateCaptionFilesPlanEntry`. That exported decoded model stores
`overwritesExisting`; the command later filters it to compute create and
overwrite counts. The existing-target/no-overwrite case is already represented
by `CreateCaptionFilesSkippedEntry` with reason `caption-exists`.

# Cardinality gap

Four local pairs are representable and three are legal: missing target/create,
existing target/skipped, and existing target/overwrite. Missing target with
overwrite is impossible.

# Target schema

Add an annotated `CreateCaptionWriteMode` LiteralKit with `create` and
`overwrite` beside the existing CreateCaptions schemas. Replace
`CreateCaptionFilesPlanEntry.overwritesExisting` with `writeMode`. After all
existing-target refusal paths return, derive `overwrite`; derive `create` for a
missing target. Keep `captionExists` only as the filesystem boundary fact and
never store a sibling boolean projection. The skipped case continues through
the existing reasoned skipped-entry model rather than becoming a fake plan
entry.

# Migration inventory

- `commands/Files/internal/CreateCaptions.schemas.ts` — add and document
  `CreateCaptionWriteMode`; migrate the exported plan-entry field from
  `overwritesExisting` to `writeMode`.
- `commands/Files/Files.schemas.ts` and `commands/Files/index.ts` barrel chain
  already exports the internal schema module; verify the new owner is reachable
  and no stale boolean type remains.
- `Files.service.ts:822-900` — remove the mutable boolean and construct the
  exact write mode after target validation.
- `Files.service.ts:1767-1771` — count overwrites with the generated literal
  guard and derive creates from the total exactly as today.
- `Files.render.ts`/`Files.media.ts` render plan paths but do not inspect the
  old field; recheck their exported decoded signatures.
- `test/files-command.test.ts:4505` (create), `:4538` (dry-run), `:4580`
  (overwrite), and `:4603` (collision) — extend the live create-captions tests
  with exact create, skip-existing, overwrite, dry-run, and collision
  count/output proof. The preceding normalize-manifest suite is unrelated.
- Whole-source search found no persistence or external JSON writer for the
  transient plan entry.

# Guard-deletion accounting

Delete mutable `overwritesExisting`, its false initialization and true write,
the exported boolean schema field, and the downstream boolean filter. The
filesystem existence fact is consumed once to select the existing skipped
model or one exact write-mode literal.

# Encoded-side impact

No supported encoded contract. The plan is transient repo-CLI state, though
its decoded TypeScript model is exported from `@beep/repo-cli/commands/Files`.
The ratification authorizes migrating all in-repo consumers atomically without
a compatibility alias. Command arguments, stdout, counts, files written,
overwrite refusal, skipped reasons, and caption bytes remain unchanged.

# Test impact

Cover missing/create, existing/skip, existing/overwrite, existing non-file,
canonical-path mismatch, collision, and dry-run. Add direct schema construction
for both write modes and prove the old boolean key is absent from decoded plan
entries. Preserve command log snapshots and actual filesystem assertions. Run
focused Files command/schema tests and full `@beep/repo-cli` verification with
its changeset policy.

# Risk and sequencing

Land in Tier 1E. Validate existing targets before selecting `overwrite`; a
literal chosen merely from the CLI option would misclassify missing-target
creates. Keep the reasoned skipped-entry path separate and preserve the
single-concurrency planning loop and symlink defenses.
