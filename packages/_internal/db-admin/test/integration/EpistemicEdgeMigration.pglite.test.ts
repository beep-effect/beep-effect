import { fileURLToPath } from "node:url";
import { inspect } from "node:util";
import { CandidateClaim } from "@beep/epistemic-domain/entities/CandidateClaim";
import { EdgeVersion } from "@beep/epistemic-domain/entities/EdgeVersion";
import { Evidence } from "@beep/epistemic-domain/entities/Evidence";
import { DbSchema as EpistemicDbSchema } from "@beep/epistemic-tables";
import { toCandidateClaimInsert } from "@beep/epistemic-tables/entities/CandidateClaim";
import { fromEdgeVersionRow, toEdgeVersionInsert } from "@beep/epistemic-tables/entities/EdgeVersion";
import { toEvidenceInsert } from "@beep/epistemic-tables/entities/Evidence";
import { makeDrizzle, migrate } from "@beep/postgres";
import {
  makePgliteIntegrationGate,
  makePgliteSqlTestLayer,
  productEntityFixtureInput,
  TestDatabaseInfo,
} from "@beep/test-utils";
import { A } from "@beep/utils";
import { describe, expect, layer } from "@effect/vitest";
import { btree_gist } from "@electric-sql/pglite/contrib/btree_gist";
import { getTableName } from "drizzle-orm";
import { Effect, Layer, Order, pipe } from "effect";
import * as DateTime from "effect/DateTime";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as SqlClient from "effect/unstable/sql/SqlClient";

const { shouldRunPgliteIntegration } = makePgliteIntegrationGate();
const migrationsFolder = fileURLToPath(new URL("../../drizzle", import.meta.url));

// The drizzle folder contains `CREATE EXTENSION btree_gist` (this migration's
// gist exclusion constraint), which the shared external pglite-socket lane
// cannot load. Extension-dependent proofs are pinned to the in-process lane.
const makeMigrationProofLayer = () =>
  Layer.fresh(makePgliteSqlTestLayer({ inProcess: { extensions: { btree_gist } }, mode: "in-process" }));

const decodeCandidateClaim = S.decodeUnknownEffect(CandidateClaim);
const decodeEvidence = S.decodeUnknownEffect(Evidence);
const decodeEdgeVersion = S.decodeUnknownEffect(EdgeVersion);

const edgeTableNames: ReadonlyArray<string> = [
  getTableName(EpistemicDbSchema.candidateClaim),
  getTableName(EpistemicDbSchema.evidence),
  getTableName(EpistemicDbSchema.edgeVersion),
  getTableName(EpistemicDbSchema.claimDisposition),
];

// Every name below is load-bearing: the repository maps constraint violations
// by name, never by message prose, so a silent rename is a silent behavior
// change.
const expectedConstraintNames: ReadonlyArray<string> = [
  "epistemic_claim_disposition_bounded",
  "epistemic_claim_disposition_claim_fk",
  "epistemic_edge_logical_version_unique",
  "epistemic_edge_no_overlap",
  "epistemic_edge_no_self_supersede",
  "epistemic_edge_source_bounded",
  "epistemic_edge_source_claim_fk",
  "epistemic_edge_source_evidence_fk",
  "epistemic_edge_supersedes_fk",
  "epistemic_edge_target_bounded",
  "epistemic_edge_target_claim_fk",
  "epistemic_edge_target_evidence_fk",
  "epistemic_edge_txn_ordered",
  "epistemic_edge_valid_ordered",
  "epistemic_evidence_org_id_id_unique",
];

const expectedIndexNames: ReadonlyArray<string> = [
  "epistemic_candidate_claim_public_id_unique_idx",
  "epistemic_claim_disposition_public_id_unique_idx",
  "epistemic_edge_asof_idx",
  "epistemic_edge_open_head_idx",
  "epistemic_edge_qualifiers_gin_idx",
  "epistemic_edge_version_public_id_unique_idx",
  "epistemic_evidence_public_id_unique_idx",
];

// The empty-string sha256, standing in for a digest the domain would compute
// from a LogicalEdgeIdentity.
const logicalKey = "abadcafeabadcafeabadcafeabadcafeabadcafeabadcafeabadcafeabadcafe";

