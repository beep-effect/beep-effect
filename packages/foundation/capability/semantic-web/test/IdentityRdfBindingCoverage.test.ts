import { IdentityEntry, IdentityRegistry } from "@beep/identity";
import { $SemanticWebId } from "@beep/identity/packages";
import { makeBlankNode, makeDataset, makeLiteral, makeNamedNode, makeQuad } from "@beep/rdf/Rdf";
import { XSD_DOUBLE, XSD_STRING } from "@beep/rdf/Vocab/Xsd";
import {
  datasetToEntries,
  entriesToDataset,
  IdentityRdfBinding,
  IdentityShapePolicy,
  layerDataset,
  projectShapes,
} from "@beep/semantic-web";
import { assert, describe, it } from "@effect/vitest";
import { Effect, Layer } from "effect";
import type { Dataset, Quad } from "@beep/rdf/Rdf";

const entryComposer = $SemanticWebId.create("identity/coverage-entry");
const labelPath = makeNamedNode($SemanticWebId.create("identity/coverage-fibers/label").iri);
const binding = IdentityRdfBinding.make({
  identifierPath: makeNamedNode($SemanticWebId.create("identity/coverage-identifier").iri),
  curiePath: makeNamedNode($SemanticWebId.create("identity/coverage-curie").iri),
  fiberPaths: { label: labelPath },
});
const entry = IdentityEntry.fromComposer(entryComposer, { label: "Coverage entry" });
const subject = makeNamedNode(entry.iri);
const identifierQuad = makeQuad(subject, binding.identifierPath, makeLiteral(entry.identity, XSD_STRING.value));
const curieQuad = makeQuad(subject, binding.curiePath, makeLiteral(entry.curie, XSD_STRING.value));

const datasetWith = (...quads: ReadonlyArray<Quad>): Dataset => makeDataset(quads);

const expectDecodeError = Effect.fnUntraced(function* (
  dataset: Dataset,
  expectedSubject: string,
  expectedMessage: string
) {
  const error = yield* datasetToEntries(binding)(dataset).pipe(Effect.flip);

  assert.strictEqual(error._tag, "IdentityDatasetDecodeError");
  assert.strictEqual(error.subject, expectedSubject);
  assert.strictEqual(error.message, expectedMessage);
});

const provideScopedLayer =
  <ROut, E2, RIn>(provided: Layer.Layer<ROut, E2, RIn>) =>
  <A, E, R>(effect: Effect.Effect<A, E, R>): Effect.Effect<A, E | E2, RIn | Exclude<R, ROut>> =>
    Effect.scoped(Layer.build(provided).pipe(Effect.flatMap((context) => effect.pipe(Effect.provide(context)))));

