import {
  OntologyClient,
  ontologySessionAtom,
  ontologySparqlErrorAtom,
  runOntologySparqlAtom,
} from "@beep/ontology-client/aggregates/Session";
import { CreateSessionInput, createSession, SessionId } from "@beep/ontology-domain/aggregates/Session";
import { OntologyActionError } from "@beep/ontology-use-cases/aggregates/Session";
import { makeDataset } from "@beep/rdf/Rdf";
import { describe, expect, it } from "@effect/vitest";
import { Effect, Layer } from "effect";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { AtomRegistry, Reactivity } from "effect/unstable/reactivity";

const session = createSession(
  CreateSessionInput.make({
    id: S.decodeUnknownSync(SessionId)("session-1"),
    baseDataset: makeDataset([]),
  })
);

const PARSE_FAILURE = "Parse error at line 2: expected a variable or IRI.";

describe("a failed ontology action explains itself", () => {
  it.effect(
    "shows the failure's own message, not an internal stack trace",
    Effect.fnUntraced(function* () {
      // The panel printed `Cause.pretty(cause)`: an internal Effect cause, with stack
      // frames and module paths, shown to someone who had merely mistyped a query. It
      // told them nothing they could act on, and leaked the shape of the program to do
      // it — while the typed failure carried a message written for a person all along.
      const client = OntologyClient.of(((tag: string) =>
        tag === "RunOntologySparql"
          ? Effect.fail(OntologyActionError.new(PARSE_FAILURE))
          : Effect.die(`unexpected ontology RPC: ${tag}`)) as unknown as OntologyClient["Service"]);

      const registry = AtomRegistry.make({
        initialValues: [
          [OntologyClient.runtime.layer, Layer.mergeAll(Layer.succeed(OntologyClient, client), Reactivity.layer)],
        ],
      });
      registry.set(ontologySessionAtom, O.some(session));

      registry.set(runOntologySparqlAtom, undefined);
      yield* AtomRegistry.getResult(registry, runOntologySparqlAtom).pipe(Effect.ignore);

      const shown = registry.get(ontologySparqlErrorAtom);

      expect(O.isSome(shown)).toBe(true);
      expect(O.getOrElse(shown, () => "")).toContain(PARSE_FAILURE);

      // And none of the program's internals: no stack frames, no module paths.
      const text = O.getOrElse(shown, () => "");
      expect(text).not.toContain("    at ");
      expect(text).not.toContain(".ts:");
      expect(text).not.toContain("Session.atoms");
    })
  );
});
