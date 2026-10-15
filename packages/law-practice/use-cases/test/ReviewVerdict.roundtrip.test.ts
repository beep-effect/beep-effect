/**
 * S5 round trip for the attorney review envelope: a decoded claim finding
 * moves through the review queue (record, superseding revision, lock) and the
 * pure verdict projector turns its final verdict into a claim-disposition
 * projection. Timestamps come from `TestClock`, so every `recordedAt` is fixed.
 */

import { ReviewItem } from "@beep/law-practice-domain/values/ReviewItem";
import { VerdictRow } from "@beep/law-practice-domain/values/VerdictRow";
import {
  RecordVerdictInput,
  ReviewQueue,
  ReviewQueueLive,
  VerdictBatchLockedError,
} from "@beep/law-practice-use-cases/ReviewQueue";
import { VerdictLogMemory } from "@beep/law-practice-use-cases/test";
import {
  ATTORNEY_CONFIRMED_REASON,
  ATTORNEY_REJECTED_REASON,
  ClaimDispositionProjection,
  VerdictProjector,
  VerdictProjectorLive,
} from "@beep/law-practice-use-cases/VerdictProjector";
import { Principal } from "@beep/shared-domain/entity/Principal";
import { it } from "@beep/test-runner";
import { fcRuns } from "@beep/test-utils";
import { describe, expect } from "@effect/vitest";
import { assertNone, assertSome, assertTrue } from "@effect/vitest/utils";
import * as Arbitrary from "effect/Arbitrary";
import * as A from "effect/Array";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import { pipe } from "effect/Function";
import * as Layer from "effect/Layer";
import * as Match from "effect/Match";
import * as O from "effect/Option";
import * as Order from "effect/Order";
import * as S from "effect/Schema";
import * as TestClock from "effect/testing/TestClock";

const decodeItem = S.decodeUnknownEffect(ReviewItem);
const decodeClaimFinding = S.decodeUnknownEffect(ReviewItem.cases["claim-finding"]);
const isLockedError = S.is(VerdictBatchLockedError);
const decodePrincipal = S.decodeUnknownEffect(Principal);
const sameProjections = S.toEquivalence(S.Array(ClaimDispositionProjection));

const TestLayer = Layer.mergeAll(ReviewQueueLive.pipe(Layer.provide(VerdictLogMemory)), VerdictProjectorLive);

const BATCH_A = "sitting-2026-10-14-a";
const BATCH_B = "sitting-2026-10-14-b";
const FINDING_ID = "claim-finding:1";
const CLAIM_ID = 7;
const NOTE = "The reference shows a latch, not a hinge.";

const T_WRONG = 1_760_400_000_000;
const T_RIGHT = 1_760_400_060_000;
const T_LOCK = 1_760_400_120_000;
const T_BATCH_B = 1_760_400_180_000;

const encodedItem = (kind: string, itemId: string) => ({
  kind,
  itemId,
  text: "Claim 1 element (b) is disclosed by the cited reference.",
  sourceRefs: [{ boxFileId: "1234567890", quote: { exact: "a hinge coupling the lid to the base" } }],
  ...(kind === "claim-finding" ? { claimId: CLAIM_ID } : {}),
});

const claimFinding = decodeClaimFinding(encodedItem("claim-finding", FINDING_ID));

const attorney = decodePrincipal({ kind: "User", userId: 1 });

const verdictAt = Effect.fnUntraced(function* (at: number, input: RecordVerdictInput) {
  yield* TestClock.setTime(at);
  const queue = yield* ReviewQueue;
  return yield* queue.recordVerdict(input);
});

// Reference recency order for the property test: rows sorted stably by
// `recordedAt`, then `revision`, so the last row is the latest and a full tie
// goes to the row appended last.
// Stable sort: rows that tie on `recordedAt` keep their append order.
const byRecency: Order.Order<VerdictRow> = Order.mapInput(DateTime.Order, (row: VerdictRow) => row.recordedAt);

const finding = (
  batchId: string,
  verdict: "right" | "wrong" | "partly" | "withdrawn",
  note: O.Option<string> = O.none()
) => RecordVerdictInput.make({ itemId: FINDING_ID, batchId, verdict, note });

