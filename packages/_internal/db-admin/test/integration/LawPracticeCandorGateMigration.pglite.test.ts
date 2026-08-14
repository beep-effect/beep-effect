import { fileURLToPath } from "node:url";
import { inspect } from "node:util";
import { CandorDisposition, IdsSubmissionFact, PatentCitationEvent } from "@beep/law-practice-domain";
import { DbSchema as LawPracticeDbSchema } from "@beep/law-practice-tables";
import { toCandorDispositionInsert } from "@beep/law-practice-tables/entities/CandorDisposition";
import { toIdsSubmissionFactInsert } from "@beep/law-practice-tables/entities/IdsSubmissionFact";
import { toPatentCitationEventInsert } from "@beep/law-practice-tables/entities/PatentCitationEvent";
import { makeDrizzle, migrate, migrateBundle } from "@beep/postgres";
import {
  baseEntityFixtureInput,
  makePgliteIntegrationGate,
  makePgliteSqlTestLayer,
  TestDatabaseInfo,
} from "@beep/test-utils";
import { A } from "@beep/utils";
import { describe, expect, layer } from "@effect/vitest";
import { btree_gist } from "@electric-sql/pglite/contrib/btree_gist";
import { readMigrationFiles } from "drizzle-orm/migrator";
import { Effect, Layer, Order, pipe } from "effect";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as SqlClient from "effect/unstable/sql/SqlClient";

const { shouldRunPgliteIntegration } = makePgliteIntegrationGate();
const migrationsFolder = fileURLToPath(new URL("../../drizzle", import.meta.url));
const st13OfficeMigrationName = "20260813173652_law_practice_st13_office_identity";
const priorMigrations = readMigrationFiles({ migrationsFolder })
  .filter((migration) => migration.name !== st13OfficeMigrationName)
  .map((migration) => ({ name: migration.name, sql: migration.sql.join("\n--> statement-breakpoint\n") }));
const st13OfficeMigration = readMigrationFiles({ migrationsFolder })
  .filter((migration) => migration.name === st13OfficeMigrationName)
  .map((migration) => ({ name: migration.name, sql: migration.sql.join("\n--> statement-breakpoint\n") }));

// The drizzle folder contains `CREATE EXTENSION btree_gist` (the epistemic edge
// migration), which the shared external pglite-socket lane cannot load, so this
// proof is pinned to the in-process lane like its epistemic siblings.
const makeMigrationProofLayer = () =>
  Layer.fresh(makePgliteSqlTestLayer({ inProcess: { extensions: { btree_gist } }, mode: "in-process" }));

const candorTableNames: ReadonlyArray<string> = [
  "law_practice_candor_disposition",
  "law_practice_ids_submission_fact",
  "law_practice_patent_citation_event",
];

// These names are the append-only guarantee. A silent rename would leave the
// tables writable while this proof still passed, so they are asserted exactly.
const expectedConstraintNames: ReadonlyArray<string> = [
  "law_practice_candor_disposition_org_id_id_unique",
  "law_practice_candor_disposition_pkey",
  "law_practice_candor_disposition_st13_office_check",
  "law_practice_candor_disposition_supersedes_fk",
  "law_practice_ids_submission_fact_pkey",
  "law_practice_ids_submission_fact_st13_office_check",
  "law_practice_patent_citation_event_org_id_id_unique",
  "law_practice_patent_citation_event_pkey",
  "law_practice_patent_citation_event_possible_duplicate_fk",
  "law_practice_patent_citation_event_st13_office_check",
];

const expectedTriggerNames: ReadonlyArray<string> = [
  "law_practice_candor_disposition_append_only",
  "law_practice_candor_disposition_block_truncate",
  "law_practice_ids_submission_fact_append_only",
  "law_practice_ids_submission_fact_block_truncate",
  "law_practice_patent_citation_event_append_only",
  "law_practice_patent_citation_event_block_truncate",
];

const digest = `sha256:${"a".repeat(64)}`;
const citingApplication = { applicationNumber: "16138242", kind: "UsptoNormalized" } as const;

const sourceIdentity = {
  extractor: { name: "utf8", version: "1" },
  locator: "office-action.txt",
  normalizationVersion: "1",
  scopeRef: "matter:candor",
  sourceDigest: digest,
  sourceRef: "source:office-action",
  textDigest: digest,
};

const eventInput = {
  ...baseEntityFixtureInput("LawPracticePatentCitationEvent", 1),
  actor: "Applicant",
  citingApplication,
  discovery: { kind: "AiDiscovered", model: { name: "reference-extractor", version: "3" } },
  grounding: {
    anchor: { endChar: 4, quote: "fact", startChar: 0 },
    source: sourceIdentity,
  },
  observedAt: 1,
  possibleDuplicateOf: null,
  quarantine: null,
  reference: { number: "7654321" },
  supersedes: null,
};

