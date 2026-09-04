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
import { decodeAdmissionPolicyParams } from "@/projection/AboxPolicy";
import { CiOpsProjection, CiOpsProjectionLive } from "@/projection/CiOpsProjection";
import { admissionWeightFor, projectSchedule } from "@/projection/Engine";
import {
  decodeAdmissionJournal,
  InferredLeaseEviction,
  ReplayEventOutcome,
  ReplayEventVerdict,
  ReplayReport,
  renderReplayEvidence,
  replayAdmissionJournal,
  requireReplayMatch,
} from "@/projection/Replay";
import {
  emptyTokenLedger,
  PendingRequest,
  PlanEpisodeInput,
  PolicyDecodeError,
  ProjectionInput,
  ScheduleProposal,
  ScheduleScope,
  TokenLedgerState,
} from "@/projection/Schemas";
import { emitScheduleAbox } from "@/projection/Turtle";
import type { CiOpsProjectionShape } from "@/projection/CiOpsProjection";
import type { AdmissionPolicyParams, AdmissionWorkKind } from "@/projection/Schemas";

const aboxPath = "../../../explorations/beep-ci-operational-ontology/ontology/extraction/s6/graphs/abox.ttl";
const journalPath =
  "../../../explorations/beep-ci-operational-ontology/ontology/extraction/s6/snapshot/raw/journal.ndjson";
const evictionFixturePath = "test/fixtures/admission-journal-v2-eviction.ndjson";

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

const admittedLine = (nonce: string, kind: AdmissionWorkKind, weightTokens: number, admittedAtMillis: number): string =>
  JSON.stringify({
    schemaVersion: "yeet-admission-journal/v1",
    _tag: "admission-admitted",
    nonce,
    kind,
    weightTokens,
    priority: "verify",
    originKey: "origin-test",
    enqueuedAtMillis: admittedAtMillis - 1,
    admittedAtMillis,
  });

