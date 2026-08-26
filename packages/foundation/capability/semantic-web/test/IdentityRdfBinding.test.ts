import { IdentityEntry, IdentityRegistry } from "@beep/identity";
import { $SemanticWebId } from "@beep/identity/packages";
import { makeNamedNode, NamedNode } from "@beep/rdf/Rdf";
import {
  DefaultIdentityRdfBinding,
  datasetToEntries,
  entriesToDataset,
  IdentityEntryIriError,
  IdentityFiberPathError,
  IdentityRdfBinding,
  IdentityShapePolicy,
  layerDataset,
  projectShapes,
} from "@beep/semantic-web";
import {
  ShaclValidationRequest,
  ShaclValidationResult,
  ShaclValidationService,
} from "@beep/semantic-web/services/shacl-validation";
import { assert, describe, expect, it } from "@effect/vitest";
import { Effect, Layer, pipe, Ref, Result } from "effect";
import * as A from "effect/Array";
import * as HashSet from "effect/HashSet";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import * as SchemaIssue from "effect/SchemaIssue";
import { FastCheck as fc } from "effect/testing";
import type { ShaclNodeShape } from "@beep/semantic-web/services/shacl-validation";

const entryComposer = $SemanticWebId.create("identity/registry-test-entry");
const propertyEntryComposer = $SemanticWebId.create("identity/property-test-entry");
const labelPath = makeNamedNode($SemanticWebId.create("identity/fibers/label").iri);
const routePath = makeNamedNode($SemanticWebId.create("identity/fibers/route").iri);
const binding = IdentityRdfBinding.make({
  identifierPath: DefaultIdentityRdfBinding.identifierPath,
  curiePath: DefaultIdentityRdfBinding.curiePath,
  fiberPaths: { label: labelPath, route: routePath },
});
const entry = IdentityEntry.fromComposer(entryComposer, {
  label: "Registry test entry",
  route: "/identity/registry-test-entry",
});
const EntrySeed = S.Struct({
  identity: S.String,
  curie: S.String,
  label: S.String,
  route: S.String,
});
const collidingBindingInput = {
  identifierPath: DefaultIdentityRdfBinding.identifierPath,
  curiePath: DefaultIdentityRdfBinding.identifierPath,
  fiberPaths: { label: labelPath },
};
const duplicatePolicyInput = { requiredFibers: ["label", "label"] };
const sameNamedNode = S.toEquivalence(NamedNode);

const bindingPredicateValues = (value: IdentityRdfBinding): ReadonlyArray<string> =>
  pipe(
    R.values(value.fiberPaths),
    A.map((path) => path.value),
    A.prepend(value.curiePath.value),
    A.prepend(value.identifierPath.value)
  );

const expectSchemaMakeToFail = (run: () => unknown, messagePart: string): void => {
  const formatIssue = SchemaIssue.makeFormatterDefault();
  try {
    run();
  } catch (error) {
    if (P.hasProperty(error, "cause") && SchemaIssue.isIssue(error.cause)) {
      expect(formatIssue(error.cause)).toContain(messagePart);
      return;
    }
    throw error;
  }
  expect.unreachable("expected binding construction to throw");
};

const expectIdentityEntryIriError = (error: unknown, identity: string, iri: string): void => {
  const isIdentityEntryIriError = S.is(IdentityEntryIriError);

  assert.isTrue(isIdentityEntryIriError(error));
  if (isIdentityEntryIriError(error)) {
    assert.strictEqual(error.identity, identity);
    assert.strictEqual(error.iri, iri);
  }
};

const provideScopedLayer =
  <ROut, E2, RIn>(provided: Layer.Layer<ROut, E2, RIn>) =>
  <A, E, R>(effect: Effect.Effect<A, E, R>): Effect.Effect<A, E | E2, RIn | Exclude<R, ROut>> =>
    Effect.scoped(Layer.build(provided).pipe(Effect.flatMap((context) => effect.pipe(Effect.provide(context)))));

