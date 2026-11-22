import { AnnotationId, GenerationPreimage, RunEntityId } from "@beep/annotation/AnnotationId";
import { Generation, mintRunEntityId } from "@beep/annotation/Generation";
import { fcRuns } from "@beep/fc-runs";
import { ActivityId } from "@beep/schema/ContentHash";
import { it } from "@beep/test-runner";
import { expect } from "@effect/vitest";
import * as A from "effect/Array";
import * as Digest from "effect/crypto/Digest";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import { flow } from "effect/Function";
import * as HashMap from "effect/HashMap";
import * as HashSet from "effect/HashSet";
import * as O from "effect/Option";
import * as Order from "effect/Order";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import { codec } from "./support/fixtures.ts";
import { activityIdOf, documentCase, generationOf } from "./support/generators.ts";
import type { TextDocument } from "@beep/annotation/Kinds";

const runs = { arbitrary: fcRuns(60) };

const encodeGeneration = flow(S.encodeResult(Generation), Result.getOrThrow);

const generationsOf = (document: TextDocument): ReadonlyArray<Generation> =>
  A.flatMap(document.attribution.pipe(HashMap.values, A.fromIterable), A.fromIterable);

// The least annotation key of a document, so a modification is a function of the document alone.
const leastKey = (document: TextDocument): AnnotationId =>
  document.annotations.pipe(HashMap.keys, A.fromIterable, A.sort(Order.String), A.head, O.getOrThrow);

it.layer(Digest.layerWebCrypto, { timeout: "20 seconds" })("@beep/annotation generations", (it) => {
  it.effect.prop(
    "L2-3 every annotation is attributed and each content and activity pair is one generation",
    [documentCase],
    ([{ document }]) =>
      Effect.gen(function* () {
        for (const id of HashMap.keys(document.annotations)) {
          expect(document.attribution.pipe(HashMap.get(id), O.exists(flow(HashSet.size, (size) => size > 0)))).toBe(
            true
          );
        }
        const encoded = yield* codec.encode(document);
        yield* codec.decode(encoded);
        const key = leastKey(document);
        const generation = document.attribution.pipe(HashMap.get(key), O.getOrThrow, A.fromIterable, A.getUnsafe(0));
        // The annotation with no generation: its attribution row removed.
        const unattributed = { ...encoded, attribution: A.filter(encoded.attribution, ([id]) => id !== key) };
        // A second generation for one (content, activity) pair, at another time.
        const later = generation.at.pipe(O.match({ onNone: () => 0, onSome: (at) => DateTime.toEpochMillis(at) + 1 }));
        const second = generationOf({
          content: key,
          activity: generation.activity,
          at: O.some(DateTime.makeUnsafe(later)),
        });
        const twice = {
          ...encoded,
          attribution: A.map(encoded.attribution, ([id, generations]) =>
            id === key ? ([id, A.append(generations, encodeGeneration(second))] as const) : ([id, generations] as const)
          ),
        };
        for (const refused of [unattributed, twice]) {
          const error = yield* Effect.flip(codec.decode(refused));
          expect(S.isSchemaError(error)).toBe(true);
        }
      }),
    runs
  );

  it.effect.prop(
    "L2-3 assemble gives every annotation one generation of its activity",
    [documentCase],
    ([{ document }]) =>
      Effect.gen(function* () {
        const activity = activityIdOf("assembled");
        const at = O.some(DateTime.makeUnsafe(1_763_510_400_000));
        const assembled = yield* codec.assemble({
          text: document.text,
          generation: { activity, at },
          anchors: HashMap.values(document.anchors),
          annotations: HashMap.values(document.annotations),
        });
        expect(HashMap.size(assembled.attribution)).toBe(HashMap.size(document.annotations));
        for (const [id, generations] of HashMap.toEntries(assembled.attribution)) {
          expect(A.fromIterable(generations)).toEqual([generationOf({ content: id, activity, at })]);
        }
      }),
    runs
  );

  it.effect.prop(
    "L2-3 each generation's run is the generation/v1 hash of its pair",
    [documentCase],
    ([{ document }]) =>
      Effect.forEach(
        generationsOf(document),
        (generation) =>
          Effect.map(mintRunEntityId(generation.content, generation.activity), (run) =>
            expect(run).toBe(generation.run)
          ),
        { concurrency: 1, discard: true }
      ),
    runs
  );

  it.effect(
    "L2-3 the generation/v1 golden and a generation with no stated time",
    Effect.fnUntraced(function* () {
      const [content, activity] = GenerationPreimage.golden.preimage;
      const run = yield* mintRunEntityId(AnnotationId.make(content), ActivityId.make(activity));
      expect(run).toBe(RunEntityId.make(GenerationPreimage.golden.hash));
      const unstated = Generation.make({
        run,
        content: AnnotationId.make(content),
        activity: ActivityId.make(activity),
        at: O.none(),
      });
      expect(encodeGeneration(unstated)).toEqual({ run, content, activity });
      expect("at" in encodeGeneration(unstated)).toBe(false);
      expect(encodeGeneration(Generation.make({ ...unstated, at: O.some(DateTime.makeUnsafe(7)) })).at).toBe(7);
    })
  );
});
