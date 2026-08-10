<!-- P0 evidence. Produced 2026-08-06 by an Opus 5 subagent (p0-surfaces) under
goals/legal-position-relator-runtime GOAL.md P0; orchestrated per SPEC decision 3.
All 15 SOURCES.md §4 anchors re-verified against main @ 8fbbf1ef63. -->

# P0 surface re-verification — `goals/legal-position-relator-runtime`

Repo: `/home/elpresidank/YeeBois/projects/beep-effect18`
Branch: `feat/legal-position-relator-runtime` (working tree clean at verification time)
Date: 2026-08-06
Mode: READ-ONLY. No repo file was modified.

**Overall verdict: all 15 anchors CURRENT. Zero DRIFTED, zero MISSING.**

---

## 1. LiteralKit definition + barrel export

**Expected:** `packages/foundation/modeling/schema/src/LiteralKit/LiteralKit.schema.ts:747` — `LiteralKit`
definition; barrel export at `packages/foundation/modeling/schema/src/index.ts:285`.

**Found at:** `packages/foundation/modeling/schema/src/LiteralKit/LiteralKit.schema.ts:747`

```
747:export function LiteralKit<const L extends Literals>(literals: L): LiteralKit<L>;
```

`:747` is the first of three overload signatures; `:766` is the enum-mapping overload and `:785` is the
implementation signature.

**Barrel:** `packages/foundation/modeling/schema/src/index.ts:285`

```
285:export * from "./LiteralKit/index.ts";
```

(`:300` re-exports `MappedLiteralKit` separately.)

**Verdict: CURRENT** (both).

---

## 2. `Principal` five-member tagged union

**Expected:** `packages/shared/domain/src/entity/Principal.ts:244` — five-member tagged union.

**Found at:** `packages/shared/domain/src/entity/Principal.ts:244`

```
244:export const Principal = S.Union([
245:  UserPrincipal,
246:  ServiceAccountPrincipal,
247:  AgentPrincipal,
248:  ConnectorAccountPrincipal,
249:  SystemPrincipal,
250:]).pipe(
251:  $I.annoteSchema("Principal", { ... }),
254:  S.toTaggedUnion("kind"),
255:  SchemaUtils.withCodecStatics
256:);
```

**Member count: 5. Confirmed.** Class declarations back each member:

| Member class | Declared at | Discriminant value (`kind`) |
| --- | --- | --- |
| `UserPrincipal` | `:75` | `"User"` |
| `ServiceAccountPrincipal` | `:104` | `"ServiceAccount"` |
| `AgentPrincipal` | `:143` | `"Agent"` |
| `ConnectorAccountPrincipal` | `:180` | `"ConnectorAccount"` |
| `SystemPrincipal` | `:215` | `"System"` |

Load-bearing detail: the discriminant field is **`kind`**, not `_tag` — `S.toTaggedUnion("kind")` at
`:254`. The JSDoc example at `:265-268` shows the decoded shape `{ kind: "System", component: "Runtime" }`.
Runtime type alias at `:275`; encoded namespace type at `:312`.

**Verdict: CURRENT.**

---

## 3. `BaseEntity` principal fields + persisted jsonb strategy

**Expected:** `packages/shared/domain/src/entity/BaseEntity.ts:82` / `:88` for `createdByPrincipal` /
`updatedByPrincipal` on `BaseEntity.fields`; persisted jsonb `valueStrategy: "providedByContext"` around
`:108-110` and `:128-130`.

**Found at:** exactly those lines.

Domain fields (`export const fields` opens at `:80`):

```
 82:  createdByPrincipal: Principal,
 88:  updatedByPrincipal: Principal,
```

Persistence descriptors (`export const persisted` opens at `:104`):

```
108:  createdByPrincipal: EntitySchema.persist.jsonb({
109:    valueStrategy: "providedByContext",
110:  }),
...
128:  updatedByPrincipal: EntitySchema.persist.jsonb({
129:    valueStrategy: "providedByContext",
130:  }),
```

Both stated ranges are exact. `persisted` closes at `:131` with
`} as const satisfies EntitySchema.PersistedFor<typeof fields>;`, and `BaseEntityCore` is built at `:133`
via `EntitySchema.ClassFactory($I`BaseEntity`)`.

Sibling `valueStrategy` values in the same block, useful as the vocabulary when adding new persisted
fields: `defaultedOnInsert` (`:106`), `providedByContext` (`:109`, `:113`, `:119`, `:129`),
`incrementedOnWrite` (`:116`), `derived` (`:123`, `:154`), `updatedOnWrite` (`:126`),
`generatedOnInsert` (`:157`), `computedByServiceOnInsert` (`:162`).

**Verdict: CURRENT** (all four sub-anchors).

---

## 4. `LawPractice` EntityId factory + four candor-era registrations

