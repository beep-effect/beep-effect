/**
 * Competency-question acceptance fixtures for the legal position runtime.
 *
 * One recorded practice is seeded into an in-memory record store, and every
 * competency question is a single named test read against it. The store is the
 * point: FLINT's competency questions are executable *retrieval* contracts, so
 * a faithful port answers them through the repository port rather than over
 * local arrays.
 *
 * Two donors, two disciplines, and they are kept in their lanes. FLINT narrows
 * and UFO-L widens: the FLINT questions below are ported verbatim under the
 * Apache-2.0 notice, while the UFO-L questions are expressed in this runtime's
 * own terms from the citations in the goal's legal-theory lane, never copied.
 *
 * Where a question asks for a judgment — was the act valid, did the actor hold
 * the power, which position prevails — the fixture proves the runtime answers
 * with the recorded determination and its attribution, never with a computed
 * one. That is the never-compute boundary, exercised rather than asserted in
 * prose.
 *
 * Slice-isolated: the record layer and the policy layer both have no
 * dependencies, no other slice is booted, and no app runtime layer is used.
 */

/**
 * The FLINT competency-question identifiers and their question text are derived
 * from flint-ontology
 * (https://gitlab.com/normativesystems/knowledge-modeling/flint-ontology),
 * v1.0.0, `competency-questions/README.md` and `competency-questions/*.rq`.
 * Copyright 2022 TNO. Licensed under the Apache License, Version 2.0. See
 * THIRD_PARTY_NOTICES.md.
 *
 * Modified: the questions are re-expressed as TypeScript test names over this
 * project's Effect schemas rather than as SPARQL queries over a FLINT graph. No
 * query text was copied. The in-scope subset ported here is the act-frame
 * surface this project took from the donor; the rest of the donor's checked-in
 * queries address fact frames, functions, and slot correspondences this project
 * did not port, and they are enumerated below rather than silently dropped.
 */

import {
  ActFrame,
  AdvantagePositionKind,
  CorrectionDelta,
  correlativePosition,
  HohfeldPositionKind,
  LegalActPolarity,
  LegalOppositionCandidate,
  LegalPositionRelator,
  legalActContentEquivalence,
  oppositePosition,
  PotestativePositionKind,
  PowerExercise,
} from "@beep/law-practice-domain";
import { makeInMemoryLegalPositionRecordRepository } from "@beep/law-practice-server/LegalPositionRecord";
import {
  ActFrameRecordScope,
  LegalPositionRecordRepository,
  LegalPositionRecordScope,
} from "@beep/law-practice-use-cases/LegalPositionRecord";
import {
  LegalPositionRelatorPolicy,
  LegalPositionRelatorPolicyLive,
} from "@beep/law-practice-use-cases/LegalPositionRelatorPolicy";
import * as LawPractice from "@beep/shared-domain/identity/LawPractice";
import * as Shared from "@beep/shared-domain/identity/Shared";
import { productEntityFixtureInput } from "@beep/test-utils";
import { describe, expect, it, layer } from "@effect/vitest";
import { Effect, Equal, Layer } from "effect";
import * as A from "effect/Array";
import * as HashSet from "effect/HashSet";
import * as O from "effect/Option";
import * as Order from "effect/Order";
import * as S from "effect/Schema";

// ---------------------------------------------------------------------------
// The donor's competency-question inventory, transcribed
// ---------------------------------------------------------------------------

/**
 * The twenty-two questions the donor ships a checked-in query for. Every one of
 * them sits in the donor README's in-scope sections; the out-of-scope questions
 * ship no query at all, which is why the twenty-two *are* the donor's in-scope
 * executable set.
 */
const FLINT_CHECKED_IN_QUERIES = [
  "cq-act",
  "cq-act-action",
  "cq-act-actor",
  "cq-act-complex-fact",
  "cq-act-object",
  "cq-act-postcondition",
  "cq-act-precondition",
  "cq-act-recipient",
  "cq-atom-correspondence-complex-fact",
  "cq-atom-correspondence-postcondition-act",
  "cq-atom-correspondence-precondition-act",
  "cq-atom-creation",
  "cq-atom-degree",
  "cq-atom-roles",
  "cq-duty-claim",
  "cq-fact",
  "cq-fact-source",
  "cq-frame-source",
  "cq-frameset",
  "cq-function",
  "cq-function-datatype",
  "cq-operand",
] as const;

/** The subset this runtime answers, one named test each below. */
const PORTED_QUERIES = [
  "cq-act",
  "cq-act-action",
  "cq-act-actor",
  "cq-act-object",
  "cq-act-postcondition",
  "cq-act-precondition",
  "cq-act-recipient",
  "cq-atom-degree",
  "cq-atom-roles",
  "cq-duty-claim",
  "cq-frame-source",
] as const;

/**
 * The rest of the twenty-two, with the reason each stayed behind. None is a
 * defect in the shipped vocabulary: the fact-frame group needs a normative
 * state machine this project never took, the function group needs the donor's
 * expression *evaluation* that the goal excludes outright, and the
 * correspondence group needs a slot-correspondence value that is a named
 * follow-on rather than part of this rung.
 */
const NOT_PORTED_QUERIES = {
  "expression evaluation the goal excludes": [
    "cq-act-complex-fact",
    "cq-function",
    "cq-function-datatype",
    "cq-operand",
  ],
  "fact frames and the normative state machine": ["cq-atom-creation", "cq-fact", "cq-fact-source", "cq-frameset"],
  "slot correspondence, a named follow-on": [
    "cq-atom-correspondence-complex-fact",
    "cq-atom-correspondence-postcondition-act",
    "cq-atom-correspondence-precondition-act",
  ],
} as const;

/**
 * The donor's own out-of-scope sections, heading by heading. The donor states
 * that its models do not support answering these at all, so they are excluded
 * from porting by the donor's scope rather than by this project's preference —
 * and the position domain still models the orbits two of them name, because
 * that vocabulary comes from the other donor.
 */
const FLINT_OUT_OF_SCOPE = {
  "Duty violations": ["cq-duty-violation-conditions", "cq-duty-violation-consequences"],
  Events: ["cq-event-postcondition"],
  "Hohfeldian relations": ["cq-immunity-disability", "cq-liberty-noclaim"],
  Omissions: ["cq-act-omission", "cq-duty-omission"],
} as const;

