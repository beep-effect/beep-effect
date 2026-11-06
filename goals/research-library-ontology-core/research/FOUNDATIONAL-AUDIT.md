# Foundational audit: research library model set

The primary-seat analysis is the one the `ontology-foundational-auditor` skill
requires before the first T-Box emission (SPEC constraint "Phase vs kind").
Subject: the model set in [DESIGN.md](./DESIGN.md) §Schema layer, as
implemented in `Library.schemas.ts` on `feat/research-library-ontology-core`.
An independent adversary seat reviews this file; its review is recorded in
[FOUNDATIONAL-AUDIT-REVIEW.md](./FOUNDATIONAL-AUDIT-REVIEW.md).

## Scope of the run

This run is bounded on purpose. Here is how it differs from the skill's full
pipeline:

- Observations are the declarations in `Library.schemas.ts`, read from source at
  the lane head. No adapter script or bubblewrap sandbox was used. Every model
  is a hand-reviewed `S.Class`/`LiteralKit` declaration, and the T-Box is
  generated from these same declarations, so drift between observation and
  emission cannot happen. `fold` reads the classes it emits.
- Steward ratification is replaced by an agent decision under the operator
  autonomy charter of 2026-10-06 (`AGENTS.md` §Autonomy). The verdicts are
  recorded as a decision file that names how to reverse them. The operator
  reviews asynchronously.
- Competency questions come from `explorations/research-library-ontology/BRIEF.md`:
  CQ1 asks which sources at hop N are readable, incomplete or tool-blocked. CQ2
  asks which findings are relevant to a live goal or exploration packet. CQ3 asks
  what a finding derives from and at which hop. CQ4 asks which model run, at which
  pin, produced a finding. CQ5 asks which records are private and stay out of
  render output.

## Verdicts

