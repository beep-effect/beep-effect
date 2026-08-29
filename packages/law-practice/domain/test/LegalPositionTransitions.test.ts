import {
  ActFrame,
  ActFrameElementRef,
  CorrectedElement,
  CorrectionDelta,
  ExerciseResult,
  LegalVerdictFamily,
  NormSourceReference,
  PositionTransition,
  PowerExercise,
  PriorityBasis,
  ValidatorReport,
} from "@beep/law-practice-domain";
import { assertSchemaArbitraryDecodesToSelf, productEntityFixtureInput } from "@beep/test-utils";
import { describe, expect, it } from "@effect/vitest";
import * as HashSet from "effect/HashSet";
import * as O from "effect/Option";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import { FastCheck as fc } from "effect/testing";

const assertSchemaEncodedRoundTrips = <Schema extends S.Codec<unknown>>(schema: Schema, numRuns = 10): void => {
  const arbitrary = S.toArbitrary(schema)(fc);
  const decode = S.decodeUnknownSync(schema);
  const encode = S.encodeSync(schema);
  const equivalent = S.toEquivalence(schema);

  fc.assert(
    fc.property(arbitrary, (value) => equivalent(decode(encode(value)), value)),
    { numRuns }
  );
};

const norm = (designation: string, fragment: string | null) => ({ fragment, norm: { designation } });

const slot = (label: string, kind: "actor" | "object" | "recipient") => ({
  kind,
  label,
  source: norm("cl. 4.1", "the lessee may"),
});

const position = (kind: string, polarity: "act" | "omission") => ({
  content: { description: "enter the demised premises", polarity },
  kind,
});

const transition = (label: string, kind: string, polarity: "act" | "omission") => ({
  bearer: "lessee",
  counterparty: "lessor",
  label,
  position: position(kind, polarity),
  source: norm("cl. 5", null),
});

const actFrameInput = (overrides: Record<string, unknown>) => ({
  ...productEntityFixtureInput("LawPracticeActFrame", 1),
  act: { description: "assign the lease", polarity: "act" },
  creates: [transition("assignee-claim", "claim", "omission")],
  derivationKind: { kinds: ["create", "extinguish"] },
  interpreter: { component: "Runtime", kind: "System" },
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
  ...overrides,
});

const systemPrincipal = { component: "Runtime", kind: "System" };

const powerExerciseInput = (result: Record<string, unknown>) => ({
  ...productEntityFixtureInput("LawPracticePowerExercise", 2),
  attemptedAt: 1_700_000_000_000,
  authorityBasis: {
    claimedRole: {
      admittedPlayerKinds: ["natural-person"],
      name: "lessee",
      player: 4,
      sourceNorm: { designation: "cl. 4.1" },
    },
    exercisedPower: null,
    foundingExercise: null,
    sourceNorm: { designation: "cl. 4.1" },
  },
  frame: 1,
  preconditionAssertions: [{ element: { label: "no-objection", part: "precondition" }, status: "asserted-met" }],
  result,
  slotAssignments: [{ player: 4, slot: { label: "lessee", part: "slot" } }],
});

const undisposed = {
  constitution: null,
  disposition: { basis: null, disposition: "undetermined", interpreter: systemPrincipal },
  permission: null,
};

const correctionDeltaInput = (overrides: Record<string, unknown>) => ({
  ...productEntityFixtureInput("LawPracticeCorrectionDelta", 3),
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
    findings: [
      { element: { label: "lessee", part: "slot" }, message: "slot cites no clause", severity: "hard" },
      { element: null, message: "consider naming the recipient", severity: "advisory" },
    ],
    validator: "frame-slot-coverage",
  },
  ...overrides,
});

const decodeActFrame = S.decodeUnknownResult(ActFrame);
const decodePowerExercise = S.decodeUnknownResult(PowerExercise);
const decodeCorrectionDelta = S.decodeUnknownResult(CorrectionDelta);

