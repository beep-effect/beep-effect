# @beep/doc-text

JS-native document text extraction driver for the `@beep/file-processing`
capability. Wraps two engines behind the file-processing engine contract:

- **unpdf** (pdfjs) — PDF text-layer extraction (no OCR; scanned PDFs without a
  text layer are out of scope per the legal-document-intake SPEC).
- **mammoth** — DOCX raw-text extraction.

No external runtime is required (no JVM/Tika server) — both engines run inside
the bun sidecar. Plain-text formats stay with `@beep/tika`'s decode path; this
driver exists for the binary formats Tika defers.

Origin: `goals/legal-document-intake` P2 (decision D8-S1 — content-aware
filing pulled text extraction forward from P4).

Test fixtures are generated in-test with `pdf-lib` and `docx` (devDependencies)
so no binary fixtures are committed.
