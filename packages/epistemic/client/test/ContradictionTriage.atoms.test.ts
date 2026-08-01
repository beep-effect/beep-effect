import {
  ContradictionClient,
  contradictionDispositionFilterAtom,
  contradictionEvidenceSourcePageAtom,
  contradictionKnownAtAtom,
  contradictionQueueOffsetAtom,
  contradictionReviewCandidateIdAtom,
  contradictionValidAtAtom,
  resetContradictionTemporalViewAtom,
  reviewContradictionCandidateAtom,
  selectContradictionCandidateAtom,
  selectedContradictionCandidateAtom,
  selectedContradictionCandidateIdAtom,
  selectedContradictionEvidenceSourceAtom,
} from "@beep/epistemic-client";
import { ContradictionDisposition } from "@beep/epistemic-domain/entities/Contradiction";
import {
  ContradictionActionError,
  ContradictionRpcs,
  EvidenceSourcePagePayload,
  EvidenceSourcePageSelector,
  GetContradictionCandidate,
  ReviewContradictionCandidate,
} from "@beep/epistemic-use-cases/public";
import { NonNegativeInt } from "@beep/schema/Int";
import { baseEntityFixtureInput, fcRuns, systemPrincipal } from "@beep/test-utils";
import { describe, expect, it } from "@effect/vitest";
import { DateTime, Effect, Layer, Ref } from "effect";
import * as A from "effect/Array";
import * as Clock from "effect/Clock";
import * as O from "effect/Option";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import { FastCheck as fc, TestClock } from "effect/testing";
import { AsyncResult, AtomRegistry, Reactivity } from "effect/unstable/reactivity";
import * as RpcTest from "effect/unstable/rpc/RpcTest";

const decodeSourceRequest = S.decodeUnknownResult(EvidenceSourcePagePayload);
const decodeDetailRequest = S.decodeUnknownResult(GetContradictionCandidate);
const decodeReview = S.decodeUnknownResult(ReviewContradictionCandidate);
const encodeSourceRequest = S.encodeResult(EvidenceSourcePagePayload);
const encodeDetailRequest = S.encodeResult(GetContradictionCandidate);
const detailRequestEquivalence = S.toEquivalence(GetContradictionCandidate);
const sourceRequestEquivalence = S.toEquivalence(EvidenceSourcePagePayload);
const settle = Effect.repeat(Effect.yieldNow, { times: 4 });
const detailKnownAtMillis = 2_000;
const detailValidAtMillis = 1_500;
const reviewResolvedAtMillis = 3_000;
const reviewedDisposition = Result.getOrThrow(
  S.decodeUnknownResult(ContradictionDisposition)({
    ...baseEntityFixtureInput("EpistemicContradictionDisposition", 9),
    candidateId: 7,
    decision: {
      reason: "The evidence concerns different periods.",
      status: "rejected",
    },
    resolvedAt: reviewResolvedAtMillis,
    resolvedBy: systemPrincipal,
  })
);

const unexpectedRpc = (tag: string) =>
  Effect.fnUntraced(function* () {
    return yield* Effect.die(`unexpected contradiction RPC: ${tag}`);
  });

const ReviewFailureHandlersTest = ContradictionRpcs.toLayer({
  GetContradictionCandidate: Effect.fnUntraced(function* (payload) {
    expect(DateTime.toEpochMillis(payload.knownAt)).toBe(detailKnownAtMillis);
    expect(DateTime.toEpochMillis(payload.validAt)).toBe(detailValidAtMillis);
    return yield* ContradictionActionError.make({ reason: "candidate-not-found" });
  }),
  GetEvidenceSourcePage: unexpectedRpc("GetEvidenceSourcePage"),
  ListContradictionCandidates: unexpectedRpc("ListContradictionCandidates"),
  ReviewContradictionCandidate: Effect.fnUntraced(function* () {
    return yield* ContradictionActionError.make({ reason: "stale-candidate" });
  }),
});

const ReviewFailureClientTest = Layer.effect(
  ContradictionClient,
  RpcTest.makeClient(ContradictionRpcs, { flatten: true })
).pipe(Layer.provide(ReviewFailureHandlersTest));

const ReviewSuccessHandlersTest = ContradictionRpcs.toLayer({
  GetContradictionCandidate: unexpectedRpc("GetContradictionCandidate"),
  GetEvidenceSourcePage: unexpectedRpc("GetEvidenceSourcePage"),
  ListContradictionCandidates: unexpectedRpc("ListContradictionCandidates"),
  ReviewContradictionCandidate: Effect.fnUntraced(function* () {
    return reviewedDisposition;
  }),
});

