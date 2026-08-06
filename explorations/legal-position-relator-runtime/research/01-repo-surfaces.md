# Lane A — repo composition surfaces

**Provenance:** Lane A of the research-depth decision
(`explorations/legal-position-relator-runtime/DECISIONS.md:18-59`); live-tree
reads plus source-only `rg`; no external sources; no client or pre-publication
material. Every path:line below was opened in this session.

Two surface classes are labelled throughout, inheriting the sibling wedge's
convention (`explorations/patent-citation-candor-gate/research/01-repo-surfaces.md:1-8`):

- **LIVE SOURCE** — code under `packages/**/src` the first rung may compose now.
- **SPEC CONTRACT** — a `goals/*/SPEC.md` promise this wedge binds to but must
  not implement, adapt, amend, or fork. This is the packet's locked dependency
  posture (`explorations/legal-position-relator-runtime/DECISIONS.md:61-83`).

Nothing in this file is a schema or implementation proposal. Statements about
future shape are limited to naming an existing placement or an absence.

## 2026-08-05

## 1. Taxonomy foundation — `@beep/ontology`

**Surface class: LIVE SOURCE.** Package name is `@beep/ontology`
(`packages/foundation/modeling/ontology/package.json:2`). Note a live naming
collision that matters for align: a *different* package `@beep/ontology-domain`
exists at `packages/ontology/domain/package.json:2` under the `ontology` slice
family. This lane inventories only the foundation package.

Source inventory (11 files, 4,434 lines):

```text
find packages/foundation/modeling/ontology/src -type f -name '*.ts' | sort
```

### `LiteralKit` domains

The package's live closed vocabularies, all built with `LiteralKit` per repo
law:

| Vocabulary | Members | Location |
| --- | --- | --- |
| `DocumentClass` | `draft`, `redline`, `filed`, `received`, `privileged`, `extracted-child` | `packages/foundation/modeling/ontology/src/SemanticFoundation.models.ts:98-109` |
| `SkosMappingKind` | `exactMatch`, `closeMatch` | `packages/foundation/modeling/ontology/src/SemanticFoundation.models.ts:140-144` |
| `FilingRootKind` | `local-vault`, `box-mirror` | `packages/foundation/modeling/ontology/src/SemanticFoundation.models.ts:239-243` |
| `VendorLoadStatus` | `VETTED`, `UNVETTED` | `packages/foundation/modeling/ontology/src/TaxonomyLoader.ts:58-60` |
| `SkosClassification` | `concept`, `conceptScheme` | `packages/foundation/modeling/ontology/src/Fold.models.ts:312-316` |
| `AssembledPredicateKind` | `datatype`, `object` | `packages/foundation/modeling/ontology/src/Fold.models.ts:351-355` |
| `MarkdownLinkMode` | `portable`, `obsidian` | `packages/foundation/modeling/ontology/src/Fold.markdown.ts:45` |
| `SourceType`, `HealthStatus` | FOLIO API mirror vocabularies | `packages/foundation/modeling/ontology/src/Ontology.models.ts:50`, `:227` |

The complete list was produced by:

```text
rg -n "LiteralKit\(" packages/foundation/modeling/ontology/src/
```

The two error-reason vocabularies `OntologyWarningCode` and
`OntologyAssemblyErrorReason` are also `LiteralKit`
(`packages/foundation/modeling/ontology/src/Fold.models.ts:556`, `:664`).

**No legal-position vocabulary exists here.** Nothing in the package names a
right, duty, privilege, power, liability, immunity, no-right, or disability.
See section 8.

### SKOS mapping kinds and alignment

`SkosMappingKind` is exactly two members
(`packages/foundation/modeling/ontology/src/SemanticFoundation.models.ts:140-144`).
It is consumed by `ConceptAlignment`, whose three fields are `conceptIri`,
`kind`, and `sourceIri`
(`packages/foundation/modeling/ontology/src/SemanticFoundation.models.ts:181-190`).
That is the complete external-alignment surface: an alignment records *this
repo-owned concept maps to that external IRI by exactMatch or closeMatch*, and
nothing else. There is no `broadMatch`, `narrowMatch`, `relatedMatch`, no
mapping justification, no vetting provenance on the alignment row itself, and
no inverse or correlative predicate.

### `TaxonomySeed` shape

`TaxonomyConcept` has exactly seven fields: `alignments` (array of
`ConceptAlignment`), `broader` (array of `IRIReference`), `definition`
(non-empty string), `documentClasses` (array of `DocumentClass`),
`filingSegment`, `iri`, and `prefLabel`
(`packages/foundation/modeling/ontology/src/SemanticFoundation.models.ts:211-224`).
Hierarchy is `broader`-only — there is no `narrower`, no `related`, and no
declared inverse; the narrower view is not stored.

`TaxonomySeed` has exactly five fields: `concepts`, `filingRoots`,
`pathTemplateSegments`, `schemeIri`, and `title`
(`packages/foundation/modeling/ontology/src/SemanticFoundation.models.ts:287-296`).
`FilingRoot` carries `iri`, `kind`, `rootSegment`
(`packages/foundation/modeling/ontology/src/SemanticFoundation.models.ts:271-274`),
and `FilingSegment` is a path-traversal-safe non-empty string
(`packages/foundation/modeling/ontology/src/SemanticFoundation.models.ts:41-52`).

The committed seed is one scheme titled "Legal intake taxonomy" with nine
concepts (`packages/foundation/modeling/ontology/src/SemanticFoundation.seed.ts:49`,
`:138-139`; `rg -c "TaxonomyConcept.make"` returns 9). It is an *intake filing*
taxonomy, not a legal-relation ontology.

### `TaxonomyLoader` registry

`TaxonomyLoader` is a live `Context.Service` with a single `load(manifestPath,
vendorRoot)` operation returning a `TaxonomySeed`
(`packages/foundation/modeling/ontology/src/TaxonomyLoader.ts:244-261`), and a
`Layer.succeed` implementation requiring only `FileSystem.FileSystem`
(`packages/foundation/modeling/ontology/src/TaxonomyLoader.ts:271-293`).

Its discipline is fail-closed and worth naming because the Hohfeld scheme would
ride on it:

- A manifest row is `VendorManifestEntry { format: "jsonld", id, loadStatus,
  path }` (`packages/foundation/modeling/ontology/src/TaxonomyLoader.ts:83-86`).
- `UNVETTED` slices fail with `VendorSliceUnvetted` before any read
  (`packages/foundation/modeling/ontology/src/TaxonomyLoader.ts:207-208`).
- `VendorSlicePath` rejects traversal at decode time
  (`packages/foundation/modeling/ontology/src/TaxonomyLoader.ts:36-47`), and a
  realpath containment check rejects escapes at read time
  (`packages/foundation/modeling/ontology/src/TaxonomyLoader.ts:209-224`).
- Six typed errors cover manifest read/parse, unvetted, slice read/parse, and
  path escape
  (`packages/foundation/modeling/ontology/src/TaxonomyLoader.ts:97-191`).
- `load` appends vendor concepts and filing roots onto the committed seed but
  keeps the committed seed's `schemeIri`, `title`, and `pathTemplateSegments`
  (`packages/foundation/modeling/ontology/src/TaxonomyLoader.ts:279-291`).

The pure projection side is `runLibrarianLoop`, which resolves a concept by IRI
equivalence, fails with `TaxonomyConceptNotFound` or `UnsupportedDocumentClass`,
and returns projected filing paths
(`packages/foundation/modeling/ontology/src/TaxonomyRegistry.ts:126-153`,
`:84-108`). There is no derived-view machinery beyond path projection.

### Where an inverse/correlative view exists today (and where it does not)

Three near-misses, all of which must be distinguished from a Hohfeldian
correlative:

1. `OWLObjectProperty.inverse_of` (`owl:inverseOf`) exists at
   `packages/foundation/modeling/ontology/src/Ontology.models.ts:531-538`, on
   the class at `:491`. That file is explicitly the **FOLIO OpenAPI component
   mirror** (`packages/foundation/modeling/ontology/src/Ontology.models.ts:2`).
   It is a decoded upstream field, not a repo-owned correlativity primitive, and
   nothing derives a view from it.
2. `Triple` predicates may be reverse-marked with `^` (SPARQL inverse-path
   syntax) (`packages/foundation/modeling/ontology/src/Fold.models.ts:138-155`),
   and the assembly walk carries a `reverse` flag
   (`packages/foundation/modeling/ontology/src/Fold.assembly.ts:284-287`). This
   is emission direction for one fact, not a paired-position derivation.