const releasedLine = (nonce: string, releasedAtMillis: number): string =>
  JSON.stringify({ schemaVersion: "yeet-admission-journal/v1", _tag: "admission-released", nonce, releasedAtMillis });

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
            const scope: ScheduleScope = step.scope;
            expect(ScheduleScope.is.admission(scope)).toBe(true);
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
      expect(report.verdicts).toHaveLength(41);
      expect(A.every(report.verdicts, (verdict) => ReplayEventOutcome.is.pass(verdict.outcome))).toBe(true);
      expect(report.mismatches).toHaveLength(0);
      expect(report.evictions).toHaveLength(1);
      expect(report.evictions[0]?.evictedNonce.startsWith("1813f29f")).toBe(true);
      expect(report.evictions[0]?.weightTokens).toBe(5);
      expect(report.evictions[0]?.eventIndex).toBe(66);
    }).pipe(provideScopedLayer(BunFileSystem.layer))
  );

  it.effect("decodes a v2 lease eviction fixture and folds it as a release", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const policy = yield* readPolicy();
      const source = yield* fs
        .readFileString(evictionFixturePath)
        .pipe(Effect.mapError(() => PolicyDecodeError.make({ message: "Unable to read the eviction fixture." })));
      const events = yield* decodeAdmissionJournal(source);
      const report = yield* replayAdmissionJournal(policy, events, "fixture-policy", "fixture-journal");

      expect(A.map(events, (event) => event._tag)).toStrictEqual(["admission-admitted", "admission-lease-evicted"]);
      expect(report.eventCount).toBe(2);
      expect(report.admittedCount).toBe(1);
      expect(report.releasedCount).toBe(1);
      expect(report.passed).toBe(true);
    }).pipe(provideScopedLayer(BunFileSystem.layer))
  );

  it.effect("renders byte-identical evidence from a typed replay report", () =>
    Effect.gen(function* () {
      const outcome: ReplayEventOutcome = "pass";
      const report = ReplayReport.make({
        eventCount: NonNegativeInt.make(1),
        admittedCount: NonNegativeInt.make(1),
        releasedCount: NonNegativeInt.make(0),
        verdicts: [
          ReplayEventVerdict.make({
            eventIndex: NonNegativeInt.make(0),
            admittedAtMillis: NonNegativeInt.make(1_000),
            expectedNonce: "request-1",
            projectedNonce: "request-1",
            pendingCount: NonNegativeInt.make(1),
            activeTokenTotal: NonNegativeInt.make(0),
            outcome,
          }),
        ],
        mismatches: [],
        evictions: [
          InferredLeaseEviction.make({
            eventIndex: NonNegativeInt.make(66),
            evictedNonce: "1813f29f",
            weightTokens: PosInt.make(5),
            activeTokenTotalBefore: NonNegativeInt.make(8),
            activeTokenTotalAfter: NonNegativeInt.make(3),
          }),
        ],
        passed: true,
      });
      const rendered = renderReplayEvidence(report, "digest-1");

      expect(rendered).toContain("PASS — all 1 admitted events matched");
      expect(rendered).toContain("## Inferred dead-lease evictions");
      expect(rendered).toContain("`1813f29f`");
      expect(rendered).toBe(renderReplayEvidence(report, "digest-1"));
      return yield* Effect.void;
    })
  );

  it.effect("mints distinct valid-Turtle nodes per proposal and re-points hasCurrentProposal", () =>
    Effect.gen(function* () {
      const policy = yield* readPolicy();
      const emptyFor = (proposalId: string) =>
        ScheduleProposal.make({
          proposalId,
          projectionInstantMillis: NonNegativeInt.make(1_000),
          steps: [],
          deferredTail: [],
          policyDigest: "policy",
          journalPrefixDigest: "prefix",
        });
      const slash = yield* emitScheduleAbox(emptyFor("a/b"));
      const question = yield* emitScheduleAbox(emptyFor("a?b"));
      const again = yield* emitScheduleAbox(emptyFor("a/b"));

      expect(slash.content).toBe(again.content);
      expect(slash.content).not.toBe(question.content);
      expect(slash.content).toContain("ciops-prov:scheduler ciops-prov:hasCurrentProposal ciops-prov:a%2Fb .");
      expect(question.content).toContain("ciops-prov:scheduler ciops-prov:hasCurrentProposal ciops-prov:a%3Fb .");
      expect(slash.content).toContain(
        "# PROVISIONAL GRAPH — closure OPEN; excluded from negation and ratified typing."
      );
      expect(slash.content).not.toContain("{");

      const request = PendingRequest.make({
        nonce: "turtle-request",
        kind: "review-fix",
        priority: "verify",
        weightTokens: policy.weights.reviewFix,
        originKey: "origin-a",
        enqueuedAtMillis: NonNegativeInt.make(1),
      });
      const stepped = yield* projectSchedule(inputFor(policy, [request], emptyTokenLedger, 1)).pipe(
        Effect.flatMap(emitScheduleAbox)
      );

      expect(stepped.content).toContain("ciops-prov:schedulesSeatRequest");
      expect(stepped.content).toContain("rdf:type ciops:SeatRequest .");
      expect(stepped.content).not.toContain("WorkUnitSpecification");
      expect(stepped.content).not.toContain("schedulesWorkUnit ");
    }).pipe(provideScopedLayer(BunFileSystem.layer))
  );

  it.effect("fails typed on ambiguous dead-lease censorship instead of guessing", () =>
    Effect.gen(function* () {
      const policy = yield* readPolicy();
      const events = yield* decodeAdmissionJournal(
        A.join(
          [
            admittedLine("phantom-a", "merged-preview", 5, 1_000),
            admittedLine("phantom-b", "merged-preview", 5, 2_000),
            admittedLine("blocked-c", "full-proof", 3, 3_000),
          ],
          "\n"
        )
      );
      const failure = yield* Effect.flip(replayAdmissionJournal(policy, events, "policy", "journal"));

      expect(failure._tag).toBe("PolicyDecodeError");
      expect(failure.message).toContain("Ambiguous dead-lease censorship");
      expect(failure.message).toContain("phantom-a");
      expect(failure.message).toContain("phantom-b");
    }).pipe(provideScopedLayer(BunFileSystem.layer))
  );

  it.effect("records a mismatch when a unique eviction cannot explain the recorded admission", () =>
    Effect.gen(function* () {
      const policy = yield* readPolicy();
      const events = yield* decodeAdmissionJournal(
        A.join(
          [
            admittedLine("phantom-a", "review-fix", 1, 1_000),
            admittedLine("released-b", "merged-preview", 5, 2_000),
            admittedLine("released-c", "full-proof", 3, 3_000),
            admittedLine("blocked-d", "merged-preview", 5, 4_000),
            releasedLine("released-b", 5_000),
            releasedLine("released-c", 6_000),
          ],
          "\n"
        )
      );
      const report = yield* replayAdmissionJournal(policy, events, "policy", "journal");

      expect(report.passed).toBe(false);
      expect(report.evictions).toHaveLength(1);
      expect(report.evictions[0]?.evictedNonce).toBe("phantom-a");
      expect(report.evictions[0]?.eventIndex).toBe(3);
      expect(report.mismatches).toHaveLength(1);
      expect(report.mismatches[0]?.expectedNonce).toBe("blocked-d");
      expect((yield* Effect.flip(requireReplayMatch(report)))._tag).toBe("ReplayMismatchError");
    }).pipe(provideScopedLayer(BunFileSystem.layer))
  );

  it.effect("keeps current proposal state transactionally and leaves the planner seam typed", () =>
    Effect.gen(function* () {
      const policy = yield* readPolicy().pipe(provideScopedLayer(BunFileSystem.layer));
      const service: CiOpsProjectionShape = yield* CiOpsProjection;
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
