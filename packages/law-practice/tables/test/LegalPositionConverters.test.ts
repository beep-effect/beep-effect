import {
  ActFrame,
  CorrectionDelta,
  LegalOppositionCandidate,
  LegalPositionRelator,
  PowerExercise,
} from "@beep/law-practice-domain";
import { fromActFrameRow, toActFrameInsert } from "@beep/law-practice-tables/entities/ActFrame";
import { fromCorrectionDeltaRow, toCorrectionDeltaInsert } from "@beep/law-practice-tables/entities/CorrectionDelta";
import {
  fromLegalOppositionCandidateRow,
  toLegalOppositionCandidateInsert,
} from "@beep/law-practice-tables/entities/LegalOppositionCandidate";
import {
  fromLegalPositionRelatorRow,
  toLegalPositionRelatorInsert,
} from "@beep/law-practice-tables/entities/LegalPositionRelator";
import { fromPowerExerciseRow, toPowerExerciseInsert } from "@beep/law-practice-tables/entities/PowerExercise";
import * as LawPractice from "@beep/shared-domain/identity/LawPractice";
import { it } from "@beep/test-runner";
import { fcRuns, productEntityFixtureInput } from "@beep/test-utils";
import { describe, expect } from "@effect/vitest";
import { assertNone, assertSome, assertTrue } from "@effect/vitest/utils";
import * as Arbitrary from "effect/Arbitrary";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import { pipe } from "effect/Function";
import * as HashSet from "effect/HashSet";
import * as O from "effect/Option";
import * as Order from "effect/Order";
import * as R from "effect/Record";
import * as Result from "effect/Result";
import * as S from "effect/Schema";

const ROW_ID = 1;

const ACT = "enter the demised premises";
const NORM = { designation: "cl. 4.1" };
const systemPrincipal = { component: "Runtime", kind: "System" };
const StoredRow = S.fromJsonString(S.Unknown);
const serializeRow = S.encodeEffect(StoredRow);
const parseRow = S.decodeUnknownEffect(StoredRow);
const StoredScopeAxes = S.Struct({
  scope: S.Struct({ material: S.Array(S.String), territorial: S.Array(S.String) }),
});
const decodeStoredScopeAxes = S.decodeUnknownEffect(StoredScopeAxes);
const StoredRelatorPair = S.Struct({ candidate: S.Struct({ relators: S.Array(S.Finite) }) });
const decodeStoredRelatorPair = S.decodeUnknownEffect(StoredRelatorPair);
const StoredDerivationKinds = S.Struct({ derivationKind: S.Struct({ kinds: S.Array(S.String) }) });
const decodeStoredDerivationKinds = S.decodeUnknownEffect(StoredDerivationKinds);

const throughStorage = (row: unknown): Effect.Effect<unknown, S.SchemaError> =>
  Effect.flatMap(serializeRow(row), parseRow);

const norm = (designation: string, fragment: string | null) => ({ fragment, norm: { designation } });

const roleInput = (name: string, player: number) => ({
  admittedPlayerKinds: ["natural-person"],
  name,
  player,
  sourceNorm: NORM,
});

const scopeInput = {
  material: ["the demised premises", "the yard"],
  quantitative: ["unlimited"],
  subjective: ["the lessor"],
  temporal: ["the term of the lease"],
  territorial: ["US-CA", "US-NV"],
};

const relatorInput = {
  ...productEntityFixtureInput(LawPractice.LegalPositionRelatorId.entityType, ROW_ID),
  assertingInterpreter: { kind: "User", userId: 1 },
  bearer: roleInput("lessee", 1),
  content: { description: ACT, polarity: "act" },
  counterparty: roleInput("lessor", 2),
  grounding: { foundingExercise: null, producingExercise: 1 },
  positionKind: "privilege",
  scope: scopeInput,
  sourceNorm: NORM,
};

const slot = (label: string, kind: "actor" | "object" | "recipient") => ({
  kind,
  label,
  source: norm("cl. 4.1", "the lessee may"),
});

const transition = (label: string, kind: string, polarity: "act" | "omission") => ({
  bearer: "lessee",
  counterparty: "lessor",
  label,
  position: { content: { description: ACT, polarity }, kind },
  source: norm("cl. 5", null),
});

const actFrameInput = {
  ...productEntityFixtureInput(LawPractice.ActFrameId.entityType, ROW_ID),
  act: { description: "assign the lease", polarity: "act" },
  creates: [transition("assignee-claim", "claim", "omission")],
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
  terminates: [transition("assignor-claim", "claim", "omission")],
};