const dispositionInput = {
  ...baseEntityFixtureInput("LawPracticeCandorDisposition", 1),
  citingApplication,
  decidedAt: 2,
  disposes: { eventId: 1, textDigest: digest },
  lifecycle: "active",
  litigationFrameJudgment: null,
  rule56Judgment: "Submit",
  supersedes: null,
};

const submissionFactInput = {
  ...baseEntityFixtureInput("LawPracticeIdsSubmissionFact", 1),
  candidateWindow: {
    applicationFilingDate: null,
    candidateWindow: "indeterminate",
    certificateOfMailingClaimed: false,
    closingActionMailingDate: null,
    closingActionWithdrawn: false,
    filedSameDayAsClosingAction: false,
    firstActionOnMeritsMailingDate: null,
    haguePublicationDate: null,
    issueFeePaymentDate: null,
    nationalStageEntryDate: null,
    priorityMailExpressClaimed: false,
    weekendOrDcHolidayShiftApplies: false,
  },
  citingApplication,
  content: {
    conciseExplanationPresent: false,
    legibleCopiesPresent: true,
    listPresent: true,
    separateUsDocumentSectionPresent: true,
    translationPresent: false,
  },
  fees: { sizeFeePresent: false, timingFeePresent: true },
  modeledFrom: { cfrCapture: "law.cornell.edu 37 CFR 1.97/1.98, captured 2026-08-04", mpepRevision: "R-01.2024" },
  officeTreatment: null,
  operativeDate: 3,
  statement: { sizeFeeAssertionPresent: true, statementPresent: true, statementType: "e2-no-prior-knowledge" },
  submissionKind: "initial",
};

const sortedNames = (names: ReadonlyArray<string>): ReadonlyArray<string> => A.sort(names, Order.String);

/**
 * Apply the migration bundle, assert the candor tables carry the constraints and
 * triggers that make them append-only, and record one of each entity through the
 * schema-first converters so the generated columns are proven to accept what the
 * domain encodes. Returns the raw sql client for the caller's denial probe.
 */
