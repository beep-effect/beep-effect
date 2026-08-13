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

import { fileURLToPath } from "node:url";
import { CandorDisposition, IdsSubmissionFact, PatentCitationEvent } from "@beep/law-practice-domain";
import { CandorRecordRepositoryLive } from "@beep/law-practice-server/CandorRecord";
import { CandorFilingScope } from "@beep/law-practice-use-cases/CandorPolicy";
import { CandorRecordRepository } from "@beep/law-practice-use-cases/CandorRecord";
import { makeDrizzle, makeDrizzleLayer, migrate } from "@beep/postgres";
import * as LawPractice from "@beep/shared-domain/identity/LawPractice";
import {
  baseEntityFixtureInput,
  makePgliteIntegrationGate,
  makePgliteSqlTestLayer,
  TestDatabaseInfo,
} from "@beep/test-utils";
import { describe, expect, layer } from "@effect/vitest";
import { btree_gist } from "@electric-sql/pglite/contrib/btree_gist";
import { Effect, Layer, pipe } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as SqlClient from "effect/unstable/sql/SqlClient";
import type { CitingApplicationIdentity } from "@beep/law-practice-domain";
import type { CandorRecordRepositoryShape } from "@beep/law-practice-use-cases/CandorRecord";

const { shouldRunPgliteIntegration, pgliteIntegrationTimeoutMillis: PgliteIntegrationTimeout } =
  makePgliteIntegrationGate();
const migrationsFolder = fileURLToPath(new URL("../../../_internal/db-admin/drizzle", import.meta.url));

// The bundle contains `CREATE EXTENSION btree_gist` (the epistemic edge
// migration), which the shared external pglite-socket lane cannot load, so this
// proof is pinned to the in-process lane with the bundled extension registered.
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

// Two representations rather than two numbers: scoping a read to one of them
// also holds the port's rule that nothing matches across representations.
const FILING_A: CitingApplicationIdentity.Encoded = { applicationNumber: "16138242", kind: "UsptoNormalized" };
const FILING_A_JSON = S.encodeUnknownSync(S.fromJsonString(S.Unknown))(FILING_A);
const FILING_B: CitingApplicationIdentity.Encoded = {
  applicationNumber: "102014000345678",
  kind: "WipoSt13",
  officeCode: "EP",
};

const digest = `sha256:${"a".repeat(64)}`;

const decodeScope = S.decodeUnknownEffect(CandorFilingScope);

/** Scope a filing to one tenant; every read the repository serves takes one. */
const scopeFor = (citingApplication: CitingApplicationIdentity.Encoded, orgId: number) =>
  decodeScope({ citingApplication, orgId });

