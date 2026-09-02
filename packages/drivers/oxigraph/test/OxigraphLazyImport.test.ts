import { OxigraphSparqlQueryServiceLive } from "@beep/oxigraph";
import { makeDataset, makeLiteral, makeNamedNode, makeQuad } from "@beep/rdf/Rdf";
import { SparqlQueryRequest, SparqlQueryService } from "@beep/semantic-web/services/sparql-query";
import { describe, expect, it } from "@effect/vitest";
import { Effect, Layer } from "effect";

const provideScopedLayer =
  <ROut, E2, RIn>(layer: Layer.Layer<ROut, E2, RIn>) =>
  <A, E, R>(effect: Effect.Effect<A, E, R>): Effect.Effect<A, E | E2, RIn | Exclude<R, ROut>> =>
    Effect.scoped(Layer.build(layer).pipe(Effect.flatMap((context) => effect.pipe(Effect.provide(context)))));

describe("@beep/oxigraph lazy service surface", () => {
  it.effect(
    "imports the live layer without constructing an Oxigraph store",
    Effect.fnUntraced(function* () {
      expect(OxigraphSparqlQueryServiceLive).toBeDefined();
    })
  );

  it.effect(
    "reuses the loaded store for repeated queries over one dataset instance",
    Effect.fnUntraced(function* () {
      const dataset = makeDataset([
        makeQuad(
          makeNamedNode("https://example.test/alice"),
          makeNamedNode("https://example.test/name"),
          makeLiteral("Alice", "http://www.w3.org/2001/XMLSchema#string")
        ),
      ]);
      const request = SparqlQueryRequest.make({
        dataset,
        profile: "select",
        query: "SELECT ?name WHERE { <https://example.test/alice> <https://example.test/name> ?name }",
      });
      const sparql = yield* SparqlQueryService;
      const first = yield* sparql.execute(request);
      const second = yield* sparql.execute(request);

      expect(first).toEqual(second);
      expect(first.profile).toBe("select");
      if (first.profile === "select") {
        expect(first.rows).toHaveLength(1);
      }
    }, provideScopedLayer(OxigraphSparqlQueryServiceLive))
  );
});