**Expected:** `packages/shared/domain/src/identity/LawPractice.ts` — `EntityId.factory("law_practice", $I)`
at `:12`; candor-era registrations at `:217`, `:304`, `:338`, `:371`.

**Found at:** exactly those lines. File is 382 lines total.

Factory:

```
 11:const $I = $LawPracticeDomainId.create("identity/LawPractice");
 12:const make = EntityId.factory("law_practice", $I);
```

Full registration inventory (13 ids, all via the same `make(...)` helper):

| Line | Export | Entity-type string |
| --- | --- | --- |
| 28 | `LegalClientId` | `legal_client` |
| 55 | `LegalContactId` | `legal_contact` |
| 82 | `MatterId` | `matter` |
| 109 | `PatentAssetId` | `patent_asset` |
| 136 | `OfficeActionId` | `office_action` |
| 163 | `ClaimId` | `claim` |
| 190 | `RejectionId` | `rejection` |
| **217** | **`PriorArtReferenceId`** | `prior_art_reference` |
| 244 | `DistinctionId` | `distinction` |
| 271 | `CitationId` | `citation` |
| **304** | **`PatentCitationEventId`** | `patent_citation_event` |
| **338** | **`CandorDispositionId`** | `candor_disposition` |
| **371** | **`IdsSubmissionFactId`** | `ids_submission_fact` |

The four bolded rows are the requested candor-era registrations, at the stated lines.

### Exact stanza shape to clone for new registrations

Each registration is a **two-export pair** — a `const` schema and a `type` alias — each with its own
JSDoc block. Verbatim from `:317-349` (`CandorDispositionId`), which is the cleanest template:

```ts
/**
 * Candor disposition entity identifier.
 *
 * **Details**
 *
 * A candor disposition records one dated attorney judgment about one exact
 * patent citation event. Dispositions are append-only, so revision and
 * withdrawal append a new record that names the prior id rather than editing
 * what was decided at filing time.
 *
 * **Example** (Read the registered entity type)
 *
 * ```ts
 * import * as LawPractice from "@beep/shared-domain/identity/LawPractice"
 *
 * console.log(LawPractice.CandorDispositionId.entityType)
 * ```
 *
 * @category entity-ids
 * @since 0.0.0
 */
export const CandorDispositionId = make("candor_disposition", {
  description: "Identifier for a law-practice candor disposition entity.",
});

/**
 * Runtime type for {@link CandorDispositionId}.
 *
 * @see {@link CandorDispositionId} for the runtime schema and entity-type metadata.
 * @category entity-ids
 * @since 0.0.0
 */
export type CandorDispositionId = typeof CandorDispositionId.Type;
```

Shape invariants to reproduce, all of which hold across all 13 registrations:

- Snake-case entity-type literal as the sole positional argument to `make`.
- Second argument is an options object whose only key is `description`, phrased
  `"Identifier for a law-practice <thing> entity."`.
- Const JSDoc: title line, `**Details**` prose paragraph, `**Example** (Read the registered entity type)`
  fenced block importing `* as LawPractice from "@beep/shared-domain/identity/LawPractice"` and logging
  `.entityType`, then `@category entity-ids` + `@since 0.0.0`.
- Type JSDoc: `Runtime type for {@link X}.`, a described `@see {@link X} for the runtime schema and
  entity-type metadata.`, then `@category entity-ids` + `@since 0.0.0`.
- No `@example`/`@remarks` tags anywhere (repo JSDoc law).

**Verdict: CURRENT** (factory + all four registrations).

---

## 5. `law-practice/domain` entity file-role precedents + fixture-thin entities

**Expected:** `PatentCitationEvent/` uses `.model.ts` + `.values.ts` + `index.ts`; `PriorArtReference/`
uses `.model.ts` + `index.ts`. `LegalClient` / `LegalContact` / `Matter` exist, are fixture-thin, and link
by `legalClientFixtureKey` TEXT rather than an EntityId foreign key.

**Found at:** `packages/law-practice/domain/src/entities/`

Directory listing (14 entries):

```
CandorDisposition  Claim  Distinction  IdsSubmissionFact  index.ts
LawPracticeEntity.fields.ts  LegalClient  LegalContact  Matter  OfficeAction
PatentAsset  PatentCitationEvent  PriorArtReference  Rejection
```

File-role precedents, both confirmed:

```
PatentCitationEvent/:  index.ts  PatentCitationEvent.model.ts  PatentCitationEvent.values.ts
PriorArtReference/:    index.ts  PriorArtReference.model.ts
```

So the convention is: `index.ts` + `<Name>.model.ts` always, plus `<Name>.values.ts` **only when the entity
owns literal domains or value objects**. `PriorArtReference` has no values file because it declares none.

### Fixture-thin trio

All three exist and are built with `BaseEntity.Class<X>($I`X`)(<EntityId>, { fields, persisted }, $I.annote(...))`.

