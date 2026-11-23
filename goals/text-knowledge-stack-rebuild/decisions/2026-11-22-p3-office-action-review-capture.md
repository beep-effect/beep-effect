---
title: "P3: the office-action review builds its capture from the artifact and the processing result; OfficeActionStructure stays on extractions"
date: 2026-11-22
lane: "goals/text-knowledge-stack-rebuild-p3-annotation"
reversal: "Add a SourceTextIdentity field to OfficeActionReviewInput built by its callers, by a decision file"
---

`OfficeActionReviewInput` does not change. After file processing the use case builds the capture: `scopeRef` the matter fixture key, `sourceRef` the artifact id, `locator` the artifact's `relativePath`, `sourceDigest` the artifact digest, `textDigest` the SHA-256 of the extracted text, `extractor` the processing engine and its `engineVersion`, and `normalizationVersion` `"raw/1"`, since the text is used as extracted. A result with no `engineVersion` fails as the existing `FileProcessingOperationError`, because an unversioned extractor would be an invented pin. The server layer already requires `Digest`.

`OfficeActionStructure` is deterministic rule extraction with its own verified anchors and a stored attempt log. It keeps `GroundedExtraction`, now anchored (decision `p3-grounded-extraction-anchors-on-text-anchor`), and does not read the annotation document in P3.