const flatten = (grouped: Readonly<Record<string, ReadonlyArray<string>>>): ReadonlyArray<string> =>
  A.sort(
    A.flatMap(Object.values(grouped), (queries) => queries),
    Order.String
  );

// ---------------------------------------------------------------------------
// One recorded practice: a lease granted, a power exercised, a dispute screened
// ---------------------------------------------------------------------------

const ORG = 1;
const LESSOR = 1;
const LESSEE = 2;
const ASSIGNEE = 3;

const GRANT_FRAME = 100;
const ASSIGNMENT_FRAME = 101;
const GRANT_EXERCISE = 200;
const ASSIGNMENT_EXERCISE = 201;
const VOID_EXERCISE = 202;
const ORIGINAL_CLAIM = 1;
const POWER_TO_ASSIGN = 2;
const ASSIGNED_CLAIM = 3;
const PRIVILEGE_TO_ENTER = 11;
const CLAIM_TO_REFRAIN = 12;
const SCREENED_CANDIDATE = 401;
const FIRST_CORRECTION = 301;
const SECOND_CORRECTION = 302;

const GRANT = "grant the leasehold";
const ASSIGN = "assign the leasehold";
const DISTURB = "disturb possession of the leasehold";
const ENTER = "enter the demised premises";

const attorney = { kind: "User", userId: 7 };
const paralegal = { kind: "User", userId: 8 };

const norm = (designation: string, fragment: string | null) => ({ fragment, norm: { designation } });

const role = (name: string, player: number, designation: string) => ({
  admittedPlayerKinds: ["natural-person"],
  name,
  player,
  sourceNorm: { designation },
});

const slot = (label: string, kind: "actor" | "object" | "recipient", fragment: string | null, designation: string) => ({
  kind,
  label,
  source: norm(designation, fragment),
});

const transition = (label: string, bearer: string, counterparty: string) => ({
  bearer,
  counterparty,
  label,
  position: { content: { description: DISTURB, polarity: "omission" }, kind: "claim" },
  source: norm("cl. 5", "shall quietly enjoy"),
});

const LESSEE_SCOPE = {
  material: ["the demised premises", "the yard"],
  quantitative: ["unlimited"],
  subjective: ["the lessor", "the lessor's agents"],
  temporal: ["the term of the lease"],
  territorial: ["US-CA", "US-NV"],
};

const LESSOR_SCOPE = {
  material: ["the demised premises", "the cellar"],
  quantitative: ["unlimited"],
  subjective: ["the lessor", "the lessor's successors"],
  temporal: ["the term of the lease", "the holdover period"],
  territorial: ["US-CA"],
};

/** The per-axis intersection of the two scopes above, computed by hand. */
const OVERLAPPING_SCOPE = {
  material: ["the demised premises"],
  quantitative: ["unlimited"],
  subjective: ["the lessor"],
  temporal: ["the term of the lease"],
  territorial: ["US-CA"],
};

const frameInput = (id: number, overrides: Record<string, unknown>) => ({
  ...productEntityFixtureInput(LawPractice.ActFrameId.entityType, id),
  interpreter: attorney,
  orgId: ORG,
  preconditions: [],
  terminates: [],
  ...overrides,
});

/** The lease grant: one act, one position created, nobody's power cited. */
const GRANT_FRAME_INPUT = frameInput(GRANT_FRAME, {
  act: { description: GRANT, polarity: "act" },
  creates: [transition("lessee-quiet-enjoyment", "lessee", "lessor")],
  derivationKind: { kinds: ["create"] },
  slots: [slot("lessor", "actor", "the lessor demises", "cl. 1"), slot("lessee", "recipient", null, "cl. 1")],
  sourceNorm: { designation: "cl. 1" },
});

/**
 * The assignment: one act that creates and extinguishes at once, conditioned on
 * a fact being present and on another being absent.
 */
const ASSIGNMENT_FRAME_INPUT = frameInput(ASSIGNMENT_FRAME, {
  act: { description: ASSIGN, polarity: "act" },
  creates: [transition("assignee-quiet-enjoyment", "assignee", "lessor")],
  derivationKind: { kinds: ["create", "extinguish"] },
  preconditions: [
    {
      label: "notice-given",
      operativeFact: "the lessee has given the lessor written notice of the assignment",
      polarity: "present",
      source: norm("cl. 9.2", "upon written notice"),
    },
    {
      label: "no-prior-assignment",
      operativeFact: "the leasehold has already been assigned",
      polarity: "absent",
      source: norm("cl. 9.3", null),
    },
  ],
  slots: [
    slot("assignor", "actor", "the lessee may assign", "cl. 9.1"),
    slot("assignee", "recipient", null, "cl. 9.1"),
    slot("the leasehold", "object", null, "cl. 9.1"),
  ],
  sourceNorm: { designation: "cl. 9" },
  terminates: [transition("assignor-quiet-enjoyment", "assignor", "lessor")],
});

const exerciseInput = (id: number, frame: number, overrides: Record<string, unknown>) => ({
  ...productEntityFixtureInput(LawPractice.PowerExerciseId.entityType, id),
  attemptedAt: 1_700_000_000_000 + id,
  frame,
  orgId: ORG,
  preconditionAssertions: [],
  ...overrides,
});

/** Where every lineage in this practice terminates: a power resting on a norm. */
const GRANT_EXERCISE_INPUT = exerciseInput(GRANT_EXERCISE, GRANT_FRAME, {
  authorityBasis: {
    claimedRole: role("lessor", LESSOR, "cl. 1"),
    exercisedPower: null,
    foundingExercise: null,
    sourceNorm: { designation: "cl. 1" },
  },
  result: {
    constitution: { basis: null, interpreter: attorney, outcome: "constituted" },
    disposition: { basis: null, disposition: "effective", interpreter: attorney },
    permission: { basis: null, interpreter: attorney, status: "permitted" },
  },
  slotAssignments: [
    { player: LESSOR, slot: { label: "lessor", part: "slot" } },
    { player: LESSEE, slot: { label: "lessee", part: "slot" } },
  ],
});

/**
 * The effective wrong: within power and in breach of a covenant, both at once.
 * Only one of the frame's two conditions was addressed, so the other is
 * unaddressed by omission rather than by an assertion nobody made.
 */
