/**
 * Proof for the five legal position row converters.
 *
 * Each entity is proved through one closed loop: a valid row decodes into the
 * entity, the entity encodes into an insert that omits the database-assigned
 * `id`, and putting an id back onto that insert decodes into an equivalent
 * entity. The loop is what makes the converters trustworthy as a pair — a
 * dropped column or an asymmetric codec breaks the return leg even when each
 * direction looks fine on its own.
 *
 * These are the repo's first persisted entities carrying set-valued fields, so
 * one suite is about nothing else. `effect/Schema`'s `HashSet` encodes a set to
 * a tagged `{"_id":"HashSet","values":[...]}` wrapper and refuses to decode
 * either that wrapper or a plain array, which makes a jsonb round trip fail in
 * both directions; `HashSet` from `@beep/schema` encodes to a plain array and
 * decodes one back. The suite asserts the stored shape is a real JSON array and
 * that what comes back out is a real `HashSet`, because a converter that only
 * asserted equality would pass under either schema.
 */

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
import { productEntityFixtureInput } from "@beep/test-utils";
import { describe, expect, it } from "@effect/vitest";
import { Effect, Order, Result } from "effect";
import * as A from "effect/Array";
import * as HashSet from "effect/HashSet";
import * as O from "effect/Option";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import { FastCheck as fc } from "effect/testing";

// The id every fixture carries. Reattaching exactly this one to an insert is
// what lets the return leg be compared to the entity the loop started from.
const ROW_ID = 1;

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

// The audit envelope every law-practice entity carries, with `id` deliberately
// absent: the insert defers to the table sequence, so the database assigns it.
const BASE_INSERT_KEYS: ReadonlyArray<string> = [
  "createdAt",
  "createdByPrincipal",
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

// Schema equivalence rather than a structural compare: the entities carry
// `Option`, `HashSet`, and branded fields whose identity is the schema's to
// decide.
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
      expect(O.isNone(returned.grounding.foundingExercise)).toBe(true);
      expect(sameRelator(returned, relator)).toBe(true);
    })
  );

  it("rejects a row carrying no relation, and one missing its asserting interpreter", () => {
    const { assertingInterpreter: _assertingInterpreter, ...unattributed } = relatorInput;

    expect(Result.isFailure(fromLegalPositionRelatorRow({}))).toBe(true);
    // A relation with no attributed interpreter is the dangerous near-miss:
    // every audit column is present, so only the entity schema can refuse it.
    expect(Result.isFailure(fromLegalPositionRelatorRow(unattributed))).toBe(true);
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

      // The simultaneous create-and-extinguish is what a three-way enum would
      // have thrown away, so it is asserted through the row trip specifically.
      expect(HashSet.has(returned.derivationKind.kinds, "create")).toBe(true);
      expect(HashSet.has(returned.derivationKind.kinds, "extinguish")).toBe(true);
      expect(returned.preconditions[0]?.polarity).toBe("absent");
      expect(sameFrame(returned, frame)).toBe(true);
    })
  );

  it("rejects a row carrying no reading, and one whose frame names no actor slot", () => {
    const actorless = { ...actFrameInput, slots: [slot("lessor", "recipient")] };

    expect(Result.isFailure(fromActFrameRow({}))).toBe(true);
    expect(Result.isFailure(fromActFrameRow(actorless))).toBe(true);
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

      // A row trip that lost the disposition would be authority laundering: a
      // renderer could then show an exercise without saying where it stands.
      expect(returned.result.disposition.disposition).toBe("void");
      expect(O.getOrThrow(returned.result.constitution).outcome).toBe("not-constituted");
      expect(O.isNone(returned.result.permission)).toBe(true);
      expect(sameExercise(returned, exercise)).toBe(true);
    })
  );

  it("rejects a row carrying no attempt, and one with no recorded result", () => {
    const { result: _result, ...resultless } = powerExerciseInput;

    expect(Result.isFailure(fromPowerExerciseRow({}))).toBe(true);
    expect(Result.isFailure(fromPowerExerciseRow(resultless))).toBe(true);
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
      expect(O.isNone(returned.supersedes)).toBe(true);
      expect(sameCorrection(returned, delta)).toBe(true);
    })
  );

  it("rejects a row carrying no correction, and one that touched no element", () => {
    const untargeted = { ...correctionDeltaInput, correctedElements: [] };

    expect(Result.isFailure(fromCorrectionDeltaRow({}))).toBe(true);
    expect(Result.isFailure(fromCorrectionDeltaRow(untargeted))).toBe(true);
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
      expect(O.getOrThrow(returned.priorityBasis).forum).toEqual(O.some("N.D. Cal."));
      // The family never travels without the attorney it belongs to.
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

      // Absence is the derivable fact — which candidates lack a family — so it
      // has to survive the row trip as absence rather than as a placeholder.
      expect(O.isNone(returned.priorityBasis)).toBe(true);
      expect(O.isNone(returned.verdictFamily)).toBe(true);
      expect(sameCandidate(returned, candidate)).toBe(true);
    })
  );

  it("rejects a row naming no pair, and one naming a single relation", () => {
    const single = { ...candidateInput, candidate: { ...candidateInput.candidate, relators: [1] } };

    expect(Result.isFailure(fromLegalOppositionCandidateRow({}))).toBe(true);
    expect(Result.isFailure(fromLegalOppositionCandidateRow(single))).toBe(true);
  });
});

