/**
 * Proof for the in-memory legal position record repository.
 *
 * Five properties are under test and nothing else: an appended record of each
 * of the five kinds reads back, a read scoped to one organization never returns
 * another organization's records, the two frame-keyed reads never return
 * records citing a different frame, reads of a kind come back by `id` ascending
 * whatever order they were appended in, and the tenant split holds over
 * schema-derived records rather than only over ids chosen to make the assertion
 * easy. The durable-row behaviour of the Drizzle variant is a separate proof
 * against a real database; nothing here stands in for it.
 *
 * The entity-type strings are taken from the identity registry rather than
 * retyped, so a renamed entity type breaks the build instead of the fixture.
 *
 * Each block builds its own `Layer.fresh` repository, because the in-memory
 * store is a process-local `Ref` and a shared build would let one block's
 * appends leak into the next block's reads.
 */

import {
  ActFrame,
  CorrectionDelta,
  LegalOppositionCandidate,
  LegalPositionRelator,
  PowerExercise,
} from "@beep/law-practice-domain";
import {
  LegalPositionRecordRepositoryInMemory,
  makeInMemoryLegalPositionRecordRepository,
} from "@beep/law-practice-server/LegalPositionRecord";
import {
  ActFrameRecordScope,
  LegalPositionRecordRepository,
  LegalPositionRecordScope,
} from "@beep/law-practice-use-cases/LegalPositionRecord";
import * as LawPractice from "@beep/shared-domain/identity/LawPractice";
import * as Shared from "@beep/shared-domain/identity/Shared";
import { baseEntityFixtureInput } from "@beep/test-utils";
import { describe, expect, it, layer } from "@effect/vitest";
import { Effect, Layer } from "effect";
import * as A from "effect/Array";
import * as HashSet from "effect/HashSet";
import * as Order from "effect/Order";
import * as S from "effect/Schema";
import { FastCheck as fc } from "effect/testing";
import type { LegalPositionRecordRepositoryShape } from "@beep/law-practice-use-cases/LegalPositionRecord";

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

const relatorFixture = (id: number, org = 1) =>
  S.decodeUnknownEffect(LegalPositionRelator)({
    ...baseEntityFixtureInput(LawPractice.LegalPositionRelatorId.entityType, id),
    orgId: org,
    assertingInterpreter: { kind: "User", userId: 1 },
    bearer: roleInput("lessee", 1),
    content: { description: ACT, polarity: "act" },
    counterparty: roleInput("lessor", 2),
    grounding: { foundingExercise: null, producingExercise: id },
    positionKind: "privilege",
    scope: scopeInput,
    sourceNorm: NORM,
  });