const ASSIGNMENT_EXERCISE_INPUT = exerciseInput(ASSIGNMENT_EXERCISE, ASSIGNMENT_FRAME, {
  authorityBasis: {
    claimedRole: role("assignor", LESSEE, "cl. 9.1"),
    exercisedPower: POWER_TO_ASSIGN,
    foundingExercise: GRANT_EXERCISE,
    sourceNorm: { designation: "cl. 9.1" },
  },
  preconditionAssertions: [{ element: { label: "notice-given", part: "precondition" }, status: "asserted-met" }],
  result: {
    constitution: { basis: null, interpreter: attorney, outcome: "constituted" },
    disposition: { basis: null, disposition: "effective", interpreter: attorney },
    permission: {
      basis: "the covenant against assignment without consent",
      interpreter: attorney,
      status: "violative",
    },
  },
  slotAssignments: [
    { player: LESSEE, slot: { label: "assignor", part: "slot" } },
    { player: ASSIGNEE, slot: { label: "assignee", part: "slot" } },
  ],
});

/** The attempt that never constituted anything, kept on the record anyway. */
const VOID_EXERCISE_INPUT = exerciseInput(VOID_EXERCISE, ASSIGNMENT_FRAME, {
  authorityBasis: {
    claimedRole: role("assignor", LESSEE, "cl. 9.1"),
    exercisedPower: POWER_TO_ASSIGN,
    foundingExercise: GRANT_EXERCISE,
    sourceNorm: { designation: "cl. 9.1" },
  },
  preconditionAssertions: [
    { element: { label: "no-prior-assignment", part: "precondition" }, status: "asserted-unmet" },
  ],
  result: {
    constitution: {
      basis: "the leasehold had already been assigned",
      interpreter: attorney,
      outcome: "not-constituted",
    },
    disposition: { basis: null, disposition: "void", interpreter: attorney },
    permission: null,
  },
  slotAssignments: [{ player: LESSEE, slot: { label: "assignor", part: "slot" } }],
});

const relatorInput = (
  id: number,
  options: {
    readonly bearer: readonly [string, number];
    readonly counterparty: readonly [string, number];
    readonly description: string;
    readonly designation: string;
    readonly foundingExercise: number | null;
    readonly polarity: "act" | "omission";
    readonly positionKind: string;
    readonly producingExercise: number;
    readonly scope: typeof LESSEE_SCOPE;
  }
) => ({
  ...productEntityFixtureInput(LawPractice.LegalPositionRelatorId.entityType, id),
  assertingInterpreter: attorney,
  bearer: role(options.bearer[0], options.bearer[1], options.designation),
  content: { description: options.description, polarity: options.polarity },
  counterparty: role(options.counterparty[0], options.counterparty[1], options.designation),
  grounding: { foundingExercise: options.foundingExercise, producingExercise: options.producingExercise },
  orgId: ORG,
  positionKind: options.positionKind,
  scope: options.scope,
  sourceNorm: { designation: options.designation },
});

/** The lessee's claim to quiet enjoyment, founded by the grant. */
const ORIGINAL_CLAIM_INPUT = relatorInput(ORIGINAL_CLAIM, {
  bearer: ["lessee", LESSEE],
  counterparty: ["lessor", LESSOR],
  description: DISTURB,
  designation: "cl. 5",
  foundingExercise: null,
  polarity: "omission",
  positionKind: "claim",
  producingExercise: GRANT_EXERCISE,
  scope: LESSEE_SCOPE,
});

/** The potestative half of the same grant: the power the assignment cites. */
const POWER_TO_ASSIGN_INPUT = relatorInput(POWER_TO_ASSIGN, {
  bearer: ["lessee", LESSEE],
  counterparty: ["lessor", LESSOR],
  description: ASSIGN,
  designation: "cl. 9.1",
  foundingExercise: null,
  polarity: "act",
  positionKind: "power",
  producingExercise: GRANT_EXERCISE,
  scope: LESSEE_SCOPE,
});

/** The derived relation, whose lineage names both founding events. */
const ASSIGNED_CLAIM_INPUT = relatorInput(ASSIGNED_CLAIM, {
  bearer: ["assignee", ASSIGNEE],
  counterparty: ["lessor", LESSOR],
  description: DISTURB,
  designation: "cl. 5",
  foundingExercise: GRANT_EXERCISE,
  polarity: "omission",
  positionKind: "claim",
  producingExercise: ASSIGNMENT_EXERCISE,
  scope: LESSEE_SCOPE,
});

const PRIVILEGE_TO_ENTER_INPUT = relatorInput(PRIVILEGE_TO_ENTER, {
  bearer: ["lessee", LESSEE],
  counterparty: ["lessor", LESSOR],
  description: ENTER,
  designation: "cl. 4.1",
  foundingExercise: null,
  polarity: "act",
  positionKind: "privilege",
  producingExercise: GRANT_EXERCISE,
  scope: LESSEE_SCOPE,
});

const CLAIM_TO_REFRAIN_INPUT = relatorInput(CLAIM_TO_REFRAIN, {
  bearer: ["lessor", LESSOR],
  counterparty: ["lessee", LESSEE],
  description: ENTER,
  designation: "cl. 4.3",
  foundingExercise: null,
  polarity: "omission",
  positionKind: "claim",
  producingExercise: GRANT_EXERCISE,
  scope: LESSOR_SCOPE,
});

const SCREENED_CANDIDATE_INPUT = {
  ...productEntityFixtureInput(LawPractice.LegalOppositionCandidateId.entityType, SCREENED_CANDIDATE),
  candidate: {
    act: ENTER,
    overlappingScope: OVERLAPPING_SCOPE,
    relators: [PRIVILEGE_TO_ENTER, CLAIM_TO_REFRAIN],
  },
  orgId: ORG,
  priorityBasis: {
    authority: null,
    forum: "N.D. Cal.",
    jurisdiction: null,
    party: LESSEE,
    position: { content: { description: ENTER, polarity: "act" }, kind: "privilege" },
    proofStandard: null,
    sourcePrecedence: "the lease clause over the parties' course of dealing",
    specificity: null,
    time: null,
    viewpoint: null,
  },
  verdictFamily: null,
};

/**
 * The first reading of the condition, left routed as an unresolved candidate
 * input. The routing is written out because the field's default reaches the
 * constructor path and not the decode path, so a stored record always carries
 * the value rather than inheriting it.
 */
