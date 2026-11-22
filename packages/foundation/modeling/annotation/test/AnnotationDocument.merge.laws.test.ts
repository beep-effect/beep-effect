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
import * as HashMap from "effect/HashMap";
import * as HashSet from "effect/HashSet";
import * as O from "effect/Option";
import * as Order from "effect/Order";
import * as Result from "effect/Result";
import { codec, fixtureGeneration, fixtureParts, fixtureSource } from "./support/fixtures.ts";
import { mergeTripleCase } from "./support/generators.ts";
import type { AnnotationId } from "@beep/annotation/AnnotationId";

const runs = { arbitrary: fcRuns(200) };

const pairsOf = <Value>([a, b, c]: readonly [Value, Value, Value]) =>
  [
    [a, b],
    [b, c],
    [a, c],
  ] as const;

// The generation set of one annotation in a document, empty when it is absent.
const generationsOf = (document: TextDocument, id: AnnotationId) =>
  O.getOrElse(HashMap.get(document.attribution, id), HashSet.empty);

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
        // A refusal is the same value in either argument order.
        assertEquals(merge(right, left), forward);
        assertEquals(merge(right)(left), forward);
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
    })
  );
});