const eventFixture = (seed: number, citingApplication: CitingApplicationIdentity.Encoded, orgId: number) =>
  S.decodeUnknownEffect(PatentCitationEvent)({
    ...baseEntityFixtureInput(LawPractice.PatentCitationEventId.entityType, seed),
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
  S.decodeUnknownEffect(CandorDisposition)({
    ...baseEntityFixtureInput(LawPractice.CandorDispositionId.entityType, seed),
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
  S.decodeUnknownEffect(IdsSubmissionFact)({
    ...baseEntityFixtureInput(LawPractice.IdsSubmissionFactId.entityType, seed),
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

/** Append one record of each kind for a filing under one tenant. */
const appendFiling = Effect.fnUntraced(function* (
  repository: CandorRecordRepositoryShape,
  citingApplication: CitingApplicationIdentity.Encoded,
  seed: number,
  orgId: number
) {
  const event = yield* repository.recordEvent(yield* eventFixture(seed, citingApplication, orgId));
  const disposition = yield* repository.recordDisposition(yield* dispositionFixture(seed, citingApplication, orgId));
  const submissionFact = yield* repository.recordSubmissionFact(
    yield* submissionFactFixture(seed, citingApplication, orgId)
  );

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
    { discard: true }
  );
  yield* Effect.forEach(candorTableNames, (table) => sql.unsafe(`ANALYZE ${table}`), { discard: true });
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

/**
 * Rewind every candor table's id sequence so the next append receives `nextId`.
 *
 * Postgres hands a freshly-appended heap back in insertion order, so on a table
 * that only ever grows, append order and id order agree and an ordering
 * assertion proves nothing. Moving the sequence is what makes them disagree.
 */
const setNextRowId = Effect.fnUntraced(function* (nextId: number) {
  const sql = (yield* SqlClient.SqlClient).withoutTransforms();

  yield* Effect.forEach(
    candorTableNames,
    (table) => sql`SELECT setval(pg_get_serial_sequence(${table}, 'id'), ${nextId}, false)`,
    {
      discard: true,
    }
  );
});

/**
 * Make the planner read the heap directly for the rest of the session.
 *
 * The tenant filter is served by the `(org_id, id)` unique index, which already
 * hands rows back in id order — so with that index available the repository's
 * `ORDER BY id ASC` is unobservable and an ordering assertion cannot fail.
 * Forcing sequential scans is what makes the clause the only thing standing
 * between the caller and heap order.
 */
const forceSequentialScans = Effect.fnUntraced(function* () {
  const sql = (yield* SqlClient.SqlClient).withoutTransforms();

  yield* sql`SET enable_indexscan = off`;
  yield* sql`SET enable_indexonlyscan = off`;
  yield* sql`SET enable_bitmapscan = off`;
});

const ids = <Entity extends { readonly id: number }>(records: ReadonlyArray<Entity>): ReadonlyArray<number> =>
  A.map(records, (record) => record.id);

const orgIds = <Entity extends { readonly orgId: number }>(records: ReadonlyArray<Entity>): ReadonlyArray<number> =>
  A.map(records, (record) => record.orgId);

if (!shouldRunPgliteIntegration) {
  describe.skip("law-practice Drizzle candor record repository PgLite integration", () => {});
} else {
  describe("law-practice Drizzle candor record repository PgLite integration", { concurrent: false }, () => {
    layer(makeCandorRepositoryLayer(), { timeout: "5 minutes" })("appending and reading each record kind", (it) => {
      it.effect(
        "reads every appended kind back out of Postgres scoped to the filing it was recorded for",
        Effect.fnUntraced(function* () {
          yield* migrateCandorTables();
          const repository = yield* CandorRecordRepository;

          const filed = yield* appendFiling(repository, FILING_A, 1, 1);
          // A second filing under the same tenant: the jsonb equality filter is
          // the only thing keeping these apart.
          const other = yield* appendFiling(repository, FILING_B, 2, 1);

          const filingA = yield* scopeFor(FILING_A, 1);
          const filingB = yield* scopeFor(FILING_B, 1);

          const events = yield* repository.listEvents(filingA);
          const dispositions = yield* repository.listDispositions(filingA);
          const submissionFacts = yield* repository.listSubmissionFacts(filingA);

          // The database, not the fixture, assigned these ids; the append
          // returned the stored row, so the read must match it exactly.
          expect(ids(events)).toEqual([filed.event.id]);
          expect(ids(dispositions)).toEqual([filed.disposition.id]);
          expect(ids(submissionFacts)).toEqual([filed.submissionFact.id]);

          // Round-tripping the recorded surface, not just the row count: what
          // came back out of jsonb must still be the observation that went in.
          expect(A.map(events, (event) => event.grounding.source.textDigest)).toEqual([digest]);
          expect(A.map(dispositions, (disposition) => disposition.disposes.textDigest)).toEqual([digest]);
          expect(A.map(submissionFacts, (fact) => fact.submissionKind)).toEqual(["initial"]);

          expect(ids(yield* repository.listEvents(filingB))).toEqual([other.event.id]);
          expect(ids(yield* repository.listDispositions(filingB))).toEqual([other.disposition.id]);
          expect(ids(yield* repository.listSubmissionFacts(filingB))).toEqual([other.submissionFact.id]);
        }),
        PgliteIntegrationTimeout
      );
    });

    layer(makeCandorRepositoryLayer(), { timeout: "5 minutes" })("tenant isolation in SQL", (it) => {
      it.effect(
        "never returns another organization's records for the same citing application",
        Effect.fnUntraced(function* () {
          yield* migrateCandorTables();
          const repository = yield* CandorRecordRepository;

          // Interleaved so each tenant's rows are non-contiguous in the table:
          // org 1 holds ids 1 and 3, org 2 holds id 2, for every kind.
          const first = yield* appendFiling(repository, FILING_A, 1, 1);
          const foreign = yield* appendFiling(repository, FILING_A, 2, 2);
          const third = yield* appendFiling(repository, FILING_A, 3, 1);

          const tenantOne = yield* scopeFor(FILING_A, 1);
          const tenantTwo = yield* scopeFor(FILING_A, 2);

          const tenantOneEvents = yield* repository.listEvents(tenantOne);
          const tenantOneDispositions = yield* repository.listDispositions(tenantOne);
          const tenantOneFacts = yield* repository.listSubmissionFacts(tenantOne);

          // Ordered by id ascending across a gap the other tenant owns.
          expect(ids(tenantOneEvents)).toEqual([first.event.id, third.event.id]);
          expect(ids(tenantOneDispositions)).toEqual([first.disposition.id, third.disposition.id]);
          expect(ids(tenantOneFacts)).toEqual([first.submissionFact.id, third.submissionFact.id]);
          expect(orgIds(tenantOneEvents)).toEqual([1, 1]);
          expect(orgIds(tenantOneDispositions)).toEqual([1, 1]);
          expect(orgIds(tenantOneFacts)).toEqual([1, 1]);

          expect(orgIds(yield* repository.listEvents(tenantTwo))).toEqual([2]);
          expect(orgIds(yield* repository.listDispositions(tenantTwo))).toEqual([2]);
          expect(orgIds(yield* repository.listSubmissionFacts(tenantTwo))).toEqual([2]);
          expect(ids(yield* repository.listEvents(tenantTwo))).toEqual([foreign.event.id]);
          expect(ids(yield* repository.listDispositions(tenantTwo))).toEqual([foreign.disposition.id]);
          expect(ids(yield* repository.listSubmissionFacts(tenantTwo))).toEqual([foreign.submissionFact.id]);
        }),
        PgliteIntegrationTimeout
      );
    });

    layer(makeCandorRepositoryLayer(), { timeout: "5 minutes" })("ordering reads of one filing", (it) => {
      it.effect(
        "returns each kind by id ascending whatever order it was appended in",
        Effect.fnUntraced(function* () {
          yield* migrateCandorTables();
          const repository = yield* CandorRecordRepository;

          // Highest id appended first, so heap order and id order disagree.
          yield* setNextRowId(101);
          const later = yield* appendFiling(repository, FILING_A, 1, 1);
          yield* setNextRowId(1);
          const earlier = yield* appendFiling(repository, FILING_A, 2, 1);

          // The setup itself is asserted: without the rewind the two appends
          // would land in ascending order and prove nothing below.
          expect(later.event.id).toBe(101);
          expect(earlier.event.id).toBe(1);

          yield* forceSequentialScans();
          const filing = yield* scopeFor(FILING_A, 1);

          expect(ids(yield* repository.listEvents(filing))).toEqual([earlier.event.id, later.event.id]);
          expect(ids(yield* repository.listDispositions(filing))).toEqual([
            earlier.disposition.id,
            later.disposition.id,
          ]);
          expect(ids(yield* repository.listSubmissionFacts(filing))).toEqual([
            earlier.submissionFact.id,
            later.submissionFact.id,
          ]);
        }),
        PgliteIntegrationTimeout
      );
    });

    layer(makeCandorRepositoryLayer(), { timeout: "5 minutes" })("representative-volume query plans", (it) => {
      it.effect(
        "bounds every filing read by the existing tenant index before applying jsonb equality",
        Effect.fnUntraced(function* () {
          yield* migrateCandorTables();
          const repository = yield* CandorRecordRepository;
          const seed = yield* appendFiling(repository, FILING_A, 1, 1);

          yield* seedRepresentativePlannerVolume([seed.disposition.id, seed.submissionFact.id, seed.event.id]);

          for (const table of candorTableNames) {
            const plan = yield* explainFilingRead(table);
            const tenantIndexNode = A.findFirst(plan, (node) => node["Index Name"]?.includes("org_id") === true);

            expect(O.isSome(tenantIndexNode), `${table} plan did not use an org_id index`).toBe(true);
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

    // Its own database: the read below is expected to fail, and an implicit
    // transaction pglite host rolls the whole session chain back afterwards.
    layer(makeCandorRepositoryLayer(), { timeout: "5 minutes" })("driver failures", (it) => {
      it.effect(
        "reports an unreadable table as a typed repository failure naming that table",
        Effect.fnUntraced(function* () {
          const repository = yield* CandorRecordRepository;
          const filing = yield* scopeFor(FILING_A, 1);

          // Intentional failure last: no migration has run in this database, so
          // the physical table does not exist. A read that swallowed this would
          // let the gate report "not blocked" for a filing it never checked.
          const failure = yield* Effect.flip(repository.listEvents(filing));

          expect(failure.operation).toBe("listEvents");
          expect(failure.reason).toContain("law_practice_patent_citation_event");
        }),
        PgliteIntegrationTimeout
      );
    });
  });
}