const FIRST_CORRECTION_INPUT = {
  ...productEntityFixtureInput(LawPractice.CorrectionDeltaId.entityType, FIRST_CORRECTION),
  candidateRouting: "contradiction-candidate-input",
  correctedElements: [
    {
      element: { label: "no-prior-assignment", part: "precondition" },
      source: norm("cl. 9.3", "has not previously assigned"),
    },
  ],
  frame: ASSIGNMENT_FRAME,
  orgId: ORG,
  reviewer: paralegal,
  reviewerAction: "undetermined",
  stage: "interpretation",
  supersedes: null,
  validatorReport: {
    findings: [
      {
        element: { label: "no-prior-assignment", part: "precondition" },
        message: "the condition cites a clause but no text fragment",
        severity: "hard",
      },
      {
        element: { label: "the leasehold", part: "slot" },
        message: "no transition names this slot",
        severity: "advisory",
      },
    ],
    validator: "frame-element-coverage",
  },
};

/** A second reading of the same clause, appended rather than written over. */
const SECOND_CORRECTION_INPUT = {
  ...productEntityFixtureInput(LawPractice.CorrectionDeltaId.entityType, SECOND_CORRECTION),
  candidateRouting: "resolved-no-candidate",
  correctedElements: [
    {
      element: { label: "no-prior-assignment", part: "precondition" },
      source: norm("cl. 9.3", "shall not have assigned, sublet or parted with possession"),
    },
  ],
  frame: ASSIGNMENT_FRAME,
  orgId: ORG,
  reviewer: attorney,
  reviewerAction: "amended",
  stage: "qualification",
  supersedes: FIRST_CORRECTION,
  validatorReport: { findings: [], validator: "frame-element-coverage" },
};

// ---------------------------------------------------------------------------
// Composition
// ---------------------------------------------------------------------------

const decodeCandidate = S.decodeUnknownEffect(LegalOppositionCandidate);
const decodeCorrection = S.decodeUnknownEffect(CorrectionDelta);
const decodeExercise = S.decodeUnknownEffect(PowerExercise);
const decodeFrame = S.decodeUnknownEffect(ActFrame);
const decodeRelator = S.decodeUnknownEffect(LegalPositionRelator);

const makeRecordedPractice = Effect.fnUntraced(function* () {
  const repository = yield* makeInMemoryLegalPositionRecordRepository();

  yield* repository.recordFrame(yield* decodeFrame(GRANT_FRAME_INPUT));
  yield* repository.recordFrame(yield* decodeFrame(ASSIGNMENT_FRAME_INPUT));
  yield* repository.recordExercise(yield* decodeExercise(GRANT_EXERCISE_INPUT));
  yield* repository.recordExercise(yield* decodeExercise(ASSIGNMENT_EXERCISE_INPUT));
  yield* repository.recordExercise(yield* decodeExercise(VOID_EXERCISE_INPUT));
  yield* repository.recordRelator(yield* decodeRelator(ORIGINAL_CLAIM_INPUT));
  yield* repository.recordRelator(yield* decodeRelator(POWER_TO_ASSIGN_INPUT));
  yield* repository.recordRelator(yield* decodeRelator(ASSIGNED_CLAIM_INPUT));
  yield* repository.recordRelator(yield* decodeRelator(PRIVILEGE_TO_ENTER_INPUT));
  yield* repository.recordRelator(yield* decodeRelator(CLAIM_TO_REFRAIN_INPUT));
  yield* repository.recordCorrection(yield* decodeCorrection(FIRST_CORRECTION_INPUT));
  yield* repository.recordCorrection(yield* decodeCorrection(SECOND_CORRECTION_INPUT));
  yield* repository.recordOppositionCandidate(yield* decodeCandidate(SCREENED_CANDIDATE_INPUT));

  return repository;
});

/**
 * The seeded practice plus the policy that derives views over it. Each
 * `layer(...)` block builds its own, so no block's reads can see another's.
 */
const RecordedPractice = Layer.mergeAll(
  Layer.effect(LegalPositionRecordRepository, makeRecordedPractice()),
  LegalPositionRelatorPolicyLive
);

const TENANT = LegalPositionRecordScope.make({ orgId: Shared.OrganizationId.make(ORG) });

const underFrame = (frame: number) =>
  ActFrameRecordScope.make({ frame: LawPractice.ActFrameId.make(frame), orgId: Shared.OrganizationId.make(ORG) });

const byId = <Entity extends { readonly id: number }>(records: ReadonlyArray<Entity>, id: number): Entity =>
  O.getOrThrow(A.findFirst(records, (record) => record.id === id));

/** Everything one competency question may read, in one call. */
const readPractice = Effect.fnUntraced(function* () {
  const repository = yield* LegalPositionRecordRepository;

  return {
    candidates: yield* repository.listOppositionCandidates(TENANT),
    corrections: yield* repository.listCorrections(underFrame(ASSIGNMENT_FRAME)),
    exercises: yield* repository.listExercises(underFrame(ASSIGNMENT_FRAME)),
    frames: yield* repository.listFrames(TENANT),
    policy: yield* LegalPositionRelatorPolicy,
    relators: yield* repository.listRelators(TENANT),
  };
});

// ---------------------------------------------------------------------------
// FLINT — the in-scope subset, ported with attribution
// ---------------------------------------------------------------------------

