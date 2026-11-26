/**
 * Durable-row proof for the Drizzle candor record repository.
 *
 * The in-memory sibling proves the append-and-read-only contract at unit speed;
 * nothing there touches SQL. This proof is the other half: the same six
 * operations run against the real db-admin migration bundle in PGlite, so the
 * jsonb equality filter (`citing_application = <encoded filing>`) and the
 * tenant term (`org_id = <scope org>`) are exercised by an actual planner
 * rather than by a JavaScript predicate that happens to agree with them.
 *
 * The tenant case is the security one: two organizations can record against the
 * same application number, and a filing-only filter would let one tenant's
 * disposition release the other tenant's promotion block.
 *
 * The entity inputs mirror the fixtures proved against the migration in
 * `packages/_internal/db-admin/test/integration/LawPracticeCandorGateMigration.pglite.test.ts`,
 * with the entity-type strings taken from the identity registry rather than
 * retyped, so a renamed entity type breaks the build instead of the fixture.
 * Fixture ids are discarded by the converters — the SERIAL column assigns the
 * real ones — so every assertion here reads the ids the database handed back.
 */

import * as NodeURL from "node:url";
import { CandorDisposition, IdsSubmissionFact, PatentCitationEvent } from "@beep/law-practice-domain";
import { CandorRecordRepositoryLive } from "@beep/law-practice-server/CandorRecord";
import { CandorFilingScope } from "@beep/law-practice-use-cases/CandorPolicy";
import { CandorRecordRepository } from "@beep/law-practice-use-cases/CandorRecord";
import { makeDrizzle, makeDrizzleLayer, migrate } from "@beep/postgres";
import * as LawPractice from "@beep/shared-domain/identity/LawPractice";
import { it } from "@beep/test-runner";
import {
  fcRuns,
  makePgliteIntegrationGate,
  makePgliteSqlTestLayer,
  productEntityFixtureInput,
  TestDatabaseInfo,
} from "@beep/test-utils";
import { describe, expect } from "@effect/vitest";
import { assertTrue } from "@effect/vitest/utils";
import { btree_gist } from "@electric-sql/pglite/contrib/btree_gist";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import { flow, pipe } from "effect/Function";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import * as SqlClient from "effect/sql/SqlClient";
import type { CitingApplicationIdentity } from "@beep/law-practice-domain";
import type { CandorRecordRepositoryShape } from "@beep/law-practice-use-cases/CandorRecord";

const decodeUnknownCandorDisposition = S.decodeUnknownEffect(CandorDisposition);
const decodeUnknownIdsSubmissionFact = S.decodeUnknownEffect(IdsSubmissionFact);
const decodeUnknownPatentCitationEvent = S.decodeUnknownEffect(PatentCitationEvent);
const isCandorFilingScope = S.is(CandorFilingScope);

const { shouldRunPgliteIntegration, pgliteIntegrationTimeoutMillis: PgliteIntegrationTimeout } =
  makePgliteIntegrationGate();
const migrationsFolder = NodeURL.fileURLToPath(new URL("../../../_internal/db-admin/drizzle", import.meta.url));

const makeCandorRepositoryLayer = () =>
  CandorRecordRepositoryLive.pipe(
    Layer.provideMerge(makeDrizzleLayer()),
    Layer.provideMerge(
      Layer.fresh(makePgliteSqlTestLayer({ inProcess: { extensions: { btree_gist } }, mode: "in-process" }))
    )
  );

const migrateCandorTables = Effect.fnUntraced(function* () {
  const info = yield* TestDatabaseInfo;
  const db = yield* makeDrizzle();
  const migrationsSchema = pipe(
    info.schema,
    O.getOrElse(() => "drizzle")
  );

  yield* migrate(db, { migrationsFolder, migrationsSchema });
});

const FILING_A: CitingApplicationIdentity.Encoded = { applicationNumber: "16138242", kind: "UsptoNormalized" };
const FILING_A_JSON = flow(S.encodeUnknownResult(S.fromJsonString(S.Unknown)), Result.getOrThrow)(FILING_A);
const FILING_B: CitingApplicationIdentity.Encoded = {
  applicationNumber: "102014000345678",
  kind: "WipoSt13",
  officeCode: "EP",
};

const digest = `sha256:${Str.repeat(64)("a")}`;

const decodeScope = S.decodeUnknownEffect(CandorFilingScope);

describe("law-practice candor repository schema laws", () => {
  it.prop(
    "generates valid filing scopes",
    [CandorFilingScope],
    ([value]) => pipe(isCandorFilingScope(value), assertTrue),
    { arbitrary: fcRuns(25) }
  );
});