describe("act frame transitions", () => {
  it("records one act that both creates and extinguishes positions", () => {
    const frame = Result.getOrThrow(decodeActFrame(actFrameInput({})));

    expect(HashSet.has(frame.derivationKind.kinds, "create")).toBe(true);
    expect(HashSet.has(frame.derivationKind.kinds, "extinguish")).toBe(true);
    expect(frame.creates.length).toBe(1);
    expect(frame.terminates.length).toBe(1);
  });

  it("conditions an act on a fact being absent", () => {
    const frame = Result.getOrThrow(decodeActFrame(actFrameInput({})));

    expect(frame.preconditions[0]?.polarity).toBe("absent");
    expect(O.isNone(frame.preconditions[0]?.source.fragment ?? O.none())).toBe(true);
  });

  it("carries a source reference on every element rather than one per record", () => {
    const frame = Result.getOrThrow(decodeActFrame(actFrameInput({})));

    expect(frame.slots[0].source.norm.designation).toBe("cl. 4.1");
    expect(frame.preconditions[0]?.source.norm.designation).toBe("cl. 4.2");
    expect(frame.creates[0]?.source.norm.designation).toBe("cl. 5");
    expect(frame.sourceNorm.designation).toBe("cl. 4");
  });

  it("rejects a frame with no actor slot", () => {
    const rejected = decodeActFrame(actFrameInput({ slots: [slot("lessor", "recipient")] }));

    expect(Result.isFailure(rejected)).toBe(true);
  });

  it("rejects duplicate element labels within one part", () => {
    const rejected = decodeActFrame(actFrameInput({ slots: [slot("lessee", "actor"), slot("lessee", "recipient")] }));

    expect(Result.isFailure(rejected)).toBe(true);
  });

  it("rejects a frame that records no derivation kind", () => {
    const rejected = decodeActFrame(actFrameInput({ derivationKind: { kinds: [] } }));

    expect(Result.isFailure(rejected)).toBe(true);
  });
});

describe("power exercise results", () => {
  it("keeps an attempt with no power on the record with no position effect", () => {
    const exercise = Result.getOrThrow(
      decodePowerExercise(
        powerExerciseInput({
          constitution: { basis: null, interpreter: systemPrincipal, outcome: "not-constituted" },
          disposition: { basis: null, disposition: "void", interpreter: systemPrincipal },
          permission: null,
        })
      )
    );

    expect(O.getOrThrow(exercise.result.constitution).outcome).toBe("not-constituted");
    expect(exercise.result.disposition.disposition).toBe("void");
    expect(O.isNone(exercise.result.permission)).toBe(true);
  });

  it("records an effective act that also breached a duty, on two independent axes", () => {
    const exercise = Result.getOrThrow(
      decodePowerExercise(
        powerExerciseInput({
          constitution: { basis: null, interpreter: systemPrincipal, outcome: "constituted" },
          disposition: { basis: null, disposition: "effective", interpreter: systemPrincipal },
          permission: { basis: null, interpreter: systemPrincipal, status: "violative" },
        })
      )
    );

    expect(O.getOrThrow(exercise.result.constitution).outcome).toBe("constituted");
    expect(O.getOrThrow(exercise.result.permission).status).toBe("violative");
    expect(exercise.result.disposition.disposition).toBe("effective");
  });

  it("carries a disposition even when nobody has determined either axis", () => {
    const exercise = Result.getOrThrow(decodePowerExercise(powerExerciseInput(undisposed)));

    expect(exercise.result.disposition.disposition).toBe("undetermined");
    expect(O.isNone(exercise.result.constitution)).toBe(true);
    expect(O.isNone(exercise.result.permission)).toBe(true);
  });

  it("terminates the authority lineage at a norm-founded power", () => {
    const exercise = Result.getOrThrow(decodePowerExercise(powerExerciseInput(undisposed)));

    expect(O.isNone(exercise.authorityBasis.exercisedPower)).toBe(true);
    expect(O.isNone(exercise.authorityBasis.foundingExercise)).toBe(true);
    expect(exercise.authorityBasis.claimedRole.name).toBe("lessee");
  });
});

