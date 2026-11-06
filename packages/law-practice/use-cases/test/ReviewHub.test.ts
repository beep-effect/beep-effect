/**
 * The review hub over in-memory stores: open items in store order, the next
 * open-items result after a verdict and an answer, and the code each failure
 * maps to. Every item, option and batch here is synthetic.
 */

import { ReviewItem } from "@beep/law-practice-domain/values/ReviewItem";
import { QuestionQueueLive, RecordAnswerInput } from "@beep/law-practice-use-cases/QuestionQueue";
import {
  LockBatchRequest,
  OpenItemsRequest,
  RecordAnswerRequest,
  ReviewHub,
  ReviewHubLive,
} from "@beep/law-practice-use-cases/ReviewHub";
import { ReviewItemStore, ReviewItemStoreError } from "@beep/law-practice-use-cases/ReviewItemStore";
import { RecordVerdictInput, ReviewQueueLive } from "@beep/law-practice-use-cases/ReviewQueue";
import { AnswerLogMemory, ReviewItemStoreMemory, VerdictLogMemory } from "@beep/law-practice-use-cases/test";
import { LocalDate } from "@beep/schema/LocalDate";
import { it } from "@beep/test-runner";
import { describe, expect } from "@effect/vitest";
import { assertSome } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as S from "effect/Schema";
import type { ReviewHubToolError } from "@beep/law-practice-use-cases/ReviewHub";
import type { ReviewItemStoreShape } from "@beep/law-practice-use-cases/ReviewItemStore";

const hubOver = (store: Layer.Layer<ReviewItemStore>) =>
  ReviewHubLive.pipe(
    Layer.provideMerge(Layer.mergeAll(ReviewQueueLive, QuestionQueueLive, store)),
    Layer.provide(Layer.merge(VerdictLogMemory, AnswerLogMemory))
  );

const unreadable: ReviewItemStoreShape = {
  list: Effect.fail(ReviewItemStoreError.make({ operation: "read", reason: "items.jsonl cannot be read" })),
  upsert: () => Effect.void,
};

const today = OpenItemsRequest.make({ today: LocalDate.make({ year: 2026, month: 10, day: 14 }) });

const finding = (itemId: string) =>
  ReviewItem.cases["kg-answer"].make({
    itemId,
    text: "The synthetic family has two open applications.",
    sourceRefs: [],
  });

const question = S.decodeEffect(ReviewItem.cases.question)({
  kind: "question",
  itemId: "question:hub-1",
  text: "Should the synthetic response date stay on November 2?",
  sourceRefs: [],
  facts: [],
  options: [
    { optionId: "keep-date", label: "Keep the date" },
    { optionId: "handle-myself", label: "I will handle it" },
  ],
});

const answer = (itemId: string, optionId: string) =>
  RecordAnswerRequest.make({ itemId, answer: RecordAnswerInput.cases.decided.make({ itemId, optionId }) });

const codeOf = <A, R>(effect: Effect.Effect<A, ReviewHubToolError, R>) =>
  Effect.map(Effect.flip(effect), ({ code }) => code);

const openIds = Effect.flatMap(ReviewHub, (hub) =>
  Effect.map(hub.openItems(today), ({ items }) => A.map(items, ({ itemId }) => itemId))
);

describe("@beep/law-practice-use-cases review hub", () => {
  it.layer(hubOver(ReviewItemStoreMemory), { timeout: "10 seconds" })("one sitting", (it) => {
    it.effect(
      "lists both kinds in store order, closes them on a verdict and an answer, and maps each failure to its code",
      Effect.fnUntraced(function* () {
        const hub = yield* ReviewHub;
        yield* (yield* ReviewItemStore).upsert([
          finding("kg-answer:hub-1"),
          yield* question,
          finding("kg-answer:hub-2"),
        ]);

        const before = yield* openIds;
        yield* hub.recordVerdict(
          RecordVerdictInput.make({ itemId: "kg-answer:hub-1", batchId: "sitting-1", verdict: "right" })
        );
        yield* hub.recordAnswer(answer("question:hub-1", "keep-date"));
        const after = yield* openIds;

        expect(before).toStrictEqual(["kg-answer:hub-1", "question:hub-1", "kg-answer:hub-2"]);
        expect(after).toStrictEqual(["kg-answer:hub-2"]);
        const all1 = yield* Effect.all([
          codeOf(hub.recordAnswer(answer("question:hub-1", "move-date"))),
          codeOf(hub.recordAnswer(answer("kg-answer:hub-2", "keep-date"))),
          codeOf(hub.recordAnswer(answer("question:missing", "keep-date"))),
          codeOf(hub.lockBatch(LockBatchRequest.make({ batchId: "sitting-empty" }))),
        ]);
        expect(all1).toStrictEqual(["unknown-option", "not-found", "not-found", "not-found"]);

        const lock = yield* hub.lockBatch(LockBatchRequest.make({ batchId: "sitting-1" }));
        assertSome(lock.lockedAt, DateTime.makeUnsafe(0));
        const all2 = yield* Effect.all([
          codeOf(hub.lockBatch(LockBatchRequest.make({ batchId: "sitting-1" }))),
          codeOf(
            hub.recordVerdict(
              RecordVerdictInput.make({ itemId: "kg-answer:hub-2", batchId: "sitting-1", verdict: "wrong" })
            )
          ),
        ]);
        expect(all2).toStrictEqual(["locked", "locked"]);
      })
    );
  });

  it.layer(hubOver(Layer.succeed(ReviewItemStore, ReviewItemStore.of(unreadable))), { timeout: "10 seconds" })(
    "unreadable item store",
    (it) => {
      it.effect(
        "reports store-unavailable without the store's diagnostic",
        Effect.fnUntraced(function* () {
          const failure = yield* Effect.flip((yield* ReviewHub).openItems(today));

          expect(failure.code).toBe("store-unavailable");
          expect(failure.message).toBe("The review store failed to read (ReviewItemStoreError).");
        })
      );
    }
  );
});
