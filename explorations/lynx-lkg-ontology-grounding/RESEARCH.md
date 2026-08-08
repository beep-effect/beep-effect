# Research

<!--
Stage 1. Ground the capture in reality. Two halves: what exists outside the
repo (cited), and what exists inside it (so we compose bricks instead of
rebuilding them). Date sections; research goes stale.
-->

## 2026-08-06

Executive layer over four sweeps in [`research/`](./research/). Full evidence,
per-artifact licences and every verdict live in those files — this section
links, it does not duplicate.

| Report | Scope |
|---|---|
| [`01-lynx-project-overview.md`](./research/01-lynx-project-overview.md) | What Lynx was, what survives in 2026, the ontology inventory (used / referenced / unfinished) |
| [`02-lkg-ontology-deep-dive.md`](./research/02-lkg-ontology-deep-dive.md) | The LKG ontology read against its own OWL, JSON-LD context and SHACL shapes |
| [`03-reference-ontologies-sweep.md`](./research/03-reference-ontologies-sweep.md) | All 15 reference ontologies: availability, licence, relevance |
| [`04-beep-effect-grounding.md`](./research/04-beep-effect-grounding.md) | Repo-only inventory: locked decisions, live capabilities, gaps, contradiction map |
| [`05-value-assessment.md`](./research/05-value-assessment.md) | **The assessment** — per-element verdicts + ranked shortlist |
| [`SOURCES.md`](./research/SOURCES.md) | Provenance ledger: every external URL, licence disposition, in-repo brick |

### External Landscape

