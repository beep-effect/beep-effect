import { IdentityEntry, IdentityRegistry } from "@beep/identity";
import { $SemanticWebId } from "@beep/identity/packages";
import { makeNamedNode } from "@beep/rdf/Rdf";
import {
  DefaultIdentityRdfBinding,
  datasetToEntries,
  entriesToDataset,
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
import { assert, describe, it } from "@effect/vitest";
import { Effect, Layer, Ref } from "effect";
import * as S from "effect/Schema";
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

const provideScopedLayer =
  <ROut, E2, RIn>(provided: Layer.Layer<ROut, E2, RIn>) =>
  <A, E, R>(effect: Effect.Effect<A, E, R>): Effect.Effect<A, E | E2, RIn | Exclude<R, ROut>> =>
    Effect.scoped(Layer.build(provided).pipe(Effect.flatMap((context) => effect.pipe(Effect.provide(context)))));

describe("identity RDF binding", () => {
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

      assert.isTrue(S.is(IdentityFiberPathError)(encodingError));
      assert.strictEqual(encodingError.fiber, "label");
      assert.isTrue(S.is(IdentityFiberPathError)(projectionError));
      assert.strictEqual(projectionError.fiber, "label");
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
      assert.strictEqual(request.shapes[0]?.targetNode._tag, "Some");
      assert.strictEqual(request.shapes[0]?.properties.length, 4);
    })
  );
});
