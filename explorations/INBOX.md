# Inbox

Zero-friction idea queue. One bullet per idea — a sentence, a link, a "what
if". No structure required; do not organize this file.

`/explore` triages it: each bullet becomes a new packet, attaches to an
existing packet's `CAPTURE.md`, or is struck through with a word of why.

## Queue

- TTL→Effect-Schema codegen pipeline (WebStorm scratches `ontology/`:
  parseTtl → buildJsonSchema → emitIrisModule + parseConceptSchemes) — three
  findings from the 2026-07-31 identity-iri-fold review before it graduates
  into a `packages/ontology-store` package: (1) `JsonSchemaRef`/`JsonSchemaAnyOf`
  carry synthetic `type: "$ref"`/`type: "anyOf"` discriminators that make the
  emitted document invalid JSON Schema 2020-12 unless stripped at
  serialization; (2) `emitIrisModule` hand-rolls `namedNode` namespace records
  that should mint through the identity `CoreVocab` registry/`rebase` instead;
  (3) the pipeline's range-resolution table and the identity-iri-fold's AST
  datatype/object inference are the same decision table in opposite directions
  — consider one shared range-policy module so import and export lanes cannot
  diverge.