const ReviewSuccessClientTest = Layer.effect(
  ContradictionClient,
  RpcTest.makeClient(ContradictionRpcs, { flatten: true })
).pipe(Layer.provide(ReviewSuccessHandlersTest));

const registryWithReviewFailure = () =>
  AtomRegistry.make({
    initialValues: [[ContradictionClient.runtime.layer, Layer.mergeAll(ReviewFailureClientTest, Reactivity.layer)]],
  });

const registryWithReviewFailureAndClock = (clock: Clock.Clock) =>
  AtomRegistry.make({
    initialValues: [
      [
        ContradictionClient.runtime.layer,
        Layer.mergeAll(ReviewFailureClientTest, Reactivity.layer, Layer.succeed(Clock.Clock, clock)),
      ],
    ],
  });

const registryWithReviewSuccess = () =>
  AtomRegistry.make({
    initialValues: [[ContradictionClient.runtime.layer, Layer.mergeAll(ReviewSuccessClientTest, Reactivity.layer)]],
  });

describe("@beep/epistemic-client contradiction atoms", () => {
  it("round-trips schema-derived detail and source payloads", () =>
    fc.assert(
      fc.property(
        S.toArbitrary(GetContradictionCandidate),
        S.toArbitrary(EvidenceSourcePagePayload),
        (detailRequest, sourceRequest) => {
          expect(
            detailRequestEquivalence(
              encodeDetailRequest(detailRequest).pipe(Result.getOrThrow, decodeDetailRequest, Result.getOrThrow),
              detailRequest
            )
          ).toBe(true);
          expect(
            sourceRequestEquivalence(
              encodeSourceRequest(sourceRequest).pipe(Result.getOrThrow, decodeSourceRequest, Result.getOrThrow),
              sourceRequest
            )
          ).toBe(true);
        }
      ),
      fcRuns(25)
    ));

  it("starts with an open queue and explicit unselected resource states", () => {
    const registry = AtomRegistry.make();

    expect(registry.get(contradictionDispositionFilterAtom)).toBe("open");
    expect(registry.get(contradictionQueueOffsetAtom)).toBe(0);
    expect(AsyncResult.isAsyncResult(registry.get(contradictionValidAtAtom))).toBe(true);
    expect(AsyncResult.isAsyncResult(registry.get(contradictionKnownAtAtom))).toBe(true);
    expect(AsyncResult.isInitial(registry.get(selectedContradictionCandidateAtom))).toBe(true);
    expect(AsyncResult.isInitial(registry.get(contradictionEvidenceSourcePageAtom))).toBe(true);
  });

  it.effect(
    "initializes both temporal axes from the Effect TestClock",
    Effect.fnUntraced(function* () {
      const targetMillis = 1_767_225_600_000;
      yield* TestClock.setTime(targetMillis);
      const clock = yield* Clock.Clock;
      const registry = registryWithReviewFailureAndClock(clock);

      registry.get(contradictionValidAtAtom);
      registry.get(contradictionKnownAtAtom);
      yield* settle;

      expect(O.map(AsyncResult.value(registry.get(contradictionValidAtAtom)), DateTime.toEpochMillis)).toStrictEqual(
        O.some(targetMillis)
      );
      expect(O.map(AsyncResult.value(registry.get(contradictionKnownAtAtom)), DateTime.toEpochMillis)).toStrictEqual(
        O.some(targetMillis)
      );
      registry.dispose();
    })
  );

  it.effect(
    "preserves temporal runtime initialization failures",
    Effect.fnUntraced(function* () {
      const registry = AtomRegistry.make({
        initialValues: [
          [ContradictionClient.runtime.layer, Layer.effectDiscard(Effect.fail("temporal-clock-unavailable"))],
        ],
      });

      registry.get(contradictionValidAtAtom);
      registry.get(contradictionKnownAtAtom);
      yield* settle;

      expect(AsyncResult.isFailure(registry.get(contradictionValidAtAtom))).toBe(true);
      expect(AsyncResult.isFailure(registry.get(contradictionKnownAtAtom))).toBe(true);
      registry.dispose();
    })
  );

  it.effect(
    "resets both temporal axes from the Effect TestClock and returns to the first page",
    Effect.fnUntraced(function* () {
      const targetMillis = 1_767_225_600_000;
      yield* TestClock.setTime(targetMillis);
      const clock = yield* Clock.Clock;
      const target = yield* DateTime.now;
      const prior = DateTime.subtract(target, { days: 1 });
      const registry = registryWithReviewFailureAndClock(clock);

      registry.set(contradictionValidAtAtom, prior);
      registry.set(contradictionKnownAtAtom, prior);
      registry.set(contradictionQueueOffsetAtom, NonNegativeInt.make(50));
      registry.set(resetContradictionTemporalViewAtom, undefined);
      yield* AtomRegistry.getResult(registry, resetContradictionTemporalViewAtom);

      expect(O.map(AsyncResult.value(registry.get(contradictionValidAtAtom)), DateTime.toEpochMillis)).toStrictEqual(
        O.some(targetMillis)
      );
      expect(O.map(AsyncResult.value(registry.get(contradictionKnownAtAtom)), DateTime.toEpochMillis)).toStrictEqual(
        O.some(targetMillis)
      );
      expect(registry.get(contradictionQueueOffsetAtom)).toBe(0);
      registry.dispose();
    })
  );

  it.effect(
    "clears candidate-bound source and review state when selecting another candidate",
    Effect.fnUntraced(function* () {
      yield* TestClock.setTime(1_767_225_600_000);
      const clock = yield* Clock.Clock;
      const registry = registryWithReviewFailureAndClock(clock);
      const previousRequest = Result.getOrThrow(
        decodeSourceRequest({
          candidateId: 7,
          evidenceId: 11,
          knownAt: 2_000,
          selector: EvidenceSourcePageSelector.cases.anchor.make({}),
          validAt: 1_500,
        })
      );
      const nextRequest = Result.getOrThrow(
        decodeSourceRequest({
          candidateId: 8,
          evidenceId: 12,
          knownAt: 2_000,
          selector: EvidenceSourcePageSelector.cases.anchor.make({}),
          validAt: 1_500,
        })
      );

      registry.set(selectedContradictionCandidateIdAtom, O.some(previousRequest.candidateId));
      registry.set(selectedContradictionEvidenceSourceAtom, O.some(previousRequest));
      registry.set(contradictionReviewCandidateIdAtom, O.some(previousRequest.candidateId));
      registry.set(selectContradictionCandidateAtom, nextRequest.candidateId);
      yield* AtomRegistry.getResult(registry, selectContradictionCandidateAtom);

      expect(registry.get(selectedContradictionCandidateIdAtom)).toStrictEqual(O.some(nextRequest.candidateId));
      expect(registry.get(selectedContradictionEvidenceSourceAtom)).toStrictEqual(O.none());
      expect(registry.get(contradictionReviewCandidateIdAtom)).toStrictEqual(O.none());
      registry.dispose();
    })
  );

  it("keeps a candidate-authorized source selection as one narrow payload", () => {
    const registry = AtomRegistry.make();
    const request = Result.getOrThrow(
      decodeSourceRequest({
        candidateId: 7,
        evidenceId: 11,
        knownAt: 2_000,
        selector: EvidenceSourcePageSelector.cases.page.make({
          pageIndex: NonNegativeInt.make(2),
        }),
        validAt: 1_500,
      })
    );

    registry.set(selectedContradictionEvidenceSourceAtom, O.some(request));

    expect(registry.get(selectedContradictionEvidenceSourceAtom)).toStrictEqual(O.some(request));
    expect(request.selector).toStrictEqual(
      EvidenceSourcePageSelector.cases.page.make({
        pageIndex: NonNegativeInt.make(2),
      })
    );
  });

  it.effect(
    "carries both active temporal axes into the selected candidate detail request",
    Effect.fnUntraced(function* () {
      const registry = registryWithReviewFailure();
      const unmount = registry.mount(selectedContradictionCandidateAtom);
      const request = Result.getOrThrow(
        decodeDetailRequest({
          candidateId: 7,
          knownAt: detailKnownAtMillis,
          validAt: detailValidAtMillis,
        })
      );

      registry.set(contradictionKnownAtAtom, DateTime.makeUnsafe(detailKnownAtMillis));
      registry.set(contradictionValidAtAtom, DateTime.makeUnsafe(detailValidAtMillis));
      registry.set(selectedContradictionCandidateIdAtom, O.some(request.candidateId));
      yield* settle;

      expect(AsyncResult.isFailure(registry.get(selectedContradictionCandidateAtom))).toBe(true);
      unmount();
      registry.dispose();
    })
  );

  it.effect(
    "issues a distinct candidate detail query after either temporal axis changes",
    Effect.fnUntraced(function* () {
      const requests = yield* Ref.make<ReadonlyArray<GetContradictionCandidate>>([]);
      const handlers = ContradictionRpcs.toLayer({
        GetContradictionCandidate: Effect.fnUntraced(function* (payload) {
          yield* Ref.update(requests, A.append(payload));
          return yield* ContradictionActionError.make({ reason: "candidate-not-found" });
        }),
        GetEvidenceSourcePage: unexpectedRpc("GetEvidenceSourcePage"),
        ListContradictionCandidates: unexpectedRpc("ListContradictionCandidates"),
        ReviewContradictionCandidate: unexpectedRpc("ReviewContradictionCandidate"),
      });
      const client = Layer.effect(ContradictionClient, RpcTest.makeClient(ContradictionRpcs, { flatten: true })).pipe(
        Layer.provide(handlers)
      );
      const registry = AtomRegistry.make({
        initialValues: [[ContradictionClient.runtime.layer, Layer.mergeAll(client, Reactivity.layer)]],
      });
      const unmount = registry.mount(selectedContradictionCandidateAtom);

      registry.set(contradictionKnownAtAtom, DateTime.makeUnsafe(2_000));
      registry.set(contradictionValidAtAtom, DateTime.makeUnsafe(1_500));
      registry.set(selectedContradictionCandidateIdAtom, O.some(GetContradictionCandidate.fields.candidateId.make(7)));
      yield* settle;
      registry.set(contradictionKnownAtAtom, DateTime.makeUnsafe(2_100));
      yield* settle;
      registry.set(contradictionValidAtAtom, DateTime.makeUnsafe(1_600));
      yield* settle;

      const capturedRequests = A.map(yield* Ref.get(requests), ({ knownAt, validAt }) => ({
        knownAt: DateTime.toEpochMillis(knownAt),
        validAt: DateTime.toEpochMillis(validAt),
      }));
      const temporalRequests = A.dedupeWith(
        capturedRequests,
        (left, right) => left.knownAt === right.knownAt && left.validAt === right.validAt
      );

      expect(temporalRequests).toStrictEqual([
        { knownAt: 2_000, validAt: 1_500 },
        { knownAt: 2_100, validAt: 1_500 },
        { knownAt: 2_100, validAt: 1_600 },
      ]);
      unmount();
      registry.dispose();
    })
  );

  it.effect(
    "advances transaction time before refreshing a successful review",
    Effect.fnUntraced(function* () {
      const registry = registryWithReviewSuccess();
      const unmount = registry.mount(reviewContradictionCandidateAtom);
      const command = Result.getOrThrow(
        decodeReview({
          candidateId: 7,
          decision: {
            decision: "reject",
            reason: "The evidence concerns different periods.",
          },
          expectedCandidateVersion: 1,
        })
      );

      registry.set(contradictionKnownAtAtom, DateTime.makeUnsafe(detailKnownAtMillis));
      registry.set(contradictionQueueOffsetAtom, NonNegativeInt.make(50));
      registry.set(reviewContradictionCandidateAtom, command);
      yield* AtomRegistry.getResult(registry, reviewContradictionCandidateAtom);

      expect(O.map(AsyncResult.value(registry.get(contradictionKnownAtAtom)), DateTime.toEpochMillis)).toStrictEqual(
        O.some(reviewResolvedAtMillis)
      );
      expect(registry.get(contradictionQueueOffsetAtom)).toBe(0);
      expect(AsyncResult.value(registry.get(reviewContradictionCandidateAtom))).toStrictEqual(
        O.some(reviewedDisposition)
      );
      unmount();
      registry.dispose();
    })
  );

  it.effect(
    "preserves a selected transaction time later than a successful review",
    Effect.fnUntraced(function* () {
      const registry = registryWithReviewSuccess();
      const unmount = registry.mount(reviewContradictionCandidateAtom);
      const command = Result.getOrThrow(
        decodeReview({
          candidateId: 7,
          decision: {
            decision: "reject",
            reason: "The evidence concerns different periods.",
          },
          expectedCandidateVersion: 1,
        })
      );

      registry.set(contradictionKnownAtAtom, DateTime.makeUnsafe(4_000));
      registry.set(reviewContradictionCandidateAtom, command);
      yield* AtomRegistry.getResult(registry, reviewContradictionCandidateAtom);

      expect(O.map(AsyncResult.value(registry.get(contradictionKnownAtAtom)), DateTime.toEpochMillis)).toStrictEqual(
        O.some(4_000)
      );
      unmount();
      registry.dispose();
    })
  );

  it.effect(
    "surfaces a typed review failure through the mutation AsyncResult",
    Effect.fnUntraced(function* () {
      const registry = registryWithReviewFailure();
      const unmount = registry.mount(reviewContradictionCandidateAtom);
      const command = Result.getOrThrow(
        decodeReview({
          candidateId: 7,
          decision: {
            decision: "reject",
            reason: "The two statements address different time periods.",
          },
          expectedCandidateVersion: 1,
        })
      );

      registry.set(reviewContradictionCandidateAtom, command);
      yield* settle;

      const result = registry.get(reviewContradictionCandidateAtom);
      expect(AsyncResult.isFailure(result)).toBe(true);
      unmount();
      registry.dispose();
    })
  );
});
