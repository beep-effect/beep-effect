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
import { SparqlSelectResult } from "@beep/semantic-web/services/sparql-query";
import { it } from "@beep/test-runner";
import { describe } from "@effect/vitest";
import { assertNone, assertTrue } from "@effect/vitest/utils";
import * as Deferred from "effect/Deferred";
import * as Effect from "effect/Effect";
import { pipe } from "effect/Function";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as AtomRegistry from "effect/reactivity/AtomRegistry";
import * as Reactivity from "effect/reactivity/Reactivity";
import * as S from "effect/Schema";

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
  effectiveLimit: S.Natural.make(100),
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

      registry.set(runOntologySparqlAtom, undefined);
      yield* Deferred.await(queryReached);

      registry.set(ontologySessionAtom, O.some(appendChange(openSession, addedTriple)));

      yield* Deferred.succeed(releaseQuery, undefined);
      yield* AtomRegistry.getResult(registry, runOntologySparqlAtom);

      const staleRowsOnScreen = registry.get(ontologySparqlResultAtom);
      assertNone(staleRowsOnScreen);
      pipe(registry.get(ontologySparqlErrorAtom), O.isSome, assertTrue);
    })
  );
});
