import {
  OntologyClient,
  ontologySessionAtom,
  ontologySparqlErrorAtom,
  runOntologySparqlAtom,
} from "@beep/ontology-client/aggregates/Session";
import { CreateSessionInput, createSession, SessionId } from "@beep/ontology-domain/aggregates/Session";
import { OntologyActionError } from "@beep/ontology-use-cases/aggregates/Session";
import { makeDataset } from "@beep/rdf/Rdf";
import { it } from "@beep/test-runner";
import { describe, expect } from "@effect/vitest";
import { assertTrue } from "@effect/vitest/utils";
import * as Effect from "effect/Effect";
import { pipe } from "effect/Function";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as AtomRegistry from "effect/reactivity/AtomRegistry";
import * as Reactivity from "effect/reactivity/Reactivity";

const session = createSession(
  CreateSessionInput.make({
    id: SessionId.make("session-1"),
    baseDataset: makeDataset([]),
  })
);

const PARSE_FAILURE = "Parse error at line 2: expected a variable or IRI.";

describe("a failed ontology action explains itself", () => {
  it.effect(
    "shows the failure's own message, not an internal stack trace",
    Effect.fnUntraced(function* () {
      const client = OntologyClient.of(((tag: string) =>
        tag === "RunOntologySparql"
          ? Effect.fail(OntologyActionError.new(PARSE_FAILURE))
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
      registry.set(ontologySessionAtom, O.some(session));

      registry.set(runOntologySparqlAtom, undefined);
      yield* AtomRegistry.getResult(registry, runOntologySparqlAtom).pipe(Effect.ignore);

      const shown = registry.get(ontologySparqlErrorAtom);

      pipe(shown, O.isSome, assertTrue);
      expect(O.getOrElse(shown, () => "")).toContain(PARSE_FAILURE);

      const text = O.getOrElse(shown, () => "");
      expect(text, "the message shows no stack frames").not.toContain("    at ");
      expect(text, "the message shows no module paths").not.toContain(".ts:");
      expect(text).not.toContain("Session.atoms");
    })
  );

  it.effect(
    "redacts untyped failure details before they reach the workbench",
    Effect.fnUntraced(function* () {
      const client = OntologyClient.of(((tag: string) =>
        tag === "RunOntologySparql"
          ? Effect.die(new Error("token=private-value at /home/operator/query.sparql"))
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
      registry.set(ontologySessionAtom, O.some(session));

      registry.set(runOntologySparqlAtom, undefined);
      yield* AtomRegistry.getResult(registry, runOntologySparqlAtom).pipe(Effect.ignore);

      const shown = registry.get(ontologySparqlErrorAtom);
      pipe(shown, O.isSome, assertTrue);
      const text = O.getOrElse(shown, () => "");
      expect(text).toMatch(/^The query failed\./);
      expect(text).not.toContain("private-value");
      expect(text).not.toContain("/home/operator");
    })
  );
});
