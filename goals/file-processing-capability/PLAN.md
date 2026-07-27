# File Processing Capability Plan

This plan executes [SPEC.md](./SPEC.md). The goal is to create a reusable
file-processing capability and prove it through drivers plus the existing repo
CLI files command group.

## P0: Packet Bootstrap

Status: completed by this packet

Goal: Record package-placement decisions, operation model, V1 cutline, engine
strategy, and implementation gates.

Exit Criteria:

- [x] `README.md`, `SPEC.md`, `PLAN.md`, `research/engine-selection.md`, and
  `ops/manifest.json` exist.
- [x] The packet targets `@beep/file-processing` as a foundation capability.
- [x] The packet names `@beep/tika`, `@beep/libpff`, and `beep files process`
  as the first proof consumers.

Required Checks:

- `jq . goals/file-processing-capability/ops/manifest.json`
- `rg -n "file-processing|tika|libpff|beep files process" goals/file-processing-capability`

## P0.5: Packet Hardening

Status: completed by this hardening pass

Goal: Make the packet decision-complete before package implementation begins.

Exit Criteria:

- [x] Architecture source-of-truth order gives the binding standard precedence.
- [x] P1 is rewritten as a minimum vertical proof instead of contract-only
  scaffolding.
- [x] V1 scope includes HTML and records XLS/XLSX/DOCM as known non-core local
  corpus inputs.
- [x] Engine, runtime, manifest, fixture, and error-boundary decisions are
  explicit enough that implementation agents do not reopen them.
- [x] `ops/manifest.json` includes key decisions, known gaps, command gates, and
  phase status meanings.

Required Checks:

- `jq . goals/file-processing-capability/ops/manifest.json`
- `rg -n "P0.5|Minimum Vertical|HTML|Source-Of-Truth|error-translation|ProcessRunManifest" goals/file-processing-capability`
- `git diff --check`

## P1: Minimum Vertical File-Processing Proof

Status: completed on 2026-06-18 by PR #262

Goal: Prove `@beep/file-processing` as a `foundation/capability` package by
landing the capability contracts, at least two importing consumers, and the
smallest CLI manifest proof in one implementation slice.

Implementation Steps:

1. Reuse existing primitives from `@beep/schema` for paths, filenames,
   extensions, MIME types, JSONL, Markdown, parser options, and file hashes
   where available.
2. Scaffold `packages/foundation/capability/file-processing` with
   runtime-neutral concept subpaths:
   - `Artifact`
   - `Operation`
   - `Extraction`
   - `Strategy`
   - `Service`
   - `test`
3. Model operations as `S.Class` and tagged unions, with typed errors from
   `TaggedErrorClass`.
4. Define hybrid bounded streaming contracts for file bytes and child artifact
   outputs.
5. Scaffold `packages/drivers/tika` and `packages/drivers/libpff`, add them to
   the root workspace list, and make both import declared
   `@beep/file-processing` contracts.
6. Extend `packages/tooling/tool/cli/src/commands/Files` with the initial
   `beep files process` command surface and schema-encoded manifest tree.
7. Add generated fixture helpers under the package test surface.
8. Add package README consumer table naming real current imports from at least
   two of `@beep/tika`, `@beep/libpff`, and `@beep/repo-cli`.
9. Refresh or update package manifests, project references, exports, lockfile,
   docgen metadata, and config-sync artifacts as required by the repo tooling.

Exit Criteria:

- [x] Public schemas encode/decode through Effect schema APIs.
- [x] Service contracts compile without concrete driver imports.
- [x] At least two real consumers import `@beep/file-processing`, and the
  package README records them.
- [x] `@beep/tika` proves one non-PST extraction path or typed
  engine-unavailable behavior.
- [x] `@beep/libpff` proves PST availability/export behavior, or records a
  typed engine-unavailable/fixture-unavailable deferral in tests.
- [x] `beep files process` writes the V1 manifest tree shape for generated
  fixtures.
- [x] Dtslint covers subpath imports and operation result types.
- [x] Unit tests cover operation schemas, strategy matching, and manifest
  encoding.

Required Checks:

- `bun run check`
- `bun run test`
- `bun run docgen:local`
- `bun run config-sync:check`
- `bun run beep yeet verify` before claiming branch-level green

Stop Conditions:

- Do not add product semantics to `@beep/file-processing`.
- Do not import `@beep/tika`, `@beep/libpff`, Box, or product slices from the
  contract package.
- Do not put native process execution in `@beep/schema`.

## P2: Tika Driver

Status: complete (2026-07-26) — Tika Server HTTP engine (`Tika.server.ts`) with
typed config (`BEEP_TIKA_*`), shared response/error-translation role files,
`output-budget` reason, stubbed-HTTP proof across all 12 declared families, and
an opt-in `BEEP_TEST_TIKA_URL` live lane. Live doc/docx binary calibration is
deferred to P5 per the P2 design contract.

Goal: Complete `@beep/tika` as the broad extraction driver for corpus-core text
and metadata after the P1 vertical proof exists.

