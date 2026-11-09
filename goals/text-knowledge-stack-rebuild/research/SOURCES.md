# Text-Knowledge Stack Rebuild — Sources & Provenance

- **Source exploration:** none. This goal was authored directly on 2026-11-08
  from the operator's request to challenge the text-knowledge stack from first
  principles and the rebuild report it produced
  ([`2026-11-08-rebuild-report.md`](./2026-11-08-rebuild-report.md), revision 2).
  The parked [`knowledge-endgame`](../../../explorations/knowledge-endgame/README.md)
  exploration is related, not a source: its `CAPTURE.md` states three of the
  vision laws the design keeps (two identity regimes, projections are
  disposable, admission split into grounding and governance).
- **Provenance:** four read-only reader audits and three adversarial critiques
  ran as delegate sessions over worktree head `de54b37982b` on 2026-11-08 and
  are carried here as `2026-11-08-reader-*.md` and `2026-11-08-critic-*.md`
  (reader A abridged: its 3,700-line schema index reproduces source already in
  the tree; absolute home paths replaced with `~`). Literature came from
  alphaXiv, OpenAlex and DOI lookups on 2026-11-08; the original artifacts
  live in the OpenResearch artifacts directory (`text-knowledge-rebuild/`),
  outside this repository.

## 1. Mined source corpus

In-repo code the design generalizes (`generalize`), repairs (`repair`) or
cites as precedent (`reference`). Line numbers are as read on 2026-11-08.

