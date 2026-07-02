# Identity as IRI

## Status

Stage: `research`
Status: `active`

Source: [`ops/manifest.json`](./ops/manifest.json)

## Spark

The identity path (`@beep/ontology/patent/Claim`) and the IRI
(`https://ns.beep.sh/ontology/patent/Claim`) should be two literal-typed
encodings of the same value: promote `IdentityComposer` into an IRI/CURIE
builder with borrowed RDF vocab baked in as literal types, replace the dead
`Ontology.create` API with a `$I.ontology` fold over triples-as-tuples, and
generalize the `JSDocTagDefinition.make` fibration pattern into a `Fibered`
kit for deterministic agent metadata retrieval.

## Next Open Question

Research in flight: collect official spec prose (RFC 3986/3987, CURIE 1.0,
RDF/Turtle, JSON-LD 1.1, SKOS/OWL/SHACL/DCMI/PROV-O) and run the repo audits
(SemanticSchemaMetadata call sites; Id.ts coupling + create-package codegen;
ontology-modeling-foundation supersession). Then: effect-only scratchpad
prototype before any align call on packaging.

## Read This First

1. [`ops/manifest.json`](./ops/manifest.json) - machine state: stage, status, open questions.
2. [`CAPTURE.md`](./CAPTURE.md) - raw dump (stage 0).
3. [`assets/identity-iri-fibration-handoff.md`](./assets/identity-iri-fibration-handoff.md) - the authoritative design handoff (D1–D9).
4. [`assets/exploration-report-2026-07-01.md`](./assets/exploration-report-2026-07-01.md) - synthesized exploration report.
5. [`RESEARCH.md`](./RESEARCH.md) - prior art + capability inventory (stage 1, if present).
6. [`DECISIONS.md`](./DECISIONS.md) - grilling log (stage 2, if present).
7. [`BRIEF.md`](./BRIEF.md) - shaped pitch (stage 3, if present).
8. [`MAP.md`](./MAP.md) - decomposition (stage 4, if present).

## Trail

- 2026-07-01 (later): prototype home decided —
  [`scratchpad/identity/`](../../scratchpad/identity/README.md), effect-only
  imports enforced by test ([`DECISIONS.md`](./DECISIONS.md) pre-seeded);
  research fan-out running (3 spec-prose agents + 1 repo-audit agent).
- 2026-07-01: packet opened from the "Identity as IRI" scratch workspace;
  handoff + XML packet + prototype + exploration report captured into
  `assets/`; stage advanced to `research`; Codex fan-out launched for spec
  prose + repo audits.
