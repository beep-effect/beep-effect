# Capture

<!--
Stage 0. Append-only raw dump: thoughts, links, screenshots (drop files in
assets/ and reference them), half-sentences, contradictions. Nobody tidies
this file; cleaning it up destroys provenance. New material goes under a new
dated heading at the bottom.
-->

## 2026-07-01

Imported from the WebStorm scratch workspace
`~/.config/JetBrains/WebStorm2026.2/scratches/Identity as IRI/` (design session
of 2026-07-01, elpresidank + Claude, distilled into a handoff + agent context
packet).

Artifacts copied into this packet:

- [`assets/identity-iri-fibration-handoff.md`](./assets/identity-iri-fibration-handoff.md)
  — the AUTHORITATIVE human-readable design handoff. 9 decisions (D1–D9: 7
  LOCKED, 1 DEFAULT, 1 OPEN), 4 implementation phases, salvage/kill list for
  the deleted `@beep/ontology` authoring API, testing strategy.
- [`assets/identity-as-iri-agent-context.xml`](./assets/identity-as-iri-agent-context.xml)
  — structured agent context packet; verified equivalent to the handoff (same
  decision set, same open questions, zero drift) plus the standards reference
  map and full constraint list.
- [`assets/ontology-prototype/`](./assets/ontology-prototype/) — the deleted
  `@beep/ontology` prototype (src + test). Salvage donor: JSON-LD/Turtle/
  Markdown projections, assembly walker, `AssembledOntology`,
  `OntologyAssemblyError` taxonomy, SKOS profiles, semantic test fixtures.
  The authoring API (`Ontology.create`, `createOntologyIdentity`, the 8-way
  ref synonym set, runtime draft sniffing, string term refs) is dead and
  stays dead.
- [`assets/exploration-report-2026-07-01.md`](./assets/exploration-report-2026-07-01.md)
  — orchestrated exploration report (4 Codex sub-agent digests + handoff
  synthesis): artifact inventory, locked/open decisions, repo-inspection
  deltas, risks/tensions, salvage map.

Left in the scratch folder as local-only provenance (raw AI transcripts,
~330K, already distilled into the above; not committed to the public repo):
`Exploring ontology specifications and semantic standards.md`, `ontology.md`.

Core thesis (one sentence, from the handoff): the identity path and the IRI
become two literal-typed encodings of the same value; annotations become
sections over the base category `$I` mints; retrieval becomes dereference.

elpresidank's rulings from the report review session (verbatim intent):

> So do you think we should start with a new exploration packet using /explore
> & /grill-with-docs or do you think we should graduate into a new ./goals
> packet right away?
>
> Also as part of this exploration / goal whatever we choose I want to really
> prove out the design, types & ergonomics of the api before we send it to a
> new or existing foundation/modeling package. I want to build this up from
> first principles using official RFC's, OASIS, w3c spec's etc. using codex
> agents to collect the official sources and placing them in our
> goal/exploration packet as prose.
>
> We would first begin by designing the types & schemas in the ./scratchpad .
> importing from no other packages in the repo only effect. The reason being
> is that @beep/identity & @beep/ontology especially in the old code you just
> referenced had a bit of a chicken & egg problem. To avoid this I want to
> start with the assumption that we will completely rewrite the
> @beep/identity or @beep/ontology packages. Whether we decide that we import
> from ontology or identity to get our package identity composers is really
> up to semantics and taste. It would however be a heavier lift to move the
> Id module out of @beep/identity as we would have to update nearly every
> file in this monorepo as well as change some things in create-package in
> @beep/repo-cli so we don't break codegen

Plus, from the same session:

- Authority host: keep `https://ns.beep.sh/` as placeholder now; decide before
  the composer-binding phase merges.
- Fibered placement: "I think everything needs to be in `@beep/identity` no?
  Otherwise we have some circular issues. I would prefer everything is pure
  and exists there with only `effect` and maybe `@beep/types` as a
  dependency."
- SemanticSchemaMetadata (`@beep/rdf`) overlap with composer-derived
  iri/curie: "Definitely an exploration is in order."

Known repo touchpoints surfaced by the report (for research stage): `$I` /
`IdentityComposer` at `packages/foundation/modeling/identity/src/Id.ts`;
`@beep/rdf` Iri/Uri/Curie/PrefixMap/Vocab/`SemanticSchemaMetadata`;
`@beep/ontology` (exists, holds FOLIO `Ontology.models.ts`);
`goals/ontology-modeling-foundation` encodes the DEAD `Ontology.create`
design and needs superseding; EntityId (branded integers) is orthogonal —
identity-as-IRI is definition-level identity only.
