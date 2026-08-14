import { assert, describe, it } from "@effect/vitest";
import { ConfigProvider, Effect, Exit, Layer } from "effect";
import { IRI } from "../../Domain/Rdf/Types.ts";
import { RdfBuilder } from "../../Service/Rdf.ts";

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
  });
});
