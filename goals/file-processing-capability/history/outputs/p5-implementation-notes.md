# P5 Implementation Notes And Handoff

## Status

The file-processing capability closed on July 27, 2026. All five phases are
complete; the packet flips to completed-retained in this PR. Consumers
(legal-document-intake P4 and later product packets) should read this file
plus `p5-verification-evidence.md` before importing the capability.

## What shipped, by layer

- `@beep/file-processing` (foundation capability): schema-first operation
  catalog, format/strategy model, typed operation errors, and the
  schema-encoded manifest tree (`ProcessRunManifest`,
  `SourceProcessingRecord`, `FileProcessingFailureRecord`,
  `FileProcessingCoverageSummary`, `TextArtifactReference`,
  `ChildArtifactRecord`). Landed through P1 (PR #262) and hardened through
  P2-P4.
- `@beep/tika` (driver): Tika Server HTTP engine plus Tika App subprocess
  engine, typed `BEEP_TIKA_*` config, shared error translation, stubbed-HTTP
  proof across all 12 declared families, and the opt-in `BEEP_TEST_TIKA_URL`
  live lane — now including runtime-generated `.doc` (OLE2/CFB, Word 6/95
  FIB) and `.docx` (OOXML ZIP) binary fixtures, closing the doc/docx
  calibration deferred from P2 (PR #457).
- `@beep/libpff` (driver): pffexport subprocess engine, mode-derived export
  trees, deterministic `Message.eml` assembly (RFC 5322 header folding, Date
  synthesis, conditional base64 body encoding for over-long lines),
  `PffexportMessageRecord` JSONL, `existingExportPolicy` with atomic export
  claims, shared error translation (PRs #466, #470, #478). Opt-in live lane:
  `BEEP_TEST_LIBPFF_PST`.
- `beep files process` (repo CLI proof): composes the real engines with lazy
  memoized per-family construction, content-digest dedupe, output-rebased
  child references, SPEC 0/1/2 exit codes, and seven hermetic stub-engine
  test lanes (PR #474, design contract
  `research/p4-files-process-design.md`).

## Fixture inventory (all generated, none committed as binaries)

- Text-family fixtures: runtime-generated txt/md/html/xhtml/rtf payloads in
  `packages/drivers/tika/test/integration/live-fixtures.ts`.
- Binary fixtures generated at runtime in the same file: single-page PDF with
  computed xref, 1x1 truecolor PNG with computed CRCs, minimal OOXML `.docx`
  (hand-rolled ZIP writer, stored entries), minimal Word 6/95 `.doc`
  (hand-rolled CFB container; POI `HWPFOldDocument` path via `nFib < 106`;
  see the in-file comments for the load-bearing FIB offsets and the >= 4096
  declared-stream-size cutoff).
- PST: no binary committed. The pinned public sample is Apache Tika
  `testPST.pst` (2,302,976 bytes, sha256
  `f2a6b1d2cad00f574e3d1c1211c4b1c854d6526caea77213adc3da92b7813ae3`),
  download instructions in `packages/drivers/libpff/README.md`.
- Hermetic driver/CLI tests use bash stubs for `pffexport` and `java`, and
  stubbed HTTP for Tika Server.

## Known gaps handed off (deliberate, recorded)

- No `FileProcessingWarningRecord` in the capability manifest schema set:
  archive-export engine warnings (budget-skipped EMLs, claim-release
  failures) surface only as an aggregate count in the CLI summary line. A
  budget-exhausted PST records `succeeded` with EML children absent
  (test-pinned in the P4 suite). Adding a warning record is a
  capability-package decision for a future packet.
- Streaming digests for very large non-PST files: `prepareProcessSource`
  reads whole bytes once per source for digesting; PST sources do not retain
  bytes. Recorded in the P4 design contract §6.
- PDF text-layer status of any operator-local corpus is not verified by this
  packet; `coverage.json` from a `beep files process` run over that corpus is
  the profiling tool.
- Remaining `8bit` EML body parts may carry bare-LF line endings
  (pre-existing, deliberately not normalized; see the v5 addendum in
  `research/p3-libpff-design.md`).
- OCR stays a strategy flag plus skip reason; no OCR driver in V1.
- `xls`/`xlsx`/`docm` classify deterministically and refuse extraction with
  typed `unsupported-file-format` errors (known non-core inputs).

## Operating the capability

- Tika sidecar: any Apache Tika 3.x server; calibration ran against 3.3.1
  (`docker run -d -p 9998:9998 apache/tika:latest-full`). Config via
  `--tika-url` or `BEEP_TIKA_BASE_URL` (default `http://localhost:9998`).
- pffexport: typed `--pffexport` path or PATH discovery; calibration ran
  against pffexport 20260608.
- Corpus profiling: `beep files process --input <corpus> --out-dir <out>
  --engine auto --export-children --failure-policy continue`;
  `coverage.json` is the per-format profile.
