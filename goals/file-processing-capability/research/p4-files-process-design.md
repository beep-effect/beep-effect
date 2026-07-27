# P4 Design Contract: `beep files process` Real-Engine Completion

Status: accepted 2026-07-27 (v3 — v2 design amendments plus post-implementation
adversarial review resolutions; see both "Review resolutions" sections). Scope:
`packages/tooling/tool/cli/src/commands/Files` (+ its tests) only. No
capability, driver, or manifest-schema changes.

## What P1 already landed (verified at live HEAD)

`processFilesImpl` (internal/Process.ts) already implements: safe input
collection (symlink-loop and escape guards, deterministic ordering), output
directory policy (`--overwrite`, overlap refusal), per-source digest/artifact
id/operation id derivation, format classification, the full schema-encoded
manifest tree (`run.json`, `coverage.json`, `sources.jsonl`, `failures.jsonl`,
`text/<operation-id>.txt`, `children/<artifact-id>/artifacts.jsonl`),
`--engine/--export-children/--failure-policy/--max-materialized-bytes` flags,
and fail-on-error behavior.

The gap: `processEngineFor` constructs the P1 **scaffold** engines, which
always defer with `engine-unavailable`. Real extraction has never flowed
through the CLI. P4 = compose the real driver engines, plus the review-forced
correctness work below.

## Precedent (corpus extract, ServicePrograms.ts:1028-1040)

`corpus extract` already composes real engines in this same package:
pffexport with `exportRoot: childrenRoot` + `pffexportPath?`, Tika App with
`jarPath`/`javaPath?`, hermetic bash `pffexport` and `java` stubs in its
tests, and **sha-dedupe before dispatch**. The CLI runtime (bin-main.ts
BaseLayers) already provides FileSystem/Path/HttpClient/Crypto/Spawner on
every path that runs Files commands.

## Exit criteria mapping (PLAN P4)

| Exit criterion | Design |
| --- | --- |
| Runs against generated fixtures | Existing `--engine test` lanes stay; new lanes drive the REAL engines against bash stubs (corpus pattern), fully hermetic. |
| Output validates through `@beep/file-processing` schemas | Already encoded via schema codecs; new tests also DECODE every emitted document back through the schemas. |
| Successful, skipped, failed recorded deterministically | Unchanged ordering + NEW content-digest dedupe (below) so duplicate inputs cannot race. |
| Tests prove failure translation and tree shape | Lanes: unreachable Tika Server → `skipped`/`engine-unavailable`; missing pffexport → `skipped`/`engine-unavailable`; stub-backed success writes EML + messages.jsonl children records; duplicate-PST lane; config-failure lane. |

## Changes

### 1. Options and flags (`Process.schemas.ts`, `Files.command.ts`)

`ProcessFilesOptions` gains four optional keys; flag strings mirror the
corpus command **exactly** (`Corpus.command.ts`): `--tika-jar`
(`tikaJarPath`, `Flag.file({ mustExist: true })` optional), `--java`
(`javaPath`), `--pffexport` (`pffexportPath`), plus the new `--tika-url`
(`tikaUrl`).

### 2. Lazy, memoized per-family engine construction

Real engine construction is effectful (version probes) and happens at most
once per family per run, and ONLY when a collected source actually routes to
that family (or `--engine` forces it):

- `--engine test`: unchanged — `TestFileProcessingEngine` + synthetic libpff.
- tika family: `tikaJarPath` present → Tika App engine (`javaPath?`); else
  `tikaUrl` present → `makeTikaServerFileProcessingEngine` with a decoded
  `TikaServerEngineConfig`; else `makeTikaServerFileProcessingEngineFromEnv()`
  (`BEEP_TIKA_*`, SPEC-default). Construction/config failure maps to a
  config-phase `FilesCommandError` — and can only fail runs that NEED the
  tika engine (a `--engine libpff` run with garbage `BEEP_TIKA_*` env still
  succeeds; test-pinned).
- libpff family: `makePffexportFileProcessingEngine(PffexportEngineConfig.make({
  exportRoot: <outputDirectory>/children, pffexportPath? }))`. Default
  `existingExportPolicy: "fail"` is safe across runs (fresh output dir) and
  intra-run collisions are impossible after the digest dedupe below.
