# R8 — Beep knowledge-graph / domain model: where CAD figures go

**Lane:** r8-beep-kg-model  
**Question:** If a CAD model and its rendered figures become first-class nodes in this knowledge graph, where do they go and what do they connect to?  
**Checkout:** isolated worktree snapshot of beep-effect2 (read-only archaeology).  
**Scope:** `packages/law-practice`, `packages/epistemic`, `packages/ontology`, `packages/documents`, `apps/practice-kg-mcp`.

**Short answer.** There is no single graph. CAD belongs in **four stacked places**, none of which should be invented from scratch:

1. **Vault + digest** (`packages/documents`) for the STEP/GLB/PNG bytes.
2. **Law-practice ProductEntity** (`packages/law-practice/domain`) for `CadModel` / `Figure` / `ReferenceNumeral` as typed records hanging off `PatentAsset` / `Matter` by fixture key.
3. **Practice-KG projection** (`kg_node` / `kg_edge`, closed `LiteralKit`s) only if agents must walk CAD on the same spine as docket → application → document.
4. **Epistemic `EdgeVersion`** for “this rendering is derived from disclosure X, version 3” — that sentence is already an `entity`/`observation` endpoint plus `supports` plus bitemporal intervals.

`PatentFigure` already exists as a thin URL+label value object. Reuse it; do not invent a parallel URL-only type. There is **no `Deadline` entity**. There is **no `Document` ProductEntity** in law-practice.

---

## 1. ENTITY INVENTORY (`packages/law-practice`)

Law-practice domain entities live under `packages/law-practice/domain/src/entities/`. They are `ProductEntity.make(LawPractice.*Id)` classes: schema-first, `fixtureKey` joins (not SQL FKs), shared identity fields (`entityType`, serial `id`, `publicId`, plus `orgId` / `rowVersion` / `schemaVersion` / `source` / principals from the kit).

**There is no `Deadline`.** Grep over `packages/law-practice` is empty. Matter type is currently a one-member kit: `"patent_application"` (`Matter.values.ts:13`).

**There is no law-practice `Document` entity.** Filed bytes live in `packages/documents`. The practice KG has a *projection* node kind `"document"` (digest-keyed), which is a different thing.

### 1.1 Domain entities (schema-first ProductEntity)

| Entity | File | Key fields | Persisted table? |
| --- | --- | --- | --- |
| `LegalClient` | `packages/law-practice/domain/src/entities/LegalClient/LegalClient.model.ts` | `displayName`, `fixtureKey`, `status` | No |
| `LegalContact` | `…/LegalContact/LegalContact.model.ts` | `displayName`, `fixtureKey`, `legalClientFixtureKey`, `role` | No |
| `Matter` | `…/Matter/Matter.model.ts` | `displayName`, `fixtureKey`, `legalClientFixtureKey`, `matterType` | No |
| `PatentAsset` | `…/PatentAsset/PatentAsset.model.ts` | `fixtureKey`, `matterFixtureKey`, `status`, `title` | No |
| `Claim` | `…/Claim/Claim.model.ts` | `claimNumber`, `fixtureKey`, `independent`, `patentAssetFixtureKey`, `text` | No |
| `OfficeAction` | `…/OfficeAction/OfficeAction.model.ts` | `applicationNumber`, `fixtureKey`, `matterFixtureKey`, `patentAssetFixtureKey` | No |
| `PriorArtReference` | `…/PriorArtReference/PriorArtReference.model.ts` | `documentNumber`, `fixtureKey`, `officeActionFixtureKey`, `title` | No |
| `Rejection` | `…/Rejection/Rejection.model.ts` | `claimFixtureKey`, `fixtureKey`, `ground` (JSONB statute+ref), `officeActionFixtureKey` | No |
| `Distinction` | `…/Distinction/Distinction.model.ts` | `anchor` (`TextAnchor` JSONB), `claimFixtureKey`, `detail`, `fixtureKey`, `lifecycleState` (`ClaimLifecycle`), `rejectionFixtureKey` | No |
| `Party` | `…/Party/Party.model.ts` | `displayName`, `kind`, `reference` (JSONB fixture-key pointer) | No |
| `PatentCitationEvent` | `…/PatentCitationEvent/PatentCitationEvent.model.ts` | `actor`, `citingApplication`, `discovery`, `grounding` (`TextAnchorVerificationReceipt`), `observedAt`, `possibleDuplicateOf`, `quarantine`, `reference`, `supersedes` | Yes — `law_practice_patent_citation_event` |
| `CandorDisposition` | `…/CandorDisposition/CandorDisposition.model.ts` | `citingApplication`, `decidedAt`, `disposes` (`ObservationVersionRef`), `lifecycle`, `litigationFrameJudgment`, `rule56Judgment`, `supersedes` | Yes — `law_practice_candor_disposition` |
| `IdsSubmissionFact` | `…/IdsSubmissionFact/IdsSubmissionFact.model.ts` | presence-only IDS facts + `operativeDate` + `modeledFrom` | Yes — `law_practice_ids_submission_fact` |
| `ActFrame` | `…/ActFrame/ActFrame.model.ts` | recorded Hohfeldian act-frame (flint-derived) | Yes — `law_practice_act_frame` |
| `LegalPositionRelator` | `…/LegalPositionRelator/LegalPositionRelator.model.ts` | advantage-side stored relation | Yes — `law_practice_legal_position_relator` |
| `PowerExercise` | `…/PowerExercise/PowerExercise.model.ts` | attempted exercise + `result` | Yes — `law_practice_power_exercise` |
| `CorrectionDelta` | `…/CorrectionDelta/CorrectionDelta.model.ts` | per-element correction of an `ActFrame` | Yes — `law_practice_correction_delta` |
| `LegalOppositionCandidate` | `…/LegalOppositionCandidate/LegalOppositionCandidate.model.ts` | screened opposed pair + optional verdict | Yes — `law_practice_legal_opposition_candidate` |

