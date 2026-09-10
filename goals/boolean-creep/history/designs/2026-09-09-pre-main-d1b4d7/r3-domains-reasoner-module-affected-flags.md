# Instance

- id: `r3-domains-reasoner-module-affected-flags`
- file:line: `packages/ontology/use-cases/src/aggregates/Session/Session.reasoner.ts:482`
- symbol: `inferOntologySession.moduleAffected`
- members: `closureAffected`, `domainRangeAffected`, `disjointnessAffected`
- evidence: E4 at `Session.reasoner.ts:482-494` — domain/range is affected by
  every predicate signature, while closure and disjointness recognize predicate
  subsets. Either specialized fact implies domain/range, although both
  specialized facts may co-occur.

# Current shape

Three private helpers repeatedly scan one `changedSignatures` array and feed
the three module recompute decisions. `domainRangeAffected` is true for any
predicate signature, so the closure and disjointness facts cannot occur without
it. The later type-bearing-output comparison is a separate downstream reason
to invalidate disjointness and must remain independent.

# Cardinality gap

Eight triples are representable and five are legal: no module affected,
domain/range only, closure plus domain/range, domain/range plus disjointness,
and all three. Closure-only, disjointness-only, and closure-plus-disjointness
without domain/range are impossible.

# Target schema

Define a private annotated `OntologyInferenceChangedImpact` LiteralKit beside
the existing `OntologyInferenceModule`, with `none`, `domain-range`,
`closure-domain-range`, `domain-range-disjointness`, and `all`. Reuse the
existing ontology identity composer and the existing `OntologyInferenceModule`
owner for downstream membership.

Avoid rebuilding the same three bits inside the classifier: classify each
changed signature directly as `none`, `domain-range`,
`closure-domain-range`, or `domain-range-disjointness`, and fold them with an
exhaustive finite join where closure plus disjointness becomes `all`. A single
exhaustive `moduleAffected(impact, module)` projection selects module work at
the recompute boundary; no sibling boolean state is stored.

# Migration inventory

- `Session.reasoner.ts:51-129` — add the private annotated impact owner near the
  existing exported module/recompute literal owners. Do not export a second
  module-name taxonomy.
- `Session.reasoner.ts:473-494` — replace `signatureHasPredicate` and all three
  affected helpers with signature-to-impact classification, finite join, and
  one module-membership projection. Preserve exact IRI comparisons for
  `rdfs:subClassOf`, `rdfs:subPropertyOf`, `owl:disjointWith`, and `rdf:type`;
  every other predicate remains domain/range-impacting and non-predicate
  signatures remain `none`.
- `Session.reasoner.ts:782-815` — derive one impact from `changedSignatures` and
  use it for closure, domain/range, and disjointness recompute modes. Preserve
  the independent `typeBearingInferenceChanged(...)` OR for disjointness.
- `Session.reasoner.ts:724-732,838-847` and the existing result schemas remain
  governed by `ontology-infer-session-recompute-latches` and
  `ontology-inference-recompute-cause`; this design changes neither recompute
  cause nor encoded result fields.
- `aggregates/Session/index.ts:42` continues exporting the reasoner module;
  the new impact is private, while current `OntologyInferenceModuleResult`
  readers retain their exact module names and modes.
- `test/Session.test.ts:274-403,406-452` — retain the closure and inferred-type
  invalidation scenarios and add a complete impact/mode behavior table through
  the reasoner service.

# Guard-deletion accounting

Delete `signatureHasPredicate`, `closureAffected`, `domainRangeAffected`, and
`disjointnessAffected`, their repeated array scans, and the three correlated
boolean interpretations. One finite impact fold and exhaustive module
membership projection become the sole changed-signature invalidation source.
The independent type-bearing comparison remains because it observes new
inference output rather than the changed-signature tuple.

# Encoded-side impact

None. The impact literal is private derived state. Session input, changed
signature arrays, module names/modes, inferred quads, disjointness violations,
RPC encoding, result booleans, ordering, and drift behavior remain unchanged.

# Test impact

Exercise all five legal impacts with empty/non-predicate signatures, an
ordinary predicate, a closure predicate, a disjointness predicate, and both
specialized predicate families. Assert exact `reused` versus `incremental`
module modes with a previous result, plus `full` precedence from the related
recompute-cause design. Retain the case where an ordinary predicate changes
inferred types and independently invalidates disjointness. Run focused Session
reasoner/RPC tests and full `@beep/ontology-use-cases` package verification with
the required patch changeset.

# Risk and sequencing

Land in Tier 1D atomically with `ontology-infer-session-recompute-latches`
because both edit the same inference decision block, and before the Tier 2
recompute-cause singleton. The join must be commutative/idempotent so signature
ordering and duplicates cannot alter module modes; do not expand the separately
recorded ontology `/public` barrel-topology opportunity.
