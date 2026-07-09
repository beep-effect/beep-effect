import {
  OntologyClient,
  OpenOntologyDocumentInput,
  ontologyInferenceResultAtom,
  ontologySnapshotAtom,
  openOntologyDocumentAtom,
  toggleOntologyInferredViewAtom,
} from "@beep/ontology-client/aggregates/Session";
import { CreateSessionInput, createSession, SessionId } from "@beep/ontology-domain/aggregates/Session";
import {
  buildOntologySnapshot,
  OntologyFilePath,
  OntologyReasoner,
  OntologyReasonerLive,
  OpenOntologyDocumentResult,
} from "@beep/ontology-use-cases/aggregates/Session";
import { makeDataset, makeNamedNode, makeQuad } from "@beep/rdf/Rdf";
import { OWL_CLASS } from "@beep/rdf/Vocab/Owl";
import { RDF_TYPE } from "@beep/rdf/Vocab/Rdf";
import { RDFS_NAMESPACE } from "@beep/rdf/Vocab/Rdfs";
import { O } from "@beep/utils";
import { describe, expect, it } from "@effect/vitest";
import { Effect, Layer } from "effect";
import * as S from "effect/Schema";
import { AtomRegistry, Reactivity } from "effect/unstable/reactivity";
import type { InferOntologySessionInput } from "@beep/ontology-use-cases/aggregates/Session";

const sessionId = S.decodeUnknownSync(SessionId)("session-1");
const fixturePath = S.decodeUnknownSync(OntologyFilePath)("tmp/ontology-workbench/pizza-tutorial.ttl");

const provideScopedLayer =
  <ROut, E2, RIn>(layer: Layer.Layer<ROut, E2, RIn>) =>
  <A2, E, R>(effect: Effect.Effect<A2, E, R>): Effect.Effect<A2, E | E2, RIn | Exclude<R, ROut>> =>
    Effect.scoped(Layer.build(layer).pipe(Effect.flatMap((context) => effect.pipe(Effect.provide(context)))));

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
      const registry = AtomRegistry.make({
        initialValues: [
          [OntologyClient.runtime.layer, Layer.mergeAll(Layer.succeed(OntologyClient, client), Reactivity.layer)],
        ],
      });

      registry.set(
        openOntologyDocumentAtom,
        OpenOntologyDocumentInput.make({
          sessionId: session.id,
          path: fixturePath,
        })
      );
      yield* AtomRegistry.getResult(registry, openOntologyDocumentAtom);

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
});
