/**
 * Durable-row proof for the Drizzle legal position record repository.
 *
 * The in-memory sibling proves the append-and-read-only contract at unit speed;
 * nothing there touches SQL. This proof is the other half: the same ten
 * operations run against the real db-admin migration bundle in PGlite, so the
 * tenant term (`org_id = <scope org>`), the frame term (`frame = <scope frame>`)
 * and the `ORDER BY id ASC` are exercised by an actual planner rather than by
 * JavaScript predicates that happen to agree with them.
 *
 * The tenant case is the security one: two organizations can record positions
 * about the same norm and the same act, and an unscoped read would merge two
 * legal pictures into one.
 *
 * The entity inputs mirror the fixtures proved against the migration in
 * `packages/_internal/db-admin/test/integration/LawPracticeLegalPositionMigration.pglite.test.ts`,
 * with the entity-type strings taken from the identity registry rather than
 * retyped, so a renamed entity type breaks the build instead of the fixture.
 * Fixture ids are discarded by the converters — the SERIAL column assigns the
 * real ones — so every assertion here reads the ids the database handed back,
 * and every cross-record reference cites an id a prior append returned rather
 * than a seed nobody stored.
 */

import * as NodeURL from "node:url";
import {
  ActFrame,
  CorrectionDelta,
  LegalOppositionCandidate,
  LegalPositionRelator,
  PowerExercise,
} from "@beep/law-practice-domain";
import { LegalPositionRecordRepositoryLive } from "@beep/law-practice-server/LegalPositionRecord";
import {
  ActFrameRecordScope,
  LegalPositionRecordRepository,
  LegalPositionRecordScope,
} from "@beep/law-practice-use-cases/LegalPositionRecord";
import { makeDrizzle, makeDrizzleLayer, migrate } from "@beep/postgres";
import * as LawPractice from "@beep/shared-domain/identity/LawPractice";
import * as Shared from "@beep/shared-domain/identity/Shared";
import { it } from "@beep/test-runner";
import {
  makePgliteIntegrationGate,
  makePgliteSqlTestLayer,
  productEntityFixtureInput,
  TestDatabaseInfo,
} from "@beep/test-utils";
import { describe, expect } from "@effect/vitest";
import { btree_gist } from "@electric-sql/pglite/contrib/btree_gist";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import { pipe } from "effect/Function";
import * as HashSet from "effect/HashSet";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Order from "effect/Order";
import * as S from "effect/Schema";
import * as SqlClient from "effect/sql/SqlClient";
import type { LegalPositionRecordRepositoryShape } from "@beep/law-practice-use-cases/LegalPositionRecord";

const decodeUnknownActFrame = S.decodeUnknownEffect(ActFrame);
const decodeUnknownCorrectionDelta = S.decodeUnknownEffect(CorrectionDelta);
const decodeUnknownLegalOppositionCandidate = S.decodeUnknownEffect(LegalOppositionCandidate);
const decodeUnknownLegalPositionRelator = S.decodeUnknownEffect(LegalPositionRelator);
const decodeUnknownPowerExercise = S.decodeUnknownEffect(PowerExercise);

const { shouldRunPgliteIntegration, pgliteIntegrationTimeoutMillis: PgliteIntegrationTimeout } =
  makePgliteIntegrationGate();
const migrationsFolder = NodeURL.fileURLToPath(new URL("../../../_internal/db-admin/drizzle", import.meta.url));

const makeLegalPositionRepositoryLayer = () =>
  LegalPositionRecordRepositoryLive.pipe(
    Layer.provideMerge(makeDrizzleLayer()),
    Layer.provideMerge(
      Layer.fresh(makePgliteSqlTestLayer({ inProcess: { extensions: { btree_gist } }, mode: "in-process" }))
    )
  );

const migrateLegalPositionTables = Effect.fnUntraced(function* () {
  const info = yield* TestDatabaseInfo;
  const db = yield* makeDrizzle();
  const migrationsSchema = pipe(
    info.schema,
    O.getOrElse(() => "drizzle")
  );

  yield* migrate(db, { migrationsFolder, migrationsSchema });
});

const ACT = "enter the demised premises";
const NORM = { designation: "cl. 4.1" };
const systemPrincipal = { component: "Runtime", kind: "System" };

const norm = (designation: string, fragment: string | null) => ({ fragment, norm: { designation } });

const roleInput = (name: string, player: number) => ({
  admittedPlayerKinds: ["natural-person"],
  name,
  player,
  sourceNorm: NORM,
});

const scopeInput = {
  material: ["the demised premises"],
  quantitative: ["unlimited"],
  subjective: ["the lessor"],
  temporal: ["the term of the lease"],
  territorial: ["US-CA"],
};

