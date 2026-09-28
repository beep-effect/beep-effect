import { OxigraphSparqlQueryServiceLive } from "@beep/oxigraph";
import { makeDataset, makeLiteral, makeNamedNode, makeQuad } from "@beep/rdf/Rdf";
import { SparqlQueryRequest, SparqlQueryService } from "@beep/semantic-web/services/sparql-query";
import { it } from "@beep/test-runner";
import { expect } from "@effect/vitest";
import { Effect } from "effect";
import { vi } from "vitest";

const engine = vi.hoisted(() => ({ imports: 0, constructions: 0, loadedQuads: 0 }));
vi.mock("oxigraph", (importOriginal) =>
  importOriginal<typeof import("oxigraph")>().then((actual) => {
    engine.imports += 1;
    return {
      ...actual,
      Store: class extends actual.Store {
        constructor(...args: ConstructorParameters<typeof actual.Store>) {
          super(...args);
          engine.constructions += 1;
        }
        override add(quad: Parameters<InstanceType<typeof actual.Store>["add"]>[0]): void {
          engine.loadedQuads += 1;
          super.add(quad);
        }
      },
    };
  })
);
const importObservation = { imports: engine.imports, constructions: engine.constructions };

it.layer(OxigraphSparqlQueryServiceLive, { timeout: "30 seconds" })("@beep/oxigraph lazy service surface", (it) => {
  it.effect(
    "imports the live layer without constructing an Oxigraph store",
    Effect.fnUntraced(function* () {
      expect(OxigraphSparqlQueryServiceLive).toBeDefined();
      expect(importObservation).toEqual({ imports: 0, constructions: 0 });
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
      expect(engine.imports).toBe(1);
      expect(engine.constructions).toBe(1);
      expect(engine.loadedQuads).toBe(dataset.quads.length);
      expect(first.profile).toBe("select");
      if (first.profile === "select") {
        expect(first.rows).toHaveLength(1);
      }

      const differentDataset = makeDataset([
        makeQuad(
          makeNamedNode("https://example.test/bob"),
          makeNamedNode("https://example.test/name"),
          makeLiteral("Bob", "http://www.w3.org/2001/XMLSchema#string")
        ),
      ]);
      const different = yield* sparql.execute(
        SparqlQueryRequest.make({ dataset: differentDataset, profile: "select", query: request.query })
      );
      expect(engine.constructions).toBe(2);
      expect(engine.loadedQuads).toBe(dataset.quads.length + differentDataset.quads.length);
      expect(different.profile).toBe("select");
      if (different.profile === "select") {
        expect(different.rows).toHaveLength(0);
      }
    })
  );
});