Identity IDs live in shared-kernel, not the slice: `packages/shared/domain/src/identity/LawPractice/{Matter,Claim,PatentAsset}Id.ts` (`make("matter" | "claim" | "patent_asset", …)`).

**Persistence split is load-bearing.** `packages/law-practice/tables/src/ReadModels.ts:45-51` says two populations live in `DbSchema`: packet-owned `kg*` projections (disposable PGlite), and entity-derived tables owned by db-admin migrations (candor + legal-position). Matter / Claim / PatentAsset are **proof-fixture domain models** with `pg.*` annotations but **no** `law-practice-tables` files and **no** db-admin export.

### 1.2 Already-existing figure type (reuse, do not recreate)

`PatentFigure` is a **value object**, not a node:

```106:129:packages/law-practice/domain/src/values/PatentMetadata/PatentMetadata.model.ts
export class PatentFigure extends S.Class<PatentFigure>($I`PatentFigure`)(
  {
    label: S.OptionFromOptionalKey(S.NonEmptyString).pipe(
      SchemaUtils.withNoneDefault,
      $I.annoteKey("PatentFigure.label", {
        description: "Human-readable figure label such as FIG. 1 or the source filename.",
      })
    ),
    url: S.URLFromString.pipe(
      $I.annoteKey("PatentFigure.url", {
        description: "Resolvable absolute HTTP(S) image URL.",
      })
    ),
    alt: S.OptionFromOptionalKey(S.NonEmptyString).pipe(
      SchemaUtils.withNoneDefault,
      $I.annoteKey("PatentFigure.alt", {
        description: "Short alternate text for accessibility.",
      })
    ),
  },
  $I.annote("PatentFigure", {
    description: "Patent figure image reference with display and accessibility metadata.",
  })
) {}
```

`extractPatentFigures` (`PatentMetadata.model.ts:1313`) pulls figures from API `imageUrls` maps and markdown images. `PatentSectionKind` already includes `"drawings"` (`PatentMetadata.model.ts:681`). This is display metadata for published patents, **not** a CAD model, numeral map, or vaulted artifact.

### 1.3 Representative entity definitions (conventions)

**Matter** — fixture-key parent, `LiteralKit` type, ProductEntity spread:

```49:69:packages/law-practice/domain/src/entities/Matter/Matter.model.ts
export class Matter extends MatterEntity.Entity<Matter>(MatterEntity.tableName)(
  {
    displayName: LawPracticeText.annotateKey({
      description: "Human-readable matter display name.",
    }).pipe(MatterEntity.pg.text(), MatterEntity.pg.columnName("display_name")),
    fixtureKey: LawPracticeFixtureKey.annotateKey({
      description: "Stable fixture key for the matter.",
    }).pipe(MatterEntity.pg.text(), MatterEntity.pg.columnName("fixture_key")),
    legalClientFixtureKey: LawPracticeFixtureKey.annotateKey({
      description: "Fixture key for the legal client this matter belongs to.",
    }).pipe(MatterEntity.pg.text(), MatterEntity.pg.columnName("legal_client_fixture_key")),
    matterType: MatterType.annotateKey({
      description: "Matter type.",
    }).pipe(MatterEntity.pg.text(), MatterEntity.pg.columnName("matter_type")),
    ...MatterEntity.identityFields,
  },
  $I.annote("Matter", {
    description: "Legal matter entity grouping prosecution work for one legal client.",
  }),
  MatterEntity.entityExtras
) {}
```

**Claim** — numbered claim text under a patent asset:

```55:78:packages/law-practice/domain/src/entities/Claim/Claim.model.ts
export class Claim extends ClaimEntity.Entity<Claim>(ClaimEntity.tableName)(
  {
    claimNumber: ClaimNumber.annotateKey({
      description: "One-based patent claim number.",
    }).pipe(ClaimEntity.pg.integer(), ClaimEntity.pg.columnName("claim_number")),
    fixtureKey: LawPracticeFixtureKey.annotateKey({
      description: "Stable fixture key for the claim.",
    }).pipe(ClaimEntity.pg.text(), ClaimEntity.pg.columnName("fixture_key")),
    independent: S.Boolean.annotateKey({
      description: "Whether the claim is independent.",
    }).pipe(ClaimEntity.pg.boolean()),
    patentAssetFixtureKey: LawPracticeFixtureKey.annotateKey({
      description: "Fixture key for the patent asset this claim belongs to.",
    }).pipe(ClaimEntity.pg.text(), ClaimEntity.pg.columnName("patent_asset_fixture_key")),
    text: LawPracticeText.annotateKey({
      description: "Full claim text.",
    }).pipe(ClaimEntity.pg.text()),
    ...ClaimEntity.identityFields,
  },
  $I.annote("Claim", {
    description: "Patent claim entity for a single numbered claim under a patent asset.",
  }),
  ClaimEntity.entityExtras
) {}
```

**PatentAsset** — the prosecution object a CAD model would hang from:

```49:69:packages/law-practice/domain/src/entities/PatentAsset/PatentAsset.model.ts
export class PatentAsset extends PatentAssetEntity.Entity<PatentAsset>(PatentAssetEntity.tableName)(
  {
    fixtureKey: LawPracticeFixtureKey.annotateKey({
      description: "Stable fixture key for the patent asset.",
    }).pipe(PatentAssetEntity.pg.text(), PatentAssetEntity.pg.columnName("fixture_key")),
    matterFixtureKey: LawPracticeFixtureKey.annotateKey({
      description: "Fixture key for the matter this patent asset belongs to.",
    }).pipe(PatentAssetEntity.pg.text(), PatentAssetEntity.pg.columnName("matter_fixture_key")),
    status: PatentAssetStatus.annotateKey({
      description: "Patent asset lifecycle status.",
    }).pipe(PatentAssetEntity.pg.text()),
    title: LawPracticeText.annotateKey({
      description: "Human-readable patent asset title.",
    }).pipe(PatentAssetEntity.pg.text()),
    ...PatentAssetEntity.identityFields,
  },
  $I.annote("PatentAsset", {
    description: "Patent asset entity managed inside a prosecution matter.",
  }),
  PatentAssetEntity.entityExtras
) {}
```