describe("FLINT competency queries — the in-scope subset this runtime answers", () => {
  layer(RecordedPractice)((it) => {
    it.effect(
      "cq-frame-source — Given a frame in an interpretation, which source passages motivate the inclusion of this frame in the interpretation?",
      Effect.fnUntraced(function* () {
        const { frames } = yield* readPractice();
        const frame = byId(frames, ASSIGNMENT_FRAME);

        // The frame cites its provision, and so does every element of it. The
        // donor registers a source reference per element rather than one per
        // frame, and that is the discipline the port keeps: one condition can
        // be disputed without reopening the rest of the reading.
        expect(frame.sourceNorm.designation).toBe("cl. 9");
        const elementNorms = [
          ...A.map(frame.slots, (element) => element.source.norm.designation),
          ...A.map(frame.preconditions, (element) => element.source.norm.designation),
          ...A.map(frame.creates, (element) => element.source.norm.designation),
          ...A.map(frame.terminates, (element) => element.source.norm.designation),
        ];
        expect(A.length(elementNorms)).toBe(
          A.length(frame.slots) + A.length(frame.preconditions) + A.length(frame.creates) + A.length(frame.terminates)
        );
        expect(A.length(elementNorms)).toBe(7);
        expect(A.every(elementNorms, (designation) => designation.length > 0)).toBe(true);
        expect(O.getOrThrow(frame.preconditions[0].source.fragment)).toBe("upon written notice");
      })
    );

    it.effect(
      "cq-act — Given an interpretation, what kinds of acts might agents exercise?",
      Effect.fnUntraced(function* () {
        const { frames } = yield* readPractice();

        expect(
          A.sort(
            A.map(frames, (frame) => frame.act.description),
            Order.String
          )
        ).toEqual([ASSIGN, GRANT]);
      })
    );

    it.effect(
      "cq-act-action — Given an act frame, what must be the case about the performance of an action associated with an instance of the act in order for that act to be valid?",
      Effect.fnUntraced(function* () {
        const { exercises, frames } = yield* readPractice();
        const frame = byId(frames, ASSIGNMENT_FRAME);

        // What the frame *states* is answerable: the action, its polarity, and
        // the conditions the interpreter read onto it.
        expect(frame.act.description).toBe(ASSIGN);
        expect(frame.act.polarity).toBe("act");
        expect(A.map(frame.preconditions, (condition) => condition.label)).toEqual([
          "notice-given",
          "no-prior-assignment",
        ]);

        // Validity itself is not. The donor's question ends in "in order for
        // that act to be valid", and the answer here is a determination some
        // named person made about one occasion, never a computed verdict.
        const exercise = byId(exercises, ASSIGNMENT_EXERCISE);
        expect(O.getOrThrow(exercise.result.constitution).outcome).toBe("constituted");
        expect(O.getOrThrow(exercise.result.constitution).interpreter).toEqual(attorney);
      })
    );

    it.effect(
      "cq-act-actor — Given an act frame, what must be the case about an actor performing an instance of the act in order for that act to be valid?",
      Effect.fnUntraced(function* () {
        const { frames } = yield* readPractice();
        const frame = byId(frames, ASSIGNMENT_FRAME);
        const actors = A.filter(frame.slots, (candidate) => candidate.kind === "actor");

        expect(A.map(actors, (candidate) => candidate.label)).toEqual(["assignor"]);
        // A frame with no actor slot is not admitted at all, so this question
        // can never come back empty for a recorded frame.
        expect(S.is(ActFrame.fields.slots)([])).toBe(false);
      })
    );

    it.effect(
      "cq-act-object — Given an act frame, what must be the case about an object undergoing an instance of the act in order for that act to be valid?",
      Effect.fnUntraced(function* () {
        const { frames } = yield* readPractice();
        const objects = A.filter(byId(frames, ASSIGNMENT_FRAME).slots, (candidate) => candidate.kind === "object");

        expect(A.map(objects, (candidate) => candidate.label)).toEqual(["the leasehold"]);
        // The grant names no object, which the donor also permits: the object
        // slot is available, not mandatory.
        expect(A.filter(byId(frames, GRANT_FRAME).slots, (candidate) => candidate.kind === "object")).toEqual([]);
      })
    );

    it.effect(
      "cq-act-recipient — Given an act frame, what must be the case about a recipient being affected by an instance of the act in order for that act to be valid?",
      Effect.fnUntraced(function* () {
        const { frames } = yield* readPractice();
        const recipients = A.filter(
          byId(frames, ASSIGNMENT_FRAME).slots,
          (candidate) => candidate.kind === "recipient"
        );

        expect(A.map(recipients, (candidate) => candidate.label)).toEqual(["assignee"]);
      })
    );

    it.effect(
      "cq-act-precondition — Given an act frame, what must be the case about the circumstances in which an instance of the act takes place in order for that act to be valid?",
      Effect.fnUntraced(function* () {
        const { frames } = yield* readPractice();
        const conditions = byId(frames, ASSIGNMENT_FRAME).preconditions;

        // A negative operative fact is a first-class condition rather than a
        // negation buried in the wording of a positive one. The donor cannot
        // state it in this shape, and inheriting that gap was declined.
        expect(A.map(conditions, (condition) => condition.polarity)).toEqual(["present", "absent"]);
        expect(conditions[1].operativeFact).toBe("the leasehold has already been assigned");
      })
    );

    it.effect(
      "cq-act-postcondition — Given an act frame, what must be the case about the circumstances after instances of the act have been exercised?",
      Effect.fnUntraced(function* () {
        const { exercises, frames } = yield* readPractice();
        const frame = byId(frames, ASSIGNMENT_FRAME);

        // One act, both directions, between the frame's own slot labels.
        expect(A.map(frame.creates, (moved) => moved.bearer)).toEqual(["assignee"]);
        expect(A.map(frame.terminates, (moved) => moved.bearer)).toEqual(["assignor"]);
        expect(frame.creates[0].position.kind).toBe("claim");

        // The occasion carries the outcome, because a standing position has
        // none and would need a placeholder to pretend otherwise.
        expect(byId(exercises, ASSIGNMENT_EXERCISE).result.disposition.disposition).toBe("effective");
      })
    );

    it.effect(
      "cq-duty-claim — Given an interpretation, what kinds of duties might agents hold?",
      Effect.fnUntraced(function* () {
        const { policy, relators } = yield* readPractice();

        // A duty is never stored. It is read off the counterparty end of a
        // stored claim, which is what keeps the store from ever holding a duty
        // whose claim was superseded out from under it.
        const stored = HashSet.fromIterable(A.map(relators, (relation) => relation.positionKind));
        expect(HashSet.has(stored, "claim")).toBe(true);
        expect(HashSet.has(HashSet.fromIterable(HohfeldPositionKind.Options), "duty")).toBe(true);
        expect(A.some(relators, (relation) => S.is(AdvantagePositionKind)(relation.positionKind))).toBe(true);

        const duties = A.map(
          A.filter(relators, (relation) => relation.positionKind === "claim"),
          (relation) => policy.correlativeView(relation)
        );
        expect(A.length(duties)).toBe(3);
        expect(A.every(duties, (view) => view.position.kind === "duty")).toBe(true);
        expect(A.map(duties, (view) => view.bearer.name)).toEqual(["lessor", "lessor", "lessee"]);
      })
    );

    it.effect(
      "cq-atom-degree — How many atoms might be involved in this frame? (What is the arity/degree/valency?)",
      Effect.fnUntraced(function* () {
        const { frames } = yield* readPractice();

        expect(A.length(byId(frames, ASSIGNMENT_FRAME).slots)).toBe(3);
        expect(A.length(byId(frames, GRANT_FRAME).slots)).toBe(2);
      })
    );

    it.effect(
      "cq-atom-roles — What is the name or short description of each of the available roles for atoms?",
      Effect.fnUntraced(function* () {
        const { frames } = yield* readPractice();

        expect(A.map(byId(frames, ASSIGNMENT_FRAME).slots, (place) => [place.label, place.kind])).toEqual([
          ["assignor", "actor"],
          ["assignee", "recipient"],
          ["the leasehold", "object"],
        ]);
      })
    );

    it.effect(
      "cq-power-liability — Given an interpretation, which kinds of power–liability relations are possible? (donor NOTE: limited support)",
      Effect.fnUntraced(function* () {
        const { policy, relators } = yield* readPractice();

        // The donor lists this in scope and then records that its ontology
        // barely supports it, because it models act frames instead of the
        // power–liability relation. This runtime takes the relation from the
        // other donor, so the question is answered from a stored record.
        const power = byId(relators, POWER_TO_ASSIGN);
        expect(power.positionKind).toBe("power");
        expect(policy.correlativeView(power).position.kind).toBe("liability");
        expect(policy.correlativeView(power).bearer.name).toBe("lessor");
        expect(
          Equal.equals(PotestativePositionKind.HashSet, HashSet.make("power", "liability", "immunity", "disability"))
        ).toBe(true);
      })
    );
  });
});