describe("correction deltas", () => {
  it("records findings at exactly two severities", () => {
    const delta = Result.getOrThrow(decodeCorrectionDelta(correctionDeltaInput({})));

    expect(delta.validatorReport.findings[0]?.severity).toBe("hard");
    expect(delta.validatorReport.findings[1]?.severity).toBe("advisory");
  });

  it("points at each corrected element rather than at the record's document", () => {
    const delta = Result.getOrThrow(decodeCorrectionDelta(correctionDeltaInput({})));

    expect(delta.correctedElements[0].element.part).toBe("precondition");
    expect(delta.correctedElements[0].source.norm.designation).toBe("cl. 4.2");
  });

  it("rejects a correction that touches no element", () => {
    const rejected = decodeCorrectionDelta(correctionDeltaInput({ correctedElements: [] }));

    expect(Result.isFailure(rejected)).toBe(true);
  });

  it("routes an unresolved difference into candidate inputs by default", () => {
    const Routing = S.Struct({ candidateRouting: CorrectionDelta.fields.candidateRouting });

    expect(Routing.make({}).candidateRouting).toBe("contradiction-candidate-input");
    expect(Routing.make({ candidateRouting: "resolved-no-candidate" }).candidateRouting).toBe("resolved-no-candidate");
  });

  it("keeps the reviewer action recordable as undetermined", () => {
    const delta = Result.getOrThrow(decodeCorrectionDelta(correctionDeltaInput({})));

    expect(delta.reviewerAction).toBe("undetermined");
    expect(delta.stage).toBe("interpretation");
  });
});

describe("priority basis inputs", () => {
  it("records the arguments for priority without ordering them", () => {
    const basis = PriorityBasis.make({
      party: 3,
      position: { content: { description: "enter the land", polarity: "act" }, kind: "privilege" },
      sourcePrecedence: O.some("lease clause over the parties' course of dealing"),
    });

    expect(O.getOrThrow(basis.sourcePrecedence)).toBe("lease clause over the parties' course of dealing");
    expect(O.isNone(basis.specificity)).toBe(true);
    expect(O.isNone(basis.forum)).toBe(true);
    expect(O.isNone(basis.proofStandard)).toBe(true);
    expect(O.isNone(basis.viewpoint)).toBe(true);
  });

  it("carries the four legal verdict families as law-side vocabulary", () => {
    expect(LegalVerdictFamily.is["rule-conflict"]("rule-conflict")).toBe(true);
    expect(LegalVerdictFamily.is["principle-collision"]("principle-collision")).toBe(true);
    expect(LegalVerdictFamily.is["interpretation-dispute"]("interpretation-dispute")).toBe(true);
    expect(LegalVerdictFamily.is["factual-dispute"]("factual-dispute")).toBe(true);
    expect(S.is(LegalVerdictFamily)("rejected")).toBe(false);
  });

  it("addresses a frame element by part and label", () => {
    const pointer = ActFrameElementRef.make({ label: "no-objection", part: "precondition" });

    expect(pointer.part).toBe("precondition");
    expect(S.is(ActFrameElementRef)({ label: "no-objection", part: "clause" })).toBe(false);
  });
});

describe("transition value schemas", () => {
  it("round-trips every generated transition value through its encoded form", () => {
    for (const schema of [
      ActFrameElementRef,
      CorrectedElement,
      ExerciseResult,
      NormSourceReference,
      PositionTransition,
      PriorityBasis,
      ValidatorReport,
    ]) {
      assertSchemaEncodedRoundTrips(schema, 10);
    }
  });

  it("decodes every generated element pointer to itself", () => {
    assertSchemaArbitraryDecodesToSelf(ActFrameElementRef, { numRuns: 10 });
  });
});