Shared field bricks: `LawPracticeFixtureKey` / `LawPracticeText` / `ClaimNumber` in `packages/law-practice/domain/src/entities/LawPracticeEntity.fields.ts:29-114`. Joins are **stable fixture keys**, not entity-id FKs (`Party.model.ts:28-30` states this explicitly).

Convention for a new CAD entity: `ProductEntity.make(LawPractice.CadModelId)` + `fixtureKey` + parent `patentAssetFixtureKey` / `matterFixtureKey` + `…identityFields`. Identity first in `packages/shared/domain/src/identity/LawPractice/`.

---

## 2. GRAPH MODEL

Three substrates. They are **not** interchangeable.

### 2.1 Practice KG — closed node/edge projection (the agent-facing spine)

This is the graph `apps/practice-kg-mcp` serves. It is **not** a generic RDF store and **not** a foreign-key walk of Matter/Claim.

**Closed node kinds** (`packages/law-practice/domain/src/values/KgNodeKind/KgNodeKind.model.ts:39-51`):

```
client | docket_family | docket | application | patent | document | email_archive
```

Docs on that kit (`KgNodeKind.model.ts:17-20`): the set is closed; members are the `kind` discriminator on every `kg_node` row; **adding a kind is a projection-schema change**, not a local edit.

**Closed predicates** (`KgEdgePredicate.model.ts:38-52`):

```
has_docket_family | has_docket | files_as | granted_as | has_document
| family_document | archived_in | continuation_of | enriched_family
```

**Physical tables** (Drizzle `pgTable`, packet-owned, disposable PGlite):

```70:81:packages/law-practice/tables/src/entities/KgNode/KgNode.read-model-table.ts
export const kgNodeTable = pgTable(KG_NODE_TABLE_NAME, {
  iri: text("iri").primaryKey(),
  kind: text("kind").notNull().$type<KgNodeKind>(),
  naturalKey: text("natural_key").notNull(),
  label: text("label").notNull(),
  docketFamily: text("docket_family"),
  client: text("client"),
  epistemicStatus: text("epistemic_status").notNull(),
  provenanceKind: text("provenance_kind").notNull(),
  provenanceRef: text("provenance_ref").notNull(),
  payload: jsonb("payload").notNull().$type<UnknownRecord>(),
});
```

```67:82:packages/law-practice/tables/src/entities/KgEdge/KgEdge.read-model-table.ts
export const kgEdgeTable = pgTable(
  KG_EDGE_TABLE_NAME,
  {
    subjectIri: text("subject_iri")
      .notNull()
      .references(() => kgNodeTable.iri),
    predicate: text("predicate").notNull().$type<KgEdgePredicate>(),
    objectIri: text("object_iri")
      .notNull()
      .references(() => kgNodeTable.iri),
    epistemicStatus: text("epistemic_status").notNull(),
    provenanceKind: text("provenance_kind").notNull(),
    provenanceRef: text("provenance_ref").notNull(),
  },
  (table) => [primaryKey({ columns: [table.subjectIri, table.predicate, table.objectIri] })]
);
```

IRI minting (`PracticeKg.projections.ts:42`, `:198`):

```ts
const graphIdentity = $BeepId.create("practice-kg");
const graphIri = (kind: KgNodeKind, naturalKey: string): string =>
  graphIdentity.create(kind).create(naturalKey).iri;
// e.g. urn:beep:practice-kg:docket:AB-1234
```

How the spine is actually built (`PracticeKg.projections.ts:285-449`):

| From catalog row | Nodes | Edges |
| --- | --- | --- |
| every file | `document` (natural key = SHA-256 digest) | — |
| `category === "email-archive"` | also `email_archive` | later `archived_in` from email-export docs |
| `docketFamily` set | `docket_family` | `family_document` if no docket |
| `docket` + family | `docket` | `has_docket`, `has_document` |
| `client` + family | `client` | `has_docket_family` |
| USPTO enrichment `resolved` | `application`, `patent` | `enriched_family`, `files_as`, `continuation_of`, `granted_as` |

DDL is **raw SQL**, not drizzle-kit (`PracticeKg.projections.ts:150-156`): the PGlite store is rebuilt whole each bundle; Drizzle declarations remain the schema authority and tests assert column-set equality.

Spine writers force `epistemicStatus = "derived-from-official-records"` (`PracticeKg.schemas.ts:23-32`). Comment is explicit: **candidate material must never be written through `kg_node`/`kg_edge`** — candidates live in epistemic tables.

### 2.2 Epistemic — bitemporal assertion graph (supports / refutes / contradicts)

Separate from the practice spine. `EdgeVersion` is one immutable version of one logical edge (`packages/epistemic/domain/src/entities/EdgeVersion/EdgeVersion.model.ts:107-185`):

- Endpoints: tagged union `claim | evidence | entity | observation` (`EdgeEndpoint.model.ts:98-155`).
- Relations: `supports | refutes | contradicts` (`EdgeRelation.model.ts:13`).
- Bitemporal half-open BIGINT millis: `[validFrom, validTo)`, `[recordedAt, expiredAt)`, `supersedesId` lineage. No `isLatest` flag.
- Optional `matterScope` / `evidenceScope` / `qualifiers` / `fact` JSONB.
- Entity endpoints are **opaque tokens** (`EdgeEntityRef`), not FKs — “the referenced entity may live in any slice” (`EdgeEndpoint.model.ts:16-17`).

This is the substrate for “figure *supports* claim 1” or “this render *was derived from* disclosure v3.”

### 2.3 Ontology — RDF/OWL/SHACL workbench (not the practice KG)

