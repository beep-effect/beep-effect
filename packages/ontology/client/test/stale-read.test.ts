import {
  OntologyClient,
  ontologySessionAtom,
  ontologySparqlErrorAtom,
  ontologySparqlResultAtom,
  runOntologySparqlAtom,
} from "@beep/ontology-client/aggregates/Session";
import {
  appendChange,
  ChangeOperation,
  CreateSessionInput,
  createSession,
  SessionId,
} from "@beep/ontology-domain/aggregates/Session";
import { RunOntologySparqlResult } from "@beep/ontology-use-cases/aggregates/Session";
import { makeDataset, makeNamedNode, makeQuad } from "@beep/rdf/Rdf";
import { NonNegativeInt } from "@beep/schema";
import { SparqlSelectResult } from "@beep/semantic-web/services/sparql-query";
import { it } from "@beep/test-runner";
import { describe } from "@effect/vitest";
import { assertNone, assertTrue } from "@effect/vitest/utils";
import { Deferred, Effect, Layer, pipe } from "effect";
import * as O from "effect/Option";
import { AtomRegistry, Reactivity } from "effect/reactivity";

const sessionId = SessionId.make("session-1");

const openSession = createSession(CreateSessionInput.make({ id: sessionId, baseDataset: makeDataset([]) }));

const addedTriple = ChangeOperation.make({
  kind: "addQuad",
  partition: "asserted",
  quad: makeQuad(
    makeNamedNode("https://example.test/alice"),
    makeNamedNode("https://example.test/knows"),
    makeNamedNode("https://example.test/bob")
  ),
});

const staleRows = RunOntologySparqlResult.make({
  profile: "select",
  submittedQuery: "SELECT ?s WHERE { ?s ?p ?o }",
  normalizedQuery: "SELECT ?s WHERE { ?s ?p ?o } LIMIT 100",
  effectiveLimit: NonNegativeInt.make(100),
  limitInjected: true,
  truncated: false,
  rawResultCount: 1,
  displayedResultCount: 1,
  result: SparqlSelectResult.make({ profile: "select", rows: [] }),
});

describe("ontology reads never publish a result for a session that has moved", () => {
  it.effect(
    "discards a SPARQL result when the session changed while the query was running",
    Effect.fnUntraced(function* () {
      // SPARQL deliberately does not hold the mutation lock — a slow read must never
      // block editing — so the user can apply a triple while a query is in flight.
      // The query then lands afterwards and used to be published as the current
      // answer: rows computed from an ontology that no longer exists, shown as the
      // verdict for the one on screen.
      const queryReached = yield* Deferred.make<void>();
      const releaseQuery = yield* Deferred.make<void>();

      const client = OntologyClient.of(((tag: string) =>
        tag === "RunOntologySparql"
          ? Effect.gen(function* () {
              yield* Deferred.succeed(queryReached, undefined);
              yield* Deferred.await(releaseQuery);
              return staleRows;
            })
          : Effect.die(`unexpected ontology RPC: ${tag}`)) as unknown as OntologyClient["Service"]);

      const registry = yield* Effect.acquireRelease(
        Effect.sync(() =>
          AtomRegistry.make({
            initialValues: [
              [OntologyClient.runtime.layer, Layer.mergeAll(Layer.succeed(OntologyClient, client), Reactivity.layer)],
            ],
          })
        ),
        (registry) => Effect.sync(() => registry.dispose())
      );
      registry.set(ontologySessionAtom, O.some(openSession));

      // Start the query. It parks inside the stub until we release it.
      registry.set(runOntologySparqlAtom, undefined);
      yield* Deferred.await(queryReached);

      // The user edits the ontology while the query is still in flight.
      registry.set(ontologySessionAtom, O.some(appendChange(openSession, addedTriple)));

      // Let the query land, then wait for the atom to finish publishing.
      yield* Deferred.succeed(releaseQuery, undefined);
      yield* AtomRegistry.getResult(registry, runOntologySparqlAtom);

      // The stale rows must NOT be on screen as the current answer.
      assertNone(registry.get(ontologySparqlResultAtom));
      pipe(registry.get(ontologySparqlErrorAtom), O.isSome, assertTrue);
    })
  );
});