| Entity | Domain fields (count) | Literal domain | Link field |
| --- | --- | --- | --- |
| `LegalClient` | `displayName`, `fixtureKey`, `status` (3) | `LiteralKit(["active_client"])` | — (is the link target) |
| `LegalContact` | `displayName`, `fixtureKey`, `legalClientFixtureKey`, `role` (4) | `LiteralKit(["founder"])` | `legalClientFixtureKey` |
| `Matter` | `displayName`, `fixtureKey`, `legalClientFixtureKey`, `matterType` (4) | `LiteralKit(["patent_application"])` | `legalClientFixtureKey` |

Single-member literal domains confirmed verbatim:

```
LegalClient.values.ts:13:  const LegalClientStatusBase = LiteralKit(["active_client"]);
LegalContact.values.ts:13: const LegalContactRoleBase = LiteralKit(["founder"]);
Matter.values.ts:13:       const MatterTypeBase = LiteralKit(["patent_application"]);
```

Each follows the `<X>Base` private const → `export const <X> = <X>Base.pipe($I.annoteSchema(...))` at `:30`
pattern — no `as const` on the inline array, per repo law.

**Link is TEXT, not an EntityId FK — confirmed.** In `LegalContact.model.ts` and `Matter.model.ts`:

```ts
      legalClientFixtureKey: LawPracticeFixtureKey.annotateKey({
        description: "Fixture key for the legal client this <contact|matter> belongs to.",
      }),
```

and on the persisted side:

```ts
      legalClientFixtureKey: EntitySchema.persist.text({
        columnName: "legal_client_fixture_key",
      }),
```

`EntitySchema.persist.text` (not `.entityId`), and the domain type is `LawPracticeFixtureKey`, not
`LawPractice.LegalClientId`. The fixture-thin trio is deliberately not FK-wired.

**Verdict: CURRENT** (all sub-anchors).

---

## 6. `CandorPolicy` / `CandorRecord` ports-vs-service split

**Expected:** `CandorPolicy.ports.ts:243` holds the `Context.Service` tag; `CandorPolicy.service.ts` holds
only factory + `Live` layer. `CandorRecord.ports.ts` LiteralKit operation vocabulary with no update / no
delete member, shape at `:190`, service at `:282`. `law-practice/server/src/CandorRecord/` drizzle
repo/layer files exist.

### CandorPolicy

Directory `packages/law-practice/use-cases/src/CandorPolicy/`:

```
CandorPolicy.errors.ts  CandorPolicy.ports.ts  CandorPolicy.service.ts
CandorPolicy.values.ts  index.ts
```

`CandorPolicy.ports.ts` — service tag at the stated line:

```
243:export class CandorPolicy extends Context.Service<CandorPolicy, CandorPolicyShape>()($I`CandorPolicy`) {}
```

Same file also carries `CandorRecordReaderShape` (`:64`), a second `Context.Service` `CandorRecordReader`
(`:129`), and `CandorPolicyShape` (`:178`). So **ports.ts owns shapes *and* tags**; there is more than one
service tag per ports file.

`CandorPolicy.service.ts` — factory + layer only, no `Context.Service`:

```
245:export const makeCandorPolicy = (): CandorPolicyShape =>
286:export const CandorPolicyLive: Layer.Layer<CandorPolicy> = Layer.succeed(CandorPolicy, makeCandorPolicy());
```

`Layer.succeed` (not `Layer.effect`) because the policy is pure. The `Live` layer's type parameter list
shows no dependencies: `Layer.Layer<CandorPolicy>`.

**Verdict: CURRENT.**

### CandorRecord operation vocabulary

`packages/law-practice/use-cases/src/CandorRecord/` contains `CandorRecord.ports.ts`,
`CandorRecord.reader.ts`, `index.ts`.

Vocabulary at `:20-27`:

```ts
const CandorRecordOperationBase = LiteralKit([
  "recordEvent",
  "recordDisposition",
  "recordSubmissionFact",
  "listEvents",
  "listDispositions",
  "listSubmissionFacts",
]);
```

Six members: three appends, three reads. **No update member, no delete member — confirmed.** The intent is
documented in prose at `:34-36`:

> Every member is either an append or a read. There is deliberately no update
> and no delete member, so the vocabulary itself records that a filed decision
> is never edited.

Exported at `:49` as `CandorRecordOperation` via `.pipe($I.annoteSchema(...))`.

Shape and service at the stated lines:

```
190:export class CandorRecordRepositoryShape extends S.Class<CandorRecordRepositoryShape>($I`CandorRecordRepositoryShape`)(
282:export class CandorRecordRepository extends Context.Service<CandorRecordRepository, CandorRecordRepositoryShape>()(
283:  $I`CandorRecordRepository`
284:) {}
```

Load-bearing shape detail — methods are declared as `Fn({ input, output })` schema fields, not as a plain
TS interface:

```ts
    listDispositions: Fn({
      input: CandorFilingScope,
      output: EffectSchema<ReadonlyArray<CandorDisposition>, CandorRecordRepositoryUnavailable, never>(),
    }).annotateKey({
      description: "Read every recorded attorney disposition for one exact tenant-scoped filing.",
```

Typed error `CandorRecordRepositoryUnavailable` declared at `:92` via `TaggedErrorClass`.

### Server-side drizzle files

`packages/law-practice/server/src/CandorRecord/` exists with:

```
CandorRecord.layer.ts  CandorRecord.repo.ts  index.ts
```

Sibling modules in `packages/law-practice/server/src/`: `index.ts`, `Layer.ts`, `Tools.ts`, and the
`PracticeKg.*` family (`claims`, `emails`, `errors`, `fts`, `host`, `projections`, `queries`, `rows`,
`schemas`, `tool-handlers`).

**Verdict: CURRENT** (all sub-anchors).

---

## 7. Migration lane

**Expected:** `packages/_internal/db-admin/drizzle/20260806031625_law_practice_candor_gate/` exists and is
the only migration naming `law_practice`; PGlite test with separate `layer(...)` blocks for UPDATE and
DELETE denials around `:208` / `:226`; `AcceptedProofManifest` law-practice entries around `:808`, `:814`,
`:874`, `:724`.

### Drizzle directory

Tail of `packages/_internal/db-admin/drizzle/`:

```
20260512000000_architecture_lab_work_item
20260512001000_architecture_lab_worker_archetype
20260613000000_workspace_thread_domain
20260613000010_epistemic_usage_record
20260708000000_workspace_vault_config
20260711000000_documents_sync_state
20260725222615_baseline
20260726000000_epistemic_bitemporal_edge
20260726210000_epistemic_execution_ledger
20260730042420_epistemic_contradiction_triage
20260730043536_epistemic_evidence_verification
20260801021411_usage_record_optional_activity
20260806031625_law_practice_candor_gate
```

`20260806031625_law_practice_candor_gate` exists and is the newest migration. A content grep for
`law_practice` across the whole drizzle tree returns hits in exactly two files, both inside that directory:

```
packages/_internal/db-admin/drizzle/20260806031625_law_practice_candor_gate/snapshot.json
packages/_internal/db-admin/drizzle/20260806031625_law_practice_candor_gate/migration.sql
```

**It is still the only migration naming `law_practice`. Confirmed.**

### PGlite test

`packages/_internal/db-admin/test/integration/LawPracticeCandorGateMigration.pglite.test.ts` (242 lines).

Two separate `layer(...)` blocks at the stated lines:

```
208:    layer(makeMigrationProofLayer(), { timeout: "2 minutes" })((it) => {
209:      it.effect(
217:            UPDATE law_practice_candor_disposition SET rule56_judgment = 'DoNotSubmit' WHERE id = 1
...
226:    layer(makeMigrationProofLayer(), { timeout: "2 minutes" })((it) => {
227:      it.effect(
233:            DELETE FROM law_practice_candor_disposition WHERE id = 1
```

The reason for two blocks rather than two probes in one is documented inline at `:205-207`:

> Two fresh databases rather than two probes in one session: an implicit
> transaction pglite host rolls the whole session chain back after an
> intentional failure, so the UPDATE and DELETE denials cannot share one.

**Gotcha worth carrying forward:** the whole suite is env-gated at `:201-204`:

```ts
if (!shouldRunPgliteIntegration) {
  describe.skip("db-admin law-practice-candor-gate migration PgLite integration", () => {});
} else {
  describe("db-admin law-practice-candor-gate migration PgLite integration", { concurrent: false }, () => {
```

A green local run does not prove these denials executed unless `shouldRunPgliteIntegration` was true. Note
also `{ concurrent: false }` — this suite is deliberately serialized.

### AcceptedProofManifest

`packages/tooling/tool/cli/src/commands/Architecture/internal/AcceptedProofManifest.ts`. All four stated
line numbers point at the **opening `AcceptedProofFile.make({` line** of the relevant stanza (the `path:`
key sits three lines below). Verified:

| Stated line | Stanza opens at | `path:` at | Target |
| --- | --- | --- | --- |
| `:724` | 724 | 727 | `packages/_internal/db-admin/src/migrations/LawPracticeCandorGate.ts` |
| `:808` | 808 | 811 | `.../drizzle/20260806031625_law_practice_candor_gate/migration.sql` |
| `:814` | 814 | 817 | `.../drizzle/20260806031625_law_practice_candor_gate/snapshot.json` |
| `:874` | 874 | 877 | `.../test/integration/LawPracticeCandorGateMigration.pglite.test.ts` |

### What an AcceptedProofManifest entry looks like

Every entry is a flat four-key `AcceptedProofFile.make({...})` call in a single array. Verbatim, the
migration.sql and snapshot.json pair at `:808-819`:

```ts
  AcceptedProofFile.make({
    role: "db-admin",
    stage: "persistence",
    path: "packages/_internal/db-admin/drizzle/20260806031625_law_practice_candor_gate/migration.sql",
    writer: "template",
  }),
  AcceptedProofFile.make({
    role: "db-admin",
    stage: "persistence",
    path: "packages/_internal/db-admin/drizzle/20260806031625_law_practice_candor_gate/snapshot.json",
    writer: "json",
  }),
```

Key semantics observed across the law-practice and epistemic lanes:

- `role` — `"db-admin"` for every migration-lane entry.
- `stage` — `"persistence"` for every migration-lane entry.
- `path` — repo-root-relative, no leading `./`.
- `writer` — `"json"` for `snapshot.json`; `"template"` for `migration.sql`, for the
  `src/migrations/<Name>.ts` module, and for the `.pglite.test.ts` proof.

So a new migration needs **four** entries, mirroring the LawPracticeCandorGate set: the migration TS module
(`template`), `migration.sql` (`template`), `snapshot.json` (`json`), and the PGlite test (`template`).
Immediate neighbours follow the identical shape — e.g. `EpistemicContradictionTriage.ts` at `:718-723` and
the `20260725222615_baseline` pair at `:820-831`.

**Verdict: CURRENT** (all four manifest anchors, plus directory and test anchors).

---

## 8. `EdgeVersion` lineage posture + Graphiti attribution

**Expected:** `packages/epistemic/domain/src/entities/EdgeVersion/EdgeVersion.model.ts` — `supersedesId`
self-reference at `:141-143`; Graphiti Apache-2.0 attribution at `:16-25`.

**Found at:** exactly those lines.

Lineage field, `:141-143`:

```ts
      supersedesId: Epistemic.EdgeVersionId.pipe(S.OptionFromNullOr).annotateKey({
        description: "Version this row replaced; absent for the first version and for late out-of-order arrivals.",
      }),
```

Self-reference posture confirmed: the field on `EdgeVersion` is typed as `Epistemic.EdgeVersionId` — the
entity's own id — wrapped in `S.OptionFromNullOr` so absence is `Option.none` rather than `null`. The
persisted descriptor is at `:205` (`EntitySchema.persist.entityId({...})`), and a JSDoc example shows the
encoded side as `supersedesId: null` at `:87`.

Attribution notice, `:15-25` (comment opens at `:15`; first content line is `:16`, matching the stated
range):

```
16: * Derived from Graphiti (https://github.com/getzep/graphiti), v0.29.2,
17: * commit ff7e29ccd127d8d9721b5cbb2163a6407ef915fe.
18: * Copyright 2024, 2025 Zep Software, Inc. Licensed under the Apache License,
19: * Version 2.0. See THIRD_PARTY_NOTICES.md.
20: *
21: * Modified: reimplemented in Effect/TypeScript over Postgres; no upstream
22: * source was copied. Two half-open BIGINT-millis interval pairs with Option open
23: * ends replace the donor's nullable valid_at/invalid_at/expired_at datetimes, and
24: * lineage is a supersedes_id self-FK rather than a caller-held edge list.
25: */
```

**Quoted first line:** `Derived from Graphiti (https://github.com/getzep/graphiti), v0.29.2,`

Notice structure to clone if another donor-derived model lands: a **separate** block comment sitting
*after* the `@packageDocumentation` block (`:1-13`), containing donor name + URL + version + commit,
copyright + license + `See THIRD_PARTY_NOTICES.md.`, then a `Modified:` paragraph stating what diverged and
asserting no source was copied.

**Verdict: CURRENT** (both).

---

## 9. `EdgeRelation` `pickOptions` + derived `S.is` subdomain precedent

**Expected:** `packages/epistemic/domain/src/values/EdgeRelation/EdgeRelation.model.ts:54`, `:74`,
`:127-128`.

**Found at:** exactly those lines.

```
 31:export const EdgeRelation = EdgeRelationBase.pipe(
 54:const SymmetricEdgeRelationBase = LiteralKit(EdgeRelationBase.pickOptions(["contradicts"]));
 74:export const SymmetricEdgeRelation = SymmetricEdgeRelationBase.pipe(
110:export const symmetricEdgeRelations: ReadonlyArray<EdgeRelation> = SymmetricEdgeRelation.Options;
127:export const isSymmetricEdgeRelation: (relation: EdgeRelation) => relation is SymmetricEdgeRelation =
128:  S.is(SymmetricEdgeRelation);
```

The precedent in full: a parent `LiteralKit` (`EdgeRelationBase`) → a subdomain built by feeding
`parentBase.pickOptions([...])` into a fresh `LiteralKit` → the subdomain exported through
`.pipe($I.annoteSchema(...))` → a `ReadonlyArray` of the members exposed via `.Options` → a **type-guard
derived from the schema** with an explicit `(x: Parent) => x is Sub` annotation, never a hand-rolled
predicate. This is the shape to clone for any new bounded subdomain.