const tenantFilingScope = (citingApplication: CitingApplicationIdentity.Encoded, orgId: number) =>
  decodeScope({ citingApplication, orgId });

const eventFixture = (seed: number, citingApplication: CitingApplicationIdentity.Encoded, orgId: number) =>
  decodeUnknownPatentCitationEvent({
    ...productEntityFixtureInput(LawPractice.PatentCitationEventId.entityType, seed),
    orgId,
    actor: "Applicant",
    citingApplication,
    discovery: { kind: "AiDiscovered", model: { name: "reference-extractor", version: "3" } },
    grounding: {
      anchor: { endChar: 4, quote: "fact", startChar: 0 },
      source: {
        extractor: { name: "utf8", version: "1" },
        locator: "office-action.txt",
        normalizationVersion: "1",
        scopeRef: "matter:candor",
        sourceDigest: digest,
        sourceRef: "source:office-action",
        textDigest: digest,
      },
    },
    observedAt: seed,
    possibleDuplicateOf: null,
    quarantine: null,
    reference: { number: "7654321" },
    supersedes: null,
  });

const dispositionFixture = (seed: number, citingApplication: CitingApplicationIdentity.Encoded, orgId: number) =>
  decodeUnknownCandorDisposition({
    ...productEntityFixtureInput(LawPractice.CandorDispositionId.entityType, seed),
    orgId,
    citingApplication,
    decidedAt: seed,
    disposes: { eventId: seed, textDigest: digest },
    lifecycle: "active",
    litigationFrameJudgment: null,
    rule56Judgment: "Submit",
    supersedes: null,
  });

const submissionFactFixture = (seed: number, citingApplication: CitingApplicationIdentity.Encoded, orgId: number) =>
  decodeUnknownIdsSubmissionFact({
    ...productEntityFixtureInput(LawPractice.IdsSubmissionFactId.entityType, seed),
    orgId,
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
    operativeDate: seed,
    statement: { sizeFeeAssertionPresent: true, statementPresent: true, statementType: "e2-no-prior-knowledge" },
    submissionKind: "initial",
  });

const appendOneOfEachKindForTenantFiling = Effect.fnUntraced(function* (
  repository: CandorRecordRepositoryShape,
  citingApplication: CitingApplicationIdentity.Encoded,
  seed: number,
  orgId: number
) {
  const eventFixture1 = yield* eventFixture(seed, citingApplication, orgId);
  const event = yield* repository.recordEvent(eventFixture1);
  const dispositionFixture2 = yield* dispositionFixture(seed, citingApplication, orgId);
  const disposition = yield* repository.recordDisposition(dispositionFixture2);
  const submissionFactFixture3 = yield* submissionFactFixture(seed, citingApplication, orgId);
  const submissionFact = yield* repository.recordSubmissionFact(submissionFactFixture3);

  return { disposition, event, submissionFact };
});

const candorTableNames: ReadonlyArray<string> = [
  "law_practice_candor_disposition",
  "law_practice_ids_submission_fact",
  "law_practice_patent_citation_event",
];

const representativeRowsPerTable = 10_000;
const representativeRowsPerTenant = 100;
const representativeTargetOrg = 50;

