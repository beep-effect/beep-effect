# Identity as IRI

## Status

Stage: `align`
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

Research complete (specs + 12-repo mining + audits + verified synthesis).
Next: align session on the packaging seam — the mining corpus recommends a
pure-kernel/runtime split and pushes back on all-in-`@beep/identity`
([`research/20-repo-mining-synthesis.md`](./research/20-repo-mining-synthesis.md)
§5 + arbitration in [`RESEARCH.md`](./RESEARCH.md)) — plus
SemanticSchemaMetadata fate (audit recommendation on file) and D7. Then the
`scratchpad/identity` prototype per the corrected 12-step guidance.

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

- 2026-07-01 (night): research stage completed — 3 spec docs
  ([`research/specs/`](./research/specs/)), 12 repo-mining reports
  ([`research/repos/`](./research/repos/), licenses verified, 3
  reference-only), 3 repo audits, synthesis
  ([`20`](./research/20-repo-mining-synthesis.md)) + adversarial review
  ([`21`](./research/21-synthesis-adversarial-review.md), 7 corrections
  accepted, license ledger clean), all folded into
  [`RESEARCH.md`](./RESEARCH.md) + [`SOURCES.md`](./research/SOURCES.md).
  Stopped at: align on packaging seam.
- 2026-07-01 (later): prototype home decided —
  [`scratchpad/identity/`](../../scratchpad/identity/README.md), effect-only
  imports enforced by test ([`DECISIONS.md`](./DECISIONS.md) pre-seeded);
  research fan-out running (3 spec-prose agents + 1 repo-audit agent).
- 2026-07-01: packet opened from the "Identity as IRI" scratch workspace;
  handoff + XML packet + prototype + exploration report captured into
  `assets/`; stage advanced to `research`; Codex fan-out launched for spec
  prose + repo audits.
