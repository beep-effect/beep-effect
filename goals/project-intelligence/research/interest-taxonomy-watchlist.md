# Interest Taxonomy and Seed Watchlist

Date: 2026-07-11. This artifact fixes the P0 interest taxonomy and the small
explicit seed watchlist of public GitHub repositories required by
[`SPEC.md`](../SPEC.md) (Constraints, "Default first source"), grounded in the
corpus reconnaissance recorded in [`recon-report.md`](./recon-report.md) and
the SPEC Objective interest areas. Watchlist entry mechanics (how sources
enter) are gate G6, owned by
[`architecture-proposal.md`](./architecture-proposal.md); this artifact owns
what to watch first, not how registration works.

## Interest taxonomy

Top-level areas come from the SPEC Objective; subtopics and evidence come from
the 2026-07-11 corpus sweep (topic bins over the 100 newest vault captures,
host frequencies, and the operator projects collection). Priority reflects
corpus signal strength combined with open repo decisions the area feeds.

Corpus signals are stated as coarse magnitudes; precise tallies are
operator-corpus specifics excluded under SPEC D2 (see
[`recon-report.md`](./recon-report.md), "Excluded material").

| Interest area (SPEC) | Corpus-observed subtopics | Corpus signal | Priority |
| --- | --- | --- | --- |
| Agent memory and context systems | memory layers (Mem0, Cognee, Supermemory), persistence, provenance-bearing recall, retrieval quality | about a quarter of recent captures; heavy Mem0-domain documentation links; recurring Cognee links | high |
| Knowledge graphs and ontologies | OWL tooling, RDFJS, SKOS, SHACL, graph workspaces, ontology learning, decentralized knowledge graphs (OriginTrail) | nearly a fifth of recent captures (decentralized knowledge) plus a smaller ontology cluster; heavy OriginTrail-domain links | high |
| AI and agent frameworks; agent tooling and MCP | assistant runtimes (OpenClaw), agent protocols, browser-driving agents, evaluation | under a tenth of recent captures; recurring OpenClaw-domain links | high |
| Repositories and techniques that could improve this repo | knowledge/research systems, capture-to-knowledge pipelines, digital-garden publishing | about a quarter of recent captures (largest single bin) | high |
| Effect-based projects | Effect ecosystem, TypeScript language tooling | a few recent captures; this repository's own public stack | medium |
| Legal AI | legal ontologies, legal text analytics, sentence classification, ontology learning for law | under a tenth of recent captures; four verified legal-NLP repositories | medium |
| Competitors | knowledge-platform products adjacent to the repo's product surfaces | indirect only (no dedicated captures in the sample) | low (roadmap) |

Coverage gaps the taxonomy inherits from sampling limits (see recon-report
"Confidence"): x-post topical interests (counts only), article-source and
repository-source topical distributions, and anything expressed only in card
bodies. These gaps refine the taxonomy in later phases; they do not block the
first proof.

## Seed watchlist (first proof)

Twelve seeds, all verified as existing, non-archived public repositories via
the GitHub API on 2026-07-11. "License" is the machine-readable license
reported by the API; entries without one require manual terms review before
any live (post-fixture) ingestion — the `SourceTermsRevision` design in
[`architecture-proposal.md`](./architecture-proposal.md) (G4) records that
state explicitly. The first proof consumes deterministic fixture
representations of watchlist entries (no live API calls in tests); this list
is the initial real-world watchlist content the schema must express and the
live roadmap stage will consume.

| Seed repository | Interest area | Evidence signal (corpus, 2026-07-11) | License (API) |
| --- | --- | --- | --- |
| `mem0ai/mem0` | agent memory | direct capture; heavy vendor-documentation links; memory-cluster support | Apache-2.0 |
| `topoteretes/cognee` | agent memory | recurring documentation links; operator-level deployment experience; G2 ADR option | Apache-2.0 |
| `getzep/graphiti` | agent memory (temporal graphs) | memory-cluster support; G2 ADR option (strongest temporal donor) | Apache-2.0 |
| `supermemoryai/supermemory` | agent memory | direct capture; memory-cluster support | MIT |
| `Effect-TS/effect` | Effect-based projects | recurring Effect/TypeScript capture titles; this repository's own public stack | MIT |
| `openclaw/openclaw` | agent frameworks and tooling | recurring OpenClaw-domain documentation links; agent-tooling cluster | none machine-readable |
| `OriginTrail/dkg-engine` | knowledge graphs (decentralized) | heavy OriginTrail-domain links; resolved via provider-side rename during verification | Apache-2.0 |
| `owlcs/owlapi` | ontologies | direct capture; ontology-cluster support | none machine-readable |
| `Liquid-Legal-Institute/Legal-Ontologies` | legal AI + ontologies | direct capture; legal and ontology clusters | CC-BY-SA-4.0 |
| `Liquid-Legal-Institute/Legal-Text-Analytics` | legal AI | direct capture; legal-cluster support | CC-BY-SA-4.0 |
| `inkeep/open-knowledge` | knowledge/research systems | direct capture; knowledge-cluster support | GPL-3.0 |
| `jackyzha0/quartz` | knowledge publishing (G7 vault prior art) | direct capture; knowledge-cluster support; projection-stage relevance | MIT |

Selection rules applied: every seed has corpus evidence (direct capture,
domain-frequency cluster, or projects-collection recurrence); seeds cover
every high-priority taxonomy area; the list stays small enough for a
deterministic fixture set; G2 ADR options with corpus presence are seeded so
the loop watches its own candidate technologies; licenses were captured at
verification time as the first `SourceTermsRevision` evidence.

## Candidate pool (verified, not seeded)

Also verified on 2026-07-11 and available to later watchlist growth without
re-research: `SciGraph/SciGraph` (Apache-2.0), `rdf-ext/rdf-elements` (MIT),
`reactodia/reactodia-workspace` (LGPL-2.1), `bwaltl/LegalSentenceClassification`
(no machine-readable license), `sunghun9636/Legal-Ontology-Learning` (MIT),
`lit/lit` (BSD-3-Clause), `danielbdyer/agentic-playwright` (no machine-readable
license), `protobufjs/protobuf.js` (no single machine-readable license). Each
was excluded from seeding for one reason: single-capture evidence without
cluster reinforcement at repository granularity, or an interest area already
covered by a stronger seed. One additional captured name did not resolve at
verification time and is recorded as unresolved in
[`recon-report.md`](./recon-report.md).

## First-source swap clause: evaluated, declined

The SPEC swap clause requires swapping the first source if reconnaissance
shows another source would produce substantially more architectural learning.
The corpus evidence points the other way: GitHub is the dominant capture host
(roughly a third of the newest captures, plus an existing low-hundreds
repository-card collection), every
high-priority interest maps to active public repositories, and repository
sources exercise the hardest architectural problems surfaced by recon —
stable identity under rename (observed live during seed verification),
license/attribution capture, and artifact versioning. The GitHub watchlist
remains the first source; no swap. Decided 2026-07-11 on the evidence in
[`recon-report.md`](./recon-report.md).

## Relationship to gates

This artifact owns no lettered gate. It feeds G6 (the registration mechanism
decodes exactly this kind of entry), G4 (rename and license-state evidence),
and the P1 fixture design (the seed schema shape and the adversarial
watchlist-entry cases in [`threat-model.md`](./threat-model.md)).