// ---------------------------------------------------------------------------
// UFO-L — the power-subjection questions, expressed in this runtime's terms
// ---------------------------------------------------------------------------

/**
 * The donor's competency-question table is cited and never copied. Each name
 * below is this project's own phrasing of the question the table asks, keyed to
 * the table's numbering so the source stays traceable; the numbering and the
 * fragments it is drawn from are recorded in the goal's legal-theory lane,
 * `explorations/legal-position-relator-runtime/research/02-position-relator-legal-frame.md`
 * §5.1. CQ1 and CQ7 are not reproduced anywhere on disk and are therefore
 * absent here rather than guessed at.
 */
describe("UFO-L power-subjection competency questions — expressed in this runtime's terms", () => {
  layer(RecordedPractice)((it) => {
    it.effect(
      "CQ2 — which norm-prescribed roles does each recorded relation hold between?",
      Effect.fnUntraced(function* () {
        const { relators } = yield* readPractice();
        const assigned = byId(relators, ASSIGNED_CLAIM);

        expect([assigned.bearer.name, assigned.counterparty.name]).toEqual(["assignee", "lessor"]);
        // A role is scoped to the relation carrying it and cites the norm that
        // prescribes it, so two relations naming "lessor" are not thereby the
        // same role.
        expect(assigned.bearer.sourceNorm.designation).toBe("cl. 5");
        expect(byId(relators, POWER_TO_ASSIGN).bearer.sourceNorm.designation).toBe("cl. 9.1");
      })
    );

    it.effect(
      "CQ3 — which position kinds compose the recorded relations, and which of the eight can they reach?",
      Effect.fnUntraced(function* () {
        const { policy, relators } = yield* readPractice();

        // Stored kinds are advantage-side only; the readings derived from them
        // are what reach the burden side.
        const stored = HashSet.fromIterable(A.map(relators, (relation) => relation.positionKind));
        expect(HashSet.isSubset(AdvantagePositionKind.HashSet)(stored)).toBe(true);

        const reached = HashSet.fromIterable(
          A.flatMap(relators, (relation) => [
            relation.positionKind,
            policy.correlativeView(relation).position.kind,
            policy.oppositeView(relation).position.kind,
          ])
        );
        expect(HashSet.has(reached, "duty")).toBe(true);
        expect(HashSet.has(reached, "liability")).toBe(true);
        expect(HashSet.has(reached, "noRight")).toBe(true);
      })
    );

    it.effect(
      "CQ4 — which party bears each recorded position, and which party is it held against?",
      Effect.fnUntraced(function* () {
        const { relators } = yield* readPractice();

        expect(
          A.map(relators, (relation) => [relation.id, relation.bearer.player, relation.counterparty.player])
        ).toEqual([
          [ORIGINAL_CLAIM, LESSEE, LESSOR],
          [POWER_TO_ASSIGN, LESSEE, LESSOR],
          [ASSIGNED_CLAIM, ASSIGNEE, LESSOR],
          [PRIVILEGE_TO_ENTER, LESSEE, LESSOR],
          [CLAIM_TO_REFRAIN, LESSOR, LESSEE],
        ]);
      })
    );

    it.effect(
      "CQ5 — which position does the party subjected to the exercised power end up holding?",
      Effect.fnUntraced(function* () {
        const { frames, policy, relators } = yield* readPractice();

        // The frame says which position the act creates and for which slot; the
        // record produced by exercising it says who filled that slot.
        expect(byId(frames, ASSIGNMENT_FRAME).creates[0].bearer).toBe("assignee");
        const assigned = byId(relators, ASSIGNED_CLAIM);
        expect(assigned.bearer.name).toBe("assignee");
        expect(policy.correlativeView(assigned).position.kind).toBe("duty");
        expect(policy.correlativeView(assigned).bearer.name).toBe("lessor");
      })
    );

    it.effect(
      "CQ6 — which recorded event is each relation grounded on?",
      Effect.fnUntraced(function* () {
        const { relators } = yield* readPractice();

        expect(byId(relators, ORIGINAL_CLAIM).grounding.producingExercise).toBe(GRANT_EXERCISE);
        expect(byId(relators, POWER_TO_ASSIGN).grounding.producingExercise).toBe(GRANT_EXERCISE);
        expect(byId(relators, ASSIGNED_CLAIM).grounding.producingExercise).toBe(ASSIGNMENT_EXERCISE);
      })
    );

    it.effect(
      "CQ8 — does the recorded act create, alter, or extinguish positions, and may it do several at once?",
      Effect.fnUntraced(function* () {
        const { frames } = yield* readPractice();
        const kinds = byId(frames, ASSIGNMENT_FRAME).derivationKind.kinds;

        // A set, never a three-way choice: an assignment ends one claim and
        // starts another in the same step, and a single-valued field would make
        // the recorder throw half of that away.
        expect(HashSet.size(kinds)).toBe(2);
        expect(HashSet.has(kinds, "create")).toBe(true);
        expect(HashSet.has(kinds, "extinguish")).toBe(true);
        expect(HashSet.size(byId(frames, GRANT_FRAME).derivationKind.kinds)).toBe(1);
      })
    );

    it.effect(
      "CQ9 — which norm is cited as prescribing the institutional act that was performed?",
      Effect.fnUntraced(function* () {
        const { exercises, frames } = yield* readPractice();

        expect(byId(frames, ASSIGNMENT_FRAME).sourceNorm.designation).toBe("cl. 9");
        expect(byId(exercises, ASSIGNMENT_EXERCISE).authorityBasis.sourceNorm.designation).toBe("cl. 9.1");
      })
    );

    it.effect(
      "CQ10 — which parties are recorded as playing the roles the act names?",
      Effect.fnUntraced(function* () {
        const { exercises } = yield* readPractice();
        const exercise = byId(exercises, ASSIGNMENT_EXERCISE);

        expect(A.map(exercise.slotAssignments, (filled) => [filled.slot.label, filled.player])).toEqual([
          ["assignor", LESSEE],
          ["assignee", ASSIGNEE],
        ]);
        // The same party plays a role here and bears a position elsewhere,
        // which is the mechanism by which colliding positions arise at all.
        expect(exercise.authorityBasis.claimedRole.player).toBe(LESSEE);
      })
    );

    it.effect(
      "CQ11 — which events found a derived relation: the one that produced it, and the one that founded the power used?",
      Effect.fnUntraced(function* () {
        const { relators } = yield* readPractice();
        const derived = byId(relators, ASSIGNED_CLAIM).grounding;

        // Both, which is why grounding is a lineage rather than a scalar. One
        // event would leave a derived relation unable to say what let it be
        // derived.
        expect(derived.producingExercise).toBe(ASSIGNMENT_EXERCISE);
        expect(O.getOrThrow(derived.foundingExercise)).toBe(GRANT_EXERCISE);

        // And the chain terminates: a norm-founded relation names no earlier
        // exercise, so following the lineage back always halts.
        expect(O.isNone(byId(relators, ORIGINAL_CLAIM).grounding.foundingExercise)).toBe(true);
      })
    );

    it.effect(
      "CQ12 — which action or omission is the derived relation about?",
      Effect.fnUntraced(function* () {
        const { policy, relators } = yield* readPractice();
        const assigned = byId(relators, ASSIGNED_CLAIM);

        expect(assigned.content.description).toBe(DISTURB);
        expect(assigned.content.polarity).toBe("omission");
        // The cross-party reading leaves content exactly as recorded; only the
        // same-party negation moves polarity, and it moves the kind with it.
        expect(legalActContentEquivalence(policy.correlativeView(assigned).position.content, assigned.content)).toBe(
          true
        );
        expect(policy.oppositeView(assigned).position.content.polarity).toBe("act");
      })
    );

    it.effect(
      "CQ13 — which norm is the derived relation recorded as resting on?",
      Effect.fnUntraced(function* () {
        const { relators } = yield* readPractice();

        expect(byId(relators, ASSIGNED_CLAIM).sourceNorm.designation).toBe("cl. 5");
        expect(byId(relators, POWER_TO_ASSIGN).sourceNorm.designation).toBe("cl. 9.1");
      })
    );
  });
});

