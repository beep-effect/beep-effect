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
import { it } from "@beep/test-runner";
import { describe, expect } from "@effect/vitest";
import { assertFalse, assertTrue } from "@effect/vitest/utils";
import { Effect, Layer, pipe } from "effect";
import * as O from "effect/Option";
import { AtomRegistry, Reactivity } from "effect/reactivity";
import * as S from "effect/Schema";

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
      const registry = yield* Effect.acquireRelease(
        Effect.sync(() => AtomRegistry.make()),
        (registry) => Effect.sync(() => registry.dispose())
      );
      const setSubject = setOntologyInspectorInputAtoms("subject");
      const setPredicate = setOntologyInspectorInputAtoms("predicate");
      const setObject = setOntologyInspectorInputAtoms("object");
      yield* AtomRegistry.mount(registry, ontologyInspectorFormStateAtom);
      yield* AtomRegistry.mount(registry, setSubject);
      yield* AtomRegistry.mount(registry, setPredicate);
      yield* AtomRegistry.mount(registry, setObject);
      yield* AtomRegistry.mount(registry, setOntologyInspectorObjectKindAtom);
      yield* AtomRegistry.mount(registry, setOntologyGraphRendererAtom);
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
      pipe(invalid.showSubjectError, assertTrue);
      pipe(invalid.canApplyTriple, assertFalse);

      registry.set(setSubject, "  https://example.org/padded#Term  ");
      yield* AtomRegistry.getResult(registry, setSubject);
      const valid = registry.get(ontologyInspectorFormStateAtom);
      pipe(valid.subjectValid, assertTrue);
      pipe(valid.predicateValid, assertTrue);
      pipe(valid.objectValid, assertTrue);
      pipe(valid.canApplyGraphGesture, assertTrue);

      registry.set(setOntologyInspectorObjectKindAtom, "unsupported");
      yield* AtomRegistry.getResult(registry, setOntologyInspectorObjectKindAtom);
      expect(registry.get(objectKindAtom)).toBe("iri");

      registry.set(setOntologyGraphRendererAtom, true);
      yield* AtomRegistry.getResult(registry, setOntologyGraphRendererAtom);
      expect(registry.get(ontologyGraphRendererAtom)).toBe("graph3d");
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
      const registry = yield* Effect.acquireRelease(
        Effect.sync(() => registryWithClient(client)),
        (registry) => Effect.sync(() => registry.dispose())
      );
      yield* AtomRegistry.mount(registry, applyOntologyInspectorActionAtom);
      yield* AtomRegistry.mount(registry, setOntologyInspectorObjectKindAtom);
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
    })
  );
});
