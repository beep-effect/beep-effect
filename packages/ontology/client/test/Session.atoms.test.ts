import {
  OntologyClient,
  OpenOntologyDocumentInput,
  ontologyInferenceResultAtom,
  ontologySnapshotAtom,
  ontologyValidationErrorAtom,
  ontologyValidationResultAtom,
  ontologyValidationStatusAtom,
  openOntologyDocumentAtom,
  runOntologyValidationAtom,
  toggleOntologyInferredViewAtom,
} from "@beep/ontology-client/aggregates/Session";
import { CreateSessionInput, createSession, SessionId } from "@beep/ontology-domain/aggregates/Session";
import {
  buildOntologySnapshot,
  OntologyFilePath,
  OntologyReasoner,
  OntologyReasonerLive,
  OpenOntologyDocumentResult,
  RunOntologyValidationResult,
} from "@beep/ontology-use-cases/aggregates/Session";
import { makeBlankNode, makeDataset, makeNamedNode, makeQuad } from "@beep/rdf/Rdf";
import { OWL_CLASS } from "@beep/rdf/Vocab/Owl";
import { RDF_TYPE } from "@beep/rdf/Vocab/Rdf";
import { RDFS_NAMESPACE } from "@beep/rdf/Vocab/Rdfs";
import { O } from "@beep/utils";
import { describe, expect, it } from "@effect/vitest";
import { Effect, Layer } from "effect";
import * as S from "effect/Schema";
import { AtomRegistry, Reactivity } from "effect/unstable/reactivity";
import type {
  InferOntologySessionInput,
  RunOntologyValidationInput,
} from "@beep/ontology-use-cases/aggregates/Session";

const sessionId = S.decodeUnknownSync(SessionId)("session-1");
const fixturePath = S.decodeUnknownSync(OntologyFilePath)("tmp/ontology-workbench/pizza-tutorial.ttl");
const materialsPath = S.decodeUnknownSync(OntologyFilePath)("tmp/ontology-workbench/materials.ttl");
const SHACL_NAMESPACE = "http://www.w3.org/ns/shacl#" as const;
const SH_NODE_SHAPE = makeNamedNode(`${SHACL_NAMESPACE}NodeShape`);
const SH_PROPERTY = makeNamedNode(`${SHACL_NAMESPACE}property`);
const SH_PATH = makeNamedNode(`${SHACL_NAMESPACE}path`);
const SH_TARGET_NODE = makeNamedNode(`${SHACL_NAMESPACE}targetNode`);
const SH_HAS_VALUE = makeNamedNode(`${SHACL_NAMESPACE}hasValue`);

const provideScopedLayer =
  <ROut, E2, RIn>(layer: Layer.Layer<ROut, E2, RIn>) =>
  <A2, E, R>(effect: Effect.Effect<A2, E, R>): Effect.Effect<A2, E | E2, RIn | Exclude<R, ROut>> =>
    Effect.scoped(Layer.build(layer).pipe(Effect.flatMap((context) => effect.pipe(Effect.provide(context)))));

const registryWithClient = (client: OntologyClient["Service"]) =>
  AtomRegistry.make({
    initialValues: [
      [OntologyClient.runtime.layer, Layer.mergeAll(Layer.succeed(OntologyClient, client), Reactivity.layer)],
    ],
  });

const openRegistrySession = Effect.fn("openRegistrySession")(function* (
  registry: ReturnType<typeof registryWithClient>,
  session: ReturnType<typeof createSession>,
  path: OntologyFilePath
) {
  registry.set(
    openOntologyDocumentAtom,
    OpenOntologyDocumentInput.make({
      sessionId: session.id,
      path,
    })
  );
  yield* AtomRegistry.getResult(registry, openOntologyDocumentAtom);
});

