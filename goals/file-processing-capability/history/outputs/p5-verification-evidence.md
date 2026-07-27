# P5 Verification Evidence

## Status

All three live proofs ran on July 27, 2026 against real engines. The hermetic
suites, package gates, and repo proof lanes for the closing PRs (#477, #478,
and this P5 PR) ran through yeet (repair, verify full pre-push, publish,
monitor).

## Live Tika calibration (opt-in `BEEP_TEST_TIKA_URL` lane)

- Server: Apache Tika 3.3.1 (`docker` image `apache/tika:latest-full`,
  container `beep-tika-p5`, `http://localhost:9998`;
  `curl -s :9998/version` → `Apache Tika 3.3.1`).
- Command: `BEEP_TEST_TIKA_URL=http://localhost:9998 bun run
  --filter=@beep/tika test:integration`
- Result: 1 file, **11/11 tests passed**, including the two new lanes closing
  the P2 deferral:
  - `extracts live text and metadata for doc` (36ms) — runtime-generated
    OLE2/CFB Word 6/95 fixture, detected `application/msword`, marker text
    extracted.
  - `extracts live text and metadata for docx` (38ms) — runtime-generated
    OOXML ZIP fixture, detected
    `application/vnd.openxmlformats-officedocument.wordprocessingml.document`,
    marker text extracted.
- Fixture validation was independent of Tika: `unzip -t`/`zipfile.testzip`
  clean for the docx; `olefile` confirms the CFB container
  (`WordDocument` stream, `wIdent=a5dc`, `nFib=101`); both generators are
  deterministic (stable SHA-256 across runs); an 18-variant ablation proved
  which FIB fields are load-bearing (`nFib < 106`, `fComplex` unset,
  `fcMac > fcMin`, declared stream size >= 4096).

## Live libpff PST export (opt-in `BEEP_TEST_LIBPFF_PST` lane)

- Engine: `pffexport 20260608` (`/usr/bin/pffexport`).
- Fixture: pinned public sample `testPST.pst` (Apache Tika test corpus,
  Apache-2.0), 2,302,976 bytes, sha256
  `f2a6b1d2cad00f574e3d1c1211c4b1c854d6526caea77213adc3da92b7813ae3`
  (matches `packages/drivers/libpff/README.md`).
- Command: `BEEP_TEST_LIBPFF_PST=<path>/testPST.pst bun run
  --filter=@beep/libpff test:integration`
- Result: **3/3 tests passed** with the strengthened full-EML assertion from
  PR #478 active (every foldable line of every assembled EML, split on
  `/\r?\n/`, fits the 998-octet limit):
  - `reports a runtime pffexport version and exports a real PST` (140ms)
  - `keeps a missing live source inside the operation error contract`
  - `round-trips schema-derived message records through the JSONL string codec`

## End-to-end `beep files process` real-engine proof

- Command: `beep files process --input <corpus> --out-dir <out> --engine auto
  --export-children --failure-policy continue --tika-url
  http://localhost:9998 --pffexport /usr/bin/pffexport`
- Corpus: 11 files — runtime-generated fixtures for every V1 family
  (plain-text, markdown, html, xhtml, rtf, pdf-text-layer, image-metadata,
  doc, docx), the real `testPST.pst`, and a deliberate known non-core `.xls`
  stub.
- Result: exit 0; summary `10 succeeded, 1 skipped, 0 failed`.
- `coverage.json`: every exercised V1 family reports `succeeded: 1, failed:
  0`; the `.xls` records the deliberate known-non-core skip.
- Manifest tree: 61 files — `run.json`, `sources.jsonl`, `failures.jsonl`
  (empty), `coverage.json`, `text/` artifacts, and `children/` holding the
  real pffexport export: 8 assembled `Message.eml` children (including one
  from a nested embedded message under an attachment subtree),
  per-item metadata files, and the `artifacts.jsonl` child record set —
  all child `relativePath`s rebased under `children/` per SPEC.
- The PST in this corpus is French-locale (`Début du fichier de données
  Outlook` folder chain), incidentally proving non-ASCII folder-path
  handling end to end.

## Gates on the closing PRs

- PR #477 (schema-catalog regen): yeet verify full pre-push green locally;
  24/24 hosted checks green; merged 2026-07-27.
- PR #478 (conditional base64 EML bodies): package gates green
  (`@beep/libpff` check / 45 tests / lint / docgen), yeet verify full
  pre-push green (~20 min lane), all required hosted checks green after one
  environment-attributed runner cancellation (Lint Policy job cancelled
  mid-lane; re-run passed with no code change).
- This P5 PR: `@beep/tika` check / 55 tests / lint green, changeset status
  green, reflection artifact schema-valid
  (`bun run beep lint reflection-artifacts` → `blocking_findings=0`), and
  the standard yeet repair/verify/publish/monitor spine.
- Greptile note: the bot reviewed every earlier PR that day but did not
  respond to #477/#478 (explicit `@greptileai review` retrigger posted,
  30+ minute silence window observed); merges were gated on the required
  hosted checks per repo doctrine, with the silence window recorded here for
  auditability.