| Source | Title | Upstream (repo) | Location (`file:line`) | Theme | Disposition |
|--------|-------|-----------------|------------------------|-------|-------------|
| `cm1` | Citation mention occurrence id, preimage in encoding order: `citation-mention/v1`, `engineArtifact`, `semanticKind`, `scopeRef`, `sourceRef`, `locator`, `sourceDigest`, `textDigest`, `extractor.name`, `extractor.version`, `normalizationVersion`, `startChar`, `endChar`, `quote` | beep-effect | `packages/law-practice/server/src/internal/Citation/MentionIdentity.ts:111-145` | L1 occurrence identity | generalize |
| `ca1` | Citation authority id kept separate from the occurrence | beep-effect | `packages/law-practice/server/src/internal/Citation/AuthorityIdentity.ts:126-169` | L1 identity regimes | generalize |
| `vta` | `VerifiedTextAnchor`: proof issued and verified | beep-effect | `packages/foundation/modeling/provenance/src/VerifiedTextAnchor.ts:354,396-401,639-659` | L1 anchors | generalize |
| `sti` | `SourceTextIdentity`: artifact digest, text digest, extractor, normalization | beep-effect | `packages/foundation/modeling/provenance/src/SourceTextIdentity.ts:125-145` | L1 text capture | generalize |
| `claim` | `Claim<P>` envelope, five `Present \| Absent{reason}` signals | beep-effect | `packages/foundation/modeling/epistemics/src/Claim/Claim.model.ts:69-70,276-291,311-317` | L4 claims | generalize |
| `lei` | `LogicalEdgeIdentity` requiring `orgScope` | beep-effect | `packages/foundation/modeling/epistemics/src/LogicalEdgeIdentity/LogicalEdgeIdentity.model.ts:82,120` | L4 scope | reference |
| `oa` | Web Annotation selector codecs, both directions | beep-effect | `packages/foundation/modeling/rdf/src/Adapters/WebAnnotation.ts:358-369,492,577-588` | L6 codecs | generalize |
| `evid` | `rdf.Evidence` selectors (text position and quote) | beep-effect | `packages/foundation/modeling/rdf/src/Evidence.ts:78-122,204-206` | L1/L6 selector union | generalize |
| `prov` | In-repo PROV core schema module (`Activity`, `Entity`, `Agent`); consumed by the `ProvRdf.ts` codec and four `rdf/test` files, by no handoff or claim record | beep-effect | `packages/foundation/modeling/rdf/src/Prov.ts:1-7`, `rdf/src/ProvRdf.ts`, `rdf/src/index.ts:54,61` | L5 activities | generalize |
| `fold` | Ontology fold: `predicateNode` emits OWL property declarations with `rdfs:domain`/`rdfs:range`; `classNode` copies caller-supplied facts such as `rdfs:subClassOf` (it does not mint them); imports only `IRI` and `LanguageTag` from rdf | beep-effect | `packages/foundation/modeling/ontology/src/Fold.projections.ts:296-327,349-359`, `Fold.models.ts:15-24,485` | L3 fold | generalize |
| `loader` | Manifested, pinned taxonomy asset loader | beep-effect | `packages/foundation/modeling/ontology/src/TaxonomyLoader.ts:233-256` | L3 asset packs | generalize |
| `seeds` | Legal vocabulary seeds in foundation | beep-effect | `packages/foundation/modeling/ontology/src/Vocabulary.seed.ts:22-104`, `SemanticFoundation.seed.ts` | L3 misfiling | repair |
| `dto` | FOLIO HTTP DTOs in a modeling package | beep-effect | `packages/foundation/modeling/ontology/src/Ontology.models.ts:242-311` | L3 misfiling | repair |
| `iri` | IRIs minted from package, file and symbol paths | beep-effect | `packages/foundation/modeling/identity/src/Id.ts:60-77`, `identity/test/IriBinding.test.ts:58-74` | L0 term stability | repair |
| `pins` | `test-utils` IRIs pinned under a renamed package | beep-effect | `packages/tooling/test-kit/test-runner/src/Vitest.errors.ts:23,141,151` | L0 term stability | repair |
| `handoff` | Lossy langextract handoff: array-order ids, every label an `Entity`, empty relations, no digests | beep-effect | `packages/foundation/capability/langextract/src/Handoff/Handoff.behavior.ts:39-111` | L2 handoff | repair |
| `ir` | `AnnotatedDocument` is produced on `LangExtractResult` and round-tripped in tests, but `IrToLaw` reads `GroundedExtraction`, not the envelope | beep-effect | `packages/foundation/modeling/nlp/src/Handoff/Contract.ts:514`, `packages/foundation/capability/langextract/src/Service/Service.layer.ts:90-107`, `packages/law-practice/use-cases/src/IrToLaw/IrToLaw.ports.ts:6-14` | L2 consumer | repair |
| `proj` | Semantica RDF projection omitting anchor, quote, receipt, confidence | beep-effect | `apps/labs/semantica/src/layers/RdfProjectionLive.ts:66-111,113-122` | L6 projection | repair |
| `one` | Missing confidence becomes `1` | beep-effect | `apps/labs/semantica/src/layers/ExtractorLive.ts:238-239` | L4 invented certainty | repair |
| `ninety` | Evidence confidence fixed at `0.9` | beep-effect | `packages/law-practice/use-cases/src/OfficeActionReview/OfficeActionReview.service.ts:95` | L4 invented certainty | repair |
| `docket` | Citation-existence check passes when attachment text is absent | beep-effect | `packages/law-practice/use-cases/src/DocketIntake/DocketReview.policy.ts:280-285` | L4 unknown as pass | repair |
| `lifecycle` | `ClaimLifecycle.advance` in the epistemic slice | beep-effect | `packages/epistemic/use-cases/src/ClaimLifecycle/ClaimLifecycle.service.ts:121-129` | L4 status | reference |
| `prompt` | Prompt prose beside the schema it describes | beep-effect | `packages/foundation/capability/langextract/src/Service/Service.prompt.ts:19-83` | L7 agent surface | repair |
| `so` | `schema-org` facets: typed graph, `NodeRef`, serialization, conformance | beep-effect | `packages/foundation/modeling/schema-org/src/index.ts:1-11,38-52` | L6 census | reference |
| `theory` | `THEORY.md` names the deleted `ip-law-knowledge-graph` owner at lines 141 and 193 and cites a module in another package at line 72 | beep-effect | `packages/foundation/modeling/nlp/THEORY.md:72,141,193` | docs | repair |

**How these inform implementation:** `cm1`/`ca1`, `vta` and `sti` are the
house style: the rebuild generalizes their preimage discipline into
`OccurrenceId`, re-mints their records by migration (2026-11-09 ruling) and
keeps the `TextAnchor` and `VerifiedTextAnchor` shapes. `claim` already has the
signals the design needs; the work is the immutable-core split and the
separate records. `oa`, `evid`, `prov` and `fold` are the codec and vocabulary
material the arrows are built from. Every `repair` row is an acceptance test
in `SPEC.md`.

