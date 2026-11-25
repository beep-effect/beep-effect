---
title: "P5: L3-1 refuses a broader cycle in a repo-owned scheme, records one in a vendor scheme without rewriting it, and runs on fixtures and on the pack"
date: 2026-11-23
lane: "goals/text-knowledge-stack-rebuild-p5-taxonomy"
reversal: "Read the law-practice pack from the ontology test by a decision file that declares the cross-package test input"
---

Map questions T7 and T8, and the reading of L3-1. The named bug is "an import silently rewrites hierarchy" (`research/2026-11-08-rebuild-report.md:356`). `checkBroader(scheme)` builds an `effect/Graph` directed graph over the scheme's concepts with one edge per `broader` link (`Graph.directed` `Graph.ts:642`, `addNode` `:1741`, `addEdge` `:2614`). It reports each strongly connected component with more than one member, and each self-loop, as a `BroaderCycle` (`stronglyConnectedComponents` `:5747`), plus each `broader` target outside the scheme. Graph algorithms are never hand-rolled.

The loader applies it by origin. A `repo-owned` scheme with a cycle or an out-of-scheme target fails the load with `RepoSchemeBroaderViolation`. A `vendor` scheme with a cycle is admitted, the cycle is recorded in `LoadedPack.exceptions`, and the decoded scheme is `Equal` to the bytes' decode, so no edge is dropped or reversed. Classification editions keep their stricter refusal (`ClassificationRegistry.ts:155-171`), which never rewrites either.

`ontology/test/ConceptScheme.profile.test.ts` holds the L3-1 row over fixtures in `ontology/test/fixtures`: an acyclic repo-owned scheme, repo-owned schemes with a planted two-cycle, a self-loop and an out-of-scheme target, and a vendor scheme with a planted three-cycle. A foundation test reading a product slice's files would put product data into a foundation package's inputs. The repo-owned legal schemes are covered by `packages/law-practice/domain/test/LegalVocabularyPack.test.ts`, which loads the real pack through the real loader and asserts the same profile with no exception. The law ledger names both files.
