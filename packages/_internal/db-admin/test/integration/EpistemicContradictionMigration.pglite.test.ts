import { fileURLToPath } from "node:url";
import { inspect } from "node:util";
import { EvidenceVerification as EvidenceVerificationModel } from "@beep/epistemic-domain/entities/EvidenceVerification";
import { DbSchema as EpistemicDbSchema } from "@beep/epistemic-tables";
import { fromEvidenceRow, toEvidenceInsert } from "@beep/epistemic-tables/entities/Evidence";
import { toEvidenceVerificationInsert } from "@beep/epistemic-tables/entities/EvidenceVerification";
import { makeDrizzle, migrate } from "@beep/postgres";
import {
  baseEntityFixtureInput,
  makePgliteIntegrationGate,
  makePgliteSqlTestLayer,
  TestDatabaseInfo,
} from "@beep/test-utils";
import { A } from "@beep/utils";
import { describe, expect, layer } from "@effect/vitest";
import { btree_gist } from "@electric-sql/pglite/contrib/btree_gist";
import { Effect, Layer, Order, pipe } from "effect";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import * as SqlClient from "effect/unstable/sql/SqlClient";

const { shouldRunPgliteIntegration } = makePgliteIntegrationGate();
const migrationsFolder = fileURLToPath(new URL("../../drizzle", import.meta.url));
const makeMigrationProofLayer = () =>
  Layer.fresh(makePgliteSqlTestLayer({ inProcess: { extensions: { btree_gist } }, mode: "in-process" }));

const decodeEvidence = S.decodeUnknownEffect(EpistemicDbSchema.evidence.entitySchema);
const decodeEvidenceVerification = S.decodeUnknownEffect(EpistemicDbSchema.evidenceVerification.entitySchema);

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

const sortedNames = (names: ReadonlyArray<string>): ReadonlyArray<string> => A.sort(names, Order.String);