const representativeInsertStatements: ReadonlyArray<string> = [
  `INSERT INTO law_practice_candor_disposition (
    created_at, created_by_principal, org_id, row_version, schema_version, source,
    updated_at, updated_by_principal, citing_application, decided_at, disposes,
    lifecycle, litigation_frame_judgment, rule56_judgment, supersedes, entity_type, public_id
  )
  SELECT created_at, created_by_principal, ((sample - 1) / 100)::integer + 1,
    row_version, schema_version, source, updated_at, updated_by_principal,
    CASE WHEN sample % 100 = 1 THEN citing_application
      ELSE jsonb_build_object('kind', 'UsptoNormalized', 'applicationNumber', lpad(sample::text, 8, '0')) END,
    decided_at, disposes, lifecycle, litigation_frame_judgment, rule56_judgment,
    supersedes, entity_type, public_id || '-planner-' || sample::text
  FROM law_practice_candor_disposition CROSS JOIN generate_series(1, $2) AS sample
  WHERE id = $1`,
  `INSERT INTO law_practice_ids_submission_fact (
    created_at, created_by_principal, org_id, row_version, schema_version, source,
    updated_at, updated_by_principal, candidate_window, citing_application, content,
    fees, modeled_from, office_treatment, operative_date, statement, submission_kind,
    entity_type, public_id
  )
  SELECT created_at, created_by_principal, ((sample - 1) / 100)::integer + 1,
    row_version, schema_version, source, updated_at, updated_by_principal, candidate_window,
    CASE WHEN sample % 100 = 1 THEN citing_application
      ELSE jsonb_build_object('kind', 'UsptoNormalized', 'applicationNumber', lpad(sample::text, 8, '0')) END,
    content, fees, modeled_from, office_treatment, operative_date, statement, submission_kind,
    entity_type, public_id || '-planner-' || sample::text
  FROM law_practice_ids_submission_fact CROSS JOIN generate_series(1, $2) AS sample
  WHERE id = $1`,
  `INSERT INTO law_practice_patent_citation_event (
    created_at, created_by_principal, org_id, row_version, schema_version, source,
    updated_at, updated_by_principal, actor, citing_application, discovery, grounding,
    observed_at, possible_duplicate_of, quarantine, reference, supersedes, entity_type, public_id
  )
  SELECT created_at, created_by_principal, ((sample - 1) / 100)::integer + 1,
    row_version, schema_version, source, updated_at, updated_by_principal, actor,
    CASE WHEN sample % 100 = 1 THEN citing_application
      ELSE jsonb_build_object('kind', 'UsptoNormalized', 'applicationNumber', lpad(sample::text, 8, '0')) END,
    discovery, grounding, observed_at, possible_duplicate_of, quarantine, reference,
    supersedes, entity_type, public_id || '-planner-' || sample::text
  FROM law_practice_patent_citation_event CROSS JOIN generate_series(1, $2) AS sample
  WHERE id = $1`,
];

interface ExplainPlanNode {
  readonly "Actual Rows"?: number;
  readonly "Index Name"?: string;
  readonly "Node Type": string;
  readonly Plans?: ReadonlyArray<ExplainPlanNode>;
  readonly "Rows Removed by Filter"?: number;
}

interface ExplainDocument {
  readonly Plan: ExplainPlanNode;
}

const collectPlanNodes = (node: ExplainPlanNode): ReadonlyArray<ExplainPlanNode> => [
  node,
  ...A.flatMap(node.Plans ?? [], collectPlanNodes),
];

const seedRepresentativePlannerVolume = Effect.fnUntraced(function* (seedRows: ReadonlyArray<number>) {
  const sql = (yield* SqlClient.SqlClient).withoutTransforms();

  yield* Effect.forEach(
    A.zip(representativeInsertStatements, seedRows),
    ([statement, seedId]) => sql.unsafe(statement, [seedId, representativeRowsPerTable]),
    { concurrency: 1, discard: true }
  );
  yield* Effect.forEach(candorTableNames, (table) => sql.unsafe(`ANALYZE ${table}`), { concurrency: 1, discard: true });
});

const explainFilingRead = Effect.fnUntraced(function* (table: string) {
  const sql = (yield* SqlClient.SqlClient).withoutTransforms();
  const rows = yield* sql.unsafe<{ readonly "QUERY PLAN": ReadonlyArray<ExplainDocument> }>(
    `EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)
     SELECT * FROM ${table}
     WHERE org_id = $1 AND citing_application = $2::jsonb
     ORDER BY id ASC`,
    [representativeTargetOrg, FILING_A_JSON]
  );
  const document = rows[0]?.["QUERY PLAN"]?.[0];

  return document === undefined ? [] : collectPlanNodes(document.Plan);
});

const rewindIdSequencesSoNextAppendReceives = Effect.fnUntraced(function* (nextId: number) {
  const sql = (yield* SqlClient.SqlClient).withoutTransforms();

  yield* Effect.forEach(
    candorTableNames,
    (table) => sql`SELECT setval(pg_get_serial_sequence(${table}, 'id'), ${nextId}, false)`,
    { concurrency: 1, discard: true }
  );
});

const forceSequentialScans = Effect.fnUntraced(function* () {
  const sql = (yield* SqlClient.SqlClient).withoutTransforms();

  yield* sql`SET enable_indexscan = off`;
  yield* sql`SET enable_indexonlyscan = off`;
  yield* sql`SET enable_bitmapscan = off`;
});

const DRIZZLE_CANDOR_INTEGRATION_TITLE =
  "law-practice Drizzle candor record repository PgLite integration (in-process lane: the migration bundle's btree_gist extension cannot load over pglite-socket)";

const ids = <Entity extends { readonly id: number }>(records: ReadonlyArray<Entity>): ReadonlyArray<number> =>
  A.map(records, (record) => record.id);

const orgIds = <Entity extends { readonly orgId: number }>(records: ReadonlyArray<Entity>): ReadonlyArray<number> =>
  A.map(records, (record) => record.orgId);