- Unreachable `--tika-url` is safe and fast (the `/version` probe is
  option-guarded and a refused connection returns immediately); a
  DROP-firewalled URL is bounded by the config timeout — recorded as an
  operator note, no new timeout flag in P4.

### 3. Content-digest dedupe before dispatch (determinism blocker)

Duplicate byte-identical inputs share a content-addressed artifact id; two
PST duplicates in one run would race the pffexport per-target claim (one
records `failed` nondeterministically). Fix, mirroring corpus
`selectExtractRecords`: after the prepare phase computes digests, group
sources by artifact id; the FIRST source in the already-sorted relative-path
order is the representative and is processed; every other duplicate records
`skipped` with reason `operation-not-required` and a message naming the
representative path. Prepare and process become two phases (both bounded by
`FilesConcurrency.scan`), and outcome order remains the sorted collection
order. Applies to ALL formats (a duplicate text file is skipped the same
way).

### 4. Children paths rebased to the output root (SPEC blocker)

SPEC: "Manifest paths are relative to the output root." The real pffexport
engine emits child `relativePath`s relative to its `exportRoot`
(`children/`), so the CLI record builder rebases every real-engine child
reference by prefixing `children/` before building `ChildArtifactRecord`.
The synthetic test engine already emits root-relative `children/...` paths
and is left untouched. ("Record builders untouched" from v1 is dropped as a
non-change.)

### 5. Exit-code split 0/1/2 (SPEC-binding, implemented in P4)

SPEC's "Default CLI exit policy" outranks PLAN silence: `2` when command
configuration, output preparation, or required engine discovery fails before
per-source processing; `1` for fail-on-error; `0` otherwise.
`FilesCommandError` gains an optional exit-code hint (default `1`), set to
`2` by the config-phase failure sites (input collection, output-dir prep,
engine construction/config decode); the Files command boundary applies the
hint to the process exit code without touching shared runner machinery. The
exact mechanism is settled against `bin-main.ts` teardown behavior at
implementation time; tests assert the hint on the typed error (in-process
tests cannot observe OS exit codes).

### 6. PST sources do not retain bytes (memory note)

`prepareProcessSource` keeps reading bytes once for the digest, but no longer
retains them on the `SourceArtifact`/prepared struct for PST-routed sources —
pffexport consumes the file by locator, so retaining multi-GB PST bytes at
concurrency 16 was pure heap risk. Text-family sources keep bytes (Tika
Server prefers them; single read). Corpus profiling is documented with this
bound; streaming digests for very large non-PST files stay a recorded P5
note.

### 7. Known, pinned limitation: archive warnings are dropped

`ArchiveExportResult.warnings` (e.g. pffexport budget-skipped EMLs, claim
release failures) have no home in the fixed manifest record set — the
capability defines no `FileProcessingWarningRecord`, and adding one is a
capability-package change out of P4 scope. A budget-exhausted PST therefore
records `succeeded` with EML children absent; a test pins this outcome
deliberately, the run summary line reports the aggregate warning count, and
the schema gap is recorded for P5 handoff.

### 8. Requirements widening

`FilesProcessRequirements` gains `HttpClient.HttpClient`, which widens
`FilesCommandServiceRequirements` (all files subcommands nominally require it;
every bin path provides `BunHttpClient` via BaseLayers). The shared
files-command test layer adds `FetchHttpClient.layer` (Node fetch keeps the
`127.0.0.1` refusal deterministic; proxy-env note for operators).

## Tests (files-command.test.ts additions/updates)

1. **Real-engine happy path (hermetic)**: fixture dir `note.txt`,
   `mailbox.pst`, `table.xls`; `--engine auto --export-children
   --java <bashJavaStub> --tika-jar <existing fixture file>
   --pffexport <bashPffexportStub>` (stub goes to `--java`; the jar path is
   inert — exact corpus wiring). Assert: note.txt `succeeded` with text
   artifact; mailbox.pst `succeeded` with `children/<artifact-id>/artifacts.jsonl`
   containing a `Message.eml` child and the `.messages.jsonl` child, ALL child
   relativePaths starting `children/` and resolving to real files under the
   output root; table.xls `skipped`; every manifest document decodes through
   its schema; deterministic ordering.
