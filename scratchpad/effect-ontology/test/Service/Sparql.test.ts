import { OxigraphSparqlQueryServiceLive } from "@beep/oxigraph";
import * as Rdf from "@beep/rdf/Rdf";
import { SparqlQueryRequest, SparqlQueryService } from "@beep/semantic-web/services/sparql-query";
import { assert, describe, it } from "@effect/vitest";
import { Effect } from "effect";

describe("canonical SPARQL adapter", () => {
  it.layer(OxigraphSparqlQueryServiceLive)("with the canonical Oxigraph adapter", (it) => {
    it.effect(
      "returns the semantic-web ASK result contract",
      Effect.fnUntraced(function* () {
        const sparql = yield* SparqlQueryService;
        const result = yield* sparql.execute(
          SparqlQueryRequest.make({
            query: "ASK { ?s ?p ?o }",
            profile: "ask",
            dataset: Rdf.makeDataset([
              Rdf.makeQuad(
                Rdf.makeNamedNode("https://example.org/ada"),
                Rdf.makeNamedNode("https://schema.org/name"),
                Rdf.makeLiteral("Ada", "https://www.w3.org/2001/XMLSchema#string")
              ),
            ]),
          })
        );

        assert.strictEqual(result.profile, "ask");
        if (result.profile === "ask") assert.isTrue(result.value);
      })
    );
  });
});
