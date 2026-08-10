import { fileURLToPath } from "node:url";
import { inspect } from "node:util";
import {
  ActFrame,
  CorrectionDelta,
  LegalOppositionCandidate,
  LegalPositionRelator,
  PowerExercise,
} from "@beep/law-practice-domain";
import { DbSchema as LawPracticeDbSchema } from "@beep/law-practice-tables";
import { toActFrameInsert } from "@beep/law-practice-tables/entities/ActFrame";
import { toCorrectionDeltaInsert } from "@beep/law-practice-tables/entities/CorrectionDelta";
import { toLegalOppositionCandidateInsert } from "@beep/law-practice-tables/entities/LegalOppositionCandidate";
import { toLegalPositionRelatorInsert } from "@beep/law-practice-tables/entities/LegalPositionRelator";
import { toPowerExerciseInsert } from "@beep/law-practice-tables/entities/PowerExercise";
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
import * as SqlClient from "effect/unstable/sql/SqlClient";

const { shouldRunPgliteIntegration } = makePgliteIntegrationGate();
const migrationsFolder = fileURLToPath(new URL("../../drizzle", import.meta.url));

// The drizzle folder contains `CREATE EXTENSION btree_gist` (the epistemic edge
// migration), which the shared external pglite-socket lane cannot load, so this
// proof is pinned to the in-process lane like its epistemic and candor siblings.
const makeMigrationProofLayer = () =>
  Layer.fresh(makePgliteSqlTestLayer({ inProcess: { extensions: { btree_gist } }, mode: "in-process" }));

const legalPositionTableNames: ReadonlyArray<string> = [
  "law_practice_act_frame",
  "law_practice_correction_delta",
  "law_practice_legal_opposition_candidate",
  "law_practice_legal_position_relator",
  "law_practice_power_exercise",
];

// This migration adds no foreign key and no composite unique: the five tables
// carry only their primary key, so anything else appearing here is a schema
// change that arrived without a migration to install it.
const expectedConstraintNames: ReadonlyArray<string> = [
  "law_practice_act_frame_pkey",
  "law_practice_correction_delta_pkey",
  "law_practice_legal_opposition_candidate_pkey",
  "law_practice_legal_position_relator_pkey",
  "law_practice_power_exercise_pkey",
];

// These names are the append-only guarantee for all five tables, including the
// three whose denials no block below executes. A silent rename would leave those
// tables writable while this proof still passed, so they are asserted exactly.
const expectedTriggerNames: ReadonlyArray<string> = [
  "law_practice_act_frame_append_only",
  "law_practice_act_frame_block_truncate",
  "law_practice_correction_delta_append_only",
  "law_practice_correction_delta_block_truncate",
  "law_practice_legal_opposition_candidate_append_only",
  "law_practice_legal_opposition_candidate_block_truncate",
  "law_practice_legal_position_relator_append_only",
  "law_practice_legal_position_relator_block_truncate",
  "law_practice_power_exercise_append_only",
  "law_practice_power_exercise_block_truncate",
];

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

// The converters drop `id` so each insert takes the table's own sequence value:
// the two relations become 1 and 2, and every other table's single row becomes
// 1. The cross-table references below are written against those sequence values
// rather than the fixture seeds, so each recorded row names a row that exists.
const RELATOR_PRIVILEGE_ID = 1;
const RELATOR_CLAIM_ID = 2;
const FRAME_ID = 1;
const EXERCISE_ID = 1;

const relatorInput = (
  id: number,
  positionKind: string,
  polarity: string,
  bearer: string,
  counterparty: string,
  bearerPlayer: number
) => ({
  ...baseEntityFixtureInput("LawPracticeLegalPositionRelator", id),
  assertingInterpreter: { kind: "User", userId: 1 },
  bearer: roleInput(bearer, bearerPlayer),
  content: { description: ACT, polarity },
  counterparty: roleInput(counterparty, bearerPlayer === 1 ? 2 : 1),
  grounding: { foundingExercise: null, producingExercise: EXERCISE_ID },
  positionKind,
  scope: scopeInput,
  sourceNorm: NORM,
});

