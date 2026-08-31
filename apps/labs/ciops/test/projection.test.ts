import { decodeAdmissionPolicyParams } from "@beep/ciops/projection/AboxPolicy";
import { CiOpsProjection, CiOpsProjectionLive } from "@beep/ciops/projection/CiOpsProjection";
import { admissionWeightFor, projectSchedule } from "@beep/ciops/projection/Engine";
import { decodeAdmissionJournal, replayAdmissionJournal, requireReplayMatch } from "@beep/ciops/projection/Replay";
import {
  emptyTokenLedger,
  PendingRequest,
  PlanEpisodeInput,
  PolicyDecodeError,
  ProjectionInput,
  ScheduleProposal,
  TokenLedgerState,
} from "@beep/ciops/projection/Schemas";
import { emitScheduleAbox } from "@beep/ciops/projection/Turtle";
import { NonNegativeInt, PosInt } from "@beep/schema";
import { fcRuns, provideScopedLayer } from "@beep/test-utils";
import * as BunFileSystem from "@effect/platform-bun/BunFileSystem";
import { describe, expect, it } from "@effect/vitest";
import { Effect, Fiber, FileSystem } from "effect";
import * as A from "effect/Array";
import * as Eq from "effect/Equal";
import * as HashMap from "effect/HashMap";
import * as HashSet from "effect/HashSet";
import * as N from "effect/Number";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { FastCheck as fc } from "effect/testing";
import type { AdmissionPolicyParams } from "@beep/ciops/projection/Schemas";

const aboxPath = "../../../explorations/beep-ci-operational-ontology/ontology/extraction/s6/graphs/abox.ttl";
const journalPath =
  "../../../explorations/beep-ci-operational-ontology/ontology/extraction/s6/snapshot/raw/journal.ndjson";

const readPolicy = Effect.fn("CiOpsProjectionTest.readPolicy")(function* (): Effect.fn.Return<
  AdmissionPolicyParams,
  PolicyDecodeError,
  FileSystem.FileSystem
> {
  const fs = yield* FileSystem.FileSystem;
  const source = yield* fs
    .readFileString(aboxPath)
    .pipe(Effect.mapError(() => PolicyDecodeError.make({ message: "Unable to read the test A-Box." })));
  return yield* decodeAdmissionPolicyParams(source);
});

const PendingRequestArbitrary = S.toArbitrary(PendingRequest)(fc);
const proposalEquivalent = S.toEquivalence(ScheduleProposal);

const normalizePending = (
  policy: AdmissionPolicyParams,
  requests: ReadonlyArray<PendingRequest>
): ReadonlyArray<PendingRequest> =>
  A.map(requests, (request, index) =>
    PendingRequest.make({
      ...request,
      nonce: `request-${index}-${request.nonce}`,
      weightTokens: PosInt.make(admissionWeightFor(request.kind, policy)),
    })
  );

const pendingArbitrary = (policy: AdmissionPolicyParams) =>
  fc.array(PendingRequestArbitrary, { maxLength: 12 }).map((requests) => normalizePending(policy, requests));

const projectionInstantFor = (pending: ReadonlyArray<PendingRequest>): number =>
  A.reduce(pending, 0, (latest, request) => N.max(latest, request.enqueuedAtMillis));

const inputFor = (
  policy: AdmissionPolicyParams,
  pending: ReadonlyArray<PendingRequest>,
  ledger: TokenLedgerState = emptyTokenLedger,
  projectionInstantMillis: number = projectionInstantFor(pending)
): ProjectionInput =>
  ProjectionInput.make({
    policy,
    pending,
    ledger,
    projectionInstantMillis: NonNegativeInt.make(projectionInstantMillis),
    policyDigest: "policy-digest",
    journalPrefixDigest: "journal-prefix-digest",
  });

