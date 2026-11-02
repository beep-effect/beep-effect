import { ClaimDisposition } from "@beep/epistemic-domain/entities/ClaimDisposition";
import { EdgeVersion } from "@beep/epistemic-domain/entities/EdgeVersion";
import {
  RetentionCalibration,
  RetentionPolicy,
  RetentionSnapshot,
  retentionPolicyDigest,
} from "@beep/epistemic-domain/values/Retention";
import { RetentionAuthorityReader, RetentionCalibrationRegistry } from "@beep/epistemic-use-cases/Retention";
import { productEntityFixtureInput } from "@beep/test-utils";
import * as Effect from "effect/Effect";
import { dual } from "effect/Function";
import * as S from "effect/Schema";
import type * as O from "effect/Option";

export const keyA = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
export const keyB = "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
export const keyMissing = "cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc";
export const policyInput = {
  hotThroughMillis: 100,
  warmThroughMillis: 500,
  coldThroughMillis: 1000,
  decayScaleMillis: 500,
  payloadBudgetBytes: 10,
};
export const queryInput = {
  orgId: 1,
  logicalKeys: [keyB, keyA, keyMissing, keyA],
  validAt: 1500,
  knownAt: 2500,
  dispositions: [],
};
const edgeInput = {
  ...productEntityFixtureInput("EpistemicEdgeVersion", 1),
  deletedAt: null,
  deletedByPrincipal: null,
  evidenceScope: null,
  fact: { text: "é", nested: { z: 1, a: true } },
  logicalKey: keyA,
  matterScope: null,
  qualifiers: {},
  relation: "supports",
  sourceClaimId: 1,
  sourceEntityRef: null,
  sourceEvidenceId: null,
  sourceKind: "claim",
  sourceObservationRef: null,
  supersedesId: null,
  targetClaimId: null,
  targetEntityRef: null,
  targetEvidenceId: 2,
  targetKind: "evidence",
  targetObservationRef: null,
  expiredAt: null,
  recordedAt: 1000,
  validFrom: 1000,
  validTo: null,
  version: 1,
};
const dispositionInput = {
  ...productEntityFixtureInput("EpistemicClaimDisposition", 1),
  claimId: 1,
  reason: "reviewed",
  resolvedAt: 1000,
  resolvedBy: { kind: "System", component: "Runtime" },
  status: "active",
  violations: [],
};
export const makeSnapshot = Effect.fn("RetentionTest.snapshot")(function* () {
  const edges = yield* Effect.forEach(
    [
      { ...edgeInput, expiredAt: 2000 },
      {
        ...edgeInput,
        ...productEntityFixtureInput("EpistemicEdgeVersion", 2),
        recordedAt: 2000,
        version: 2,
        supersedesId: 1,
      },
      {
        ...edgeInput,
        ...productEntityFixtureInput("EpistemicEdgeVersion", 3),
        logicalKey: keyB,
        sourceClaimId: null,
        sourceKind: "entity",
        sourceEntityRef: "entity:test",
      },
      { ...edgeInput, ...productEntityFixtureInput("EpistemicEdgeVersion", 4), orgId: 2 },
    ],
    (input) => S.decodeUnknownEffect(EdgeVersion)(input)
  );
  const dispositions = yield* Effect.forEach(
    [
      dispositionInput,
      {
        ...dispositionInput,
        ...productEntityFixtureInput("EpistemicClaimDisposition", 2),
        status: "rejected",
        resolvedAt: 2000,
      },
      {
        ...dispositionInput,
        ...productEntityFixtureInput("EpistemicClaimDisposition", 3),
        status: "superseded",
        resolvedAt: 3000,
      },
      {
        ...dispositionInput,
        ...productEntityFixtureInput("EpistemicClaimDisposition", 4),
        orgId: 2,
        status: "superseded",
        resolvedAt: 2100,
      },
    ],
    (input) => S.decodeUnknownEffect(ClaimDisposition)(input)
  );
  return RetentionSnapshot.make({ edges, dispositions });
});
export const makeCalibration = Effect.fn("RetentionTest.calibration")(function* () {
  const policy = yield* S.decodeEffect(RetentionPolicy)(policyInput);
  return yield* S.decodeEffect(RetentionCalibration)({
    orgId: 1,
    mechanism: "retention-v1",
    policyDigest: yield* retentionPolicyDigest(policy),
    datasetDigest: keyA,
    evaluationReport: "fixture://calibration/report",
    sampleCount: 3,
    approvedBy: { kind: "User", userId: 1 },
    approvedAt: 2000,
    expiresAt: 4000,
    purpose: "production",
  });
});
export const provideFixture: {
  (
    snapshot: RetentionSnapshot,
    calibration: O.Option<RetentionCalibration>
  ): <A, E, R>(
    effect: Effect.Effect<A, E, R>
  ) => Effect.Effect<A, E, Exclude<R, RetentionAuthorityReader | RetentionCalibrationRegistry>>;
  <A, E, R>(
    effect: Effect.Effect<A, E, R>,
    snapshot: RetentionSnapshot,
    calibration: O.Option<RetentionCalibration>
  ): Effect.Effect<A, E, Exclude<R, RetentionAuthorityReader | RetentionCalibrationRegistry>>;
} = dual(
  3,
  <A, E, R>(effect: Effect.Effect<A, E, R>, snapshot: RetentionSnapshot, calibration: O.Option<RetentionCalibration>) =>
    effect.pipe(
      Effect.provideService(RetentionAuthorityReader, {
        read: Effect.fn("RetentionTest.read")(() => Effect.succeed(snapshot)),
      }),
      Effect.provideService(RetentionCalibrationRegistry, {
        find: Effect.fn("RetentionTest.find")(() => Effect.succeed(calibration)),
      })
    )
);