Implementation Steps:

1. Complete driver-level config for Tika Server base URL, timeout, output
   budgets, and engine version capture.
2. Implement detection and extraction capability declarations compatible with
   `@beep/file-processing/Strategy`.
3. Translate Tika/runtime failures into driver errors, then operation-level
   errors at the adapter boundary.
4. Add generated DOCX, RTF, HTML, PDF, plain-text, Markdown, and image-metadata
   fixtures.

Exit Criteria:

- [ ] Tika driver reports engine name and version.
- [ ] Driver extracts text and metadata for every non-PST V1 format family,
  including HTML.
- [ ] Driver failures do not escape the operation contract as Tika or process
  errors.

Required Checks:

- `bun run --filter=@beep/tika check`
- `bun run --filter=@beep/tika test`
- `bun run --filter=@beep/tika lint`

## P3: libpff Driver

Status: complete (2026-07-26) — the pffexport engine gained `-V` version
capture, mode-derived target-tree walking (`.export`/`.orphans`/`.recovered`),
deterministic per-item `Message.eml` assembly (verbatim InternetHeaders with
MIME-structural stripping, synthesized Outlook headers otherwise),
`<artifact-id>.messages.jsonl` records (`PffexportMessageRecord`) preserving
folder/message/body/attachment relationships, an `existingExportPolicy`
output-directory policy, a shared `Libpff.error-translation.ts` role file, and
stub-based deterministic coverage plus an opt-in `BEEP_TEST_LIBPFF_PST` live
lane. Design contract and adversarial-review resolutions:
`research/p3-libpff-design.md`.

Goal: Implement `@beep/libpff` as the PST export driver.

Implementation Steps:

1. Complete driver-level config for executable path, timeout, export mode, and
   output directory policy.
2. Implement PST export into child EML artifacts and JSONL metadata records.
3. Preserve available folder/message/attachment relationships in child artifact
   manifests.
4. Translate native process failures into driver errors, then operation-level
   errors at the adapter boundary.
5. Add generated synthetic PST fixture coverage or a documented public sample
   fallback if fixture generation is not feasible.

Exit Criteria:

- [x] libpff driver reports engine name and version.
- [x] PST export writes child EML artifacts and JSONL metadata records.
- [x] Exported children are represented through `@beep/file-processing`
  artifact schemas.
- [x] Driver failures do not escape the operation contract as process errors.

Required Checks:

- `bun run --filter=@beep/libpff check`
- `bun run --filter=@beep/libpff test`
- `bun run --filter=@beep/libpff lint`

## P4: Repo CLI Proof

Status: complete (2026-07-27) — `beep files process` now composes the real
driver engines (Tika App via `--tika-jar`/`--java`, Tika Server via
`--tika-url` or `BEEP_TIKA_*` env, pffexport via `--pffexport`) with lazy
memoized per-family construction hoisted ahead of dispatch, content-digest
dedupe of duplicate inputs, output-root-rebased child references, SPEC 0/1/2
exit codes through `Runtime.errorExitCode`, memory-light per-representative
source materialization, and seven hermetic stub-engine test lanes. Design
contract with two adversarial-review rounds:
`research/p4-files-process-design.md`.

Goal: Add `beep files process` under the existing repo CLI files command group
and prove manifest-tree output.

Implementation Steps:

1. Extend `packages/tooling/tool/cli/src/commands/Files`.
2. Add flags for input path, output directory, strategy preference, max
   materialized bytes, child export behavior, and failure policy.
3. Compose `@beep/file-processing`, `@beep/tika`, and `@beep/libpff` Layers in
   tooling code.
4. Write a schema-encoded manifest tree with per-source records, extracted
   text references, child artifact manifests, failure JSONL, and aggregate
   coverage summary.
5. Add optional coverage profiling for `<operator-local-corpus>`.
6. Keep reusable file-processing substrate in `@beep/file-processing`; command
   internals remain private to the `Files` command group.

Exit Criteria:

- [x] `beep files process` runs against generated fixtures.
- [x] CLI output validates through `@beep/file-processing` schemas.
- [x] CLI records successful, skipped, and failed records deterministically.
- [x] CLI tests prove failure translation and output tree shape.

Required Checks:

- `bun run --filter=@beep/repo-cli check`
- `bun run --filter=@beep/repo-cli test`
- `bun run --filter=@beep/repo-cli lint`

## P5: Quality And Handoff

Status: pending

Goal: Close the capability with verification evidence and implementation notes
that future product packets can consume.

Exit Criteria:

- [ ] Package-level `check`, `test`, `lint`, and docgen pass for all new
  packages.
- [ ] Relevant root quality lane passes or any unrelated failure is classified.
- [ ] Generated fixtures and manifest outputs are documented.
- [ ] `goals/file-processing-capability/history/outputs/` records final
  implementation notes and verification evidence.

Required Checks:

- `bun run docgen:local`
- `bun run config-sync:check`
- `bun run beep yeet verify`
- affected package `check`, `test`, and `lint`