`packages/ontology` is a Turtle session: quads, SPARQL, SHACL, PROV-O sidecars. It does **not** store Matter/Claim/CAD instances. See §5.

### 2.4 Domain relations are fixture keys, not graph edges

`LegalClient.fixtureKey` ← `Matter.legalClientFixtureKey` ← `PatentAsset.matterFixtureKey` ← `Claim.patentAssetFixtureKey`. That chain is **not** projected into `kg_edge`. The practice KG’s “client” is a catalog string, not `LegalClient`.

---

## 3. DOCUMENT MODEL (`packages/documents`)

### 3.1 What a document is

A `Document` is **not** a ProductEntity and **has no table**. It is a vault-materialized aggregate:

```190:208:packages/documents/domain/src/aggregates/Document/Document.model.ts
export class Document extends S.Class<Document>($I`Document`)(
  {
    contentDigest: DocumentContentDigest.annotateKey({
      description: "Deterministic content digest for the filed source bytes.",
    }),
    filing: FilingOutcome.annotateKey({
      description: "Filing outcome that produced this document's vault placement.",
    }),
    originalFileName: S.NonEmptyString.annotateKey({
      description: "Original filename supplied by the source drop.",
    }),
    vaultPath: ProjectedVaultPath.annotateKey({
      description: "Deterministic vault-relative materialization path.",
    }),
  },
  $I.annote("Document", {
    description: "A document materialized into the workspace vault.",
  })
) {}
```

`DocumentContentDigest` is a branded non-empty string; intake computes SHA-256 (`DocumentIntake.service.ts:45-46`). Bytes are written atomically under the workspace vault root (`DocumentIntake.service.ts:48-63`, `:143`). **No blob column.**

Filing is a tagged union: `filed` (taxonomy concept + confidence) or `inboxed` (`llm-unavailable | low-confidence | no-match`) (`Document.model.ts:16-67`).

### 3.2 How a document links to a matter

**Path context, not a Matter FK.** `VaultFilingContext` (`Taxonomy.model.ts:278-296`):

- `clientStableKey` / `clientDisplayName`
- `matterStableKey` / `matterDisplayName`

Default before matter resolution: `client-default` / `matter-general` (`Taxonomy.model.ts:312-317`). Projected path:

```
matters/<clientStableKey>/<matterStableKey>/<sortKey>-<folderSegment>/<stem>--<shortDigest>.<ext>
```

(`Taxonomy.projection.ts:19-21`, `:122-140`; example in `Document.model.ts:178-181`.)

Taxonomy already has a prosecution bucket: `LegalDocumentConceptId` includes `"ip-prosecution-and-portfolio"`, `"exhibits-and-evidence"`, `"client-source-materials"` (`Taxonomy.model.ts:32-56`). FOLIO-aligned SKOS concepts with IRIs like `https://ns.beep.sh/documents/taxonomy/legal-document#pleadings`.

### 3.3 What is persisted

`packages/documents/tables` has **only** sync-state tables (`tables.ts:42-47`): `documents_sync_item`, `documents_sync_operation`, `documents_sync_cursor`, `documents_sync_conflict`. These are DMS/vault-mirror bookkeeping, not a document catalog.

### 3.4 Chunking / search (practice KG, not documents)

The documents slice does **not** chunk. The practice KG does:

- DuckDB `document_text` + hand-rolled BM25 (`PracticeKg.fts.ts:125-175`): tokenize extracted text, `fts_postings` / `fts_bm25`.
- MCP `corpus_search_text` returns digest + snippet; `corpus_get_document` returns a bounded 1-based char range (default start=1, length=2 MiB) or degrades to a corpus pointer (`PracticeKg.tools.ts:83-102`, `:766-770`).
- Bundle README: “source documents and email bodies remain pointers into the separately configured corpus root” (`PracticeKg.projections.ts:44-49`).

A CAD figure PNG would be searchable only if someone extracts text (captions / OCR). The 3D model itself would be a digest + pointer, like any other oversized binary.

### 3.5 Provenance / citation spans

Shared substrate is `@beep/provenance` `TextAnchor` — half-open UTF-16 range + exact quote (`packages/foundation/modeling/provenance/src/TextAnchor.ts:1-58`):

```
startChar, endChar, quote   // source.slice(startChar, endChar) === quote
```

Epistemic wraps it as `EvidenceSpan` = `TextAnchorFields` + `Confidence` (`UnitInterval`) (`EvidenceSpan.model.ts:163-168`). Evidence entity: `artifactFixtureKey`, `spanFixtureKey`, `span` JSONB (`Evidence.model.ts:55-72`).

Version-exact binding (the pattern CAD derivation should copy):

- `TextAnchorVerificationReceipt` = `{ anchor, source: SourceTextIdentity }` (`VerifiedTextAnchor.ts:161-171`). Receipt existence is **not** live proof; callers must re-run `verifyTextAnchor`.
- `ObservationVersionRef` = `{ eventId, textDigest }` (`ObservationVersionRef.model.ts:59-71`) — both halves required so a re-observation cannot silently inherit an old judgment.
- `EvidenceVerification` is an append-only sidecar sealing `(evidenceId, verifiedAnchor)` (`EvidenceVerification.model.ts:39-59`).

**There is no image-region / view-frustum / mesh-element locator.** Spans are text. A figure callout “numeral 12 at bbox …” would need a new value object beside `TextAnchor`, not a reuse of `EvidenceSpan`.

---

## 4. EPISTEMIC LAYER (`packages/epistemic`)

### 4.1 Primitives