**Lynx (H2020 GA 780602, Dec 2017 – Mar 2021, €3.64M, coordinated by UPM's
Ontology Engineering Group) is formally concluded with a zombie data layer.**
CORDIS records status "Closed" (<https://cordis.europa.eu/project/id/780602>);
the project's own final post is titled "The Lynx project has finished". Yet the
Virtuoso endpoint still answers: **69,960,083 triples across 17 substantive
named graphs**, including 16,710 `lkg:LynxDocument` instances
(<https://sparql.lynx-project.eu/sparql>) [verified 2026-08-06]. The service
layer is dead (every `apis.`/`auth.` host fails TLS) and the source code is gone
(GitLab group `superlynx` 404; the GitHub org has 0 public repos). What survived
is what the coordinating university served as files; what died is what a partner
hosted — a licence-and-availability lesson in itself. Details:
[report 01 §7](./research/01-lynx-project-overview.md).

**Lynx did not build a legal ontology; it built a document envelope.** The LKG
Ontology (<https://lynx-project.eu/doc/lkg/>, v1.2, **CC-BY-4.0**) is 21 declared
terms — 10 classes, 4 object properties, 6 data properties — and `owl:imports`
exactly two vocabularies, **NIF** (Apache-2.0 / CC-BY-3.0) and **ELI** (no
licence declared anywhere). The journal paper is explicit that the graph holds
"documents and terminological information", not courts, judges or abstract legal
ideas (*Information Systems* 106:101966, CC-BY-4.0,
<https://doi.org/10.1016/j.is.2021.101966>). Everything conceptual is SKOS, with
zero OWL reasoning. Six of the ten classes are marker classes with no
distinguishing properties. LKG reuses **8 of ELI's ~85 properties and none of the
relational ones** — there is no way to say one document amends, repeals,
consolidates, implements or cites another. Details:
[report 02 §§3–5](./research/02-lkg-ontology-deep-dive.md).

**Its four published artifacts disagree with each other in 18 places.** The HTML
spec, the OWL, the JSON-LD context and the SHACL shapes contradict on class
hierarchy, property names, datatypes and cardinalities; three documented
properties (`lkg:annotation`, `lkg:translation`, `lkg:part`) do not exist; three
declared properties are missing from the context and are silently dropped on
JSON-LD round-trip; the part-structure SHACL constraint targets a misspelled
property so it never fires; two of six published examples fail the spec's own
validator; **`lkg:Doctrine` has 3,059 live instances and no declaration**.
Details: [report 02 §8](./research/02-lkg-ontology-deep-dive.md) and
[report 01 §5.3](./research/01-lynx-project-overview.md).

**The reference-ontologies list is a survey, not a dependency manifest.** Of the
15 entries at <https://lynx-project.eu/data2/reference-ontologies>, LKG imports
exactly one (ELI). Seven have at least one dead link; four are dead projects
(MetaLex — EU catalogue marks it **Archived**; Nomothesia; NIR — whose artifact
link is a placeholder joke; CHLexML — discontinued November 2017 in favour of
Akoma Ntoso). The list carries **no licence column at all**;
[report 03 §4](./research/03-reference-ontologies-sweep.md) supplies it, read
from each artifact rather than inferred. Licence-clean and substantive:
**LKIF-Core** (CC BY 4.0, actively maintained, last pushed 2026-02-23,
<https://github.com/RinkeHoekstra/lkif-core>), **eu-cbcm** (CC BY 4.0),
**PCO** (CC BY 3.0 CZ), **Akoma Ntoso** and **LegalRuleML** (OASIS
royalty-free; AKN v2.0 Part 2 went to comment in July 2026). **No copyleft
anywhere in the list** — the binding constraint is the opposite one: *unknown*
licences on the EU and national-government artifacts (ELI, CDM, Finlex,
LexDania, NIR, MetaLex), whose models are freely reimplementable but whose files
must not be vendored.

**Zero patent or IP modelling anywhere in the corpus.** No claim, priority date,
family, prior-art reference, office action, CPC/IPC classification, assignment or
licence grant appears in any of the 15
([report 03 §5.1](./research/03-reference-ontologies-sweep.md)). Case law is
thinner still: Lynx conceded "no court has been considered in particular in the
specs". Clause-level contract modelling is unsolved landscape-wide — Lynx
evaluated and rejected both FIBO's and MPEG-21's contract ontologies.

### In-Repo Capability Inventory

Full inventory with paths: [report 04](./research/04-beep-effect-grounding.md).
Summary of what already exists, so this packet composes rather than rebuilds.

**Locked decisions that outrank any external ontology** (D1–D10, report 04 §1.1):
graph-is-projection with no dedicated graph database; **Effect Schema is the
authority and RDF/JSON-LD is derived**; no SPARQL engine in v1
(`UnsupportedSparqlQueryServiceLive` stands); no law-practice domain entities in
the semantic layer; `https://ns.beep.sh/` is the sole minting authority; FOLIO
alignment is metadata, never source of truth; **no third-party TTL/OWL in tracked
package source**; M2/M3/M4 milestone gating is binding.

**Live capabilities that already answer most of what Lynx offers:**

- **Exact-span provenance** — `packages/foundation/modeling/provenance/src/`
  (`TextAnchor`, `SourceTextIdentity`, `VerifiedTextAnchor`). `TextAnchor` is
  the stand-off pattern already: half-open char range plus the exact quoted
  substring, with `text.slice(start, end)` reproducing `quote`. It deliberately
  carries no confidence or claim semantics.
- **Schema → RDF projection** — `packages/foundation/modeling/ontology/src/`
  `Fold.assembly.ts` (`Ontology.fold`) and `Fold.projections.ts`
  (`toContext`, `toJsonLd`, `toTurtle`). D2 made executable; LKG hand-maintained
  the equivalent context and it drifted.
- **Semantic-foundation M1** — `SemanticFoundation.models.ts` (`DocumentClass`
  and `SkosMappingKind` `LiteralKit` domains, `ConceptAlignment`,
  `TaxonomyConcept`, `TaxonomySeed`), the committed repo-owned seed, and the
  fail-closed `TaxonomyLoader` with six typed errors.
- **Bounded SHACL + JSON-LD services** —
  `packages/foundation/capability/semantic-web` (validator limited to
  `targetClass`, `minCount`, `maxCount`, `datatype`).
- **Ontology workbench product slice** — `packages/ontology/{domain,use-cases,ui}`
  with asserted/inferred/shapes/provenance named-graph partitions, an in-memory
  SPARQL runner, and a structural reasoner.
- **Legal-core semantics already locked** — `goals/legal-position-relator-runtime`
  (closed 8-member `HohfeldPosition`, single advantage-side relator, Party–Role
  split composing the shared `Principal`) and `goals/patent-citation-candor-gate`
  (append-only facts; no stored "duty satisfied" state).
- **Vocabulary constants** — `@beep/rdf` `Vocab/*` for SKOS, DCTerms, PROV, OWL,
  RDF(S), XSD, OA, generated from the `@beep/identity` `CoreVocab` registry.
- **Language tags** — `LanguageTag` in `@beep/rdf/Rdf.ts` plus a generated IANA
  BCP-47 registry and validator in `@beep/html` [verified 2026-08-06].

**NOT FOUND (gaps this packet can legitimately speak to):**

- **Multi-claim span annotation.** `EvidenceSpan` carries exactly one
  `confidence` and no annotator, no timestamp, no model version, no supersession
  (`packages/epistemic/domain/src/values/EvidenceSpan/EvidenceSpan.model.ts`)
  [verified 2026-08-06].
- **Any live-wired vendor slice.** No manifest row is `VETTED`; the fail-closed
  loader is proven only by package-local fixtures, and pointing it at the real
  asset-pack manifest fails closed with a parse error (the R1 caveat).
- **Any lang-map / one-value-per-language construct.** `TaxonomyConcept.prefLabel`
  and `definition` are monolingual `S.NonEmptyString` [verified 2026-08-06].
- **Populated alignments.** Every seed `TaxonomyConcept.alignments` is `[]`.
- **Docketing / deadline obligation vocabulary** (M3, gated) and **IPC/CPC/Nice
  as loadable SKOS** (M2, gated) — and **Lynx covers neither**.
- **Schema → SHACL projection** (M4, gated).
- `LegalApplicabilityContext`, `LegalChangeEvent`, `LegalDocumentVersion`,
  `InterpretedNorm`, `RewriteStep` — routed to the **unopened**
  `legal-rule-time-identity` slug.

### Constraints Discovered

1. **Licence, per artifact.** LKG itself and the two permissive imports are
   **port-with-attribution** (LKG CC-BY-4.0 to "The Lynx Project Consortium";
   NIF Apache-2.0/CC-BY-3.0; ITS-RDF W3C Software License; DCMI CC-BY-4.0).
   **ELI, CDM, Finlex `laki`/`oikeus`, LexDania, NIR, MetaLex, `lexicog`** state
   no licence ⇒ **reference-only**: reimplement the model, never vendor the file.
   **DBpedia is CC-BY-SA 3.0** ⇒ clean-room only, matching the standing
   CopyrightOnto / PatentLEGO / SALI precedents. The Law-in-Context retrospective
   is **CC BY-NC-SA 4.0** — quotable, not adaptable into a commercial
   deliverable. The 70M-triple endpoint is a *reading* resource: each thesaurus
   (IATE, EuroVoc, UNESCO, ILO, STW, TheSoz) carries its own unverified terms and
   Lynx does not re-license them.
2. **D7 forbids third-party TTL/OWL in tracked package source**, so any Lynx
   artifact enters only as gitignored vendor bytes under an asset pack with
   committed manifest/fetch metadata.
3. **Contradiction risks are pre-mapped** (report 04 §6). A persistent graph
   store, a durable SPARQL endpoint, runtime OWL reasoning, legal positions as
   SKOS concepts, roles as person subclasses, or a second minting authority are
   all decided against; reopening any of them is a `/grill-with-docs`, not a PR.
4. **Milestone gating binds the useful work.** Shapes-from-schema is **M4**;
   classification schemes are **M2**; docketing vocabulary is **M3**.
5. **Routing is constrained.** `legal-rule-time-identity` is a proposed slug with
   no repo path; opening it needs Benjamin's routing approval. Registry/mapping
   work extends `goals/semantic-foundation`; positions/relators do **not** fork
   `goals/legal-position-relator-runtime`.
6. **Q1 kills speculative adoption.** A candidate that maps to none of CQs 1–20
   is reference material. This eliminates most of the reference list, including
   the intellectually attractive `lexicog` proposal.
7. **Availability is not citation.** Lynx demonstrates the rule with dates: a
   promised RDF/XML serialization 404s, the validator sandbox is 503, the
   recommended instance-IRI host no longer resolves, and NIF's upstream repo has
   been untouched since 2017-06-22.

### Assessment

Verdicts (ADOPT / ADAPT / ALREADY-COVERED / CONTRADICTS / IGNORE) for every
notable LKG element and every reference ontology, plus the ranked shortlist of
the five most valuable concrete opportunities with schema-first Effect sketches:
**[`research/05-value-assessment.md`](./research/05-value-assessment.md)**.

Headline: Lynx is a **pattern donor, not a vocabulary donor**. The shortlist is
(1) attributed multi-claim span annotation composing `TextAnchor`/`EvidenceSpan`;
(2) `lkg.ttl` as the first real VETTED vendor slice to exercise the fail-closed
loader and force the R1 manifest reconciliation; (3) a lang-map combinator making
LKG's language discipline schema law; (4) a schema → SHACL projection into the
M4 lane, with LKG's 18 documented contradictions as the written rationale; (5)
an ELI temporal/FRBR donor profile for the unopened `legal-rule-time-identity`
slug. Lynx unlocks **nothing** for M2, M3, case law, or clause-level contracts —
recorded as a result, not an omission.
