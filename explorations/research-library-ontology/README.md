# Research Library Ontology and Gated 2-Hop Intake

## Status

<!-- BEGIN GENERATED: EXPLORATION STATUS -->
Stage: `graduate`
Status: `graduated`
<!-- END GENERATED: EXPLORATION STATUS -->

Source: [`ops/manifest.json`](./ops/manifest.json)

## Spark

A second research aggregation (Nov 2026: nightly reports, VidBee video
bundles, a private DM archive, three papers, a bare link list, plus Box
holdings) needs the same treatment the October corpus got in
[research-corpus-synthesis](../research-corpus-synthesis/README.md): compile
the unique source set, acquire and enrich it, then mine it for alpha relevant
to beep-effect. This time the library should be ontology-first (its implicit
T-Box made explicit and aligned to PROV-O/CiTO/FaBiO/SKOS), follow citations
two hops out under an auditable gate, and gain the routes the October run
lacked (web, VidBee, alphaXiv, Box).

## Next Open Question

None — graduated. Re-entry only when a gated candidate in
[`MAP.md`](./MAP.md) fires (`epistemic-library-model-promotion`,
`legal-ontology-pile-deep-read`); then reopen at decompose.

## Graduated goals

- [research-library-ontology-core](../../goals/research-library-ontology-core/README.md):
  ontology-first models, `Context.Service` topology, generated T-Box and
  SHACL, SPARQL views. First bet.
- [research-library-routes](../../goals/research-library-routes/README.md):
  `@beep/firecrawl` driver, Box route, VidBee and alphaXiv imports, hop
  extraction and the hop-2 gate. Depends on the core.
- [research-intake-2026-11](../../goals/research-intake-2026-11/README.md):
  the third intake and its mining. Depends on both.

## Read This First

1. [`ops/manifest.json`](./ops/manifest.json) - machine state: stage, status, open questions.
2. [`CAPTURE.md`](./CAPTURE.md) - the corpus census and the operator's ask.
3. [`RESEARCH.md`](./RESEARCH.md) - what the October packet taught and which repo bricks already exist.
4. [`DECISIONS.md`](./DECISIONS.md) - grilling log (two rounds, 2026-11-06).
5. [`BRIEF.md`](./BRIEF.md) - shaped pitch.
6. [`MAP.md`](./MAP.md) - candidate goal packets and first slice.

## Predecessors

- [research-corpus-synthesis](../research-corpus-synthesis/README.md)
  (graduated 2026-10-06): the library, its CLI and the reflection this packet
  acts on. Not re-entered: this is new capture, not a fired gate.
- [academia-corpus-mining](../academia-corpus-mining/README.md) (parked):
  the T1/T2/T3 mining-tier precedent.
- [identity-as-iri](../identity-as-iri/README.md) (graduated): the IRI
  minting registry and ontology fold the T-Box projection uses.

## Trail

- 2026-11-06: packet opened from a grill-with-docs session. Corpus and Box
  censused; two grilling rounds settled packet shape, model ownership, the web
  route, the hop-2 gate, the T-Box source of truth and the 449-PDF Box pile.
  Capture, research, align, shape and map landed in one session; the
  operator confirmed the brief and the packet graduated through
  `beep explore graduate` into three goal packets.