const edgeVersionFixture = (id: number, validFrom: number) => ({
  ...productEntityFixtureInput("EpistemicEdgeVersion", id),
  evidenceScope: null,
  expiredAt: null,
  fact: { note: "cited in the office action" },
  logicalKey,
  matterScope: null,
  qualifiers: { statute: "35 USC 103" },
  recordedAt: validFrom,
  relation: "supports",
  sourceClaimId: 1,
  sourceEntityRef: null,
  sourceEvidenceId: null,
  sourceKind: "claim",
  sourceObservationRef: null,
  supersedesId: null,
  targetClaimId: null,
  targetEntityRef: null,
  targetEvidenceId: 1,
  targetKind: "evidence",
  targetObservationRef: null,
  validFrom,
  validTo: null,
  version: id,
});

const sortedNames = (names: ReadonlyArray<string>): ReadonlyArray<string> => A.sort(names, Order.String);

if (!shouldRunPgliteIntegration) {
  describe.skip("db-admin epistemic-edge migration PgLite integration", () => {});
} else {
  describe("db-admin epistemic-edge migration PgLite integration", { concurrent: false }, () => {
    layer(makeMigrationProofLayer(), { timeout: "2 minutes" })((it) => {
      it.effect(
        "runs the epistemic-edge migration target SQL",
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
            WHERE constraint_class.contype IN ('c', 'f', 'u', 'x')
          `;
          const indexRows = yield* sql<{ readonly indexname: string; readonly tablename: string }>`
            SELECT indexname, tablename FROM pg_indexes WHERE indexname LIKE '%\\_idx'
          `;

          const constraintNames = pipe(
            constraintRows,
            A.filter((row) => A.contains(edgeTableNames, row.relname)),
            A.map((row) => row.conname),
            sortedNames
          );
          const indexNames = pipe(
            indexRows,
            A.filter((row) => A.contains(edgeTableNames, row.tablename)),
            A.map((row) => row.indexname),
            sortedNames
          );

          expect(constraintNames).toEqual(expectedConstraintNames);
          expect(indexNames).toEqual(expectedIndexNames);

          const claim = yield* decodeCandidateClaim({
            ...productEntityFixtureInput("EpistemicCandidateClaim", 1),
            fixtureKey: "claim:patentability",
            lifecycle: "candidate",
            snapshot: { text: "The application describes a processor." },
          });
          const evidence = yield* decodeEvidence({
            ...productEntityFixtureInput("EpistemicEvidence", 1),
            artifactFixtureKey: "artifact:oa-1",
            span: {
              confidence: 0.92,
              endChar: 57,
              quote: "a processor configured to receive sensor data",
              startChar: 12,
            },
            spanFixtureKey: "span:oa-1:12-48",
          });
          const edgeVersion = yield* decodeEdgeVersion(edgeVersionFixture(1, 1_000));

          yield* db.insert(EpistemicDbSchema.candidateClaim).values(toCandidateClaimInsert(claim));
          yield* db.insert(EpistemicDbSchema.evidence).values(toEvidenceInsert(evidence));
          yield* db.insert(EpistemicDbSchema.edgeVersion).values(toEdgeVersionInsert(edgeVersion));

          const edgeRows = yield* db.select().from(EpistemicDbSchema.edgeVersion);
          const edges = A.map(edgeRows, fromEdgeVersionRow);
          const head = yield* pipe(
            edges,
            A.head,
            O.match({
              onNone: () => Effect.die("expected the inserted open-head edge version to read back"),
              onSome: Effect.succeed,
            })
          );

          expect(head.logicalKey).toEqual(logicalKey);
          expect(head.version).toEqual(1);
          expect(head.sourceKind).toEqual("claim");
          expect(head.targetKind).toEqual("evidence");
          expect(head.sourceClaimId).toEqual(O.some(1));
          expect(head.targetEvidenceId).toEqual(O.some(1));
          expect(DateTime.toEpochMillis(head.validFrom)).toEqual(1_000);
          // Open head on both axes: the fact is still true and still current.
          expect(O.isNone(head.validTo)).toBe(true);
          expect(O.isNone(head.expiredAt)).toBe(true);

          const secondHead = yield* decodeEdgeVersion(edgeVersionFixture(2, 2_000));

          // The adversarial probe stays LAST: implicit-transaction pglite hosts
          // roll the whole session chain back after an intentional failure, so
          // no statement may follow it. A second open head for one logical key
          // is rejected by whichever backstop the planner checks first.
          const openHeadViolation = yield* Effect.flip(
            db.insert(EpistemicDbSchema.edgeVersion).values(toEdgeVersionInsert(secondHead))
          );

          expect(inspect(openHeadViolation, { depth: 10 })).toMatch(/epistemic_edge_(?:open_head_idx|no_overlap)/u);
        }),
        120_000
      );
    });
  });
}