3. The JSON-LD/OWL projection emits `owl:ObjectProperty` or
   `owl:DatatypeProperty` by inferred kind
   (`packages/foundation/modeling/ontology/src/Fold.projections.ts:342`). No
   `owl:inverseOf` is emitted by the fold.

**NOT FOUND:** any repo-owned correlative-pair primitive, bimap, or derived
opposite-view combinator in `@beep/ontology`.

## 2. Bitemporal substrate — `EdgeVersion`

**Surface class: LIVE SOURCE. Substrate, never widened**
(`explorations/legal-position-relator-runtime/CAPTURE.md:141-143`).

`EdgeVersion` is a `BaseEntity.Class` with 21 domain fields plus inherited base
fields (`packages/epistemic/domain/src/entities/EdgeVersion/EdgeVersion.model.ts:106-237`;
field block `:109-164`). Its module doc states both axes are half-open BIGINT
epoch millis with `Option.none` open ends, no sentinel dates, and no persisted
`isLatest` flag — "latest" is a question asked of the axes
(`packages/epistemic/domain/src/entities/EdgeVersion/EdgeVersion.model.ts:1-13`).
It carries an explicit Graphiti derivation notice (Apache-2.0, reimplemented,
no upstream source copied)
(`packages/epistemic/domain/src/entities/EdgeVersion/EdgeVersion.model.ts:16-25`).

The four substrate properties this wedge composes:

| Property | Fields | Location |
| --- | --- | --- |
| Binary endpoints, flattened per kind | `sourceKind`/`sourceClaimId`/`sourceEntityRef`/`sourceEvidenceId`/`sourceObservationRef` and the target mirror | `.../EdgeVersion.model.ts:128-156` |
| Immutable fact | `fact: UnknownRecord`, persisted jsonb | `.../EdgeVersion.model.ts:116`, `:172-174` |
| Valid time | `validFrom` (inclusive) / `validTo` (exclusive, `Option`) | `.../EdgeVersion.model.ts:157-162` |
| Transaction time | `recordedAt` (inclusive) / `expiredAt` (exclusive, `Option`) | `.../EdgeVersion.model.ts:113-115`, `:124-126` |
| Supersedes lineage | `supersedesId: Option<EdgeVersionId>` self-reference | `.../EdgeVersion.model.ts:141-143` |
| Monotonic version | `version: PosInt` | `.../EdgeVersion.model.ts:163` |

Endpoint flattening/unflattening is total and fails to `Option.none` when kind
and reference columns disagree, so a row escaping the CHECK constraint surfaces
as absence rather than a fabricated endpoint
(`packages/epistemic/domain/src/entities/EdgeVersion/EdgeVersion.model.ts:310-340`,
`:408-415`).

**The edge is strictly binary.** `EdgeEndpoint` has exactly four kinds —
`claim`, `evidence`, `entity`, `observation`
(`packages/epistemic/domain/src/entities/EdgeVersion/EdgeVersion.model.ts:311-339`),
and exactly one source and one target exist per row. There is no third role
slot, no role-typed participant, and no arity beyond two.

### Relation vocabulary and the one live "derived opposite view"

`EdgeRelation` is exactly `supports`, `refutes`, `contradicts`
(`packages/epistemic/domain/src/values/EdgeRelation/EdgeRelation.model.ts:13`,
schema at `:31-36`).

`SymmetricEdgeRelation` is the `contradicts`-only subset
(`packages/epistemic/domain/src/values/EdgeRelation/EdgeRelation.model.ts:54`).
Its documentation states that an edge carrying a symmetric relation "denotes the
same logical claim regardless of which endpoint is recorded as source", and the
logical-edge digest uses this subset to collapse both orderings onto one key
(`packages/epistemic/domain/src/values/EdgeRelation/EdgeRelation.model.ts:56-61`).

The collapse is implemented in `orderEndpoints`, which sorts the two encoded
endpoints only when the relation is symmetric and never swaps otherwise
(`packages/epistemic/domain/src/values/LogicalEdgeIdentity/LogicalEdgeIdentity.model.ts:323-337`).
That feeds a versioned injective canonical encoding
(`.../LogicalEdgeIdentity.model.ts:340-368`, version prefix at `:27-30`) whose
SHA-256 is `LogicalEdgeKey` (`.../LogicalEdgeIdentity.model.ts:211`, `:408`).
`LogicalEdgeIdentity` itself carries endpoints, relation, org/matter/evidence
scopes, and free-string qualifiers, with time deliberately absent
(`.../LogicalEdgeIdentity.model.ts:266-283`).

**This is the closest live precedent to T1-F1's invariant, and it is not the
same thing.** Symmetry collapses two *presentations* of one relation onto one
stored key. Hohfeldian correlativity pairs two *differently named positions*
held by two different parties (right↔duty, privilege↔no-right, power↔liability,
immunity↔disability). No live surface derives a differently-named counterpart
position from a stored one. The repo has the *mechanism shape* (derive at
encode/read time; store once) without the *vocabulary*.

## 3. Append-only authority — `EdgeAuthority`

**Surface class: LIVE SOURCE.**

`EdgeAuthorityRepositoryShape` is exactly four operations: `readAsOf`,
`readLatest`, `record`, `supersede`
(`packages/epistemic/use-cases/src/EdgeAuthority/EdgeAuthority.ports.ts:60-67`),
exposed as a `Context.Service`
(`packages/epistemic/use-cases/src/EdgeAuthority/EdgeAuthority.ports.ts:100-102`).

The port's own documentation states the contract *is* what it omits
(`packages/epistemic/use-cases/src/EdgeAuthority/EdgeAuthority.ports.ts:20-39`),
verbatim:

- "There is no update surface for `supersedesId`. Lineage is written once, when
  a replacement row is inserted, and no operation here can rewrite it"
- "There is no update surface for `fact` either. A fact payload is immutable;
  correcting a belief means superseding it, so the record of what was once
  believed survives the correction."
- "There is no delete surface at all. History is the product."
- "`supersede` closes the head and inserts the replacement inside ONE
  transaction. A caller can never observe an edge with two open heads or with
  none, and a failure leaves the head exactly where it was."
- "`readAsOf` answers on both axes; `readLatest` is the same predicate asked at
  now/now, not a separate 'current' table or an `isLatest` flag."

The commands: `RecordEdgeFact`
(`packages/epistemic/use-cases/src/EdgeAuthority/EdgeAuthority.commands.ts:160-165`),
`SupersedeEdgeFact` with an optimistic `expectedVersion` head claim
(`.../EdgeAuthority.commands.ts:167-187`, class at `:236-241`), and the two-axis
`EdgeAsOfQuery { knownAt, logicalKey, validAt }`
(`.../EdgeAuthority.commands.ts:268-283`).

One correction-semantics rule is stated in the source and is directly load-bearing
for the wedge's carried cluster: on a supersession, `validTo` "carries the valid
time of the INVALIDATING fact — never the wall clock at which the correction was
made… a belief that stopped being true at noon stopped being true at noon, no
matter when anyone noticed"
(`packages/epistemic/use-cases/src/EdgeAuthority/EdgeAuthority.commands.ts:189-203`).

**Citation qualification.** The routing seed cites
`EdgeAuthority.ports.ts:3-34` for "makes correction additive and keeps
supersession separate from detection"
(`explorations/legal-patent-kg-deepening/ROUTING-SEED.md:105`). Lines 1-34 do
establish immutability, no-update, and no-delete; the one-transaction
close-and-insert sentence runs to `:36`. But *separation from detection* is not
stated anywhere in this file — it is a SPEC-level constraint
(`goals/epistemic-contradiction-triage/SPEC.md:15-17`, `:64-65`). Cite both.

## 4. Party, Role, and principal surfaces

**Surface class: LIVE SOURCE.** This section grounds the T4-F6 generic-vs-legal
split question (`explorations/legal-position-relator-runtime/ops/manifest.json:12`).

### `RuntimeApprovalGate` and its neighbours

`RuntimeApprovalGate` has exactly eight fields: `approvalGateId`,
`candidateRefs` (array of bare non-empty strings), `decision`, `evidence`,
`lifecycle`, free-text `policyBasis`, `requestedActions` (array of bare
non-empty strings), and `reviewerPrincipalId`
(`packages/agents/use-cases/src/processes/ProfessionalRuntime/ProfessionalRuntime.contracts.ts:473-491`).

`RuntimeCandidateDraft` has exactly ten fields including
`producedByPrincipalId` and `requiresApproval`
(`packages/agents/use-cases/src/processes/ProfessionalRuntime/ProfessionalRuntime.contracts.ts:428-446`).

