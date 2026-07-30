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
import {
  ContradictionActionError,
  ContradictionRpcs,
  EvidenceSourcePagePayload,
  EvidenceSourcePageSelector,
  ReviewContradictionCandidate,
} from "@beep/epistemic-use-cases/public";
import { NonNegativeInt } from "@beep/schema/Int";
import { describe, expect, it } from "@effect/vitest";
import { DateTime, Effect, Layer } from "effect";
import * as Clock from "effect/Clock";
import * as O from "effect/Option";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import { TestClock } from "effect/testing";
import { AsyncResult, AtomRegistry, Reactivity } from "effect/unstable/reactivity";
import * as RpcTest from "effect/unstable/rpc/RpcTest";

const decodeSourceRequest = S.decodeUnknownResult(EvidenceSourcePagePayload);
const decodeReview = S.decodeUnknownResult(ReviewContradictionCandidate);
const settle = Effect.repeat(Effect.yieldNow, { times: 4 });

const unexpectedRpc = (tag: string) =>
  Effect.fnUntraced(function* () {
    return yield* Effect.die(`unexpected contradiction RPC: ${tag}`);
  });

const ReviewFailureHandlersTest = ContradictionRpcs.toLayer({
  GetContradictionCandidate: unexpectedRpc("GetContradictionCandidate"),
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

describe("@beep/epistemic-client contradiction atoms", () => {
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
          selector: EvidenceSourcePageSelector.cases.anchor.make({}),
        })
      );
      const nextRequest = Result.getOrThrow(
        decodeSourceRequest({
          candidateId: 8,
          evidenceId: 12,
          selector: EvidenceSourcePageSelector.cases.anchor.make({}),
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
        selector: EvidenceSourcePageSelector.cases.page.make({
          pageIndex: NonNegativeInt.make(2),
        }),
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