**Verdict: CURRENT** (all three).

---

## 10. `ContradictionTriageRepository` five-operation contract

**Expected:** `packages/epistemic/use-cases/src/ContradictionTriage/ContradictionTriage.ports.ts:374-395` —
five-operation contract.

**Found at:** `:374-395`, exact. Five operations confirmed.

**The five operations: `get`, `getExpanded`, `list`, `review`, `submit`.**

```ts
export interface ContradictionTriageRepositoryShape {
  readonly get: (
    query: GetExpandedContradictionCandidate
  ) => Effect.Effect<O.Option<ContradictionCandidateDetail>, ContradictionRepositoryUnavailable>;
  readonly getExpanded: (
    query: GetExpandedContradictionCandidate
  ) => Effect.Effect<O.Option<ContradictionCandidateExpandedDetail>, ContradictionRepositoryUnavailable>;
  readonly list: (
    query: ListContradictionCandidates
  ) => Effect.Effect<ContradictionCandidatePage, ContradictionRepositoryUnavailable>;
  readonly review: (
    command: ReviewContradictionCandidate,
    reviewer: Principal,
    scope: ContradictionReviewScope["Service"]
  ) => Effect.Effect<
    ContradictionDisposition,
    ContradictionRepositoryUnavailable | ContradictionReviewConflict | EdgeAuthorityError
  >;
  readonly submit: (
    command: SubmitContradictionCandidate
  ) => Effect.Effect<ContradictionSubmission, ContradictionRepositoryUnavailable | ContradictionSubmissionConflict>;
}
```

**Divergence worth flagging before cloning:** this shape is a plain TypeScript `interface` with `readonly`
function properties, whereas the newer `CandorRecordRepositoryShape` (anchor 6) is an `S.Class` whose
members are `Fn({ input, output })` schema fields. Two different repository-contract idioms coexist in the
tree. The CandorRecord form is the schema-first one and is the more recent precedent; pick it deliberately
rather than by proximity.

Also note: reads return `O.Option<...>` rather than throwing a not-found error, and each operation carries
its own precise error union (`review` carries three; `submit` two; the reads one).

**Verdict: CURRENT.**

---

## 11. `ShaclSeverity` three-member domain

**Expected:** `packages/foundation/capability/semantic-web/src/services/shacl-validation.ts:49` —
`ShaclSeverity` with three members.

**Found at:** `:49`

```
49:export const ShaclSeverity = LiteralKit(["info", "warning", "violation"]).pipe(
50:  $I.annoteSchema("ShaclSeverity", {
```

**Three members: `info`, `warning`, `violation`. Confirmed.** Runtime type alias at `:70`; consumed as a
field at `:180` (`severity: ShaclSeverity`). JSDoc examples show both the decode path
(`S.decodeUnknownSync(ShaclSeverity)("violation")`, `:42`) and the derived guard
(`ShaclSeverity.is.violation(severity)`, `:64`).

Note this one inlines the array directly into `LiteralKit(...)` and pipes in one step — no `<X>Base`
intermediate — because nothing derives a subdomain from it. Contrast with anchors 5 and 9, where the
`<X>Base` split exists precisely so `pickOptions` or a separate annotation has something to hang off.

**Verdict: CURRENT.**

---

## 12. `.match`-based involution over a two-member tagged union

**Expected:** `packages/ontology/domain/src/aggregates/Session/Session.model.ts:861`.

**Found at:** `:861`

```ts
export const invertChangeOperation = (change: ChangeOperation): ChangeOperation =>
  ChangeOperation.match(change, {
    addQuad: ({ actor, partition, quad }) =>
      ChangeOperation.make({
        kind: "removeQuad",
        partition,
        quad,
        ...O.getSomesStruct({ actor: O.fromUndefinedOr(actor) }),
      }),
    removeQuad: ({ actor, partition, quad }) =>
      ChangeOperation.make({
        kind: "addQuad",
        partition,
        quad,
        ...O.getSomesStruct({ actor: O.fromUndefinedOr(actor) }),
      }),
  });
```

Involution over a two-member tagged union (`addQuad` ↔ `removeQuad`), discriminated on `kind` — the same
discriminant convention as `Principal` (anchor 2). Signature is total and closed:
`(change: ChangeOperation) => ChangeOperation`, with one handler per member and no fallback branch, so
adding a third member is a compile error rather than a silent passthrough.

Idioms to carry: `<Union>.match(value, { ... })` as a static on the union schema; `<Union>.make({...})` to
rebuild; optional fields re-attached via `...O.getSomesStruct({ actor: O.fromUndefinedOr(actor) })` so an
absent `actor` stays absent instead of becoming `undefined`. JSDoc carries `@category utilities`.

**Verdict: CURRENT.**

---

## 13. NET-NEW check — zero collisions in package source