The vocabularies remain single-member first-proof placeholders:

- `RuntimeCandidateLifecycle` = `["candidate"]`
  (`.../ProfessionalRuntime.values.ts:65-85`)
- `RuntimeApprovalDecision` = `["pending"]`
  (`.../ProfessionalRuntime.values.ts:139-159`)
- `RuntimeActivityType` = `["artifact_ingested", "candidate_work_proposed"]`
  (`.../ProfessionalRuntime.values.ts:250-270`)
- `RuntimeUsageMode` = `["deterministic_fixture"]`
  (`.../ProfessionalRuntime.values.ts:287-307`)

### `RuntimePrincipalId` is a bare string, not a Party

`RuntimePrincipalId` is a module-private `S.NonEmptyString`
(`packages/agents/use-cases/src/processes/ProfessionalRuntime/ProfessionalRuntime.contracts.ts:83-87`).
It is not exported, not branded to any entity id, and carries no kind
discriminator. Every principal-bearing runtime field uses it:
`producedByPrincipalId` on claims (`:263-264`) and drafts (`:436-438`),
`assigneePrincipalId` on tasks (`:345-346`), `reviewerPrincipalId` on the gate
(`:486`), `principalId` on activity (`:615`), and the `principals` array on a
context packet (`:751-752`). The full enumeration came from:

```text
rg -n -i "principal|party|role|actor" packages/agents/use-cases/src/processes/ProfessionalRuntime/ProfessionalRuntime.contracts.ts
```

**There is no `Role` field anywhere in the ProfessionalRuntime contracts.** The
scope tuple is tenant/workspace/thread only
(`RuntimeScope { organizationId, threadId, workspaceId }`,
`.../ProfessionalRuntime.contracts.ts:147-160`).

The SDK facade is two operations, `getContextPacket` and
`proposeCandidateOutputSet`
(`packages/agents/use-cases/src/processes/ProfessionalRuntime/ProfessionalRuntime.service.ts:29-45`).

`RuntimeApprovalGate` still has **zero consumers outside its own directory**:

```text
rg -n "RuntimeApprovalGate" packages apps --glob '**/src/**/*.{ts,tsx}' | grep -v ProfessionalRuntime
```

returns 0 lines, reconfirming the sibling goal's claim
(`goals/patent-citation-candor-gate/SPEC.md:137-144`) as of today.

### The canonical `Principal` union (the real actor identity)

`Principal` is a five-member tagged union discriminated on `kind`
(`packages/shared/domain/src/entity/Principal.ts:244-256`):

| Variant | Fields | Location |
| --- | --- | --- |
| `UserPrincipal` | `kind: "User"`, `userId` | `packages/shared/domain/src/entity/Principal.ts:75-83` |
| `ServiceAccountPrincipal` | `kind`, `serviceAccountId`, optional `onBehalfOfUserId` | `.../Principal.ts:104-120` |
| `AgentPrincipal` | `kind`, `agentId`, `agentVersionId`, required `onBehalfOfUserId`, optional `onBehalfOfTeamId` | `.../Principal.ts:143-159` |
| `ConnectorAccountPrincipal` | `kind`, `connectorAccountId`, optional `onBehalfOfUserId` | `.../Principal.ts:180-196` |
| `SystemPrincipal` | `kind`, `component` | `.../Principal.ts:215-223` |

`SystemComponent` = `Runtime`, `Sync`, `Migration`, `Policy`, `Generator`
(`packages/shared/domain/src/entity/Principal.ts:14`).

Every persisted entity carries `createdByPrincipal: Principal` and
`updatedByPrincipal: Principal` through `BaseEntity.fields`
(`packages/shared/domain/src/entity/BaseEntity.ts:80-89`), each persisted as
jsonb with `valueStrategy: "providedByContext"`
(`packages/shared/domain/src/entity/BaseEntity.ts:104-131`).

This is **persistent actor identity with an on-behalf-of chain** — it is *not*
a legal Party, and it carries no context-specific role. `AgentPrincipal` does
model delegation (`onBehalfOfUserId`/`onBehalfOfTeamId`), which is the nearest
live analogue of authority-derivation, but it is technical attribution, not
legal capacity.

### `Membership.Role` — the only shared Role vocabulary

`Role` is exactly `["owner", "member"]`
(`packages/shared/domain/src/entities/Membership/Membership.values.ts:13`,
schema at `:29-38`). `Status` is `["active"]` (`:14`, `:69-78`). The
`Membership` entity has exactly three domain fields — `role`, `status`,
`userId` — scoped by the inherited `orgId`
(`packages/shared/domain/src/entities/Membership/Membership.model.ts:32-56`).

This is an organization-membership role, not a context-specific legal role.
The sibling goal already recorded the consequence as binding: "no
attorney/practitioner role exists anywhere in the repo (`Membership.Role` is
`owner`/`member`)" and an authorization service "is a named follow-on"
(`goals/patent-citation-candor-gate/SPEC.md:210-214`).

### The nearest live "party-like" entities (law-practice)

| Entity | Domain fields | Vocabulary | Location |
| --- | --- | --- | --- |
| `LegalClient` | `displayName`, `fixtureKey`, `status` | `LegalClientStatus` = `["active_client"]` | `packages/law-practice/domain/src/entities/LegalClient/LegalClient.model.ts:47-57`; `.../LegalClient.values.ts:13`, `:30` |
| `LegalContact` | `displayName`, `fixtureKey`, `legalClientFixtureKey`, `role` | `LegalContactRole` = `["founder"]` | `packages/law-practice/domain/src/entities/LegalContact/LegalContact.model.ts:48-61`; `.../LegalContact.values.ts:13`, `:30` |
| `Matter` | `displayName`, `fixtureKey`, `legalClientFixtureKey`, `matterType` | `MatterType` = `["patent_application"]` | `packages/law-practice/domain/src/entities/Matter/Matter.model.ts:48-61`; `.../Matter.values.ts:13`, `:30` |

`LegalContact.role` is the single live example of a *context-specific* role
attached to a party-like entity — one literal, `founder`, scoped to one client.
Its linkage is by `fixtureKey` text, not entity id.

A repo-wide word search for a `Party` concept:

```text
rg -n -i "\bParty\b" packages --glob '**/src/**/*.{ts,tsx}'
```

returns only *party-name* string fields inside citation values
(`packages/law-practice/domain/src/values/Citation/Citation.models.ts:409`,
`:417`, `:424`, `:432`, `:440`, `:448`;
`packages/law-practice/domain/src/values/DocketCitation/DocketCitation.model.ts:99-113`)
and unrelated "third-party" prose. **A `Party` entity is NOT FOUND.**

## 5. Append-only service precedent — `ExecutionLedger` and neighbours

**Surface class: LIVE SOURCE.**

`ExecutionLedgerShape` is exactly five operations — `appendDecision`,
`appendOutcome`, `readDecisions`, `readOutcomes`, `readUnsettledAllowed`
(`packages/epistemic/use-cases/src/ExecutionLedger/ExecutionLedger.ports.ts:61-73`),
exposed as a `Context.Service`
(`packages/epistemic/use-cases/src/ExecutionLedger/ExecutionLedger.ports.ts:108`).

The header states the discipline verbatim: "deliberately append-and-read only:
there is no update, no delete, and no way to express either", and chain
verification lives in the domain "so a lying adapter cannot vouch for its own
chain"
(`packages/epistemic/use-cases/src/ExecutionLedger/ExecutionLedger.ports.ts:1-15`).
The write-ahead ordering is explicit: `appendDecision` runs *before* the effect
and converts failure into refusal; `appendOutcome` settles afterwards and its
failure cannot fail the dispatch "because the effect has already happened";
`readUnsettledAllowed` is scoped to allowed decisions because "a refused
dispatch legitimately has no outcome row"
(`packages/epistemic/use-cases/src/ExecutionLedger/ExecutionLedger.ports.ts:29-39`).

### Attempted-vs-ineffective is already representable (technically)

Three live vocabularies together express *decided but not done*:

- `ExecutionVerdict` is an `allowed`/`denied` tagged union
  (`packages/epistemic/domain/src/values/ExecutionVerdict/ExecutionVerdict.model.ts:193`,
  `:216`), with a `DenialReason` domain split into evaluator and boundary
  subsets (`.../ExecutionVerdict.model.ts:40`, `:91`, `:118`) and per-reason
  guidance (`.../ExecutionVerdict.model.ts:135`).
