# File Processing Capability

## Status

Active — P1 minimum vertical proof complete; P2/P3/P4/P5 driver, corpus, and
handoff phases remain pending.

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
- The P1 proof is a minimum vertical slice. Broad Tika coverage across every
  non-PST V1 family, real/public PST export coverage, and optional corpus
  profiling remain later phases.
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

The remaining completion standard is P2/P3/P4/P5: finish broad non-PST Tika
coverage, deepen libpff PST export, calibrate CLI output against generated and
operator-local corpus inputs, and record final handoff evidence.