describe("set-valued fields across the storage boundary", () => {
  // The trip a jsonb column actually puts a row through: the insert is
  // serialized to JSON text and parsed back before it is decoded. Doing it
  // through `S.UnknownFromJsonString` rather than by hand keeps the proof on the
  // repo's schema APIs, and it is where the tagged `{"_id":"HashSet"}` form
  // would show up if a set-valued field were declared with `S.HashSet`.
  const StoredRow = S.fromJsonString(S.Unknown);
  const serializeRow = S.encodeEffect(StoredRow);
  const parseRow = S.decodeUnknownEffect(StoredRow);

  const throughStorage = (row: unknown): Effect.Effect<unknown, S.SchemaError> =>
    Effect.flatMap(serializeRow(row), parseRow);

  const StoredScopeAxes = S.Struct({
    scope: S.Struct({ material: S.Array(S.String), territorial: S.Array(S.String) }),
  });
  const StoredRelatorPair = S.Struct({ candidate: S.Struct({ relators: S.Array(S.Finite) }) });
  const StoredDerivationKinds = S.Struct({ derivationKind: S.Struct({ kinds: S.Array(S.String) }) });

  it.effect(
    "stores every scope axis as a JSON array and reads it back as a HashSet",
    Effect.fnUntraced(function* () {
      const relator = yield* Effect.fromResult(fromLegalPositionRelatorRow(relatorInput));
      const insert = yield* Effect.fromResult(toLegalPositionRelatorInsert(relator));
      const stored = yield* throughStorage({ ...insert, id: ROW_ID });

      // Decoding the stored value as arrays is the assertion: a set that had
      // been written as a HashSet would not be one.
      const { scope } = yield* S.decodeUnknownEffect(StoredScopeAxes)(stored);

      expect(A.sort(scope.territorial, Order.String)).toEqual(["US-CA", "US-NV"]);
      expect(A.sort(scope.material, Order.String)).toEqual(["the demised premises", "the yard"]);

      const returned = yield* Effect.fromResult(fromLegalPositionRelatorRow(stored));

      expect(HashSet.isHashSet(returned.scope.territorial)).toBe(true);
      expect(HashSet.has(returned.scope.territorial, "US-CA")).toBe(true);
      expect(HashSet.has(returned.scope.territorial, "US-NV")).toBe(true);
      expect(HashSet.size(returned.scope.material)).toBe(2);
      // The role's admitted player kinds are a set nested one level deeper, so
      // they prove the array form survives inside a nested value object too.
      expect(HashSet.has(returned.bearer.admittedPlayerKinds, "natural-person")).toBe(true);
      expect(sameRelator(returned, relator)).toBe(true);
    })
  );

  it.effect(
    "stores the screened pair as a JSON array, so no row shape can order it",
    Effect.fnUntraced(function* () {
      const candidate = yield* Effect.fromResult(fromLegalOppositionCandidateRow(candidateInput));
      const insert = yield* Effect.fromResult(toLegalOppositionCandidateInsert(candidate));
      const stored = yield* throughStorage({ ...insert, id: ROW_ID });

      const { candidate: storedCandidate } = yield* S.decodeUnknownEffect(StoredRelatorPair)(stored);

      expect(A.sort(storedCandidate.relators, Order.Number)).toEqual([1, 2]);

      const returned = yield* Effect.fromResult(fromLegalOppositionCandidateRow(stored));

      expect(HashSet.size(returned.candidate.relators)).toBe(2);
      expect(sameCandidate(returned, candidate)).toBe(true);

      // Recorded in the other order, the pair is still the same set: the column
      // preserves membership, and membership is all a candidate ever claims.
      const reversed = { ...candidateInput, candidate: { ...candidateInput.candidate, relators: [2, 1] } };
      const other = yield* Effect.fromResult(fromLegalOppositionCandidateRow(reversed));

      expect(sameCandidate(other, candidate)).toBe(true);
    })
  );

  it.effect(
    "stores the derivation kinds as a JSON array so an act can create and extinguish at once",
    Effect.fnUntraced(function* () {
      const frame = yield* Effect.fromResult(fromActFrameRow(actFrameInput));
      const insert = yield* Effect.fromResult(toActFrameInsert(frame));
      const stored = yield* throughStorage({ ...insert, id: ROW_ID });

      const { derivationKind } = yield* S.decodeUnknownEffect(StoredDerivationKinds)(stored);

      expect(A.sort(derivationKind.kinds, Order.String)).toEqual(["create", "extinguish"]);

      const returned = yield* Effect.fromResult(fromActFrameRow(stored));

      expect(HashSet.isHashSet(returned.derivationKind.kinds)).toBe(true);
      expect(HashSet.size(returned.derivationKind.kinds)).toBe(2);
      expect(sameFrame(returned, frame)).toBe(true);
    })
  );
});