- `ExecutionSettlement` = `["completed", "failed", "interrupted"]`
  (`packages/epistemic/domain/src/values/ExecutionRecord/ExecutionRecord.model.ts:263`),
  carried by `ExecutionOutcomeRecord` (`.../ExecutionRecord.model.ts:421`).
- Chain integrity is `["chain-intact", "chain-broken"]`
  (`.../ExecutionRecord.model.ts:569`).

So "an act that was attempted, permitted, and then failed" and "an act that was
refused" are both durably distinguishable **for technical execution**. Nothing
maps this onto legal effectiveness.

### Authority substrate is technical, not legal

`ExecutionGrant` governs sinks: `SinkClass` = `["network-egress", "mcp-write"]`
(`packages/epistemic/domain/src/values/ExecutionGrant/ExecutionGrant.model.ts:43`),
`SinkAudience` = `["local-workspace", "external-network"]` (`:86`), plus
`GrantPurpose` (`:201`), `GrantResource` (`:238`), `GrantOperation` (`:277`),
`PolicyRevision` (`:318`), `GrantBudget` (`:360`), and `ExecutionGrant` (`:403`).

`GrantSet` is a draft/frozen tagged union where the two states "are deliberately
different types so 'widen after freeze' is unrepresentable rather than checked"
(`packages/epistemic/domain/src/values/GrantSet/GrantSet.model.ts:170-195`;
`DraftGrantSet` at `:105`, `FrozenGrantSet` at `:147`), with `freezeGrantSet`
(`:363`), `verifyFrozenGrantSetDigest` (`:393`), and `evaluateExecutionRequest`
(`:486`).

**This is authorization over technical sinks — network egress and MCP writes.**
It is the substrate the sibling goal declined to reach across for practitioner
authority (`goals/patent-citation-candor-gate/SPEC.md:212-214`). Nothing in it
expresses legal competence, capacity, or normative power.

## 6. `goals/epistemic-contradiction-triage` — the binding contract

**Surface class: SPEC CONTRACT plus explicit LIVE SOURCE STATUS.** This is the
contract the carried cluster composes against; the packet's dependency posture
forbids amending it from here
(`explorations/legal-position-relator-runtime/DECISIONS.md:67-76`).

### Candidate ownership

Objective: "evidence-backed, confidence-bearing, reviewable `CONTRADICTS`
candidates over the bitemporal edge authority core, plus an approval path that
may resolve a candidate as an atomic `SUPERSEDES` — with detection never
mutating authority. A contradiction candidate is a queryable, durable proposal
with provenance and confidence; only a recorded, scoped human disposition can
convert it into an authority-changing supersession"
(`goals/epistemic-contradiction-triage/SPEC.md:5-11`).

Target surfaces are epistemic domain/tables/use-cases/server plus db-admin
migration registration, and contradiction review "uses a slice-local
`ContradictionDispositionStatus`; `ClaimDispositionStatus` remains unchanged"
(`goals/epistemic-contradiction-triage/SPEC.md:49-60`).

### Disposition flow and duplicate suppression

- "An unresolved contradiction is represented by the absence of a contradiction
  disposition. `ContradictionDispositionStatus` contains only `rejected` and
  `superseded`; it does not overload claim-admission disposition."
  (`goals/epistemic-contradiction-triage/SPEC.md:69-71`)
- "Approval is a recorded scoped human disposition, not truth manufacture…; the
  approval record and the resulting supersession are distinct records with
  distinct identities." (`goals/epistemic-contradiction-triage/SPEC.md:66-68`)
- "Duplicate suppression is identity-based (logical key + match basis), not
  string-similarity-based."
  (`goals/epistemic-contradiction-triage/SPEC.md:74-75`)
- "Symmetric relations (`CONTRADICTS`) reuse the core's symmetric-endpoint
  ordering in `LogicalEdgeIdentity`; no second symmetric-encoding scheme."
  (`goals/epistemic-contradiction-triage/SPEC.md:72-73`)

The P0 gate names the five fixture assertions: identity/anchor matching,
symmetric-edge collapse, duplicate suppression as a no-op with visible
provenance, unresolved visibility at `asOf(validAt, knownAt)` without touching
authority reads, and candidate-to-approved atomic transition
(`goals/epistemic-contradiction-triage/SPEC.md:83-99`).

### Lines that forbid widening (quoted exactly)

Non-Goals:

> - No changes to shared `ClaimLifecycle`; **no IP-law vocabulary**.
> (`goals/epistemic-contradiction-triage/SPEC.md:27`)

> - No semantic-graph or NLP contradiction *detection engine* in this packet:
>   candidates arrive from callers (agents, pipelines); this packet owns their
>   storage, lifecycle, matching identity, and approval transition — not
>   natural-language inference.
> (`goals/epistemic-contradiction-triage/SPEC.md:23-26`)

Constraints:

> - Typed verdict families stay separate (master align Q1): a candidate's
>   semantic stance never doubles as anchor fidelity, source authority, or
>   disposition; this packet names its own family without claiming the others.
> (`goals/epistemic-contradiction-triage/SPEC.md:76-78`)

> - Additive migrations only; the core's tables and constraints are not altered.
> (`goals/epistemic-contradiction-triage/SPEC.md:81`)

Stop Conditions (verbatim, all four):

> - Required source files are missing or materially contradictory.
> - The implementation would exceed named scope (especially: any pressure to
>   add detection heuristics/NLP — stop and re-scope).
> - Verification requires credentials, cost, destructive side effects, or policy
>   approval not named in this spec.
> - The same blocker repeats after reasonable investigation.
>
> (`goals/epistemic-contradiction-triage/SPEC.md:135-142`)

Note: the routing seed cites `SPEC.md:137-138` for the detection-heuristic stop
(`explorations/legal-patent-kg-deepening/ROUTING-SEED.md:108`). The operative
clause actually spans `:138-139`; `:137` is the missing-sources condition. Cite
`:138-139`.

### LIVE SOURCE STATUS — this contract is now substantially implemented

**This is the largest drift against the 2026-08-01 routing-seed grounding.** The
seed and CAPTURE describe this goal only through its SPEC
(`explorations/legal-position-relator-runtime/CAPTURE.md:126-129`). Live source
landed on 2026-08-02:

```text
git log --diff-filter=A --format='%h %ad %s' --date=short -- \
  packages/epistemic/domain/src/values/Contradiction/Contradiction.model.ts \
  packages/epistemic/use-cases/src/ContradictionTriage/ContradictionTriage.ports.ts
→ 244529aa4f 2026-08-02 feat(epistemic): add contradiction source triage (#520)
```

Live domain entities (`packages/epistemic/domain/src/entities/Contradiction/Contradiction.model.ts`):

- `ContradictionCandidate` (`:58-119`) — `candidateKey`, `candidateDigest`,
  `assessment`, `matchBasis`, `pair`, `recordedAt`, `validFrom`,
  `validTo: Option`. Bitemporal and immutable, exactly as the SPEC promised.
- `ContradictionReceipt` (`:201`)
- `ContradictionDisposition` (`:252-288`) — `candidateId` (unique index),
  `decision`, `resolvedAt`, `resolvedBy: Principal`. Append-only per its
  annotation at `:285-287`.

Live domain values (`packages/epistemic/domain/src/values/Contradiction/Contradiction.model.ts`, 1,525 lines):

- `ContradictionMatchBasisKind` = `["same-source-overlap", "independent-evidence"]`
  (`:435`, schema `:451-456`)
- `ContradictionMatchBasis` (`:648-653`) over a struct carrying `detector`,
  `detectorVersion` (`SemanticVersion`), `evidenceDigest`, `kind`, and disjoint
  left/right evidence sets, with the detector documented as identifying
  "provenance, not authority" (struct at `:560-606`, checked schema `:607-633`)
- `ContradictionAssessment { confidence, proposals }` (`:913-925`)
- `ContradictionResolutionProposal` (`:840-847`) over a struct with `fact`,
  `losingBelief`, `proposalDigest`, `proposalId`, `rationale`, `validFrom`,
  `validTo` (`:768-797`)
- `ContradictionDispositionStatus` = `["rejected", "superseded"]` (`:927`,
  schema `:945-950`) — matches `SPEC.md:69-71` exactly
- `ContradictionDispositionDecision` — tagged union where `rejected` carries a
  bounded `reason` and `superseded` carries `formerEdgeVersionId`,
  `proposalDigest`, `proposalId`, `reason`, `replacementEdgeVersionId`
  (`:1034-1057`, schema `:1075-1079`)
