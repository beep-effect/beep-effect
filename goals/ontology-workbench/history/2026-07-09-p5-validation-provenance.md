# P5 Validation + Provenance Evidence

Date: 2026-07-09
Branch: `feat/ontology-workbench-p5-validation-provenance`
Status: `host-verification-required`

## Summary

P5 is locally integrated. The work adds `packages/drivers/shacl` as the
driver-backed implementation of the `@beep/semantic-web` SHACL validation
contract, wires ontology validation through the sidecar/server placement used
by P4 inference, exposes validation and provenance RPCs through the desktop
orchestrator, adds renderer atoms and the workbench validation panel, and
exports PROV-O plus VoID/DCAT Turtle artifacts through the sidecar file-store
port.

The package checks, formatting gate, generated-boundary check, JSDoc inventory,
and node-backed focused Vitest proof passed locally. The post-host-reproof
SHACL driver defect was repaired with a real `shacl-engine` regression test and
the ontology verified-repair test now exercises the real driver. Host follow-up
is still required before treating the phase as end-to-end green: browser/Tauri
re-proof, registry verification for the new catalog assumptions, and
Bun-backed package-script test reruns because this sandbox could not reach the
npm registry and the Bun/Vitest package scripts timed out before importing the
new tests.

## Defect Repair: Validate Button Inert

Host evidence showed the P5 validation panel rendered but clicking Validate left
the panel at `not run`, with no loading state, error state, or network failure.

Root cause: opened Turtle quads were all initialized into the asserted
partition. `deriveSessionGraphPartitions` only put SHACL shapes into the shapes
partition when they came from explicit `ChangeOperation` entries with
`partition: "shapes"`. The host fixture combines data and SHACL shapes in one
opened Turtle file, so the `sh:NodeShape` subject and its blank-node property
shape stayed in asserted data and `partitions.shapes` was empty. The validation
atom then had no visible blocked or failed state, so this looked like an inert
button from the renderer.

Fix:

- `Session.model.ts` now partitions base-file SHACL `sh:NodeShape` subjects and
  their `sh:property` blank nodes into the shapes partition during session graph
  derivation.
- `Session.service.ts` serializes asserted, ontology, and shapes partitions so
  saving an opened mixed data+shapes document does not drop the shapes.
- `Session.atoms.ts` adds explicit validation states: `idle`, `running`,
  `blocked`, `failed`, and `complete`.
- A no-shapes guard now surfaces `No SHACL shapes detected in this document.`
  in the validation panel instead of silently returning.
- Validation and provenance RPC failures are caught and surfaced as
  `Validation failed: ...` or `Export failed: ...` panel errors.
- `Session.workbench.tsx` renders the running, blocked, and failed states.
- `apps/professional-desktop/test/ontology-sidecar-registration.test.ts`
  proves `RunOntologyValidation` and `ExportOntologyProvenance` are served
  through the desktop `OntologyRpcs` handler layer, matching the P4
  sidecar-registration regression shape.

Focused defect proof:

```sh
bunx biome check apps/professional-desktop/test/ontology-sidecar-registration.test.ts packages/ontology/client/test/Session.atoms.test.ts --write
bunx vitest run packages/ontology/domain/test/Session.test.ts packages/ontology/use-cases/test/Session.test.ts packages/ontology/client/test/Session.atoms.test.ts apps/professional-desktop/test/ontology-sidecar-registration.test.ts --pool=forks
bun run --cwd packages/ontology/domain check
bun run --cwd packages/ontology/use-cases check
bun run --cwd packages/ontology/client check
bun run --cwd packages/ontology/ui check
bun run --cwd apps/professional-desktop check
```

Results:

- Biome checked the final edited registration/client test files with no fixes
  required.
- Focused Vitest proof passed: 4 files, 19 tests.
- Touched package checks passed for ontology domain, use-cases, client, UI, and
  professional desktop.

Regression coverage added:

- Domain partition test for opened SHACL node/property shapes.
- Use-case serialization test proving opened SHACL shapes are saved with
  asserted data.
