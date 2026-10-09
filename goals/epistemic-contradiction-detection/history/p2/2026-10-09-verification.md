# P2 verification — 2026-10-09

Implementation and introduced compiler repairs: `c833513460`.
Merged base: `36027982f2`. No forbidden shipped contract edits, no new dependencies.

## Focused proof

- Domain single-file vitest: 5/5 pass; schema-derived value/polarity round trips,
  evidence/assertion bounds, duplicate refs, proposal identity and canonical JSON.
- Golden single-file vitest: 19/19 pass, repeated after compiler repairs. Four
  required positives, seven negatives, plus overlap, finite intersection,
  opaque modality, canonical objects and multiple matches.
- Every golden emission: full stamped entity decode, hasValidSeals true, content
  decode, shipped key/digest, stamped submit decode, opposite assertion fact
  shape and two distinct proposalIds.
- Every golden vector: TestClock adjusted one hour; repeated and reversed input
  outputs byte-identical. Arbitrary.checkEffect tests schema-derived strings
  for negation/conformance/permutation (seed 520).
- Package law checks and JSDoc lint: both packages pass, zero findings.
- Schema-first: pass; no missing entries/advisories or inventory edit.
- Doctest owner command applied markers to the 12 pure example fences.
- Purity scan: empty. Shipped values/Contradiction and entities/Contradiction
  diff against origin/main: empty.

## Heavy runs and attribution

All heavy commands use beep-heavy, 32G / concurrency 2, at most two owned jobs.
Results/logs remain in ignored `.beep/detection-proof/`.

- `bun run beep quality test-tsgo`: pass (330 CLI test files; 148 packages
  covered by package check scripts).
- Initial whole domain suite: pass. Initial domain package-verify: audit failed
  on typed decoder in the new test; docgen passed. Fixed in c833513460, inbox
  acknowledged by fix SHA; re-run pending.
- Initial direct use-cases check: introduced typed decoder and UTC inference
  errors fixed in c833513460. Existing ClaimGate/triage TS6305 imports lacked
  semantic-web/rdf/file-processing build declarations. Full package-verify
  builds dependency prerequisites; no source workaround added.
- `bun run beep ci lane jsdoc-ratchet`: pass (zero legacy, no increased totals).
- `CI=true bun run beep knowledge refs --check`: inherited red, one live gated
  observation at the RSC SPEC:374:4 path-policy prohibition; present on base.
  Attribution and proposed repair are in research/OPPORTUNITIES.md.
- Re-run package suites, package-verify, coverage, docgen local and Fallow are
  pending in admitted pipelines; append outcomes below.

Hosted required checks are authoritative under AGENTS.md. The older local
`yeet verify` exit row does not block publication. Final-head hosted results
will be recorded after publish; no hosted claim is made here.