- Digest/key functions: `canonicalizeContradiction` (`:1171`),
  `contradictionEvidenceDigest` (`:1226`), `contradictionCandidateKey` (`:1252`),
  `contradictionProposalDigest` (`:1353`), `contradictionCandidateDigest` (`:1520`)

Live use-case surface (`packages/epistemic/use-cases/src/ContradictionTriage/`,
1,868 lines across commands/errors/ports/rpc/service/server):

- `ContradictionTriageRepositoryShape` = `get`, `getExpanded`, `list`, `review`,
  `submit` (`ContradictionTriage.ports.ts:374-395`), service at `:410-413`
- `ContradictionReviewer` is a `Context.Service` carrying a `Principal`,
  "supplied by server orchestration, never by the public review payload"
  (`ContradictionTriage.ports.ts:46-66`)
- `ContradictionReviewScope` carries `{ orgId, sourceScopeRef }` only
  (`ContradictionTriage.ports.ts:87-93`)
- `ContradictionSubmission { candidate, duplicateCandidate, receipt }`
  (`ContradictionTriage.ports.ts:108-123`) — duplicate suppression is live
- Commands: `SubmitContradictionCandidate` (`:125`), `ListContradictionCandidates`
  (`:252`), `GetContradictionCandidate` (`:300`),
  `GetExpandedContradictionCandidate` (`:345`), `ContradictionReviewDecision`
  (`:410-430`), `ReviewContradictionCandidate` (`:450`)

Manifest state: P0 and P1 `complete`, P2 `in-progress`, P3/P4 `pending`;
lifecycle `active`
(`goals/epistemic-contradiction-triage/ops/manifest.json:52-81`, `:11-13`).
Only the first acceptance criterion is checked
(`goals/epistemic-contradiction-triage/SPEC.md:112-123`).

**Consequence for the wedge:** the carried cluster is no longer composing
against a promise. It is composing against a shipped, digest-sealed,
`Principal`-authored candidate/disposition pipeline whose disposition vocabulary
is closed at two members. Any legal verdict family must land *outside* it.

## 7. Sibling boundary — `goals/patent-citation-candor-gate`

**Surface class: SPEC CONTRACT, reference only.** The graduated wedge's shapes
are composed against, never reopened
(`explorations/legal-position-relator-runtime/CAPTURE.md:176-179`).

Shapes this wedge must compose against and must not redefine:

1. **Hard fact/judgment split** — append-only fact records own mechanics;
   `CandorDisposition` holds only the dated, scoped attorney judgment
   referencing exact facts and observation version
   (`goals/patent-citation-candor-gate/SPEC.md:34-38`).
2. **Derived gate, no stored closure** — "no 'duty satisfied' state exists
   anywhere; the predicate is recomputed from events + dispositions; stale,
   quarantined, and possible-duplicate events count as undisposed (fail
   closed)" (`goals/patent-citation-candor-gate/SPEC.md:39-42`, restated as a
   Non-Goal at `:80`).
3. **Never-compute** — no computed legal judgment: materiality,
   cumulativeness, intent, copy-exception applicability, or duty satisfaction
   inferred from absence (`goals/patent-citation-candor-gate/SPEC.md:73-79`).
   This is the sibling's already-graduated statement of the wedge's own
   never-compute boundary.
4. **Currency is declared, never inferred** — "an observation stays current
   until another event explicitly supersedes it by naming the exact prior
   observation version. Arrival order, ingestion order, and observation
   timestamps never establish currency… Lineage is written once and the head is
   derived, never stored as an `isCurrent` flag (the `EdgeVersion.supersedesId`
   posture — pattern only, never imported; slice-to-slice imports stay
   forbidden)" (`goals/patent-citation-candor-gate/SPEC.md:173-184`).
5. **Authorship recorded, authority not enforced** — the trust boundary is
   explicit: "the gate proves that a human principal disposed the exact
   observation version, never that the human was authorized to"
   (`goals/patent-citation-candor-gate/SPEC.md:204-217`).
6. **Cross-slice law** — slice-to-slice imports forbidden; only two
   doctrine-sanctioned shapes (emitted events, or a contract promoted into
   `shared/use-cases`); `packages/shared/use-cases` does not exist today
   (`goals/patent-citation-candor-gate/SPEC.md:57-67`, `:96-103`, `:137-144`).
7. **No changes to the `RuntimeApprovalGate` contract or the agents slice's
   decision/lifecycle vocabularies**
   (`goals/patent-citation-candor-gate/SPEC.md:94-95`).
8. **Vocabulary placement precedent** — legal vocabulary lands in
   `packages/law-practice/domain`; only entity-id registrations go to
   `packages/shared/domain/src/identity/`; "No new packages"
   (`goals/patent-citation-candor-gate/SPEC.md:120-128`, `:96-99`).

Its stop conditions name drift toward a Non-Goal — "computed judgment, stored
closure, widened agents vocabulary, new cross-slice edge" — as a hard stop
(`goals/patent-citation-candor-gate/SPEC.md:326-337`).

## 8. NET-NEW re-confirmation (source-only, 2026-08-05)

**Surface class: LIVE SOURCE search only.** Each command searched only
`packages/**/src/**/*.{ts,tsx}`. Each returned exit status 1 with zero matches
and no output.

| Symbol | Exact command | Result |
| --- | --- | --- |
| `Hohfeld` | `rg -n "Hohfeld" packages --glob '**/src/**/*.{ts,tsx}'` | **NOT FOUND — 0** |
| `LegalPositionRelator` | `rg -n "LegalPositionRelator" packages --glob '**/src/**/*.{ts,tsx}'` | **NOT FOUND — 0** |
| `PowerExercise` | `rg -n "PowerExercise" packages --glob '**/src/**/*.{ts,tsx}'` | **NOT FOUND — 0** |
| `ActFrame` | `rg -n "ActFrame" packages --glob '**/src/**/*.{ts,tsx}'` | **NOT FOUND — 0** |
| `SlotCorrespondence` | `rg -n "SlotCorrespondence" packages --glob '**/src/**/*.{ts,tsx}'` | **NOT FOUND — 0** |
| `LegalScopeContext` | `rg -n "LegalScopeContext" packages --glob '**/src/**/*.{ts,tsx}'` | **NOT FOUND — 0** |
| `PriorityBasis` | `rg -n "PriorityBasis" packages --glob '**/src/**/*.{ts,tsx}'` | **NOT FOUND — 0** |
| `CorrectionDelta` | `rg -n "CorrectionDelta" packages --glob '**/src/**/*.{ts,tsx}'` | **NOT FOUND — 0** |

This reconfirms the 2026-08-01 sweep recorded in the routing seed
(`explorations/legal-patent-kg-deepening/ROUTING-SEED.md:53-54`, `:104`) and
carried into CAPTURE
(`explorations/legal-position-relator-runtime/CAPTURE.md:92-111`), without
treating SPEC mentions or exploration prose as implementation.

### Supplementary concept sweep (case-insensitive, same glob)

| Term | Matches | Reading |
| --- | --- | --- |
| `hohfeld` | 0 | **NOT FOUND** |
| `correlativ` | 0 | **NOT FOUND** — no correlativity anywhere in source |
| `no-right` | 0 | **NOT FOUND** |
| `immunity` | 0 | **NOT FOUND** |
| `legal power` | 0 | **NOT FOUND** |
| `FLINT` | 0 | **NOT FOUND** |
| `UFO-L` | 0 | **NOT FOUND** |
| `\brelator\b` | 0 | **NOT FOUND** (bare `relator` matches 54 lines, all `ClockCorrelator` substrings in `packages/tooling/library/qa-capture/src/ClockCorrelator.service.ts`) |
| `disability` | 10 | **HIT — false positive, verified.** All matches live in two generated donor data files, `packages/law-practice/domain/src/internal/generated/free-law-project/courts.ts` and `.../reporters.ts` (`rg -l -i "disability"` returns only these two). The matched strings are institution names — "National Disability Law Repoter" [sic, upstream typo], "United States Judicial Conference Committee on Judicial Conduct and Disability", "Committee To Review Circuit Council Conduct And Disability Orders". Excluding `**/generated/**` returns zero matches. Not the Hohfeldian position. |
| `SHACL` | 520 | **HIT — genuine live surface.** See below. |

### `SHACL` is live — a correction to the R25 net-new framing

The routing seed treats `R25` (FLINT executable artifacts: `SlotCorrespondence`,
hard/advisory shapes, source ranges, competency queries) as wholly net-new
(`explorations/legal-patent-kg-deepening/ROUTING-SEED.md:100-101` as carried into
`explorations/legal-position-relator-runtime/CAPTURE.md:100-101`).
`SlotCorrespondence` is indeed absent. **Shape validation with a hard/advisory
severity split is not.**

