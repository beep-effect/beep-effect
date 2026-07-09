import { N3ParseTurtleRequest, N3SerializeTurtleRequest, N3TurtleCodec, N3TurtleCodecLive } from "@beep/n3";
import { makeDataset, makeLiteral, makeNamedNode, makeQuad } from "@beep/rdf/Rdf";
import { XSD_STRING } from "@beep/rdf/Vocab/Xsd";
import { describe, expect, it } from "@effect/vitest";
import { Effect, Layer } from "effect";

const provideScopedLayer =
  <ROut, E2, RIn>(layer: Layer.Layer<ROut, E2, RIn>) =>
  <A, E, R>(effect: Effect.Effect<A, E, R>): Effect.Effect<A, E | E2, RIn | Exclude<R, ROut>> =>
    Effect.scoped(Layer.build(layer).pipe(Effect.flatMap((context) => effect.pipe(Effect.provide(context)))));

describe("N3TurtleCodec", () => {
  it.effect(
    "parses and serializes Turtle over @beep/rdf values",
    Effect.fnUntraced(function* () {
      const source = `
          @prefix ex: <https://example.test/> .
          ex:alice ex:name "Alice" .
        `;
      const codec = yield* N3TurtleCodec;
      const parsed = yield* codec.parse(N3ParseTurtleRequest.make({ source }));
      const serialized = yield* codec.serialize(N3SerializeTurtleRequest.make({ dataset: parsed.dataset }));

      expect(parsed.dataset.quads).toHaveLength(1);
      expect(serialized.source).toContain("Alice");
    }, provideScopedLayer(N3TurtleCodecLive))
  );

  it.effect(
    "rejects named graph quads for Turtle serialization",
    Effect.fnUntraced(function* () {
      const dataset = makeDataset([
        makeQuad(makeNamedNode("https://example.test/alice"), makeNamedNode("https://example.test/name"), {
          object: makeLiteral("Alice", XSD_STRING.value),
          graph: makeNamedNode("https://example.test/graph"),
        }),
      ]);
      const codec = yield* N3TurtleCodec;
      const error = yield* codec.serialize(N3SerializeTurtleRequest.make({ dataset })).pipe(Effect.flip);

      expect(error).toMatchObject({
        reason: "unsupportedGraph",
      });
    }, provideScopedLayer(N3TurtleCodecLive))
  );
});