const migrateAndRecord = Effect.fnUntraced(function* () {
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
    WHERE constraint_class.contype IN ('c', 'f', 'p', 'u')
  `;
  const triggerRows = yield* sql<{ readonly tgname: string; readonly relname: string }>`
    SELECT trigger_class.tgname, table_class.relname
    FROM pg_trigger AS trigger_class
    JOIN pg_class AS table_class ON table_class.oid = trigger_class.tgrelid
    WHERE NOT trigger_class.tgisinternal
  `;

  expect(
    pipe(
      constraintRows,
      A.filter((row) => A.contains(candorTableNames, row.relname)),
      A.map((row) => row.conname),
      sortedNames
    )
  ).toEqual(expectedConstraintNames);
  expect(
    pipe(
      triggerRows,
      A.filter((row) => A.contains(candorTableNames, row.relname)),
      A.map((row) => row.tgname),
      sortedNames
    )
  ).toEqual(expectedTriggerNames);

  const event = yield* S.decodeUnknownEffect(PatentCitationEvent)(eventInput);
  const disposition = yield* S.decodeUnknownEffect(CandorDisposition)(dispositionInput);
  const submissionFact = yield* S.decodeUnknownEffect(IdsSubmissionFact)(submissionFactInput);

  // The converters return `Result` because encoding is fallible; converting them
  // keeps a schema failure in the error channel instead of inserting defaults.
  const eventInsert = yield* Effect.fromResult(toPatentCitationEventInsert(event));
  const dispositionInsert = yield* Effect.fromResult(toCandorDispositionInsert(disposition));
  const submissionFactInsert = yield* Effect.fromResult(toIdsSubmissionFactInsert(submissionFact));

  yield* db.insert(LawPracticeDbSchema.patentCitationEvent).values(eventInsert);
  yield* db.insert(LawPracticeDbSchema.candorDisposition).values(dispositionInsert);
  yield* db.insert(LawPracticeDbSchema.idsSubmissionFact).values(submissionFactInsert);

  expect(yield* db.select().from(LawPracticeDbSchema.patentCitationEvent)).toHaveLength(1);
  expect(yield* db.select().from(LawPracticeDbSchema.candorDisposition)).toHaveLength(1);
  expect(yield* db.select().from(LawPracticeDbSchema.idsSubmissionFact)).toHaveLength(1);

  return sql;
});

const migrateBeforeSt13OfficeGuard = Effect.fnUntraced(function* () {
  const info = yield* TestDatabaseInfo;
  const db = yield* makeDrizzle();
  const migrationsSchema = pipe(
    info.schema,
    O.getOrElse(() => "drizzle")
  );

  yield* migrateBundle(db, { migrations: priorMigrations, migrationsSchema });
  return { db, migrationsSchema } as const;
});

if (!shouldRunPgliteIntegration) {
  describe.skip("db-admin law-practice-candor-gate migration PgLite integration", () => {});
} else {
  describe("db-admin law-practice-candor-gate migration PgLite integration", { concurrent: false }, () => {
    // Two fresh databases rather than two probes in one session: an implicit
    // transaction pglite host rolls the whole session chain back after an
    // intentional failure, so the UPDATE and DELETE denials cannot share one.
    layer(makeMigrationProofLayer(), { timeout: "2 minutes" })((it) => {
      it.effect(
        "runs the law-practice-candor-gate migration and rejects updating a recorded disposition",
        Effect.fnUntraced(function* () {
          const sql = yield* migrateAndRecord();

          // Keep the intentional failure last: the append-only trigger must
          // reject a direct edit of a filed decision.
          const mutation = yield* Effect.flip(sql`
            UPDATE law_practice_candor_disposition SET rule56_judgment = 'DoNotSubmit' WHERE id = 1
          `);

          expect(inspect(mutation, { depth: 10 })).toContain("append-only");
        }),
        120_000
      );
    });

    layer(makeMigrationProofLayer(), { timeout: "2 minutes" })((it) => {
      it.effect(
        "rejects deleting a recorded disposition",
        Effect.fnUntraced(function* () {
          const sql = yield* migrateAndRecord();

          const mutation = yield* Effect.flip(sql`
            DELETE FROM law_practice_candor_disposition WHERE id = 1
          `);

          expect(inspect(mutation, { depth: 10 })).toContain("append-only");
        }),
        120_000
      );
    });

    for (const [table, identity] of [
      ["law_practice_candor_disposition", { applicationNumber: "102014000345678", kind: "WipoSt13" }],
      [
        "law_practice_ids_submission_fact",
        { applicationNumber: "102014000345678", kind: "WipoSt13", officeCode: null },
      ],
      [
        "law_practice_patent_citation_event",
        { applicationNumber: "102014000345678", kind: "WipoSt13", officeCode: "ZZ" },
      ],
    ] as const) {
      layer(makeMigrationProofLayer(), { timeout: "2 minutes" })((it) => {
        it.effect(
          `refuses the actual upgrade for unresolved legacy ST.13 identity in ${table}`,
          Effect.fnUntraced(function* () {
            const { db, migrationsSchema } = yield* migrateBeforeSt13OfficeGuard();
            const sql = (yield* SqlClient.SqlClient).withoutTransforms();

            // Seed by cloning a schema-valid fixture row from a clean prior
            // migration database, changing only the persisted identity.
            const recordSql =
              table === "law_practice_candor_disposition"
                ? `INSERT INTO ${table} SELECT created_at, created_by_principal, org_id, row_version, schema_version, source, updated_at, updated_by_principal, $1::jsonb, decided_at, disposes, lifecycle, litigation_frame_judgment, rule56_judgment, supersedes, entity_type, id + 100, public_id || '-legacy' FROM ${table} WHERE id = 1`
                : table === "law_practice_ids_submission_fact"
                  ? `INSERT INTO ${table} SELECT created_at, created_by_principal, org_id, row_version, schema_version, source, updated_at, updated_by_principal, candidate_window, $1::jsonb, content, fees, modeled_from, office_treatment, operative_date, statement, submission_kind, entity_type, id + 100, public_id || '-legacy' FROM ${table} WHERE id = 1`
                  : `INSERT INTO ${table} SELECT created_at, created_by_principal, org_id, row_version, schema_version, source, updated_at, updated_by_principal, actor, $1::jsonb, discovery, grounding, observed_at, possible_duplicate_of, quarantine, reference, supersedes, entity_type, id + 100, public_id || '-legacy' FROM ${table} WHERE id = 1`;

            // The prior bundle creates empty tables, so first seed the three
            // valid rows through the same schema converters used above.
            const event = yield* S.decodeUnknownEffect(PatentCitationEvent)(eventInput);
            const disposition = yield* S.decodeUnknownEffect(CandorDisposition)(dispositionInput);
            const submissionFact = yield* S.decodeUnknownEffect(IdsSubmissionFact)(submissionFactInput);
            yield* db
              .insert(LawPracticeDbSchema.patentCitationEvent)
              .values(yield* Effect.fromResult(toPatentCitationEventInsert(event)));
            yield* db
              .insert(LawPracticeDbSchema.candorDisposition)
              .values(yield* Effect.fromResult(toCandorDispositionInsert(disposition)));
            yield* db
              .insert(LawPracticeDbSchema.idsSubmissionFact)
              .values(yield* Effect.fromResult(toIdsSubmissionFactInsert(submissionFact)));
            const encodedIdentity = yield* S.encodeEffect(S.fromJsonString(S.Unknown))(identity);
            yield* sql.unsafe(recordSql, [encodedIdentity]);

            const upgrade = yield* migrateBundle(db, {
              migrations: st13OfficeMigration,
              migrationsSchema,
              migrationsTable: "__drizzle_st13_upgrade",
            }).pipe(Effect.flip);

            expect(inspect(upgrade, { depth: 10 })).toContain(
              "legacy WipoSt13 candor identity requires explicit office resolution before migration"
            );
          }),
          120_000
        );
      });
    }
  });
}
