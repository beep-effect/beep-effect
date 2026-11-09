# Adversarial product review of the text-knowledge rebuild

Verdict: refuted as a prerequisite rebuild for the next twelve months. The evidence supports repairing source preservation and review semantics now. It does not establish that the practice needs a new formal foundation before using a real matter. Predictions about cost and attorney usability below are engineering inferences, not measured results. No repository files, Git state, dependencies, or compute runs were changed. This requested findings file is the sole deliverable.

Evidence shorthand: **Draft** is [the report under review](~/.local/share/openresearch/files/beep-effect/text-knowledge-rebuild/text-knowledge-rebuild-report.md); **A** is [the law-practice reader](~/.local/share/openresearch/files/beep-effect/text-knowledge-rebuild/research/reader-a-law-practice.md), especially §§1, 2, 4, 5, 7; **C** is [the pipeline reader](~/.local/share/openresearch/files/beep-effect/text-knowledge-rebuild/research/reader-c-agent-surfaces.md), especially §§2, 3, 8. Reader observations are cited as audited observations, not newly executed verification. Primary standards were checked separately where linked. Repository citations use the reader's owning-source pointers.

## 1. The migration makes known safety repairs wait for an unearned foundation

Severity: **blocking**.

Attacked: Draft §7, migration steps 1–7: “Doctrine first”; rename provenance; build annotation; registry; envelope; taxonomy; finally repair the evidence projection.

Argument: C §8 identifies concrete failures: source identity disappears at the handoff, absent confidence becomes 1, relation information disappears, and the RDF view loses its evidence. A §4.2 also identifies a fixed five-entity office-action spike with fabricated fixture values and constant 0.9 confidence. None requires DEC, nanopublications, gUFO, or package renames to fix. A §1 describes actual Outlook intake, Box filing, review queues, and calendar writes, while the public citation guard remains incomplete. Inference: moving multiple consumers onto new representations before fixing these contracts spends the solo practice's delivery budget without retiring its largest risks. A package-count reduction is not evidence of reduced operational cost.

Concrete fix: Make the first milestone one reviewable office action and one replayable docket event with complete evidence, preserved matter boundaries, and no fabricated certainty. L0 earns stable published term bindings and digests; L1 earns existing verified anchors plus coordinate adapters; L2 earns a loss-aware handoff. L3 earns only the classifications actually consumed. L4 earns typed assessments and review records. L5 earns boundary receipts and external-write idempotency. L6/L7 earn a resolver and an attorney review view. Defer full selector generality, WEMI reconstruction, gUFO lint, semiring propagation, nanopublication publication, and categorical infrastructure pending a named consumer and acceptance case.

## 2. Quote-first identity cannot uniquely identify repeated legal occurrences

Severity: **blocking**.

Attacked: Draft L1: “hash(expression, quote, disambiguating context), not hash(offsets)” and “AnchorId is invariant under re-indexing between equivalent Expressions.”

Argument: Identical claim language, repeated quotations, headers, and examiner boilerplate can share quote, prefix, and suffix. Larger context eventually becomes an occurrence locator, with its own versioning and failure rules. The draft gives no uniqueness rule. Its invariance promise also conflicts with including an Expression reference when normalization changes that Expression's digest; quote bytes can change too. The [Web Annotation text-quote selector](https://www.w3.org/TR/annotation-model/#text-quote-selector) permits multiple matching sequences and recommends treating all as selected. That is insufficient for a singular legal occurrence. Existing citation identity already binds source, engine, range, and quote separately from authority identity (A §4.1; `MentionIdentity.ts:111–128`). The ratified doctrine requires duplicate disambiguation and fresh verification after drift. <file path="docs/product/citation-grounding.md" />

Concrete fix: Preserve the current source-version-bound occurrence identity and exact raw slice. Use quote/context to locate, offsets or structural identifiers to disambiguate, and a separately recorded mapping to relate occurrences across versions. Add page/line, paragraph, or claim-number pinpoints as versioned display locators. Fail ambiguous. Do not promise cross-normalization identity until an equivalence and collision policy are implemented.

## 3. Content addresses are the wrong universal identity for matters and legal works

Severity: **major**.

Attacked: Draft L0: “content-addressed ids for instances”; L1 `Work { id: InstanceIri, kind: WorkKind }` and Expression/Manifestation schemas.