const slot = (label: string, kind: "actor" | "object" | "recipient") => ({
  kind,
  label,
  source: norm("cl. 4.1", "the lessee may"),
});

const transition = (label: string, kind: string) => ({
  bearer: "lessee",
  counterparty: "lessor",
  label,
  position: { content: { description: ACT, polarity: "omission" }, kind },
  source: norm("cl. 5", null),
});

const frameFixture = (seed: number, org: number) =>
  decodeUnknownActFrame({
    ...productEntityFixtureInput(LawPractice.ActFrameId.entityType, seed),
    orgId: org,
    act: { description: "assign the lease", polarity: "act" },
    creates: [transition("assignee-claim", "claim")],
    derivationKind: { kinds: ["create", "extinguish"] },
    interpreter: systemPrincipal,
    preconditions: [
      {
        label: "no-objection",
        operativeFact: "the lessor has objected in writing",
        polarity: "absent",
        source: norm("cl. 4.2", null),
      },
    ],
    slots: [slot("lessee", "actor"), slot("lessor", "recipient")],
    sourceNorm: { designation: "cl. 4" },
    terminates: [transition("assignor-claim", "claim")],
  });

const exerciseFixture = (seed: number, frame: number, org: number) =>
  decodeUnknownPowerExercise({
    ...productEntityFixtureInput(LawPractice.PowerExerciseId.entityType, seed),
    orgId: org,
    attemptedAt: 1_700_000_000_000 + seed,
    authorityBasis: {
      claimedRole: roleInput("lessee", 1),
      exercisedPower: null,
      foundingExercise: null,
      sourceNorm: NORM,
    },
    frame,
    preconditionAssertions: [{ element: { label: "no-objection", part: "precondition" }, status: "asserted-met" }],
    result: {
      constitution: null,
      disposition: { basis: null, disposition: "undetermined", interpreter: systemPrincipal },
      permission: null,
    },
    slotAssignments: [{ player: 1, slot: { label: "lessee", part: "slot" } }],
  });

const correctionFixture = (seed: number, frame: number, org: number) =>
  decodeUnknownCorrectionDelta({
    ...productEntityFixtureInput(LawPractice.CorrectionDeltaId.entityType, seed),
    orgId: org,
    candidateRouting: "contradiction-candidate-input",
    correctedElements: [
      { element: { label: "no-objection", part: "precondition" }, source: norm("cl. 4.2", "within ten days") },
    ],
    frame,
    reviewer: systemPrincipal,
    reviewerAction: "undetermined",
    stage: "interpretation",
    supersedes: null,
    validatorReport: {
      findings: [{ element: { label: "lessee", part: "slot" }, message: "slot cites no clause", severity: "hard" }],
      validator: "frame-slot-coverage",
    },
  });

const relatorFixture = (seed: number, positionKind: string, polarity: string, exercise: number, org: number) =>
  decodeUnknownLegalPositionRelator({
    ...productEntityFixtureInput(LawPractice.LegalPositionRelatorId.entityType, seed),
    orgId: org,
    assertingInterpreter: { kind: "User", userId: 1 },
    bearer: roleInput("lessee", 1),
    content: { description: ACT, polarity },
    counterparty: roleInput("lessor", 2),
    grounding: { foundingExercise: null, producingExercise: exercise },
    positionKind,
    scope: scopeInput,
    sourceNorm: NORM,
  });

const candidateFixture = (seed: number, relators: ReadonlyArray<number>, org: number) =>
  decodeUnknownLegalOppositionCandidate({
    ...productEntityFixtureInput(LawPractice.LegalOppositionCandidateId.entityType, seed),
    orgId: org,
    candidate: { act: ACT, overlappingScope: scopeInput, relators },
    priorityBasis: null,
    verdictFamily: null,
  });

const relatorPairSeeds = (seed: number) => ({
  claimSeed: seed * 10 + 1,
  privilegeSeed: seed * 10,
});

const appendOpposedPositionInDependencyOrder = Effect.fnUntraced(function* (
  repository: LegalPositionRecordRepositoryShape,
  seed: number,
  org: number
) {
  const frameFixture1 = yield* frameFixture(seed, org);
  const frame = yield* repository.recordFrame(frameFixture1);
  const exerciseFixture2 = yield* exerciseFixture(seed, frame.id, org);
  const exercise = yield* repository.recordExercise(exerciseFixture2);
  const correctionFixture3 = yield* correctionFixture(seed, frame.id, org);
  const correction = yield* repository.recordCorrection(correctionFixture3);
  const { claimSeed, privilegeSeed } = relatorPairSeeds(seed);
  const relatorFixture4 = yield* relatorFixture(privilegeSeed, "privilege", "act", exercise.id, org);
  const privilege = yield* repository.recordRelator(relatorFixture4);
  const relatorFixture5 = yield* relatorFixture(claimSeed, "claim", "omission", exercise.id, org);
  const claim = yield* repository.recordRelator(relatorFixture5);
  const candidateFixture6 = yield* candidateFixture(seed, [privilege.id, claim.id], org);
  const candidate = yield* repository.recordOppositionCandidate(candidateFixture6);

  return { candidate, claim, correction, exercise, frame, privilege };
});