describe("identity RDF binding decode failures", () => {
  it.effect(
    "rejects a blank-node identity subject",
    Effect.fnUntraced(function* () {
      const blankSubject = makeBlankNode("anonymous-identity");
      const dataset = datasetWith(
        makeQuad(blankSubject, binding.identifierPath, makeLiteral(entry.identity, XSD_STRING.value))
      );

      yield* expectDecodeError(dataset, blankSubject.value, "Identity entry subjects must be named nodes.");
    })
  );

  it.effect(
    "rejects missing and duplicate identifier literals",
    Effect.fnUntraced(function* () {
      yield* expectDecodeError(
        datasetWith(curieQuad),
        subject.value,
        "Expected exactly one identity identifier literal."
      );
      yield* expectDecodeError(
        datasetWith(
          identifierQuad,
          makeQuad(subject, binding.identifierPath, makeLiteral("duplicate", XSD_STRING.value)),
          curieQuad
        ),
        subject.value,
        "Expected exactly one identity identifier literal."
      );
    })
  );

  it.effect(
    "rejects missing and duplicate CURIE literals",
    Effect.fnUntraced(function* () {
      yield* expectDecodeError(
        datasetWith(identifierQuad),
        subject.value,
        "Expected exactly one identity CURIE literal."
      );
      yield* expectDecodeError(
        datasetWith(
          identifierQuad,
          curieQuad,
          makeQuad(subject, binding.curiePath, makeLiteral("duplicate:curie", XSD_STRING.value))
        ),
        subject.value,
        "Expected exactly one identity CURIE literal."
      );
    })
  );

  it.effect(
    "rejects blank-node and named-node registry values",
    Effect.fnUntraced(function* () {
      const expectedMessage = "Identity registry values must be plain string literals.";

      yield* expectDecodeError(
        datasetWith(makeQuad(subject, binding.identifierPath, makeBlankNode("identity-value")), curieQuad),
        subject.value,
        expectedMessage
      );
      yield* expectDecodeError(
        datasetWith(makeQuad(subject, binding.identifierPath, makeNamedNode("https://example.test/value")), curieQuad),
        subject.value,
        expectedMessage
      );
    })
  );

  it.effect(
    "rejects non-string and language-tagged literals",
    Effect.fnUntraced(function* () {
      const expectedMessage = "Identity registry values must be plain string literals.";

      yield* expectDecodeError(
        datasetWith(makeQuad(subject, binding.identifierPath, makeLiteral("1", XSD_DOUBLE.value)), curieQuad),
        subject.value,
        expectedMessage
      );
      yield* expectDecodeError(
        datasetWith(
          makeQuad(subject, binding.identifierPath, makeLiteral(entry.identity, XSD_STRING.value, { language: "en" })),
          curieQuad
        ),
        subject.value,
        expectedMessage
      );
    })
  );

  it.effect(
    "rejects an unmapped RDF predicate",
    Effect.fnUntraced(function* () {
      const unknownPath = makeNamedNode("https://example.test/identity/unknown");
      const dataset = datasetWith(
        identifierQuad,
        curieQuad,
        makeQuad(subject, unknownPath, makeLiteral("unknown", XSD_STRING.value))
      );

      yield* expectDecodeError(dataset, subject.value, "Identity entry contains an unmapped RDF predicate.");
    })
  );

  it.effect(
    "rejects duplicate values for a mapped fiber",
    Effect.fnUntraced(function* () {
      const dataset = datasetWith(
        identifierQuad,
        curieQuad,
        makeQuad(subject, labelPath, makeLiteral("first", XSD_STRING.value)),
        makeQuad(subject, labelPath, makeLiteral("second", XSD_STRING.value))
      );

      yield* expectDecodeError(
        dataset,
        subject.value,
        "Expected at most one plain string literal for a mapped identity fiber."
      );
    })
  );

  it.effect(
    "decodes an omitted mapped fiber as absent",
    Effect.fnUntraced(function* () {
      const decoded = yield* datasetToEntries(binding)(datasetWith(identifierQuad, curieQuad));

      assert.deepStrictEqual(decoded, [
        IdentityEntry.make({
          identity: entry.identity,
          iri: entry.iri,
          curie: entry.curie,
          fibers: {},
        }),
      ]);
    })
  );
});

describe("identity RDF data-last adapters", () => {
  it.effect(
    "builds a registry through the data-last layerDataset overload",
    Effect.fnUntraced(function* () {
      const dataset = yield* entriesToDataset(binding)([entry]);
      const resolved = yield* IdentityRegistry.use((registry) =>
        registry.resolve({ _tag: "identity", value: entry.identity })
      ).pipe(provideScopedLayer(layerDataset(dataset)(binding)));

      assert.deepStrictEqual(resolved, entry);
    })
  );

  it.effect(
    "matches data-first projection through the data-last projectShapes overload",
    Effect.fnUntraced(function* () {
      const policy = IdentityShapePolicy.make({ requiredFibers: ["label"] });
      const dataFirst = yield* projectShapes(binding, policy)([entry]);
      const dataLast = yield* projectShapes(policy)(binding)([entry]);

      assert.strictEqual(dataLast.length, 1);
      assert.deepStrictEqual(dataLast, dataFirst);
    })
  );
});