describe("identity RDF binding", () => {
  it("rejects predicate collisions during construction and decoding", () => {
    expectSchemaMakeToFail(
      () => IdentityRdfBinding.make(collidingBindingInput),
      "identifierPath and curiePath collide at RDF predicate"
    );

    const decoded = S.decodeResult(IdentityRdfBinding)(collidingBindingInput);
    assert.isTrue(Result.isFailure(decoded));
    if (Result.isFailure(decoded)) {
      assert.include(
        SchemaIssue.makeFormatterDefault()(decoded.failure.issue),
        "identifierPath and curiePath collide at RDF predicate"
      );
    }
  });

  it("rejects duplicate required fibers during construction and decoding", () => {
    expectSchemaMakeToFail(
      () => IdentityShapePolicy.make(duplicatePolicyInput),
      "Required identity fiber 'label' appears more than once."
    );

    const decoded = S.decodeResult(IdentityShapePolicy)(duplicatePolicyInput);
    assert.isTrue(Result.isFailure(decoded));
    if (Result.isFailure(decoded)) {
      assert.include(
        SchemaIssue.makeFormatterDefault()(decoded.failure.issue),
        "Required identity fiber 'label' appears more than once."
      );
    }
  });

  it("derives only pairwise-distinct predicate bindings", () => {
    fc.assert(
      fc.property(S.toArbitrary(IdentityRdfBinding)(fc), (generated) => {
        const predicates = bindingPredicateValues(generated);

        assert.strictEqual(HashSet.size(HashSet.fromIterable(predicates)), A.length(predicates));
      }),
      { numRuns: 40 }
    );
  });

  it("derives only unique required-fiber policies", () => {
    fc.assert(
      fc.property(S.toArbitrary(IdentityShapePolicy)(fc), (generated) => {
        assert.strictEqual(
          HashSet.size(HashSet.fromIterable(generated.requiredFibers)),
          A.length(generated.requiredFibers)
        );
      }),
      { numRuns: 40 }
    );
  });

  it.effect(
    "round-trips exact identity entries through an RDF dataset",
    Effect.fnUntraced(function* () {
      const dataset = yield* entriesToDataset(binding)([entry]);
      const decoded = yield* datasetToEntries(binding)(dataset);

      assert.deepStrictEqual(decoded, [entry]);
    })
  );

  it.effect.prop(
    "property-checks the codec with schema-generated entry fields",
    [EntrySeed],
    Effect.fnUntraced(function* ([seed]) {
      const generated = IdentityEntry.make({
        identity: seed.identity,
        iri: propertyEntryComposer.iri,
        curie: seed.curie,
        fibers: { label: seed.label, route: seed.route },
      });
      const dataset = yield* entriesToDataset(binding)([generated]);
      const decoded = yield* datasetToEntries(binding)(dataset);

      assert.deepStrictEqual(decoded, [generated]);
    }),
    { fastCheck: { numRuns: 40 } }
  );

  it.effect(
    "fails encoding and projection when a fiber predicate is unmapped",
    Effect.fnUntraced(function* () {
      const encodingError = yield* entriesToDataset(DefaultIdentityRdfBinding)([entry]).pipe(Effect.flip);
      const projectionError = yield* projectShapes(
        DefaultIdentityRdfBinding,
        IdentityShapePolicy.make({ requiredFibers: ["label"] })
      )([entry]).pipe(Effect.flip);

      const isFiberPathError = S.is(IdentityFiberPathError);
      assert.isTrue(isFiberPathError(encodingError));
      if (isFiberPathError(encodingError)) {
        assert.strictEqual(encodingError.fiber, "label");
      }
      assert.isTrue(isFiberPathError(projectionError));
      if (isFiberPathError(projectionError)) {
        assert.strictEqual(projectionError.fiber, "label");
      }
    })
  );

  it.effect(
    "fails encoding and projection with a typed error for an invalid entry IRI",
    Effect.fnUntraced(function* () {
      const invalidIri = "not an iri";
      const invalidEntry = IdentityEntry.make({
        identity: "@beep/semantic-web/InvalidIriEntry",
        iri: invalidIri,
        curie: "beep:semantic-web/InvalidIriEntry",
        fibers: {},
      });
      const encodingError = yield* entriesToDataset(binding)([invalidEntry]).pipe(Effect.flip);
      const projectionError = yield* projectShapes(
        binding,
        IdentityShapePolicy.make({ requiredFibers: [] })
      )([invalidEntry]).pipe(Effect.flip);

      expectIdentityEntryIriError(encodingError, invalidEntry.identity, invalidIri);
      expectIdentityEntryIriError(projectionError, invalidEntry.identity, invalidIri);
    })
  );

  it.effect(
    "builds a dataset registry with exact three-address lookup and typed misses",
    Effect.fnUntraced(function* () {
      const dataset = yield* entriesToDataset(binding)([entry]);
      const result = yield* IdentityRegistry.use(
        Effect.fnUntraced(function* (registry) {
          const byIdentity = yield* registry.resolve({ _tag: "identity", value: entry.identity });
          const byIri = yield* registry.resolve({ _tag: "iri", value: entry.iri });
          const byCurie = yield* registry.resolve({ _tag: "curie", value: entry.curie });
          const missing = yield* registry
            .resolve({ _tag: "identity", value: "@beep/semantic-web/Missing" })
            .pipe(Effect.flip);

          return { byIdentity, byIri, byCurie, missing };
        })
      ).pipe(provideScopedLayer(layerDataset(binding, dataset)));

      assert.strictEqual(result.byIdentity, result.byIri);
      assert.strictEqual(result.byIdentity, result.byCurie);
      assert.deepStrictEqual(result.byIdentity, entry);
      assert.strictEqual(result.missing._tag, "IdentityNotFoundError");
    })
  );

  it.effect(
    "decodes projected shapes through the request contract and reaches a mock service",
    Effect.fnUntraced(function* () {
      const dataset = yield* entriesToDataset(binding)([entry]);
      const shapes = yield* projectShapes(
        binding,
        IdentityShapePolicy.make({ requiredFibers: ["label", "route"] })
      )([entry]);
      const encodedRequest = yield* S.encodeEffect(ShaclValidationRequest)(
        ShaclValidationRequest.make({ dataset, shapes })
      );
      const request = yield* S.decodeEffect(ShaclValidationRequest)(encodedRequest);
      const receivedShapes = yield* Ref.make<ReadonlyArray<ShaclNodeShape>>([]);
      const mock = ShaclValidationService.of({
        validate: Effect.fn("IdentityRdfBindingTest.validate")(function* (received: ShaclValidationRequest) {
          yield* Ref.set(receivedShapes, received.shapes);
          return ShaclValidationResult.make({ conforms: true, violations: [], truncated: false });
        }),
      });
      const result = yield* ShaclValidationService.use((service) => service.validate(request)).pipe(
        Effect.provideService(ShaclValidationService, mock)
      );

      assert.isTrue(result.conforms);
      assert.deepStrictEqual(yield* Ref.get(receivedShapes), shapes);
      assert.deepStrictEqual(request.shapes, shapes);
      const shape = request.shapes[0];
      assert.isDefined(shape);
      assert.strictEqual(shape.targetNode._tag, "Some");
      assert.strictEqual(shape.properties.length, 6);

      const addressProperties = pipe(
        shape.properties,
        A.filter(
          (property) =>
            sameNamedNode(property.path, binding.identifierPath) || sameNamedNode(property.path, binding.curiePath)
        )
      );
      assert.lengthOf(addressProperties, 4);
      assert.isTrue(A.every(addressProperties, (property) => O.isSome(property.minCount)));
      assert.lengthOf(
        A.filter(addressProperties, (property) => O.isSome(property.maxCount) && O.isNone(property.hasValue)),
        2
      );
      assert.lengthOf(
        A.filter(addressProperties, (property) => O.isNone(property.maxCount) && O.isSome(property.hasValue)),
        2
      );
    })
  );
});
