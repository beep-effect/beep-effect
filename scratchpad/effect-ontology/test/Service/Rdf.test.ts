import { IRI } from "@beep/rdf";
import { assert, describe, it } from "@effect/vitest";
import { ConfigProvider, Effect, Exit, Layer } from "effect";
import { RdfBuilder, rdfStoreSize, rdfStoreToDataset } from "../../Service/Rdf.ts";

const RdfBuilderTest = RdfBuilder.Default.pipe(
  Layer.provide(
    ConfigProvider.layer(
      ConfigProvider.fromUnknown({
        LLM: { API_KEY: "test-key-for-testing" },
        ONTOLOGY: { PATH: "/tmp/test-ontology.ttl" },
      })
    )
  )
);

describe("RdfBuilder", () => {
  it.layer(RdfBuilderTest)("with the canonical RDF service", (it) => {
    it.effect("validates strings at the canonical IRI construction boundary", () =>
      Effect.gen(function* () {
        const rdf = yield* RdfBuilder;
        const valid = rdf.createIri("https://example.org/resource");
        const invalid = yield* Effect.exit(Effect.sync(() => rdf.createIri("not an iri")));

        assert.isTrue(IRI.is(valid));
        assert.isTrue(Exit.isFailure(invalid));
      })
    );

    it.effect("round-trips Turtle through the canonical N3 codec", () =>
      Effect.gen(function* () {
        const rdf = yield* RdfBuilder;
        const store = yield* rdf.parseTurtle('<https://example.org/ada> <https://schema.org/name> "Ada" .');
        const source = yield* rdf.toTurtle(store);
        const reparsed = yield* rdf.parseTurtle(source);

        assert.strictEqual(rdfStoreSize(reparsed), 1);
        assert.isFalse("_store" in reparsed);
        assert.strictEqual(rdfStoreToDataset(reparsed).quads.length, 1);
      })
    );
  });
});