const powerExerciseInput = {
  ...productEntityFixtureInput(LawPractice.PowerExerciseId.entityType, ROW_ID),
  attemptedAt: 1_700_000_000_000,
  authorityBasis: {
    claimedRole: roleInput("lessee", 4),
    exercisedPower: null,
    foundingExercise: null,
    sourceNorm: NORM,
  },
  frame: 1,
  preconditionAssertions: [{ element: { label: "no-objection", part: "precondition" }, status: "asserted-met" }],
  result: {
    constitution: { basis: null, interpreter: systemPrincipal, outcome: "not-constituted" },
    disposition: { basis: null, disposition: "void", interpreter: systemPrincipal },
    permission: null,
  },
  slotAssignments: [{ player: 4, slot: { label: "lessee", part: "slot" } }],
};

const correctionDeltaInput = {
  ...productEntityFixtureInput(LawPractice.CorrectionDeltaId.entityType, ROW_ID),
  candidateRouting: "contradiction-candidate-input",
  correctedElements: [
    { element: { label: "no-objection", part: "precondition" }, source: norm("cl. 4.2", "within ten days") },
  ],
  frame: 1,
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
  ...productEntityFixtureInput(LawPractice.LegalOppositionCandidateId.entityType, ROW_ID),
  candidate: { act: ACT, overlappingScope: scopeInput, relators: [1, 2] },
  priorityBasis: {
    authority: null,
    forum: "N.D. Cal.",
    jurisdiction: null,
    party: 3,
    position: { content: { description: ACT, polarity: "act" }, kind: "privilege" },
    proofStandard: null,
    sourcePrecedence: "lease clause over the parties' course of dealing",
    specificity: null,
    time: null,
    viewpoint: null,
  },
  verdictFamily: { assignedBy: systemPrincipal, family: "principle-collision" },
};

const BASE_INSERT_KEYS: ReadonlyArray<string> = [
  "createdAt",
  "createdByPrincipal",
  "deletedAt",
  "deletedByPrincipal",
  "entityType",
  "orgId",
  "publicId",
  "rowVersion",
  "schemaVersion",
  "source",
  "updatedAt",
  "updatedByPrincipal",
];

const sortedKeys = (row: Readonly<Record<string, unknown>>): ReadonlyArray<string> => A.sort(R.keys(row), Order.String);

const expectedInsertKeys = (own: ReadonlyArray<string>): ReadonlyArray<string> =>
  A.sort(A.appendAll(BASE_INSERT_KEYS, own), Order.String);

const sameRelator = S.toEquivalence(LegalPositionRelator);
const sameFrame = S.toEquivalence(ActFrame);
const sameExercise = S.toEquivalence(PowerExercise);
const sameCorrection = S.toEquivalence(CorrectionDelta);
const sameCandidate = S.toEquivalence(LegalOppositionCandidate);

describe("LegalPositionRelator converters", () => {
  it.effect(
    "encodes a decoded relation into an insert that omits the database-assigned id",
    Effect.fnUntraced(function* () {
      const relator = yield* Effect.fromResult(fromLegalPositionRelatorRow(relatorInput));
      const insert = yield* Effect.fromResult(toLegalPositionRelatorInsert(relator));

      expect(sortedKeys(insert)).toEqual(
        expectedInsertKeys([
          "assertingInterpreter",
          "bearer",
          "content",
          "counterparty",
          "grounding",
          "positionKind",
          "scope",
          "sourceNorm",
        ])
      );
    })
  );

  it.effect(
    "round-trips the stored relation back out of the row shape",
    Effect.fnUntraced(function* () {
      const relator = yield* Effect.fromResult(fromLegalPositionRelatorRow(relatorInput));
      const insert = yield* Effect.fromResult(toLegalPositionRelatorInsert(relator));
      const returned = yield* Effect.fromResult(fromLegalPositionRelatorRow({ ...insert, id: ROW_ID }));

      expect(returned.positionKind).toBe("privilege");
      expect(returned.content.polarity).toBe("act");
      expect(returned.bearer.name).toBe("lessee");
      assertNone(returned.grounding.foundingExercise);
      expect(sameRelator(returned, relator)).toBe(true);
    })
  );

  it("rejects a row carrying no relation, and one missing its asserting interpreter", () => {
    const { assertingInterpreter: _assertingInterpreter, ...unattributed } = relatorInput;

    pipe(fromLegalPositionRelatorRow({}), Result.isFailure, assertTrue);
    pipe(fromLegalPositionRelatorRow(unattributed), Result.isFailure, assertTrue);
  });
});