`packages/foundation/capability/semantic-web/src/services/shacl-validation.ts`
(386 lines) is a live bounded SHACL contract:

- `ShaclSeverity` = `["info", "warning", "violation"]` (`:49-70`) — this *is* the
  hard-vs-advisory axis R25 describes
- `ShaclPropertyShape { path, minCount, maxCount, datatype, class, hasValue }`
  (`:92-108`)
- `ShaclNodeShape { id, targetNode, targetClass, properties }` (`:134-148`)
- `ShaclValidationViolation { focusNode, path, message, severity, sourceShape,
  sourceConstraintComponent, value }` (`:175-189`)
- `ShaclValidationRequest` (`:211`), `ShaclValidationResult` (`:246`)
- `ShaclValidationErrorReason` = `["invalidShape", "engineFailure"]` (`:274-296`),
  `ShaclValidationError` (`:316`)
- `ShaclValidationServiceShape` (`:342`) and `ShaclValidationService`
  `Context.Service` (`:384`)

Additional live SHACL consumers appear in the ontology slice
(`packages/ontology/use-cases/src/tools/OntologyToolkit.ts`,
`packages/ontology/use-cases/src/aggregates/Session/Session.validation.ts`) and
in epistemic claim gating
(`packages/epistemic/use-cases/src/ClaimGate/ClaimGate.ports.ts`,
`packages/epistemic/domain/src/values/ClaimGate/ClaimGateResult.model.ts`),
found by `rg -l -i "SHACL" packages --glob '**/src/**/*.{ts,tsx}'`.

**Consequence for the R25 licence gate:** the MPL-2.0 clean-room question is
narrower than the seed implies. The repo already owns a severity-bearing shape
validation contract; what R25 could add is FLINT *slot* semantics, not shape
validation as such. This narrows what would need clean-room re-expression, and
it should be verified against the actual upstream artifacts in Lane B.

## 9. Reconciliation against the ten nuggets

**Surface class labelled in every row.** Nugget text and status are the packet's
captured evidence, not conclusions of this lane
(`explorations/legal-position-relator-runtime/CAPTURE.md:26-88`).