| Primitive | File | Role |
| --- | --- | --- |
| `CandidateClaim` | `domain/src/entities/CandidateClaim/CandidateClaim.model.ts` | Agent-proposed claim: `fixtureKey`, `lifecycle`, `snapshot` JSONB |
| `ClaimLifecycle` | shared `packages/shared/domain/src/values/ClaimLifecycle/ClaimLifecycle.model.ts:18` | `candidate → shape_valid → consistency_checked → admitted` |
| `ClaimDisposition` | `…/ClaimDisposition/ClaimDisposition.model.ts` | Durable admit/reject + verbatim SHACL violations |
| `Evidence` | `…/Evidence/Evidence.model.ts` | Artifact + `EvidenceSpan` |
| `EvidenceVerification` | `…/EvidenceVerification/EvidenceVerification.model.ts` | Append-only verified manifestation |
| `Activity` | `…/Activity/Activity.model.ts` | Provenance activity: `fixtureKey` + `snapshot` |
| `EdgeVersion` | `…/EdgeVersion/EdgeVersion.model.ts` | Bitemporal logical edge |
| `ContradictionCandidate` / `Receipt` / `Disposition` | `…/Contradiction/Contradiction.model.ts` | Evidence-backed pair + valid-time + human disposition |
| `UsageRecord` | `…/UsageRecord/UsageRecord.model.ts` | (usage ledger; not CAD-critical) |

Practice-KG *labels* (orthogonal, two-valued) live in law-practice, not epistemic:

```39:42:packages/law-practice/domain/src/values/PracticeKgEpistemicStatus/PracticeKgEpistemicStatus.model.ts
export const PracticeKgEpistemicStatus = LiteralKit(["derived-from-official-records", "candidate-unreviewed"]).pipe(
```

```38:46:packages/law-practice/domain/src/values/PracticeKgProvenanceKind/PracticeKgProvenanceKind.model.ts
export const PracticeKgProvenanceKind = LiteralKit([
  "catalog-digest",
  "uspto-anchor",
  "organize-row",
  "extract-operation",
]).pipe(
```

### 4.2 What “this rendering is derived from disclosure X, version 3” means here

Map the English onto existing primitives — do not invent a fourth status enum.

1. **The disclosure version** is an `ObservationVersionRef`-shaped pair: a durable id for the source observation *plus* a content digest of the exact bytes/text that observation carried. For CAD, the digest is the source model (or disclosure PDF) SHA-256, not a re-observation of the same event id.

2. **The render act** is an `Activity` (`fixtureKey` + `snapshot` of renderer, camera, commit, schema version). Same role as today’s “runtime-proof:turn-1” activity.

3. **The assertion** is an `EdgeVersion`:
   - `sourceKind: "entity"` / `sourceEntityRef: "cad-figure:<fixtureKey>"` (or `"observation"` if the render is treated as an observation).
   - `targetKind: "entity"` / `targetEntityRef: "disclosure:<fixtureKey>"` **or** `targetKind: "claim"` if the figure is offered as support for a patent claim.
   - `relation: "supports"` (derived-from is a support edge with qualifiers, not a new relation — the relation kit is closed at `supports|refutes|contradicts`).
   - `qualifiers: { derivedFrom: "disclosure", sourceVersion: "3", renderer: "…" }`.
   - `validFrom` / `validTo` = when that derivation was held true (model version interval).
   - `recordedAt` / `expiredAt` / `supersedesId` = when the system learned it / when a newer render replaced it.
   - `matterScope` = matter fixture key.

4. **Authority label on the practice spine** (if the figure is also a `kg_node`): start as `candidate-unreviewed` + `provenanceKind: "extract-operation"` (or a new kind — see §8). Promote to `derived-from-official-records` only if the figure is reconcilable against an official drawing sheet in the corpus catalog. Spine writers today refuse candidate rows (`PracticeKg.schemas.ts:23-32`), so CAD candidates belong in epistemic tables until admitted.

5. **Contradictions:** two figures that number the same part differently, or a figure that does not match claim language, become a `ContradictionCandidate` over two `EdgeVersion` / belief versions — human `ContradictionDisposition`, never auto-resolved. Same pattern as law-practice `LegalOppositionCandidate`.

6. **Admission of a *patent* claim about a figure** uses shared `ClaimLifecycle` (Distinction already does: `lifecycleState: ClaimLifecycle` in `Distinction.model.ts:76-78`). Epistemic `CandidateClaim` is the agent-proposed *knowledge* claim (“FIG. 3 shows a hinge pin 12”), not the USPTO numbered claim entity.

---

## 5. ONTOLOGY LAYER (`packages/ontology`)

### 5.1 Formalism

Yes: **TS-native RDF over Turtle**, with real-engine SHACL and a structural RDFS/OWL-RL-subset reasoner.

- Session aggregate holds a `Dataset` of quads (`Session.model.ts:14-35`). N3/Turtle IO is owned by server/drivers, not the domain model (`Session.model.ts:5-7`).
- Partitions: `asserted | ontologies | inferred | shapes | provenance` (`Session.model.ts:94-108`). SHACL `NodeShape` / `property` are first-class (`Session.model.ts:38-40`).
- Persistence: filesystem Turtle under a canonical root; paths must be root-relative POSIX `*.ttl` (`Session.file-store.ts:38-45`).
- Validation: `@beep/semantic-web/services/shacl-validation` (`Session.validation.ts:36-43`). Toolkit advertises `reasonerProfile: "structural-rdfs-owl-rl-subset"` and `casAlgorithm: "rdfc-1.0"` (`OntologyToolkit.ts:680-688`).
- Provenance export writes **PROV-O** sidecars (`OntologyToolkit.ts:825-831`; vocab imports in `Session.validation.ts:27-32`).
- Fixtures include `prov-o-starting-point.ttl`, pizza tutorial, and ontoauthor MAT tasks (subsumption, existential, universal, disjointness, sameAs, unsatisfiability) under `packages/ontology/server/test/fixtures/`.

**This is a conceptual-modeling workbench, not the practice instance graph.** You would *not* store every CAD vertex as an OWL individual in a Session. You *would* add a CAD/figure OWL vocabulary + SHACL shapes if agents need to reason “Figure depicts Embodiment; Embodiment realizes ClaimLimitation.”

