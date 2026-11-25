---
title: "P5: the rdf-canonize driver keeps rdf-canonize at runtime for lexical-sort-v1 and as the oracle, delegates rdfc-1.0 to the rdf port, and keeps its fingerprint bytes"
date: 2026-11-23
lane: "goals/text-knowledge-stack-rebuild-p5-taxonomy"
reversal: "Retire @beep/rdf-canonize with delete-package after re-expressing lexical-sort-v1 over rdf serializeQuad, by a decision file before the canonicalization commit lands"
---

Independent review of the P5 design, findings on the driver's fate. Supersedes the consequences paragraph of decision `2026-11-23-p5-rdfc-1-0-is-ported-into-rdf` where they differ.

The driver's source still uses `rdf-canonize` at runtime in two places the port does not replace: `lexical-sort-v1` serializes through its `NQuads.serialize` (`packages/drivers/rdf-canonize/src/adapters/canonicalization.ts:100-101`), and the `rdfc-1.0` path parses the canonical text back with `NQuads.parse` to build the `dataset` that `CanonicalDatasetResult` returns (`:212-219`; `packages/foundation/capability/semantic-web/src/services/canonicalization.ts:250-253`). `@beep/ontology-server` depends on the driver at runtime. Moving `rdf-canonize` to devDependencies would break both.

1. `@beep/rdf-canonize` keeps `rdf-canonize` as a runtime dependency. It still wraps an external engine (`standards/ARCHITECTURE.md:60`), for `lexical-sort-v1`, and the same package is the parity oracle in its tests.
2. `canonicalize` in `@beep/rdf` returns `CanonicalForm { nquads, dataset }`, where `dataset` is the input relabelled with the issued `c14n` identifiers. The driver's `rdfc-1.0` branch delegates to it and builds `CanonicalDatasetResult` from it, so production has one RDFC-1.0 implementation and no `NQuads.parse` round trip.
3. The CAS fingerprint keeps its bytes: it hashes the `trimEnd`-ed canonical text (`:218`, `:267`), while `DatasetDigest` hashes the canonical N-Quads, which end in a newline. The design no longer claims the fingerprint equals the hex of `DatasetDigest`. A driver test asserts `canonicalText = trimEnd(CanonicalForm.nquads)` for `rdfc-1.0`.
4. The parity oracle passes `{ algorithm: "RDFC-1.0", maxDeepIterations: 1024 }`, the port's bound, because the npm default (`maxWorkFactor = 1`) refuses a 3-cycle.
