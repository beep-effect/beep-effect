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

import { fileURLToPath } from "node:url";
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
import * as HashSet from "effect/HashSet";
import * as O from "effect/Option";
import * as Order from "effect/Order";
import * as S from "effect/Schema";
import * as SqlClient from "effect/unstable/sql/SqlClient";
import type { LegalPositionRecordRepositoryShape } from "@beep/law-practice-use-cases/LegalPositionRecord";

const { shouldRunPgliteIntegration, pgliteIntegrationTimeoutMillis: PgliteIntegrationTimeout } =
  makePgliteIntegrationGate();
const migrationsFolder = fileURLToPath(new URL("../../../_internal/db-admin/drizzle", import.meta.url));

// The bundle contains `CREATE EXTENSION btree_gist` (the epistemic edge
// migration), which the shared external pglite-socket lane cannot load, so this
// proof is pinned to the in-process lane with the bundled extension registered.
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
  S.decodeUnknownEffect(ActFrame)({
    ...baseEntityFixtureInput(LawPractice.ActFrameId.entityType, seed),
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
  S.decodeUnknownEffect(PowerExercise)({
    ...baseEntityFixtureInput(LawPractice.PowerExerciseId.entityType, seed),
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
  S.decodeUnknownEffect(CorrectionDelta)({
    ...baseEntityFixtureInput(LawPractice.CorrectionDeltaId.entityType, seed),
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
  S.decodeUnknownEffect(LegalPositionRelator)({
    ...baseEntityFixtureInput(LawPractice.LegalPositionRelatorId.entityType, seed),
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
  S.decodeUnknownEffect(LegalOppositionCandidate)({
    ...baseEntityFixtureInput(LawPractice.LegalOppositionCandidateId.entityType, seed),
    orgId: org,
    candidate: { act: ACT, overlappingScope: scopeInput, relators },
    priorityBasis: null,
    verdictFamily: null,
  });

/**
 * Append one record of each of the five kinds under one tenant.
 *
 * Appended in dependency order — frame, then the exercise and correction citing
 * it, then the two relations citing that exercise, then the candidate naming
 * both relations — so every reference names a row the database already assigned
 * an id to rather than a fixture seed the converters discarded.
 *
 * The pair is a privilege against a claim over the same act: an opposition
 * worth recording, rather than two copies of one position.
 */
const appendPosition = Effect.fnUntraced(function* (
  repository: LegalPositionRecordRepositoryShape,
  seed: number,
  org: number
) {
  const frame = yield* repository.recordFrame(yield* frameFixture(seed, org));
  const exercise = yield* repository.recordExercise(yield* exerciseFixture(seed, frame.id, org));
  const correction = yield* repository.recordCorrection(yield* correctionFixture(seed, frame.id, org));
  // Two relations per position, so their seeds are spread by a decade rather
  // than by one: adjacent calls would otherwise share a seed, and the public id
  // a seed derives is uniquely indexed, so the second append would be rejected.
  const privilege = yield* repository.recordRelator(
    yield* relatorFixture(seed * 10, "privilege", "act", exercise.id, org)
  );
  const claim = yield* repository.recordRelator(
    yield* relatorFixture(seed * 10 + 1, "claim", "omission", exercise.id, org)
  );
  const candidate = yield* repository.recordOppositionCandidate(
    yield* candidateFixture(seed, [privilege.id, claim.id], org)
  );

  return { candidate, claim, correction, exercise, frame, privilege };
});

const legalPositionTableNames: ReadonlyArray<string> = [
  "law_practice_act_frame",
  "law_practice_correction_delta",
  "law_practice_legal_opposition_candidate",
  "law_practice_legal_position_relator",
  "law_practice_power_exercise",
];

/**
 * Rewind every legal position table's id sequence so the next append receives
 * `nextId`.
 *
 * Postgres hands a freshly-appended heap back in insertion order, so on a table
 * that only ever grows, append order and id order agree and an ordering
 * assertion proves nothing. Moving the sequence is what makes them disagree.
 */
const setNextRowId = Effect.fnUntraced(function* (nextId: number) {
  const sql = (yield* SqlClient.SqlClient).withoutTransforms();

  yield* Effect.forEach(
    legalPositionTableNames,
    (table) => sql`SELECT setval(pg_get_serial_sequence(${table}, 'id'), ${nextId}, false)`,
    { discard: true }
  );
});

/**
 * Make the planner read the heap directly for the rest of the session.
 *
 * A tenant filter served by an index that already hands rows back in id order
 * would leave the repository's `ORDER BY id ASC` unobservable, and an ordering
 * assertion could not fail. Forcing sequential scans is what makes the clause
 * the only thing standing between the caller and heap order.
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

const tenant = (org: number) => LegalPositionRecordScope.make({ orgId: Shared.OrganizationId.make(org) });

const underFrame = (frame: number, org: number) =>
  ActFrameRecordScope.make({ frame: LawPractice.ActFrameId.make(frame), orgId: Shared.OrganizationId.make(org) });

if (!shouldRunPgliteIntegration) {
  describe.skip("law-practice Drizzle legal position record repository PgLite integration", () => {});
} else {
  describe("law-practice Drizzle legal position record repository PgLite integration", { concurrent: false }, () => {
    layer(makeLegalPositionRepositoryLayer(), { timeout: "5 minutes" })(
      "appending and reading each record kind",
      (it) => {
        it.effect(
          "reads every appended kind back out of Postgres scoped to where it was recorded",
          Effect.fnUntraced(function* () {
            yield* migrateLegalPositionTables();
            const repository = yield* LegalPositionRecordRepository;

            const recorded = yield* appendPosition(repository, 1, 1);
            // A second position under the same tenant, citing its own frame: the
            // frame term is the only thing keeping the two apart below.
            const other = yield* appendPosition(repository, 2, 1);

            const frames = yield* repository.listFrames(tenant(1));
            const exercises = yield* repository.listExercises(underFrame(recorded.frame.id, 1));
            const corrections = yield* repository.listCorrections(underFrame(recorded.frame.id, 1));
            const relators = yield* repository.listRelators(tenant(1));
            const candidates = yield* repository.listOppositionCandidates(tenant(1));

            // The database, not the fixture, assigned these ids; the append
            // returned the stored row, so the read must match it exactly.
            expect(ids(frames)).toEqual([recorded.frame.id, other.frame.id]);
            expect(ids(exercises)).toEqual([recorded.exercise.id]);
            expect(ids(corrections)).toEqual([recorded.correction.id]);
            expect(ids(relators)).toEqual([
              recorded.privilege.id,
              recorded.claim.id,
              other.privilege.id,
              other.claim.id,
            ]);
            expect(ids(candidates)).toEqual([recorded.candidate.id, other.candidate.id]);

            // The frame-keyed reads never return the other frame's records.
            expect(ids(yield* repository.listExercises(underFrame(other.frame.id, 1)))).toEqual([other.exercise.id]);
            expect(ids(yield* repository.listCorrections(underFrame(other.frame.id, 1)))).toEqual([
              other.correction.id,
            ]);

            // Round-tripping the recorded surface, not just the row count: what
            // came back out of jsonb must still be the position that went in. An
            // exercise that lost its disposition would be authority laundering,
            // and a candidate that lost half its pair would name nothing.
            expect(A.map(exercises, (exercise) => exercise.result.disposition.disposition)).toEqual(["undetermined"]);
            expect(A.map(candidates, (candidate) => HashSet.size(candidate.candidate.relators))).toEqual([2, 2]);
            expect(A.map(frames, (frame) => HashSet.size(frame.derivationKind.kinds))).toEqual([2, 2]);
            expect(A.map(corrections, (correction) => correction.validatorReport.validator)).toEqual([
              "frame-slot-coverage",
            ]);
            // Each candidate names exactly the two relations appended alongside
            // it, so the pair still resolves to stored rows after the jsonb round
            // trip. The set carries no order, so both sides are sorted.
            const pairOf = (relators: HashSet.HashSet<number>) => A.sort(A.fromIterable(relators), Order.Number);
            expect(A.map(candidates, (candidate) => pairOf(candidate.candidate.relators))).toEqual([
              A.sort([recorded.privilege.id, recorded.claim.id], Order.Number),
              A.sort([other.privilege.id, other.claim.id], Order.Number),
            ]);
          }),
          PgliteIntegrationTimeout
        );
      }
    );

    layer(makeLegalPositionRepositoryLayer(), { timeout: "5 minutes" })("tenant isolation in SQL", (it) => {
      it.effect(
        "never returns another organization's records for the same act and norm",
        Effect.fnUntraced(function* () {
          yield* migrateLegalPositionTables();
          const repository = yield* LegalPositionRecordRepository;

          // Interleaved so each tenant's rows are non-contiguous in every table.
          const first = yield* appendPosition(repository, 1, 1);
          const foreign = yield* appendPosition(repository, 2, 2);
          const third = yield* appendPosition(repository, 3, 1);

          const tenantOneFrames = yield* repository.listFrames(tenant(1));
          const tenantOneCandidates = yield* repository.listOppositionCandidates(tenant(1));
          const tenantOneRelators = yield* repository.listRelators(tenant(1));

          // Ordered by id ascending across a gap the other tenant owns.
          expect(ids(tenantOneFrames)).toEqual([first.frame.id, third.frame.id]);
          expect(ids(tenantOneCandidates)).toEqual([first.candidate.id, third.candidate.id]);
          expect(orgIds(tenantOneFrames)).toEqual([1, 1]);
          expect(orgIds(tenantOneCandidates)).toEqual([1, 1]);
          expect(orgIds(tenantOneRelators)).toEqual([1, 1, 1, 1]);

          expect(ids(yield* repository.listFrames(tenant(2)))).toEqual([foreign.frame.id]);
          expect(orgIds(yield* repository.listFrames(tenant(2)))).toEqual([2]);
          expect(orgIds(yield* repository.listOppositionCandidates(tenant(2)))).toEqual([2]);
          expect(orgIds(yield* repository.listRelators(tenant(2)))).toEqual([2, 2]);

          // The frame-keyed reads are tenant-scoped first: tenant 1 asking for
          // tenant 2's frame gets nothing rather than tenant 2's records.
          expect(ids(yield* repository.listExercises(underFrame(foreign.frame.id, 1)))).toEqual([]);
          expect(ids(yield* repository.listCorrections(underFrame(foreign.frame.id, 1)))).toEqual([]);
          expect(ids(yield* repository.listExercises(underFrame(foreign.frame.id, 2)))).toEqual([foreign.exercise.id]);
          expect(ids(yield* repository.listCorrections(underFrame(foreign.frame.id, 2)))).toEqual([
            foreign.correction.id,
          ]);
        }),
        PgliteIntegrationTimeout
      );
    });

    layer(makeLegalPositionRepositoryLayer(), { timeout: "5 minutes" })("ordering reads of one scope", (it) => {
      it.effect(
        "returns each kind by id ascending whatever order it was appended in",
        Effect.fnUntraced(function* () {
          yield* migrateLegalPositionTables();
          const repository = yield* LegalPositionRecordRepository;

          // Highest id appended first, so heap order and id order disagree.
          yield* setNextRowId(101);
          const later = yield* appendPosition(repository, 1, 1);
          yield* setNextRowId(1);
          const earlier = yield* appendPosition(repository, 2, 1);

          // The setup itself is asserted: without the rewind the two appends
          // would land in ascending order and prove nothing below.
          expect(later.frame.id).toBe(101);
          expect(earlier.frame.id).toBe(1);

          yield* forceSequentialScans();

          expect(ids(yield* repository.listFrames(tenant(1)))).toEqual([earlier.frame.id, later.frame.id]);
          expect(ids(yield* repository.listOppositionCandidates(tenant(1)))).toEqual([
            earlier.candidate.id,
            later.candidate.id,
          ]);
          expect(ids(yield* repository.listRelators(tenant(1)))).toEqual([
            earlier.privilege.id,
            earlier.claim.id,
            later.privilege.id,
            later.claim.id,
          ]);

          // The frame-keyed reads order within one frame the same way; each
          // frame here holds one exercise and one correction, so the ordering
          // that matters for them is the id the rewind assigned.
          expect(ids(yield* repository.listExercises(underFrame(earlier.frame.id, 1)))).toEqual([earlier.exercise.id]);
          expect(ids(yield* repository.listExercises(underFrame(later.frame.id, 1)))).toEqual([later.exercise.id]);
        }),
        PgliteIntegrationTimeout
      );
    });

    // Its own database: the reads below are expected to fail, and an implicit
    // transaction pglite host rolls the whole session chain back afterwards.
    layer(makeLegalPositionRepositoryLayer(), { timeout: "5 minutes" })("driver failures", (it) => {
      it.effect(
        "reports an unreadable table as a typed repository failure naming that table",
        Effect.fnUntraced(function* () {
          const repository = yield* LegalPositionRecordRepository;

          // Intentional failure: no migration has run in this database, so the
          // physical tables do not exist. A read that swallowed this would let a
          // caller treat "could not look" as "nothing recorded".
          const relators = yield* Effect.flip(repository.listRelators(tenant(1)));
          expect(relators.operation).toBe("listRelators");
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

          // The append side drops the same way: a write that reported success
          // against a table it never reached would be the worse failure.
          const frame = yield* frameFixture(1, 1);
          const appended = yield* Effect.flip(repository.recordFrame(frame));
          expect(appended.operation).toBe("recordFrame");
          expect(appended.reason).toContain("law_practice_act_frame");
        }),
        PgliteIntegrationTimeout
      );
    });
  });
}
