import { TextDocument } from "@beep/annotation/Kinds";
import { GenerationTimeConflict, merge } from "@beep/annotation/Merge";
import { fcRuns } from "@beep/fc-runs";
import { it } from "@beep/test-runner";
import { CaptureMismatch } from "@beep/text/LocatorMap";
import { SourceTextIdentity } from "@beep/text/SourceTextIdentity";
import { assertEquals } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as Digest from "effect/crypto/Digest";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as Equal from "effect/Equal";
import * as HashMap from "effect/HashMap";
import * as HashSet from "effect/HashSet";
import * as O from "effect/Option";
import * as Order from "effect/Order";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import { codec, fixtureGeneration, fixtureParts, fixtureSource } from "./support/fixtures.ts";
import { activityIdOf, mergeTripleCase } from "./support/generators.ts";
import type { AnnotationId } from "@beep/annotation/AnnotationId";

const runs = { arbitrary: fcRuns(200) };

const pairsOf = <Value>([a, b, c]: readonly [Value, Value, Value]) =>
  [
    [a, b],
    [b, c],
    [a, c],
  ] as const;

const generationsOf = (document: TextDocument, id: AnnotationId) =>
  O.getOrElse(HashMap.get(document.attribution, id), HashSet.empty);

const sameCapture = S.toEquivalence(SourceTextIdentity);

const timeOrder: Order.Order<O.Option<DateTime.Utc>> = O.makeOrder(DateTime.Order);

const conflictOrder = Order.mapInput(Order.Array(Order.String), (conflict: GenerationTimeConflict) => [
  conflict.annotation,
  conflict.activity,
]);

const timed = (document: TextDocument) =>
  A.flatMap(A.fromIterable(document.attribution), ([annotation, generations]) =>
    A.map(A.fromIterable(generations), ({ activity, at }) => ({ annotation, activity, at }))
  );

const leastConflictReadFromDesign = (left: TextDocument, right: TextDocument): O.Option<GenerationTimeConflict> =>
  A.head(
    A.sort(
      A.flatMap(timed(left), (l) =>
        A.flatMap(timed(right), (r) =>
          l.annotation === r.annotation && l.activity === r.activity && !Equal.equals(l.at, r.at)
            ? [
                GenerationTimeConflict.make({
                  annotation: l.annotation,
                  activity: l.activity,
                  left: Order.min(timeOrder)(l.at, r.at),
                  right: Order.max(timeOrder)(l.at, r.at),
                }),
              ]
            : []
        )
      ),
      conflictOrder
    )
  );

const emptyOn = (text: SourceTextIdentity) =>
  TextDocument.make({ text, anchors: HashMap.empty(), annotations: HashMap.empty(), attribution: HashMap.empty() });

it.layer(Digest.layerWebCrypto, { timeout: "20 seconds" })("@beep/annotation merge", (it) => {
  it.prop(
    "L2-1 merge over one capture is idempotent, commutative and associative and unions attribution",
    [mergeTripleCase],
    ([{ triple }]) => {
      const [a, b, c] = triple;
      for (const document of triple) {
        assertEquals(merge(document, document), Result.succeed(document));
      }
      for (const [left, right] of pairsOf(triple)) {
        const forward = merge(left, right);
        assertEquals(merge(right, left), forward, "a refusal is the same value in either argument order");
        assertEquals(merge(right)(left), forward, "a refusal is the same value in either argument order");
        if (sameCapture(left.text, right.text)) {
          assertEquals(
            Result.getFailure(forward),
            leastConflictReadFromDesign(left, right),
            "over one capture, the refusal is the least (annotation, activity) pair timed twice, the earlier time on the left"
          );
        }
        Result.match(forward, {
          onFailure: () => undefined,
          onSuccess: (merged) => {
            assertEquals(merged.anchors, HashMap.union(left.anchors, right.anchors));
            assertEquals(merged.annotations, HashMap.union(left.annotations, right.annotations));
            for (const id of HashMap.keys(merged.annotations)) {
              assertEquals(generationsOf(merged, id), HashSet.union(generationsOf(left, id), generationsOf(right, id)));
            }
          },
        });
      }
      const leftFirst = Result.flatMap(merge(a, b), merge(c));
      const rightFirst = Result.flatMap(merge(b, c), (bc) => merge(a, bc));
      Result.match(Result.all([leftFirst, rightFirst]), {
        onFailure: () => undefined,
        onSuccess: ([ab, bc]) => assertEquals(ab, bc),
      });
    },
    runs
  );

  it.effect(
    "L2-1 merge refuses two captures with the same value in either order",
    Effect.fnUntraced(function* () {
      const document = yield* codec.assemble(fixtureParts);
      const other = emptyOn(SourceTextIdentity.make({ ...fixtureSource, scopeRef: "matter:other" }));
      const expected = CaptureMismatch.make({ left: fixtureSource, right: other.text });
      assertEquals(merge(document, other), Result.fail(expected));
      assertEquals(merge(other, document), Result.fail(expected));
    })
  );

  it.effect(
    "L2-1 merge refuses one pair with two times with the least conflict, the earlier time on the left",
    Effect.fnUntraced(function* () {
      const later = DateTime.makeUnsafe(1_763_600_000_000);
      const earlier = yield* codec.assemble(fixtureParts);
      const restated = yield* codec.assemble({
        ...fixtureParts,
        generation: { ...fixtureGeneration, at: O.some(later) },
      });
      const unstated = yield* codec.assemble({ ...fixtureParts, generation: { ...fixtureGeneration, at: O.none() } });
      const least = earlier.annotations.pipe(HashMap.keys, A.fromIterable, A.sort(Order.String), A.head, O.getOrThrow);
      const conflict = (left: O.Option<DateTime.Utc>, right: O.Option<DateTime.Utc>) =>
        Result.fail(
          GenerationTimeConflict.make({ annotation: least, activity: fixtureGeneration.activity, left, right })
        );
      for (const [left, right, expected] of [
        [earlier, restated, conflict(fixtureGeneration.at, O.some(later))],
        [restated, unstated, conflict(O.none(), O.some(later))],
      ] as const) {
        assertEquals(merge(left, right), expected);
        assertEquals(merge(right, left), expected);
      }
      const earlierOnTheLeftWhicheverIteratesFirst =
        "one activity per seed, so the pair's two generations iterate in either order across seeds; the earlier time is on the left";
      for (const seed of ["a", "b", "c", "d", "e", "f", "g", "h"]) {
        const generation = { activity: activityIdOf(`conflict-${seed}`), at: O.some(later) };
        const late = yield* codec.assemble({ ...fixtureParts, generation });
        const early = yield* codec.assemble({
          ...fixtureParts,
          generation: { ...generation, at: fixtureGeneration.at },
        });
        const expected = Result.fail(
          GenerationTimeConflict.make({
            annotation: least,
            activity: generation.activity,
            left: fixtureGeneration.at,
            right: O.some(later),
          })
        );
        assertEquals(merge(early, late), expected, earlierOnTheLeftWhicheverIteratesFirst);
        assertEquals(merge(late, early), expected, earlierOnTheLeftWhicheverIteratesFirst);
      }
    })
  );
});
