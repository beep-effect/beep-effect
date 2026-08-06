# Rung 2 Durability Lane — Copy-Accurate Machinery Map

Provenance: 2026-08-05, agent Explore, branch `feat/patent-citation-candor-gate`,
repo `/home/elpresidank/YeeBois/projects/beep-effect12`. Every code block below
is verbatim from live source at the cited `path:line`. Nothing is reconstructed
from memory or from `dist/`.

---

## 0. The two new entities as they actually exist

Both compile today and both are `BaseEntity.Class` entities, which is the single
most important fact for §1 and §4: they get their table via
`EntityTable.pgTableFrom`, **not** via a hand-written `pgTable`, and they inherit
the full `BaseEntity` column block (including `row_version` /
`updated_at` / `updated_by_principal`).

`packages/law-practice/domain/src/entities/PatentCitationEvent/PatentCitationEvent.model.ts:69-137`:

```ts
export class PatentCitationEvent extends BaseEntity.Class<PatentCitationEvent>($I`PatentCitationEvent`)(
  LawPractice.PatentCitationEventId,
  {
    fields: { /* actor, citingApplication, discovery, grounding, observedAt,
                 possibleDuplicateOf, quarantine, reference, supersedes */ },
    persisted: {
      actor: EntitySchema.persist.literal({ columnName: "actor" }),
      citingApplication: EntitySchema.persist.jsonb({ columnName: "citing_application" }),
      discovery: EntitySchema.persist.jsonb({ columnName: "discovery" }),
      grounding: EntitySchema.persist.jsonb({ columnName: "grounding" }),
      observedAt: EntitySchema.persist.timestampMillis({ columnName: "observed_at" }),
      possibleDuplicateOf: EntitySchema.persist.entityId({ columnName: "possible_duplicate_of" }),
      quarantine: EntitySchema.persist.jsonb({ columnName: "quarantine" }),
      reference: EntitySchema.persist.jsonb({ columnName: "reference" }),
      supersedes: EntitySchema.persist.jsonb({ columnName: "supersedes" }),
    },
  },
  $I.annote("PatentCitationEvent", { /* ... */ })
) {}
```

`packages/law-practice/domain/src/entities/CandorDisposition/CandorDisposition.model.ts:89-111` (persisted block):

```ts
    persisted: {
      citingApplication: EntitySchema.persist.jsonb({ columnName: "citing_application" }),
      decidedAt: EntitySchema.persist.timestampMillis({ columnName: "decided_at" }),
      disposes: EntitySchema.persist.jsonb({ columnName: "disposes" }),
      lifecycle: EntitySchema.persist.literal({ columnName: "lifecycle" }),
      litigationFrameJudgment: EntitySchema.persist.text({ columnName: "litigation_frame_judgment" }),
      rule56Judgment: EntitySchema.persist.text({ columnName: "rule56_judgment" }),
      supersedes: EntitySchema.persist.entityId({ columnName: "supersedes" }),
    },
```

### Derived physical table names (do not guess these)

`packages/shared/domain/src/identity/LawPractice.ts:12`:

```ts
const make = EntityId.factory("law_practice", $I);
```

`packages/shared/domain/src/identity/LawPractice.ts:414` and `:448`:

```ts
export const PatentCitationEventId = make("patent_citation_event", { /* ... */ });
export const CandorDispositionId = make("candor_disposition", { /* ... */ });
```

`packages/shared/domain/src/entity/EntityId.ts:465-468`:

```ts
const defaultTableName = <const Slice extends string, const Name extends string>(
  slice: Slice,
  name: Name
): TableName<Slice, Name> => `${slice}_${name}`;
```

`packages/shared/domain/src/entity/BaseEntity.ts:205` sets `tableName: entityId.tableName`.

**Therefore the two physical tables are `law_practice_patent_citation_event` and
`law_practice_candor_disposition`.** Neither name is overridden anywhere; I
grepped `packages/shared/domain/src/identity/LawPractice.ts` for `tableName:`
overrides on these two ids and found none.

`persist` descriptor constructors — `packages/foundation/modeling/schema/src/EntitySchema/EntitySchema.constructors.ts:52-62`:

```ts
export const persist = {
  blob: descriptor("blob"),
  bool: descriptor("bool"),
  entityId: descriptor("entityId"),
  int: descriptor("int"),
  jsonb: descriptor("jsonb"),
  literal: descriptor("literal"),
  text: descriptor("text"),
  timestampDate: descriptor("timestampDate"),
  timestampMillis: descriptor("timestampMillis"),
} as const;
```

---

## 1. `packages/law-practice/tables`

### 1a. Full tree

```
packages/law-practice/tables/src:
  entities/
    index.ts
    KgBuild/{index.ts, KgBuild.read-model-table.ts}
    KgEdge/{index.ts, KgEdge.read-model-table.ts}
    KgNode/{index.ts, KgNode.read-model-table.ts}
  index.ts
  ReadModels.ts
  Tables.ts
packages/law-practice/tables/test:
  LawPracticeTables.test.ts
```

### 1b. `package.json` — deps and exports (verbatim, from `packages/law-practice/tables/package.json`)

```json
  "exports": {
    ".": "./src/index.ts",
    "./tables": "./src/Tables.ts",
    "./aggregates/*": "./src/aggregates/*/index.ts",
    "./entities": "./src/entities/index.ts",
    "./entities/*": "./src/entities/*/index.ts",
    "./internal/*": null,
    "./package.json": "./package.json"
  },
```

```json
  "dependencies": {
    "@beep/law-practice-domain": "workspace:^",
    "@beep/schema": "workspace:^",
    "drizzle-orm": "catalog:"
  },
  "devDependencies": {
    "@effect/vitest": "catalog:",
    "@types/node": "catalog:",
    "effect": "catalog:"
  }
```

> **GAP (blocking):** `@beep/drizzle` is **not** a dependency, and
> `packages/law-practice/tables/tsconfig.json` has only two references
> (`foundation/modeling/schema`, `../domain`). `EntityTable.pgTableFrom` lives in
> `@beep/drizzle`, so both the dep and the tsconfig reference must be added.
> Compare `packages/epistemic/tables/package.json` deps
> (`@beep/drizzle`, `@beep/epistemic-domain`, `drizzle-orm`, `effect`) and
> `packages/epistemic/tables/tsconfig.json:11-13` which references
> `../../drivers/drizzle/tsconfig.json`.
>
> Also note the `./entities/*` wildcard export already exists, so
> `@beep/law-practice-tables/entities/PatentCitationEvent` resolves without a
> package.json edit — but epistemic enumerates each subpath explicitly
> (`packages/epistemic/tables/package.json` exports map lists
> `"./entities/EvidenceVerification"` etc.). Follow whichever the reviewer
> prefers; the wildcard already works and needs no edit.

### 1c. Every existing table module, VERBATIM

There are exactly three, all the same shape. Full text of the exemplar,
`packages/law-practice/tables/src/entities/KgNode/KgNode.read-model-table.ts:1-77`:

```ts
/**
 * Disposable practice knowledge-graph node read-model table.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { jsonb, pgTable, text } from "drizzle-orm/pg-core";
import type { KgNodeKind } from "@beep/law-practice-domain/values";
import type { UnknownRecord } from "@beep/schema";

/**
 * Physical table name for practice knowledge-graph nodes.
 *
 * @remarks
 * Exported separately from {@link kgNodeTable} so that hand-written DDL and
 * projection SQL name the table through one constant rather than a string
 * literal repeated per call site.
 *
 * @example
 * ```ts
 * import { KG_NODE_TABLE_NAME } from "@beep/law-practice-tables/entities/KgNode"
 *
 * const truncate = `TRUNCATE TABLE ${KG_NODE_TABLE_NAME}`
 * console.log(truncate) // "TRUNCATE TABLE kg_node"
 * ```
 *
 * @category tables
 * @since 0.0.0
 */
export const KG_NODE_TABLE_NAME = "kg_node" as const;

/**
 * Drizzle declaration for the packet-owned node projection.
 *
 * @remarks
 * `iri` is the primary key and the join target for both endpoints of
 * {@link kgEdgeTable}, so nodes must be inserted before the edges that
 * reference them.
 *
 * @example
 * ```ts
 * import { kgNodeTable } from "@beep/law-practice-tables/entities/KgNode"
 * import { getTableName } from "drizzle-orm"
 *
 * const row: typeof kgNodeTable.$inferInsert = {
 *   iri: "urn:beep:practice-kg:docket:AB-1234",
 *   kind: "docket",
 *   naturalKey: "AB-1234",
 *   label: "AB-1234 — Acme Corp",
 *   docketFamily: "AB",
 *   client: "Acme Corp",
 *   epistemicStatus: "derived-from-official-records",
 *   provenanceKind: "catalog-digest",
 *   provenanceRef: "sha256:9f2c...",
 *   payload: { sizeBytes: 18342 }
 * }
 *
 * console.log(getTableName(kgNodeTable)) // "kg_node"
 * console.log(row.kind) // "docket"
 * ```
 *
 * @category tables
 * @since 0.0.0
 */
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

**CRITICAL:** these three are **read-model projections** with hand-declared
`pgTable(...)` columns and hand-chosen names (`kg_node`, `kg_edge`, `kg_build`)
— they are NOT derived from a domain entity's `persisted` block, and they are
NOT part of any db-admin migration (they live in a disposable per-bundle PGlite
store). **Do not copy this shape for the two new entities.** The correct shape
for a `BaseEntity.Class` entity is §1e.

### 1d. Barrels

`packages/law-practice/tables/src/entities/KgNode/index.ts:12`:

```ts
export * from "./KgNode.read-model-table.ts";
```

`packages/law-practice/tables/src/entities/index.ts:12-22`:

```ts
export * as KgBuild from "./KgBuild/index.ts";
export * as KgEdge from "./KgEdge/index.ts";
export * as KgNode from "./KgNode/index.ts";
```

`packages/law-practice/tables/src/ReadModels.ts:8-35`:

```ts
import { kgBuildTable } from "./entities/KgBuild/KgBuild.read-model-table.ts";
import { kgEdgeTable } from "./entities/KgEdge/KgEdge.read-model-table.ts";
import { kgNodeTable } from "./entities/KgNode/KgNode.read-model-table.ts";

/* ...jsdoc... */
export const DbSchema = {
  kgBuild: kgBuildTable,
  kgEdge: kgEdgeTable,
  kgNode: kgNodeTable,
};
```

`packages/law-practice/tables/src/Tables.ts:15`:

```ts
export { DbSchema } from "./ReadModels.ts";
```

`packages/law-practice/tables/src/index.ts:22-44`:

```ts
export const VERSION = "0.0.0" as const;
/* ... */
export * from "./entities/index.ts";
export * from "./ReadModels.ts";
export * from "./Tables.ts";
```

> **Design tension you must resolve:** `DbSchema` in law-practice is currently
> "the whole schema a bundle's PGlite store is created with"
> (`ReadModels.ts:14-17` remarks) and its docgen `@example` asserts
> `["kg_build", "kg_edge", "kg_node"]` (`ReadModels.ts:25`). If you add the two
> migration-backed tables into the same `DbSchema`, that `@example` becomes
> wrong and `bun run docgen:local` will fail on it. Epistemic keeps ONE
> `DbSchema` aggregate (`packages/epistemic/tables/src/Schema.ts:46-58`) with a
> typed `DbSchemaShape`; either (a) extend law-practice's `DbSchema` and fix the
> two `@example` blocks in `ReadModels.ts:19-27` and `:39-46`, or (b) add a
> second aggregate. Option (a) matches epistemic; option (b) keeps the
> "disposable bundle" comment honest. My recommendation: (a) — one `DbSchema`,
> updated examples, matching `packages/epistemic/tables/src/Schema.ts`.

### 1e. Are tables hand-written or generated?

**Hand-written.** `bun run beep architecture` does NOT generate table modules
for an existing slice; its `create slice` / `add concept` subcommands scaffold
the canonical **architecture-lab** proof slice topology
(`packages/tooling/tool/cli/src/commands/Architecture/Architecture.command.ts:199-270`,
`internal/AcceptedProofManifest.ts:50-53` hard-codes
`packages/architecture-lab/${role}`). It will not write into
`packages/law-practice/tables`.

The canonical entity-table module for a `BaseEntity.Class` entity is one line.
`packages/epistemic/tables/src/entities/EvidenceVerification/EvidenceVerification.table.ts:1-27`, VERBATIM:

```ts
/**
 * Epistemic EvidenceVerification table metadata.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { EntityTable } from "@beep/drizzle";
import { EvidenceVerification } from "@beep/epistemic-domain/entities/EvidenceVerification";

/**
 * PGLite/Postgres Drizzle table for immutable evidence verification rows.
 *
 * The raw SQL migration owns the evidence foreign key, append-only trigger, and
 * unique `(org_id, manifestation_key)` constraint; Drizzle metadata projects
 * the schema-first column shape only.
 *
 * @example
 * ```ts
 * import { EvidenceVerification } from "@beep/epistemic-tables/entities"
 *
 * console.log(EvidenceVerification.Table.definition.tableName)
 * ```
 *
 * @category tables
 * @since 0.0.0
 */