### 5.2 How new *product* concepts are added (the CAD path)

Not by editing Turtle. The scaffold is:

```bash
bun run beep architecture plan > /tmp/architecture-plan.json
bun run beep architecture check --file /tmp/architecture-plan.json
bun run beep architecture apply --file /tmp/architecture-plan.json

# ergonomic:
bun run beep architecture create slice architecture-lab WorkItem --stage core --dry-run
bun run beep architecture add concept architecture-lab Worker --domain-kind entities --stage persistence --dry-run
bun run beep architecture add concept architecture-lab WorkPriority --domain-kind values --stage core --dry-run
```

Cited from `packages/tooling/tool/cli/README.md:58-99`.

Domain-kind archetypes (`README.md:92-99`, `RoleTopology.ts:53-87`):

| Kind | Roles generated | Proven by |
| --- | --- | --- |
| `aggregates` | domain, use-cases, config, server, tables, client, ui, proof-app, db-admin | `aggregates/WorkItem` |
| `entities` | domain, use-cases, server, tables, db-admin | `entities/Worker` |
| `values` | domain only | `values/WorkPriority` |

For `entities` / stage `core`, the plan writes (retargeted from `AcceptedProofManifest.ts:180-208`):

- `packages/<slice>/domain/src/entities/<Concept>/{index,Concept.model,Concept.values,Concept.behavior}.ts`
- `packages/<slice>/domain/test/<Concept>.test.ts`
- barrel updates via ts-morph

`--stage persistence` adds use-cases (commands, errors, repository, service), server (layer, repo), tables (`Concept.table.ts`), and a db-admin migration-target hook.

`create package` does **not** create concept modules (`README.md:85-89`). Documents-domain README even says so (`packages/documents/domain/README.md:5`).

CAD entities should be `beep architecture add concept law-practice CadModel --domain-kind entities --stage persistence` (and `Figure`, `ReferenceNumeral` as entities or values). A CAD *vocabulary* in ontology is a separate Turtle/SHACL authoring task via `ontology_propose_change_batch`.

---

## 6. THE MCP SURFACE (`apps/practice-kg-mcp`)

### 6.1 Split of ownership

Per `apps/practice-kg-mcp/README.md:7-9`: the app owns the runnable process and runtime layers only. Tool **declarations** live in `law-practice/use-cases`; **projections/queries** in `law-practice/server`.

Host (`apps/practice-kg-mcp/src/runtime/Host.ts:117-129`):

- reads `bundle.manifest.json`
- opens `kg.pglite` (PGlite) + `practice.duckdb` (DuckDB)
- launches `makePracticeKgServerLayer` as stdio MCP named `beep-practice-kg`

Auth gate is `"none"`; credential is just `PRACTICE_KG_BUNDLE_DIR` (`law-practice/server/src/Tools.ts:57-61`). Closed-world, read-only, non-destructive, idempotent (`PracticeKg.tools.ts:625-634`).

### 6.2 Nine live tools

Declared in `packages/law-practice/use-cases/src/PracticeKg.tools.ts`, composed in `Tools.ts:35-45`:

| Tool | Params | Purpose |
| --- | --- | --- |
| `kg_clients` | `budgetBytes` | Sparse client attribution |
| `kg_docket_family` | `family`, `budgetBytes` | Family → dockets / apps / patents / docs |
| `kg_application_lookup` | `application_number` \| `patent_number` \| `docket` | Walk `files_as` / `granted_as` / `continuation_of` / `enriched_family` |
| `kg_find` | `query` | Label / natural-key fragment (not unsorted docs) |
| `corpus_search_text` | `query`, optional `family`, `limit` | BM25 + digest-cited snippets |
| `corpus_get_document` | `digest` \| `organized_path`, `range` | Bounded text or corpus pointer |
| `email_search` | header filters | Archive-level matter heuristic only |
| `kg_candidate_claims` | `digest` \| `docket` \| `family` | Unreviewed claims + evidence spans, or typed not-loaded |
| `kg_provenance` | `digest` \| `iri` \| `natural_key` | Node/doc provenance; no key → bundle status |

Every success is `PracticeKgToolResult`: `{ bundle_version, data: ColumnarEnvelope, epistemic_status, note?, tier, total, truncated }` (`PracticeKg.tools.ts:187-200`). Field tiers `minimal | balanced | complete` (`defineFieldTiers`). Handlers pick the richest tier that fits `budgetBytes` (`PracticeKg.tool-handlers.ts:56-80`).

### 6.3 Verbatim template (copy this for CAD)

```636:671:packages/law-practice/use-cases/src/PracticeKg.tools.ts
const readTool = <Name extends string, Parameters extends S.Top, Success extends S.Top>(
  name: Name,
  description: string,
  parameters: Parameters,
  success: Success
) =>
  annotateFourHints(
    Tool.make(name, {
      description,
      failure: PracticeKgToolError,
      failureMode: "return",
      parameters,
      success,
    }),
    closedWorldReadOnlyHints
  );

export const KgClientsTool = readTool(
  "kg_clients",
  "List client attribution. Attribution is sparse; docket families are the primary practice spine.",
  BudgetParams,
  PracticeKgToolResult
);
```

Ontology toolkit is a **different** convention (`ontology_<verb>`, CAS fingerprints, mutation hints) — do not mix it into practice-KG CAD tools.

### 6.4 What a CAD toolset should look like

Same file, same `readTool`, same `PracticeKgToolResult` / columnar tiers. Suggested names (closed-world, read-only):

| Tool | Analog | Params |
| --- | --- | --- |
| `cad_find` | `kg_find` | query over model/figure labels |
| `cad_model` | `kg_docket_family` | model fixture key / digest → figures + numerals |
| `cad_get_figure` | `corpus_get_document` | figure digest / numeral → pointer or caption range |
| `cad_numerals` | `kg_candidate_claims` | figure → reference numerals + claim/spec spans |
| `cad_provenance` | `kg_provenance` | model/figure/render identity → derivation chain |