- Atom/protocol success test that opens a session whose shapes came from Turtle,
  triggers `runOntologyValidationAtom`, and asserts a violation reaches the
  validation result state.
- Atom guard test for an opened document without shapes, asserting no inference
  or validation RPC is called and the visible `blocked` state/message is set.
- Desktop sidecar registration test for validation and provenance export RPCs.

## Defect Repair: shacl-engine Factory Missing `dataset()`

Host re-proof after the partition/state repair showed the validation flow now
ran and the renderer failure state surfaced the actual driver defect:

```text
Validation failed: TypeError: runtime.dataset is not a function.
(In 'runtime.dataset()', 'runtime.dataset' is undefined)
```

The sidecar returned the typed error with HTTP 200 and the client rendered it,
so the surfaced-error state is working as designed.

Root cause: `@rdfjs/data-model` and `@rdfjs/dataset` were lazy-imported as
separate packages, but the driver did not combine them into the RDF/JS
environment expected by `shacl-engine`. The installed `@rdfjs/dataset` package
exposes `dataset()` on its default factory export, not as the named export the
adapter was reading. `shacl-engine` also calls `this.factory.dataset()` while
building validation reports, so the factory passed into `new Validator(...)`
must expose both DataFactory methods and DatasetFactory `dataset()`.

Fix:

- `packages/drivers/shacl/src/Shacl.validation.ts` now builds a lazy composite
  runtime factory inside validation with bound `namedNode`, `blankNode`,
  `defaultGraph`, `literal`, `quad`, `variable`, and `dataset` methods.
- The same composite factory is passed to `new Validator(...)` and used by the
  local RDF dataset conversion path via `runtime.factory.dataset()`.
- `packages/drivers/shacl/src/vendor.d.ts` now models the actual
  `@rdfjs/dataset` default factory shape and the composite factory expected by
  `shacl-engine`.
- The report mapper was tightened against real engine result objects:
  `path` can be a parsed path step with `predicates`, and blank-node source
  shapes are no longer coerced into invalid named-node IRIs.

Regression coverage added:

- `packages/drivers/shacl/test/ShaclEngineValidation.test.ts` executes
  `shacl-engine` for real against an in-memory shapes graph containing
  `sh:NodeShape`, `sh:hasValue`, and `sh:minCount`. A violating non-empty data
  graph asserts that violations arrive with `focusNode` and `path`; a
  conforming graph asserts zero violations.
- `packages/ontology/use-cases/test/Session.validation.test.ts` now provides
  `ShaclValidationServiceLive` from `@beep/shacl`, so the verified-repair
  pipeline covers real validation instead of the bounded fake adapter.

Focused proof:

```sh
node node_modules/vitest/vitest.mjs run --config packages/drivers/shacl/vitest.config.ts packages/drivers/shacl/test
cd packages/ontology/use-cases && node ../../../node_modules/vitest/vitest.mjs run --config vitest.config.ts test/Session.validation.test.ts
BUN_TMPDIR=/tmp bun run --cwd packages/drivers/shacl check
BUN_TMPDIR=/tmp bun run --cwd packages/ontology/use-cases check
BUN_TMPDIR=/tmp bun run --cwd packages/drivers/shacl lint
BUN_TMPDIR=/tmp bun run --cwd packages/ontology/use-cases lint
git diff --check
```

Results:

- `@beep/shacl` node-backed Vitest: 2 files, 3 tests passed.
- Ontology validation use-case node-backed Vitest: 1 file, 1 test passed.
- `@beep/shacl` and `@beep/ontology-use-cases` package checks passed.
- `@beep/shacl` and `@beep/ontology-use-cases` package lint passed.
- Root `BUN_TMPDIR=/tmp bun run lint` passed, including schema-first, docgen,
  package test-imports, spell, deprecated API, and package Biome checks.
- Root `BUN_TMPDIR=/tmp bun run check` passed, including package build checks,
  dtslint tsgo, test tsgo, and tsgo smoke.
- `git diff --check` passed.

## Implementation Surface

