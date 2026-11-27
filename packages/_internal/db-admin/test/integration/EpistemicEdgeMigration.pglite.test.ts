import * as NodeURL from "node:url";
import * as NodeUtil from "node:util";
import { CandidateClaim } from "@beep/epistemic-domain/entities/CandidateClaim";
import { EdgeVersion } from "@beep/epistemic-domain/entities/EdgeVersion";
import { Evidence } from "@beep/epistemic-domain/entities/Evidence";
import { DbSchema as EpistemicDbSchema } from "@beep/epistemic-tables";
import { toCandidateClaimInsert } from "@beep/epistemic-tables/entities/CandidateClaim";
import { fromEdgeVersionRow, toEdgeVersionInsert } from "@beep/epistemic-tables/entities/EdgeVersion";
import { toEvidenceInsert } from "@beep/epistemic-tables/entities/Evidence";
import { makeDrizzle, migrate } from "@beep/postgres";
import { it } from "@beep/test-runner";
import {
  makePgliteIntegrationGate,
  makePgliteSqlTestLayer,
  productEntityFixtureInput,
  TestDatabaseInfo,
} from "@beep/test-utils";
import { A } from "@beep/utils";
import { describe, expect } from "@effect/vitest";
import { assertNone, assertSome } from "@effect/vitest/utils";
import { btree_gist } from "@electric-sql/pglite/contrib/btree_gist";
import { getTableName } from "drizzle-orm";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import { pipe } from "effect/Function";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Order from "effect/Order";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as SqlClient from "effect/sql/SqlClient";

const { shouldRunPgliteIntegration } = makePgliteIntegrationGate();
const migrationsFolder = NodeURL.fileURLToPath(new URL("../../drizzle", import.meta.url));

// decision: migration-proofs-run-in-process
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

const stubLogicalEdgeDigest = "abadcafeabadcafeabadcafeabadcafeabadcafeabadcafeabadcafeabadcafe";

const edgeVersionFixture = (id: number, validFrom: number) => ({
  ...productEntityFixtureInput("EpistemicEdgeVersion", id),
  evidenceScope: null,
  expiredAt: null,
  fact: { note: "cited in the office action" },
  logicalKey: stubLogicalEdgeDigest,
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
    it.layer(makeMigrationProofLayer(), { timeout: "2 minutes" })((it) => {
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

          expect(constraintNames, "the repository maps violations by constraint name").toEqual(expectedConstraintNames);
          expect(indexNames, "the repository maps violations by index name").toEqual(expectedIndexNames);

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
              version: "evidence-position/v2",
              position: { endChar: 57, quote: "a processor configured to receive sensor data", startChar: 12 },
              extractorConfidence: {
                _tag: "Present",
                value: { _tag: "ReportedConfidence", value: 0.92, method: "synthetic-fixture" },
              },
            },
            spanFixtureKey: "span:oa-1:12-48",
          });
          const edgeVersion = yield* decodeEdgeVersion(edgeVersionFixture(1, 1_000));

          const claimInsert = yield* Effect.fromResult(toCandidateClaimInsert(claim));
          yield* db.insert(EpistemicDbSchema.candidateClaim).values(claimInsert);
          const evidenceInsert = yield* Effect.fromResult(toEvidenceInsert(evidence));
          yield* db.insert(EpistemicDbSchema.evidence).values(evidenceInsert);
          const edgeInsert = yield* Effect.fromResult(toEdgeVersionInsert(edgeVersion));
          yield* db.insert(EpistemicDbSchema.edgeVersion).values(edgeInsert);

          const edgeRows = yield* db.select().from(EpistemicDbSchema.edgeVersion);
          const edges = yield* Effect.fromResult(Result.all(A.map(edgeRows, fromEdgeVersionRow)));
          const head = yield* pipe(
            edges,
            A.head,
            O.match({
              onNone: () => Effect.die("expected the inserted open-head edge version to read back"),
              onSome: Effect.succeed,
            })
          );

          expect(head.logicalKey).toEqual(stubLogicalEdgeDigest);
          expect(head.version).toEqual(1);
          expect(head.sourceKind).toEqual("claim");
          expect(head.targetKind).toEqual("evidence");
          assertSome<number>(head.sourceClaimId, 1);
          assertSome<number>(head.targetEvidenceId, 1);
          expect(DateTime.toEpochMillis(head.validFrom)).toEqual(1_000);
          assertNone(head.validTo);
          assertNone(head.expiredAt);

          const secondHead = yield* decodeEdgeVersion(edgeVersionFixture(2, 2_000));
          const secondInsert = yield* Effect.fromResult(toEdgeVersionInsert(secondHead));

          const openHeadViolation = yield* Effect.flip(db.insert(EpistemicDbSchema.edgeVersion).values(secondInsert));

          expect(
            NodeUtil.inspect(openHeadViolation, { depth: 10 }),
            "either backstop may reject the second open head; the probe runs last: PGlite rolls the session back after an intentional failure"
          ).toMatch(/epistemic_edge_(?:open_head_idx|no_overlap)/u);
        }),
        120_000
      );
    });
  });
}