export const Table = EntityTable.pgTableFrom(EvidenceVerification);
```

`packages/drivers/drizzle/src/EntityTable.models.ts:502-509`:

```ts
export const pgTableFrom = <const Entity extends EntitySchema.EntityClass.Any>(entity: Entity): TableFor<Entity> => {
  const definition = EntitySchema.getDefinition(entity);
  const table = pgTable(
    definition.tableName,
    () => columnsFor(definition),
    (columns) => indexesFor(definition.tableName, definition, columns)
  );
  return attachTableMetadata(table, definition, entity);
};
```

Note the exported symbol is named `Table` (not `xxxTable`) in the epistemic
entity convention, and the namespace barrel re-exports it as
`EvidenceVerification.Table`.

### 1f. Converters (the row ↔ entity boundary)

`packages/epistemic/tables/src/entities/EvidenceVerification/EvidenceVerification.converters.ts:31-51` and `:102-134`:

```ts
export type EvidenceVerificationRow = typeof Table.$inferSelect;
export type EvidenceVerificationInsert = typeof Table.$inferInsert;

const encodeEvidenceVerification = S.encodeResult(EvidenceVerification);
const decodeEvidenceVerificationRow = S.decodeUnknownResult(EvidenceVerification);
```

```ts
export const toEvidenceVerificationInsert: {
  (verification: EvidenceVerification, evidence: Evidence): Result.Result<EvidenceVerificationInsert, S.SchemaError>;
  (
    evidence: Evidence
  ): (verification: EvidenceVerification) => Result.Result<EvidenceVerificationInsert, S.SchemaError>;
} = dual(2, (verification: EvidenceVerification, evidence: Evidence) =>
  Result.map(
    Result.flatMap(
      Result.flatMap(validateEvidenceAssociation(verification, evidence), validateManifestationKey),
      encodeEvidenceVerification
    ),
    (encoded): EvidenceVerificationInsert => {
      const { id: _id, ...insert } = encoded;
      return insert;
    }
  )
);

export const fromEvidenceVerificationRow = (row: unknown): Result.Result<EvidenceVerification, S.SchemaError> =>
  Result.flatMap(decodeEvidenceVerificationRow(row), validateManifestationKey);
```

The load-bearing mechanics: **the entity schema is its own row codec** — encode
gives the insert row, decode gives the entity. `id` is stripped from the insert
because the column is `serial PRIMARY KEY` and the database assigns it.

Entity-namespace barrel, `packages/epistemic/tables/src/entities/EvidenceVerification/index.ts:21` and `:35`:

```ts
export * from "./EvidenceVerification.converters.ts";
export * from "./EvidenceVerification.table.ts";
```

Slice aggregate, `packages/epistemic/tables/src/Schema.ts:19-58`:

```ts
type DbSchemaShape = {
  readonly candidateClaim: typeof CandidateClaim.Table;
  /* ... */
  readonly evidenceVerification: typeof EvidenceVerification.Table;
  readonly executionDecision: typeof ExecutionRecord.executionDecisionTable;
  readonly executionOutcome: typeof ExecutionRecord.executionOutcomeTable;
  readonly usageRecord: typeof UsageRecord.Table;
};

export const DbSchema: DbSchemaShape = {
  candidateClaim: CandidateClaim.Table,
  /* ... */
  evidenceVerification: EvidenceVerification.Table,
  executionDecision: ExecutionRecord.executionDecisionTable,
  executionOutcome: ExecutionRecord.executionOutcomeTable,
  usageRecord: UsageRecord.Table,
};
```

---

## 2. `packages/law-practice/server`

### 2a. Full tree

```
packages/law-practice/server/src:
  index.ts
  Layer.ts
  PracticeKg.claims.ts
  PracticeKg.emails.ts
  PracticeKg.errors.ts
  PracticeKg.fts.ts
  PracticeKg.host.ts
  PracticeKg.projections.ts
  PracticeKg.queries.ts
  PracticeKg.rows.ts
  PracticeKg.schemas.ts
  PracticeKg.tool-handlers.ts
  Tools.ts
```

**There is no `.repo.ts` / `.layer.ts` file in law-practice/server today, and no
per-capability subdirectory.** The whole package is flat `PracticeKg.*` modules
plus `Layer.ts`. Everything you write for rung 2 is net-new topology in this
package.

### 2b. `package.json` — deps and exports (verbatim)

```json
  "exports": {
    ".": "./src/index.ts",
    "./layer": "./src/Layer.ts",
    "./internal/*": null,
    "./package.json": "./package.json"
  },
```

```json
  "dependencies": {
    "@beep/duckdb": "workspace:^",
    "@beep/epistemic-domain": "workspace:^",
    "@beep/epistemic-server": "workspace:^",
    "@beep/epistemic-tables": "workspace:^",
    "@beep/epistemic-use-cases": "workspace:^",
    "@beep/file-processing": "workspace:^",
    "@beep/identity": "workspace:^",
    "@beep/langextract": "workspace:^",
    "@beep/law-practice-domain": "workspace:^",
    "@beep/law-practice-tables": "workspace:^",
    "@beep/law-practice-use-cases": "workspace:^",
    "@beep/libpff": "workspace:^",
    "@beep/mcp-kit": "workspace:^",
    "@beep/schema": "workspace:^",
    "@beep/tika": "workspace:^",
    "@beep/utils": "workspace:^",
    "effect": "catalog:"
  },
  "devDependencies": {
    "@beep/pglite": "workspace:^",
    "@beep/test-utils": "workspace:^",
    "@effect/platform-bun": "catalog:",
    "@effect/platform-node": "catalog:",
    "@effect/vitest": "catalog:",
    "@types/node": "catalog:",
    "drizzle-orm": "catalog:"
  }
```

> **GAP (blocking):** `@beep/postgres` is **not** a dependency, and
> `packages/law-practice/server/tsconfig.json` has no
> `../../drivers/postgres/tsconfig.json` reference. `PostgresDrizzle` — the tag
> every Drizzle repo yields — comes from `@beep/postgres`. Compare
> `packages/epistemic/server/package.json` (`"@beep/postgres": "workspace:^"`)
> and `packages/epistemic/server/tsconfig.json:15`. Also note `drizzle-orm` is a
> **devDependency** here but a **dependency** in
> `packages/epistemic/server/package.json`; repo source using `eq`/`asc` from
> `drizzle-orm` needs it as a real dependency.
>
> Two new subpath exports will also be needed
> (epistemic pattern: `"./ClaimDisposition": "./src/ClaimDisposition/index.ts"`).

### 2c. The exemplar repository — `ClaimDisposition`

This is the closest precedent for the new entities because, unlike
`ExecutionLedger`, it is backed by an `EntityTable.pgTableFrom` table and it
returns decoded domain entities.

`packages/epistemic/server/src/ClaimDisposition/ClaimDisposition.repo.ts:1-46` (verbatim):

```ts
/**
 * Claim disposition repository adapters.
 *
 * The surface is append and read only in both variants, because a disposition
 * exists to remember a decision: editing one would erase the very thing it was
 * written down for. A claim resolved again gets a NEW row, and the earlier row
 * becomes `superseded`.
 *
 * @packageDocumentation
 * @category repositories
 * @since 0.0.0
 */

import { DbSchema } from "@beep/epistemic-tables";
import { fromClaimDispositionRow, toClaimDispositionInsert } from "@beep/epistemic-tables/entities/ClaimDisposition";
import {
  ClaimDispositionRepository,
  ClaimDispositionRepositoryUnavailable,
} from "@beep/epistemic-use-cases/ClaimDisposition";
import { PostgresDrizzle } from "@beep/postgres";
import { A, O } from "@beep/utils";
import { asc, eq } from "drizzle-orm";
import { Effect, Equal, pipe, Ref } from "effect";
import type { ClaimDisposition } from "@beep/epistemic-domain/entities/ClaimDisposition";
import type { ClaimDispositionOperation } from "@beep/epistemic-use-cases/ClaimDisposition";

const DISPOSITION_TABLE_NAME = "epistemic_claim_disposition" as const;
const dispositionTable = DbSchema.claimDisposition;

const repositoryUnavailable =
  (operation: ClaimDispositionOperation) =>
  <A2, E, R>(effect: Effect.Effect<A2, E, R>): Effect.Effect<A2, ClaimDispositionRepositoryUnavailable, R> =>
    effect.pipe(
      Effect.tapError((cause) =>
        Effect.logDebug("Epistemic ClaimDisposition repository dropped driver failure").pipe(
          Effect.annotateLogs({ operation, table: DISPOSITION_TABLE_NAME, cause })
        )
      ),
      Effect.mapError((cause) =>
        ClaimDispositionRepositoryUnavailable.during(
          operation,
          `${operation} failed against ${DISPOSITION_TABLE_NAME}`,
          cause
        )
      )
    );
```

`…ClaimDisposition.repo.ts:77-92` (the in-memory sibling):

```ts
export const makeInMemoryClaimDispositionRepository = Effect.fn("Epistemic.ClaimDisposition.makeInMemory")(
  function* () {
    const store = yield* Ref.make<ReadonlyArray<ClaimDisposition>>([]);

    return ClaimDispositionRepository.of({
      listByClaim: Effect.fn("Epistemic.ClaimDisposition.listByClaim")(function* (claimId) {
        const dispositions = yield* Ref.get(store);
        return A.filter(dispositions, (disposition) => Equal.equals(disposition.claimId, claimId));
      }),
      record: Effect.fn("Epistemic.ClaimDisposition.record")(function* (disposition) {
        yield* Ref.update(store, A.append(disposition));
        return disposition;
      }),
    });
  }
);
```

`…ClaimDisposition.repo.ts:115-144` (the Drizzle adapter — **the shape to copy**):

```ts
export const makeDrizzleClaimDispositionRepository = Effect.fn("Epistemic.ClaimDisposition.makeDrizzle")(function* () {
  const db = yield* PostgresDrizzle;

  return ClaimDispositionRepository.of({
    listByClaim: Effect.fn("Epistemic.ClaimDisposition.drizzleListByClaim")(function* (claimId) {
      const rows = yield* db
        .select()
        .from(dispositionTable)
        .where(eq(dispositionTable.claimId, claimId))
        .orderBy(asc(dispositionTable.id))
        .pipe(repositoryUnavailable("listByClaim"));
      return A.map(rows, fromClaimDispositionRow);
    }),
    record: Effect.fn("Epistemic.ClaimDisposition.drizzleRecord")(function* (disposition) {
      const rows = yield* db
        .insert(dispositionTable)
        .values(toClaimDispositionInsert(disposition))
        .returning()
        .pipe(repositoryUnavailable("record"));
      return pipe(
        rows,
        A.head,
        O.map(fromClaimDispositionRow),
        // The database assigns the SERIAL id, so the returned row is the
        // authority; the argument only stands in if the driver returned none.
        O.getOrElse(() => disposition)
      );
    }),
  });
});
```

`packages/epistemic/server/src/ClaimDisposition/ClaimDisposition.layer.ts:9-49` (verbatim, minus jsdoc):

```ts
import { ClaimDispositionRepository } from "@beep/epistemic-use-cases/ClaimDisposition";
import { Layer } from "effect";
import {
  makeDrizzleClaimDispositionRepository,
  makeInMemoryClaimDispositionRepository,
} from "./ClaimDisposition.repo.ts";
import type { PostgresDrizzle } from "@beep/postgres";

export const ClaimDispositionRepositoryInMemory: Layer.Layer<ClaimDispositionRepository> = Layer.effect(
  ClaimDispositionRepository,
  makeInMemoryClaimDispositionRepository()
);

export const ClaimDispositionRepositoryDrizzle: Layer.Layer<ClaimDispositionRepository, never, PostgresDrizzle> =
  Layer.effect(ClaimDispositionRepository, makeDrizzleClaimDispositionRepository());
