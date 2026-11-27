import * as NodeURL from "node:url";
import * as NodeUtil from "node:util";
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
import { it } from "@beep/test-runner";
import {
  makePgliteIntegrationGate,
  makePgliteSqlTestLayer,
  productEntityFixtureInput,
  TestDatabaseInfo,
} from "@beep/test-utils";
import { A } from "@beep/utils";
import { describe, expect } from "@effect/vitest";
import { btree_gist } from "@electric-sql/pglite/contrib/btree_gist";
import * as Effect from "effect/Effect";
import { pipe } from "effect/Function";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Order from "effect/Order";
import * as S from "effect/Schema";
import * as SqlClient from "effect/sql/SqlClient";

const decodeUnknownActFrame = S.decodeUnknownEffect(ActFrame);
const decodeUnknownCorrectionDelta = S.decodeUnknownEffect(CorrectionDelta);
const decodeUnknownLegalOppositionCandidate = S.decodeUnknownEffect(LegalOppositionCandidate);
const decodeUnknownLegalPositionRelator = S.decodeUnknownEffect(LegalPositionRelator);
const decodeUnknownPowerExercise = S.decodeUnknownEffect(PowerExercise);

const { shouldRunPgliteIntegration } = makePgliteIntegrationGate();
const migrationsFolder = NodeURL.fileURLToPath(new URL("../../drizzle", import.meta.url));

// decision: migration-proofs-run-in-process
const makeMigrationProofLayer = () =>
  Layer.fresh(makePgliteSqlTestLayer({ inProcess: { extensions: { btree_gist } }, mode: "in-process" }));

const legalPositionTableNames: ReadonlyArray<string> = [
  "law_practice_act_frame",
  "law_practice_correction_delta",
  "law_practice_legal_opposition_candidate",
  "law_practice_legal_position_relator",
  "law_practice_power_exercise",
];

const expectedConstraintNames: ReadonlyArray<string> = [
  "law_practice_act_frame_pkey",
  "law_practice_correction_delta_pkey",
  "law_practice_legal_opposition_candidate_pkey",
  "law_practice_legal_position_relator_pkey",
  "law_practice_power_exercise_pkey",
];

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

const PRIVILEGE_SEQUENCE_ID = 1;
const CLAIM_SEQUENCE_ID = 2;
const FRAME_SEQUENCE_ID = 1;
const EXERCISE_SEQUENCE_ID = 1;

const relatorInput = (
  id: number,
  positionKind: string,
  polarity: string,
  bearer: string,
  counterparty: string,
  bearerPlayer: number
) => ({
  ...productEntityFixtureInput("LawPracticeLegalPositionRelator", id),
  assertingInterpreter: { kind: "User", userId: 1 },
  bearer: roleInput(bearer, bearerPlayer),
  content: { description: ACT, polarity },
  counterparty: roleInput(counterparty, bearerPlayer === 1 ? 2 : 1),
  grounding: { foundingExercise: null, producingExercise: EXERCISE_SEQUENCE_ID },
  positionKind,
  scope: scopeInput,
  sourceNorm: NORM,
});

