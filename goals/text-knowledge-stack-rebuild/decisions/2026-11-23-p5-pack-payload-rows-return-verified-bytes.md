---
title: "P5: pack files the generic loader cannot decode are payload rows, digest-checked and returned as verified bytes"
date: 2026-11-23
lane: "goals/text-knowledge-stack-rebuild-p5-taxonomy"
reversal: "Remove the payload load kind and give law-practice its own digest-checked reader by a decision file"
---

Follows decisions `2026-11-23-p5-the-law-practice-asset-pack-and-its-json-scheme-sources`, `2026-11-23-p5-the-manifest-protocol-verifies-digests-and-loads-concept-schemes` and `2026-11-23-p5-legal-vocabulary-and-intake-models-move-to-law-practice`. Those decisions leave one gap. The pack holds files the generic loader must not decode: the six published TTL and JSON-LD renderings, and the `IntakeTaxonomy` JSON, whose schema lives in `@beep/law-practice-domain` and which a foundation package cannot import.

`VendorLoadKind` gains a second new case, `payload`. A payload row carries the same approval fields and `sha256` as every other row. The loader hashes its bytes through `effect/crypto/Digest` and refuses a mismatch with `VendorSliceDigestMismatch`, exactly as for decoded rows. It returns the verified bytes, undecoded, in `LoadedPack.payloads`, a `HashMap` keyed by the row id. The law-practice domain decodes the intake payload with its own `IntakeTaxonomy` schema in a pure function, `LegalVocabularyPack.intakeTaxonomy(pack)`, which fails with the schema's own decode error. The six renderings are payload rows that no production code reads. The pack test compares their bytes with the frozen digests.

Why not the alternatives. A law-practice manifest load kind would put a product schema into the foundation loader. A second loader in law-practice would duplicate the digest protocol and need `FileSystem` in a domain package. Skipping the intake file from the manifest would leave one pack file unpinned.