if (!shouldRunPgliteIntegration) {
  describe.skip(DRIZZLE_CANDOR_INTEGRATION_TITLE, () => {});
} else {
  describe(DRIZZLE_CANDOR_INTEGRATION_TITLE, { concurrent: false }, () => {
    it.layer(makeCandorRepositoryLayer(), { timeout: "5 minutes" })("appending and reading each record kind", (it) => {
      it.effect(
        "reads every appended kind back out of Postgres scoped to the filing it was recorded for",
        Effect.fnUntraced(function* () {
          yield* migrateCandorTables();
          const repository = yield* CandorRecordRepository;

          const filed = yield* appendOneOfEachKindForTenantFiling(repository, FILING_A, 1, 1);
          const other = yield* appendOneOfEachKindForTenantFiling(repository, FILING_B, 2, 1);

          const filingA = yield* tenantFilingScope(FILING_A, 1);
          const filingB = yield* tenantFilingScope(FILING_B, 1);

          const events = yield* repository.listEvents(filingA);
          const dispositions = yield* repository.listDispositions(filingA);
          const submissionFacts = yield* repository.listSubmissionFacts(filingA);
          const snapshot = yield* repository.readSnapshot(filingA);

          expect(
            ids(events),
            "the read returns the database-assigned ids of the stored rows the append returned"
          ).toEqual([filed.event.id]);
          expect(ids(dispositions)).toEqual([filed.disposition.id]);
          expect(ids(submissionFacts)).toEqual([filed.submissionFact.id]);
          expect(ids(snapshot.events)).toEqual([filed.event.id]);
          expect(ids(snapshot.dispositions)).toEqual([filed.disposition.id]);

          expect(
            A.map(events, (event) => event.grounding.source.textDigest),
            "the jsonb round trip returns the observation that went in"
          ).toEqual([digest]);
          expect(A.map(dispositions, (disposition) => disposition.disposes.textDigest)).toEqual([digest]);
          expect(A.map(submissionFacts, (fact) => fact.submissionKind)).toEqual(["initial"]);

          const listEvents4 = yield* repository.listEvents(filingB);
          expect(
            ids(listEvents4),
            "jsonb equality alone separates a same-tenant filing of another representation"
          ).toEqual([other.event.id]);
          const listDispositions5 = yield* repository.listDispositions(filingB);
          expect(ids(listDispositions5)).toEqual([other.disposition.id]);
          const listSubmissionFacts6 = yield* repository.listSubmissionFacts(filingB);
          expect(ids(listSubmissionFacts6)).toEqual([other.submissionFact.id]);
        }),
        PgliteIntegrationTimeout
      );
    });

    it.layer(makeCandorRepositoryLayer(), { timeout: "5 minutes" })("tenant isolation in SQL", (it) => {
      it.effect(
        "never returns another organization's records for the same citing application",
        Effect.fnUntraced(function* () {
          yield* migrateCandorTables();
          const repository = yield* CandorRecordRepository;

          const first = yield* appendOneOfEachKindForTenantFiling(repository, FILING_A, 1, 1);
          const foreign = yield* appendOneOfEachKindForTenantFiling(repository, FILING_A, 2, 2);
          const third = yield* appendOneOfEachKindForTenantFiling(repository, FILING_A, 3, 1);

          const tenantOne = yield* tenantFilingScope(FILING_A, 1);
          const tenantTwo = yield* tenantFilingScope(FILING_A, 2);

          const tenantOneEvents = yield* repository.listEvents(tenantOne);
          const tenantOneDispositions = yield* repository.listDispositions(tenantOne);
          const tenantOneFacts = yield* repository.listSubmissionFacts(tenantOne);

          expect(
            ids(tenantOneEvents),
            "tenant one's rows come by id ascending across the interleaved id the other tenant owns"
          ).toEqual([first.event.id, third.event.id]);
          expect(ids(tenantOneDispositions)).toEqual([first.disposition.id, third.disposition.id]);
          expect(ids(tenantOneFacts)).toEqual([first.submissionFact.id, third.submissionFact.id]);
          expect(orgIds(tenantOneEvents)).toEqual([1, 1]);
          expect(orgIds(tenantOneDispositions)).toEqual([1, 1]);
          expect(orgIds(tenantOneFacts)).toEqual([1, 1]);

          const listEvents7 = yield* repository.listEvents(tenantTwo);
          expect(orgIds(listEvents7)).toEqual([2]);
          const listDispositions8 = yield* repository.listDispositions(tenantTwo);
          expect(orgIds(listDispositions8)).toEqual([2]);
          const listSubmissionFacts9 = yield* repository.listSubmissionFacts(tenantTwo);
          expect(orgIds(listSubmissionFacts9)).toEqual([2]);
          const listEvents10 = yield* repository.listEvents(tenantTwo);
          expect(ids(listEvents10)).toEqual([foreign.event.id]);
          const listDispositions11 = yield* repository.listDispositions(tenantTwo);
          expect(ids(listDispositions11)).toEqual([foreign.disposition.id]);
          const listSubmissionFacts12 = yield* repository.listSubmissionFacts(tenantTwo);
          expect(ids(listSubmissionFacts12)).toEqual([foreign.submissionFact.id]);
        }),
        PgliteIntegrationTimeout
      );
    });

    it.layer(makeCandorRepositoryLayer(), { timeout: "5 minutes" })("ordering reads of one filing", (it) => {
      it.effect(
        "returns each kind by id ascending when the highest id is appended first, so heap order and id order disagree",
        Effect.fnUntraced(function* () {
          yield* migrateCandorTables();
          const repository = yield* CandorRecordRepository;

          yield* rewindIdSequencesSoNextAppendReceives(101);
          const later = yield* appendOneOfEachKindForTenantFiling(repository, FILING_A, 1, 1);
          yield* rewindIdSequencesSoNextAppendReceives(1);
          const earlier = yield* appendOneOfEachKindForTenantFiling(repository, FILING_A, 2, 1);

          expect(later.event.id, "setup: without the rewind these appends land ascending and prove nothing below").toBe(
            101
          );
          expect(
            earlier.event.id,
            "setup: without the rewind these appends land ascending and prove nothing below"
          ).toBe(1);

          yield* forceSequentialScans();
          const filing = yield* tenantFilingScope(FILING_A, 1);

          const listEvents13 = yield* repository.listEvents(filing);
          expect(ids(listEvents13), "ORDER BY id, not the (org_id, id) index, orders the rows").toEqual([
            earlier.event.id,
            later.event.id,
          ]);
          const listDispositions14 = yield* repository.listDispositions(filing);
          expect(ids(listDispositions14)).toEqual([earlier.disposition.id, later.disposition.id]);
          const listSubmissionFacts15 = yield* repository.listSubmissionFacts(filing);
          expect(ids(listSubmissionFacts15)).toEqual([earlier.submissionFact.id, later.submissionFact.id]);
        }),
        PgliteIntegrationTimeout
      );
    });

    it.layer(makeCandorRepositoryLayer(), { timeout: "5 minutes" })("representative-volume query plans", (it) => {
      it.effect(
        "bounds every filing read by the existing tenant index before applying jsonb equality",
        Effect.fnUntraced(function* () {
          yield* migrateCandorTables();
          const repository = yield* CandorRecordRepository;
          const seed = yield* appendOneOfEachKindForTenantFiling(repository, FILING_A, 1, 1);

          yield* seedRepresentativePlannerVolume([seed.disposition.id, seed.submissionFact.id, seed.event.id]);

          for (const table of candorTableNames) {
            const plan = yield* explainFilingRead(table);
            const tenantIndexNode = A.findFirst(plan, (node) =>
              O.exists(O.fromUndefinedOr(node["Index Name"]), Str.includes("org_id"))
            );

            assertTrue(O.isSome(tenantIndexNode), `${table} plan did not use an org_id index`);
            expect(
              O.getOrThrow(tenantIndexNode)["Rows Removed by Filter"],
              `${table} plan scanned beyond one representative tenant`
            ).toBeLessThan(representativeRowsPerTenant);
            expect(O.getOrThrow(tenantIndexNode)["Actual Rows"], `${table} plan did not isolate one filing`).toBe(1);
          }
        }),
        PgliteIntegrationTimeout
      );
    });

    it.layer(makeCandorRepositoryLayer(), {
      timeout: "5 minutes",
    })(
      "driver failures, in their own database because a failed read rolls back the pglite host's whole session chain",
      (it) => {
        it.effect(
          "reports an unmigrated table as a typed repository failure naming that table, never as a not-blocked empty read",
          Effect.fnUntraced(function* () {
            const repository = yield* CandorRecordRepository;
            const filing = yield* tenantFilingScope(FILING_A, 1);

            const failure = yield* Effect.flip(repository.readSnapshot(filing));

            expect(failure.operation).toBe("readSnapshot");
            expect(failure.reason).toContain("law_practice_patent_citation_event");
          }),
          PgliteIntegrationTimeout
        );
      }
    );
  });
}