| Symbol | Null hypothesis | Category | Identity criterion | Rigidity | T-Box consequence |
| --- | --- | --- | --- | --- | --- |
| `LibrarySource` → `Source` | Rejected: the CQ1/CQ3 counts are per cited work, not per record row. | Kind (information artifact: the cited work, at FRBR Expression level) | Canonical `identity` string together with `kind`. `aliasIds` record identities that resolved to the same work. | Rigid | `Source ⊑ prov:Entity`. It is not a FaBiO subclass: the kinds are mixed (see `LibrarySourceKind`). |
| `LibrarySourceVersion` → `SourceVersion` | Rejected: captures and verification are per revision (CQ1). | Kind. Existentially dependent on one `Source`. It is a snapshot, not a phase of the source. | (`Source` identity, `revision`) | Rigid. A version never becomes another revision. | `SourceVersion ⊑ prov:Entity`, linked to its Source by `prov:specializationOf`. It is **not** `⊑ Source` (snapshot-is-continuant guard). |
| `LibraryCapture` → `Capture` | Rejected: CQ1 dispositions belong to capture attempts. | Information artifact recording one acquisition execution | Capture `id`, minted per attempt (source, method, `recordedAt`) | Rigid | `Capture ⊑ prov:Entity`. The acquisition run is a `prov:Activity`, and the route `method` is the `prov:Plan`, so spec and execution stay apart. |
| `LibraryCaptureStatus` members | Not classes | Phase (anti-rigid, intrinsically conditioned on the attempt's outcome) | n/a | Anti-rigid | A controlled vocabulary: `skos:Concept` members and `sh:in` on `Capture.status`. **No OWL subclasses** (state-is-kind guard). |
| Effective categories (`readable`, `incomplete`, `tool-blocked`, ...) | Not classes | A derived assessment that holds only relative to evidence at verification time | n/a | Anti-rigid, time-indexed | A literal on the projected source/version claim, re-derived on every projection. Never asserted as a timeless fact or a class (current-state timelessness guard). `missing` is a closed-world reading valid only against the intake census snapshot (negative-inference closure). |
| `LibraryArtifact` → `Artifact` | Rejected: verification binds bytes. | Information artifact (immutable bytes) | `sha256`. Here the identifier does settle identity, because the referent is the byte string. | Rigid | `Artifact ⊑ prov:Entity`. **`dcat:Distribution` alignment rejected.** An artifact is the bytes of a capture, not a representation of the catalog dataset. DCAT is kept for `Catalog`. |
| `LibraryDocument` → `Report` | Rejected: reports are the hop-0 inputs. | Kind (information artifact) | Snapshot `sha256` (`id` is its handle) | Rigid | `Report ⊑ prov:Entity`, `Report ⊑ fabio:Report` |
| `LibraryOccurrence` → `Occurrence` | Rejected: CQ3 hop-0 derivation begins at a citation site. | Relator mediating one `Report` and one `Source`, with its own properties (span, label, form) | (`documentId`, position span) | Rigid | `Occurrence ⊑ cito:Citation`. Kept reified, never flattened to a binary `cites` edge. |
| `LibraryFinding` → `Finding` | Rejected: CQ2 and CQ4. | Information artifact: a claim made by a reading, not a fact about the world | `id` | Rigid | `Finding ⊑ prov:Entity`. `citoRelation` constrained by `sh:in` over the CiTO local names. Relevance is `skos:related` to a packet concept. A finding is evidence, not truth (evidence-is-truth guard). |
| `LibraryDerivation` → `Derivation` | Rejected: CQ3. | Relator reifying `prov:wasDerivedFrom` | `id`; (`derivedId`, `sourceId`) | Rigid | `Derivation ⊑ prov:Derivation`. `hopDepth` is a datatype property **of the edge**, never a class. **It is context-dependent:** hop N holds relative to one hop-0 anchor, so the edge carries `intakeId`, the context the depth is measured from. |
| `LibraryModelRun` → `ModelRun` | Rejected: CQ4. | **Execution**, a dated occurrence | `id` (model, effort, route, `startedAt`) | Rigid | **`ModelRun ⊑ prov:Activity`, not `prov:SoftwareAgent`.** DESIGN.md's first table had a spec/execution merge. The agent is the pinned model plus effort, a repeatable specification. The projection mints one `prov:SoftwareAgent` node per (model, effort) and links each run with `prov:wasAssociatedWith`. |
| `LibraryCatalog` → `Catalog` | Rejected: it is the dataset being validated. | Information artifact (collection) | Catalog file path within a library root | Rigid | `Catalog ⊑ dcat:Dataset`. The `library.json` file is its `dcat:Distribution`, asserted in the A-Box. |
| `LibraryAccessClass` | Not a class | An assigned classification. It can change, for example private to public on release. | n/a | Anti-rigid | `skos:ConceptScheme` with `public`/`private` concepts, and `sh:in` on `accessClass`. |
| `LibrarySourceKind` | Not classes | A mixed vocabulary: medium kinds (`paper`, `github-repository`), an ownership value (`internal`) and an epistemic state (`unresolved`) | n/a | Mixed | A controlled vocabulary only (`sh:in`). It must not become subclasses: `unresolved` names what we know, not what the source is. Splitting it is recorded as an open issue (no data change in this packet). |
| `LibraryOwnership` | Not classes | Role-like: external or project relative to beep-effect | n/a | Anti-rigid, relational | A controlled vocabulary (`sh:in`) |
| `LibraryQualificationStatus` | Not classes | Outcome phase of a route probe | n/a | Anti-rigid | A controlled vocabulary (`sh:in`) |
| `LibraryQualification`, `LibraryIntake`, `LibraryIntakeFile`, `LibraryIntakeRoot`, `LibraryReference`, `LibraryManifest` | Rejected (records the CQs read through) | Information artifacts (records of probe or intake executions) | `id` / `sha256` / path | Rigid | `⊑ prov:Entity`. They are emitted in the T-Box so SHACL can cover the whole catalog. |
| `LibraryInventoryOptions`, `LibraryAcquireOptions` | **Accepted: no domain referent** | Command input DTOs | n/a | n/a | **Excluded from the fold** and from SHACL. They are CLI options, not library knowledge. |

## Consequences for the implementation

1. `ModelRun` aligns to `prov:Activity`. The projection mints the
   `prov:SoftwareAgent` model-pin nodes.
2. `Artifact` drops the `dcat:Distribution` alignment.
3. `LibraryDerivation` gains `intakeId`, the hop-0 anchor `hopDepth` is measured
   from.
4. `SourceVersion` is never a subclass of `Source`. Phases and vocabularies
   become `sh:in` constraints and SKOS concepts, never OWL classes.
5. Option DTOs stay out of the fold.

## Open issues

- `LibrarySourceKind` mixes medium, ownership and epistemic state. A later
  packet can split `unresolved` out into a resolution-status field. This audit
  only blocks it from becoming a taxonomy.

## Revision r2: answers to the adversary review

The adversary seat ([FOUNDATIONAL-AUDIT-REVIEW.md](./FOUNDATIONAL-AUDIT-REVIEW.md))
returned FAIL. Each revision request is answered below. The ones marked
**changed** are fixed in `Library.schemas.ts` in this packet. The ones marked
**open** stay `insufficient evidence` and name what would decide them. Nothing
is dropped silently.

| Request | Disposition |
| --- | --- |
| R1 source identity across aliases, relocations and resolution changes | **Open.** No catalog consumer in this packet decides sameness beyond `identity` plus `aliasIds`. The identity criterion is downgraded from asserted to *operational*: two records denote one Source iff the resolver gave them the same canonical `identity`. Needed evidence: a false-merge/false-split fixture set from the hop-1 acquisition packet (`research-library-routes`). |
| R2 per-term identity analyses; hash as practical assumption | **Changed in wording.** For Artifact, "same sha256 ⇒ same bytes" is stated as a collision-resistance *assumption*. `Artifact.role` and `path` are **contextual uses of bytes inside one capture**, not intrinsic properties. The projection mints the artifact node per (capture, sha256), not per sha256 alone, so one byte string can play different roles in different captures. |
| R3 the phase blanket over status, effective category, ownership, access | **Partly changed.** The row now separates three things. Capture `status` is the attempt's *terminal result*. Effective category is an *epistemic assessment* indexed to a verification run. `LibraryOwnership` (external, project, internal, unresolved) is *relational classification*, and `unresolved` is an epistemic value. All of them stay controlled vocabularies (`sh:in`), not classes. The adversary's own counterexamples support that, because none of them argues for subclasses. Cross-field coherence (`status=readable` with `complete=false`) is **open**. Needed evidence: a SHACL-SPARQL coherence rule plus a census of the existing 1577 captures, to check that adding it would not reclassify valid October captures. |
| R4 run, agent and plan distinctness; Report and Citation typing | **Kept, with evidence moved to the T-Box tests.** ModelRun is the execution (`prov:Activity`). The model pin (model, effort) is the `prov:SoftwareAgent` node. Acquisition `method` is the route specification. `fabio:Report` is kept only for intake *documents*, not for bare link lists: the brief's link lists enter as Reports whose occurrences are their links. Typing them `fabio:Report` is the counterexample, so **Report ⊑ fabio:Report is weakened to Report ⊑ prov:Entity**, with `fabio:Report` asserted per instance only when `kind` is a dated nightly report. That needs a document-kind field, which is **open**. In this packet the subclass alignment to `fabio:Report` is dropped. Citation typing stays: Occurrence is the citation *site* reified as `cito:Citation` (one citing document, one cited source per occurrence). A site that cites several targets is several occurrences. |
| R5 failed null discriminators | **Changed.** The discriminator for every kept term is now the competency question whose answer *changes* if the term is removed: CQ1 needs Capture and SourceVersion, CQ2 needs Finding, CQ3 needs Derivation and Occurrence, CQ4 needs ModelRun, CQ5 needs accessClass. Intake, IntakeFile, IntakeRoot, Reference and Manifest have no CQ that changes. They are **kept as support terms for SHACL coverage only** (they serve Report and Capture integrity) and get no external alignment beyond `prov:Entity`. |
| R6 term-specific warrants; omitted symbols | **Changed.** `LibraryCatalogSchemaVersion` and `LIBRARY_VALIDATOR_CONTRACT` name specifications, so they are not classes; they are literals on the catalog node and in the migration receipt. `LibraryCitoRelation` is a controlled vocabulary of CiTO *object-property local names*. Its argument semantics are the CiTO ones: the citing entity is the Finding's reading and the cited entity is the Source. |
| R7 depth anchor and finding applicability | **Changed.** `LibraryDerivation` gains `rootId`, the hop-0 report the path starts from, next to `intakeId`. Convention: `hopDepth` is the depth of `derivedId` on the path anchored at `rootId`, and the parent has depth `hopDepth - 1`. One entity can have several Derivation edges with different roots and depths, so there is no shortest-path collapse. `LibraryFinding` gains `captureId` (empty when not yet bound), which ties a finding to the bytes that were read. |
| R8 evidence for consequences outside the schema | **Answered by tests.** The lane B2 ontology tests assert `ModelRun ⊑ prov:Activity`, that `SourceVersion ⊑ Source` is absent, that no OWL class exists for any status literal, that `sh:in` is present, and that the fold input list excludes the option DTOs. They also include a must-fail SHACL fixture. These are the positive witnesses and counterexamples. |
| R9 census closure, expected counts, privacy propagation | **Partly changed.** `LibraryDocument` gains `accessClass`: private reports such as the DM archives are documents, and they were not covered. Render excludes private documents and their occurrences. A private finding or occurrence inherits the partition of its document or source (`private` wins on conflict). The projection and views apply this. `missing` closure is scoped to one intake census (its `inputRoots` and `files` list) and is not world-closed. The provenance of `expectedOccurrences` is **open**. Needed evidence: the inventory parser version that produced the count. |
| R10 authority | **Stated.** Acceptance here is an autonomous, reversible agent decision under the 2026-10-06 operator charter. It is **not** named-human ratification. The operator reviews asynchronously and can reverse any row through the decision file. |
