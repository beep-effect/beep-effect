# Lane B1: schema and service layers

## Scope and files

Implemented the bounded schema/service lane. Changes are unstaged and uncommitted.
No library data was read or migrated, and no ontology rendering, SHACL, SPARQL,
or migration command was added.

Files owned by this lane:

- `packages/tooling/tool/cli/src/commands/Research/Library/Library.schemas.ts`
- `packages/tooling/tool/cli/src/commands/Research/Library/Library.paths.ts` (new)
- `packages/tooling/tool/cli/src/commands/Research/Library/Library.service.ts`
- `packages/tooling/tool/cli/src/commands/Research/Library/Library.command.ts`
- `packages/tooling/tool/cli/src/commands/Research/Library/index.ts`
- `packages/tooling/tool/cli/src/commands/Research/Library/Library.store.ts`
- `packages/tooling/tool/cli/src/commands/Research/Library/Library.inventory.ts`
- `packages/tooling/tool/cli/src/commands/Research/Library/Library.acquire.ts`
- `packages/tooling/tool/cli/src/commands/Research/Library/Library.evidence.ts`
- `packages/tooling/tool/cli/test/research-library-models.test.ts` (new)
- `packages/tooling/tool/cli/test/research-library-acquisition.test.ts`
- `packages/tooling/tool/cli/test/research-library-inventory.test.ts`
- `packages/tooling/tool/cli/test/research-library-views.test.ts`

The packet edits present at admission and the concurrent foundation/vocabulary
lane's changes are outside this lane's ownership. The `coverageLibraryVersion`
fields in Quality are unrelated coverage-tool metadata and were left unchanged.

## Design choices

- Converted all 15 existing exported models to `S.Class` and added Finding,
  Derivation and ModelRun. Kept the Library-prefixed public names and bare
  ontology names, including Report for LibraryDocument and SourceVersion for
  the renamed LibrarySourceVersion.
- Kept nominal brand parameters because the installed compiler requires them
  (`schemaClassMissingBrand`). Combined `$I.annote` with `$I.class` in the class
  annotations argument: the former remains visible to schema tooling, while
  the latter supplies the bare ontology identity.
- Preserved the existing fields, checks and defaults. Added the requested
  constructor and decoding defaults, catalog v1/v2 LiteralKit, access class,
  CiTO relation LiteralKit and validator-contract constant. New catalog
  construction sites and examples use v2. Loaded catalog updates spread the
  loaded model and retain its schema tag.
- Borrowed only confirmed CoreVocab predicates: `dcterms:title` for title and
  `dcterms:created` for createdAt/recordedAt. Other properties remain owned.
- Root resolution now short-circuits flag, BEEP_RESEARCH_LIBRARY,
  XDG_DATA_HOME, then HOME. HOME is unnecessary when an earlier choice is
  available. Default corpus-input path resolution also moved out of the
  command and into Library.paths.ts; explicit input roots do not require HOME.
- ResearchLibraryLive follows ResearchCommandServiceLive: captures the typed
  platform context once with Layer.effect, then provides that context to
  existing use cases. Effect's public Success/Error/Services extraction types
  keep method results and requirements aligned with those implementations.
  Inventory accepts the resolved root plus the existing options model and
  uses the resolved root as authoritative.
- Each command leaf uses Command.provide, matching the surrounding Research
  command convention. The verification helper consumes the service; its
  existing test now provides the live layer at the suite boundary, including
  NodeHttpClient.layerUndici for the service's complete platform requirements.
- The Library facade now explicitly names every formerly re-exported public
  model, literal domain, error and use case, plus the service, layer and paths.
- Existing tests and fixtures use LibrarySourceVersion.make where nominal
  construction is required. Added seven tests covering legacy JSON defaults,
  v2 decoding, invalid derivation depth and all four root-resolution choices.

## Verification

- PASS: `bun run beep quality package-verify @beep/repo-cli --quick`.
  Final run: lint 1.5 seconds, check 7.9 seconds. The command completed with
  exit status 0. Earlier edit-loop failures were corrected (nominal brands,
  literal-default inference, service test layers, two plain version fixtures,
  compiler diagnostics in new tests and formatting).
- PASS: `(cd packages/tooling/tool/cli && bunx vitest run test/research-library test/research-command.test.ts)`.
  Final run: six files, 157 tests passed; exit status 0.
- PASS: `bun run beep lint effect-vitest` (exit status 0; no new findings). The initial scan
  identified an opaque platform-resource import in the new test. Root tests now
  use the exact pure `Path.layer` dependency instead of the broad NodeServices
  platform layer; a focused detector scan reports zero findings.
- PASS: `rg -n 'YeeBois|~/|/home/' packages/tooling/tool/cli/src/commands/Research/Library`
  returned no matches (expected rg status 1). The same scan of all four touched
  research-library test files also returned no matches.
- PASS: `git diff --check` for this lane's source/test paths.
- PASS: no `export *`, `S.Opaque` or `S.Struct` remains in Library.schemas.ts
  or the Library index facade.

## Friction and boundaries

A direct raw tsrs invocation initially reported missing referenced declaration
outputs. The canonical package-verify command provisions its dependency builds
and exposed actionable lane diagnostics without that noise. Use package-verify
for the next lane's validation.

An initial attempt to acknowledge a local package-failure row with `--observed`
was rejected because that form is only valid for proof-job/merge-ready rows.
A later inbox query reported no unacknowledged entries. No commit was created to
satisfy a fix-sha acknowledgment because this lane explicitly forbids commits.

B2 and later lanes still own ontology generation, external alignment triples,
SHACL validation, SPARQL projections/views, visibility filtering and migration.
The schema and service contract additions alone do not establish those gates.

No unresolved issues remain within B1. All four requested verification gates pass.