| Nugget | Composes (LIVE SOURCE) | Composes (SPEC CONTRACT) | Genuinely lacks |
| --- | --- | --- | --- |
| **T1-F1** — eight positions, four correlative pairs; store one directed relation, derive the opposite as a schema invariant | `LiteralKit` is the sanctioned closed-domain constructor, with eight live examples in `@beep/ontology` (`packages/foundation/modeling/ontology/src/SemanticFoundation.models.ts:98`, `:140`, `:239`; `.../Fold.models.ts:312`, `:351`, `:556`, `:664`; `.../TaxonomyLoader.ts:58`). The *derive-don't-store* mechanism exists as `orderEndpoints` + versioned canonical encoding (`packages/epistemic/domain/src/values/LogicalEdgeIdentity/LogicalEdgeIdentity.model.ts:323-337`, `:340-368`) driven by `SymmetricEdgeRelation` (`packages/epistemic/domain/src/values/EdgeRelation/EdgeRelation.model.ts:54-61`). SKOS alignment vocabulary is `exactMatch`/`closeMatch` only (`.../SemanticFoundation.models.ts:140-144`, `:181-190`). | — | The `HohfeldPosition` domain itself; a correlative **bimap** (symmetry ≠ correlativity — symmetry collapses two presentations of one relation, correlativity names two different positions held by two parties); `TaxonomyConcept` stores `broader` with no `narrower`/inverse (`.../SemanticFoundation.models.ts:211-224`), so there is no existing derived-counterpart precedent inside the taxonomy. `owl:inverseOf` exists only as a decoded FOLIO API field (`.../Ontology.models.ts:531-538`, header `:2`). The caution "keep correlativity outside plain SKOS triples" (`CAPTURE.md:143-144`) has no live surface pushing back on it. |
| **T1-F2** — legal relations are identity-bearing n-ary relators joining roles, position moments, source norms, grounding events; a binary edge is substrate, not the aggregate | `EdgeVersion` supplies exactly the substrate claim: one source, one target, immutable `fact`, two time axes, lineage (`packages/epistemic/domain/src/entities/EdgeVersion/EdgeVersion.model.ts:106-164`). `LogicalEdgeIdentity` supplies time-independent identity with scopes and qualifiers (`.../LogicalEdgeIdentity.model.ts:266-283`) sealed by a versioned digest (`:211`, `:340-368`, `:408`). | — | Everything n-ary. `EdgeEndpoint` has exactly four kinds and there are exactly two slots (`.../EdgeVersion.model.ts:128-156`, `:311-339`) — no third participant, no role-typed slot, no norm reference, no grounding-event reference. `EdgeQualifiers` is `Record<string,string>` (`.../LogicalEdgeIdentity.model.ts:169`), which is a partitioning key, not a typed role. The caution against widening the edge core (`CAPTURE.md:141-143`) is exactly right: the substrate has no widening seam. |
| **T1-F7** — a legal power is an authorized network-rewriting operation; attempted and ineffective acts remain recorded; authority and constitutive conditions gate authoritative revisions | `EdgeAuthority` is the network-rewriting surface, four operations, no update/delete, single-transaction supersede (`packages/epistemic/use-cases/src/EdgeAuthority/EdgeAuthority.ports.ts:20-39`, `:60-67`); `SupersedeEdgeFact` carries the optimistic head claim (`.../EdgeAuthority.commands.ts:167-187`) and the invalidating-fact `validTo` rule (`:189-203`). "Attempted vs ineffective" is representable technically: `ExecutionVerdict` allowed/denied (`packages/epistemic/domain/src/values/ExecutionVerdict/ExecutionVerdict.model.ts:193`, `:216`, `:40`), `ExecutionSettlement` completed/failed/interrupted (`packages/epistemic/domain/src/values/ExecutionRecord/ExecutionRecord.model.ts:263`), and `ExecutionLedger`'s write-ahead decision/outcome split with `readUnsettledAllowed` (`packages/epistemic/use-cases/src/ExecutionLedger/ExecutionLedger.ports.ts:29-39`, `:61-73`). Authorization gating is `GrantSet`/`FrozenGrantSet` + `evaluateExecutionRequest` (`packages/epistemic/domain/src/values/GrantSet/GrantSet.model.ts:147`, `:170-195`, `:486`). | Approval as recorded scoped human disposition, never truth manufacture (`goals/epistemic-contradiction-triage/SPEC.md:66-68`); detection never mutates authority (`:15-17`, `:64-65`). | `PowerExercise` as a domain concept. The live authority is over *technical sinks* — `network-egress`, `mcp-write` (`packages/epistemic/domain/src/values/ExecutionGrant/ExecutionGrant.model.ts:43`, `:86`) — never legal competence. No constitutive condition, no legal validity/nullity distinction, no record of an *attempted legal act* separate from a failed technical dispatch. |
| **T1-F9** — competency questions become required fields; bearer, counterparty, act/omission, result, grounding event, source rule fail validation when absent | The repo's required-field discipline is live and strong: `S.Class` fields are required unless `Option`-wrapped, and checks fail at decode time (`packages/foundation/modeling/ontology/src/SemanticFoundation.models.ts:41-52`; `packages/epistemic/domain/src/values/Contradiction/Contradiction.model.ts:607-633`, `:801-825`). `EdgeVersion` already makes `relation`, both endpoint kinds, `fact`, `validFrom`, `recordedAt`, `logicalKey`, `version` non-optional (`.../EdgeVersion.model.ts:109-164`). | — | Every one of the six named slots. `EdgeVersion` has no bearer, counterparty, act/omission, result, grounding event, or source-rule field; the nearest is untyped `qualifiers` (`.../EdgeVersion.model.ts:123`) and `fact: UnknownRecord` (`:116`), which are the opposite of schema-enforced competency fields. |
| **T4-F6** — agent authority requires persistent Party identity, context-specific Role, event-reified obligation/power lifecycles; technical success never establishes legal authority | Persistent actor identity: `Principal` five-member union with on-behalf-of chains (`packages/shared/domain/src/entity/Principal.ts:75-256`), on every entity via `BaseEntity.fields` (`packages/shared/domain/src/entity/BaseEntity.ts:80-89`, `:104-131`). Party-like law entities: `LegalClient`/`LegalContact`/`Matter` (`packages/law-practice/domain/src/entities/LegalClient/LegalClient.model.ts:47-57`, `.../LegalContact/LegalContact.model.ts:48-61`, `.../Matter/Matter.model.ts:48-61`). Context-specific role, one instance: `LegalContactRole` = `["founder"]` (`.../LegalContact.values.ts:13`). Human gate: `RuntimeApprovalGate` (`packages/agents/use-cases/src/processes/ProfessionalRuntime/ProfessionalRuntime.contracts.ts:473-491`). Live reviewer identity done right: `ContradictionReviewer` carries a `Principal` supplied by server orchestration, never by payload (`packages/epistemic/use-cases/src/ContradictionTriage/ContradictionTriage.ports.ts:46-66`). | Sibling boundary already fixed: authorship recorded, authority not enforced; only `User`-kind principals dispose (`goals/patent-citation-candor-gate/SPEC.md:204-217`); no widening of agents vocabularies (`:94-95`). | A `Party` entity (**NOT FOUND**, section 4). A general context-specific `Role` — the only shared one is `Membership.Role` = `owner`/`member` (`packages/shared/domain/src/entities/Membership/Membership.values.ts:13`), and the sibling SPEC already records that no practitioner role exists (`goals/patent-citation-candor-gate/SPEC.md:210-214`). In the agents runtime specifically, every principal is a **bare non-empty string** with no kind and no role (`.../ProfessionalRuntime.contracts.ts:83-87`) — which is the concrete asymmetry the generic-vs-legal split question must resolve. Also lacking: event-reified obligation/power lifecycles; the runtime's decision/lifecycle vocabularies are single-member placeholders (`.../ProfessionalRuntime.values.ts:65-85`, `:139-159`). |
| **P100** (unverified addendum) — FLINT n-ary Act/Fact frames whose preconditioned acts create/terminate state facts | Precondition-then-effect exists structurally in `ExecutionLedger` (decision recorded before the effect, outcome after settlement — `packages/epistemic/use-cases/src/ExecutionLedger/ExecutionLedger.ports.ts:29-39`) and in `EdgeAuthority.supersede`'s close-and-insert (`.../EdgeAuthority.ports.ts:34-36`). | — | `ActFrame` (**NOT FOUND**); `FLINT` appears nowhere in source (0 matches). No n-ary act, no precondition expression over domain facts, no create/terminate state-fact semantics. Verification of P100 itself is Lane B's job, not this lane's — this lane only confirms zero repo footprint. |
| **R25** (unverified addendum) — executable FLINT artifacts add `SlotCorrespondence`, hard/advisory shapes, source ranges, competency queries; Apache-2.0 port-with-attribution, MPL-2.0 SHACL clean-room only | **Correction to the seed's framing:** hard/advisory shape validation is LIVE. `ShaclSeverity` = `info`/`warning`/`violation` with node/property shapes, violations, and a bounded `Context.Service` (`packages/foundation/capability/semantic-web/src/services/shacl-validation.ts:49-70`, `:92-148`, `:175-189`, `:342`, `:384`). Attribution precedent for a donor port is also live and exemplary: the Graphiti Apache-2.0 notice on `EdgeVersion` (`packages/epistemic/domain/src/entities/EdgeVersion/EdgeVersion.model.ts:16-25`). | — | `SlotCorrespondence` (**NOT FOUND**); FLINT-specific source ranges; competency queries as first-class artifacts. The licence gate remains Lane B's; this lane narrows it — because shape validation with severity already exists, the MPL-2.0 clean-room surface is smaller than the seed assumes. |
| **T1-F3** — contradiction triage must align position, parties, act, conditions, jurisdiction, and time before a typed multi-axis priority stage; rule conflicts, principle collisions, interpretation disputes, and factual disputes need distinct verdict families | **Now LIVE, not SPEC-only** (section 6). Alignment that exists: org scope + source scope (`ContradictionReviewScope { orgId, sourceScopeRef }`, `packages/epistemic/use-cases/src/ContradictionTriage/ContradictionTriage.ports.ts:87-93`); time (`validFrom`/`validTo` on the candidate, `packages/epistemic/domain/src/entities/Contradiction/Contradiction.model.ts:80-85`); identity/lineage (`candidateKey`, `pair`, `:62-76`); evidence basis with detector identity + `SemanticVersion` (`packages/epistemic/domain/src/values/Contradiction/Contradiction.model.ts:648-653`). | Typed verdict families stay separate; a candidate's semantic stance never doubles as anchor fidelity, source authority, or disposition (`goals/epistemic-contradiction-triage/SPEC.md:76-78`). No IP-law vocabulary (`:27`). | `LegalScopeContext` and typed `PriorityBasis` (**NOT FOUND**). The live alignment axes are org + source-scope + time only — **no party, forum, jurisdiction, proof standard, position tuple, authority, or institutional viewpoint anywhere**. The four legal verdict families are absent: the live basis kind is `same-source-overlap`/`independent-evidence` (`.../Contradiction.model.ts:435`) and the live disposition status is `rejected`/`superseded` (`:927`), both closed. |
| **T3-F9** — triage begins only after forum, jurisdiction, proof standard, time, parties, and viewpoint align; candidate generation, comparability, and adjudication remain separate stages | The three-stage separation is **live and enforced by shape**: generation is `submit` (returns a candidate + receipt, with `duplicateCandidate` flagged, `ContradictionTriage.ports.ts:108-123`, `:392-394`), comparability is the sealed `matchBasis` + digest keys (`packages/epistemic/domain/src/values/Contradiction/Contradiction.model.ts:648-653`, `:1226`, `:1252`), adjudication is `review` requiring a `Principal` + scope and returning a `ContradictionDisposition` (`ContradictionTriage.ports.ts:384-391`). Detector identity "identifies provenance, not authority" (`.../Contradiction.model.ts:560-566`). | Detection never mutates authority (`goals/epistemic-contradiction-triage/SPEC.md:15-17`, `:64-65`); unresolved is absence of disposition (`:69-71`); duplicate suppression is identity-based, never string-similarity (`:74-75`). | The six alignment predicates themselves. Nothing forum-, jurisdiction-, proof-standard-, party-, or viewpoint-aware exists. The wedge's caution — "temporal overlap creates a candidate only; it never adjudicates truth or supersession" (`CAPTURE.md:151-153`) — is already structurally honoured by the live pipeline, so the wedge's contribution here is vocabulary, not mechanism. |
| **T4-F8** — model correction must append source, initial candidate, validator report, semantic checkpoints, explicit delta, revised candidate, reviewer action; unresolved differences become contradiction candidates, never silent overwrites | Append-only correction is live and strong: no-update/no-delete on `EdgeAuthority` (`packages/epistemic/use-cases/src/EdgeAuthority/EdgeAuthority.ports.ts:20-39`); write-ahead decision + settled outcome on `ExecutionLedger` (`packages/epistemic/use-cases/src/ExecutionLedger/ExecutionLedger.ports.ts:29-39`, `:61-73`); and the live disposition union already records `formerEdgeVersionId`, `proposalDigest`, `proposalId`, `reason`, `replacementEdgeVersionId` (`packages/epistemic/domain/src/values/Contradiction/Contradiction.model.ts:1034-1057`). A proposal already carries the replacement `fact`, the `losingBelief` ref, a rationale, and a validity interval (`.../Contradiction.model.ts:768-797`). `ContradictionDisposition.resolvedBy` is a `Principal` (`packages/epistemic/domain/src/entities/Contradiction/Contradiction.model.ts:265-267`). | Approval record and resulting supersession are distinct records with distinct identities (`goals/epistemic-contradiction-triage/SPEC.md:66-68`). Sibling: fact/judgment split, no stored closure, currency declared never inferred (`goals/patent-citation-candor-gate/SPEC.md:34-42`, `:173-184`). | `CorrectionDelta` (**NOT FOUND**). Specifically absent from the live shape: the **model/configuration identity** (the live `detector`/`detectorVersion` pair identifies a detector, not an LLM + its configuration — `.../Contradiction.model.ts:560-606`), the **validator report**, and **semantic checkpoints**. The "explicit delta" is currently implicit — the proposal carries a whole replacement `fact`, not a diff (`.../Contradiction.model.ts:772-774`). The caller-owned emission contract that keeps ODRL and other caller vocabularies out of the generic epistemic goal has no live seam at all, and the SPEC's "no IP-law vocabulary" (`goals/epistemic-contradiction-triage/SPEC.md:27`) forbids putting one there. |

## 10. Drift against the 2026-08-01 routing-seed grounding