Mutating “generate figure / update model” does **not** fit this host (offline bundle reader, `openWorld: false`, `readOnly: true`). Generation would be a separate governed toolkit (ontology-style mutation + TierGate), not a ninth practice-KG tool.

---

## 7. PERSISTENCE

### 7.1 Engines

| Store | Where | What |
| --- | --- | --- |
| **PostgreSQL / PGlite** via Drizzle (`drizzle-orm/pg-core`) | entity tables | candor, legal-position, epistemic, documents-sync, architecture-lab, workspace |
| **PGlite file `kg.pglite`** | practice KG bundle | `kg_node`, `kg_edge`, `kg_build` — raw DDL, no migrations |
| **DuckDB `practice.duckdb`** | practice KG bundle | catalog, `document_text`, emails, BM25, enrichment |
| **Workspace vault (filesystem)** | documents | SHA-256-named files |
| **Turtle files** | ontology workspace | `*.ttl` sessions + PROV sidecars |

`packages/_internal/db-admin/drizzle.config.ts:10-20`: `dialect: "postgresql"`, schema `./src/schema.ts`, out `./drizzle`. Default URL `postgres://postgres:postgres@127.0.0.1:5432/postgres` (or `BEEP_TEST_DATABASE_URL`).

### 7.2 How a new entity gets a table

1. Schema-first entity with `ProductEntity.make` + `pg.text()` / `pg.jsonb()` / `pg.columnName`.
2. Tables role: `Concept.table.ts` + converters (see Worker / CandorDisposition).
3. **Flat re-export** from `packages/_internal/db-admin/src/schema.ts` — drizzle-kit only sees top-level `pgTable` exports (`schema.ts:3-8`). Exporting a `DbSchema` aggregate is not enough.
4. Register a `DbAdminMigrationTarget` (`migrations/LawPracticeCandorGate.ts:30-39` is the template):

```ts
export const LawPracticeCandorGateMigrationTarget: DbAdminMigrationTarget = DbAdminMigrationTarget.make({
  drizzleSchema: { candorDisposition, idsSubmissionFact, patentCitationEvent },
  name: "law-practice-candor-gate",
  schemaName: "law_practice",
  tables: [
    "law_practice_patent_citation_event",
    "law_practice_candor_disposition",
    "law_practice_ids_submission_fact",
  ],
});
```

5. Add it to `DbAdminMigrationTargets` in `targets.ts:54-64`.
6. Generate SQL under `packages/_internal/db-admin/drizzle/<timestamp>_<name>/migration.sql` + `snapshot.json`. Drift check: `scripts/check-migrations-drift.ts` fails if `schema.ts` changed without a committed migration (runs drizzle-kit against a scratch copy; never writes the real `drizzle/`).

Current law-practice **migrated** tables: candor-gate (3) + legal-position (5). `kg_*` are **not** in db-admin. Matter/Claim/PatentAsset are **not** in db-admin.

Existing drizzle folders: `20260813130540_baseline`, `20260813143745_baseline-functions`, `20260814001821_law_practice_st13_office_identity`.

### 7.3 ProductEntity identity columns (what every new table gets)

From `packages/shared/domain/src/entity/ProductEntity.ts:56-70` plus kit fields (`:50-54`): `entity_type`, serial `id` PK, `public_id`, `org_id`, `row_version`, `schema_version`, `source`, `created_at` / `updated_at` (BIGINT millis), `created_by_principal` / `updated_by_principal` (JSONB). Local fields **precede** `…identityFields`.

---

## 8. VERDICT — schema-first CAD sketch

### 8.1 Do not put CAD *only* in ontology, and do not pretend it is already a `kg_node`

- Ontology Session = vocabulary + SHACL, optional later.
- `KgNodeKind` has no `figure` / `cad_model`. Adding one is a **closed-kit + projection + every consumer** change (`KgNodeKind.model.ts:17-20`).
- `PatentFigure` is a published-image URL. Reuse the *label* convention (`FIG. 1`); do not stretch it to own STEP bytes or numerals.

### 8.2 Reuse (do not recreate)

| Existing | Use for CAD |
| --- | --- |
| `Document` + `DocumentContentDigest` + vault write | STEP/GLB/PNG/SVG bytes |
| `VaultFilingContext` + taxonomy `ip-prosecution-and-portfolio` (or `exhibits-and-evidence` / `client-source-materials`) | Matter-scoped path |
| `PatentFigure.label` / `PatentSectionKind.drawings` | Display labels; drawing-section enum |
| `LawPracticeFixtureKey` parent links | `patentAssetFixtureKey` / `matterFixtureKey` |
| `TextAnchor` / `EvidenceSpan` / `ObservationVersionRef` | Spec/claim quotes; version-exact “derived from disclosure v3” |
| `Activity` | Render / extract pipeline snapshot |
| `EdgeVersion` + `EdgeEntityRef` + `supports` | Figure supports claim; model derived-from disclosure |
| `ClaimLifecycle` / `CandidateClaim` | Unreviewed numeral/claim alignments |
| `PracticeKgEpistemicStatus` + `PracticeKgProvenanceKind` | Spine authority labels |
| `kg_node` kind `document` | Filed drawing PDF/TIFF already in the corpus |
| `readTool` + `PracticeKgToolResult` | CAD MCP tools |
| `beep architecture add concept … --domain-kind entities` | Scaffold |

### 8.3 New domain (law-practice, entities archetype)

Scaffold:

```bash
bun run beep architecture add concept law-practice CadModel --domain-kind entities --stage persistence
bun run beep architecture add concept law-practice CadFigure --domain-kind entities --stage persistence
bun run beep architecture add concept law-practice ReferenceNumeral --domain-kind entities --stage persistence
bun run beep architecture add concept law-practice CadFigureSet --domain-kind values --stage core
```