const frameFixture = (id: number, org = 1) =>
  S.decodeUnknownEffect(ActFrame)({
    ...baseEntityFixtureInput(LawPractice.ActFrameId.entityType, id),
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

const exerciseFixture = (id: number, frame: number, org = 1) =>
  S.decodeUnknownEffect(PowerExercise)({
    ...baseEntityFixtureInput(LawPractice.PowerExerciseId.entityType, id),
    orgId: org,
    attemptedAt: 1_700_000_000_000 + id,
    authorityBasis: {
      claimedRole: roleInput("lessee", 4),
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
    slotAssignments: [{ player: 4, slot: { label: "lessee", part: "slot" } }],
  });

const correctionFixture = (id: number, frame: number, org = 1) =>
  S.decodeUnknownEffect(CorrectionDelta)({
    ...baseEntityFixtureInput(LawPractice.CorrectionDeltaId.entityType, id),
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

const candidateFixture = (id: number, relators: ReadonlyArray<number>, org = 1) =>
  S.decodeUnknownEffect(LegalOppositionCandidate)({
    ...baseEntityFixtureInput(LawPractice.LegalOppositionCandidateId.entityType, id),
    orgId: org,
    candidate: { act: ACT, overlappingScope: scopeInput, relators },
    priorityBasis: null,
    verdictFamily: null,
  });

/**
 * Append one record of each kind, seeded so the five ids are distinguishable in
 * the assertions: `seed`, `seed + 100`, and so on. Exercises and corrections
 * cite the frame appended alongside them.
 */
const appendEveryKind = Effect.fnUntraced(function* (
  repository: LegalPositionRecordRepositoryShape,
  seed: number,
  org = 1
) {
  yield* repository.recordRelator(yield* relatorFixture(seed, org));
  yield* repository.recordFrame(yield* frameFixture(seed + 100, org));
  yield* repository.recordExercise(yield* exerciseFixture(seed + 200, seed + 100, org));
  yield* repository.recordCorrection(yield* correctionFixture(seed + 300, seed + 100, org));
  yield* repository.recordOppositionCandidate(yield* candidateFixture(seed + 400, [seed, seed + 1], org));
});

const ids = <Entity extends { readonly id: number }>(records: ReadonlyArray<Entity>): ReadonlyArray<number> =>
  A.map(records, (record) => record.id);

const tenant = (org: number) => LegalPositionRecordScope.make({ orgId: Shared.OrganizationId.make(org) });

const underFrame = (frame: number, org = 1) =>
  ActFrameRecordScope.make({ frame: LawPractice.ActFrameId.make(frame), orgId: Shared.OrganizationId.make(org) });

describe("@beep/law-practice-server legal position record repository", () => {
  layer(Layer.fresh(LegalPositionRecordRepositoryInMemory))("tenant isolation", (it) => {
    it.effect(
      "never returns another organization's records",
      Effect.fnUntraced(function* () {
        const repository = yield* LegalPositionRecordRepository;
        // Two tenants recording positions about the same norm and the same act
        // is the case an unscoped read silently merges into one legal picture.
        yield* appendEveryKind(repository, 1, 1);
        yield* appendEveryKind(repository, 2, 2);

        expect(ids(yield* repository.listRelators(tenant(1)))).toEqual([1]);
        expect(ids(yield* repository.listFrames(tenant(1)))).toEqual([101]);
        expect(ids(yield* repository.listOppositionCandidates(tenant(1)))).toEqual([401]);

        expect(ids(yield* repository.listRelators(tenant(2)))).toEqual([2]);
        expect(ids(yield* repository.listFrames(tenant(2)))).toEqual([102]);
        expect(ids(yield* repository.listOppositionCandidates(tenant(2)))).toEqual([402]);

        // The frame-keyed reads are tenant-scoped first: tenant 1 asking for
        // tenant 2's frame gets nothing rather than tenant 2's exercises.
        expect(ids(yield* repository.listExercises(underFrame(102, 1)))).toEqual([]);
        expect(ids(yield* repository.listCorrections(underFrame(102, 1)))).toEqual([]);
        expect(ids(yield* repository.listExercises(underFrame(102, 2)))).toEqual([202]);
      })
    );
  });

  layer(Layer.fresh(LegalPositionRecordRepositoryInMemory))("appending each record kind", (it) => {
    it.effect(
      "reads every appended kind back scoped to where it was recorded",
      Effect.fnUntraced(function* () {
        const repository = yield* LegalPositionRecordRepository;
        yield* appendEveryKind(repository, 1);

        const relators = yield* repository.listRelators(tenant(1));
        const frames = yield* repository.listFrames(tenant(1));
        const exercises = yield* repository.listExercises(underFrame(101));
        const corrections = yield* repository.listCorrections(underFrame(101));
        const candidates = yield* repository.listOppositionCandidates(tenant(1));

        expect(ids(relators)).toEqual([1]);
        expect(ids(frames)).toEqual([101]);
        expect(ids(exercises)).toEqual([201]);
        expect(ids(corrections)).toEqual([301]);
        expect(ids(candidates)).toEqual([401]);

        // Round-tripping the recorded surface, not just the row count. An
        // exercise that lost its disposition would be authority laundering, and
        // a candidate that lost half its pair would name nothing.
        expect(A.map(exercises, (exercise) => exercise.result.disposition.disposition)).toEqual(["undetermined"]);
        expect(A.map(candidates, (candidate) => HashSet.size(candidate.candidate.relators))).toEqual([2]);
        expect(A.map(frames, (frame) => HashSet.size(frame.derivationKind.kinds))).toEqual([2]);
      })
    );
  });

  layer(Layer.fresh(LegalPositionRecordRepositoryInMemory))("scoping reads by act frame", (it) => {
    it.effect(
      "never returns a second frame's exercises or corrections",
      Effect.fnUntraced(function* () {
        const repository = yield* LegalPositionRecordRepository;
        yield* appendEveryKind(repository, 1);
        yield* appendEveryKind(repository, 2);

        expect(ids(yield* repository.listExercises(underFrame(101)))).toEqual([201]);
        expect(ids(yield* repository.listCorrections(underFrame(101)))).toEqual([301]);

        expect(ids(yield* repository.listExercises(underFrame(102)))).toEqual([202]);
        expect(ids(yield* repository.listCorrections(underFrame(102)))).toEqual([302]);

        // Both frames belong to the same tenant, so the tenant-wide reads see
        // both while the frame-keyed reads never mix them.
        expect(ids(yield* repository.listFrames(tenant(1)))).toEqual([101, 102]);
      })
    );
  });

  layer(Layer.fresh(LegalPositionRecordRepositoryInMemory))("ordering reads of one scope", (it) => {
    it.effect(
      "returns each kind by id ascending whatever order it was appended in",
      Effect.fnUntraced(function* () {
        const repository = yield* LegalPositionRecordRepository;

        // Appended highest id first, so append order and id order disagree and
        // a store that simply replayed insertions would fail here.
        yield* appendEveryKind(repository, 3);
        yield* appendEveryKind(repository, 1);

        expect(ids(yield* repository.listRelators(tenant(1)))).toEqual([1, 3]);
        expect(ids(yield* repository.listFrames(tenant(1)))).toEqual([101, 103]);
        expect(ids(yield* repository.listOppositionCandidates(tenant(1)))).toEqual([401, 403]);
      })
    );
  });

  describe("tenant scoping over arbitrary records", () => {
    // Schema-derived rather than hand-written, so the tenant split is proved
    // over organizations and ids nobody chose to make the assertion easy. Each
    // run builds its own store, which is stricter isolation than a shared
    // `Layer.fresh` gives across runs of one property.
    const relators = S.toArbitrary(LegalPositionRelator)(fc);

    const readPerOrganization = Effect.fnUntraced(function* (recorded: ReadonlyArray<LegalPositionRelator>) {
      const repository = yield* makeInMemoryLegalPositionRecordRepository();
      yield* Effect.forEach(recorded, (relator) => repository.recordRelator(relator));

      return yield* Effect.forEach(
        HashSet.fromIterable(A.map(recorded, (relator) => relator.orgId)),
        Effect.fnUntraced(function* (orgId) {
          const read = yield* repository.listRelators(LegalPositionRecordScope.make({ orgId }));
          const expected = A.sort(
            A.map(
              A.filter(recorded, (relator) => relator.orgId === orgId),
              (relator) => relator.id
            ),
            Order.Number
          );
          return { expected, read: ids(read) };
        })
      );
    });

    it("returns exactly the relations recorded under each organization, id ascending", () => {
      fc.assert(
        fc.property(fc.array(relators, { maxLength: 12 }), (recorded) => {
          for (const { expected, read } of Effect.runSync(readPerOrganization(recorded))) {
            expect(read).toEqual(expected);
          }
        }),
        { numRuns: 10 }
      );
    });
  });
});