The routing seed grounds itself in the tree "TODAY, 2026-08-01" and calls itself
a starting position (`explorations/legal-patent-kg-deepening/ROUTING-SEED.md:4`).
Four days have passed and one large PR landed in the middle of it.

### Material drift

| Inherited claim | Current verification |
| --- | --- |
| `[T1-F3,T3-F9,T4-F8]` "The active triage goal **already owns** durable contradiction candidates, duplicate suppression, unresolved visibility, scoped human disposition, and candidate-to-atomic-supersession flow" cited **only to SPEC lines** (`explorations/legal-position-relator-runtime/CAPTURE.md:126-129`; `ROUTING-SEED.md:104`) | **Materially stale in status, not in content.** All five SPEC lines still land correctly (`goals/epistemic-contradiction-triage/SPEC.md:5-11`, `:49-60`, `:83-99`, `:112-123`). But the contract is no longer SPEC-only: 3,709 lines across the three live `Contradiction*` directories (`wc -l` over `packages/epistemic/domain/src/entities/Contradiction/`, `packages/epistemic/domain/src/values/Contradiction/`, `packages/epistemic/use-cases/src/ContradictionTriage/`) landed 2026-08-02 in `feat(epistemic): add contradiction source triage (#520)` (190 files changed, 33,410 insertions). P0/P1 are `complete`, P2 `in-progress` (`goals/epistemic-contradiction-triage/ops/manifest.json:52-81`). The carried cluster now composes against shipped, digest-sealed code with a closed two-member disposition vocabulary — a much harder boundary than a promise. |
| `[R25]` "`SlotCorrespondence` and FLINT competency validators — zero symbols" with hard/advisory shapes implied net-new (`CAPTURE.md:100-101`) | **Half stale.** `SlotCorrespondence` is confirmed **NOT FOUND**. But a live severity-bearing SHACL contract exists (`packages/foundation/capability/semantic-web/src/services/shacl-validation.ts:49-70`, `:342`, `:384`) with consumers in the ontology slice and epistemic claim gating. The MPL-2.0 clean-room surface is therefore narrower than the seed states. |
| `[T4-F8]` "`EdgeAuthority` already makes correction additive and **keeps supersession separate from detection** at `EdgeAuthority.ports.ts:3-34`" (`ROUTING-SEED.md:105`) | **Citation insufficiency.** Lines 1-34 establish immutability/no-update/no-delete; the one-transaction rule runs to `:36`. *Separation from detection* is nowhere in this file — it is a SPEC constraint (`goals/epistemic-contradiction-triage/SPEC.md:15-17`, `:64-65`). Cite both or the claim is unsupported. |
| `[T1-F3]` stop condition cited as `goals/epistemic-contradiction-triage/SPEC.md:137-138` (`ROUTING-SEED.md:108`) | **Off by one clause.** `:137` is "Required source files are missing or materially contradictory." The detection-heuristic stop is `:138-139`. |

### Citation-sufficiency drift (no line movement, cite needs widening)

| Inherited citation | Current verification |
| --- | --- |
| `@beep/ontology` "`LiteralKit` domains, SKOS mapping kinds, `TaxonomySeed`, and its registry/loader" at `SemanticFoundation.models.ts:98,140,287`; `TaxonomyLoader.ts:58,194` (`CAPTURE.md:115-118`) | The three model anchors are exact: `DocumentClass` `:98`, `SkosMappingKind` `:140`, `TaxonomySeed` `:287`. `TaxonomyLoader.ts:58` is `VendorLoadStatus` — exact. **`TaxonomyLoader.ts:194` is wrong for "registry/loader"**: it is `const decodeTaxonomySeed = ...`. The `TaxonomyLoader` `Context.Service` is at `:244-261` and its `Layer` at `:271-293`; the pure registry projection is a separate file, `TaxonomyRegistry.ts:126-153`. |
| `EdgeVersion` "binary endpoints, immutable `fact`, valid time, transaction time, and supersedes lineage" at `EdgeVersion.model.ts:106-163` (`CAPTURE.md:119-121`) | Exact and still current. The field block ends at `:164`; the class closes at `:237`. No drift. |
| `RuntimeApprovalGate` at `ProfessionalRuntime.contracts.ts:473-490` (`CAPTURE.md:122-125`) | Exact; the class closes at `:491`. No drift. Worth widening the cite to `:473-491` for the closing brace. |
| `EdgeAuthority` "owns record/supersede primitives" at `EdgeAuthority.ports.ts:60-100` (`CAPTURE.md:124-125`) | The shape is `:60-67` and the service class is `:100-102`; the span `:60-100` covers both but cuts the service declaration mid-statement. Prefer `:60-67` + `:100-102`. |
| `goals/epistemic-contradiction-triage/SPEC.md:49-55` "owns generic candidates only" (`CAPTURE.md:106-108`) | Lands on Target Surfaces; the sentence about slice-local `ContradictionDispositionStatus` continues to `:56`. Prefer `:49-60`. |

### Assumptions the live tree contradicts or sharpens

1. **CAPTURE frames the boundary question as "where does legal vocabulary
   live"** (`explorations/legal-position-relator-runtime/CAPTURE.md:165-172`;
   `ops/manifest.json:9`). The live tree already answered it once for the
   sibling: legal vocabulary goes to `packages/law-practice/domain` with only
   entity-id registrations in `packages/shared/domain/src/identity/`, and "No
   new packages" (`goals/patent-citation-candor-gate/SPEC.md:120-128`, `:96-99`).
   A separate legal-consumer core package would be a departure from a
   precedent set four days ago, not a neutral choice. The package families are
   fixed today: `agents`, `architecture-lab`, `documents`, `drivers`,
   `epistemic`, `foundation`, `_internal`, `law-practice`, `ontology`,
   `shared`, `tooling`, `workspace` (`find packages -mindepth 1 -maxdepth 1
   -type d`), and `law-practice` has exactly `domain`, `server`, `tables`,
   `use-cases`.
2. **T4-F6's "generic vs legal" split has a sharper edge than the question
   implies.** It is not a question of which *states* stay generic — the agents
   runtime has no Party, no Role, and no typed principal at all
   (`.../ProfessionalRuntime.contracts.ts:83-87`). Meanwhile the *epistemic*
   slice already does principals correctly, injecting a real `Principal` from
   server orchestration
   (`packages/epistemic/use-cases/src/ContradictionTriage/ContradictionTriage.ports.ts:46-66`).
   The align question is really: does the agents runtime adopt the shared
   `Principal` union first, or does the legal layer carry its own Party/Role and
   map down to opaque strings at the runtime boundary?
3. **"Correlativity" and "symmetry" are being conflated at the mechanism
   level.** The repo's one derive-don't-store precedent is symmetric collapse
   (`packages/epistemic/domain/src/values/LogicalEdgeIdentity/LogicalEdgeIdentity.model.ts:323-337`).
   A Hohfeldian bimap is a *converse* with different position names per side, so
   it cannot reuse `orderEndpoints` and must not be described as "the same
   pattern". Lane B should draw this precisely.
4. **The wedge's "never compute" boundary is already stated in a graduated
   SPEC** (`goals/patent-citation-candor-gate/SPEC.md:73-79`, `:204-217`). Any
   restatement here must be a composition of that language, not a fresh
   formulation, or the two goals will drift apart.

### Open questions this lane could not close (out of scope, for align)

1. **Vocabulary home** (`ops/manifest.json:9`) — this lane found the precedent
   (`law-practice/domain`, no new packages) but does not choose.
2. **T4-F6 generic/legal split** (`ops/manifest.json:10`) — this lane grounded
   the asymmetry above; the decision is Benjamin's.
3. **`CorrectionDelta` caller-owned emission shape** (`ops/manifest.json:11`) —
   this lane confirms zero live seam and confirms `SPEC.md:27` forbids putting
   one inside the generic epistemic goal. No emitted-event surface exists in any
   slice today (the sibling recorded the same absence at
   `goals/patent-citation-candor-gate/SPEC.md:140-142`; independently
   reconfirmed here by `RuntimeApprovalGate` having zero external consumers).
4. **P100/R25 verification** (`ops/manifest.json:12`) — Lane B's gate. This lane
   contributes only the repo-side facts: zero FLINT/`ActFrame`/`SlotCorrespondence`
   footprint, a live SHACL severity surface that narrows the MPL-2.0 question,
   and a live Apache-2.0 attribution precedent
   (`packages/epistemic/domain/src/entities/EdgeVersion/EdgeVersion.model.ts:16-25`).