```

### 2d. File-role split — the answer

`packages/epistemic/server/src/<Capability>/`:

| File | Role |
| --- | --- |
| `<X>.repo.ts` | `makeInMemoryX` / `makeDrizzleX` — `Effect.fn`-wrapped generators returning `XTag.of({...})`. Yields `PostgresDrizzle`. Owns the error-mapping pipe helper. |
| `<X>.layer.ts` | `XInMemory` / `XDrizzle` — thin `Layer.effect(Tag, makeX())` with an **explicit** `Layer.Layer<Out, Err, PostgresDrizzle>` annotation and a `import type { PostgresDrizzle }`. |
| `index.ts` | `export * from "./X.layer.ts"; export * from "./X.repo.ts";` (layer first — alphabetical) |

There is **no `.service.ts` in the server tier**. `.service.ts` lives in
`use-cases` (`packages/epistemic/use-cases/src/ClaimDisposition/ClaimDisposition.service.ts`),
alongside `.ports.ts`, `.errors.ts`, `.commands.ts`. law-practice already
follows this: `packages/law-practice/use-cases/src/CandorPolicy/{CandorPolicy.errors.ts,
CandorPolicy.ports.ts, CandorPolicy.service.ts, CandorPolicy.values.ts, index.ts}`.

### 2e. `packages/law-practice/server/src/Layer.ts` — what it composes today (VERBATIM, `:16-85`)

```ts
import { EpistemicServerLive } from "@beep/epistemic-server/layer";
import { ClaimGate } from "@beep/epistemic-use-cases/ClaimGate";
import { ClaimTransition } from "@beep/epistemic-use-cases/ClaimLifecycle";
import { FileProcessingService, makeFileProcessingServiceLayer } from "@beep/file-processing/Service";
import {
  layer as LangExtractLayer,
  LangExtractService,
  remoteExtractionPolicyFromConfig,
} from "@beep/langextract/Service";
import { IrToLaw, makeIrToLaw } from "@beep/law-practice-use-cases/IrToLaw";
import { makeOfficeActionReview, OfficeActionReview } from "@beep/law-practice-use-cases/OfficeActionReview";
import { TikaFileProcessingEngine } from "@beep/tika";
import { Effect, Layer } from "effect";
import type { Config } from "effect";
import type * as Crypto from "effect/Crypto";
import type * as LanguageModel from "effect/unstable/ai/LanguageModel";

const IrToLawLayer = Layer.succeed(IrToLaw, IrToLaw.of(makeIrToLaw()));
const FileProcessingLayer = makeFileProcessingServiceLayer([TikaFileProcessingEngine]);
const GuardedLangExtractLayer = LangExtractLayer.pipe(Layer.provide(remoteExtractionPolicyFromConfig));

const OfficeActionReviewLayer = Layer.effect(
  OfficeActionReview,
  Effect.gen(function* () {
    const fileProcessing = yield* FileProcessingService;
    const irToLaw = yield* IrToLaw;
    const langExtract = yield* LangExtractService;
    const gate = yield* ClaimGate;
    const transition = yield* ClaimTransition;
    return OfficeActionReview.of(makeOfficeActionReview({ fileProcessing, gate, irToLaw, langExtract, transition }));
  })
);

/* ...jsdoc... */
export const LawPracticeServerLive: Layer.Layer<
  OfficeActionReview | IrToLaw,
  Config.ConfigError,
  LanguageModel.LanguageModel | Crypto.Crypto
> = OfficeActionReviewLayer.pipe(
  // `provideMerge` satisfies the loop's `IrToLaw` dependency while keeping
  // `IrToLaw` in the output surface (a sibling `mergeAll` would race the
  // provider against the consumer); the file-processing capability supplies
  // extracted source text, LangExtract supplies grounded source spans, and the
  // epistemic server supplies the gate + transition the loop also requires.
  Layer.provideMerge(IrToLawLayer),
  Layer.provide(FileProcessingLayer),
  Layer.provide(GuardedLangExtractLayer),
  Layer.provide(EpistemicServerLive)
);
```

Note the output type annotation is explicit and hand-written; adding
`CandorRecordReader` to the output means widening that union **and** adding
`PostgresDrizzle` to the requirement channel (third type parameter), because the
Drizzle layer does not provide it.

### 2f. The port the rung-2 repo must satisfy (already exists)

`packages/law-practice/use-cases/src/CandorPolicy/CandorPolicy.ports.ts:63-125` (VERBATIM):

```ts
export class CandorRecordReaderShape extends S.Class<CandorRecordReaderShape>($I`CandorRecordReaderShape`)(
  {
    dispositionsForFiling: Fn({
      input: CitingApplicationIdentity,
      output: EffectSchema<ReadonlyArray<CandorDisposition>, CandorRecordReadError, never>(),
    }).annotateKey({
      description: "Read every recorded attorney disposition for one exact citing-application representation.",
    }),
    eventsForFiling: Fn({
      input: CitingApplicationIdentity,
      output: EffectSchema<ReadonlyArray<PatentCitationEvent>, CandorRecordReadError, never>(),
    }).annotateKey({
      description: "Read every recorded patent citation event for one exact citing-application representation.",
    }),
  },
  $I.annote("CandorRecordReaderShape", {
    description: "Append-and-read-only service shape over the recorded candor material of one filing.",
  })
) {}

export class CandorRecordReader extends Context.Service<CandorRecordReader, CandorRecordReaderShape>()(
  $I`CandorRecordReader`
) {}
```

Two things to notice, because they differ from the epistemic precedent:

1. The law-practice shape is an **`S.Class` with `Fn({input, output})` fields**,
   not a plain `interface`. So the Drizzle repo returns
   `CandorRecordReaderShape.make({ dispositionsForFiling: ..., eventsForFiling: ... })`,
   not `Tag.of({...})` over an interface. (`Context.Service<Self, Shape>` with a
   class shape still accepts `.of(...)`; `CandorPolicy.ports.ts:110-114` uses
   `Effect.provideService(CandorRecordReader, CandorRecordReaderShape.make({...}))`
   in its own `@example`, which is the authoritative usage.)
2. The **read-only port has no append method**. `CandorRecordReader` is
   read-only; SPEC §"Rung 2" calls for "durable append-and-read-only ports", so
   a **writer port is net-new** and must be authored (see §7).

Its error type, `packages/law-practice/use-cases/src/CandorPolicy/CandorPolicy.errors.ts:70-91`:

```ts
export class CandorRecordReadError extends TaggedErrorClass<CandorRecordReadError>($I`CandorRecordReadError`)(
  "CandorRecordReadError",
  {
    message: S.String,
    reason: CandorRecordReadReason,
  },
  $I.annote("CandorRecordReadError", { /* ... */ })
) {
  static readonly fromReason = (reason: CandorRecordReadReason, message: string): CandorRecordReadError =>
    CandorRecordReadError.make({ message, reason });
}
```

with `CandorRecordReadReason = LiteralKit(["events-unavailable", "dispositions-unavailable"])`
(`CandorPolicy.errors.ts:13`).

---

## 3. The `ExecutionLedger` durability precedent

### 3a. `packages/epistemic/use-cases/src/ExecutionLedger/ExecutionLedger.ports.ts` — VERBATIM (jsdoc trimmed to the load-bearing prose)

```ts
/**
 * Execution ledger port: the typed contract through which write-ahead decisions
 * and post-settlement outcomes are appended and read back. The live Drizzle
 * implementation is provided in the epistemic server tier.
 *
 * The surface is deliberately append-and-read only: there is no update, no
 * delete, and no way to express either, because the tables reject both by
 * trigger and the mutable operation would be exactly what an attacker wants.
 * Chain verification is not on the port — `verifyExecutionDecisionChain` in
 * `epistemic/domain` recomputes every seal from the rows a reader fetched, so a
 * lying adapter cannot vouch for its own chain.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $EpistemicUseCasesId } from "@beep/identity/packages";
import { Context } from "effect";
import type {
  ExecutionDecisionRecord,
  ExecutionOutcomeRecord,
  ExecutionRunKey,
} from "@beep/epistemic-domain/values/ExecutionRecord";
import type { Effect } from "effect";
import type { ExecutionLedgerError, ExecutionLedgerUnavailable } from "./ExecutionLedger.errors.ts";

const $I = $EpistemicUseCasesId.create("ExecutionLedger/ExecutionLedger.ports");

export interface ExecutionLedgerShape {
  readonly appendDecision: (record: ExecutionDecisionRecord) => Effect.Effect<void, ExecutionLedgerError>;
  readonly appendOutcome: (record: ExecutionOutcomeRecord) => Effect.Effect<void, ExecutionLedgerError>;
  readonly readDecisions: (
    runKey: ExecutionRunKey
  ) => Effect.Effect<ReadonlyArray<ExecutionDecisionRecord>, ExecutionLedgerUnavailable>;
  readonly readOutcomes: (
    runKey: ExecutionRunKey
  ) => Effect.Effect<ReadonlyArray<ExecutionOutcomeRecord>, ExecutionLedgerUnavailable>;
  readonly readUnsettledAllowed: (
    runKey: ExecutionRunKey
  ) => Effect.Effect<ReadonlyArray<ExecutionDecisionRecord>, ExecutionLedgerUnavailable>;
}

export class ExecutionLedger extends Context.Service<ExecutionLedger, ExecutionLedgerShape>()($I`ExecutionLedger`) {}
```

**CONFIRMED: append + read only.** Five methods; two are `append*`, three are
`read*`. There is no `update`, `delete`, `upsert`, `remove`, or `void`-returning
mutator of any other kind. I additionally grepped
`packages/epistemic/server/src/ExecutionLedger/ExecutionLedger.repo.ts` for
`.update(` / `.delete(` — zero hits; only `.insert(` and `.select(`.

The same holds for `ClaimDispositionRepositoryShape`
(`ClaimDisposition.ports.ts:153-160`): exactly `listByClaim` + `record`.

### 3b. `packages/epistemic/server/src/ExecutionLedger/ExecutionLedger.repo.ts` — VERBATIM

```ts
/**
 * Execution ledger repository adapter.
 *
 * Every method here is an append or a read — the adapter has no vocabulary for
 * update or delete, and the tables would reject both by trigger if it did. What
 * the database rejects it rejects by NAME — the chain primary key, the
 * outcome-per-decision primary key, the composite decision foreign key — and
 * those names are mapped to typed errors here rather than parsed out of driver
 * message prose.
 *
 * @packageDocumentation
 * @category repositories
 * @since 0.0.0
 */

import { DbSchema } from "@beep/epistemic-tables";
import {
  fromExecutionDecisionRow,
  fromExecutionOutcomeRow,
  toExecutionDecisionInsert,
  toExecutionOutcomeInsert,
} from "@beep/epistemic-tables/values/ExecutionRecord";
import {
  ExecutionLedger,
  ExecutionLedgerConstraintViolation,
  ExecutionLedgerUnavailable,
} from "@beep/epistemic-use-cases/ExecutionLedger";
import { PostgresDrizzle, PostgresError } from "@beep/postgres";
import { A, O } from "@beep/utils";
import { and, asc, eq, isNull } from "drizzle-orm";
import { Effect, pipe } from "effect";
import type { ExecutionLedgerError, ExecutionLedgerOperation } from "@beep/epistemic-use-cases/ExecutionLedger";

const decisionTable = DbSchema.executionDecision;
const outcomeTable = DbSchema.executionOutcome;

const DECISION_TABLE_NAME = "epistemic_execution_decision" as const;
const OUTCOME_TABLE_NAME = "epistemic_execution_outcome" as const;

const constraintNameOf = (operation: ExecutionLedgerOperation, cause: unknown): O.Option<string> =>
  PostgresError.fromUnknown(operation, cause).constraintName;

const writeFailure =
  (operation: ExecutionLedgerOperation, tableName: string) =>
  <A2, E, R>(effect: Effect.Effect<A2, E, R>): Effect.Effect<A2, ExecutionLedgerError, R> =>
    Effect.mapError(effect, (cause) =>
      pipe(
        constraintNameOf(operation, cause),
        O.match({
          onNone: () => ExecutionLedgerUnavailable.during(operation, `${operation} failed against ${tableName}`, cause),
          onSome: (constraintName) => ExecutionLedgerConstraintViolation.on(operation, constraintName),
        })
      )
    );

const readUnavailable =
  (operation: ExecutionLedgerOperation, tableName: string) =>
  <A2, E, R>(effect: Effect.Effect<A2, E, R>): Effect.Effect<A2, ExecutionLedgerUnavailable, R> =>
    effect.pipe(
      Effect.tapError((cause) =>
        Effect.logDebug("Epistemic ExecutionLedger repository dropped driver failure").pipe(
          Effect.annotateLogs({ cause, operation, table: tableName })
        )
      ),
      Effect.mapError((cause) =>
        ExecutionLedgerUnavailable.during(operation, `${operation} failed against ${tableName}`, cause)
      )
    );