describe("ActFrame converters", () => {
  it.effect(
    "encodes a decoded frame into an insert that omits the database-assigned id",
    Effect.fnUntraced(function* () {
      const frame = yield* Effect.fromResult(fromActFrameRow(actFrameInput));
      const insert = yield* Effect.fromResult(toActFrameInsert(frame));

      expect(sortedKeys(insert)).toEqual(
        expectedInsertKeys([
          "act",
          "creates",
          "derivationKind",
          "interpreter",
          "preconditions",
          "slots",
          "sourceNorm",
          "terminates",
        ])
      );
    })
  );

  it.effect(
    "round-trips the recorded reading back out of the row shape",
    Effect.fnUntraced(function* () {
      const frame = yield* Effect.fromResult(fromActFrameRow(actFrameInput));
      const insert = yield* Effect.fromResult(toActFrameInsert(frame));
      const returned = yield* Effect.fromResult(fromActFrameRow({ ...insert, id: ROW_ID }));

      expect(HashSet.has(returned.derivationKind.kinds, "create")).toBe(true);
      expect(
        HashSet.has(returned.derivationKind.kinds, "extinguish"),
        "create and extinguish at once survive the row trip; a three-way enum would drop one"
      ).toBe(true);
      expect(returned.preconditions[0]?.polarity).toBe("absent");
      expect(sameFrame(returned, frame)).toBe(true);
    })
  );

  it("rejects a row carrying no reading, and one whose frame names no actor slot", () => {
    const actorless = { ...actFrameInput, slots: [slot("lessor", "recipient")] };

    pipe(fromActFrameRow({}), Result.isFailure, assertTrue);
    pipe(fromActFrameRow(actorless), Result.isFailure, assertTrue);
  });
});

describe("PowerExercise converters", () => {
  it.effect(
    "encodes a decoded attempt into an insert that omits the database-assigned id",
    Effect.fnUntraced(function* () {
      const exercise = yield* Effect.fromResult(fromPowerExerciseRow(powerExerciseInput));
      const insert = yield* Effect.fromResult(toPowerExerciseInsert(exercise));

      expect(sortedKeys(insert)).toEqual(
        expectedInsertKeys([
          "attemptedAt",
          "authorityBasis",
          "frame",
          "preconditionAssertions",
          "result",
          "slotAssignments",
        ])
      );
    })
  );

  it.effect(
    "round-trips an attempt that took no effect, disposition and all",
    Effect.fnUntraced(function* () {
      const exercise = yield* Effect.fromResult(fromPowerExerciseRow(powerExerciseInput));
      const insert = yield* Effect.fromResult(toPowerExerciseInsert(exercise));
      const returned = yield* Effect.fromResult(fromPowerExerciseRow({ ...insert, id: ROW_ID }));

      expect(
        returned.result.disposition.disposition,
        "losing the disposition would let a renderer show an exercise without its standing"
      ).toBe("void");
      expect(O.getOrThrow(returned.result.constitution).outcome).toBe("not-constituted");
      assertNone(returned.result.permission);
      expect(sameExercise(returned, exercise)).toBe(true);
    })
  );

  it("rejects a row carrying no attempt, and one with no recorded result", () => {
    const { result: _result, ...resultless } = powerExerciseInput;

    pipe(fromPowerExerciseRow({}), Result.isFailure, assertTrue);
    pipe(fromPowerExerciseRow(resultless), Result.isFailure, assertTrue);
  });
});

describe("CorrectionDelta converters", () => {
  it.effect(
    "encodes a decoded correction into an insert that omits the database-assigned id",
    Effect.fnUntraced(function* () {
      const delta = yield* Effect.fromResult(fromCorrectionDeltaRow(correctionDeltaInput));
      const insert = yield* Effect.fromResult(toCorrectionDeltaInsert(delta));

      expect(sortedKeys(insert)).toEqual(
        expectedInsertKeys([
          "candidateRouting",
          "correctedElements",
          "frame",
          "reviewer",
          "reviewerAction",
          "stage",
          "supersedes",
          "validatorReport",
        ])
      );
    })
  );

  it.effect(
    "round-trips the appended correction back out of the row shape",
    Effect.fnUntraced(function* () {
      const delta = yield* Effect.fromResult(fromCorrectionDeltaRow(correctionDeltaInput));
      const insert = yield* Effect.fromResult(toCorrectionDeltaInsert(delta));
      const returned = yield* Effect.fromResult(fromCorrectionDeltaRow({ ...insert, id: ROW_ID }));

      expect(returned.candidateRouting).toBe("contradiction-candidate-input");
      expect(returned.reviewerAction).toBe("undetermined");
      expect(returned.validatorReport.findings[0]?.severity).toBe("hard");
      assertNone(returned.supersedes);
      expect(sameCorrection(returned, delta)).toBe(true);
    })
  );

  it("rejects a row carrying no correction, and one that touched no element", () => {
    const untargeted = { ...correctionDeltaInput, correctedElements: [] };

    pipe(fromCorrectionDeltaRow({}), Result.isFailure, assertTrue);
    pipe(fromCorrectionDeltaRow(untargeted), Result.isFailure, assertTrue);
  });
});

