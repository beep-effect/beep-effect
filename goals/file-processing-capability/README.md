# File Processing Capability

## Status

Lifecycle: `completed-retained`

Completed-retained (closed 2026-07-27) — all five phases complete: P1 minimum
vertical proof, P2 Tika Server driver, P3 libpff PST-export driver, P4
real-engine CLI proof, and P5 quality and handoff. Latest evidence: live
doc/docx Tika calibration (11/11 live tests against Apache Tika 3.3.1,
runtime-generated OLE2 `.doc` / OOXML `.docx` fixtures), real-PST end-to-end
`beep files process` proof across every V1 family, and the conditional base64
EML body-encoding fix (PR #478). Handoff notes:
[history/outputs/p5-implementation-notes.md](./history/outputs/p5-implementation-notes.md);
verification evidence:
[history/outputs/p5-verification-evidence.md](./history/outputs/p5-verification-evidence.md);
closeout reflection:
[history/reflections/2026-07-27-claude.md](./history/reflections/2026-07-27-claude.md).

Packet hardening completed on 2026-06-02. The P1 implementation landed through
the law-practice office-action branch and merged to `main` in PR #262 on
2026-06-18.

## Mission

Define the product-neutral file processing capability required before document
management, local file sync, corpus ingestion, and later knowledge-graph
pipelines can rely on durable extraction artifacts.

This packet intentionally starts below product features. V1 proves file
detection, extraction, archive export, and manifest writing across the corpus
core formats without implementing Box sync, document-management workflows,
knowledge-graph ingestion, or OCR engines.

## Source material

The deferred OCR / PDF-diagnostics phase draws on 13 mined gold nuggets from the
Gold-Intake initiative. Provenance — each nugget's upstream repo, license, and
the in-repo capability it composes with — is tracked in
[research/SOURCES.md](./research/SOURCES.md). Source exploration dir:
[`explorations/_gold-intake/`](../../explorations/_gold-intake/) (cluster
*"Layout-aware PDF extraction + OCR-need gating"*). The folded research note is
[research/gold-intake-ocr-pdf-diagnostics.md](./research/gold-intake-ocr-pdf-diagnostics.md).

## Reading Order

- [GOAL.md](./GOAL.md) - compact `/goal` launcher
- [SPEC.md](./SPEC.md) - authoritative goal contract when it does not
  conflict with the architecture standard
- [PLAN.md](./PLAN.md) - phased implementation plan
- [research/engine-selection.md](./research/engine-selection.md) - engine and
  driver rationale
- [ops/manifest.json](./ops/manifest.json) - machine-readable routing metadata

For topology, package placement, boundary, and error doctrine,
`standards/ARCHITECTURE.md` and `standards/architecture/*` outrank this packet.

## Target Topology

- `packages/foundation/capability/file-processing` publishes
  `@beep/file-processing`.
- `packages/drivers/tika` publishes `@beep/tika`.
- `packages/drivers/libpff` publishes `@beep/libpff`.
- `packages/tooling/tool/cli` adds `beep files process` as the repo-operated
  proof and corpus coverage surface.

`@beep/file-processing` owns schema-first operation contracts, extraction IR,
typed failures, strategy selection, and service contracts. It does not own
format-specific engines. Drivers implement declared operation capabilities.

## Latest Evidence

- 2026-07-27: P4 complete — `beep files process` composes the real driver
  engines: Tika App (`--tika-jar`/`--java`), Tika Server (`--tika-url` or
  `BEEP_TIKA_*` env, SPEC default), and pffexport (`--pffexport`), constructed
  lazily per family and forced ahead of dispatch so configuration failures
  exit 2 (SPEC exit policy, via `Runtime.errorExitCode`) before any engine
  side effect. Duplicate byte-identical inputs dedupe to one representative
  per content digest with deterministic skip records; real pffexport child
  references are rebased onto the output root; PST/EML/JSONL children flow
  into `children/<artifact-id>/artifacts.jsonl`. Seven hermetic stub-engine
  test lanes (real-stub happy path, dedupe ordering, unreachable-Tika and
  missing-pffexport failure translation, config exit hint, engine-family env
  isolation, budget-exhausted PST pin) plus the existing `--engine test`
  lanes; 71 files-command tests green. Design contract with two
  adversarial-review rounds: `research/p4-files-process-design.md`.
- 2026-07-26: P3 complete — `@beep/libpff` completed the pffexport engine:
  `-V` engine-version capture (verified `20260608` against the live local
  binary), mode-derived target-tree walking
  (`.export`/`.orphans`/`.recovered`), deterministic per-item `Message.eml`
  assembly with MIME-structural header stripping,
  `<artifact-id>.messages.jsonl` metadata records (`PffexportMessageRecord`)
  preserving folder/message/body/attachment relationships, the
  `existingExportPolicy` output-directory policy, a shared
  `Libpff.error-translation.ts` role file (signal-killed pffexport now maps to
  `archive-export-failed`), cumulative EML materialization budgeting, and a
  stubbed deterministic suite plus the opt-in `BEEP_TEST_LIBPFF_PST` live
  lane. Design contract with two adversarial-review rounds:
  `research/p3-libpff-design.md`.
- 2026-07-26: P2 complete — `@beep/tika` gained the default Tika Server HTTP
  engine (`makeTikaServerFileProcessingEngine`), typed `TikaServerEngineConfig`
  (`BEEP_TIKA_BASE_URL` / `BEEP_TIKA_TIMEOUT_MILLIS` / `BEEP_TIKA_MAX_OUTPUT_BYTES`),
  shared `Tika.response.ts` / `Tika.error-translation.ts` role files, the
  `output-budget` error reason, engine-version capture via `GET /version`, a
  stubbed-HTTP behavior suite over all 12 declared families, and an opt-in
  `BEEP_TEST_TIKA_URL` live integration lane. The design contract pinned
  live doc/docx calibration to P5.
- `@beep/file-processing` exists at
  `packages/foundation/capability/file-processing` with runtime-neutral
  artifact, operation, extraction, strategy, service, path-safety, fixture, and
  manifest contracts.
- Current real consumers import it from `@beep/tika`, `@beep/libpff`,
  `@beep/repo-cli`, and the law-practice office-action loop.
- `@beep/tika` proves the P1 text extraction path and typed
  engine-unavailable behavior.
- `@beep/libpff` proves typed engine-unavailable behavior and a synthetic PST
  child-artifact export proof.
- `beep files process` writes the schema-encoded manifest tree for generated
  fixtures.
- The P1 proof is a minimum vertical slice; P2 broadened Tika across the
  non-PST V1 families and P3 deepened pffexport PST export. Real-PST proof
  runs through the opt-in `BEEP_TEST_LIBPFF_PST` live lane (documented public
  sample: EDRM Enron); CLI manifest calibration and optional corpus profiling
  remain P4/P5.
- 2026-06-29: gold-intake research note added at
  `research/gold-intake-ocr-pdf-diagnostics.md` (see for OCR-need gating,
  layout-aware PDF extraction, MIME/encoding/mojibake repair, and input-quality
  gating feeding the SPEC-deferred OCR strategy/driver boundary).

## Consumer Alignment

The remaining P2-P5 work remains aligned with
`goals/legal-document-intake` P4: broad extraction runs over filed documents,
while the libpff/PST lane supplies exported email and attachment artifacts for
the same downstream extraction and knowledge-graph loop.

## V1 Cutline

In scope:

- DOC, DOCX, RTF
- HTML and XHTML
- text-layer PDFs
- PST export to EML plus JSONL metadata
- plain text and Markdown
- image file metadata without OCR
- schema-encoded manifest tree output
- generated synthetic fixtures for package and CLI tests
- optional coverage profiling against `<operator-local-corpus>`

Known non-core inputs from the local corpus include XLS, XLSX, and DOCM. V1
must classify them deterministically as supported, skipped, or failed, but full
spreadsheet and macro-enabled document extraction is not a completion
requirement.

Out of scope:

- OCR implementation
- Box API, Box Drive, webhooks, or sync policy
- document-management product workflows
- knowledge-graph extraction or assembly
- legal-domain entity resolution
- bidirectional document conversion
- production artifact storage or retention policy

## Completion Standard

P1 is complete when the foundation capability has at least two real consumers,
driver-backed proof paths, and CLI manifest output. That proof is now present.

The remaining completion standard is P4/P5: calibrate CLI output against
generated and operator-local corpus inputs, and record final handoff
evidence.
