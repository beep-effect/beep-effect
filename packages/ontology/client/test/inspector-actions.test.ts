import {
  applyOntologyInspectorActionAtom,
  OntologyClient,
  objectInputAtom,
  objectKindAtom,
  ontologyGraphRendererAtom,
  ontologyInspectorFormStateAtom,
  ontologySessionAtom,
  predicateInputAtom,
  setOntologyGraphRendererAtom,
  setOntologyInspectorInputAtoms,
  setOntologyInspectorObjectKindAtom,
  subjectInputAtom,
} from "@beep/ontology-client/aggregates/Session";
import {
  applyChangeOperationsWithDelta,
  ChangeOperation,
  CreateSessionInput,
  createSession,
  SessionId,
} from "@beep/ontology-domain/aggregates/Session";
import { ApplyOntologyBatchCommand, ApplyOntologyBatchResult } from "@beep/ontology-use-cases/aggregates/Session";
import { makeDataset } from "@beep/rdf/Rdf";
import { RDF_TYPE } from "@beep/rdf/Vocab/Rdf";
import { describe, expect, it } from "@effect/vitest";
import { Effect, Layer } from "effect";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { AtomRegistry, Reactivity } from "effect/unstable/reactivity";

const session = createSession(
  CreateSessionInput.make({
    id: SessionId.make("inspector-session"),
    baseDataset: makeDataset([]),
  })
);
const isApplyOntologyBatchCommand = S.is(ApplyOntologyBatchCommand);

const registryWithClient = (client: OntologyClient["Service"]) =>
  AtomRegistry.make({
    initialValues: [
      [OntologyClient.runtime.layer, Layer.mergeAll(Layer.succeed(OntologyClient, client), Reactivity.layer)],
    ],
  });