const frameInput = {
  ...baseEntityFixtureInput("LawPracticeActFrame", 1),
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
};

// An attempt whose disposition is `undetermined`: the row a deletion probe must
// fail against, because an attempt nobody has ruled on is exactly the record a
// party would most want gone.
const exerciseInput = {
  ...baseEntityFixtureInput("LawPracticePowerExercise", 1),
  attemptedAt: 1_700_000_000_000,
  authorityBasis: {
    claimedRole: roleInput("lessee", 1),
    exercisedPower: null,
    foundingExercise: null,
    sourceNorm: NORM,
  },
  frame: FRAME_ID,
  preconditionAssertions: [{ element: { label: "no-objection", part: "precondition" }, status: "asserted-met" }],
  result: {
    constitution: null,
    disposition: { basis: null, disposition: "undetermined", interpreter: systemPrincipal },
    permission: null,
  },
  slotAssignments: [{ player: 1, slot: { label: "lessee", part: "slot" } }],
};

const correctionInput = {
  ...baseEntityFixtureInput("LawPracticeCorrectionDelta", 1),
  candidateRouting: "contradiction-candidate-input",
  correctedElements: [
    { element: { label: "no-objection", part: "precondition" }, source: norm("cl. 4.2", "within ten days") },
  ],
  frame: FRAME_ID,
  reviewer: systemPrincipal,
  reviewerAction: "undetermined",
  stage: "interpretation",
  supersedes: null,
  validatorReport: {
    findings: [{ element: { label: "lessee", part: "slot" }, message: "slot cites no clause", severity: "hard" }],
    validator: "frame-slot-coverage",
  },
};

const candidateInput = {
  ...baseEntityFixtureInput("LawPracticeLegalOppositionCandidate", 1),
  candidate: { act: ACT, overlappingScope: scopeInput, relators: [RELATOR_PRIVILEGE_ID, RELATOR_CLAIM_ID] },
  priorityBasis: null,
  verdictFamily: null,
};

const sortedNames = (names: ReadonlyArray<string>): ReadonlyArray<string> => A.sort(names, Order.String);

