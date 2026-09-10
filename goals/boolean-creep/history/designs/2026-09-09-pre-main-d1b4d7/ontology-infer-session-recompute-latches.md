# Instance

- id: `ontology-infer-session-recompute-latches`
- file:line: `packages/ontology/use-cases/src/aggregates/Session/Session.reasoner.ts:789`
- symbol: `inferOntologySession`
- members: `historyRewound`, `drifted`, `fullRecompute`
- evidence: E4 at `Session.reasoner.ts:789-799` — history rewind implies drift,
  and drift implies a full recompute; rewind-without-drift and
  drift-without-full are unrepresentable.

# Current shape

The reasoner derives three ordered booleans from the previous result, change-log
length, and drift cap. The pair `drifted`/`fullRecompute` is then persisted in
`OntologyInferenceResult`, which is already the separate Tier 2 compatibility
record `ontology-inference-recompute-cause`.

# Cardinality gap

Eight triples are representable and four truth combinations are reachable:
incremental, initial full, cap drift, and history-rewind drift. The two drift
triggers intentionally share the result-level `drifted` cause.

# Target schema

Introduce the named exported `OntologyInferenceRecomputeCause` LiteralKit from
the dependent Tier 2 design with `incremental`, `drifted`, and `full`. Derive
that cause directly, with drift precedence over initial full, and pass it to
`recomputeMode`. Until the Tier 2 singleton lands, project the literal directly
to the existing `drifted` and `fullRecompute` result fields only at
`OntologyInferenceResult.make`; do not retain local boolean aliases.

# Migration inventory

- `Session.reasoner.ts` near `OntologyInferenceRecomputeMode` and the result
  schemas — add the annotated cause owner and exported type once; keep it
  distinct from per-module `full | incremental | reused` execution mode.
- `Session.reasoner.ts:724-732` — change `recomputeMode` to consume the cause
  and select full work for every non-incremental cause.
- `Session.reasoner.ts:784-815` — replace all three local latches with one
  direct cause selection and pass it to closure, domain-range, and
  disjointness mode decisions.
- `Session.reasoner.ts:838-847` — temporarily project exact legacy booleans
  from the cause at the existing result constructor; no result encoding changes
  in this Tier 1 PR.
- `packages/ontology/use-cases/src/tools/OntologyToolService.ts:268` and
  `packages/ontology/ui/src/aggregates/Session/Session.metrics.tsx:51` — retain
  their current `OntologyInferenceResult.drifted` reads during this Tier 1
  stage. They consume the temporary old-field projection and migrate to the
  decoded cause only in the dependent Tier 2 singleton.
- `Session.test.ts:327-392` plus drift-cap/history-rewind coverage — assert all
  cause paths and unchanged per-module modes while the result booleans remain.
- The subsequent `ontology-inference-recompute-cause` singleton reuses this
  owner, removes the temporary projections, and puts the literal on the decoded
  side of the compatibility codec.

# Guard-deletion accounting

Delete `historyRewound`, `drifted`, `fullRecompute`, their two implication
expressions, and the boolean parameter/guard in `recomputeMode`. The only
remaining booleans are temporary one-expression projections into the old Tier
2 encoded result fields, not stored application state.

# Encoded-side impact

None in this Tier 1 stage. RPC request/response and nested `previous` values
retain exact `drifted` and `fullRecompute` keys and values. The cause is an
atomic decoded TypeScript addition used internally until the Tier 2 codec PR.

# Test impact

Cover previous-none under/over cap, ordinary incremental work, cap overflow,
history rewind, all three module-mode decisions, and exact old result booleans.
Run focused reasoner/RPC tests and full `@beep/ontology-use-cases` verification
with a patch changeset unless explicitly ignored.

# Risk and sequencing

Land in Tier 1D before the ontology Tier 2 singleton. Drift must win when the
first run also exceeds the cap, and the exported cause must be the exact owner
the later codec reuses. Do not change the ontology `/public` barrel topology;
that remains a separately recorded architecture opportunity.