describe("converter round trips over the whole schema", () => {
  /**
   * The example-based loops above prove the fields a reader cares about. This
   * proves the loop closes for values nobody thought to write down, which is
   * where an asymmetric codec on a rarely-populated field would otherwise hide.
   * The id is reattached from the entity because the converter drops it for the
   * table sequence to assign.
   */
  const assertConverterRoundTrips = <
    Schema extends S.Top & { readonly Type: { readonly id: number } },
    Insert extends object,
  >(
    schema: Schema,
    toInsert: (entity: Schema["Type"]) => Result.Result<Insert, S.SchemaError>,
    fromRow: (row: unknown) => Result.Result<Schema["Type"], S.SchemaError>
  ): void => {
    const arbitrary = S.toArbitrary(schema)(fc);
    const equivalent = S.toEquivalence(schema);

    fc.assert(
      fc.property(arbitrary, (entity) => {
        const insert = Result.getOrThrow(toInsert(entity));
        const returned = Result.getOrThrow(fromRow({ ...insert, id: entity.id }));
        return equivalent(returned, entity);
      }),
      { numRuns: 10 }
    );
  };

  it("round-trips arbitrary stored relations", () => {
    assertConverterRoundTrips(LegalPositionRelator, toLegalPositionRelatorInsert, fromLegalPositionRelatorRow);
  });

  it("round-trips arbitrary recorded frames", () => {
    assertConverterRoundTrips(ActFrame, toActFrameInsert, fromActFrameRow);
  });

  it("round-trips arbitrary attempted exercises", () => {
    assertConverterRoundTrips(PowerExercise, toPowerExerciseInsert, fromPowerExerciseRow);
  });

  it("round-trips arbitrary appended corrections", () => {
    assertConverterRoundTrips(CorrectionDelta, toCorrectionDeltaInsert, fromCorrectionDeltaRow);
  });

  it("round-trips arbitrary screened candidates", () => {
    assertConverterRoundTrips(
      LegalOppositionCandidate,
      toLegalOppositionCandidateInsert,
      fromLegalOppositionCandidateRow
    );
  });
});