Argument: A matter, application, work, draft lineage, and byte capture have different identity requirements. Two client files can contain identical bytes without being the same matter-scoped legal record. An application, its publication, and the granted patent need explicit relationships and official identifiers; they are not interchangeable digest aliases. The proposed Work has neither a minting preimage nor enough fields to distinguish two works of one kind. [Akoma Ntoso §5.1](https://docs.oasis-open.org/legaldocml/akn-core/v1.0/os/part1-vocabulary/akn-core-v1.0-os-part1-vocabulary.html) distinguishes work, expression, manifestation, and item; it does not equate an extracted-text digest with legal document identity. Its author/editor distinction also makes parser-normalized text a questionable automatic “Expression.” A §§2, 7 already distinguish application, publication, patent, observation, and human-decision identities.

Concrete fix: Keep minted stable document/matter identities, official application/publication/patent identifiers, and immutable artifact/text digests as separate fields with explicit joins. Record parser output as a derived text capture. Map to a documented WEMI profile only at an interoperability boundary that needs it. Neither ELI nor LRMoo should displace USPTO/WIPO identifiers in the operational UI.

## 4. DoCO spans do not supply the patent structure the product needs

Severity: **major**.

Attacked: Draft L2 “Structure: doco:Section, doco:Paragraph…” and “Containment is a derived relation … over anchor inclusion.”

Argument: Geometric inclusion does not establish claim dependency, claim amendment status, rejection-to-claim coverage, or a claim element's asserted disclosure support. Equal spans can carry different structural and rhetorical roles; cross-references are not containment. C §2 also reports that PDF parsing already loses page geometry, which an annotation schema cannot reconstruct. [ST.96's published schema inventory](https://www.wipo.int/standards/en/st96/v7-0/annex-iii/index.html) explicitly includes Claim, ClaimNumber, ClaimReference, ClaimStatusCategory, and CitedPassage. [Akoma Ntoso](https://docs.oasis-open.org/legaldocml/akn-core/v1.0/os/part1-vocabulary/akn-core-v1.0-os-part1-vocabulary.html) distinguishes logical components and publication components. DoCO remains useful for generic document blocks; it is not sufficient legal structure.

Concrete fix: Keep generic blocks optional. Add a small law-owned structure profile with versioned claim numbers/text/status, dependency links, rejection/claim associations, numbered paragraphs, and source page/line mappings. Preserve explicit parser structure and its provenance. Use ST.96 mappings for patent fields and selected AKN concepts for authorities when useful; require neither full standard ingestion nor an ontology rewrite.

## 5. Five warrant transitions confuse independent, authority-specific assessments

Severity: **blocking**.

Attacked: Draft L4: “five assessments … (exists, applies, current, status, supports) as five transitions on the citation claim”; “current is a bitemporal check against the authority's valid interval.”

Argument: These are useful questions, but not a complete universal state progression. A case can exist and support a proposition while later treatment limits only one holding. An older statutory version can be the applicable version. An MPEP passage can be accurately retrieved while a later USPTO notice changes the procedure. The [USPTO MPEP landing page](https://www.uspto.gov/web/offices/pac/mpep/) expressly separates the manual's revision cutoff from subsequent policy changes and consolidated laws/rules. One validity interval cannot establish all of that. A §4.1 further warns that the current citation resolver groups resources and short forms; it does not itself establish external authority existence. For IDS/candor, [37 C.F.R. 1.56 as reproduced in MPEP §2001](https://www.uspto.gov/web/offices/pac/mpep/s2001.html) concerns information material to patentability, including information contrary to an applicant's position. “Supports” is not the governing question for that workflow.

Concrete fix: Store independent, versioned assessment records with subject proposition, authority type, jurisdiction/forum, relevant date, evidence capture, checking method, reviewer, and unknown/limited/contradictory outcomes. Use different required-check profiles for statutes, regulations, MPEP guidance, cases, prior-art references, and candor dispositions. Keep legal relevance and attorney judgment separate from text verification and parser resolution. NLI can propose a support assessment; it cannot discharge the attorney's warrant review.

## 6. Attorney approval does not move a proposition into reality

Severity: **blocking**.

Attacked: Draft L4 `settle(...HumanAdmission) => ... stance: "epistemic"`; §3: “the attorney's admission is settle”; L4 replacement of seven status vocabularies with one LTS.

Argument: DEC's philosophical vocabulary has not been shown to match this practice's decisions. Inference: an attorney may approve a tentative calendar entry, authorize an investigation, accept an examiner's characterization for argument, or dispose of an IDS candidate without asserting the underlying proposition is true. A §§2, 4.3 distinguishes tentative/needs-review entries, materiality judgments, observations, and external execution. Those statuses are not synonyms waiting to be deduplicated. An examiner assertion and the applicant's rebuttal must coexist. The vision itself reserves legal judgment and filings to the attorney; it does not make attorney approval a truth oracle. <file path="docs/PROSE_TO_PROOF_VISION.md" />

Concrete fix: Keep source observations, proposed interpretations, attorney decisions, and executed actions separate. Make review state orthogonal to grounding, legal assessment, and publication/execution state. Admission tokens should bind actor, matter, action, exact revision, and scope of authorization. Present “reviewed/approved for this use,” not “epistemic reality.” Keep DEC as an optional research/export mapping until a concrete workflow demonstrates its value.

## 7. Honest absence still needs an operational ranking policy

Severity: **major**.

Attacked: Draft L4 “there is no function from Signals to a single number”; §6 “no function Signals → number exported.”

Argument: Removing invented 1/0.9 confidence is correct. Prohibiting every scalar projection does not follow. The attorney must see an urgent unresolved deadline before a low-impact vocabulary warning. A §4.3 documents a deterministic review score from field agreement and material findings; that is a workflow heuristic, not a probability of legal truth. A prohibition invites a parallel, undocumented UI score or an unusable queue. Unknown confidence should neither disappear nor outrank everything by accident.

Concrete fix: Preserve optional independent signals with origin and calibration metadata. Add a named, versioned review-priority policy based first on deadline proximity, consequence, source absence, conflicting evidence, and unresolved review. Allow a transparent score or lexicographic ordering for triage, labelled as such. Test unknown handling and ranking ties. Never let rank cross an authority or approval gate.

## 8. Semirings do not make legal evidence aggregation sound

Severity: **major**.

Attacked: Draft L4 “sourceTrust, assertedConfidence, extractorConfidence, validatorScore, reviewerDisposition each take values in a named semiring” and “Propagation … is the semiring homomorphism.”

Argument: Algebraic laws do not establish that the chosen operations mean what the product claims. Multiplication can double-count correlated extractions; max can discard a material contradiction; a Boolean disposition does not encode approval scope or reasons. The same quote processed by two models is not two independent sources. The draft supplies no operational derivation/query semantics, independence assumptions, or calibration data connecting these five heterogeneous channels. Inference: the next twelve months need evidence lineage and accountable decisions before generic propagation.

Concrete fix: Remove semiring typing from the admission prerequisite. Keep typed measurements, missing reasons, source lineage, and structured human decisions. Define aggregation per actual consumer and test duplicated-source and contrary-evidence cases. Introduce a provenance semiring later for a bounded query whose addition, multiplication, zero, and one have explicit domain meanings; do not force reviewer disposition into numeric evidence algebra.

## 9. gUFO-on-every-term creates maintenance work and a category mistake

Severity: **major**.

Attacked: Draft §0 “grounding every repo-minted term in a foundational ontology”; L3 `GufoType` attached to `Term`, with a universal audit lane.

Argument: A registry contains classes, properties, individuals, schema datatypes, and SKOS concepts. These do not all take the same metatype. The proposed enumeration mixes Kind/Role/Phase, which classify types, with Event/Quality/Relator, which classify individuals. The [gUFO specification](https://nemo-ufes.github.io/gufo/) separately documents EventType, AbstractIndividualType, RelationshipType, and endurant type categories. A SKOS subject heading is not automatically the OWL class of what it denotes. Three lint predicates cannot substitute for that modeling decision. No maintainer, review workflow, or legal benefit is assigned. Inference: the developer or attorney will become the ontology maintenance bottleneck.

Concrete fix: Allow untyped registry entries. Require labels, definitions, owner, source/license, edition, and deprecation handling first. Commission a bounded gUFO/UFO-L model only for a law-owned relation that actually drives a check, with a named maintainer and tests. Never make typing a term a prerequisite to capturing or reviewing an office action.

## 10. NIF is a possible adapter vocabulary, not a product requirement

Severity: **minor**.

Attacked: Draft §3 “Sentence and token kinds take NIF IRIs, not repo-minted ones”; L2 NIF kinds as the canonical internal API.

Argument: The [NIF source ontology](https://raw.githubusercontent.com/NLP2RDF/ontologies/master/nif-core/nif-core.ttl) provides linguistic string/word/sentence terms, so it is not reasonable to call it nonexistent or claim no adoption. Conversely, this review found no evidence that Outlook, Box, USPTO claim ingestion, or the attorney review workflow needs NIF interoperability. Namespace reuse does not determine tokenization rules, engine edition, or abbreviations in legal prose. The draft supplies no such consumer or adoption evidence. Refuted as a mandatory internal dependency, not as an export option.

Concrete fix: Keep stable sentence/token kinds and tokenizer provenance. Map them to pinned NIF terms in an adapter if an actual consumer needs it. If NIF IRIs are already cheap aliases, retaining them is fine; do not make an OA/NIF JSON-LD round trip gate delivery of the law-practice flow.

## 11. Content identity and single-producer provenance conflict on independent reruns

Severity: **major**.

Attacked: Draft L2 `AnnotationId = hash(targets, kind, body)` with `generatedBy` outside that preimage; L5 “every output id appears in exactly one Activity's generated.”

Argument: Two runs can produce the same content-addressed annotation and different activities. HashSet union either retains two unequal records with the same ID or arbitrarily loses one provenance history; the proposed keyed map cannot represent both without another rule. A cache hit also returns an existing entity rather than creating it again. [PROV constraints](https://www.w3.org/TR/prov-constraints/#unique-generation) distinguish entity/activity generation-event uniqueness; they do not require one producing Activity for every content ID. Independent later reruns should not be squeezed into simultaneous generation claims merely to satisfy a test.

Concrete fix: Separate immutable annotation content from run-specific production observations and decisions. Each execution receipt records inputs, reused outputs, newly generated run-specific outputs, engine/prompt pins, and errors. Link shared content by digest. Emit provenance at ingestion, extraction, normalization, review, and external-write boundaries first. Add broader internal operation tracing only when needed for debugging or reproducibility.

## 12. Refuse package renames and folds before one real matter closes the loop

Severity: **major**.

Attacked: Draft §5 provenance→text, ontology→taxonomy, nlp→annotation plus nlp-processing, schema-org retirement; §7 migration order.

Argument: The draft itself reports 15 provenance consumers and 17 RDF consumers. Its migration changes names, ownership, IDs, schemas, and processing composition together. A §4.2 shows a stronger OfficeActionStructure path already uses VerifiedSourceText while the older mapper remains a spike. Refactoring both as one generic architecture risks regressing the stronger path to accommodate the weaker one. The ontology rename does not itself fix seed ownership; the nlp fold does not itself preserve a digest. Zero consumers can justify schema-org retirement after a census, but not coupling it to the first matter.

Concrete fix: Refuse provenance→text and the nlp fold until source-preserving adapters and a real-matter acceptance flow exist. Defer ontology→taxonomy; move or expose legal seeds only when a consumer requires the boundary fix. Retire schema-org separately if the live census confirms zero consumers and a tested replacement. Use compatibility exports and dual-read migrations where necessary. Decouple published term IRIs from code paths before any path-changing refactor.

## 13. The universal anchor-chain invariant cannot describe drafting

Severity: **blocking**.

Attacked: Draft L7 “every agent-produced artifact (draft, summary, answer) terminates in claim ids that resolve to anchors.”

Argument: An office-action response contains newly authored argument, proposed amendments, transitions, alternative positions, and attorney strategy. Anchoring the generated draft to itself would satisfy the words while proving nothing. Requiring every sentence to be an extracted claim would prevent useful drafting. At the same time, source support matters acutely for amendments: [MPEP §608](https://www.uspto.gov/web/offices/pac/mpep/s608.html) addresses original-disclosure basis and the prohibition on new matter. A support citation is not a mechanical proof that the amendment complies. Citation extraction and antecedent-basis checking are also narrower than legal approval (A §4.1).

Concrete fix: Adopt an attorney-facing invariant: every emitted quotation and citation has verified source evidence; every attributed factual assertion has evidence or a visible unresolved flag; every proposed amendment carries an original-disclosure support assessment; original legal argument is labelled as proposed argument with linked authorities/premises and review status. Version the draft and bind approval to that revision. Let the attorney inspect support, uncertainty, and edits without requiring every prose sentence to become an epistemic claim.

## 14. Several “laws” are stronger application policies or tests, not standards guarantees

Severity: **major**.

Attacked: Draft L3 “skos:broader is acyclic”; L2 “merging two passes … never duplicates a target”; §6 “a law exists only if a property test … checks it”; L4 support/challenge DAG acyclicity.

Argument: [SKOS Reference §8.6.8](https://www.w3.org/TR/skos-reference/#L2413) explicitly permits hierarchical cycles as consistent SKOS data. Acyclicity may be a useful local profile, but calling it a SKOS law rejects legitimate imports. Set union deduplicates equal annotations, not all annotations sharing a target; two passes may disagree on body or boundaries. Legal rebuttal relations can also be reciprocal even if a chosen derivation graph must be acyclic. Finally, passing sampled property tests does not establish a formal proof or legal truth. Inference: these labels create false assurance at the very review seam the product is meant to clarify.

Concrete fix: Separate upstream conformance rules, local profile constraints, mathematical conjectures, and operational acceptance tests. Define equality before testing merge and retain competing interpretations. Prioritize hostile-text exact slicing, duplicate-occurrence distinction, source-drift refusal, unknown-source handling, matter isolation, approval revision binding, and no duplicate external writes. Add mathematical tests only where the production operation has a defined carrier and semantics.

## 15. A named graph or generic ScopeRef cannot carry the confidentiality boundary

Severity: **blocking**.

Attacked: Draft §3 “the matter wall is a named-graph boundary”; L4 `scope: ScopeRef` supplied by the slice; L7 cross-package agent contract.

Argument: This is an architectural inference, not a legal conclusion: graph names label data; they do not independently enforce read authorization. Content addressing, shared annotation sets, provenance traversal, vector retrieval, and caches can cross matter boundaries unless every access is scoped. Identical bytes must not grant access to another matter's copy or its metadata. The product vision requires matter walls and defines the graph as an index over canonical files. <file path="docs/PROSE_TO_PROOF_VISION.md" /> Citation doctrine explicitly rejects cross-matter anchors. <file path="docs/product/citation-grounding.md" /> The proposed generic type does not show how these checks survive joins or agent tools.

Concrete fix: Retain enforced matter authorization at source retrieval, anchor resolution, graph queries, search/vector filtering, cache lookup, draft assembly, and provenance traversal. Use matter-authorized handles even when bytes are deduplicated underneath. Add an adversarial two-matter fixture with identical content, distinct decisions, and forbidden cross-matter reads. Limit cross-matter conflict-check tools to an explicit minimal-data authorization policy.

## Smallest sequence that captures most of the value

1. Freeze current citation/source identity encodings. Add a small explicit binding table for published term IRIs so file moves cannot rename them. Keep runtime, external, content, occurrence, and decision identities distinct.
2. Carry existing SourceTextIdentity and verified-anchor receipts through the generic handoff, office-action mapper, docket evidence, and RDF projection or a durable resolver. Preserve both digests, matter, extractor/normalization pins, producer, attributes, and typed relations. Reverify after deserialization; declare intentional projection loss.
3. Remove fabricated 1/0.9 confidences. Introduce missing reasons and preserve measured alignment, model scores, deterministic workflow scores, and human dispositions separately. Change missing attachment text from “pass” to unknown/needs-review without suppressing urgent tentative docket entries.
4. Replace array-order occurrence IDs and first-match/fallback-zero anchors with version-bound exact occurrence identities. Test repeated claim language, repeated boilerplate, source drift, Unicode boundaries, cross-page text, and ambiguous matches. Keep quote matching as location assistance, not universal identity.
5. Connect one complete office-action/review flow with law-owned claim numbers/dependencies, page or paragraph pinpoints, source-linked rejection coverage, independent legal assessments, and version-bound attorney approval. Preserve the stronger existing OfficeActionStructure path. Use synthetic fixtures for repository tests and authorized private material only in the operational environment.
6. Connect one Outlook-to-review-to-tentative-calendar flow and one Box source retrieval. Prove authorization, durable evidence access, idempotent writes, replay, correction, and undo. Rank work by explicit urgency/risk policy; keep uncertain items visible.
7. Add a revision-bound drafting review view that distinguishes quotations, facts, proposed amendments, and original argument. Enforce ground-before-cite and require explicit attorney review of disclosure support and legal judgment. Confirm that every user-visible citation opens the right source occurrence.
8. Only then decide whether a new annotation package, selected ST.96/AKN/NIF adapters, bounded provenance export, or package rename removes demonstrated duplication. Leave DEC worlds, universal gUFO typing, semiring evidence propagation, full WEMI reconstruction, and a universal law/docgen framework deferred until a concrete consumer earns their cost.