// ---------------------------------------------------------------------------
// The exclusions, asserted rather than described
// ---------------------------------------------------------------------------

describe("FLINT's out-of-scope competency questions are excluded from porting", () => {
  it("the exclusion list is exactly the donor README's own out-of-scope sections", () => {
    expect(Object.keys(FLINT_OUT_OF_SCOPE).sort()).toEqual([
      "Duty violations",
      "Events",
      "Hohfeldian relations",
      "Omissions",
    ]);
    expect(flatten(FLINT_OUT_OF_SCOPE)).toEqual([
      "cq-act-omission",
      "cq-duty-omission",
      "cq-duty-violation-conditions",
      "cq-duty-violation-consequences",
      "cq-event-postcondition",
      "cq-immunity-disability",
      "cq-liberty-noclaim",
    ]);

    // None of them ships a checked-in query, which is why the twenty-two are
    // the donor's in-scope executable set and the exclusion is structural
    // rather than a choice made here.
    const checkedIn = HashSet.fromIterable(FLINT_CHECKED_IN_QUERIES);
    expect(A.every(flatten(FLINT_OUT_OF_SCOPE), (query) => !HashSet.has(checkedIn, query))).toBe(true);
  });

  it("the twenty-two checked-in queries split cleanly into the ported subset and the surfaces this rung did not take", () => {
    const ported = HashSet.fromIterable(PORTED_QUERIES);
    const notPorted = HashSet.fromIterable(flatten(NOT_PORTED_QUERIES));

    expect(A.length(FLINT_CHECKED_IN_QUERIES)).toBe(22);
    expect(HashSet.size(ported)).toBe(11);
    expect(HashSet.size(notPorted)).toBe(11);
    expect(HashSet.size(HashSet.intersection(ported, notPorted))).toBe(0);
    expect(Equal.equals(HashSet.union(ported, notPorted), HashSet.fromIterable(FLINT_CHECKED_IN_QUERIES))).toBe(true);
  });

  layer(RecordedPractice)((it) => {
    it.effect(
      "the position domain still models the orbits the donor's Hohfeldian exclusions name — one donor narrows where the other widens",
      Effect.fnUntraced(function* () {
        const { policy, relators } = yield* readPractice();

        // `cq-immunity-disability` and `cq-liberty-noclaim` are excluded from
        // porting because the donor's frames cannot answer them. The position
        // vocabulary comes from the other donor and is closed at eight, so
        // those four kinds are live members rather than absences of a duty or
        // a power.
        const eight = HashSet.fromIterable(HohfeldPositionKind.Options);
        expect(HashSet.size(eight)).toBe(8);
        for (const kind of ["immunity", "disability", "privilege", "noRight"]) {
          expect(HashSet.has(eight, kind)).toBe(true);
        }

        // And they are reachable from stored records, not merely declarable.
        const privilege = byId(relators, PRIVILEGE_TO_ENTER);
        expect(privilege.positionKind).toBe("privilege");
        expect(policy.correlativeView(privilege).position.kind).toBe("noRight");
        expect(oppositePosition(correlativePosition({ content: privilege.content, kind: "immunity" })).kind).toBe(
          "power"
        );
      })
    );

    it.effect(
      "omissions stay first-class here even though the donor's omission queries are out of scope",
      Effect.fnUntraced(function* () {
        const { relators } = yield* readPractice();

        // The donor models positive actions only and says so. Its gap is not
        // inherited: polarity is a required field of act content, and the
        // opposite derivation is unsound without it.
        expect(S.is(LegalActPolarity)("omission")).toBe(true);
        expect(byId(relators, ORIGINAL_CLAIM).content.polarity).toBe("omission");
        expect(A.some(relators, (relation) => relation.content.polarity === "act")).toBe(true);
      })
    );

    it.effect(
      "duty violations are excluded from porting, and a breach is recorded as somebody's determination rather than derived",
      Effect.fnUntraced(function* () {
        const { exercises } = yield* readPractice();
        const exercise = byId(exercises, ASSIGNMENT_EXERCISE);

        // The donor's two excluded violation questions ask what conditions make
        // a duty violated and what follows from it. Neither is answered by
        // derivation here: a breach is one attributed determination on an
        // occasion, and no consequence follows from recording it.
        expect(O.getOrThrow(exercise.result.permission).status).toBe("violative");
        expect(O.getOrThrow(exercise.result.permission).interpreter).toEqual(attorney);
        expect(O.getOrThrow(O.getOrThrow(exercise.result.permission).basis)).toBe(
          "the covenant against assignment without consent"
        );
      })
    );
  });
});