describe("@beep/ciops S7 projection", () => {
  it.effect("strictly decodes every ratified S6 policy parameter from Turtle bytes", () =>
    Effect.gen(function* () {
      const policy = yield* readPolicy();

      expect(policy.capacityMaxTokens).toBe(10);
      expect(policy.slotSizeGib).toBe(5);
      expect(policy.reserveGib).toBe(10);
      expect(policy.hardFloorGib).toBe(15);
      expect(policy.heartbeatSeconds).toBe(5);
      expect(policy.publishAgingSeconds).toBe(120);
      expect(policy.reviewFixClassCap).toBe(3);
      expect(policy.weights.fullProof).toBe(3);
      expect(policy.weights.mergedPreview).toBe(5);
      expect(policy.weights.reviewFix).toBe(1);
      expect(policy.weights.publish).toBe(1);
      expect(policy.priorityOrder).toEqual(["publish", "verify"]);
    }).pipe(provideScopedLayer(BunFileSystem.layer))
  );

  it.effect("property 1: projection and emitted A-Box are deterministic", () =>
    Effect.gen(function* () {
      const policy = yield* readPolicy();
      const context = yield* Effect.context<never>();
      const runSync = Effect.runSyncWith(context);

      fc.assert(
        fc.property(pendingArbitrary(policy), (pending) => {
          const input = inputFor(policy, pending);
          const first = runSync(projectSchedule(input));
          const second = runSync(projectSchedule(input));
          const firstDocument = runSync(emitScheduleAbox(first));
          const secondDocument = runSync(emitScheduleAbox(second));

          expect(proposalEquivalent(first, second)).toBe(true);
          expect(firstDocument.content).toBe(secondDocument.content);
          expect(firstDocument.content).toContain("@prefix ciops: <https://oip.law/ontology/ci-ops#> .");
          expect(firstDocument.content).toContain("@prefix ciops-prov: <https://oip.law/ontology/ci-ops-prov#> .");
        }),
        fcRuns(64)
      );
    }).pipe(provideScopedLayer(BunFileSystem.layer))
  );

  it.effect("property 2: every admitted step preserves charge versus capacity", () =>
    Effect.gen(function* () {
      const policy = yield* readPolicy();
      const context = yield* Effect.context<never>();
      const runSync = Effect.runSyncWith(context);

      fc.assert(
        fc.property(pendingArbitrary(policy), (pending) => {
          const proposal = runSync(projectSchedule(inputFor(policy, pending)));
          let active = 0;
          for (const step of proposal.steps) {
            active += step.request.weightTokens;
            expect(step.activeTokenTotalAfter).toBe(active);
            expect(active).toBeLessThanOrEqual(policy.capacityMaxTokens);
          }
        }),
        fcRuns(64)
      );
    }).pipe(provideScopedLayer(BunFileSystem.layer))
  );

  it.effect("property 3: every input request occurs once in steps or the deferred tail", () =>
    Effect.gen(function* () {
      const policy = yield* readPolicy();
      const context = yield* Effect.context<never>();
      const runSync = Effect.runSyncWith(context);

      fc.assert(
        fc.property(pendingArbitrary(policy), (pending) => {
          const proposal = runSync(projectSchedule(inputFor(policy, pending)));
          const expected = HashSet.fromIterable(A.map(pending, (request) => request.nonce));
          const projected = HashSet.fromIterable(
            A.appendAll(
              A.map(proposal.steps, (step) => step.request.nonce),
              A.map(proposal.deferredTail, (request) => request.nonce)
            )
          );

          expect(HashSet.size(projected)).toBe(A.length(pending));
          expect(HashSet.size(expected)).toBe(A.length(pending));
          expect(HashSet.isSubset(projected, expected)).toBe(true);
          expect(HashSet.isSubset(expected, projected)).toBe(true);
        }),
        fcRuns(64)
      );
    }).pipe(provideScopedLayer(BunFileSystem.layer))
  );

  it.effect("property 4: publish aging and the review-fix class cap are honored", () =>
    Effect.gen(function* () {
      const policy = yield* readPolicy();
      const context = yield* Effect.context<never>();
      const runSync = Effect.runSyncWith(context);

      fc.assert(
        fc.property(
          PendingRequestArbitrary,
          PendingRequestArbitrary,
          fc.integer({ min: 0, max: 1_000_000 }),
          (publishSeed, verifySeed, enqueuedAtMillis) => {
            const publish = PendingRequest.make({
              ...publishSeed,
              nonce: "publish-request",
              kind: "publish",
              priority: "publish",
              weightTokens: policy.weights.publish,
              enqueuedAtMillis: NonNegativeInt.make(enqueuedAtMillis),
            });
            const verify = PendingRequest.make({
              ...verifySeed,
              nonce: "verify-request",
              kind: "review-fix",
              priority: "verify",
              weightTokens: policy.weights.reviewFix,
              enqueuedAtMillis: NonNegativeInt.make(enqueuedAtMillis + 1),
            });
            const instant = enqueuedAtMillis + policy.publishAgingSeconds * 1000 + 1;
            const proposal = runSync(projectSchedule(inputFor(policy, [verify, publish], emptyTokenLedger, instant)));

            expect(pipeHeadNonce(proposal)).toBe(publish.nonce);
          }
        ),
        fcRuns(48)
      );

      const saturatedLedger = TokenLedgerState.make({
        activeGrants: HashMap.make(
          ["active-review-1", policy.weights.reviewFix],
          ["active-review-2", policy.weights.reviewFix],
          ["active-review-3", policy.weights.reviewFix]
        ),
        activeReviewFixNonces: HashSet.make("active-review-1", "active-review-2", "active-review-3"),
        activeTokenTotal: NonNegativeInt.make(3),
      });
      const reviewFix = PendingRequest.make({
        nonce: "queued-review-fix",
        kind: "review-fix",
        priority: "verify",
        weightTokens: policy.weights.reviewFix,
        originKey: "",
        enqueuedAtMillis: NonNegativeInt.make(0),
      });
      const fullProof = PendingRequest.make({
        nonce: "queued-full-proof",
        kind: "full-proof",
        priority: "verify",
        weightTokens: policy.weights.fullProof,
        originKey: "origin-a",
        enqueuedAtMillis: NonNegativeInt.make(1),
      });
      const capped = yield* projectSchedule(inputFor(policy, [reviewFix, fullProof], saturatedLedger, 1));

      expect(pipeHeadNonce(capped)).toBe(fullProof.nonce);
      expect(A.map(capped.deferredTail, (request) => request.nonce)).toContain(reviewFix.nonce);
    }).pipe(provideScopedLayer(BunFileSystem.layer))
  );

  it.effect("property 5: frozen journal replay strictly matches every recorded admission", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const policy = yield* readPolicy();
      const journalSource = yield* fs
        .readFileString(journalPath)
        .pipe(Effect.mapError(() => PolicyDecodeError.make({ message: "Unable to read the frozen journal." })));
      const events = yield* decodeAdmissionJournal(journalSource);
      const report = yield* replayAdmissionJournal(policy, events, "frozen-policy", "frozen-journal").pipe(
        Effect.flatMap(requireReplayMatch)
      );

      expect(report.eventCount).toBe(79);
      expect(report.admittedCount).toBe(41);
      expect(report.releasedCount).toBe(38);
      expect(report.passed).toBe(true);
      expect(report.mismatches).toHaveLength(0);
      expect(report.evictions).toHaveLength(1);
      expect(report.evictions[0]?.evictedNonce.startsWith("1813f29f")).toBe(true);
      expect(report.evictions[0]?.weightTokens).toBe(5);
      expect(report.evictions[0]?.eventIndex).toBe(66);
    }).pipe(provideScopedLayer(BunFileSystem.layer))
  );

  it.effect("keeps current proposal state transactionally and leaves the planner seam typed", () =>
    Effect.gen(function* () {
      const policy = yield* readPolicy().pipe(provideScopedLayer(BunFileSystem.layer));
      const service = yield* CiOpsProjection;
      expect(O.isNone(yield* service.currentProposal)).toBe(true);

      const waiting = yield* Effect.forkChild(service.awaitCurrentProposal);
      const projected = yield* service.projectCurrent(inputFor(policy, []));
      const awaited = yield* Fiber.join(waiting);
      const queued = yield* service.nextProposal;

      expect(Eq.equals(projected, awaited)).toBe(true);
      expect(Eq.equals(projected, queued)).toBe(true);
      expect((yield* Effect.flip(service.planEpisode(PlanEpisodeInput.make({ episodeId: "episode-1" }))))._tag).toBe(
        "PlannerNotImplementedError"
      );
    }).pipe(provideScopedLayer(CiOpsProjectionLive))
  );
});

const pipeHeadNonce = (proposal: ScheduleProposal): string =>
  O.getOrElse(
    O.map(A.head(proposal.steps), (step) => step.request.nonce),
    () => ""
  );