if (!shouldRunPgliteIntegration) {
  describe.skip("db-admin epistemic-contradiction migration PgLite integration", () => {});
} else {
  describe("db-admin epistemic-contradiction migration PgLite integration", { concurrent: false }, () => {
    layer(makeMigrationProofLayer(), { timeout: "2 minutes" })((it) => {
      it.effect(
        "migrates the tenant-bound append-only evidence-verification sidecar",
        Effect.fnUntraced(function* () {
          const info = yield* TestDatabaseInfo;
          const db = yield* makeDrizzle();
          const migrationsSchema = pipe(
            info.schema,
            O.getOrElse(() => "drizzle")
          );
          yield* migrate(db, { migrationsFolder, migrationsSchema });

          const sql = (yield* SqlClient.SqlClient).withoutTransforms();
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

          const evidence = yield* decodeEvidence({
            ...baseEntityFixtureInput("EpistemicEvidence", 41),
            artifactFixtureKey: "artifact:contradiction-migration",
            span: {
              confidence: 0.95,
              endChar: 8,
              quote: "amount A",
              startChar: 0,
            },
            spanFixtureKey: "span:contradiction-migration",
          });
          const evidenceRows = yield* db
            .insert(EpistemicDbSchema.evidence)
            .values(toEvidenceInsert(evidence))
            .returning();
          const persistedEvidence = yield* pipe(
            evidenceRows,
            A.head,
            O.match({
              onNone: () => Effect.die("expected the persisted evidence row"),
              onSome: (row) => Effect.succeed(fromEvidenceRow(row)),
            })
          );
          const uncheckedVerification = yield* decodeEvidenceVerification({
            ...baseEntityFixtureInput("EpistemicEvidenceVerification", 41),
            evidenceId: persistedEvidence.id,
            manifestationKey: "a".repeat(64),
            verifiedAnchor: {
              anchor: {
                endChar: 8,
                quote: "amount A",
                startChar: 0,
              },
              source: {
                extractor: {
                  name: "utf8",
                  version: "1",
                },
                locator: "sources/contradiction-migration.txt",
                normalizationVersion: "1",
                scopeRef: "workspace:1",
                sourceDigest: "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
                sourceRef: "source:contradiction-migration",
                textDigest: "sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
              },
            },
          });
          const manifestationKey = yield* Effect.fromResult(
            EvidenceVerificationModel.manifestationKeyFor(
              uncheckedVerification.evidenceId,
              uncheckedVerification.verifiedAnchor
            )
          );
          const verification = EvidenceVerificationModel.make({
            ...uncheckedVerification,
            manifestationKey,
          });
          const verificationInsert = yield* Effect.fromResult(
            toEvidenceVerificationInsert(verification, persistedEvidence)
          );
          yield* db.insert(EpistemicDbSchema.evidenceVerification).values(verificationInsert);

          const rows = yield* db.select().from(EpistemicDbSchema.evidenceVerification);
          expect(rows).toHaveLength(1);
          expect(rows[0]?.evidenceId).toBe(1);

          // Keep the intentional failure last: direct mutation must be denied
          // by the append-only trigger installed by the generated migration.
          const mutation = yield* Effect.flip(sql`
            UPDATE epistemic_evidence_verification
            SET manifestation_key = ${"b".repeat(64)}
            WHERE evidence_id = 1
          `);
          expect(inspect(mutation, { depth: 10 })).toContain("append-only");
        }),
        120_000
      );

      it.effect(
        "enforces tenant-bound contradiction identities, digests, and append-only records",
        Effect.fnUntraced(function* () {
          const info = yield* TestDatabaseInfo;
          const db = yield* makeDrizzle();
          const migrationsSchema = pipe(
            info.schema,
            O.getOrElse(() => "drizzle")
          );
          yield* migrate(db, { migrationsFolder, migrationsSchema });

          const sql = (yield* SqlClient.SqlClient).withoutTransforms();
          const candidateRows = yield* sql<{ readonly id: number }>`
            INSERT INTO epistemic_contradiction_candidate (
              created_at, created_by_principal, org_id, row_version, schema_version, source,
              updated_at, updated_by_principal, candidate_key, candidate_digest, assessment,
              match_basis, belief_pair, recorded_at, valid_from, valid_to, entity_type, public_id
            ) VALUES (
              1000, '{"component":"Runtime","kind":"System"}'::jsonb, 1, 1, '0.0.0', 'System',
              1000, '{"component":"Runtime","kind":"System"}'::jsonb, ${Str.repeat(64)("c")}, ${Str.repeat(64)("d")},
              '{"confidence":0.95,"proposals":[]}'::jsonb, '{}'::jsonb, '{}'::jsonb,
              1000, 1000, NULL, 'EpistemicContradictionCandidate',
              'epistemic_contradiction_candidate_amigrationproof'
            )
            RETURNING id
          `;
          const candidateId = yield* pipe(
            candidateRows,
            A.head,
            O.match({
              onNone: () => Effect.die("expected the contradiction candidate seed row"),
              onSome: (row) => Effect.succeed(row.id),
            })
          );

          yield* sql`
            INSERT INTO epistemic_contradiction_receipt (
              created_at, created_by_principal, org_id, row_version, schema_version, source,
              updated_at, updated_by_principal, candidate_id, receipt_key, received_at,
              received_by, entity_type, public_id
            ) VALUES (
              1000, '{"component":"Runtime","kind":"System"}'::jsonb, 1, 1, '0.0.0', 'System',
              1000, '{"component":"Runtime","kind":"System"}'::jsonb, ${candidateId}, ${Str.repeat(64)("e")}, 1000,
              '{"component":"Runtime","kind":"System"}'::jsonb, 'EpistemicContradictionReceipt',
              'epistemic_contradiction_receipt_amigrationproof'
            )
          `;
          const duplicateCandidate = yield* Effect.flip(sql`
            INSERT INTO epistemic_contradiction_candidate (
              created_at, created_by_principal, org_id, row_version, schema_version, source,
              updated_at, updated_by_principal, candidate_key, candidate_digest, assessment,
              match_basis, belief_pair, recorded_at, valid_from, valid_to, entity_type, public_id
            ) VALUES (
              1001, '{"component":"Runtime","kind":"System"}'::jsonb, 1, 1, '0.0.0', 'System',
              1001, '{"component":"Runtime","kind":"System"}'::jsonb, ${Str.repeat(64)("c")}, ${Str.repeat(64)("f")},
              '{"confidence":0.95,"proposals":[]}'::jsonb, '{}'::jsonb, '{}'::jsonb,
              1001, 1001, NULL, 'EpistemicContradictionCandidate',
              'epistemic_contradiction_candidate_aduplicate'
            )
          `);
          expect(inspect(duplicateCandidate, { depth: 10 })).toContain(
            "epistemic_contradiction_candidate_candidate_key_unique_idx"
          );

          const duplicateReceipt = yield* Effect.flip(sql`
            INSERT INTO epistemic_contradiction_receipt (
              created_at, created_by_principal, org_id, row_version, schema_version, source,
              updated_at, updated_by_principal, candidate_id, receipt_key, received_at,
              received_by, entity_type, public_id
            ) VALUES (
              1001, '{"component":"Runtime","kind":"System"}'::jsonb, 1, 1, '0.0.0', 'System',
              1001, '{"component":"Runtime","kind":"System"}'::jsonb, ${candidateId}, ${Str.repeat(64)("e")}, 1001,
              '{"component":"Runtime","kind":"System"}'::jsonb, 'EpistemicContradictionReceipt',
              'epistemic_contradiction_receipt_aduplicate'
            )
          `);
          expect(inspect(duplicateReceipt, { depth: 10 })).toContain(
            "epistemic_contradiction_receipt_org_id_receipt_key_unique_idx"
          );

          const secondOrganizationCandidateRows = yield* sql<{ readonly id: number }>`
            INSERT INTO epistemic_contradiction_candidate (
              created_at, created_by_principal, org_id, row_version, schema_version, source,
              updated_at, updated_by_principal, candidate_key, candidate_digest, assessment,
              match_basis, belief_pair, recorded_at, valid_from, valid_to, entity_type, public_id
            ) VALUES (
              1001, '{"component":"Runtime","kind":"System"}'::jsonb, 2, 1, '0.0.0', 'System',
              1001, '{"component":"Runtime","kind":"System"}'::jsonb, ${Str.repeat(64)("2")}, ${Str.repeat(64)("3")},
              '{"confidence":0.95,"proposals":[]}'::jsonb, '{}'::jsonb, '{}'::jsonb,
              1001, 1001, NULL, 'EpistemicContradictionCandidate',
              'epistemic_contradiction_candidate_aorg2migrationproof'
            )
            RETURNING id
          `;
          const secondOrganizationCandidateId = yield* pipe(
            secondOrganizationCandidateRows,
            A.head,
            O.match({
              onNone: () => Effect.die("expected the second-organization contradiction candidate seed row"),
              onSome: (row) => Effect.succeed(row.id),
            })
          );
          yield* sql`
            INSERT INTO epistemic_contradiction_receipt (
              created_at, created_by_principal, org_id, row_version, schema_version, source,
              updated_at, updated_by_principal, candidate_id, receipt_key, received_at,
              received_by, entity_type, public_id
            ) VALUES (
              1001, '{"component":"Runtime","kind":"System"}'::jsonb, 2, 1, '0.0.0', 'System',
              1001, '{"component":"Runtime","kind":"System"}'::jsonb, ${secondOrganizationCandidateId},
              ${Str.repeat(64)("e")}, 1001,
              '{"component":"Runtime","kind":"System"}'::jsonb, 'EpistemicContradictionReceipt',
              'epistemic_contradiction_receipt_aorg2migrationproof'
            )
          `;
          const scopedReceiptRows = yield* sql<{ readonly orgId: number }>`
            SELECT org_id AS "orgId"
            FROM epistemic_contradiction_receipt
            WHERE receipt_key = ${Str.repeat(64)("e")}
            ORDER BY org_id
          `;
          expect(A.map(scopedReceiptRows, (row) => row.orgId)).toEqual([1, 2]);

          const wrongOrgReceipt = yield* Effect.flip(sql`
            INSERT INTO epistemic_contradiction_receipt (
              created_at, created_by_principal, org_id, row_version, schema_version, source,
              updated_at, updated_by_principal, candidate_id, receipt_key, received_at,
              received_by, entity_type, public_id
            ) VALUES (
              1001, '{"component":"Runtime","kind":"System"}'::jsonb, 2, 1, '0.0.0', 'System',
              1001, '{"component":"Runtime","kind":"System"}'::jsonb, ${candidateId}, ${Str.repeat(64)("a")}, 1001,
              '{"component":"Runtime","kind":"System"}'::jsonb, 'EpistemicContradictionReceipt',
              'epistemic_contradiction_receipt_awrongorg'
            )
          `);
          expect(inspect(wrongOrgReceipt, { depth: 10 })).toContain("epistemic_contradiction_receipt_candidate_fk");

          const wrongOrgDisposition = yield* Effect.flip(sql`
            INSERT INTO epistemic_contradiction_disposition (
              created_at, created_by_principal, org_id, row_version, schema_version, source,
              updated_at, updated_by_principal, candidate_id, decision, resolved_at,
              resolved_by, entity_type, public_id
            ) VALUES (
              1002, '{"component":"Runtime","kind":"System"}'::jsonb, 2, 1, '0.0.0', 'System',
              1002, '{"component":"Runtime","kind":"System"}'::jsonb, ${candidateId},
              '{"reason":"wrong org","status":"rejected"}'::jsonb, 1002,
              '{"component":"Runtime","kind":"System"}'::jsonb, 'EpistemicContradictionDisposition',
              'epistemic_contradiction_disposition_awrongorg'
            )
          `);
          expect(inspect(wrongOrgDisposition, { depth: 10 })).toContain(
            "epistemic_contradiction_disposition_candidate_fk"
          );

          yield* sql`
            INSERT INTO epistemic_contradiction_disposition (
              created_at, created_by_principal, org_id, row_version, schema_version, source,
              updated_at, updated_by_principal, candidate_id, decision, resolved_at,
              resolved_by, entity_type, public_id
            ) VALUES (
              1000, '{"component":"Runtime","kind":"System"}'::jsonb, 1, 1, '0.0.0', 'System',
              1000, '{"component":"Runtime","kind":"System"}'::jsonb, ${candidateId},
              '{"reason":"migration proof","status":"rejected"}'::jsonb, 1000,
              '{"component":"Runtime","kind":"System"}'::jsonb, 'EpistemicContradictionDisposition',
              'epistemic_contradiction_disposition_amigrationproof'
            )
          `;
          const duplicateDisposition = yield* Effect.flip(sql`
            INSERT INTO epistemic_contradiction_disposition (
              created_at, created_by_principal, org_id, row_version, schema_version, source,
              updated_at, updated_by_principal, candidate_id, decision, resolved_at,
              resolved_by, entity_type, public_id
            ) VALUES (
              1001, '{"component":"Runtime","kind":"System"}'::jsonb, 1, 1, '0.0.0', 'System',
              1001, '{"component":"Runtime","kind":"System"}'::jsonb, ${candidateId},
              '{"reason":"duplicate","status":"rejected"}'::jsonb, 1001,
              '{"component":"Runtime","kind":"System"}'::jsonb, 'EpistemicContradictionDisposition',
              'epistemic_contradiction_disposition_aduplicate'
            )
          `);
          expect(inspect(duplicateDisposition, { depth: 10 })).toContain(
            "epistemic_contradiction_disposition_candidate_id_unique_idx"
          );

          const malformedCandidateKey = yield* Effect.flip(sql`
            INSERT INTO epistemic_contradiction_candidate (
              created_at, created_by_principal, org_id, row_version, schema_version, source,
              updated_at, updated_by_principal, candidate_key, candidate_digest, assessment,
              match_basis, belief_pair, recorded_at, valid_from, valid_to, entity_type, public_id
            ) VALUES (
              1003, '{"component":"Runtime","kind":"System"}'::jsonb, 1, 1, '0.0.0', 'System',
              1003, '{"component":"Runtime","kind":"System"}'::jsonb, 'not-a-digest', ${Str.repeat(64)("b")},
              '{"confidence":0.95,"proposals":[]}'::jsonb, '{}'::jsonb, '{}'::jsonb,
              1003, 1003, NULL, 'EpistemicContradictionCandidate',
              'epistemic_contradiction_candidate_abadkey'
            )
          `);
          expect(inspect(malformedCandidateKey, { depth: 10 })).toContain(
            "epistemic_contradiction_candidate_key_sha256"
          );

          const malformedCandidateDigest = yield* Effect.flip(sql`
            INSERT INTO epistemic_contradiction_candidate (
              created_at, created_by_principal, org_id, row_version, schema_version, source,
              updated_at, updated_by_principal, candidate_key, candidate_digest, assessment,
              match_basis, belief_pair, recorded_at, valid_from, valid_to, entity_type, public_id
            ) VALUES (
              1004, '{"component":"Runtime","kind":"System"}'::jsonb, 1, 1, '0.0.0', 'System',
              1004, '{"component":"Runtime","kind":"System"}'::jsonb, ${Str.repeat(64)("1")}, 'not-a-digest',
              '{"confidence":0.95,"proposals":[]}'::jsonb, '{}'::jsonb, '{}'::jsonb,
              1004, 1004, NULL, 'EpistemicContradictionCandidate',
              'epistemic_contradiction_candidate_abaddigest'
            )
          `);
          expect(inspect(malformedCandidateDigest, { depth: 10 })).toContain(
            "epistemic_contradiction_candidate_digest_sha256"
          );

          const malformedReceiptKey = yield* Effect.flip(sql`
            INSERT INTO epistemic_contradiction_receipt (
              created_at, created_by_principal, org_id, row_version, schema_version, source,
              updated_at, updated_by_principal, candidate_id, receipt_key, received_at,
              received_by, entity_type, public_id
            ) VALUES (
              1005, '{"component":"Runtime","kind":"System"}'::jsonb, 1, 1, '0.0.0', 'System',
              1005, '{"component":"Runtime","kind":"System"}'::jsonb, ${candidateId}, 'not-a-digest', 1005,
              '{"component":"Runtime","kind":"System"}'::jsonb, 'EpistemicContradictionReceipt',
              'epistemic_contradiction_receipt_abadkey'
            )
          `);
          expect(inspect(malformedReceiptKey, { depth: 10 })).toContain("epistemic_contradiction_receipt_key_sha256");

          const mutations = [
            sql`UPDATE epistemic_contradiction_candidate SET source = 'User' WHERE id = ${candidateId}`,
            sql`DELETE FROM epistemic_contradiction_candidate WHERE id = ${candidateId}`,
            sql`TRUNCATE epistemic_contradiction_candidate CASCADE`,
            sql`UPDATE epistemic_contradiction_receipt SET source = 'User' WHERE candidate_id = ${candidateId}`,
            sql`DELETE FROM epistemic_contradiction_receipt WHERE candidate_id = ${candidateId}`,
            sql`TRUNCATE epistemic_contradiction_receipt`,
            sql`UPDATE epistemic_contradiction_disposition SET source = 'User' WHERE candidate_id = ${candidateId}`,
            sql`DELETE FROM epistemic_contradiction_disposition WHERE candidate_id = ${candidateId}`,
            sql`TRUNCATE epistemic_contradiction_disposition`,
          ];
          const mutationFailures = yield* Effect.forEach(
            mutations,
            (mutation) => Effect.map(Effect.flip(mutation), (failure) => inspect(failure, { depth: 10 })),
            { concurrency: 1 }
          );
          expect(A.every(mutationFailures, Str.includes("append-only"))).toBe(true);
        }),
        120_000
      );
    });
  });
}