describe("LegalOppositionCandidate converters", () => {
  it.effect(
    "encodes a decoded candidate into an insert that omits the database-assigned id",
    Effect.fnUntraced(function* () {
      const candidate = yield* Effect.fromResult(fromLegalOppositionCandidateRow(candidateInput));
      const insert = yield* Effect.fromResult(toLegalOppositionCandidateInsert(candidate));

      expect(sortedKeys(insert)).toEqual(expectedInsertKeys(["candidate", "priorityBasis", "verdictFamily"]));
    })
  );

  it.effect(
    "round-trips the screened pair with its basis and assigned family",
    Effect.fnUntraced(function* () {
      const candidate = yield* Effect.fromResult(fromLegalOppositionCandidateRow(candidateInput));
      const insert = yield* Effect.fromResult(toLegalOppositionCandidateInsert(candidate));
      const returned = yield* Effect.fromResult(fromLegalOppositionCandidateRow({ ...insert, id: ROW_ID }));

      expect(HashSet.size(returned.candidate.relators)).toBe(2);
      assertSome(O.getOrThrow(returned.priorityBasis).forum, "N.D. Cal.");
      expect(O.getOrThrow(returned.verdictFamily).family).toBe("principle-collision");
      expect(sameCandidate(returned, candidate)).toBe(true);
    })
  );

  it.effect(
    "round-trips a candidate nobody has recorded a basis or a family for",
    Effect.fnUntraced(function* () {
      const unassigned = { ...candidateInput, priorityBasis: null, verdictFamily: null };
      const candidate = yield* Effect.fromResult(fromLegalOppositionCandidateRow(unassigned));
      const insert = yield* Effect.fromResult(toLegalOppositionCandidateInsert(candidate));
      const returned = yield* Effect.fromResult(fromLegalOppositionCandidateRow({ ...insert, id: ROW_ID }));

      assertNone(returned.priorityBasis);
      assertNone(returned.verdictFamily);
      expect(sameCandidate(returned, candidate)).toBe(true);
    })
  );

  it("rejects a row naming no pair, and one naming a single relation", () => {
    const single = { ...candidateInput, candidate: { ...candidateInput.candidate, relators: [1] } };

    pipe(fromLegalOppositionCandidateRow({}), Result.isFailure, assertTrue);
    pipe(fromLegalOppositionCandidateRow(single), Result.isFailure, assertTrue);
  });
});