## 2. Upstream repositories & licenses

Nothing is vendored or ported from an upstream repository. External
vocabularies enter as registry entries (source pin, license, digest) and
adapters; each license is verified when the registry entry is written (P1 and
P5), never assumed here.

| Repo | License | Port discipline | What we take |
|------|---------|-----------------|--------------|
| W3C Web Annotation (`oa:`), PROV-O (`prov:`), SKOS (`skos:`) | verify at registry entry | reference / adapter | selector union wire form, activity model, concept schemes |
| NIF Core (`nif:`), DoCO (`doco:`) | verify at registry entry | adapter only | export kinds for sentences, words, document components |
| gUFO (`gufo:`) | verify at registry entry | adapter, optional class typing | metaproperty typology for the few classes whose rigidity drives a check |
| LKIF Core, ELI, Akoma Ntoso, ST.96 | verify at registry entry | reference / law-practice profile mappings | legal core terms, norm identifiers, patent structure mappings |
| SSSOM | verify at registry entry | data format | mapping sets with justification and typed confidence |
| RDFC-1.0 (W3C) | W3C spec | algorithm reference | canonical form for `Dataset` digests |

## 3. External research sources

Read in full or in their structured report (●); abstract level (○). Links are
alphaXiv where the paper is on arXiv, DOI otherwise. Report section 3 states
what each one suggests for the design and where the critics narrowed a
reading.

- ● Bird, S.; Liberman, M. *A Formal Framework for Linguistic Annotation* (1999). https://www.alphaxiv.org/abs/cs/9903003
- ○ Eckart de Castilho, R.; Ide, N.; et al. *Representation and Interchange of Linguistic Annotation* (2017). https://doi.org/10.18653/v1/w17-0808
- ○ Ide, N.; Suderman, K. *The Linguistic Annotation Framework, LAF*. https://openalex.org/W1457156378
- ● Sanderson, R.; Ciccarese, P.; Van de Sompel, H. *Designing the W3C Open Annotation Data Model* (2013). https://www.alphaxiv.org/abs/1304.6709
- ○ Hellmann, S.; Lehmann, J.; Auer, S.; Brümmer, M. *Integrating NLP Using Linked Data* (2013). https://doi.org/10.1007/978-3-642-41338-4_7
- ● Ding, Y.; Yankoski, M.; Weninger, T. *Span-Oriented Information Extraction* (2024). https://www.alphaxiv.org/abs/2403.15453
- ● Spivak, D. I. *Functorial Data Migration* (2010). https://www.alphaxiv.org/abs/1009.1166
- ● Patterson, E.; Lynch, O.; Fairbanks, J. *Categorical Data Structures for Technical Computing* (2022). https://www.alphaxiv.org/abs/2106.04703
- ● Shinavier, J.; Wisnesky, R.; Meyers, J. G. *Algebraic Property Graphs* (2019). https://www.alphaxiv.org/abs/1909.04881
- ○ Schultz, P.; Spivak, D. I.; Vasilakopoulou, C.; Wisnesky, R. *Algebraic Databases* (2016). https://www.alphaxiv.org/abs/1602.03501
- ● Kuhn, T.; et al. *Nanopublications: A Growing Resource of Provenance-Centric Scientific Linked Data* (2018). https://www.alphaxiv.org/abs/1809.06532
- ● Clark, T.; Ciccarese, P.; Goble, C. *Micropublications* (2014). https://doi.org/10.1186/2041-1480-5-28
- ● Vitali, F.; Pasqual, V. *Provenance-Enhanced Statements in Knowledge Graphs* (2026). https://www.alphaxiv.org/abs/2606.15246
- ○ Green, T. J.; Tannen, V. *The Semiring Framework for Database Provenance* (2017). https://doi.org/10.1145/3034786.3056125
- ● Guan, S. *Attributable by Construction: Claim-Anchored Provenance for Multi-Document Summarization* (2026). https://www.alphaxiv.org/abs/2606.23989
- ○ *Claim-Level Confidence Calibration for Reliable Decision Making with Large Language Models* (2026). https://www.alphaxiv.org/abs/2608.22483
- ○ *Evidential-Based Higher-Order Set Argumentation Framework* (2026). https://www.alphaxiv.org/abs/2608.27824
- ● Prudhomme, T.; et al. *A semantic approach to mapping the Provenance Ontology to Basic Formal Ontology* (2025). https://doi.org/10.1038/s41597-025-04580-1
- ○ Hogan, A. *Canonical Forms for Isomorphic and Equivalent RDF Graphs* (2017). https://doi.org/10.1145/3068333
- ○ *Bitemporal Property Graphs* (2025). https://doi.org/10.1007/978-3-032-05281-0_15
- ● Taranukhin, M.; Shwartz, V. *Position: Legal LLM Hallucination Should Be Evaluated as Failure of Legal Warrant* (2026). https://www.alphaxiv.org/abs/2609.17546
- ● de Martim, H. *Legal Knowledge Graph Foundations, Part I* (2025). https://www.alphaxiv.org/abs/2508.00827
- ● de Martim, H. *Modeling the Diachronic Evolution of Legal Norms* (2025). https://www.alphaxiv.org/abs/2506.07853
- ○ Hoekstra, R.; Breuker, J.; Di Bello, M.; Boer, A. *LKIF Core* (2009). https://doi.org/10.3233/978-1-58603-942-4-21
- ○ Griffo, C.; Almeida, J. P. A.; Lima, J. A. O.; Sales, T. P.; Guizzardi, G. *Legal powers, subjections, disabilities, and immunities* (2023). https://doi.org/10.1016/j.datak.2023.102219
- ○ *The FLINT Ontology* (2023). https://doi.org/10.3233/ssw230016
- ○ Markovich, R. *Understanding Hohfeld and Formalizing Legal Rights* (2020). https://doi.org/10.1007/s11225-019-09870-5
- ● Almeida, J. P. A.; Guizzardi, G.; Sales, T. P.; Fonseca, C. M. *gUFO* (2026). https://www.alphaxiv.org/abs/2603.20948
- ○ Guizzardi, G.; et al. *UFO: Unified Foundational Ontology* (2022). https://doi.org/10.3233/ao-210256
- ○ Constantin, A.; Peroni, S.; Pettifer, S.; Shotton, D.; Vitali, F. *The Document Components Ontology (DoCO)* (2016). https://doi.org/10.3233/sw-150177
- ● Han, Y.; et al. *Evidence Units* (2026). https://www.alphaxiv.org/abs/2604.00500