export const makeDrizzleExecutionLedger = Effect.fn("Epistemic.ExecutionLedger.makeDrizzle")(function* () {
  const db = yield* PostgresDrizzle;

  return ExecutionLedger.of({
    appendDecision: Effect.fn("Epistemic.ExecutionLedger.appendDecision")(function* (record) {
      yield* db
        .insert(decisionTable)
        .values(toExecutionDecisionInsert(record))
        .pipe(writeFailure("appendDecision", DECISION_TABLE_NAME));
    }),
    appendOutcome: Effect.fn("Epistemic.ExecutionLedger.appendOutcome")(function* (record) {
      yield* db
        .insert(outcomeTable)
        .values(toExecutionOutcomeInsert(record))
        .pipe(writeFailure("appendOutcome", OUTCOME_TABLE_NAME));
    }),
    readDecisions: Effect.fn("Epistemic.ExecutionLedger.readDecisions")(function* (runKey) {
      const rows = yield* db
        .select()
        .from(decisionTable)
        .where(eq(decisionTable.runKey, runKey))
        .orderBy(asc(decisionTable.seq))
        .pipe(readUnavailable("readDecisions", DECISION_TABLE_NAME));
      return A.map(rows, fromExecutionDecisionRow);
    }),
    readOutcomes: Effect.fn("Epistemic.ExecutionLedger.readOutcomes")(function* (runKey) {
      const rows = yield* db
        .select()
        .from(outcomeTable)
        .where(eq(outcomeTable.runKey, runKey))
        .orderBy(asc(outcomeTable.recordedAt))
        .pipe(readUnavailable("readOutcomes", OUTCOME_TABLE_NAME));
      return A.map(rows, fromExecutionOutcomeRow);
    }),
    readUnsettledAllowed: Effect.fn("Epistemic.ExecutionLedger.readUnsettledAllowed")(function* (runKey) {
      // Scoped to allowed decisions on purpose: a refused dispatch legitimately
      // has no outcome row, and an unscoped LEFT JOIN would report every
      // ordinary denial as "outcome unknown".
      const rows = yield* db
        .select({ decision: decisionTable })
        .from(decisionTable)
        .leftJoin(outcomeTable, eq(outcomeTable.decisionHash, decisionTable.hash))
        .where(
          and(eq(decisionTable.runKey, runKey), eq(decisionTable.verdict, "allowed"), isNull(outcomeTable.decisionHash))
        )
        .orderBy(asc(decisionTable.seq))
        .pipe(readUnavailable("readUnsettledAllowed", DECISION_TABLE_NAME));
      return A.map(rows, (row) => fromExecutionDecisionRow(row.decision));
    }),
  });
});
```

`packages/epistemic/server/src/ExecutionLedger/ExecutionLedger.layer.ts:33-36` — VERBATIM:

```ts
export const ExecutionLedgerDrizzle: Layer.Layer<ExecutionLedger, never, PostgresDrizzle> = Layer.effect(
  ExecutionLedger,
  makeDrizzleExecutionLedger()
);
```

with this comment above it (`:16-21`), which is the doctrine to restate:

```
 * There is no in-memory sibling here, and that is deliberate: the append-only
 * property this repository sells — the chain primary key, the
 * outcome-per-decision primary key, the triggers that reject UPDATE and DELETE
 * — is enforced by the database, so an in-memory stand-in would be proving a
 * different thing than the one callers depend on.
```

### 3c. `packages/epistemic/tables/src/values/ExecutionRecord/ExecutionRecord.table.ts` — VERBATIM (module doc + both tables)

```ts
/**
 * Execution ledger table metadata: the write-ahead decision chain and the
 * post-settlement outcome records.
 *
 * These are deliberately raw `pgTable` projections, not `EntityTable.pgTableFrom`
 * over a `BaseEntity` model: `BaseEntity` bakes in `row_version`, `updated_at`,
 * and `updated_by_principal` — update vocabulary that would be a lie in the
 * schema of rows that must never mutate. The append-only guards that make the
 * ledger trustworthy — the chain primary key, the outcome-per-decision primary
 * key, the reason-iff-denied CHECK, and the `BEFORE UPDATE`/`BEFORE DELETE`
 * triggers — are owned by the raw-SQL migration rather than by Drizzle
 * metadata, because Drizzle cannot express them. This projection publishes the
 * columns; the migration publishes the invariants.
 *
 * There is deliberately no column here capable of carrying a payload: every
 * text column is a digest, a bounded literal, or a pinned semver, and the
 * absence of `jsonb` is asserted by test, not comment.
 *
 * @packageDocumentation
 * @category tables
 * @since 0.0.0
 */

import { bigint, integer, pgTable, text } from "drizzle-orm/pg-core";
import type { SinkAudience, SinkClass } from "@beep/epistemic-domain/values/ExecutionGrant";
import type { ExecutionSettlement } from "@beep/epistemic-domain/values/ExecutionRecord";
import type { DenialReason } from "@beep/epistemic-domain/values/ExecutionVerdict";

export const EXECUTION_DECISION_TABLE_NAME = "epistemic_execution_decision" as const;
export const EXECUTION_OUTCOME_TABLE_NAME = "epistemic_execution_outcome" as const;

export const executionDecisionTable = pgTable(EXECUTION_DECISION_TABLE_NAME, {
  runKey: text("run_key").notNull(),
  seq: integer("seq").notNull(),
  prevHash: text("prev_hash"),
  hash: text("hash").notNull(),
  verdict: text("verdict").notNull().$type<"allowed" | "denied">(),
  reason: text("reason").$type<DenialReason>(),
  operationDigest: text("operation_digest").notNull(),
  sinkClass: text("sink_class").notNull().$type<SinkClass>(),
  audience: text("audience").notNull().$type<SinkAudience>(),
  destinationDigest: text("destination_digest").notNull(),
  grantSetDigest: text("grant_set_digest").notNull(),
  policyRevision: text("policy_revision").notNull(),
  decidedAt: bigint("decided_at", { mode: "number" }).notNull(),
});

export const executionOutcomeTable = pgTable(EXECUTION_OUTCOME_TABLE_NAME, {
  runKey: text("run_key").notNull(),
  decisionHash: text("decision_hash").notNull().primaryKey(),
  settlement: text("settlement").notNull().$type<ExecutionSettlement>(),
  recordedAt: bigint("recorded_at", { mode: "number" }).notNull(),
  hash: text("hash").notNull(),
});
```

> ⚠️ **This module doc contradicts your entity design and you must decide
> knowingly.** ExecutionLedger deliberately did NOT use `BaseEntity`, *because*
> `BaseEntity` bakes in `row_version` / `updated_at` / `updated_by_principal`,
> "update vocabulary that would be a lie in the schema of rows that must never
> mutate." Your two entities ARE `BaseEntity.Class`. The repo has a live
> precedent for BOTH choices: `epistemic_evidence_verification` is a
> `BaseEntity` entity that is append-only-by-trigger and keeps the update
> columns (see its migration SQL in §4b — `row_version`, `updated_at`,
> `updated_by_principal` are all present, and the trigger blocks UPDATE anyway).
> So your design is precedented and does not need to change; be ready to defend
> it in review with `epistemic_evidence_verification`, not `ExecutionLedger`,
> as the citation.

### 3d. `ClaimDisposition.ports.ts` — the SPEC's second citation, VERBATIM (shape + tag + error)

`packages/epistemic/use-cases/src/ClaimDisposition/ClaimDisposition.ports.ts:1-19`:

```ts
/**
 * Claim disposition repository port: the append-only surface durable claim
 * resolutions are written to and read back from. The live implementation is
 * provided in the epistemic server tier.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $EpistemicUseCasesId } from "@beep/identity/packages";
import { LiteralKit, SchemaUtils, TaggedErrorClass } from "@beep/schema";
import { Context } from "effect";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import type { ClaimDisposition } from "@beep/epistemic-domain/entities/ClaimDisposition";
import type * as Epistemic from "@beep/shared-domain/identity/Epistemic";
import type { Effect } from "effect";

const $I = $EpistemicUseCasesId.create("ClaimDisposition/ClaimDisposition.ports");
```

`:21-42` (the operation vocabulary — note the `LiteralKit` + `withLiteralKitStatics` two-step):

```ts
const ClaimDispositionOperationBase = LiteralKit(["record", "listByClaim"]);

export const ClaimDispositionOperation = ClaimDispositionOperationBase.pipe(
  $I.annoteSchema("ClaimDispositionOperation", {
    description: "Bounded vocabulary of claim disposition repository operations.",
  }),
  SchemaUtils.withLiteralKitStatics(ClaimDispositionOperationBase)
);

export type ClaimDispositionOperation = typeof ClaimDispositionOperation.Type;
```

`:78-129` (the error — the `during(operation, reason, cause?)` constructor shape):

```ts
export class ClaimDispositionRepositoryUnavailable extends TaggedErrorClass<ClaimDispositionRepositoryUnavailable>(
  $I`ClaimDispositionRepositoryUnavailable`
)(
  "ClaimDispositionRepositoryUnavailable",
  {
    cause: S.OptionFromOptionalKey(S.Defect({ includeStack: true }))
      .pipe(SchemaUtils.withNoneDefault)
      .annotateKey({
        description: "Optional underlying driver defect captured when the repository could not serve a request.",
      }),
    operation: ClaimDispositionOperation.annotateKey({
      description: "Repository operation that could not be served.",
    }),
    reason: S.NonEmptyString.annotateKey({
      description: "Non-empty repository availability diagnostic.",
    }),
  },
  $I.annote("ClaimDispositionRepositoryUnavailable", {
    title: "Claim disposition repository unavailable",
    description: "The claim disposition repository could not serve the request.",
  })
) {
  static readonly is = S.is(ClaimDispositionRepositoryUnavailable);

  static during(
    operation: ClaimDispositionOperation,
    reason: string,
    cause?: unknown
  ): ClaimDispositionRepositoryUnavailable {
    return ClaimDispositionRepositoryUnavailable.make({
      cause: O.fromUndefinedOr(cause),
      operation,
      reason,
    });
  }
}
```

`:131-192` (the shape + tag, with the append-only prose):

```ts
/**
 * Service shape for the claim disposition repository. The surface is append and
 * read only: a disposition that has been recorded is never edited, because
 * revising it would erase the decision it exists to remember. A claim's later
 * resolution is a new disposition, and the earlier one becomes `superseded`.
 * ...
 */
export interface ClaimDispositionRepositoryShape {
  readonly listByClaim: (
    claimId: Epistemic.CandidateClaimId
  ) => Effect.Effect<ReadonlyArray<ClaimDisposition>, ClaimDispositionRepositoryUnavailable>;
  readonly record: (
    disposition: ClaimDisposition
  ) => Effect.Effect<ClaimDisposition, ClaimDispositionRepositoryUnavailable>;
}

export class ClaimDispositionRepository extends Context.Service<
  ClaimDispositionRepository,
  ClaimDispositionRepositoryShape
>()($I`ClaimDispositionRepository`) {}
```

---

## 4. db-admin migration lane — THE CRITICAL SECTION

### 4a. Where migrations live and how they are named

Directory: `packages/_internal/db-admin/drizzle/`.

Layout is **folder-per-migration**, each folder containing `migration.sql` and
`snapshot.json`. There is **no `drizzle/meta/` directory** — I verified with
`ls -la packages/_internal/db-admin/drizzle/meta` → `No such file or directory`.
That is required, not incidental: `node_modules/drizzle-orm/migrator.js:8`
**throws** if `meta/_journal.json` exists:

```js
function readMigrationFiles(config) {
	if (fs.existsSync(`${config.migrationsFolder}/meta/_journal.json`)) throw Error("We detected that you have old drizzle-kit migration folders. You must upgrade drizzle-kit and run \"drizzle-kit up\"");
	const migrationFolderTo = config.migrationsFolder;
	const migrationQueries = [];
	const migrations = readdirSync(migrationFolderTo).map((subdir) => ({
		path: join(migrationFolderTo, subdir, "migration.sql"),
		name: subdir
	})).filter((it) => existsSync(it.path));
	migrations.sort((a, b) => a.name.localeCompare(b.name));
	for (const migration of migrations) {
		const migrationPath = migration.path;
		const migrationDate = migration.name.slice(0, 14);
		const query = fs.readFileSync(migrationPath).toString();
		const result = query.split("--> statement-breakpoint").map((it) => {
			return it;
		});
		const millis = formatToMillis(migrationDate);
		migrationQueries.push({
			sql: result,
			bps: true,
			folderMillis: millis,
			hash: crypto.createHash("sha256").update(query).digest("hex"),
			name: migration.name
		});
	}
	return migrationQueries;
}
```

**Naming convention:** `<14-digit UTC timestamp>_<snake_case_slug>` — order is
**lexicographic on the folder name**, and the first 14 chars must parse as a
timestamp. Current contents, in applied order:

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
```

The 14-digit prefix is validated elsewhere too —
`packages/drivers/postgres/src/PostgresDrizzle.service.ts:224-231`:

```ts
const MigrationBundleEntryName = S.String.check(
  S.isPattern(/^\d{14}/, {
    identifier: $I`MigrationBundleEntryNameCheck`,
    title: "Timestamped migration bundle entry name",
    description: "A Drizzle migration folder name beginning with a 14-digit UTC timestamp.",
    message: "Expected a migration folder name beginning with a 14-digit UTC timestamp.",
  })
);
```

Application entry point — `packages/_internal/db-admin/src/migrate.ts:35,51,77-86`:

```ts
export const migrationsFolder: string = fileURLToPath(new URL("../drizzle", import.meta.url));
export const migrationsSchema = "drizzle" as const;

export const migrateOnBoot: Effect.Effect<undefined, PostgresError, PostgresDrizzle> = Effect.gen(function* () {
  const db = yield* PostgresDrizzle;
  yield* migrate(db, { migrationsFolder, migrationsSchema });
  yield* Effect.logInfo("db-admin migrations applied").pipe(
    Effect.annotateLogs({ component: "db-admin", migrationsSchema })
  );
  return undefined;
});
```