describe("@beep/law-practice-use-cases review verdict round trip", () => {
  it.layer(TestLayer, { timeout: "10 seconds" })("superseded and locked batch", (it) => {
    it.effect(
      "records, supersedes and locks a verdict, then projects the confirmed finding",
      Effect.fnUntraced(function* () {
        const queue = yield* ReviewQueue;
        const projector = yield* VerdictProjector;
        const item = yield* claimFinding;
        expect(yield* decodeItem(encodedItem("claim-finding", FINDING_ID))).toStrictEqual(item);
        const other = yield* decodeItem(encodedItem("kg-answer", "kg-answer:1"));
        const resolvedBy = yield* attorney;

        expect(yield* queue.openItems([item, other])).toStrictEqual([item, other]);

        const wrong = yield* verdictAt(T_WRONG, finding(BATCH_A, "wrong", O.some(NOTE)));
        expect(wrong.revision).toBe(1);
        expect(yield* queue.openItems([item])).toStrictEqual([]);

        const right = yield* verdictAt(T_RIGHT, finding(BATCH_A, "right"));
        expect(right.revision).toBe(2);
        expect(DateTime.toEpochMillis(right.recordedAt)).toBe(T_RIGHT);

        const afterUndo = yield* queue.readLog;
        expect(afterUndo).toHaveLength(2);
        expect(afterUndo[0]).toStrictEqual(wrong);
        assertSome(
          O.flatMap(A.get(afterUndo, 0), (row) => row.note),
          NOTE
        );

        yield* TestClock.setTime(T_LOCK);
        const lock = yield* queue.lockBatch(BATCH_A);
        expect(lock.revision).toBe(3);
        expect(lock.verdict).toBe("right");
        expect(DateTime.toEpochMillis(lock.recordedAt)).toBe(T_RIGHT);
        assertSome(O.map(lock.lockedAt, DateTime.toEpochMillis), T_LOCK);

        const rejected = yield* Effect.flip(verdictAt(T_BATCH_B, finding(BATCH_A, "wrong")));
        const lockedError = yield* rejected.pipe(O.liftPredicate(isLockedError), Effect.fromOption);
        expect(lockedError.batchId).toBe(BATCH_A);
        expect(DateTime.toEpochMillis(lockedError.lockedAt)).toBe(T_LOCK);

        const relock = yield* Effect.flip(queue.lockBatch(BATCH_A));
        expect(relock._tag).toBe("VerdictBatchLockedError");

        const emptyLock = yield* Effect.flip(queue.lockBatch("sitting-2026-10-14-empty"));
        expect(emptyLock._tag).toBe("VerdictBatchEmptyError");

        const lockedProjection = projector.projectItem({ item, resolvedBy, rows: yield* queue.readLog });
        assertSome(
          O.map(lockedProjection, (p) => DateTime.toEpochMillis(p.resolvedAt)),
          T_RIGHT
        );

        const inB = yield* verdictAt(
          T_BATCH_B,
          RecordVerdictInput.make({ itemId: "kg-answer:1", batchId: BATCH_B, verdict: "right" })
        );
        expect(inB.revision).toBe(1);
        assertNone(inB.lockedAt);

        const sameItemInB = yield* verdictAt(T_BATCH_B, finding(BATCH_B, "right"));
        expect(sameItemInB.revision).toBe(1);
        expect(sameItemInB.batchId).toBe(BATCH_B);

        const rows = yield* queue.readLog;
        expect(rows).toHaveLength(5);

        const projections = projector.project({ items: [item, other], resolvedBy, rows });
        expect(projections).toHaveLength(1);
        const projection = yield* Effect.fromOption(A.head(projections));
        expect(projection.claimId).toBe(CLAIM_ID);
        expect(projection.status).toBe("active");
        expect(projection.reason).toBe(ATTORNEY_CONFIRMED_REASON);
        expect(DateTime.toEpochMillis(projection.resolvedAt)).toBe(T_BATCH_B);
        expect(projection.resolvedBy).toStrictEqual(resolvedBy);
        expect(projection.violations).toStrictEqual([]);

        assertTrue(sameProjections(projections, projector.project({ items: [item, other], resolvedBy, rows })));
        const single = O.toArray(projector.projectItem({ item, resolvedBy, rows }));
        assertTrue(sameProjections(single, projections));
      })
    );
  });

  it.layer(TestLayer, { timeout: "10 seconds" })("final wrong with a note", (it) => {
    it.effect(
      "projects a final wrong verdict with a note as rejected with the note as the reason",
      Effect.fnUntraced(function* () {
        const queue = yield* ReviewQueue;
        const projector = yield* VerdictProjector;
        const item = yield* claimFinding;
        const resolvedBy = yield* attorney;

        yield* verdictAt(T_RIGHT, finding(BATCH_A, "right"));
        const deciding = yield* verdictAt(T_LOCK, finding(BATCH_A, "wrong", O.some(NOTE)));

        const projections = projector.project({ items: [item], resolvedBy, rows: yield* queue.readLog });
        expect(A.map(projections, (p) => [p.status, p.reason])).toStrictEqual([["rejected", NOTE]]);
        expect(A.map(projections, (p) => DateTime.toEpochMillis(p.resolvedAt))).toStrictEqual([
          DateTime.toEpochMillis(deciding.recordedAt),
        ]);
      })
    );
  });

  it.layer(TestLayer, { timeout: "10 seconds" })("final wrong without a note", (it) => {
    it.effect(
      "projects a final wrong verdict without a note with the fixed reject reason",
      Effect.fnUntraced(function* () {
        const queue = yield* ReviewQueue;
        const projector = yield* VerdictProjector;
        const item = yield* claimFinding;
        const resolvedBy = yield* attorney;

        yield* verdictAt(T_WRONG, finding(BATCH_A, "wrong"));

        const projections = projector.project({ items: [item], resolvedBy, rows: yield* queue.readLog });
        expect(A.map(projections, (p) => [p.status, p.reason])).toStrictEqual([["rejected", ATTORNEY_REJECTED_REASON]]);
      })
    );
  });

  it.layer(TestLayer, { timeout: "10 seconds" })("final partly", (it) => {
    it.effect(
      "leaves a final partly verdict unprojected and returns the item to the queue",
      Effect.fnUntraced(function* () {
        const queue = yield* ReviewQueue;
        const projector = yield* VerdictProjector;
        const item = yield* claimFinding;
        const resolvedBy = yield* attorney;

        yield* verdictAt(T_WRONG, finding(BATCH_A, "right"));
        expect(yield* queue.openItems([item])).toStrictEqual([]);

        yield* verdictAt(T_RIGHT, finding(BATCH_B, "partly"));
        const rows = yield* queue.readLog;

        expect(projector.project({ items: [item], resolvedBy, rows })).toStrictEqual([]);
        assertNone(projector.projectItem({ item, resolvedBy, rows }));
        expect(yield* queue.openItems([item])).toStrictEqual([item]);
        assertTrue(
          sameProjections(
            projector.project({ items: [item], resolvedBy, rows }),
            projector.project({ items: [item], resolvedBy, rows })
          )
        );
      })
    );
  });

  it.layer(TestLayer, { timeout: "10 seconds" })("question items", (it) => {
    it.effect(
      "never lists a question item as open, even with no verdict rows",
      Effect.fnUntraced(function* () {
        const queue = yield* ReviewQueue;
        const item = yield* claimFinding;
        const question = yield* S.decodeEffect(ReviewItem.cases.question)({
          kind: "question",
          itemId: "question:1",
          text: "Which due date should be docketed?",
          sourceRefs: [],
          facts: [],
          options: [
            { optionId: "use-stated", label: "Use the stated date" },
            { optionId: "handle-myself", label: "I'll handle it" },
          ],
        });

        expect(yield* queue.openItems([question, item])).toStrictEqual([item]);
      })
    );
  });

  it.layer(TestLayer, { timeout: "10 seconds" })("withdrawn verdict", (it) => {
    it.effect(
      "withdraws an accidental wrong in the same batch, keeps both rows, and reopens the item",
      Effect.fnUntraced(function* () {
        const queue = yield* ReviewQueue;
        const projector = yield* VerdictProjector;
        const item = yield* claimFinding;
        const resolvedBy = yield* attorney;

        yield* verdictAt(T_WRONG, finding(BATCH_A, "wrong"));
        expect(yield* queue.openItems([item])).toStrictEqual([]);

        yield* verdictAt(T_RIGHT, finding(BATCH_A, "withdrawn"));
        const rows = yield* queue.readLog;

        expect(A.map(rows, (row) => [row.verdict, row.revision])).toStrictEqual([
          ["wrong", 1],
          ["withdrawn", 2],
        ]);
        expect(projector.project({ items: [item], resolvedBy, rows })).toStrictEqual([]);
        assertNone(projector.projectItem({ item, resolvedBy, rows }));
        expect(yield* queue.openItems([item])).toStrictEqual([item]);
      })
    );
  });

  it.layer(TestLayer, { timeout: "10 seconds" })("lock row on a timestamp tie", (it) => {
    it.effect(
      "keeps the later batch's verdict when an earlier batch is locked at the same recordedAt",
      Effect.fnUntraced(function* () {
        const queue = yield* ReviewQueue;
        const projector = yield* VerdictProjector;
        const item = yield* claimFinding;
        const resolvedBy = yield* attorney;

        yield* verdictAt(T_WRONG, finding(BATCH_A, "right"));
        yield* verdictAt(T_WRONG, finding(BATCH_B, "wrong"));
        yield* TestClock.setTime(T_LOCK);
        yield* queue.lockBatch(BATCH_A);
        const rows = yield* queue.readLog;

        expect(A.map(projector.project({ items: [item], resolvedBy, rows }), (p) => p.status)).toStrictEqual([
          "rejected",
        ]);
        expect(yield* queue.openItems([item])).toStrictEqual([]);
      })
    );
  });

  it.layer(TestLayer, { timeout: "10 seconds" })("cross-batch tie", (it) => {
    it.effect(
      "gives a tie on recordedAt to the row appended last",
      Effect.fnUntraced(function* () {
        const queue = yield* ReviewQueue;
        const projector = yield* VerdictProjector;
        const item = yield* claimFinding;
        const resolvedBy = yield* attorney;

        const first = yield* verdictAt(T_WRONG, finding(BATCH_A, "right"));
        const second = yield* verdictAt(T_WRONG, finding(BATCH_B, "partly"));
        expect([first.revision, second.revision]).toStrictEqual([1, 1]);
        assertTrue(DateTime.Equivalence(first.recordedAt, second.recordedAt));

        const rows = yield* queue.readLog;
        expect(yield* queue.openItems([item])).toStrictEqual([item]);
        expect(projector.project({ items: [item], resolvedBy, rows })).toStrictEqual([]);
      })
    );
  });

  it.layer(TestLayer, { timeout: "10 seconds" })("revision tie across batches", (it) => {
    it.effect(
      "never lets a higher revision in another batch win a recordedAt tie",
      Effect.fnUntraced(function* () {
        const queue = yield* ReviewQueue;
        const projector = yield* VerdictProjector;
        const item = yield* claimFinding;
        const resolvedBy = yield* attorney;

        yield* verdictAt(T_WRONG, finding(BATCH_A, "wrong"));
        const revised = yield* verdictAt(T_WRONG, finding(BATCH_A, "right"));
        const other = yield* verdictAt(T_WRONG, finding(BATCH_B, "wrong"));
        expect([revised.revision, other.revision]).toStrictEqual([2, 1]);

        const rows = yield* queue.readLog;
        expect(A.map(projector.project({ items: [item], resolvedBy, rows }), (p) => p.status)).toStrictEqual([
          "rejected",
        ]);
      })
    );
  });

  it.layer(VerdictProjectorLive, { timeout: "10 seconds" })("projection properties", (it) => {
    it.effect.prop(
      "projects exactly the latest row's final verdict, independent of the order of distinct rows",
      {
        item: Arbitrary.schema(ReviewItem.cases["claim-finding"]),
        rows: VerdictRow.pipe(S.Array, Arbitrary.schema),
      },
      Effect.fnUntraced(function* ({ item, rows }) {
        const projector = yield* VerdictProjector;
        const resolvedBy = yield* attorney;
        const own = A.map(rows, (row) => VerdictRow.make({ ...row, itemId: item.itemId }));
        const judgements = A.filter(own, (row) => O.isNone(row.lockedAt));

        const expected = pipe(
          A.last(A.sort(judgements, byRecency)),
          O.flatMap((latest) =>
            Match.value(latest.verdict).pipe(
              Match.when("right", () =>
                O.some({ status: "active" as const, reason: ATTORNEY_CONFIRMED_REASON, latest })
              ),
              Match.when("wrong", () =>
                O.some({
                  status: "rejected" as const,
                  reason: O.getOrElse(latest.note, () => ATTORNEY_REJECTED_REASON),
                  latest,
                })
              ),
              Match.orElse(() => O.none())
            )
          ),
          O.map(({ latest, reason, status }) =>
            ClaimDispositionProjection.make({
              claimId: item.claimId,
              status,
              reason,
              resolvedAt: latest.recordedAt,
              resolvedBy,
            })
          ),
          O.toArray
        );

        const projections = projector.project({ items: [item], resolvedBy, rows: own });
        assertTrue(sameProjections(projections, expected));
        assertTrue(sameProjections(O.toArray(projector.projectItem({ item, resolvedBy, rows: own })), expected));

        const hasFullTie = A.some(own, (row, i) => A.some(own, (other, j) => i !== j && byRecency(row, other) === 0));
        if (!hasFullTie) {
          assertTrue(sameProjections(projector.project({ items: [item], resolvedBy, rows: A.reverse(own) }), expected));
        }
      }),
      { arbitrary: fcRuns(50) }
    );
  });
});