const legalPositionTableNames: ReadonlyArray<string> = [
  "law_practice_act_frame",
  "law_practice_correction_delta",
  "law_practice_legal_opposition_candidate",
  "law_practice_legal_position_relator",
  "law_practice_power_exercise",
];

const setNextRowId = Effect.fnUntraced(function* (nextId: number) {
  const sql = (yield* SqlClient.SqlClient).withoutTransforms();

  yield* Effect.forEach(
    legalPositionTableNames,
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

const ids = <Entity extends { readonly id: number }>(records: ReadonlyArray<Entity>): ReadonlyArray<number> =>
  A.map(records, (record) => record.id);

const orgIds = <Entity extends { readonly orgId: number }>(records: ReadonlyArray<Entity>): ReadonlyArray<number> =>
  A.map(records, (record) => record.orgId);

const tenant = (org: number) => LegalPositionRecordScope.make({ orgId: Shared.OrganizationId.make(org) });

const underFrame = (frame: number, org: number) =>
  ActFrameRecordScope.make({ frame: LawPractice.ActFrameId.make(frame), orgId: Shared.OrganizationId.make(org) });

if (!shouldRunPgliteIntegration) {
  describe.skip("law-practice Drizzle legal position record repository PgLite integration", () => {});
} else {
  describe("law-practice Drizzle legal position record repository PgLite integration", { concurrent: false }, () => {
    it.layer(makeLegalPositionRepositoryLayer(), { timeout: "5 minutes" })(
      "appending and reading each record kind",
      (it) => {
        it.effect(
          "reads every appended kind back out of Postgres scoped to where it was recorded",
          Effect.fnUntraced(function* () {
            yield* migrateLegalPositionTables();
            const repository = yield* LegalPositionRecordRepository;

            const recorded = yield* appendOpposedPositionInDependencyOrder(repository, 1, 1);
            const other = yield* appendOpposedPositionInDependencyOrder(repository, 2, 1);

            const frames = yield* repository.listFrames(tenant(1));
            const exercises = yield* repository.listExercises(underFrame(recorded.frame.id, 1));
            const corrections = yield* repository.listCorrections(underFrame(recorded.frame.id, 1));
            const relators = yield* repository.listRelators(tenant(1));
            const candidates = yield* repository.listOppositionCandidates(tenant(1));

            expect(ids(frames), "the read matches the database-assigned ids the append returned").toEqual([
              recorded.frame.id,
              other.frame.id,
            ]);
            expect(
              ids(exercises),
              "in-process lane with btree_gist registered: the socket lane cannot load that migration"
            ).toEqual([recorded.exercise.id]);
            expect(ids(corrections)).toEqual([recorded.correction.id]);
            expect(ids(relators)).toEqual([
              recorded.privilege.id,
              recorded.claim.id,
              other.privilege.id,
              other.claim.id,
            ]);
            expect(ids(candidates)).toEqual([recorded.candidate.id, other.candidate.id]);

            const listExercises7 = yield* repository.listExercises(underFrame(other.frame.id, 1));
            expect(
              ids(listExercises7),
              "same tenant, other frame: only the frame term keeps the two positions apart"
            ).toEqual([other.exercise.id]);
            const listCorrections8 = yield* repository.listCorrections(underFrame(other.frame.id, 1));
            expect(
              ids(listCorrections8),
              "same tenant, other frame: only the frame term keeps the two positions apart"
            ).toEqual([other.correction.id]);

            expect(
              A.map(exercises, (exercise) => exercise.result.disposition.disposition),
              "after the jsonb round trip, an exercise that lost its disposition would launder authority"
            ).toEqual(["undetermined"]);
            expect(
              A.map(candidates, (candidate) => HashSet.size(candidate.candidate.relators)),
              "after the jsonb round trip, a candidate that lost half its pair would name nothing"
            ).toEqual([2, 2]);
            expect(A.map(frames, (frame) => HashSet.size(frame.derivationKind.kinds))).toEqual([2, 2]);
            expect(A.map(corrections, (correction) => correction.validatorReport.validator)).toEqual([
              "frame-slot-coverage",
            ]);
            const unorderedSetSortedForComparison = (relators: HashSet.HashSet<number>) =>
              A.sort(A.fromIterable(relators), Order.Number);
            expect(
              A.map(candidates, (candidate) => unorderedSetSortedForComparison(candidate.candidate.relators)),
              "each candidate still names the two stored relations appended alongside it"
            ).toEqual([
              A.sort([recorded.privilege.id, recorded.claim.id], Order.Number),
              A.sort([other.privilege.id, other.claim.id], Order.Number),
            ]);
          }),
          PgliteIntegrationTimeout
        );
      }
    );

    it.layer(makeLegalPositionRepositoryLayer(), { timeout: "5 minutes" })("tenant isolation in SQL", (it) => {
      it.effect(
        "never returns another organization's records for the same act and norm",
        Effect.fnUntraced(function* () {
          yield* migrateLegalPositionTables();
          const repository = yield* LegalPositionRecordRepository;

          const first = yield* appendOpposedPositionInDependencyOrder(repository, 1, 1);
          const foreign = yield* appendOpposedPositionInDependencyOrder(repository, 2, 2);
          const third = yield* appendOpposedPositionInDependencyOrder(repository, 3, 1);

          const tenantOneFrames = yield* repository.listFrames(tenant(1));
          const tenantOneCandidates = yield* repository.listOppositionCandidates(tenant(1));
          const tenantOneRelators = yield* repository.listRelators(tenant(1));

          expect(
            ids(tenantOneFrames),
            "interleaved appends: tenant 1 reads id ascending across the gap tenant 2 owns"
          ).toEqual([first.frame.id, third.frame.id]);
          expect(
            ids(tenantOneCandidates),
            "interleaved appends: tenant 1 reads id ascending across the gap tenant 2 owns"
          ).toEqual([first.candidate.id, third.candidate.id]);
          expect(orgIds(tenantOneFrames)).toEqual([1, 1]);
          expect(orgIds(tenantOneCandidates)).toEqual([1, 1]);
          expect(orgIds(tenantOneRelators)).toEqual([1, 1, 1, 1]);

          const listFrames9 = yield* repository.listFrames(tenant(2));
          expect(ids(listFrames9)).toEqual([foreign.frame.id]);
          const listFrames10 = yield* repository.listFrames(tenant(2));
          expect(orgIds(listFrames10)).toEqual([2]);
          const listOppositionCandidates11 = yield* repository.listOppositionCandidates(tenant(2));
          expect(orgIds(listOppositionCandidates11)).toEqual([2]);
          const listRelators12 = yield* repository.listRelators(tenant(2));
          expect(orgIds(listRelators12)).toEqual([2, 2]);

          const listExercises13 = yield* repository.listExercises(underFrame(foreign.frame.id, 1));
          expect(
            ids(listExercises13),
            "frame-keyed reads are tenant-scoped first: tenant 1 gets nothing for tenant 2's frame"
          ).toEqual([]);
          const listCorrections14 = yield* repository.listCorrections(underFrame(foreign.frame.id, 1));
          expect(
            ids(listCorrections14),
            "frame-keyed reads are tenant-scoped first: tenant 1 gets nothing for tenant 2's frame"
          ).toEqual([]);
          const listExercises15 = yield* repository.listExercises(underFrame(foreign.frame.id, 2));
          expect(ids(listExercises15)).toEqual([foreign.exercise.id]);
          const listCorrections16 = yield* repository.listCorrections(underFrame(foreign.frame.id, 2));
          expect(ids(listCorrections16)).toEqual([foreign.correction.id]);
        }),
        PgliteIntegrationTimeout
      );
    });

    it.layer(makeLegalPositionRepositoryLayer(), { timeout: "5 minutes" })("ordering reads of one scope", (it) => {
      it.effect(
        "returns each kind by id ascending when the highest id was appended first",
        Effect.fnUntraced(function* () {
          yield* migrateLegalPositionTables();
          const repository = yield* LegalPositionRecordRepository;

          yield* setNextRowId(101);
          const later = yield* appendOpposedPositionInDependencyOrder(repository, 1, 1);
          yield* setNextRowId(1);
          const earlier = yield* appendOpposedPositionInDependencyOrder(repository, 2, 1);

          expect(later.frame.id, "setup: without the rewind the appends land ascending and prove nothing").toBe(101);
          expect(earlier.frame.id, "setup: without the rewind the appends land ascending and prove nothing").toBe(1);

          yield* forceSequentialScans();

          const listFrames17 = yield* repository.listFrames(tenant(1));
          expect(
            ids(listFrames17),
            "with sequential scans forced, only ORDER BY id stands between the caller and heap order"
          ).toEqual([earlier.frame.id, later.frame.id]);
          const listOppositionCandidates18 = yield* repository.listOppositionCandidates(tenant(1));
          expect(ids(listOppositionCandidates18)).toEqual([earlier.candidate.id, later.candidate.id]);
          const listRelators19 = yield* repository.listRelators(tenant(1));
          expect(
            ids(listRelators19),
            "relator seeds sit a decade apart, since the public ids seeds derive are uniquely indexed"
          ).toEqual([earlier.privilege.id, earlier.claim.id, later.privilege.id, later.claim.id]);

          const listExercises20 = yield* repository.listExercises(underFrame(earlier.frame.id, 1));
          expect(
            ids(listExercises20),
            "each singleton frame keeps its own exercise before a multi-record frame is ordered"
          ).toEqual([earlier.exercise.id]);
          const listExercises21 = yield* repository.listExercises(underFrame(later.frame.id, 1));
          expect(
            ids(listExercises21),
            "each singleton frame keeps its own exercise before a multi-record frame is ordered"
          ).toEqual([later.exercise.id]);

          const frameFixture22 = yield* frameFixture(3, 1);
          const orderedFrame = yield* repository.recordFrame(frameFixture22);
          yield* setNextRowId(301);
          const exerciseFixture23 = yield* exerciseFixture(301, orderedFrame.id, 1);
          const highExercise = yield* repository.recordExercise(exerciseFixture23);
          const correctionFixture24 = yield* correctionFixture(301, orderedFrame.id, 1);
          const highCorrection = yield* repository.recordCorrection(correctionFixture24);
          yield* setNextRowId(201);
          const exerciseFixture25 = yield* exerciseFixture(201, orderedFrame.id, 1);
          const lowExercise = yield* repository.recordExercise(exerciseFixture25);
          const correctionFixture26 = yield* correctionFixture(201, orderedFrame.id, 1);
          const lowCorrection = yield* repository.recordCorrection(correctionFixture26);

          expect(highExercise.id).toBe(301);
          expect(lowExercise.id).toBe(201);
          expect(highCorrection.id).toBe(301);
          expect(lowCorrection.id).toBe(201);
          const listExercises27 = yield* repository.listExercises(underFrame(orderedFrame.id, 1));
          expect(ids(listExercises27)).toEqual([lowExercise.id, highExercise.id]);
          const listCorrections28 = yield* repository.listCorrections(underFrame(orderedFrame.id, 1));
          expect(ids(listCorrections28)).toEqual([lowCorrection.id, highCorrection.id]);
        }),
        PgliteIntegrationTimeout
      );
    });

    it.layer(makeLegalPositionRepositoryLayer(), { timeout: "5 minutes" })(
      "driver failures, on a database of their own because pglite rolls a failed session chain back",
      (it) => {
        it.effect(
          "reports an unreadable table as a typed repository failure naming that table",
          Effect.fnUntraced(function* () {
            const repository = yield* LegalPositionRecordRepository;

            const relators = yield* Effect.flip(repository.listRelators(tenant(1)));
            expect(
              relators.operation,
              "no migration ran, so a swallowed failure would read as nothing recorded rather than could not look"
            ).toBe("listRelators");
            expect(relators.reason).toContain("law_practice_legal_position_relator");

            const frames = yield* Effect.flip(repository.listFrames(tenant(1)));
            expect(frames.operation).toBe("listFrames");
            expect(frames.reason).toContain("law_practice_act_frame");

            const candidates = yield* Effect.flip(repository.listOppositionCandidates(tenant(1)));
            expect(candidates.operation).toBe("listOppositionCandidates");
            expect(candidates.reason).toContain("law_practice_legal_opposition_candidate");

            const exercises = yield* Effect.flip(repository.listExercises(underFrame(1, 1)));
            expect(exercises.operation).toBe("listExercises");
            expect(exercises.reason).toContain("law_practice_power_exercise");

            const corrections = yield* Effect.flip(repository.listCorrections(underFrame(1, 1)));
            expect(corrections.operation).toBe("listCorrections");
            expect(corrections.reason).toContain("law_practice_correction_delta");

            const frame = yield* frameFixture(1, 1);
            const appended = yield* Effect.flip(repository.recordFrame(frame));
            expect(appended.operation, "a write must never report success against a table it never reached").toBe(
              "recordFrame"
            );
            expect(appended.reason).toContain("law_practice_act_frame");
          }),
          PgliteIntegrationTimeout
        );
      }
    );
  });
}