2. **Duplicate dedupe**: two byte-identical PSTs (and two identical text
   files) in one input dir → exactly one representative per digest processed,
   duplicates `skipped`/`operation-not-required` naming the representative,
   exit 0, stable across runs.
3. **Tika failure translation**: `--engine tika --tika-url http://127.0.0.1:1`
   → text source `skipped`/`engine-unavailable` in sources + failures JSONL.
4. **pffexport failure translation**: `--engine libpff --pffexport
   /nonexistent/pffexport --export-children` → PST `skipped`/`engine-unavailable`.
5. **Config failure**: malformed `--tika-url` → config-phase
   `FilesCommandError` carrying exit-code hint `2`, before any per-source
   records.
6. **Engine-family isolation**: `--engine libpff` run with malformed
   `BEEP_TIKA_*` env (pinned ConfigProvider or env override) succeeds — tika
   engine never constructed.
7. **Budget-exhausted PST pin**: real pffexport stub + tiny
   `--max-materialized-bytes` → PST `succeeded`, no `Message.eml` child,
   summary reports warnings (limitation §7 pinned).
8. **Existing lanes**: `--engine test` lanes byte-identical; the existing
   `--engine tika` PST-skip lane gets `--tika-url http://127.0.0.1:1` so it
   stays hermetic under real-engine construction.

## Review resolutions (v2)

- Children relativePaths rebased to output root (blocker, contract lens).
- Content-digest dedupe before dispatch; duplicate-PST determinism (blocker,
  all three lenses; corpus precedent carried over).
- Exit-code split implemented in P4 at the Files boundary (important, two
  lenses — SPEC outranks PLAN; a P5 note discharges nothing).
- Lazy memoized per-family engine construction; env failures scoped to runs
  that need the engine; existing `--engine tika` lane pinned hermetic
  (important, two lenses).
- PST byte-retention dropped; corpus profiling documented within that bound
  (important, two lenses).
- Archive warnings limitation made explicit, pinned by test, surfaced in the
  summary count, P5-recorded (important, engine lens).
- Stub wiring corrected (`--java` carries the stub, jar path inert) and flag
  names now mirror corpus exactly (`--tika-jar`, `--java`, `--pffexport`)
  (minor, two lenses).

## Review resolutions (v3 — post-implementation adversarial review)

- **Memory regression fixed** (CONFIRMED): the two-phase prepare/dedupe split
  initially retained every source's bytes for the whole run. `prepared` is now
  metadata-only (ids, digest, format, paths); bytes are hashed and released
  during preparation, and the dispatch-time `SourceArtifact` is built per
  representative — real engines read through the file locator, and only the
  in-memory test engine's text-like extraction materializes content.
- **Exit codes via the canonical channel** (CONFIRMED): the bin-main
  structural teardown sniff was reverted; `FilesCommandError` now declares
  `override readonly [Runtime.errorExitCode] = this.exitCode ?? 1`, the same
  pattern as the Yeet/Worktree/Quality command errors, so
  `Runtime.defaultTeardown` applies the SPEC 0/1/2 split with no runner
  coupling and no defect-hijack surface.
- **Engine discovery hoisted ahead of dispatch** (CONFIRMED): required engine
  families (derived from the deduped representatives' dispatch paths) are
  force-constructed before the concurrent per-source phase, so a
  configuration failure exits 2 before any engine side effect lands in the
  output directory, matching SPEC's "before per-source processing begins".
- **Dedupe block rewritten with effect collections** (CONFIRMED): `A.reduce`
  + `R.set/R.get/R.fromEntries` + `A.getSomes` replace the native
  mutable-record/push block.
- Duplicate-lane ordering pinned (full `sources.jsonl` sequence assertion);
  the pre-existing `--engine tika` PST lane pinned hermetic with
  `--tika-url http://127.0.0.1:1`; proxy env cleared around the
  unreachable-Tika lane so the loopback refusal stays deterministic; the
  orphaned `processFilesImpl` JSDoc re-attached.

## Out of scope

OCR, Box, product workflows, capability/driver package changes (including
`FileProcessingWarningRecord`), corpus command changes, streaming digest
rework, `@beep/file-processing/node` entrypoint.