const frameInput = {
  ...productEntityFixtureInput("LawPracticeActFrame", 1),
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

const undeterminedExerciseInput = {
  ...productEntityFixtureInput("LawPracticePowerExercise", 1),
  attemptedAt: 1_700_000_000_000,
  authorityBasis: {
    claimedRole: roleInput("lessee", 1),
    exercisedPower: null,
    foundingExercise: null,
    sourceNorm: NORM,
  },
  frame: FRAME_SEQUENCE_ID,
  preconditionAssertions: [{ element: { label: "no-objection", part: "precondition" }, status: "asserted-met" }],
  result: {
    constitution: null,
    disposition: { basis: null, disposition: "undetermined", interpreter: systemPrincipal },
    permission: null,
  },
  slotAssignments: [{ player: 1, slot: { label: "lessee", part: "slot" } }],
};

const correctionInput = {
  ...productEntityFixtureInput("LawPracticeCorrectionDelta", 1),
  candidateRouting: "contradiction-candidate-input",
  correctedElements: [
    { element: { label: "no-objection", part: "precondition" }, source: norm("cl. 4.2", "within ten days") },
  ],
  frame: FRAME_SEQUENCE_ID,
  reviewer: systemPrincipal,
  reviewerAction: "undetermined",
  stage: "interpretation",
  supersedes: null,
  validatorReport: {
    findings: [{ element: { label: "lessee", part: "slot" }, message: "slot cites no clause", severity: "hard" }],
    validator: "frame-slot-coverage",
  },
};

const primaFacieOppositionInput = {
  ...productEntityFixtureInput("LawPracticeLegalOppositionCandidate", 1),
  candidate: { act: ACT, overlappingScope: scopeInput, relators: [PRIVILEGE_SEQUENCE_ID, CLAIM_SEQUENCE_ID] },
  priorityBasis: null,
  verdictFamily: null,
};

const sortedNames = (names: ReadonlyArray<string>): ReadonlyArray<string> => A.sort(names, Order.String);

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
    ),
    "only primary keys: any other constraint arrived without the migration that installs it"
  ).toEqual(expectedConstraintNames);
  expect(
    pipe(
      triggerRows,
      A.filter((row) => A.contains(legalPositionTableNames, row.relname)),
      A.map((row) => row.tgname),
      sortedNames
    ),
    "exact names guard all five tables, including the three no denial probe exercises"
  ).toEqual(expectedTriggerNames);

  const privilege = yield* decodeUnknownLegalPositionRelator(
    relatorInput(PRIVILEGE_SEQUENCE_ID, "privilege", "act", "lessee", "lessor", 1)
  );
  const claim = yield* decodeUnknownLegalPositionRelator(
    relatorInput(CLAIM_SEQUENCE_ID, "claim", "omission", "lessor", "lessee", 2)
  );
  const frame = yield* decodeUnknownActFrame(frameInput);
  const exercise = yield* decodeUnknownPowerExercise(undeterminedExerciseInput);
  const correction = yield* decodeUnknownCorrectionDelta(correctionInput);
  const candidate = yield* decodeUnknownLegalOppositionCandidate(primaFacieOppositionInput);

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

  const from1 = yield* db.select().from(LawPracticeDbSchema.legalPositionRelator);
  expect(from1).toHaveLength(2);
  const from2 = yield* db.select().from(LawPracticeDbSchema.actFrame);
  expect(from2).toHaveLength(1);
  const from3 = yield* db.select().from(LawPracticeDbSchema.powerExercise);
  expect(from3).toHaveLength(1);
  const from4 = yield* db.select().from(LawPracticeDbSchema.correctionDelta);
  expect(from4).toHaveLength(1);
  const from5 = yield* db.select().from(LawPracticeDbSchema.legalOppositionCandidate);
  expect(from5).toHaveLength(1);

  return sql;
});

if (!shouldRunPgliteIntegration) {
  describe.skip("db-admin law-practice-legal-position migration PgLite integration", () => {});
} else {
  describe("db-admin law-practice-legal-position migration PgLite integration", { concurrent: false }, () => {
    it.layer(makeMigrationProofLayer(), { timeout: "2 minutes" })((it) => {
      it.effect(
        "runs the law-practice-legal-position migration and rejects re-kinding a stored relation",
        Effect.fnUntraced(function* () {
          const sql = yield* migrateAndRecord();

          const mutation = yield* Effect.flip(sql`
            UPDATE law_practice_legal_position_relator SET position_kind = 'claim' WHERE id = ${PRIVILEGE_SEQUENCE_ID}
          `);

          expect(
            NodeUtil.inspect(mutation, { depth: 10 }),
            "editing position_kind in place is correlative drift; the edit runs last: PGlite rolls the session back after an intentional failure"
          ).toContain("append-only");
        }),
        120_000
      );
    });

    it.layer(makeMigrationProofLayer(), { timeout: "2 minutes" })((it) => {
      it.effect(
        "rejects deleting a recorded power exercise",
        Effect.fnUntraced(function* () {
          const sql = yield* migrateAndRecord();

          const mutation = yield* Effect.flip(sql`
            DELETE FROM law_practice_power_exercise WHERE id = ${EXERCISE_SEQUENCE_ID}
          `);

          expect(
            NodeUtil.inspect(mutation, { depth: 10 }),
            "deleting an undetermined attempt would erase the only trace of it"
          ).toContain("append-only");
        }),
        120_000
      );
    });
  });
}