### 4b. `20260730043536_epistemic_evidence_verification/migration.sql` — VERBATIM, whole file (47 lines)

```sql
CREATE TABLE "epistemic_evidence_verification" (
	"created_at" bigint NOT NULL,
	"created_by_principal" jsonb NOT NULL,
	"org_id" integer NOT NULL,
	"row_version" integer NOT NULL,
	"schema_version" text NOT NULL,
	"source" text NOT NULL,
	"updated_at" bigint NOT NULL,
	"updated_by_principal" jsonb NOT NULL,
	"evidence_id" integer NOT NULL,
	"manifestation_key" text NOT NULL,
	"verified_anchor" jsonb NOT NULL,
	"entity_type" text NOT NULL,
	"id" serial PRIMARY KEY,
	"public_id" text NOT NULL
);
--> statement-breakpoint
CREATE INDEX "epistemic_evidence_verification_org_id_btree_idx" ON "epistemic_evidence_verification" ("org_id");--> statement-breakpoint
CREATE INDEX "epistemic_evidence_verification_source_btree_idx" ON "epistemic_evidence_verification" ("source");--> statement-breakpoint
CREATE UNIQUE INDEX "epistemic_evidence_verification_public_id_unique_idx" ON "epistemic_evidence_verification" ("public_id");--> statement-breakpoint
CREATE INDEX "epistemic_evidence_verification_as_of_idx"
	ON "epistemic_evidence_verification" ("org_id", "evidence_id", "created_at", "id");--> statement-breakpoint
ALTER TABLE "epistemic_evidence"
	ADD CONSTRAINT "epistemic_evidence_org_id_id_unique"
	UNIQUE ("org_id", "id");--> statement-breakpoint
ALTER TABLE "epistemic_evidence_verification"
	ADD CONSTRAINT "epistemic_evidence_verification_evidence_fk"
	FOREIGN KEY ("org_id", "evidence_id")
	REFERENCES "epistemic_evidence" ("org_id", "id");--> statement-breakpoint
ALTER TABLE "epistemic_evidence_verification"
	ADD CONSTRAINT "epistemic_evidence_verification_manifestation_unique"
	UNIQUE ("org_id", "manifestation_key");--> statement-breakpoint
ALTER TABLE "epistemic_evidence_verification"
	ADD CONSTRAINT "epistemic_evidence_verification_manifestation_sha256"
	CHECK ("manifestation_key" ~ '^[0-9a-f]{64}$');--> statement-breakpoint
CREATE FUNCTION epistemic_evidence_verification_block_mutation() RETURNS trigger
LANGUAGE plpgsql AS $guard$
BEGIN
	RAISE EXCEPTION 'epistemic evidence verification records are append-only: % on %', TG_OP, TG_TABLE_NAME;
END;
$guard$;--> statement-breakpoint
CREATE TRIGGER epistemic_evidence_verification_append_only
	BEFORE UPDATE OR DELETE ON "epistemic_evidence_verification"
	FOR EACH ROW EXECUTE FUNCTION epistemic_evidence_verification_block_mutation();--> statement-breakpoint
CREATE TRIGGER epistemic_evidence_verification_block_truncate
	BEFORE TRUNCATE ON "epistemic_evidence_verification"
	FOR EACH STATEMENT EXECUTE FUNCTION epistemic_evidence_verification_block_mutation();
```

Notes you will need:

- Statement separator is the literal `--> statement-breakpoint` (drizzle splits
  on it, `migrator.js:19`). Indentation inside a statement is **hard tabs**.
- The `CREATE TABLE` block, the three `CREATE INDEX`/`CREATE UNIQUE INDEX`
  lines, and the column order are exactly what `drizzle-kit generate` emitted
  from `EntityTable.pgTableFrom`. Everything from `CREATE INDEX
  "…_as_of_idx"` onward is **hand-appended**.
- Column order for a `BaseEntity` table is: base block
  (`created_at, created_by_principal, org_id, row_version, schema_version,
  source, updated_at, updated_by_principal`), then the entity's own persisted
  fields in declaration order, then `entity_type`, `id serial PRIMARY KEY`,
  `public_id`. `id` is the PK; `public_id` gets a unique index, not a
  constraint — hence `…_pkey` (Postgres-default name) shows up in the
  constraint list rather than a custom `_pk`.
- `org_id` and `source` get default btree indexes; those come from `BaseEntity`.

The multi-table variant is
`packages/_internal/db-admin/drizzle/20260730042420_epistemic_contradiction_triage/migration.sql`
(155 lines) — **one** guard function shared by three tables, six triggers, tail
VERBATIM:

```sql
CREATE FUNCTION epistemic_contradiction_block_mutation() RETURNS trigger
LANGUAGE plpgsql AS $guard$
BEGIN
	RAISE EXCEPTION 'epistemic contradiction records are append-only: % on %', TG_OP, TG_TABLE_NAME;
END;
$guard$;--> statement-breakpoint
CREATE TRIGGER epistemic_contradiction_candidate_append_only
	BEFORE UPDATE OR DELETE ON "epistemic_contradiction_candidate"
	FOR EACH ROW EXECUTE FUNCTION epistemic_contradiction_block_mutation();--> statement-breakpoint
CREATE TRIGGER epistemic_contradiction_receipt_append_only
	BEFORE UPDATE OR DELETE ON "epistemic_contradiction_receipt"
	FOR EACH ROW EXECUTE FUNCTION epistemic_contradiction_block_mutation();--> statement-breakpoint
CREATE TRIGGER epistemic_contradiction_disposition_append_only
	BEFORE UPDATE OR DELETE ON "epistemic_contradiction_disposition"
	FOR EACH ROW EXECUTE FUNCTION epistemic_contradiction_block_mutation();--> statement-breakpoint
CREATE TRIGGER epistemic_contradiction_candidate_block_truncate
	BEFORE TRUNCATE ON "epistemic_contradiction_candidate"
	FOR EACH STATEMENT EXECUTE FUNCTION epistemic_contradiction_block_mutation();--> statement-breakpoint
CREATE TRIGGER epistemic_contradiction_receipt_block_truncate
	BEFORE TRUNCATE ON "epistemic_contradiction_receipt"
	FOR EACH STATEMENT EXECUTE FUNCTION epistemic_contradiction_block_mutation();--> statement-breakpoint
CREATE TRIGGER epistemic_contradiction_disposition_block_truncate
	BEFORE TRUNCATE ON "epistemic_contradiction_disposition"
	FOR EACH STATEMENT EXECUTE FUNCTION epistemic_contradiction_block_mutation();
```

**This is the shape to copy for two tables in one migration**: one
`law_practice_candor_block_mutation()` function, two `_append_only` triggers,
two `_block_truncate` triggers.

### 4c. plpgsql splitter constraint (read before writing the guard body)

`packages/_internal/db-admin/AGENTS.md:14-21`, VERBATIM:

```
- plpgsql in migration SQL is legal but splitter-constrained: the
  `LegacyStatementBoundary` splitter is not dollar-quote-aware, so a function
  body must never contain `;` + newline followed by one of its 12 boundary
  keywords (ALTER/BEGIN/COMMENT/CREATE/DELETE/DROP/GRANT/INSERT/REVOKE/SET/
  TRUNCATE/UPDATE/WITH — note `BEGIN` is one). A single-`RAISE` guard body is
  safe (precedent: `20260726210000_epistemic_execution_ledger`); a body that
  issues INSERT/UPDATE statements would be split mid-function and fail loudly
  at migration time. Extend the splitter before writing such a body.
```

The splitter itself is `packages/drivers/postgres/src/PostgresDrizzle.service.ts:134-147`:

```ts
const splitLegacyMigrationStatement = flow(
  Str.trim,
  Str.split(LegacyStatementBoundary),
  A.map(Str.trim),
  A.filter(Str.isNonEmpty),
  A.map((part) => (Str.endsWith(";")(part) ? part : `${part};`))
);

const normalizeMigration = (migration: MigrationMeta): MigrationMeta => ({
  ...migration,
  sql: A.flatMap(migration.sql, splitLegacyMigrationStatement),
});
```

**Keep the guard body to exactly one `RAISE EXCEPTION`.**

### 4d. What generates a migration — the exact command

`drizzle-kit`, driven by these two scripts in `packages/_internal/db-admin/package.json`:

```json
    "generate": "bunx --bun drizzle-kit generate",
    "generate:custom": "bunx --bun drizzle-kit generate --custom",
    "migrations:check": "bun run scripts/check-migrations-drift.ts",
```

**The command is, from `packages/_internal/db-admin`:**

```
bun run generate -- --name law_practice_candor_gate
```