Identities first: `packages/shared/domain/src/identity/LawPractice/{CadModel,CadFigure,ReferenceNumeral}Id.ts`.

**`CadModel`** (ProductEntity, like `PatentAsset`):

- `fixtureKey`
- `patentAssetFixtureKey` (and/or `matterFixtureKey`)
- `contentDigest` — **reuse `DocumentContentDigest`**, do not invent a second hash type
- `format` — `LiteralKit(["step", "stp", "glb", "gltf", "fcstd", "stl", …])`
- `schemaVersion` / `sourceRevision` — the “version 3” slot
- `displayName`
- optional `vaultPath` or `documentDigest` pointing at the filed Document

**`CadFigure`** (ProductEntity; **not** a clone of `PatentFigure`):

- `fixtureKey`
- `cadModelFixtureKey`
- `figureSetKey` (optional; `CadFigureSet` value = sheet / embodiment grouping)
- `label` — reuse `PatentFigure`’s “FIG. 1” string convention
- `viewKind` — `LiteralKit(["perspective", "exploded", "section", "ortho-front", …])`
- `contentDigest` — rendered PNG/SVG/PDF
- `renderActivityFixtureKey` → `Activity`
- `derivedFromObservation` — `ObservationVersionRef`-shaped `{ sourceId, textDigest }` generalized off patent-citation, **or** a new `SourceVersionRef` value that is digest + entity id without hard-wiring `PatentCitationEventId`
- optional `publishedAs: Option<PatentFigure>` when the same sheet later appears as a USPTO image URL

**`ReferenceNumeral`** (ProductEntity):

- `fixtureKey`
- `cadFigureFixtureKey`
- `numeral` — branded non-empty string (`"12"`, `"12a"`)
- `partName` — `LawPracticeText`
- `specAnchor` — `TextAnchor` JSONB into the specification
- `claimFixtureKeys` — `S.Array(LawPracticeFixtureKey)` or a join entity if cardinality must be queried
- `lifecycleState` — `ClaimLifecycle` (same as `Distinction`)

**`CadFigureSet`** (value, not necessarily a table): embodiment / sheet grouping key + ordered figure fixture keys.

### 8.4 Edges

**Domain (fixture keys):**

```
LegalClient --fixture--> Matter --fixture--> PatentAsset
                              \-> CadModel --fixture--> CadFigure --fixture--> ReferenceNumeral
PatentAsset --fixture--> Claim  <---- claimFixtureKeys ---- ReferenceNumeral
CadModel.contentDigest / CadFigure.contentDigest --eq--> Document.contentDigest
```

**Practice KG (only if agents must walk CAD on the portable bundle).** Widen the closed kits — this is the expensive, explicit change:

```
KgNodeKind    += cad_model | figure | reference_numeral
KgEdgePredicate += has_cad_model | has_figure | depicts | numbered_as | derived_from
PracticeKgProvenanceKind += cad-render   # or overload extract-operation
```

Suggested triples (same `createEdge` helper, `urn:beep:practice-kg:figure:<digest>`):

```
application|docket  --has_cad_model--> cad_model
cad_model           --has_figure------> figure
figure              --numbered_as-----> reference_numeral
figure              --derived_from----> document     # disclosure PDF / spec
reference_numeral   --depicts---------> document     # only if you also project claims as nodes
                                                     # (today claims are NOT kg nodes)
```

Until that kit widening ships, **do not** smash CAD into `kind: "document"`. A figure is not a docket PDF; `has_document` would lie about the spine.

**Epistemic (do this even if you skip KG widening):**

```
entity:cad-figure:<fk>  --supports--> claim:<ClaimId>     qualifiers: { numeral: "12" }
entity:cad-figure:<fk>  --supports--> entity:cad-model:<fk>
entity:cad-figure:<fk>  --supports--> observation:<disclosure-v3>
```

Bitemporality on `EdgeVersion` carries “version 3”: new render → new `EdgeVersion` with `supersedesId`, old `validTo` / `expiredAt` set. Do **not** UPDATE the old row.

### 8.5 Placement decision tree

| Artifact | Goes here | Does not go here |
| --- | --- | --- |
| `.step` / `.glb` bytes | vault `Document` + `CadModel.contentDigest` | `kg_node.payload`, Postgres bytea, ontology literal |
| Rendered FIG. 3 PNG | vault `Document` + `CadFigure` | `PatentFigure.url` alone (no digest, no matter) |
| “FIG. 3 is derived from disclosure v3” | `EdgeVersion` + `Activity` + version ref | a new boolean on `CadFigure` |
| “numeral 12 is the hinge pin in claim 1” | `ReferenceNumeral` + `TextAnchor` + optional `supports` edge | BM25 snippet only |
| Agent browse on the portable bundle | widen `KgNodeKind` / predicates, then project | ontology SPARQL over Turtle |
| OWL “Figure depicts Embodiment” | ontology Session + SHACL | `kg_edge` (wrong substrate) |

### 8.6 First implementation slice (schema → service → impl)

1. Shared IDs + `CadModel` / `CadFigure` / `ReferenceNumeral` domain entities (fixture-key parents).
2. Generalized `SourceVersionRef` (id + digest) so derivation is not wired to `PatentCitationEventId`.
3. Documents intake: accept CAD/PNG MIME; file under `ip-prosecution-and-portfolio`.
4. Epistemic edges for figure→claim and figure→disclosure (handlers only; no KG kit change).
5. MCP `cad_*` tools **only after** a projection exists — or serve them from entity repos, not from `kg_node`.
6. Widen `KgNodeKind` in a dedicated projection-schema PR when the portable bundle must include CAD.

That is where CAD goes: **vaulted bytes + law-practice entities hanging off `PatentAsset`/`Matter`, asserted through epistemic `EdgeVersion`, optionally projected onto the closed practice-KG spine, with ontology reserved for the vocabulary — not the instances.**
