import { Confidence } from "@beep/epistemic-domain/values/EvidenceSpan";
import { IRI } from "@beep/rdf";
import { assert, describe, it } from "@effect/vitest";
import { ConfigProvider, Effect, Exit, Layer } from "effect";
import { isRdfStore, RdfBuilder, rdfStoreApplyRules, rdfStoreSize, rdfStoreToDataset } from "../../Service/Rdf.ts";

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
    it.effect("validates strings at the canonical IRI construction boundary", Effect.fnUntraced(function* () {
        const rdf = yield* RdfBuilder;
        const valid = rdf.createIri("https://example.org/resource");
        const invalid = yield* Effect.exit(Effect.sync(() => rdf.createIri("not an iri")));

        assert.isTrue(IRI.is(valid));
        assert.isTrue(Exit.isFailure(invalid));
      })
    );

    it.effect("round-trips Turtle through the canonical N3 codec", Effect.fnUntraced(function* () {
        const rdf = yield* RdfBuilder;
        const store = yield* rdf.parseTurtle('<https://example.org/ada> <https://schema.org/name> "Ada" .');
        const source = yield* rdf.toTurtle(store);
        const reparsed = yield* rdf.parseTurtle(source);

        assert.strictEqual(rdfStoreSize(reparsed), 1);
        assert.isFalse("_store" in reparsed);
        assert.strictEqual(rdfStoreToDataset(reparsed).quads.length, 1);
      })
    );

    it.effect("applies RDF rules in data-first and data-last forms", Effect.fnUntraced(function* () {
        const rdf = yield* RdfBuilder;
        const dataFirstStore = yield* rdf.createStore;
        const dataLastStore = yield* rdf.createStore;

        yield* rdfStoreApplyRules(dataFirstStore, []);
        yield* rdfStoreApplyRules([])(dataLastStore);

        assert.strictEqual(rdfStoreSize(dataFirstStore), 0);
        assert.strictEqual(rdfStoreSize(dataLastStore), 0);
      })
    );

    it.effect("serializes canonically branded confidence as RDF reification", Effect.fnUntraced(function* () {
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
        assert.strictEqual(Reflect.ownKeys(store).length, 0);
        assert.isFalse("_store" in store);
      })
    );

    it.effect("maps unsupported named graphs to SerializationFailed", Effect.fnUntraced(function* () {
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

    it.effect("rejects invalid confidence triple IRIs before mutating the store", Effect.fnUntraced(function* () {
        const rdf = yield* RdfBuilder;
        const invalidInputs = [
          {
            triple: { subject: "not an iri", predicate: "https://example.org/predicate", object: "value" },
          },
          {
            triple: { subject: "https://example.org/subject", predicate: "not an iri", object: "value" },
          },
          {
            triple: {
              subject: "https://example.org/subject",
              predicate: "https://example.org/predicate",
              object: "http://[",
            },
          },
          {
            graphUri: "not an iri",
            triple: {
              subject: "https://example.org/subject",
              predicate: "https://example.org/predicate",
              object: "value",
            },
          },
        ];

        for (const input of invalidInputs) {
          const store = yield* rdf.createStore;
          const error = yield* rdf
            .addTripleWithConfidence(store, input.triple, Confidence.make(0.8), input.graphUri)
            .pipe(Effect.flip);

          assert.strictEqual(error._tag, "RdfError");
          assert.strictEqual(rdfStoreSize(store), 0);
        }
      })
    );

    it.effect("rejects detached structural copies of opaque stores", Effect.fnUntraced(function* () {
        const rdf = yield* RdfBuilder;
        const store = yield* rdf.createStore;
        const detachedStore = { ...store };
        assert.isFalse(isRdfStore(detachedStore));
      })
    );
  });
});
