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
import { it } from "@beep/test-runner";
import { fcRuns, productEntityFixtureInput, systemPrincipal } from "@beep/test-utils";
import { describe, expect } from "@effect/vitest";
import { assertNone, assertSome, assertTrue } from "@effect/vitest/utils";
import { DateTime, Effect, Layer, pipe, Ref } from "effect";
import * as Arbitrary from "effect/Arbitrary";
import * as A from "effect/Array";
import * as Clock from "effect/Clock";
import * as O from "effect/Option";
import * as Result from "effect/Result";
import { AsyncResult, AtomRegistry, Reactivity } from "effect/reactivity";
import * as RpcTest from "effect/rpc/RpcTest";
import * as S from "effect/Schema";
import { TestClock } from "effect/testing";

const decodeSourceRequest = S.decodeUnknownResult(EvidenceSourcePagePayload);
const decodeDetailRequest = S.decodeUnknownResult(GetContradictionCandidate);
const decodeReview = S.decodeUnknownResult(ReviewContradictionCandidate);
const encodeSourceRequest = S.encodeResult(EvidenceSourcePagePayload);
const encodeDetailRequest = S.encodeResult(GetContradictionCandidate);
const detailRequestEquivalence = S.toEquivalence(GetContradictionCandidate);
const sourceRequestEquivalence = S.toEquivalence(EvidenceSourcePagePayload);
const detailKnownAtMillis = 2_000;
const detailValidAtMillis = 1_500;
const reviewResolvedAtMillis = 3_000;
const reviewedDisposition = Result.getOrThrow(
  S.decodeUnknownResult(ContradictionDisposition)({
    ...productEntityFixtureInput("EpistemicContradictionDisposition", 9),
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
  it.prop(
    "round-trips schema-derived detail and source payloads",
    [Arbitrary.schema(GetContradictionCandidate), Arbitrary.schema(EvidenceSourcePagePayload)],
    ([detailRequest, sourceRequest]) => {
      pipe(
        detailRequestEquivalence(
          encodeDetailRequest(detailRequest).pipe(Result.getOrThrow, decodeDetailRequest, Result.getOrThrow),
          detailRequest
        ),
        assertTrue
      );
      pipe(
        sourceRequestEquivalence(
          encodeSourceRequest(sourceRequest).pipe(Result.getOrThrow, decodeSourceRequest, Result.getOrThrow),
          sourceRequest
        ),
        assertTrue
      );
    },
    { arbitrary: fcRuns(25) }
  );

  it.effect(
    "starts with an open queue and explicit unselected resource states",
    Effect.fnUntraced(function* () {
      const registry = yield* Effect.acquireRelease(
        Effect.sync(() => AtomRegistry.make()),
        (registry) => Effect.sync(() => registry.dispose())
      );

      expect(registry.get(contradictionDispositionFilterAtom)).toBe("open");
      expect(registry.get(contradictionQueueOffsetAtom)).toBe(0);
      pipe(AsyncResult.isAsyncResult(registry.get(contradictionValidAtAtom)), assertTrue);
      pipe(AsyncResult.isAsyncResult(registry.get(contradictionKnownAtAtom)), assertTrue);
      pipe(AsyncResult.isInitial(registry.get(selectedContradictionCandidateAtom)), assertTrue);
      pipe(AsyncResult.isInitial(registry.get(contradictionEvidenceSourcePageAtom)), assertTrue);
    })
  );

  it.effect(
    "initializes both temporal axes from the Effect TestClock",
    Effect.fnUntraced(function* () {
      const targetMillis = 1_767_225_600_000;
      yield* TestClock.setTime(targetMillis);
      const clock = yield* Clock.Clock;
      const registry = yield* Effect.acquireRelease(
        Effect.sync(() => registryWithReviewFailureAndClock(clock)),
        (registry) => Effect.sync(() => registry.dispose())
      );

      registry.get(contradictionValidAtAtom);
      registry.get(contradictionKnownAtAtom);
      yield* AtomRegistry.getResult(registry, contradictionValidAtAtom, { suspendOnWaiting: true });
      yield* AtomRegistry.getResult(registry, contradictionKnownAtAtom, { suspendOnWaiting: true });

      assertSome(
        O.map(AsyncResult.value(registry.get(contradictionValidAtAtom)), DateTime.toEpochMillis),
        targetMillis
      );
      assertSome(
        O.map(AsyncResult.value(registry.get(contradictionKnownAtAtom)), DateTime.toEpochMillis),
        targetMillis
      );
    })
  );

  it.effect(
    "preserves temporal runtime initialization failures",
    Effect.fnUntraced(function* () {
      const registry = yield* Effect.acquireRelease(
        Effect.sync(() =>
          AtomRegistry.make({
            initialValues: [
              [ContradictionClient.runtime.layer, Layer.effectDiscard(Effect.fail("temporal-clock-unavailable"))],
            ],
          })
        ),
        (registry) => Effect.sync(() => registry.dispose())
      );

      registry.get(contradictionValidAtAtom);
      registry.get(contradictionKnownAtAtom);
      yield* Effect.exit(AtomRegistry.getResult(registry, contradictionValidAtAtom, { suspendOnWaiting: true }));
      yield* Effect.exit(AtomRegistry.getResult(registry, contradictionKnownAtAtom, { suspendOnWaiting: true }));

      pipe(AsyncResult.isFailure(registry.get(contradictionValidAtAtom)), assertTrue);
      pipe(AsyncResult.isFailure(registry.get(contradictionKnownAtAtom)), assertTrue);
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
      const registry = yield* Effect.acquireRelease(
        Effect.sync(() => registryWithReviewFailureAndClock(clock)),
        (registry) => Effect.sync(() => registry.dispose())
      );

      registry.set(contradictionValidAtAtom, prior);
      registry.set(contradictionKnownAtAtom, prior);
      registry.set(contradictionQueueOffsetAtom, NonNegativeInt.make(50));
      registry.set(resetContradictionTemporalViewAtom, undefined);
      yield* AtomRegistry.getResult(registry, resetContradictionTemporalViewAtom);

      assertSome(
        O.map(AsyncResult.value(registry.get(contradictionValidAtAtom)), DateTime.toEpochMillis),
        targetMillis
      );
      assertSome(
        O.map(AsyncResult.value(registry.get(contradictionKnownAtAtom)), DateTime.toEpochMillis),
        targetMillis
      );
      expect(registry.get(contradictionQueueOffsetAtom)).toBe(0);
    })
  );

  it.effect(
    "clears candidate-bound source and review state when selecting another candidate",
    Effect.fnUntraced(function* () {
      yield* TestClock.setTime(1_767_225_600_000);
      const clock = yield* Clock.Clock;
      const registry = yield* Effect.acquireRelease(
        Effect.sync(() => registryWithReviewFailureAndClock(clock)),
        (registry) => Effect.sync(() => registry.dispose())
      );
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

      assertSome(registry.get(selectedContradictionCandidateIdAtom), nextRequest.candidateId);
      assertNone(registry.get(selectedContradictionEvidenceSourceAtom));
      assertNone(registry.get(contradictionReviewCandidateIdAtom));
    })
  );

  it.effect(
    "keeps a candidate-authorized source selection as one narrow payload",
    Effect.fnUntraced(function* () {
      const registry = yield* Effect.acquireRelease(
        Effect.sync(() => AtomRegistry.make()),
        (registry) => Effect.sync(() => registry.dispose())
      );
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

      assertSome(registry.get(selectedContradictionEvidenceSourceAtom), request);
      expect(request.selector).toStrictEqual(
        EvidenceSourcePageSelector.cases.page.make({
          pageIndex: NonNegativeInt.make(2),
        })
      );
    })
  );

  it.effect(
    "carries both active temporal axes into the selected candidate detail request",
    Effect.fnUntraced(function* () {
      const registry = yield* Effect.acquireRelease(
        Effect.sync(() => registryWithReviewFailure()),
        (registry) => Effect.sync(() => registry.dispose())
      );
      yield* AtomRegistry.mount(registry, selectedContradictionCandidateAtom);
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
      yield* Effect.exit(
        AtomRegistry.getResult(registry, selectedContradictionCandidateAtom, { suspendOnWaiting: true })
      );

      pipe(AsyncResult.isFailure(registry.get(selectedContradictionCandidateAtom)), assertTrue);
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
      const registry = yield* Effect.acquireRelease(
        Effect.sync(() =>
          AtomRegistry.make({
            initialValues: [[ContradictionClient.runtime.layer, Layer.mergeAll(client, Reactivity.layer)]],
          })
        ),
        (registry) => Effect.sync(() => registry.dispose())
      );
      yield* AtomRegistry.mount(registry, selectedContradictionCandidateAtom);

      registry.set(contradictionKnownAtAtom, DateTime.makeUnsafe(2_000));
      registry.set(contradictionValidAtAtom, DateTime.makeUnsafe(1_500));
      registry.set(selectedContradictionCandidateIdAtom, O.some(GetContradictionCandidate.fields.candidateId.make(7)));
      yield* Effect.exit(
        AtomRegistry.getResult(registry, selectedContradictionCandidateAtom, { suspendOnWaiting: true })
      );
      registry.set(contradictionKnownAtAtom, DateTime.makeUnsafe(2_100));
      yield* Effect.exit(
        AtomRegistry.getResult(registry, selectedContradictionCandidateAtom, { suspendOnWaiting: true })
      );
      registry.set(contradictionValidAtAtom, DateTime.makeUnsafe(1_600));
      yield* Effect.exit(
        AtomRegistry.getResult(registry, selectedContradictionCandidateAtom, { suspendOnWaiting: true })
      );

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
    })
  );

  it.effect(
    "advances transaction time before refreshing a successful review",
    Effect.fnUntraced(function* () {
      const registry = yield* Effect.acquireRelease(
        Effect.sync(() => registryWithReviewSuccess()),
        (registry) => Effect.sync(() => registry.dispose())
      );
      yield* AtomRegistry.mount(registry, reviewContradictionCandidateAtom);
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

      assertSome(
        O.map(AsyncResult.value(registry.get(contradictionKnownAtAtom)), DateTime.toEpochMillis),
        reviewResolvedAtMillis
      );
      expect(registry.get(contradictionQueueOffsetAtom)).toBe(0);
      assertSome(AsyncResult.value(registry.get(reviewContradictionCandidateAtom)), reviewedDisposition);
    })
  );

  it.effect(
    "preserves a selected transaction time later than a successful review",
    Effect.fnUntraced(function* () {
      const registry = yield* Effect.acquireRelease(
        Effect.sync(() => registryWithReviewSuccess()),
        (registry) => Effect.sync(() => registry.dispose())
      );
      yield* AtomRegistry.mount(registry, reviewContradictionCandidateAtom);
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

      assertSome(O.map(AsyncResult.value(registry.get(contradictionKnownAtAtom)), DateTime.toEpochMillis), 4_000);
    })
  );

  it.effect(
    "surfaces a typed review failure through the mutation AsyncResult",
    Effect.fnUntraced(function* () {
      const registry = yield* Effect.acquireRelease(
        Effect.sync(() => registryWithReviewFailure()),
        (registry) => Effect.sync(() => registry.dispose())
      );
      yield* AtomRegistry.mount(registry, reviewContradictionCandidateAtom);
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
      yield* Effect.exit(
        AtomRegistry.getResult(registry, reviewContradictionCandidateAtom, { suspendOnWaiting: true })
      );

      const result = registry.get(reviewContradictionCandidateAtom);
      pipe(AsyncResult.isFailure(result), assertTrue);
    })
  );
});