## 4. In-repo capability references

| Brick | Path | Role in this goal |
|-------|------|-------------------|
| `@beep/identity` | `packages/foundation/modeling/identity` | extend (L0: registry, `TermBinding`, `ContentHash`, `ActivityId`, canonical JSON) |
| `@beep/provenance` | `packages/foundation/modeling/provenance` | retire in P2; L1 (`Selector`, `OccurrenceId`, `Resolution`, `Reanchoring`, unit conversion, `TextAnchor`, `VerifiedTextAnchor`) lives in `@beep/text` |
| `@beep/rdf` | `packages/foundation/modeling/rdf` | extend (L6: `Dataset` quotient, `Literal` cases, `TextAnchor <-> oa:`, registry-backed namespaces) |
| `@beep/epistemics` | `packages/foundation/modeling/epistemics` | extend (L4: immutable core, `Stance`, `Admission`, `Assessments<K>`, `epistemics/rdf`) |
| `@beep/ontology` | `packages/foundation/modeling/ontology` | extend and move out (L3: SSSOM, `fold -> Dataset`; seeds and DTOs leave) |
| `@beep/nlp` | `packages/foundation/modeling/nlp` | retire in P7 after L2 and L5 absorb it |
| `@beep/md`, `@beep/pandoc-ast`, `@beep/lexical`, `@beep/html` | `packages/foundation/modeling/{md,pandoc-ast,lexical,html}` | extend (AST source maps into `@beep/text`) |
| `@beep/langextract` | `packages/foundation/capability/langextract` | repair (lossless handoff; unit conversion moves down to L1) |
| `@beep/schema` (`LiteralKit`) | `packages/foundation/modeling/schema` | reuse |
| `@beep/schema-org` | `packages/foundation/modeling/schema-org` | every facet rehomed or deleted in P7 per the consumer census |
| `mcp-kit` (`S.toJsonSchemaDocument`) | `packages/foundation/capability/mcp-kit/src/SanitizedSpan.ts` | reuse (L7: tool schemas are the Effect schemas) |
| law-practice citation identity | `packages/law-practice/server/src/internal/Citation`, `packages/law-practice/domain/src/values/Citation` | reuse as precedent; the `cm1:` preimage becomes the occurrence preimage and records are re-minted by a P2 migration with the `citation-extraction-engine` lane |
| law-practice office action, docket, IrToLaw | `packages/law-practice/use-cases/src/{OfficeActionReview,DocketIntake,IrToLaw}` | repair (defaults, the unavailable-document-text docket check, handoff consumer) |
| semantica lab | `apps/labs/semantica` | repair (projection loss declared; `1` default removed; gold fixture migrated) |
| `@beep/annotation` | NET-NEW in P3 via `bun run beep create-package` after the P0 routing decision | L2 home |
| `@beep/nlp-processing` | `packages/foundation/capability/nlp-processing` (existing) | extend (L5 home: absorbs `nlp/Operations` and `nlp/Algebra`) |
| `@beep/text` | NET-NEW in P2 via `bun run beep create-package`; `@beep/provenance` retired with consumers migrated | L1 home |

