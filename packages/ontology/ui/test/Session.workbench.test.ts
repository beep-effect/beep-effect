import {
  CreateSessionInput,
  createSession,
  graphPartitionIri,
  SessionId,
} from "@beep/ontology-domain/aggregates/Session";
import { ontologyTreeItemsFor } from "@beep/ontology-ui/aggregates/Session/tree";
import {
  buildOntologySnapshotWithInference,
  InferOntologySessionInput,
  OntologyReasoner,
  OntologyReasonerLive,
} from "@beep/ontology-use-cases/aggregates/Session";
import { makeDataset, makeNamedNode, makeQuad } from "@beep/rdf/Rdf";
import { OWL_CLASS } from "@beep/rdf/Vocab/Owl";
import { RDF_TYPE } from "@beep/rdf/Vocab/Rdf";
import { RDFS_NAMESPACE } from "@beep/rdf/Vocab/Rdfs";
import { A, O } from "@beep/utils";
import { describe, expect, it } from "@effect/vitest";
import { Effect, Layer, pipe } from "effect";
import * as S from "effect/Schema";

const sessionId = S.decodeUnknownSync(SessionId)("session-1");

type TreeItem = {
  readonly id: string;
  readonly children?: ReadonlyArray<TreeItem>;
};

const provideScopedLayer =
  <ROut, E2, RIn>(layer: Layer.Layer<ROut, E2, RIn>) =>
  <A2, E, R>(effect: Effect.Effect<A2, E, R>): Effect.Effect<A2, E | E2, RIn | Exclude<R, ROut>> =>
    Effect.scoped(Layer.build(layer).pipe(Effect.flatMap((context) => effect.pipe(Effect.provide(context)))));

const collectTreeItemIds = (items: ReadonlyArray<TreeItem>): ReadonlyArray<string> =>
  pipe(
    items,
    A.flatMap((item) => [item.id, ...collectTreeItemIds(item.children ?? [])])
  );

describe("OntologyWorkbench hierarchy", () => {
  it.effect(
    "renders inferred transitive subclass closure as unique tree item ids",
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
      const inference = yield* reasoner.infer(InferOntologySessionInput.make({ session }));
      const snapshot = buildOntologySnapshotWithInference(session, inference);
      const neapolitan = pipe(
        snapshot.resources,
        A.findFirst((resource) => resource.iri === neapolitanMargherita.value),
        O.getOrThrow
      );
      const itemIds = collectTreeItemIds(ontologyTreeItemsFor(snapshot, "all"));

      expect(inference.inferredDataset.quads).toHaveLength(3);
      expect(inference.inferredDataset.quads[0]?.graph.value).toBe(graphPartitionIri("inferred"));
      expect(neapolitan.parentIris).toEqual(expect.arrayContaining([margherita.value, pizza.value]));
      expect(itemIds).toEqual(A.dedupe(itemIds));
      expect(A.filter(itemIds, (id) => id === neapolitanMargherita.value)).toHaveLength(1);
    }, provideScopedLayer(OntologyReasonerLive))
  );
});
