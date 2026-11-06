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