describe("set-valued fields across the storage boundary", () => {
  it.effect(
    "stores every scope axis as a JSON array and reads it back as a HashSet",
    Effect.fnUntraced(function* () {
      const relator = yield* Effect.fromResult(fromLegalPositionRelatorRow(relatorInput));
      const insert = yield* Effect.fromResult(toLegalPositionRelatorInsert(relator));
      const stored = yield* throughStorage({ ...insert, id: ROW_ID });

      const { scope } = yield* decodeStoredScopeAxes(stored);

      expect(
        A.sort(scope.territorial, Order.String),
        'a bare S.HashSet field would store the tagged {"_id":"HashSet"} wrapper, not this array'
      ).toEqual(["US-CA", "US-NV"]);
      expect(A.sort(scope.material, Order.String)).toEqual(["the demised premises", "the yard"]);

      const returned = yield* Effect.fromResult(fromLegalPositionRelatorRow(stored));

      expect(HashSet.isHashSet(returned.scope.territorial)).toBe(true);
      expect(HashSet.has(returned.scope.territorial, "US-CA")).toBe(true);
      expect(HashSet.has(returned.scope.territorial, "US-NV")).toBe(true);
      expect(HashSet.size(returned.scope.material)).toBe(2);
      expect(
        HashSet.has(returned.bearer.admittedPlayerKinds, "natural-person"),
        "the array form survives inside a nested value object too"
      ).toBe(true);
      expect(sameRelator(returned, relator)).toBe(true);
    })
  );

  it.effect(
    "stores the screened pair as a JSON array, so no row shape can order it",
    Effect.fnUntraced(function* () {
      const candidate = yield* Effect.fromResult(fromLegalOppositionCandidateRow(candidateInput));
      const insert = yield* Effect.fromResult(toLegalOppositionCandidateInsert(candidate));
      const stored = yield* throughStorage({ ...insert, id: ROW_ID });

      const { candidate: storedCandidate } = yield* decodeStoredRelatorPair(stored);

      expect(A.sort(storedCandidate.relators, Order.Number)).toEqual([1, 2]);

      const returned = yield* Effect.fromResult(fromLegalOppositionCandidateRow(stored));

      expect(HashSet.size(returned.candidate.relators)).toBe(2);
      expect(sameCandidate(returned, candidate)).toBe(true);

      const reversed = { ...candidateInput, candidate: { ...candidateInput.candidate, relators: [2, 1] } };
      const other = yield* Effect.fromResult(fromLegalOppositionCandidateRow(reversed));

      expect(sameCandidate(other, candidate), "the column preserves membership, not recording order").toBe(true);
    })
  );

  it.effect(
    "stores the derivation kinds as a JSON array so an act can create and extinguish at once",
    Effect.fnUntraced(function* () {
      const frame = yield* Effect.fromResult(fromActFrameRow(actFrameInput));
      const insert = yield* Effect.fromResult(toActFrameInsert(frame));
      const stored = yield* throughStorage({ ...insert, id: ROW_ID });

      const { derivationKind } = yield* decodeStoredDerivationKinds(stored);

      expect(A.sort(derivationKind.kinds, Order.String)).toEqual(["create", "extinguish"]);

      const returned = yield* Effect.fromResult(fromActFrameRow(stored));

      expect(HashSet.isHashSet(returned.derivationKind.kinds)).toBe(true);
      expect(HashSet.size(returned.derivationKind.kinds)).toBe(2);
      expect(sameFrame(returned, frame)).toBe(true);
    })
  );
});

describe("converter round trips over the whole schema", () => {
  const assertConverterRoundTrips = <
    Schema extends S.Top & { readonly Type: { readonly id: number } },
    Insert extends object,
  >(
    schema: Schema,
    toInsert: (entity: Schema["Type"]) => Result.Result<Insert, S.SchemaError>,
    fromRow: (row: unknown) => Result.Result<Schema["Type"], S.SchemaError>,
    entity: Schema["Type"]
  ): void => {
    const equivalent = S.toEquivalence(schema);
    const insert = Result.getOrThrow(toInsert(entity));
    const returned = Result.getOrThrow(fromRow({ ...insert, id: entity.id }));
    expect(equivalent(returned, entity)).toBe(true);
  };

  it.prop(
    "round-trips arbitrary stored relations",
    { entity: Arbitrary.schema(LegalPositionRelator) },
    ({ entity }) => {
      assertConverterRoundTrips(
        LegalPositionRelator,
        toLegalPositionRelatorInsert,
        fromLegalPositionRelatorRow,
        entity
      );
    },
    { arbitrary: fcRuns(10) }
  );

  it.prop(
    "round-trips arbitrary recorded frames",
    { entity: Arbitrary.schema(ActFrame) },
    ({ entity }) => {
      assertConverterRoundTrips(ActFrame, toActFrameInsert, fromActFrameRow, entity);
    },
    { arbitrary: fcRuns(10) }
  );

  it.prop(
    "round-trips arbitrary attempted exercises",
    { entity: Arbitrary.schema(PowerExercise) },
    ({ entity }) => {
      assertConverterRoundTrips(PowerExercise, toPowerExerciseInsert, fromPowerExerciseRow, entity);
    },
    { arbitrary: fcRuns(10) }
  );

  it.prop(
    "round-trips arbitrary appended corrections",
    { entity: Arbitrary.schema(CorrectionDelta) },
    ({ entity }) => {
      assertConverterRoundTrips(CorrectionDelta, toCorrectionDeltaInsert, fromCorrectionDeltaRow, entity);
    },
    { arbitrary: fcRuns(10) }
  );

  it.prop(
    "round-trips arbitrary screened candidates",
    { entity: Arbitrary.schema(LegalOppositionCandidate) },
    ({ entity }) => {
      assertConverterRoundTrips(
        LegalOppositionCandidate,
        toLegalOppositionCandidateInsert,
        fromLegalOppositionCandidateRow,
        entity
      );
    },
    { arbitrary: fcRuns(10) }
  );
});