describe("ontology inspector client actions", () => {
  it.live(
    "derives validation state and decodes object-kind select values in the ontology runtime",
    Effect.fnUntraced(function* () {
      const registry = AtomRegistry.make();
      const setSubject = setOntologyInspectorInputAtoms("subject");
      const setPredicate = setOntologyInspectorInputAtoms("predicate");
      const setObject = setOntologyInspectorInputAtoms("object");
      registry.mount(ontologyInspectorFormStateAtom);
      registry.mount(setSubject);
      registry.mount(setPredicate);
      registry.mount(setObject);
      registry.mount(setOntologyInspectorObjectKindAtom);
      registry.mount(setOntologyGraphRendererAtom);
      registry.set(ontologySessionAtom, O.some(session));
      registry.set(setSubject, "not an iri");
      registry.set(setPredicate, "https://example.test/predicate");
      registry.set(setObject, "https://example.test/object");
      yield* Effect.all([
        AtomRegistry.getResult(registry, setSubject),
        AtomRegistry.getResult(registry, setPredicate),
        AtomRegistry.getResult(registry, setObject),
      ]);

      registry.set(setOntologyInspectorObjectKindAtom, "iri");
      yield* AtomRegistry.getResult(registry, setOntologyInspectorObjectKindAtom);

      const invalid = registry.get(ontologyInspectorFormStateAtom);
      expect(invalid.objectKind).toBe("iri");
      expect(invalid.showSubjectError).toBe(true);
      expect(invalid.canApplyTriple).toBe(false);

      registry.set(setSubject, "  https://example.org/padded#Term  ");
      yield* AtomRegistry.getResult(registry, setSubject);
      const valid = registry.get(ontologyInspectorFormStateAtom);
      expect(valid.subjectValid).toBe(true);
      expect(valid.predicateValid).toBe(true);
      expect(valid.objectValid).toBe(true);
      expect(valid.canApplyGraphGesture).toBe(true);

      registry.set(setOntologyInspectorObjectKindAtom, "unsupported");
      yield* AtomRegistry.getResult(registry, setOntologyInspectorObjectKindAtom);
      expect(registry.get(objectKindAtom)).toBe("iri");

      registry.set(setOntologyGraphRendererAtom, true);
      yield* AtomRegistry.getResult(registry, setOntologyGraphRendererAtom);
      expect(registry.get(ontologyGraphRendererAtom)).toBe("graph3d");
      registry.dispose();
    })
  );

  it.live(
    "normalizes inspector IRIs and constructs batch and gesture commands before RPC dispatch",
    Effect.fnUntraced(function* () {
      let latestCommand = O.none<ApplyOntologyBatchCommand>();
      const client = OntologyClient.of(((tag: string, payload: unknown) => {
        if (tag !== "ApplyOntologyBatch") return Effect.die(`unexpected ontology RPC: ${tag}`);
        if (!isApplyOntologyBatchCommand(payload)) return Effect.die("invalid ontology batch command");
        latestCommand = O.some(payload);
        const applied = applyChangeOperationsWithDelta(payload.session, payload.operations);
        return Effect.succeed(
          ApplyOntologyBatchResult.make({
            session: applied.session,
            delta: applied.delta,
            operations: payload.operations,
          })
        );
      }) as unknown as OntologyClient["Service"]);
      const registry = registryWithClient(client);
      registry.mount(applyOntologyInspectorActionAtom);
      registry.mount(setOntologyInspectorObjectKindAtom);
      registry.set(ontologySessionAtom, O.some(session));
      registry.set(subjectInputAtom, "  https://example.test/subject  ");
      registry.set(predicateInputAtom, "  https://example.test/predicate  ");
      registry.set(objectInputAtom, "  literal value  ");

      registry.set(applyOntologyInspectorActionAtom, "addTriple");
      yield* AtomRegistry.getResult(registry, applyOntologyInspectorActionAtom);

      const addTriple = O.getOrThrow(latestCommand);
      const addTripleOperation = O.getOrThrow(O.fromUndefinedOr(addTriple.operations[0]));
      ChangeOperation.match(addTripleOperation, {
        addQuad: ({ quad }) => {
          expect(quad.subject.value).toBe("https://example.test/subject");
          expect(quad.predicate.value).toBe("https://example.test/predicate");
          expect(quad.object.value).toBe("  literal value  ");
        },
        removeQuad: () => expect.unreachable(),
      });

      registry.set(objectInputAtom, "  https://example.test/object  ");
      registry.set(setOntologyInspectorObjectKindAtom, "iri");
      yield* AtomRegistry.getResult(registry, setOntologyInspectorObjectKindAtom);
      registry.set(applyOntologyInspectorActionAtom, "connect");
      yield* AtomRegistry.getResult(registry, applyOntologyInspectorActionAtom);

      const connect = O.getOrThrow(latestCommand);
      const connectOperation = O.getOrThrow(O.fromUndefinedOr(connect.operations[0]));
      ChangeOperation.match(connectOperation, {
        addQuad: ({ quad }) => {
          expect(quad.subject.value).toBe("https://example.test/subject");
          expect(quad.predicate.value).toBe("https://example.test/predicate");
          expect(quad.object.value).toBe("https://example.test/object");
        },
        removeQuad: () => expect.unreachable(),
      });

      registry.set(applyOntologyInspectorActionAtom, "instantiate");
      yield* AtomRegistry.getResult(registry, applyOntologyInspectorActionAtom);

      const instantiate = O.getOrThrow(latestCommand);
      const instantiateOperation = O.getOrThrow(O.fromUndefinedOr(instantiate.operations[0]));
      ChangeOperation.match(instantiateOperation, {
        addQuad: ({ quad }) => {
          expect(quad.subject.value).toBe("https://example.test/object");
          expect(quad.predicate.value).toBe(RDF_TYPE.value);
          expect(quad.object.value).toBe("https://example.test/subject");
        },
        removeQuad: () => expect.unreachable(),
      });
      registry.dispose();
    })
  );
});