- `packages/drivers/shacl`
  - `@beep/shacl` package with lazy `shacl-engine` imports, typed driver
    errors, RDFJS dataset conversion, package metadata, tsconfig, docgen, and
    import-safety test coverage.
  - `ShaclValidationServiceLive` implements the semantic-web
    `ShaclValidationService` contract and maps engine reports back into typed
    violations with focus node, path, severity, message, and source shape.
- `packages/foundation/capability/semantic-web`
  - Extended the SHACL contract with `targetNode`, `hasValue`, `sourceShape`,
    and optional raw `shapesDataset` support.
  - Kept the bounded adapter compatible with the expanded typed contract.
- `packages/ontology/use-cases`
  - `Session.validation.ts` assembles asserted + ontology + inferred data,
    parses the fixture shapes subset, runs validation, creates verified repair
    proposals, and exports provenance/dataset Turtle documents.
  - Validation and export commands are exposed through the Session RPC/barrel
    surface and server exports.
- `packages/ontology/server` and `apps/professional-desktop`
  - Server layer provides the SHACL driver-backed validation runner.
  - Desktop orchestrator handles `RunOntologyValidation` and
    `ExportOntologyProvenance` sidecar RPCs.
- `packages/ontology/client` and `packages/ontology/ui`
  - Atoms run validation after ensuring inferred data, apply verified repairs
    through `ApplyOntologyBatch`, refresh validation after repair, and export
    provenance artifacts.
  - The workbench validation panel shows severity, messages, paths, focus
    navigation, verified repair actions, export paths, and real SHACL metrics.

## Driver Design

SPEC 17 names `rdf-validate-shacl` / `shacl-engine` as acceptable SHACL engine
candidates. This phase chose `shacl-engine` because the repo already had a
catalog entry for it and its RDFJS-oriented API fits the existing RDF term
model with a narrow conversion boundary.

The driver stays DOM-free at module import: the engine and RDFJS dependencies
are loaded only inside `validate`. The service accepts raw shapes graphs from
the ontology session when available, while still supporting the bounded typed
shape subset used by the original semantic-web contract. Validation placement
matches P4: renderer atoms call sidecar RPCs, the desktop orchestrator delegates
to server-provided use-cases, and inferred data is produced sidecar-side before
validation.

## Repair Verification

Repair proposals are generated only for concrete, typed, low-risk violations:
property shapes with a concrete `sh:hasValue` target. Each proposal is a
typed `ChangeOperation.addQuad` against the asserted partition.

Before a proposal is returned to the UI, the runner applies the operation to a
candidate change log with `applyChangeOperationsWithDelta`, re-runs validation
over the candidate asserted + inferred dataset, and keeps the proposal only if
that source-shape/focus/path violation disappears. The UI applies accepted
repairs through the standard `ApplyOntologyBatch` atom path, so undo/redo and
the change log own the mutation and can roll it back.

## Provenance Export

`ExportOntologyProvenance` writes two Turtle artifacts through
`OntologyFileStore`, not into the primary saved ontology document:

- `<base>.prov.ttl` contains a PROV-O activity/entity record derived from the
  session change log, including operation ids, undoability, timestamps when
  present, and operator metadata.
- `<base>.dataset.ttl` contains a VoID/DCAT dataset description with counts for
  asserted, ontology, inferred, and shape quads plus dataset/export metadata.

Both exports use the existing `TurtleCodec` port and live outside the saved
Turtle path, preserving the P1 rule that derived/named-graph views never leak
into primary persistence.

## Dependencies

Catalog entries used by this phase:

- `shacl-engine`: existing catalog pin `^1.1.2`
- `@rdfjs/data-model`: added catalog pin `^2.1.1`
- `@rdfjs/dataset`: added catalog pin `^2.0.2`

Important: registry verification is not complete. `npm view shacl-engine
version --json`, `npm view rdf-validate-shacl version --json`, and
`npm view shacl-engine versions --json` timed out in the sandbox. Treat the
new pins as assumptions until a host with npm registry access verifies them.

## Local Proof

Passed:

```sh
bun run --cwd packages/foundation/capability/semantic-web check
bun run --cwd packages/drivers/shacl check
bun run --cwd packages/ontology/use-cases check
bun run --cwd packages/ontology/server check
bun run --cwd packages/ontology/client check
bun run --cwd packages/ontology/ui check
bun run --cwd apps/professional-desktop check
(cd packages/drivers/shacl && BUN_TMPDIR=/tmp bunx vitest run test/ShaclLazyImport.test.ts --pool=forks --maxWorkers=1 --no-file-parallelism)
(cd packages/ontology/use-cases && BUN_TMPDIR=/tmp bunx vitest run test/Session.validation.test.ts --pool=forks --maxWorkers=1 --no-file-parallelism)
bunx biome check <touched P5 files>
BUN_TMPDIR=/tmp bunx sherif@1.10.0 -r non-existent-packages
bunx syncpack lint
bun run beep quality knip
bun run beep quality fallow boundaries config-check --check
bun run beep quality jsdoc-inventory
bun run beep quality jsdoc-ratchet
bun run beep quality changeset-graph
git diff --check
```

Focused Vitest proof:

- `packages/drivers/shacl/test/ShaclLazyImport.test.ts`: 1 file, 1 test passed.
- `packages/ontology/use-cases/test/Session.validation.test.ts`: 1 file,
  1 test passed. The test covers SHACL violation -> verified repair proposal,
  applying the repair through the typed change-op engine, clean re-validation,
  undo acceptance by removing the repair operation from the change log, and
  PROV-O + VoID/DCAT export writes through the file-store port.

Bun-backed package-script test commands attempted but blocked before importing
test files:

```sh
bunx --bun vitest run packages/ontology/use-cases/test/Session.validation.test.ts
bun run --cwd packages/ontology/use-cases test -- test/Session.validation.test.ts
bun run --cwd packages/ontology/use-cases test -- test/Session.validation.test.ts --pool=threads
bun run --cwd packages/drivers/shacl test
```

Observed blockers were Bun/Vitest worker startup failures:
`[vitest-pool]: Failed to start forks worker`, `Timeout waiting for worker to
respond`, and a threads-worker null stdout pipe error. These happened before
the P5 assertions loaded.

## Host Commands Required

Run on the host with normal network/package-manager access:

```sh
npm view shacl-engine version --json
npm view @rdfjs/data-model version --json
npm view @rdfjs/dataset version --json
bun install
bun run --cwd packages/drivers/shacl test
bun run --cwd packages/ontology/use-cases test -- test/Session.validation.test.ts
bun run --cwd packages/foundation/capability/semantic-web check
bun run --cwd packages/drivers/shacl check
bun run --cwd packages/ontology/use-cases check
bun run --cwd packages/ontology/server check
bun run --cwd packages/ontology/client check
bun run --cwd packages/ontology/ui check
bun run --cwd apps/professional-desktop check
git diff --check
bun run --cwd apps/professional-desktop dev:sidecar
bun run --cwd apps/professional-desktop dev
```

Then verify in the running desktop/web shell:

- Open an ontology document with a `shapes.ttl` sidecar from
  `packages/ontology/server/test/fixtures/ontoauthor-mat/*`.
- Run validation and confirm the previous `runtime.dataset is not a function`
  error no longer appears.
- Run validation and confirm violations count in metrics matches the panel.
- Click a violation focus action and confirm the resource is selected/revealed.
- Apply a verified repair and confirm validation clears that violation.
- Undo the repair and confirm the violation returns.
- Export provenance and confirm `.prov.ttl` plus `.dataset.ttl` files are
  written through the sidecar file store, while saving the primary Turtle does
  not include PROV-O, VoID, DCAT, inferred, or validation named-graph data.

## P6 Risks

- Host must verify the SHACL dependency pins before install. P4 already showed
  invented registry pins can break package installation.
- The current verified-repair generator is intentionally conservative:
  `sh:hasValue` property repairs only. P6 should decide whether broader SHACL
  repair synthesis is required or defer it to a follow-up.
- Bun/Vitest worker startup must be resolved on a host run so the
  violation -> repair -> undo acceptance test is actually executed.
- Protégé/ROBOT interop should inspect both exported Turtle files and primary
  persistence to prove derived artifacts remain sidecar-only.