describe("Session atoms", () => {
  it.effect(
    "settles inferred view without reinvoking inference for an unchanged session signature",
    Effect.fnUntraced(function* () {
      const pizza = makeNamedNode("https://example.org/pizza#Pizza");
      const margherita = makeNamedNode("https://example.org/pizza#Margherita");
      const neapolitanMargherita = makeNamedNode("https://example.org/pizza#NeapolitanMargherita");
      const m1 = makeNamedNode("https://example.org/pizza#m1");
      const subClassOf = makeNamedNode(`${RDFS_NAMESPACE}subClassOf`);
      const session = createSession(
        CreateSessionInput.make({
          id: sessionId,
          baseDataset: makeDataset([
            makeQuad(pizza, RDF_TYPE, OWL_CLASS),
            makeQuad(margherita, RDF_TYPE, OWL_CLASS),
            makeQuad(margherita, subClassOf, pizza),
            makeQuad(neapolitanMargherita, RDF_TYPE, OWL_CLASS),
            makeQuad(neapolitanMargherita, subClassOf, margherita),
            makeQuad(m1, RDF_TYPE, neapolitanMargherita),
          ]),
        })
      );
      const reasoner = yield* OntologyReasoner;
      let inferenceInvocations = 0;
      const client = OntologyClient.of(((tag: string, payload: unknown) => {
        if (tag === "OpenOntologyDocument") {
          return Effect.succeed(
            OpenOntologyDocumentResult.make({
              session,
              path: fixturePath,
              source: "@prefix : <https://example.org/pizza#> .",
              snapshot: buildOntologySnapshot(session),
            })
          );
        }

        if (tag === "RunOntologyInference") {
          inferenceInvocations += 1;
          return reasoner.infer(payload as InferOntologySessionInput);
        }

        return Effect.die(`unexpected ontology RPC: ${tag}`);
      }) as unknown as OntologyClient["Service"]);
      const registry = registryWithClient(client);

      yield* openRegistrySession(registry, session, fixturePath);

      registry.set(toggleOntologyInferredViewAtom, true);
      yield* AtomRegistry.getResult(registry, toggleOntologyInferredViewAtom);
      registry.set(toggleOntologyInferredViewAtom, true);
      yield* AtomRegistry.getResult(registry, toggleOntologyInferredViewAtom);
      registry.set(toggleOntologyInferredViewAtom, false);
      yield* AtomRegistry.getResult(registry, toggleOntologyInferredViewAtom);
      registry.set(toggleOntologyInferredViewAtom, true);
      yield* AtomRegistry.getResult(registry, toggleOntologyInferredViewAtom);

      expect(inferenceInvocations).toBe(1);
      expect(O.isSome(registry.get(ontologyInferenceResultAtom))).toBe(true);
      expect(registry.get(ontologySnapshotAtom).metrics.quadCount).toBe(9);
      registry.dispose();
    }, provideScopedLayer(OntologyReasonerLive))
  );

  it.effect(
    "runs validation from an opened session whose SHACL shapes came from Turtle",
    Effect.fnUntraced(function* () {
      const material = makeNamedNode("http://example.org/materials#Material");
      const metal = makeNamedNode("http://example.org/materials#Metal");
      const subclassOf = makeNamedNode(`${RDFS_NAMESPACE}subClassOf`);
      const shape = makeNamedNode("urn:shape:metal-subclass");
      const property = makeBlankNode("shape-metal-subclass-property");
      const session = createSession(
        CreateSessionInput.make({
          id: sessionId,
          baseDataset: makeDataset([
            makeQuad(material, RDF_TYPE, OWL_CLASS),
            makeQuad(metal, RDF_TYPE, OWL_CLASS),
            makeQuad(shape, RDF_TYPE, SH_NODE_SHAPE),
            makeQuad(shape, SH_TARGET_NODE, metal),
            makeQuad(shape, SH_PROPERTY, property),
            makeQuad(property, SH_PATH, subclassOf),
            makeQuad(property, SH_HAS_VALUE, material),
          ]),
        })
      );
      const reasoner = yield* OntologyReasoner;
      const validationResult = yield* S.decodeUnknownEffect(RunOntologyValidationResult)({
        validation: {
          conforms: false,
          violations: [
            {
              focusNode: metal.value,
              path: subclassOf,
              message: `Expected value ${material.value} for ${subclassOf.value}.`,
              severity: "violation",
              sourceShape: shape,
            },
          ],
          truncated: false,
        },
        repairs: [],
        shapeCount: 1,
        dataQuadCount: 2,
        inferredQuadCount: 0,
      });
      let validationInvocations = 0;
      const client = OntologyClient.of(((tag: string, payload: unknown) => {
        if (tag === "OpenOntologyDocument") {
          return Effect.succeed(
            OpenOntologyDocumentResult.make({
              session,
              path: materialsPath,
              source: "@prefix mat: <http://example.org/materials#> .",
              snapshot: buildOntologySnapshot(session),
            })
          );
        }

        if (tag === "RunOntologyInference") {
          return reasoner.infer(payload as InferOntologySessionInput);
        }

        if (tag === "RunOntologyValidation") {
          validationInvocations += 1;
          expect((payload as RunOntologyValidationInput).session.id).toBe(session.id);
          return Effect.succeed(validationResult);
        }

        return Effect.die(`unexpected ontology RPC: ${tag}`);
      }) as unknown as OntologyClient["Service"]);
      const registry = registryWithClient(client);

      yield* openRegistrySession(registry, session, materialsPath);
      registry.set(runOntologyValidationAtom, undefined);
      yield* AtomRegistry.getResult(registry, runOntologyValidationAtom);

      const result = registry.get(ontologyValidationResultAtom);
      expect(validationInvocations).toBe(1);
      expect(registry.get(ontologyValidationStatusAtom)).toBe("complete");
      expect(O.isNone(registry.get(ontologyValidationErrorAtom))).toBe(true);
      expect(O.isSome(result)).toBe(true);
      if (O.isSome(result)) {
        expect(result.value.validation.violations).toHaveLength(1);
        expect(result.value.validation.violations[0]?.focusNode).toBe(metal.value);
      }
      registry.dispose();
    }, provideScopedLayer(OntologyReasonerLive))
  );

  it.effect(
    "surfaces no-shapes state without calling inference or validation RPCs",
    Effect.fnUntraced(function* () {
      const material = makeNamedNode("http://example.org/materials#Material");
      const session = createSession(
        CreateSessionInput.make({
          id: sessionId,
          baseDataset: makeDataset([makeQuad(material, RDF_TYPE, OWL_CLASS)]),
        })
      );
      let inferenceInvocations = 0;
      let validationInvocations = 0;
      const client = OntologyClient.of(((tag: string) => {
        if (tag === "OpenOntologyDocument") {
          return Effect.succeed(
            OpenOntologyDocumentResult.make({
              session,
              path: materialsPath,
              source: "@prefix mat: <http://example.org/materials#> .",
              snapshot: buildOntologySnapshot(session),
            })
          );
        }

        if (tag === "RunOntologyInference") {
          inferenceInvocations += 1;
        }

        if (tag === "RunOntologyValidation") {
          validationInvocations += 1;
        }

        return Effect.die(`unexpected ontology RPC: ${tag}`);
      }) as unknown as OntologyClient["Service"]);
      const registry = registryWithClient(client);

      yield* openRegistrySession(registry, session, materialsPath);
      registry.set(runOntologyValidationAtom, undefined);
      yield* AtomRegistry.getResult(registry, runOntologyValidationAtom);

      expect(inferenceInvocations).toBe(0);
      expect(validationInvocations).toBe(0);
      expect(registry.get(ontologyValidationStatusAtom)).toBe("blocked");
      expect(
        O.match(registry.get(ontologyValidationErrorAtom), { onNone: () => "", onSome: (message) => message })
      ).toBe("No SHACL shapes detected in this document.");
      expect(O.isNone(registry.get(ontologyValidationResultAtom))).toBe(true);
      registry.dispose();
    })
  );
});
