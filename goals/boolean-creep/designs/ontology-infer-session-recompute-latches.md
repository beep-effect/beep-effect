# Instance

- id: `ontology-infer-session-recompute-latches`
- file:line: `packages/ontology/use-cases/src/aggregates/Session/Session.reasoner.ts:810`
- symbol: `inferOntologySession`
- members: `historyRewound`, `drifted`, `fullRecompute`
- evidence: E4 at `Session.reasoner.ts:810-820` — history rewind implies drift,
  and drift implies a full recompute; rewind-without-drift and
  drift-without-full are unrepresentable.

# Current shape

Source refresh: `93217d998f851e2e93d9864e2b5315552eaa58a7`,
`origin/main@d1b4d769fbaffddd55717f3b1ba461897dd545c5`, 2026-09-09.
The prior closure implementation was extracted into helpers at 554–631;
the three local Boolean declarations and their semantics are unchanged,
now at 810–815. These are actual values in one function scope, unlike the
callable `closureAffected`/`domainRangeAffected`/`disjointnessAffected` seed.

The reasoner derives three ordered booleans from the previous result, change-log
length, and drift cap. The pair `drifted`/`fullRecompute` is then persisted in
`OntologyInferenceResult`, which is already the separate Tier 2 compatibility
record `ontology-inference-recompute-cause`.

# Cardinality gap

Eight triples are representable and four truth combinations are reachable:
incremental, initial full, cap drift, and history-rewind drift. The two drift
triggers intentionally share the result-level `drifted` cause.

| `historyRewound` | `drifted` | `fullRecompute` | Supported route |
| --- | --- | --- | --- |
| false | false | false | previous exists; no rewind; change window within cap |
| false | false | true | no previous result; initial window within cap |
| false | true | true | no rewind; change window exceeds cap, including initial run |
| true | true | true | current history shorter than previous processed count |

Required counts remain payloads. They are not additional invented members;
the three declared Boolean values provide the E4 carrier evidence.

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
- `Session.reasoner.ts:745-753` — change `recomputeMode` to consume the cause
  and select full work for every non-incremental cause.
- `Session.reasoner.ts:805-836` — replace all three local latches with one
  direct cause selection and pass it to closure, domain-range, and
  disjointness mode decisions.
- `Session.reasoner.ts:859-868` — temporarily project exact legacy booleans
  from the cause at the existing result constructor; no result encoding changes
  in this Tier 1 PR.
- `packages/ontology/use-cases/src/tools/OntologyToolService.ts:270` and
  `packages/ontology/ui/src/aggregates/Session/Session.metrics.tsx:51` — retain
  their current `OntologyInferenceResult.drifted` reads during this Tier 1
  stage. They consume the temporary old-field projection and migrate to the
  decoded cause only in the dependent Tier 2 singleton.
- `Session.test.ts:330-395` plus drift-cap/history-rewind coverage — assert all
  cause paths and unchanged per-module modes while the result booleans remain.
- The subsequent `ontology-inference-recompute-cause` singleton reuses this
  owner, removes the temporary projections, and puts the literal on the decoded
  side of the compatibility codec.

# Guard-deletion accounting

Delete `historyRewound`, `drifted`, `fullRecompute`, their two implication
expressions, and the boolean parameter/guard in `recomputeMode`. The only
remaining booleans are temporary one-expression projections into the old Tier
2 result fields. They remain stored fields on the returned result until
Tier 2; only their local aliases disappear here. Do not count predicate-helper
removal from the withdrawn module-affected proposal as part of this design.

# Encoded-side impact

None in this Tier 1 stage. RPC request/response and nested `previous` values
retain exact `drifted` and `fullRecompute` keys and values. The cause is an
atomic decoded TypeScript addition used internally until the Tier 2 codec PR.
`InferOntologySessionInput.previous` at `Session.reasoner.ts:340` keeps its
Option-from-optional-key None default; `driftCap` at 341 keeps default 64.
Retain every Some(result) payload and all three existing legal result pairs.
`RunOntologyInferenceRpc` at `Session.rpc.ts:410-414` still uses the same
request and response schemas. Validation/SPARQL optional `inference` fields
at their respective `Session.validation.ts:171` / `Session.sparql.ts:171`,
client state at `Session.atoms.ts:913,1007-1033`, and desktop HTTP/IPC forwarding
through `OntologyOrchestrator.ts:138,188` need no encoded migration in Tier 1.

# Test impact

Cover previous-none under/over cap, ordinary incremental work, cap overflow,
history rewind, all three module-mode decisions, and exact old result booleans.
Run focused reasoner/RPC tests and full `@beep/ontology-use-cases` verification
with a patch changeset unless explicitly ignored.

# Risk

Land in Tier 1D before the ontology Tier 2 singleton. Drift must win when the
first run also exceeds the cap, and the exported cause must be the exact owner
the later codec reuses. Do not change the ontology `/public` barrel topology;
that remains a separately recorded architecture opportunity. Leave the
callable affected helpers at 482/485/493 and their disjointness OR at 834–835
unchanged. The withdrawn module-affected design is not a migration dependency.
This refresh is P2 source adjudication; no implementation or independent P3
result is claimed.