(`AGENTS.md:5-8`: "Migration authoring is drizzle-kit driven since the
`20260725222615_baseline` snapshot: schema changes go through
`bun run generate -- --name <slug>` (hand-written SQL through `generate:custom`
— snapshot-less folders are invisible to drizzle-kit's chain).")

**Then hand-append** the ALTER TABLE / CHECK / CREATE FUNCTION / CREATE TRIGGER
statements to the generated `migration.sql`. Do **not** use `generate:custom` —
it produces a snapshot-less folder that breaks the chain.

Config it reads — `packages/_internal/db-admin/drizzle.config.ts` VERBATIM:

```ts
import { defineConfig } from "drizzle-kit";
import { Config, Effect } from "effect";

const databaseUrl = Effect.runSync(
  Config.string("BEEP_TEST_DATABASE_URL").pipe(
    Config.withDefault("postgres://postgres:postgres@127.0.0.1:5432/postgres")
  )
);

export default defineConfig({
  dbCredentials: {
    url: databaseUrl,
  },
  dialect: "postgresql",
  introspect: {
    casing: "camel",
  },
  out: "./drizzle",
  schema: "./src/schema.ts",
});
```

**Files each generate writes:** exactly two, both inside the new folder —
`migration.sql` and `snapshot.json`. No journal, no `meta/`. Confirmed by
`ls -la packages/_internal/db-admin/drizzle/20260730043536_epistemic_evidence_verification`:

```
-rw-r--r-- 1   2535 migration.sql
-rw-r--r-- 1 116876 snapshot.json
```

`snapshot.json` is a **whole-database** snapshot (`version: "8"`,
`dialect: "postgres"`, `id`, `prevIds: [<previous snapshot id>]`, `ddl: [...]`,
`renames`) — it lists every table in the repo, not just the new ones, so it will
be ~117 KB and it chains via `prevIds`.

**`git show --stat` on the commit that added it** (`244529aa4f`, "feat(epistemic):
add contradiction source triage (#520)") — the db-admin/proof-relevant subset:

```
 packages/_internal/db-admin/src/schema.ts                                  |   68 +
 packages/_internal/db-admin/src/targets.ts                                 |   35 +-
 packages/_internal/db-admin/test/integration/EpistemicContradictionMigration.pglite.test.ts | 531 +++
 packages/_internal/db-admin/test/integration/EpistemicEdgeMigration.pglite.test.ts          |   3 +-
 packages/epistemic/domain/src/entities/EvidenceVerification/EvidenceVerification.model.ts   | 166 +
 packages/epistemic/domain/src/entities/EvidenceVerification/index.ts                        |  21 +
 packages/epistemic/domain/src/values/EvidenceVerification/EvidenceVerification.model.ts     | 151 +
 packages/epistemic/domain/src/values/EvidenceVerification/index.ts                          |  21 +
 packages/epistemic/domain/test/EvidenceVerification.test.ts                                 | 154 +
 packages/epistemic/tables/src/entities/EvidenceVerification/EvidenceVerification.converters.ts | 134 +
 packages/epistemic/tables/src/entities/EvidenceVerification/EvidenceVerification.table.ts      |  27 +
 packages/epistemic/tables/src/entities/EvidenceVerification/index.ts                           |  35 +
 packages/epistemic/tables/test/EvidenceVerificationTables.test.ts                              | 268 ++
 packages/tooling/tool/cli/src/commands/Architecture/internal/AcceptedProofManifest.ts          |  36 +
 apps/professional-desktop/src/runtime/Migrations.gen.ts                                        | 210 +
 bun.lock                                                                                       |  64 +-
```

(The two `drizzle/…` folders themselves are in the commit but `--stat` elides
their paths; the `.../ops/manifest.json` rows are goal-packet bookkeeping.)

Note `apps/professional-desktop/src/runtime/Migrations.gen.ts` +210 — **that
file is regenerated by landing a migration** (see §4f).

### 4e. Per-slice registration a NEW slice's first migration must join

Yes — **four** registration points, and law-practice is in none of them.

**(1) `packages/_internal/db-admin/src/schema.ts` — the drizzle-kit generate surface.**
This is what makes a table visible to `drizzle-kit generate` at all. Module doc,
`packages/_internal/db-admin/src/schema.ts:1-17`, VERBATIM:

```ts
/**
 * db-admin Drizzle schema barrel — the `drizzle-kit generate` surface.
 *
 * drizzle-kit's export scanner only inspects top-level exports for pgTable
 * values, so every table that participates in migration generation MUST be
 * re-exported flat here; exporting a table from this file is what schedules
 * its migrations. The `DbSchema` aggregates are re-exported for consumers that
 * want the grouped shape, but drizzle-kit cannot see through them.
 *
 * `workspace_candidate_draft` / `workspace_candidate_project` are deliberately
 * NOT exported: they have no deployed table, and baking them into the baseline
 * snapshot would suppress their eventual CREATE migration.
 *
 * @packageDocumentation
 * @category configuration
 * @since 0.0.0
 */
```

Imports (`:19-22`) and the flat-export idiom (`:206-221`, the evidence-verification precedent):

```ts
import { DbSchema as ArchitectureLabDbSchema } from "@beep/architecture-lab-tables/tables";
import { DbSchema as DocumentsDbSchema } from "@beep/documents-tables/tables";
import { DbSchema as EpistemicDbSchema } from "@beep/epistemic-tables";
import { DbSchema as WorkspaceDbSchema } from "@beep/workspace-tables";
```

```ts
/**
 * Epistemic evidence-verification table (drizzle-kit generate surface).
 *
 * @example
 * ```ts
 * import { epistemicEvidenceVerificationTable } from "@beep/db-admin/schema"
 *
 * console.log(epistemicEvidenceVerificationTable.definition.tableName)
 * // "epistemic_evidence_verification"
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const epistemicEvidenceVerificationTable: typeof EpistemicDbSchema.evidenceVerification =
  EpistemicDbSchema.evidenceVerification;
```

`@beep/law-practice-tables` is **not imported here at all** — verified by
`rg "law-practice" packages/_internal/db-admin/src/schema.ts` → no matches.

> ⚠️ If you add the whole law-practice `DbSchema` you would also schedule
> `kg_node` / `kg_edge` / `kg_build` for migration — which is wrong, they are
> disposable per-bundle read models. **Export only the two new tables flat.**
> This is exactly the hazard the module doc's `workspace_candidate_*` note
> warns about, in reverse.

**(2) `packages/_internal/db-admin/src/migrations/<Name>.ts` — a new migration target module.**
Precedent, `packages/_internal/db-admin/src/migrations/EpistemicContradictionTriage.ts` VERBATIM:

```ts
/**
 * Epistemic contradiction-triage db-admin migration target.
 *
 * @packageDocumentation
 * @category configuration
 * @since 0.0.0
 */

import { DbSchema as EpistemicDbSchema } from "@beep/epistemic-tables";
import { DbAdminMigrationTarget } from "./ArchitectureLab.ts";

/**
 * Additive contradiction-triage and evidence-verification table target.
 *
 * @example
 * ```ts
 * import { EpistemicContradictionTriageMigrationTarget } from "@beep/db-admin/targets"
 *
 * console.log(EpistemicContradictionTriageMigrationTarget.name)
 * // "epistemic-contradiction-triage"
 * console.log(EpistemicContradictionTriageMigrationTarget.tables.length)
 * // 4
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const EpistemicContradictionTriageMigrationTarget: DbAdminMigrationTarget = DbAdminMigrationTarget.make({
  drizzleSchema: {
    contradictionCandidate: EpistemicDbSchema.contradictionCandidate,
    contradictionDisposition: EpistemicDbSchema.contradictionDisposition,
    contradictionReceipt: EpistemicDbSchema.contradictionReceipt,
    evidenceVerification: EpistemicDbSchema.evidenceVerification,
  },
  name: "epistemic-contradiction-triage",
  schemaName: "epistemic",
  tables: [
    "epistemic_contradiction_candidate",
    "epistemic_contradiction_receipt",
    "epistemic_contradiction_disposition",
    "epistemic_evidence_verification",
  ],
});
```

The `DbAdminMigrationTarget` class it constructs
(`packages/_internal/db-admin/src/migrations/ArchitectureLab.ts:79-98`, and the
validating patterns at `:17-18`):

```ts
const MigrationTargetNamePattern = /^[a-z][a-z0-9-]*$/u;   // kebab-case
const PostgresIdentifierPattern = /^[a-z][a-z0-9_]*$/u;    // snake_case
```

```ts
export class DbAdminMigrationTarget extends S.Class<DbAdminMigrationTarget>($I`DbAdminMigrationTarget`)(
  {
    drizzleSchema: DrizzleMigrationSchema.annotateKey({
      description: "Imported Drizzle table-schema object used only for migration generation.",
    }),
    name: MigrationTargetName.annotateKey({
      description: "Lowercase kebab-case migration target name.",
    }),
    schemaName: PostgresSchemaName.annotateKey({
      description: "Lowercase PostgreSQL schema name used by the target.",
    }),
    tables: S.NonEmptyArray(MigrationTableName).annotateKey({
      description: "Non-empty list of lowercase PostgreSQL table names covered by the target.",
    }),
  },
  $I.annote("DbAdminMigrationTarget", {
    title: "db-admin migration target",
    description: "Migration target metadata consumed by the db-admin aggregation proof.",
  })
) {}
```

`schemaName` is **metadata only** — everything lives in `public` with prefixed
table names; `EpistemicExecutionLedgerMigrationTarget` sets
`schemaName: "epistemic"`. For law-practice use `schemaName: "law_practice"`.

**(3) `packages/_internal/db-admin/src/targets.ts` — the registry.** VERBATIM `:9-57`:

```ts
import { Effect } from "effect";
import { ArchitectureLabMigrationTarget } from "./migrations/ArchitectureLab.ts";
import { DocumentsSyncMigrationTarget } from "./migrations/DocumentsSync.ts";
import { EpistemicContradictionTriageMigrationTarget } from "./migrations/EpistemicContradictionTriage.ts";
import { EpistemicEdgeMigrationTarget } from "./migrations/EpistemicEdge.ts";
import { EpistemicExecutionLedgerMigrationTarget } from "./migrations/EpistemicExecutionLedger.ts";
import { EpistemicUsageMigrationTarget } from "./migrations/EpistemicUsage.ts";
import { WorkspaceThreadMigrationTarget } from "./migrations/WorkspaceThread.ts";
import type { DbAdminMigrationTarget } from "./migrations/ArchitectureLab.ts";

export {
  ArchitectureLabMigrationTarget,
  DocumentsSyncMigrationTarget,
  EpistemicContradictionTriageMigrationTarget,
  EpistemicEdgeMigrationTarget,
  EpistemicExecutionLedgerMigrationTarget,
  EpistemicUsageMigrationTarget,
  WorkspaceThreadMigrationTarget,
};

export const DbAdminMigrationTargets = [
  ArchitectureLabMigrationTarget,
  WorkspaceThreadMigrationTarget,
  EpistemicUsageMigrationTarget,
  DocumentsSyncMigrationTarget,
  EpistemicEdgeMigrationTarget,
  EpistemicContradictionTriageMigrationTarget,
  EpistemicExecutionLedgerMigrationTarget,
] as const;
```

Note the `@example` blocks at `:38-44` and `:64-72` both print a hard-coded
target-name array that is **already stale** (six names for seven targets). Adding
an eighth target means touching those examples or leaving them equally stale —
`docgen` executes `@example` blocks, so `console.log` output is not asserted;
the examples compile, they do not assert. Low risk, but be deliberate.

**(4) `packages/_internal/db-admin/package.json` deps + `tsconfig.json` references.**
Current deps:

```json
  "dependencies": {
    "@beep/architecture-lab-tables": "workspace:^",
    "@beep/documents-tables": "workspace:^",
    "@beep/epistemic-tables": "workspace:^",
    "@beep/postgres": "workspace:^",
    "@beep/workspace-tables": "workspace:^",
    "effect": "catalog:"
  },
```

Current `packages/_internal/db-admin/tsconfig.json` references: architecture-lab/tables,
documents/tables, drivers/postgres, epistemic/tables, foundation/modeling/utils,
tooling/test-kit/test-utils, workspace/tables. **`@beep/law-practice-tables` is
absent from both.**

**Drift gate.** `beep:check` runs `migrations:check`
(`packages/_internal/db-admin/package.json`: `"beep:check": "tsgo -b tsconfig.json && tsgo -p tsconfig.drizzle.json && bun run beep:check:tests && bun run migrations:check"`).
The script, `packages/_internal/db-admin/scripts/check-migrations-drift.ts:26-47`:

```ts
  cpSync(drizzleFolder, scratch, { recursive: true });
  const before = HashSet.fromIterable(readdirSync(scratch));

  await $`bunx --bun drizzle-kit generate --dialect postgresql --schema ./src/schema.ts --out ${scratch} --name drift_check`
    .cwd(packageRoot)
    .quiet();

  const newFolders = readdirSync(scratch).filter((entry) => !HashSet.has(before, entry));
  if (newFolders.length > 0) {
    /* prints each pending migration.sql and throws */
    throw new MigrationsDriftError({
      message:
        "db-admin schema changed without a migration. Run `bun run generate -- --name <slug>` in packages/_internal/db-admin, review the SQL, and commit the new drizzle folder.",
      newFolders,
    });
  }
```

So: **flat-export the tables in `schema.ts` → `migrations:check` immediately goes
red → run generate → hand-append the guards → green.** Hand-appended SQL does not
affect drift, because drift is computed from `schema.ts` vs the chained
`snapshot.json`, never from `migration.sql`.

### 4f. Downstream consumer that also must be re-synced

`packages/_internal/db-admin/AGENTS.md:12-13`: "After landing a migration,
re-sync the desktop bundle: `bun run --cwd apps/professional-desktop codegen`."

`apps/professional-desktop/package.json:16-17,25`:

```json
    "codegen": "bun run scripts/sync-migration-bundle.ts --write",
    "codegen:check": "bun run scripts/sync-migration-bundle.ts --check",
    "beep:check": "tsgo -b tsconfig.json && bun run codegen:check",
```

`apps/professional-desktop/src/runtime/Migrations.gen.ts:1-8` header:

```ts
/**
 * Generated from `packages/_internal/db-admin/drizzle` by
 * `scripts/sync-migration-bundle.ts`. Do not edit; refresh with
 * `bun run --cwd apps/professional-desktop codegen`.
 * ...
 */
```

**This is a hosted-gate trap:** if you land a migration and do not run the
desktop codegen, `apps/professional-desktop` `beep:check` fails on
`codegen:check`. The migration SQL is embedded **byte-exactly** into that file.

---

## 5. `AcceptedProofManifest`

**Location:** `packages/tooling/tool/cli/src/commands/Architecture/internal/AcceptedProofManifest.ts`
(888 lines). Exports `AcceptedProofFile` (schema class, `:38-48`),
`acceptedProofFiles` (the array, `:130`), `legacyFixturePaths` (`:884`).

**Schema** — `:38-48`, VERBATIM:

```ts
export class AcceptedProofFile extends S.Class<AcceptedProofFile>($I`AcceptedProofFile`)(
  {
    role: ArchitectureSliceRole,
    stage: ArchitecturePlanStage,
    path: S.String,
    writer: ArchitectureWriterKind,
  },
  $I.annote("AcceptedProofFile", {
    description: "Internal descriptor for a canonical proof file used to generate architecture operation plans.",
  })
) {}
```

**The two entries the evidence-verification migration added** —
`AcceptedProofManifest.ts:790-801`, VERBATIM:

```ts
  AcceptedProofFile.make({
    role: "db-admin",
    stage: "persistence",
    path: "packages/_internal/db-admin/drizzle/20260730043536_epistemic_evidence_verification/migration.sql",
    writer: "template",
  }),
  AcceptedProofFile.make({
    role: "db-admin",
    stage: "persistence",
    path: "packages/_internal/db-admin/drizzle/20260730043536_epistemic_evidence_verification/snapshot.json",
    writer: "json",
  }),
```

Its sibling target-module entry — `:718-723`:

```ts
  AcceptedProofFile.make({
    role: "db-admin",
    stage: "persistence",
    path: "packages/_internal/db-admin/src/migrations/EpistemicContradictionTriage.ts",
    writer: "template",
  }),
```

and its PGlite-test entry — `:850-855`:

```ts
  AcceptedProofFile.make({
    role: "db-admin",
    stage: "persistence",
    path: "packages/_internal/db-admin/test/integration/EpistemicContradictionMigration.pglite.test.ts",
    writer: "template",
  }),
```

**Rules extracted:** every new db-admin file in `src/`, `test/`, or `drizzle/`
gets an entry with `role: "db-admin"`, `stage: "persistence"`,
`writer: "template"` — **except** `snapshot.json`, which is `writer: "json"`.
Order matters for the plan output (it's a plain ordered array); the manifest
groups by kind (target modules first, then drizzle folders, then tests) rather
than strictly alphabetically.

**How it is consumed** —
`packages/tooling/tool/cli/src/commands/Architecture/Architecture.plan.ts:22`
imports it, and `:186-200` maps every entry to an `ensure-file` operation:

```ts
    operations: [
      ...pipe(
        acceptedProofFiles,
        A.map((file) =>
          withOperationMetadata(
            EnsureFileOperation.make({
              kind: "ensure-file",
              role: file.role,
              path: file.path,
              description: `Ensure ${file.role} ${defaultPlanTarget.concept} topology file exists.`,
            }),
            "accepted-proof"
          )
        )
      ),
```

**What validates it** — `packages/tooling/tool/cli/test/architecture-operation-plan.test.ts`.
It enumerates the real repo surface under three roots (`:61-65`):

```ts
const architectureProofRoots = [
  "packages/architecture-lab",
  "apps/architecture-lab-proof",
  "packages/_internal/db-admin",
] as const;
```

and treats **everything under `packages/_internal/db-admin/drizzle/`** as
manifest-included (`:78-79` and `:152-156`):

```ts
  "packages/_internal/db-admin/drizzle/**",
```

```ts
const isManifestIncludedRelativeFile = (
  repoPath: string,
  topLevelFiles: ReadonlyArray<string>,
  includeDrizzle = false
): boolean =>
  pipe(topLevelFiles, A.contains(repoPath)) ||
  Str.startsWith("src/")(repoPath) ||
  Str.startsWith("test/")(repoPath) ||
  (includeDrizzle && Str.startsWith("drizzle/")(repoPath));
```

**So the on-disk file set is diffed against the manifest — a new drizzle folder
that is not in `acceptedProofFiles` fails this test.**

**Commands:**

- Emit the plan: `bun run beep architecture plan [--slice … --concept … --domain-kind … --stage …]`
  (`Architecture.command.ts:158-170`).
- Idempotency check: `bun run beep architecture check --file <plan.json>`
  (`Architecture.command.ts:185-196`).
- The gate that actually fails CI: `bunx --bun vitest run packages/tooling/tool/cli/test/architecture-operation-plan.test.ts`
  (runs in the repo-cli `beep:test` lane).

There is **no regenerate command** — `acceptedProofFiles` is hand-edited.

---

## 6. PGlite migration test

The evidence-verification proof lives in
`packages/_internal/db-admin/test/integration/EpistemicContradictionMigration.pglite.test.ts`
(first `it.effect`, "migrates the tenant-bound append-only evidence-verification
sidecar"). **The cleanest structural template is the sibling file** —
`packages/_internal/db-admin/test/integration/EpistemicExecutionLedgerMigration.pglite.test.ts`,
VERBATIM, whole file (154 lines):

```ts
import { fileURLToPath } from "node:url";
import { inspect } from "node:util";
import { DbSchema as EpistemicDbSchema } from "@beep/epistemic-tables";
import { makeDrizzle, migrate } from "@beep/postgres";
import { makePgliteIntegrationGate, makePgliteSqlTestLayer, TestDatabaseInfo } from "@beep/test-utils";
import { A } from "@beep/utils";
import { describe, expect, layer } from "@effect/vitest";
import { btree_gist } from "@electric-sql/pglite/contrib/btree_gist";
import { Effect, Layer, Order, pipe } from "effect";
import * as O from "effect/Option";
import * as SqlClient from "effect/unstable/sql/SqlClient";

const { shouldRunPgliteIntegration } = makePgliteIntegrationGate();
const migrationsFolder = fileURLToPath(new URL("../../drizzle", import.meta.url));

// The drizzle folder contains `CREATE EXTENSION btree_gist` (the epistemic edge
// migration's gist exclusion constraint), which the shared external
// pglite-socket lane cannot load. Extension-dependent proofs are pinned to the
// in-process lane.
const makeMigrationProofLayer = () =>
  Layer.fresh(makePgliteSqlTestLayer({ inProcess: { extensions: { btree_gist } }, mode: "in-process" }));

const ledgerTableNames: ReadonlyArray<string> = ["epistemic_execution_decision", "epistemic_execution_outcome"];

// Every name below is load-bearing: the repository maps constraint violations
// by name, never by message prose, so a silent rename is a silent behavior
// change.
const expectedConstraintNames: ReadonlyArray<string> = [
  "epistemic_execution_decision_audience_bounded",
  "epistemic_execution_decision_genesis_prev",
  "epistemic_execution_decision_hash_unique",
  "epistemic_execution_decision_hash_verdict_unique",
  "epistemic_execution_decision_pk",
  "epistemic_execution_decision_reason_bounded",
  "epistemic_execution_decision_reason_iff_denied",
  "epistemic_execution_decision_run_hash_unique",
  "epistemic_execution_decision_seq_nonnegative",
  "epistemic_execution_decision_sink_class_bounded",
  "epistemic_execution_decision_verdict_bounded",
  "epistemic_execution_outcome_decision_fk",
  "epistemic_execution_outcome_decision_verdict_fk",
  "epistemic_execution_outcome_hash_unique",
  "epistemic_execution_outcome_pk",
  "epistemic_execution_outcome_settlement_bounded",
  "epistemic_execution_outcome_settles_allowed",
];

const expectedTriggerNames: ReadonlyArray<string> = [
  "epistemic_execution_decision_append_only",
  "epistemic_execution_decision_block_truncate",
  "epistemic_execution_outcome_append_only",
  "epistemic_execution_outcome_block_truncate",
];

const digest = (fill: string): string => fill.repeat(64);

const runKey = digest("a");

const decisionRowFixture = (seq: number, hash: string, prevHash: string | null) => ({
  audience: "external-network" as const,
  decidedAt: 1_000 + seq,
  destinationDigest: digest("d"),
  grantSetDigest: digest("e"),
  hash,
  operationDigest: digest("c"),
  policyRevision: "1.0.0",
  prevHash,
  runKey,
  seq,
  sinkClass: "network-egress" as const,
  verdict: "allowed" as const,
});

const sortedNames = (names: ReadonlyArray<string>): ReadonlyArray<string> => A.sort(names, Order.String);

if (!shouldRunPgliteIntegration) {
  describe.skip("db-admin epistemic-execution-ledger migration PgLite integration", () => {});
} else {
  describe("db-admin epistemic-execution-ledger migration PgLite integration", { concurrent: false }, () => {
    layer(makeMigrationProofLayer(), { timeout: "2 minutes" })((it) => {
      it.effect(
        "runs the epistemic-execution-ledger migration target SQL",
        Effect.fnUntraced(function* () {
          const info = yield* TestDatabaseInfo;
          const db = yield* makeDrizzle();
          const migrationsSchema = pipe(
            info.schema,
            O.getOrElse(() => "drizzle")
          );

          yield* migrate(db, { migrationsFolder, migrationsSchema });

          const sql = (yield* SqlClient.SqlClient).withoutTransforms();
          const constraintRows = yield* sql<{ readonly conname: string; readonly relname: string }>`
            SELECT constraint_class.conname, table_class.relname
            FROM pg_constraint AS constraint_class
            JOIN pg_class AS table_class ON table_class.oid = constraint_class.conrelid
            WHERE constraint_class.contype IN ('c', 'f', 'p', 'u', 'x')
          `;
          const triggerRows = yield* sql<{ readonly tgname: string; readonly relname: string }>`
            SELECT trigger_class.tgname, table_class.relname
            FROM pg_trigger AS trigger_class
            JOIN pg_class AS table_class ON table_class.oid = trigger_class.tgrelid
            WHERE NOT trigger_class.tgisinternal
          `;

          const constraintNames = pipe(
            constraintRows,
            A.filter((row) => A.contains(ledgerTableNames, row.relname)),
            A.map((row) => row.conname),
            sortedNames
          );
          const triggerNames = pipe(
            triggerRows,
            A.filter((row) => A.contains(ledgerTableNames, row.relname)),
            A.map((row) => row.tgname),
            sortedNames
          );

          expect(constraintNames).toEqual(expectedConstraintNames);
          expect(triggerNames).toEqual(expectedTriggerNames);

          yield* db.insert(EpistemicDbSchema.executionDecision).values(decisionRowFixture(0, digest("1"), null));
          yield* db.insert(EpistemicDbSchema.executionDecision).values(decisionRowFixture(1, digest("2"), digest("1")));
          yield* db.insert(EpistemicDbSchema.executionOutcome).values({
            decisionHash: digest("1"),
            hash: digest("f"),
            recordedAt: 5_000,
            runKey,
            settlement: "completed",
          });

          const decisionRows = yield* db.select().from(EpistemicDbSchema.executionDecision);
          const outcomeRows = yield* db.select().from(EpistemicDbSchema.executionOutcome);

          expect(decisionRows).toHaveLength(2);
          expect(outcomeRows).toHaveLength(1);
          expect(A.map(decisionRows, (row) => row.seq)).toEqual([0, 1]);

          // The adversarial probe stays LAST: implicit-transaction pglite hosts
          // roll the whole session chain back after an intentional failure, so
          // no statement may follow it. A direct UPDATE is rejected by the
          // append-only trigger.
          const mutation = yield* Effect.flip(sql`
            UPDATE epistemic_execution_decision SET destination_digest = ${digest("9")} WHERE seq = 0
          `);

          expect(inspect(mutation, { depth: 10 })).toContain("append-only");
        }),
        120_000
      );
    });
  });
}
```

The evidence-verification variant, for its table-scoped query form
(`EpistemicContradictionMigration.pglite.test.ts:31-78, 146-153`), VERBATIM:

```ts
const expectedVerificationConstraints: ReadonlyArray<string> = [
  "epistemic_evidence_verification_evidence_fk",
  "epistemic_evidence_verification_manifestation_sha256",
  "epistemic_evidence_verification_manifestation_unique",
  "epistemic_evidence_verification_pkey",
];

const expectedVerificationTriggers: ReadonlyArray<string> = [
  "epistemic_evidence_verification_append_only",
  "epistemic_evidence_verification_block_truncate",
];
```

```ts
          const constraintRows = yield* sql<{ readonly conname: string }>`
            SELECT constraint_class.conname
            FROM pg_constraint AS constraint_class
            JOIN pg_class AS table_class ON table_class.oid = constraint_class.conrelid
            WHERE table_class.relname = 'epistemic_evidence_verification'
              AND constraint_class.contype IN ('c', 'f', 'p', 'u')
          `;
          const triggerRows = yield* sql<{ readonly tgname: string }>`
            SELECT trigger_class.tgname
            FROM pg_trigger AS trigger_class
            JOIN pg_class AS table_class ON table_class.oid = trigger_class.tgrelid
            WHERE table_class.relname = 'epistemic_evidence_verification'
              AND NOT trigger_class.tgisinternal
          `;

          expect(sortedNames(A.map(constraintRows, (row) => row.conname))).toEqual(expectedVerificationConstraints);
          expect(sortedNames(A.map(triggerRows, (row) => row.tgname))).toEqual(expectedVerificationTriggers);
```

```ts
          // Keep the intentional failure last: direct mutation must be denied
          // by the append-only trigger installed by the generated migration.
          const mutation = yield* Effect.flip(sql`
            UPDATE epistemic_evidence_verification
            SET manifestation_key = ${"b".repeat(64)}
            WHERE evidence_id = 1
          `);
          expect(inspect(mutation, { depth: 10 })).toContain("append-only");
```

### Answers to your six sub-questions

- **Package / lane:** `packages/_internal/db-admin`, file under
  `test/integration/`, name ending `.pglite.test.ts`. Run with
  `bun run --cwd packages/_internal/db-admin beep:test:integration`
  (`"beep:test:integration": "bunx --bun vitest run test/integration --passWithNoTests"`).
  Note `beep:test` **excludes** `test/integration/**`, so a migration test does
  not run in the fast lane.
- **Imports:** `node:url` (`fileURLToPath`), `node:util` (`inspect`),
  the tables `DbSchema`, `{ makeDrizzle, migrate }` from `@beep/postgres`,
  `{ makePgliteIntegrationGate, makePgliteSqlTestLayer, TestDatabaseInfo }` from
  `@beep/test-utils`, `{ describe, expect, layer }` from `@effect/vitest`,
  `* as SqlClient from "effect/unstable/sql/SqlClient"`.
- **PGlite instance:** `Layer.fresh(makePgliteSqlTestLayer({ inProcess: { extensions: { btree_gist } }, mode: "in-process" }))`.
  The `btree_gist` extension import is **required even for a law-practice test**,
  because `migrate` replays the *entire* drizzle folder including the epistemic
  edge migration's `CREATE EXTENSION btree_gist`.
- **Applying migrations:** `yield* migrate(db, { migrationsFolder, migrationsSchema })`
  where `migrationsFolder = fileURLToPath(new URL("../../drizzle", import.meta.url))`
  and `migrationsSchema = pipe(info.schema, O.getOrElse(() => "drizzle"))`.
- **Asserting a rejected UPDATE:** `const mutation = yield* Effect.flip(sql\`UPDATE …\`)`
  then `expect(inspect(mutation, { depth: 10 })).toContain("append-only")`.
  **The probe must be the LAST statement in the test body** — implicit-transaction
  PGlite hosts roll the whole session back after an intentional failure.
- **`describe.sequential`:** **it does not apply here.** The idiom in this lane is
  `describe(..., { concurrent: false }, ...)` plus `layer(..., { timeout: "2 minutes" })`
  and a per-test `120_000` ms timeout, and the whole file is wrapped in an
  `if (!shouldRunPgliteIntegration) { describe.skip(...) } else { ... }` guard.
  `shouldRunPgliteIntegration` is currently hard-coded `true`
  (`packages/tooling/test-kit/test-utils/src/SqlTest.ts:1605`), so the guard is
  vestigial but is still written in every file.

---

## 7. Ordered checklist for law-practice's first migration

Legend: **[NEW]** = file does not exist, must be created. **[EDIT]** = exists,
must be added to.

### Phase A — tables package (do first; everything downstream depends on it)

1. **[EDIT]** `packages/law-practice/tables/package.json` — add
   `"@beep/drizzle": "workspace:^"` to `dependencies`. **New workspace dep.**
   (Optional: enumerate `"./entities/PatentCitationEvent"` /
   `"./entities/CandorDisposition"` explicitly in `exports` + `publishConfig.exports`;
   the existing `"./entities/*"` wildcard already resolves them.)
2. **[EDIT]** `packages/law-practice/tables/tsconfig.json` — add
   `{ "path": "../../drivers/drizzle/tsconfig.json" }` to `references`.
3. **[NEW]** `packages/law-practice/tables/src/entities/PatentCitationEvent/PatentCitationEvent.table.ts`
   — `export const Table = EntityTable.pgTableFrom(PatentCitationEvent);`
4. **[NEW]** `packages/law-practice/tables/src/entities/PatentCitationEvent/PatentCitationEvent.converters.ts`
   — `Row`/`Insert` types + `to…Insert` (strip `id`) / `from…Row`, on the
   `EvidenceVerification.converters.ts` pattern.
5. **[NEW]** `packages/law-practice/tables/src/entities/PatentCitationEvent/index.ts`
   — `export * from "./PatentCitationEvent.converters.ts"; export * from "./PatentCitationEvent.table.ts";`
6. **[NEW]** ×3 — the same three files for `CandorDisposition/`.
7. **[EDIT]** `packages/law-practice/tables/src/entities/index.ts` — add
   `export * as CandorDisposition from "./CandorDisposition/index.ts";` and
   `export * as PatentCitationEvent from "./PatentCitationEvent/index.ts";`
   (alphabetical, before `KgBuild`).
8. **[EDIT]** `packages/law-practice/tables/src/ReadModels.ts` — add
   `candorDisposition` and `patentCitationEvent` to `DbSchema`, **and fix the two
   `@example` blocks at `:19-27` and `:39-46`** which assert
   `["kg_build", "kg_edge", "kg_node"]` and `["kgNode", "kgEdge", "kgBuild"]`.
   Consider introducing a `DbSchemaShape` type alias like
   `packages/epistemic/tables/src/Schema.ts:19-31`.
9. **[EDIT]** `packages/law-practice/tables/test/LawPracticeTables.test.ts` — the
   assertion at `:23` (`toStrictEqual(["kgBuild", "kgEdge", "kgNode"])`) **will
   fail** the moment step 8 lands. Update it and add column-set assertions for
   the two new tables (model on
   `packages/epistemic/tables/test/EvidenceVerificationTables.test.ts`).

### Phase B — db-admin migration

10. **[EDIT]** `packages/_internal/db-admin/package.json` — add
    `"@beep/law-practice-tables": "workspace:^"` to `dependencies`. **New workspace dep.**
11. **[EDIT]** `packages/_internal/db-admin/tsconfig.json` — add
    `{ "path": "../../law-practice/tables/tsconfig.json" }` to `references`.
12. **[EDIT]** `packages/_internal/db-admin/src/schema.ts` — import
    `{ DbSchema as LawPracticeDbSchema } from "@beep/law-practice-tables"` and add
    **exactly two** flat exports (`lawPracticePatentCitationEventTable`,
    `lawPracticeCandorDispositionTable`) on the
    `epistemicEvidenceVerificationTable` pattern (`:206-221`). **Do NOT export
    the three `kg*` read-model tables.**
13. **RUN** `bun run --cwd packages/_internal/db-admin generate -- --name law_practice_candor_gate`
    → writes `packages/_internal/db-admin/drizzle/<ts>_law_practice_candor_gate/{migration.sql,snapshot.json}`.
14. **[EDIT the generated file]** append to that `migration.sql`, using
    `--> statement-breakpoint` between statements and hard tabs for indentation:
    one `CREATE FUNCTION law_practice_candor_block_mutation()` with a
    single-`RAISE` body, then four triggers
    (`law_practice_patent_citation_event_append_only`,
    `law_practice_candor_disposition_append_only`,
    `law_practice_patent_citation_event_block_truncate`,
    `law_practice_candor_disposition_block_truncate`), plus any CHECK/FK/UNIQUE
    constraints you want (e.g. an FK from `candor_disposition.supersedes`, and
    from `patent_citation_event.possible_duplicate_of`, to
    `(org_id, id)` — which requires an
    `ALTER TABLE … ADD CONSTRAINT … UNIQUE ("org_id","id")` first, exactly like
    `epistemic_evidence_org_id_id_unique` in §4b).
15. **[NEW]** `packages/_internal/db-admin/src/migrations/LawPracticeCandorGate.ts`
    — a `DbAdminMigrationTarget.make({ drizzleSchema, name: "law-practice-candor-gate",
    schemaName: "law_practice", tables: ["law_practice_patent_citation_event",
    "law_practice_candor_disposition"] })`, modeled on
    `EpistemicContradictionTriage.ts`. Import `DbAdminMigrationTarget` from
    `"./ArchitectureLab.ts"`.
16. **[EDIT]** `packages/_internal/db-admin/src/targets.ts` — import, add to the
    `export { … }` block, and append to `DbAdminMigrationTargets`.
17. **[NEW]** `packages/_internal/db-admin/test/integration/LawPracticeCandorGateMigration.pglite.test.ts`
    — copy `EpistemicExecutionLedgerMigration.pglite.test.ts` structure; keep the
    `btree_gist` extension import; put the rejected-UPDATE probe LAST.
18. **RUN** `bun run --cwd packages/_internal/db-admin migrations:check` → must be green.
19. **RUN** `bun run --cwd apps/professional-desktop codegen` → regenerates
    `apps/professional-desktop/src/runtime/Migrations.gen.ts` (**required**, or
    that app's `beep:check` fails on `codegen:check`).

### Phase C — proof manifest

20. **[EDIT]** `packages/tooling/tool/cli/src/commands/Architecture/internal/AcceptedProofManifest.ts`
    — add **four** `AcceptedProofFile.make({ role: "db-admin", stage: "persistence", … })`
    entries: the migration target module (`writer: "template"`), the
    `migration.sql` (`"template"`), the `snapshot.json` (`"json"`), and the
    PGlite test (`"template"`). Place them beside their peers (target modules
    near `:718`, drizzle folders near `:790`, tests near `:850`).
21. **RUN** `bunx --bun vitest run packages/tooling/tool/cli/test/architecture-operation-plan.test.ts`.

### Phase D — ports (use-cases)

22. **[NEW]** `packages/law-practice/use-cases/src/CandorPolicy/CandorPolicy.repositories.ts`
    (or a sibling capability directory) — a **writer** port. `CandorRecordReader`
    already exists and is read-only; SPEC rung 2 calls for
    "append-and-read-only ports". Model the operation `LiteralKit`, the
    `…Unavailable` error with `static during(operation, reason, cause?)`, and the
    `Context.Service` tag on
    `packages/epistemic/use-cases/src/ClaimDisposition/ClaimDisposition.ports.ts`.
    Decide deliberately whether the shape is an `interface` (epistemic style) or
    an `S.Class` with `Fn({input, output})` fields (law-practice `CandorPolicy`
    style) — **the slice-local precedent is the `S.Class` + `Fn` form.**
23. **[EDIT]** `packages/law-practice/use-cases/src/CandorPolicy/index.ts` — export it.
24. **[EDIT]** `packages/law-practice/use-cases/package.json` — no new dep needed
    (`@beep/law-practice-domain`, `@beep/schema`, `@beep/identity`, `effect` all present).

### Phase E — server (repos + layers)

25. **[EDIT]** `packages/law-practice/server/package.json` — add
    `"@beep/postgres": "workspace:^"` to `dependencies`; **move `drizzle-orm`
    from `devDependencies` to `dependencies`**. **New workspace dep.**
26. **[EDIT]** `packages/law-practice/server/tsconfig.json` — add
    `{ "path": "../../drivers/postgres/tsconfig.json" }` to `references`.
27. **[EDIT]** `packages/law-practice/server/package.json` — add the new subpath
    export(s) (`"./CandorRecords": "./src/CandorRecords/index.ts"` or similar) to
    both `exports` and `publishConfig.exports`.
28. **[NEW]** `packages/law-practice/server/src/<Capability>/<X>.repo.ts` — the
    Drizzle adapter, `Effect.fn("LawPractice.…")`, `const db = yield* PostgresDrizzle`,
    `.insert(...).values(to…Insert(entity)).returning()` and
    `.select().from(...).where(eq(...)).orderBy(asc(table.id))`, with a
    `repositoryUnavailable(operation)` error-mapping pipe helper.
    **This is the first subdirectory in this package — the flat `PracticeKg.*`
    layout does not cover it.**
29. **[NEW]** `packages/law-practice/server/src/<Capability>/<X>.layer.ts` —
    `Layer.Layer<Tag, never, PostgresDrizzle>` via `Layer.effect`.
30. **[NEW]** `packages/law-practice/server/src/<Capability>/index.ts` — layer
    then repo re-exports.
31. **[EDIT]** `packages/law-practice/server/src/Layer.ts` — widen the
    `LawPracticeServerLive` output union and add `PostgresDrizzle` to the
    requirement channel (third type parameter). Today it is
    `Layer.Layer<OfficeActionReview | IrToLaw, Config.ConfigError, LanguageModel.LanguageModel | Crypto.Crypto>`.
32. **[EDIT]** `packages/law-practice/server/src/index.ts` — add the new
    `export * from` lines (currently exports `./Layer.ts` + eight `PracticeKg.*`
    modules + `./Tools.ts`).

### Phase F — changeset + proof

33. **[NEW]** `.changeset/<slug>.md` — required by the yeet changeset gate.
34. **RUN** `bun run docgen:local` (every new exported symbol needs
    section-grammar JSDoc with a compilable example; every `@example` you touched
    in steps 8 and 16 is executed).
35. **RUN** `bun run beep yeet repair` → `... verify`.

### Summary of NEW workspace dependencies

| Package | New dependency | Why |
| --- | --- | --- |
| `@beep/law-practice-tables` | `@beep/drizzle` | `EntityTable.pgTableFrom` |
| `@beep/db-admin` | `@beep/law-practice-tables` | flat exports in `src/schema.ts` |
| `@beep/law-practice-server` | `@beep/postgres` | `PostgresDrizzle` tag |
| `@beep/law-practice-server` | `drizzle-orm` promoted dev→prod | `eq`/`asc` in `src/` |

Each also needs the matching `tsconfig.json` `references` entry, and `bun.lock`
will change (it did in the precedent commit: `bun.lock | 64 +-`).

---

## 8. Things I checked that do NOT exist (negative findings)

- `packages/law-practice/server/src/*.repo.ts` / `*.layer.ts` — none. Searched
  `ls -R packages/law-practice/server/src`. The package is flat `PracticeKg.*`.
- `packages/law-practice/**` referenced from `packages/_internal/db-admin/**` —
  none. `rg "law-practice" packages/_internal/db-admin/src` → no matches.
- `packages/_internal/db-admin/drizzle/meta/` — does not exist
  (`ls -la … /drizzle/meta` → `No such file or directory`). Required absence.
- `packages/law-practice/tables/src/aggregates/` — the `package.json` declares an
  `"./aggregates/*"` export but the directory does not exist.
- Any `PatentCitationEvent` / `CandorDisposition` table, converter, repo, layer,
  port, or migration — none. `find packages -name "*PatentCitation*" -o -name
  "*CandorDisposition*"` outside `packages/law-practice/domain/src/entities/`
  returns nothing.
- A command that regenerates `AcceptedProofManifest` — none.
  `bun run beep architecture` has `plan` / `apply` / `check` / `create` / `add`
  subcommands only (`Architecture.command.ts:287-290`); the manifest array is
  hand-edited and validated by
  `packages/tooling/tool/cli/test/architecture-operation-plan.test.ts`.