**Command run (verbatim):**

```
rg -n "Hohfeld|LegalPositionRelator|LegalActContent|LegalScopeContext|PowerExercise|CorrectionDelta|PriorityBasis|LegalRole\b" packages --glob '**/src/**'
```

**Result: no output, exit code 1 (no matches).**

**Zero hits in package source. Every one of the eight names is genuinely net-new.** Nothing to rename
around, no shadowing risk.

For context, the repo-wide (non-`src`) hits are confined to planning and research material, exactly as
expected:

```
goals/legal-position-relator-runtime/{research/SOURCES.md,ops/manifest.json,SPEC.md,README.md,PLAN.md,GOAL.md}
goals/INDEX.md
explorations/legal-position-relator-runtime/{research/SOURCES.md,research/02-position-relator-legal-frame.md,
  research/01-repo-surfaces.md,RESEARCH.md,README.md,MAP.md,DECISIONS.md,CAPTURE.md,BRIEF.md}
explorations/legal-patent-kg-deepening/{routing-seed.json,research/nugget-catalog.json,
  research/mined/R25.md,research/mined/P100.md}
```

**Verdict: CURRENT** (net-new confirmed).

---

## 14. Epistemic-free domain tier

**Expected:** `rg -n "@beep/epistemic" packages/law-practice/domain` returns zero hits, and
`packages/law-practice/domain/package.json` declares no `@beep/epistemic-*` dependency.

**Source scan:**

```
rg -n "@beep/epistemic" packages/law-practice/domain
```

**Result: no output, exit code 1 (zero hits).**

**Manifest scan** — every `@beep/` entry in `packages/law-practice/domain/package.json`:

```
 2:  "name": "@beep/law-practice-domain",
65:    "@beep/identity": "workspace:^",
66:    "@beep/provenance": "workspace:^",
67:    "@beep/schema": "workspace:^",
68:    "@beep/shared-domain": "workspace:^",
72:    "@beep/test-utils": "workspace:^",
```

Four runtime workspace deps (`identity`, `provenance`, `schema`, `shared-domain`) plus `test-utils` in the
dev block. **No `@beep/epistemic-*` dependency of any kind.**

The domain tier is epistemic-free on both axes — imports and manifest. Any new epistemic coupling must land
in `use-cases` or `server`, not `domain`.

**Verdict: CURRENT** (both).

---

## 15. `law-practice/domain` barrel structure + `values/` convention

**Package `src/` layout:**

```
packages/law-practice/domain/src/
  entities/
  index.ts
  internal/
  values/
```

### Root barrel — `packages/law-practice/domain/src/index.ts`

Two re-exports only, each preceded by its own JSDoc block:

```ts
/**
 * Law-practice domain package for prosecution entities and value objects.
 *
 * @packageDocumentation
 * @category entities
 * @since 0.0.0
 */

export * from "./entities/index.ts";
/**
 * Law-practice value-object export surface.
 *
 * @category value-objects
 * @since 0.0.0
 */
export * from "./values/index.ts";
```

### `entities/index.ts`

A flat list of `export * from "./<Name>/index.ts";`, each with its own preceding JSDoc block carrying
`@category entities` (or `@category value-objects` for the non-entity file) and `@since 0.0.0`. Entries are
**alphabetically ordered**, and the non-directory `LawPracticeEntity.fields.ts` is interleaved in
alphabetical position between `IdsSubmissionFact` and `LegalClient` rather than being grouped separately:

```ts
export * from "./CandorDisposition/index.ts";
export * from "./Claim/index.ts";
export * from "./Distinction/index.ts";
export * from "./IdsSubmissionFact/index.ts";
export * from "./LawPracticeEntity.fields.ts";
export * from "./LegalClient/index.ts";
export * from "./LegalContact/index.ts";
export * from "./Matter/index.ts";
export * from "./OfficeAction/index.ts";
export * from "./PatentAsset/index.ts";
export * from "./PatentCitationEvent/index.ts";
export * from "./PriorArtReference/index.ts";
export * from "./Rejection/index.ts";
```

Typical JSDoc block preceding each line:

```ts
/**
 * Candor disposition entity and value-object exports.
 *
 * @category entities
 * @since 0.0.0
 */
```

### `values/` convention — yes, it exists, and it is large

`packages/law-practice/domain/src/values/` holds **63 value-object directories** plus `index.ts`:

```
AnnotationCitation  ApplicationNumber  CanonCitation  CaseGroup  Citation  CitationBase
CitationId  CitationSignal  CitationType  CitationWarning  CitingApplicationIdentity
ComponentSpan  ConstitutionalCitation  ContextOptions  CourtInference  DocketCitation
DurableLocator  DurableLocatorOptions  FederalRegisterCitation  FederalRuleCitation
Footnote  FullCitationType  HistoryChain  HistoryLink  HistorySignal  JournalCitation
KgEdgePredicate  KgNodeKind  KindCode  LegislativeMaterialCitation  LocalOrdinanceCitation
NeutralCitation  ObservationVersionRef  OfficeCode  ParallelGroup  ParentheticalType
PatentDocumentTriplet  PatentMetadata  PatentNumber  PatentOffice  PinciteInfo
PracticeKgEpistemicStatus  PracticeKgProvenanceKind  PublicLawCitation  RegulationCitation
ResolutionResult  RestatementCitation  Segment  SegmentMap  SeniorityTier  SessionLawCitation
ShortFormCitationType  Span  StateRuleCitation  StatuteCitation  StatutesAtLargeCitation
StringCitationGroup  StructuredDate  SubsequentHistoryEntry  SurroundingContext
TreatiseCitation  TreatyCitation
```

**File-role convention inside `values/` matches `entities/`:** one directory per value object containing
`index.ts` + `<Name>.model.ts`. Spot-checked:

```
values/KgNodeKind/:    index.ts  KgNodeKind.model.ts
values/PatentNumber/:  index.ts  PatentNumber.model.ts
```

`values/index.ts` mirrors `entities/index.ts` — a `@packageDocumentation` header then one JSDoc-preceded
`export * from "./<Name>/index.ts";` per directory, alphabetically ordered, `@category value-objects`.
Some blocks additionally carry an `**Example** (Import the ...)` fenced snippet:

```ts
/**
 * Annotation-citation value-object exports.
 *
 * **Example** (Import the annotation-citation value objects)
 *
 * ```ts
 * import { AnnotationCitation } from "@beep/law-practice-domain/values";
 * ```
 *
 * @category value-objects
 * @since 0.0.0
 */
export * from "./AnnotationCitation/index.ts";
```

**Placement guidance for the net-new work:** a new value object goes in
`src/values/<Name>/{index.ts,<Name>.model.ts}` with an alphabetically-positioned re-export added to
`src/values/index.ts`. A new entity goes in `src/entities/<Name>/{index.ts,<Name>.model.ts}` (+
`<Name>.values.ts` only if it owns literal domains) with an alphabetically-positioned re-export added to
`src/entities/index.ts`. No root-barrel edit is needed in either case — `src/index.ts` already re-exports
both sub-barrels wholesale.

**Verdict: CURRENT.**

---

## Drift summary

**No anchors drifted. All 15 verified CURRENT at their stated line numbers.**

Two stated ranges deserve a clarifying note, though neither is drift:

- **Anchor 7, AcceptedProofManifest (`:724`, `:808`, `:814`, `:874`).** These point at the opening
  `AcceptedProofFile.make({` line of each stanza; the `path:` key sits three lines below (`:727`, `:811`,
  `:817`, `:877`). A `rg` for the path string returns the `+3` line and can look like drift. It is not —
  the stated numbers are correct stanza anchors.
- **Anchor 8, Graphiti attribution (`:16-25`).** The comment block physically opens at `:15` (`/**`). Line
  `:16` is the first *content* line, so the stated range describes the notice text exactly.

---

## Load-bearing notes beyond the anchor list

1. **Two repository-contract idioms coexist.** `ContradictionTriageRepositoryShape` (anchor 10) is a plain
   TS `interface`; `CandorRecordRepositoryShape` (anchor 6) is an `S.Class` of `Fn({ input, output })`
   fields. The CandorRecord form is the schema-first, more recent precedent. Choose deliberately.
2. **`Principal` discriminates on `kind`, not `_tag`** — via `S.toTaggedUnion("kind")`. Same convention in
   `ChangeOperation` (anchor 12). Do not assume `_tag`.
3. **The PGlite candor-gate suite is env-gated** by `shouldRunPgliteIntegration` and falls back to
   `describe.skip` (`:201-204`). A green local run is not evidence the UPDATE/DELETE denials executed. It
   is also explicitly `{ concurrent: false }`.
4. **A new migration needs four AcceptedProofManifest entries**, not one: the `src/migrations/<Name>.ts`
   module (`writer: "template"`), `migration.sql` (`"template"`), `snapshot.json` (`"json"`), and the
   `.pglite.test.ts` proof (`"template"`) — all with `role: "db-admin"`, `stage: "persistence"`.
5. **`ports.ts` files hold multiple `Context.Service` tags.** `CandorPolicy.ports.ts` carries both
   `CandorRecordReader` (`:129`) and `CandorPolicy` (`:243`). The split is ports = shapes + tags,
   service = factory + `Live` layer, not one-tag-per-file.
6. **The `<X>Base` LiteralKit split is purposeful.** It exists where something derives from the domain
   (`pickOptions` subdomains, separate annotation). `ShaclSeverity` skips it because nothing does.
7. **`law-practice/domain` has no epistemic coupling on either axis** (imports or manifest). Any epistemic
   dependency the new work needs must land in `use-cases` or `server`.