// ---------------------------------------------------------------------------
// Where a question asks for a judgment, the answer is a recorded determination
// ---------------------------------------------------------------------------

describe("competency questions that ask for a legal judgment are answered with the recorded determination and its attribution", () => {
  layer(RecordedPractice)((it) => {
    it.effect(
      "an attempt determined to lack power stays on the record and grounds no position",
      Effect.fnUntraced(function* () {
        const { exercises, relators } = yield* readPractice();
        const voided = byId(exercises, VOID_EXERCISE);

        expect(O.getOrThrow(voided.result.constitution).outcome).toBe("not-constituted");
        expect(voided.result.disposition.disposition).toBe("void");
        expect(A.every(relators, (relation) => relation.grounding.producingExercise !== VOID_EXERCISE)).toBe(true);

        // An act may be within power and still breach a duty, so the axes are
        // never merged and neither is inferred from the other. The one donor
        // axiom that would collapse them — that exercising a power is
        // necessarily permissible — is not adopted.
        const wrong = byId(exercises, ASSIGNMENT_EXERCISE);
        expect(O.getOrThrow(wrong.result.constitution).outcome).toBe("constituted");
        expect(O.getOrThrow(wrong.result.permission).status).toBe("violative");
      })
    );

    it.effect(
      "the authority an actor claimed is recorded as claimed, and nothing here says they held it",
      Effect.fnUntraced(function* () {
        const { exercises } = yield* readPractice();
        const basis = byId(exercises, ASSIGNMENT_EXERCISE).authorityBasis;

        expect(basis.claimedRole.name).toBe("assignor");
        expect(O.getOrThrow(basis.exercisedPower)).toBe(POWER_TO_ASSIGN);
        expect(O.getOrThrow(basis.foundingExercise)).toBe(GRANT_EXERCISE);

        // Every element of the basis is present and cited, and that is all the
        // record claims. Whether the party held the power is a determination,
        // and the void attempt cites exactly the same basis.
        expect(O.getOrThrow(byId(exercises, VOID_EXERCISE).authorityBasis.exercisedPower)).toBe(POWER_TO_ASSIGN);
      })
    );

    it.effect(
      "a screened pair carries its unordered relations and the argument for priority, and never an outcome",
      Effect.fnUntraced(function* () {
        const { candidates, policy, relators } = yield* readPractice();

        // The screen answers two set-theoretic facts over the whole store, and
        // the assignment chain contributes nothing: only the entry pair overlaps
        // on every axis and is prima facie opposed.
        const screened = policy.screenForOpposition(relators);
        expect(HashSet.size(screened)).toBe(1);

        const recorded = byId(candidates, SCREENED_CANDIDATE);
        expect(Equal.equals(recorded.candidate.relators, HashSet.make(PRIVILEGE_TO_ENTER, CLAIM_TO_REFRAIN))).toBe(
          true
        );
        expect(Equal.equals(HashSet.make(recorded.candidate), screened)).toBe(true);

        // The basis is the argument, not the answer: no ordering, no score, and
        // no family until an attorney assigns one.
        const basis = O.getOrThrow(recorded.priorityBasis);
        expect(O.getOrThrow(basis.sourcePrecedence)).toBe("the lease clause over the parties' course of dealing");
        expect(O.isNone(basis.specificity)).toBe(true);
        expect(O.isNone(recorded.verdictFamily)).toBe(true);
      })
    );

    it.effect(
      "a second reading of the same clause is appended naming the first, and neither is a finding about which reading is right",
      Effect.fnUntraced(function* () {
        const { corrections } = yield* readPractice();

        expect(A.map(corrections, (delta) => delta.id)).toEqual([FIRST_CORRECTION, SECOND_CORRECTION]);
        const first = byId(corrections, FIRST_CORRECTION);
        const second = byId(corrections, SECOND_CORRECTION);

        expect(O.isNone(first.supersedes)).toBe(true);
        expect(O.getOrThrow(second.supersedes)).toBe(FIRST_CORRECTION);
        expect([first.stage, second.stage]).toEqual(["interpretation", "qualification"]);
        expect([first.reviewer, second.reviewer]).toEqual([paralegal, attorney]);

        // An unresolved difference stays visible as a candidate input until a
        // reviewer's own action routes it away.
        expect(first.candidateRouting).toBe("contradiction-candidate-input");
        expect(first.reviewerAction).toBe("undetermined");
        expect(second.candidateRouting).toBe("resolved-no-candidate");
        expect(A.map(first.validatorReport.findings, (finding) => finding.severity)).toEqual(["hard", "advisory"]);
      })
    );
  });
});