/**
 * Apply the migration bundle, assert the legal-position tables carry the
 * constraints and triggers that make them append-only, and record one of each
 * entity through the schema-first converters so the generated columns are proven
 * to accept what the domain encodes. Two relations are recorded rather than one,
 * so the opposition candidate names a pair of rows that both exist. Returns the
 * raw sql client for the caller's denial probe.
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
      A.filter((row) => A.contains(legalPositionTableNames, row.relname)),
      A.map((row) => row.conname),
      sortedNames
    )
  ).toEqual(expectedConstraintNames);
  expect(
    pipe(
      triggerRows,
      A.filter((row) => A.contains(legalPositionTableNames, row.relname)),
      A.map((row) => row.tgname),
      sortedNames
    )
  ).toEqual(expectedTriggerNames);

  // A privilege to enter and a claim that the same act be omitted: the pair the
  // recorded candidate below screens as prima facie opposed. Screening it is a
  // record, never a finding, and neither row is the other's correlative.
  const privilege = yield* S.decodeUnknownEffect(LegalPositionRelator)(
    relatorInput(RELATOR_PRIVILEGE_ID, "privilege", "act", "lessee", "lessor", 1)
  );
  const claim = yield* S.decodeUnknownEffect(LegalPositionRelator)(
    relatorInput(RELATOR_CLAIM_ID, "claim", "omission", "lessor", "lessee", 2)
  );
  const frame = yield* S.decodeUnknownEffect(ActFrame)(frameInput);
  const exercise = yield* S.decodeUnknownEffect(PowerExercise)(exerciseInput);
  const correction = yield* S.decodeUnknownEffect(CorrectionDelta)(correctionInput);
  const candidate = yield* S.decodeUnknownEffect(LegalOppositionCandidate)(candidateInput);

  // The converters return `Result` because encoding is fallible; converting them
  // keeps a schema failure in the error channel instead of inserting defaults.
  const privilegeInsert = yield* Effect.fromResult(toLegalPositionRelatorInsert(privilege));
  const claimInsert = yield* Effect.fromResult(toLegalPositionRelatorInsert(claim));
  const frameInsert = yield* Effect.fromResult(toActFrameInsert(frame));
  const exerciseInsert = yield* Effect.fromResult(toPowerExerciseInsert(exercise));
  const correctionInsert = yield* Effect.fromResult(toCorrectionDeltaInsert(correction));
  const candidateInsert = yield* Effect.fromResult(toLegalOppositionCandidateInsert(candidate));

  yield* db.insert(LawPracticeDbSchema.legalPositionRelator).values(privilegeInsert);
  yield* db.insert(LawPracticeDbSchema.legalPositionRelator).values(claimInsert);
  yield* db.insert(LawPracticeDbSchema.actFrame).values(frameInsert);
  yield* db.insert(LawPracticeDbSchema.powerExercise).values(exerciseInsert);
  yield* db.insert(LawPracticeDbSchema.correctionDelta).values(correctionInsert);
  yield* db.insert(LawPracticeDbSchema.legalOppositionCandidate).values(candidateInsert);

  expect(yield* db.select().from(LawPracticeDbSchema.legalPositionRelator)).toHaveLength(2);
  expect(yield* db.select().from(LawPracticeDbSchema.actFrame)).toHaveLength(1);
  expect(yield* db.select().from(LawPracticeDbSchema.powerExercise)).toHaveLength(1);
  expect(yield* db.select().from(LawPracticeDbSchema.correctionDelta)).toHaveLength(1);
  expect(yield* db.select().from(LawPracticeDbSchema.legalOppositionCandidate)).toHaveLength(1);

  return sql;
});

if (!shouldRunPgliteIntegration) {
  describe.skip("db-admin law-practice-legal-position migration PgLite integration", () => {});
} else {
  describe("db-admin law-practice-legal-position migration PgLite integration", { concurrent: false }, () => {
    // Two fresh databases rather than two probes in one session: an implicit
    // transaction pglite host rolls the whole session chain back after an
    // intentional failure, so the UPDATE and DELETE denials cannot share one.
    // The two probes name different tables so two of the five triggers are
    // proven to fire rather than one; the other three rest on the exact-name
    // assertion above.
    layer(makeMigrationProofLayer(), { timeout: "2 minutes" })((it) => {
      it.effect(
        "runs the law-practice-legal-position migration and rejects re-kinding a stored relation",
        Effect.fnUntraced(function* () {
          const sql = yield* migrateAndRecord();

          // Keep the intentional failure last: editing `position_kind` in place
          // is correlative drift by another name — the stored relation would now
          // assert something its recorded grounding never supported.
          const mutation = yield* Effect.flip(sql`
            UPDATE law_practice_legal_position_relator SET position_kind = 'claim' WHERE id = ${RELATOR_PRIVILEGE_ID}
          `);

          expect(inspect(mutation, { depth: 10 })).toContain("append-only");
        }),
        120_000
      );
    });

    layer(makeMigrationProofLayer(), { timeout: "2 minutes" })((it) => {
      it.effect(
        "rejects deleting a recorded power exercise",
        Effect.fnUntraced(function* () {
          const sql = yield* migrateAndRecord();

          // An attempt still recorded as `undetermined` is the row whose removal
          // would leave no trace that anybody tried to exercise the power.
          const mutation = yield* Effect.flip(sql`
            DELETE FROM law_practice_power_exercise WHERE id = ${EXERCISE_ID}
          `);

          expect(inspect(mutation, { depth: 10 })).toContain("append-only");
        }),
        120_000
      );
    });
  });
}
