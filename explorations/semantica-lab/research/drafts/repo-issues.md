# Draft 1

## Title

WinkBackend fabricates a zero-based entity span when lookup fails

## Body

`WinkBackend.extractEntities` locates each Wink entity value with `String.indexOf`. When the
value is absent from the source text, `findSpan` returns `{ start: 0, end: needle.length }`.
That result has the same shape as a successful match at the start of the document, so consumers
cannot distinguish missing grounding from valid grounding.

### Evidence (file:line)

- `packages/drivers/wink/src/WinkBackend.service.ts:50-53` returns the fabricated span after an
  `indexOf` miss.
- `packages/drivers/wink/src/WinkBackend.service.ts:110-125` assigns that span to the emitted
  `EntityNode` without checking whether the lookup succeeded.

### Reproduction sketch

1. Stub `WinkEngine` so `doc.entities().out(its.detail)` returns an entity detail whose `value`
   does not occur in the input text.
2. Run `WinkBackend.extractEntities`.
3. Observe an entity with `span.start === 0` and `span.end === value.length`, even though slicing
   the input by that span does not equal the entity value.

### Suggested fix direction

Represent lookup failure explicitly and either omit the ungrounded entity or fail with a typed
backend error. Add a regression asserting that every emitted span slices back to the emitted
entity text. Do not encode a miss as a valid `Span`.

Provenance: `semantica-lab research`, live-source verification on 2026-08-24.

# Draft 2

## Title

LangExtract relation targets produce an annotated document with no relations

## Body

The LangExtract request contract accepts `kind: "relation"`, but the grounded extraction model
retains only attributes, confidence, label, text, and alignment data. The handoff then converts
every aligned extraction into an entity and always emits `relations: []`. A relation extraction
can therefore complete successfully without any relation in the `AnnotatedDocument`.

### Evidence (file:line)

- `packages/foundation/capability/langextract/src/Target/Target.model.ts:28-31` includes
  `"relation"` in the accepted target kinds.
- `packages/foundation/capability/langextract/src/Extraction/Extraction.model.ts:162-173` defines
  grounded extraction fields without target kind or relation endpoints.
- `packages/foundation/capability/langextract/src/Handoff/Handoff.behavior.ts:67-84` maps all
  aligned extractions to entities and hardcodes `relations: A.empty()`.

### Reproduction sketch

1. Submit a `LangExtractRequest` with a relation target and a source sentence containing two
   related entities.
2. Return a model candidate that aligns to the source.
3. Inspect `LangExtractResult.annotatedDocument`: the aligned candidate is projected as an entity
   and `relations` is empty.

### Suggested fix direction

Carry the target kind through candidate parsing and alignment. Define relation-specific grounded
data with typed source and target references, then map it to `Contract.Relation`. Until that model
exists, reject relation targets with a typed unsupported-target error instead of returning a
successful document that omits them.

Provenance: `semantica-lab research`, live-source verification on 2026-08-24.

# Draft 3

## Title

Oxigraph accepts SparqlQueryRequest.timeoutMs but never enforces it

## Body

`SparqlQueryRequest` exposes an optional non-negative `timeoutMs`, but the Oxigraph driver never
reads it. Dataset loading and the synchronous WASM `store.query` call run without a deadline, so
callers can supply a timeout that has no effect.

### Evidence (file:line)

- `packages/foundation/capability/semantic-web/src/services/sparql-query.ts:90-101` declares
  `timeoutMs` on the public request schema.
- `packages/drivers/oxigraph/src/Oxigraph.sparql.ts:176-207` loads the dataset and executes the
  query without consulting `request.timeoutMs`.
- `packages/drivers/oxigraph/src/Oxigraph.sparql.ts:253-264` completes the full execution path
  without applying a timeout.

### Reproduction sketch

1. Build a large dataset and an expensive SPARQL query.
2. Execute it through `OxigraphSparqlQueryServiceLive` with `timeoutMs: 1`.
3. Measure elapsed time and observe that execution continues past 1 ms instead of returning a
   timeout error.

### Suggested fix direction

Either enforce the deadline in an interruptible worker boundary and return a typed timeout error,
or remove the option from this service until the driver can honor it. A timeout wrapped around the
current synchronous WASM call will not preempt work on the same event-loop thread.

Provenance: `semantica-lab research`, live-source verification on 2026-08-24.

# Draft 4

## Title

SHACL validation can hang on a six-quad violating shape fixture

## Body

The real `shacl-engine` adapter awaits validation without any runtime bound. During semantica-lab
bake-off measurements on 2026-08-24, the six-quad shape fixture timed out at about 20 seconds for
the violating data graph while its conforming sibling passed. This timing contrast is a reported
observation. A later bounded spot-check in the same checkout did not produce even the conforming
test result within 25 seconds, so it did not cleanly reproduce the original contrast.

### Evidence (file:line)

- `packages/drivers/shacl/test/ShaclEngineValidation.test.ts:25-42` defines the six-quad shapes
  dataset and the one-quad violating data graph.
- `packages/drivers/shacl/test/ShaclEngineValidation.test.ts:54-82` runs violating and conforming
  sibling cases through the real engine.
- `packages/drivers/shacl/src/Shacl.validation.ts:401-425` awaits `validator.validate` with no
  timeout or cancellation bound.

### Reproduction sketch

1. Run `packages/drivers/shacl/test/ShaclEngineValidation.test.ts` against the real engine, with an
   external 20-second timeout per case.
2. Run the violating and conforming tests separately and record elapsed time plus process exit.
3. Confirm whether the violating case stalls in `validator.validate`; capture a stack or engine
   trace if the runtime permits it.

### Suggested fix direction

First isolate whether the stall is in `shacl-engine`, the SPARQL target resolver, or the adapter's
RDFJS conversion. Add a regression with a short test deadline. Bound production validation with a
typed timeout failure, and upstream a minimal fixture if the engine itself is responsible.

Provenance: `semantica-lab research`, reported measurement plus live-source verification on
2026-08-24.
