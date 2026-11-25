---
title: "P5: TaxonomyLoader verifies every row's sha256, loads concept-scheme rows by origin, drops the legacy TaxonomySeed route and returns a LoadedPack"
date: 2026-11-23
lane: "goals/text-knowledge-stack-rebuild-p5-taxonomy"
reversal: "Restore the hard-coded base seed and the legacy slice route by a decision file; no caller outside the ontology tests runs the loader"
---

Map questions T2, T5, T15, S1 and S17. `TaxonomyLoader` stays the one manifested loader (`ontology/src/TaxonomyLoader.ts:946`), and its protocol changes in five ways.

(1) Every admitted row, of every load kind, has its loaded bytes hashed through `effect/crypto/Digest` in the row's digest unit and compared with the row's `sha256` or `contentSha256` (decision `2026-11-23-p5-manifest-digests-are-defined-per-row-shape-and-pinned-by-a-frozen-golden`). A mismatch fails with a new `VendorSliceDigestMismatch { id, expected, actual }`, and `ClassificationRegistry` gets the same check. Today no TypeScript path hashes a byte (`ClassificationRegistry.ts:50` decodes the field and never compares it). The classification fixture manifest's sixty-four-zero digests (`ontology/test/fixtures/classification/manifest.jsonl:2-5`) are replaced by the real values. The row format keeps bare hex, the committed vendor-pack format; the SPEC scopes bare `Sha256Hex` out of the identifier rule.
(2) `VendorLoadKind` gains `concept-scheme`, whose row also states `origin: repo-owned | vendor` and decodes a `ConceptScheme` JSON file.
(3) The legacy route, a `loadStatus` row with no `loadKind` decoded as `TaxonomySeed` (`:172-187`, `:767-781`), is deleted. Its one fixture becomes a vendor `concept-scheme` row. `TaxonomySeed` itself stays until the pack commit, because `runLibrarianLoop` (`TaxonomyRegistry.ts:15`, `:170`) and its tests still take it; the pack commit moves the loop, re-typed, and deletes `TaxonomySeed`.
(4) `mergeSlices` no longer starts from `SemanticFoundationSeed` (`:914-931`). `load` returns a `LoadedPack`: the schemes keyed by IRI, the applied alignments and the recorded exceptions. The caller chooses the scheme it needs by pin. A `concept-alignment` row resolves only against `concept-scheme` rows of the same manifest (decision `2026-11-23-p5-the-folio-alignment-lives-in-the-legal-intake-scheme-and-alignments-resolve-within-one-manifest`).
(5) The layer requires `FileSystem` and `Digest`.

L3-4 immutability means a digest in the row's unit checked on load, a frozen test-owned pin-to-digest golden the manifest must match, and `Equal` across two loads of one pin (decision `2026-11-23-p5-manifest-digests-are-defined-per-row-shape-and-pinned-by-a-frozen-golden`). `ClassificationPin` keeps `{ kind, edition }` with no `latest`. The real-manifest decode case moves from `SemanticFoundation.test.ts:105-128` to `ontology/test/TaxonomyLoader.manifest.test.ts`, keeping the manifest path text, and the goal-data consumer row's evidence path (`packages/tooling/tool/cli/src/commands/Ci/CiOperational.schemas.ts:332-337`, reference rule `:185`) follows in the same commit.