## 5. Cross-links & provenance

- Related goals (status as of 2026-11-08):
  [`citation-verified-span-substrate`](../../citation-verified-span-substrate/README.md)
  (completed-retained; verified anchors and UTF-16 offsets this design keeps),
  [`attributed-multi-claim-span`](../../attributed-multi-claim-span/README.md)
  (superseded by this packet on 2026-11-09: L2 and L4 replace its annotation aggregate and its LangExtract-to-ClaimGate proof; see `SPEC.md` "Relationships"),
  [`epistemics-foundation-extraction`](../../epistemics-foundation-extraction/README.md)
  (completed-retained; provides `foundation/epistemics-vocabulary`, which this packet requires),
  [`provenance-shared-claim-kernel`](../../provenance-shared-claim-kernel/README.md),
  [`identity-iri-core`](../../identity-iri-core/README.md),
  [`identity-iri-fibered`](../../identity-iri-fibered/README.md),
  [`identity-iri-fold`](../../identity-iri-fold/README.md) (completed-retained; the L0 base),
  [`spar-document-annotation-wire`](../../spar-document-annotation-wire/README.md)
  (completed-retained; OA/PROV document annotations and the DOCO fold),
  [`ontology-interop-roadmap`](../../ontology-interop-roadmap/README.md) (completed-retained; rdf and ontology interop v1),
  [`nlp-adjunct-port`](../../nlp-adjunct-port/README.md) (completed-retained; the `@beep/nlp` port),
  [`langextract-capability`](../../langextract-capability/README.md) (completed-retained),
  [`belief-view-engine`](../../belief-view-engine/README.md) (paused; selection policy over contention sets),
  [`citation-extraction-engine`](../../citation-extraction-engine/README.md) (active; owner of `cm1:`/`ca1:`).
- Related exploration: [`knowledge-endgame`](../../../explorations/knowledge-endgame/README.md) (parked).
- Standards this packet gives content to: `standards/architecture/DECISIONS.md`
  2026-10-21 (epistemic vocabulary is foundation), the upstream-first ruling,
  the Opaque default, the tagged-union ruling, the identity authority;
  `standards/architecture/GLOSSARY.md` "TextAnchor" and "Verdict";
  `standards/architecture/11-evolution-and-deprecation.md` (retirement procedure).
- Decision files: `decisions/` (projected into `SPEC.md`): program shape (2026-11-08), the breaking-changes ruling and the resolved questions (2026-11-09).
- Law-test ledger: `law-test-plan.md`, one row per catalogue row `L0-1` to `L6-2`.
- Artifacts outside the repository: the OpenResearch artifacts directory
  `text-knowledge-rebuild/` (report, PDF figures, unabridged reader A) and
  `nlp-algebra-model/` (the companion `@beep/nlp` law audit).
