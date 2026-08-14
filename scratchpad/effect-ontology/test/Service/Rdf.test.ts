import { Confidence } from "@beep/epistemic-domain/values/EvidenceSpan";
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

    it.effect("serializes canonically branded confidence as RDF reification", () =>
      Effect.gen(function* () {
        const rdf = yield* RdfBuilder;
        const store = yield* rdf.createStore;
        yield* rdf.addTripleWithConfidence(
          store,
          {
            subject: "https://example.org/subject",
            predicate: "https://example.org/predicate",
            object: "value",
          },
          Confidence.make(0.8)
        );
        const serialized = yield* rdf.toTurtle(store);

        assert.strictEqual(rdfStoreSize(store), 6);
        assert.include(serialized, "rdf:Statement");
        assert.include(serialized, "rdf:subject");
        assert.include(serialized, "rdf:predicate");
        assert.include(serialized, "rdf:object");
        assert.include(serialized, "0.8");
        assert.strictEqual(Reflect.ownKeys(store).length, 2);
        assert.isFalse("_store" in store);
      })
    );

    it.effect("maps unsupported named graphs to SerializationFailed", () =>
      Effect.gen(function* () {
        const rdf = yield* RdfBuilder;
        const store = yield* rdf.createStore;
        yield* rdf.addTripleWithConfidence(
          store,
          {
            subject: "https://example.org/subject",
            predicate: "https://example.org/predicate",
            object: "value",
          },
          Confidence.make(0.8),
          "https://example.org/graph"
        );
        const error = yield* rdf.toTurtle(store).pipe(Effect.flip);

        assert.strictEqual(error._tag, "SerializationFailed");
        assert.include(error.message, "default graph");
      })
    );
  });
});
