---
title: "P5: manifest digests are defined per row shape (file, archive-entry, tree) with contentSha256 for loaded bytes, and pinned editions are held by a frozen test-owned golden"
date: 2026-11-23
lane: "goals/text-knowledge-stack-rebuild-p5-taxonomy"
reversal: "Make ClassificationPin carry its content digest and drop the golden, by a decision file before the loader commit lands"
---

Independent review of the P5 design, findings on L3-4. Refines decision `2026-11-23-p5-the-manifest-protocol-verifies-digests-and-loads-concept-schemes` item 1 and its L3-4 paragraph.

"Hash every admitted row's bytes" had no defined byte string for two row shapes. The `cpc` fixture row's `path` is a directory the registry walks (`packages/foundation/modeling/ontology/test/fixtures/classification/manifest.jsonl:3`, `ClassificationRegistry.ts:283-288`). The real classification rows carry an `archivePath`, and their `sha256` is the digest of the downloaded archive (`explorations/legal-ontology-landscape/assets/fetch.sh:38-56`), which the registry never reads; it reads `path`/`entryPath` (`ClassificationRegistry.ts:238-241`).

1. A row's digest unit is `file`, `archive-entry` or `tree` (`VendorDigestUnit`, a `LiteralKit`). It is the row's optional `digestUnit`, defaulting on decode to `archive-entry` when `archivePath` is present and `file` otherwise. A directory row states `tree`. The loader refuses a `tree` row whose path is a file and a `file` row whose path is a directory.
2. `sha256` keeps the meaning `fetch.sh` gives it: the digest of the fetched artifact. A new optional field, `contentSha256`, is the digest of the bytes the loader reads. A `file` row is checked against `sha256`. An `archive-entry` row is checked against `contentSha256` over the entry bytes. A `tree` row is checked against `contentSha256`, the SHA-256 of the UTF-8 bytes of the lines `<relative-path>\t<sha256-hex>\n`, one per file the loader reads under the directory, `/`-separated and sorted in code point order. A row with no fetched artifact (the fixtures) has `sha256` equal to `contentSha256`.
3. An `archive-entry` or `tree` row with no `contentSha256` decodes, and is refused at load with `VendorContentDigestMissing { id, unit }`. The four real exploration rows therefore keep decoding; `fetch.sh` learns to compute `contentSha256` after extraction, and no test loads a real edition.
4. A test-owned frozen golden, `ontology/test/fixtures/classification/pins.golden.json`, maps each `ClassificationPin { kind, edition }` and row id to its content digest. No tooling writes it. `ClassificationEdition.test.ts` asserts each manifest row's verified digest equals the golden, so changing an edition's bytes and refreshing its manifest row in one commit still fails; a changed edition needs a new edition string (a new pin) or a visible golden edit. `ClassificationPin` stays `{ kind, edition }`.
5. `TaxonomyLoader.manifest.test.ts` decodes the real exploration manifest and asserts every row derives a digest unit.
