import {
  OntologyClient,
  ontologyDocumentErrorAtom,
  ontologyPathAtom,
  ontologySessionAtom,
  ontologySessionIdForPath,
  ontologyWorkbenchAutoOpenAtom,
  ontologyWorkbenchSeedPath,
  openOntologyDocumentAtom,
} from "@beep/ontology-client/aggregates/Session";
import { CreateSessionInput, createSession } from "@beep/ontology-domain/aggregates/Session";
import {
  buildOntologySnapshot,
  OntologyActionError,
  OntologyFilePath,
  OpenOntologyDocumentResult,
} from "@beep/ontology-use-cases/aggregates/Session";
import { makeDataset } from "@beep/rdf/Rdf";
import { it } from "@beep/test-runner";
import { O } from "@beep/utils";
import { describe, expect } from "@effect/vitest";
import { assertNone, assertTrue } from "@effect/vitest/utils";
import { Effect, Layer, pipe } from "effect";
import { AsyncResult, AtomRegistry, Reactivity } from "effect/reactivity";
import type { OpenOntologyDocumentInput } from "@beep/ontology-client/aggregates/Session";

const materialsPath = OntologyFilePath.make("tmp/ontology-workbench/materials.ttl");

const seedSession = createSession(
  CreateSessionInput.make({
    id: ontologySessionIdForPath(ontologyWorkbenchSeedPath),
    baseDataset: makeDataset([]),
  })
);

const registryWithClient = (client: OntologyClient["Service"]) =>
  AtomRegistry.make({
    initialValues: [
      [OntologyClient.runtime.layer, Layer.mergeAll(Layer.succeed(OntologyClient, client), Reactivity.layer)],
    ],
  });

const countingOpenClient = (counter: { invocations: number }) =>
  OntologyClient.of(((tag: string, payload: unknown) => {
    if (tag === "OpenOntologyDocument") {
      counter.invocations += 1;
      const input = payload as OpenOntologyDocumentInput;
      expect(input.path).toBe(ontologyWorkbenchSeedPath);
      expect(input.sessionId).toBe(ontologySessionIdForPath(ontologyWorkbenchSeedPath));
      return Effect.succeed(
        OpenOntologyDocumentResult.make({
          session: seedSession,
          path: input.path,
          source: "",
          snapshot: buildOntologySnapshot(seedSession),
        })
      );
    }

    return Effect.die(`unexpected ontology RPC: ${tag}`);
  }) as unknown as OntologyClient["Service"]);

describe("ontologyWorkbenchAutoOpenAtom", () => {
  it.effect(
    "opens the seeded tutorial when the app session starts with no document",
    Effect.fnUntraced(function* () {
      const counter = { invocations: 0 };
      const registry = yield* Effect.acquireRelease(
        Effect.sync(() => registryWithClient(countingOpenClient(counter))),
        (registry) => Effect.sync(() => registry.dispose())
      );

      yield* AtomRegistry.mount(registry, ontologyWorkbenchAutoOpenAtom);
      registry.get(ontologyWorkbenchAutoOpenAtom);
      yield* AtomRegistry.getResult(registry, openOntologyDocumentAtom);

      expect(counter.invocations).toBe(1);
      expect(O.getOrNull(registry.get(ontologyPathAtom))).toBe(ontologyWorkbenchSeedPath);
      pipe(registry.get(ontologySessionAtom), O.isSome, assertTrue);
      assertNone(registry.get(ontologyDocumentErrorAtom));
    })
  );

  it.effect(
    "leaves an already-open document alone",
    Effect.fnUntraced(function* () {
      const counter = { invocations: 0 };
      const registry = yield* Effect.acquireRelease(
        Effect.sync(() => registryWithClient(countingOpenClient(counter))),
        (registry) => Effect.sync(() => registry.dispose())
      );
      const openSession = createSession(
        CreateSessionInput.make({
          id: ontologySessionIdForPath(materialsPath),
          baseDataset: makeDataset([]),
        })
      );
      registry.set(ontologySessionAtom, O.some(openSession));
      registry.set(ontologyPathAtom, O.some(materialsPath));

      yield* AtomRegistry.mount(registry, ontologyWorkbenchAutoOpenAtom);
      registry.get(ontologyWorkbenchAutoOpenAtom);

      expect(counter.invocations).toBe(0);
      pipe(AsyncResult.isInitial(registry.get(openOntologyDocumentAtom)), assertTrue);
      expect(O.getOrNull(registry.get(ontologyPathAtom))).toBe(materialsPath);
      yield* Effect.void;
    })
  );

  it.effect(
    "attempts once per app session and never re-opens after the document goes away",
    Effect.fnUntraced(function* () {
      const counter = { invocations: 0 };
      const registry = yield* Effect.acquireRelease(
        Effect.sync(() => registryWithClient(countingOpenClient(counter))),
        (registry) => Effect.sync(() => registry.dispose())
      );

      const unmount = yield* Effect.acquireRelease(
        Effect.sync(() => registry.mount(ontologyWorkbenchAutoOpenAtom)),
        (release) => Effect.sync(release)
      );
      registry.get(ontologyWorkbenchAutoOpenAtom);
      yield* AtomRegistry.getResult(registry, openOntologyDocumentAtom);
      expect(counter.invocations).toBe(1);

      // The user putting the workbench back to "nothing open" must stick:
      // a panel remount may not open the tutorial again behind their back.
      unmount();
      registry.set(ontologySessionAtom, O.none());
      registry.set(ontologyPathAtom, O.none());
      yield* AtomRegistry.mount(registry, ontologyWorkbenchAutoOpenAtom);
      registry.get(ontologyWorkbenchAutoOpenAtom);

      expect(counter.invocations).toBe(1);
      assertNone(registry.get(ontologySessionAtom));
      assertNone(registry.get(ontologyPathAtom));
    })
  );

  it.effect(
    "keeps a failed first-run open quiet and does not retry",
    Effect.fnUntraced(function* () {
      let invocations = 0;
      const client = OntologyClient.of(((tag: string) => {
        if (tag === "OpenOntologyDocument") {
          invocations += 1;
          return Effect.fail(OntologyActionError.new("The tutorial document could not be opened."));
        }

        return Effect.die(`unexpected ontology RPC: ${tag}`);
      }) as unknown as OntologyClient["Service"]);
      const registry = yield* Effect.acquireRelease(
        Effect.sync(() => registryWithClient(client)),
        (registry) => Effect.sync(() => registry.dispose())
      );

      const unmount = yield* Effect.acquireRelease(
        Effect.sync(() => registry.mount(ontologyWorkbenchAutoOpenAtom)),
        (release) => Effect.sync(release)
      );
      registry.get(ontologyWorkbenchAutoOpenAtom);
      // The open action absorbs its own failure, so its result still settles.
      yield* AtomRegistry.getResult(registry, openOntologyDocumentAtom);

      expect(invocations).toBe(1);
      assertNone(registry.get(ontologySessionAtom));
      assertNone(registry.get(ontologyPathAtom));
      expect(O.getOrNull(registry.get(ontologyDocumentErrorAtom))).toBe("The tutorial document could not be opened.");

      unmount();
      yield* AtomRegistry.mount(registry, ontologyWorkbenchAutoOpenAtom);
      registry.get(ontologyWorkbenchAutoOpenAtom);
      expect(invocations).toBe(1);
    })
  );
});
